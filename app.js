const express = require('express');
const path = require('path');
const app = express();
const { MongoClient } = require("mongodb");
const session = require('express-session');

// Program constant variables
const databaseName = "Notflix";
const userColl = "fortnite";
const movieColl = "movies";
//const genres = ["Action","Horror","Romance"];
const PORT = 5000;
const loginAttempts = 3;
const loginRefreshMin = 60;
const lockDurationHours = 1;


// register view engine
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({extended: true}));

// set up session
// should change secret periodically
app.use(session({
    secret:'youtestingthesecretrightnow',
    resave: false,
    saveUninitialized: false
}));

// signal handlers

process.on('SIGINT', async function(){
    console.log("Closing Server");
    await client.close();
    process.exit(0);
});

// setup MongoDb
const uri = "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
client.connect();
const db = client.db(databaseName);

// set website port
app.listen(PORT);

/////// post requests ///////
app.post('/logout', (req,res)=>{
    req.session.destroy();
    res.redirect('/');
});

app.post('/login', async (req, res) => {
    const user = await checkCredentials(req.body.username, req.body.password);
    
    refreshAttempts(req.body.username)

    const remainingAttempts = await useAttempt(req.body.username);
    if(remainingAttempts < 0){
        lockAccount(req.body.username);
    }
    var lock = await checkLock(req.body.username)
    if(lock && new Date() < lock){
        console.log("Account Locked");
        res.render('nfLogin',{response: "locked"});
        return;
    }
    if(!user){
        console.log("Login Failed");
        res.render('nfLogin',{attempts: remainingAttempts,response: "loginFail"});
        return;
    }

    refreshAttempts(user.username,true);
    console.log("Login Successful");
    req.session.user = user;
    res.redirect('/browsingPage');
});

app.post('/createUser', async (req,res)=>{
    const currUser = await checkAvailability(req.body.username);
    var prefillData = getPrefillSignup(req.body);

    if(currUser){
        console.log("username taken");
        res.render('signup',{prefillData, response: "usernameTaken"});
    }else if(req.body.password.toLowerCase().includes(req.body.username.toLowerCase())){
        console.log("Password cannot contain username");
        res.render('signup',{prefillData, response: "passwordUsername"});
    }else{
        var newUser = makeNewUser(req.body);
        addUser(newUser).catch(console.dir);
        
        console.log("Account Created");
        res.render("nfLogin",{response:"createdAccount"});
    }
});

app.post('/edit',(req,res) =>{
    req.session.movie = {
        title: req.body.title,
        url: req.body.url,
        genre: req.body.genre,
        description: req.body.description,
        views: req.body.views
    };
    res.redirect('upload');
});

app.post('/delete', async (req,res) => {
    deleteMovie(await getMovieID(req.body.url)).catch(console.dir);

    res.redirect('/browsingPage');
});

app.post('/uploadMovie',async (req,res)=>{
    var newMovie = {
        title:req.body.title,
        url:req.body.url,
        genre:req.body.genre,
        description:req.body.description,
        views:0
    }
    var previousEntry = await findMovie(newMovie.url);
    if(!previousEntry){
        addMovie(newMovie).catch(console.dir);
    }else{
        deleteMovie(await getMovieID(newMovie.url)).catch(console.dir);
        addMovie(newMovie).catch(console.dir);
        req.session.movie = ""
    }
    console.log("Movie Uploaded")
    res.redirect('/browsingPage');
});

app.post('/addGenre',async (req,res)=>{
    addGenre(genreFormat(req.body.newGenre));
    res.redirect('/upload');
});

// helper functions //
function genreFormat(str){
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}


/////// website directories ///////
app.get('/', (req, res) =>{
    res.render('nfLogin',{response: "defaultState"});
});

app.get('/watchPage/:url', async (req, res) => {
    const user = req.session.user;
    const url = req.params.url;
    const vidData = await findMovie(url);
    addView(getMovieID(vidData.url));
    res.render('watchPage', { user, vidData });
});

app.get('/signup', (req, res) =>{
    var prefillData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        username: req.body.username,
        email: req.body.email,
        question1: req.body.question1,
        question2: req.body.question2

    }
    res.render('signup',{prefillData, response:""});
});

app.get('/sign-up',(req,res) =>{
    res.redirect('signup');
});

app.get('/upload', async (req,res)=>{
    const user = req.session.user;
    var genres = await getGenres();
    movie = req.session.movie
    req.session.movie = 'undefined';
    res.render("upload",{user, genres, movie})
});

app.get('/uploadHelp', (req,res)=>{
    const user = req.session.user;
    res.render("uploadHelp", {user})
});

app.get('/browsingPage', async (req,res) =>{
    const user = req.session.user;
    const [urlData] = await Promise.all([storeMovies()]);

     function getMovieGenre(movieGenre) {
        return urlData.filter(movie => movie.genre === movieGenre).map(movie => movie)
    }
    const genreArray = await getGenres();
    const genres = {};

    for(var i = 0; i < genreArray.length; i++){
        genres[genreArray[i]] = getMovieGenre(genreArray[i]);
    }
    res.render("browsingPage", { user, genres, urlData });
});

function getGenres(){

}

// 404 page
app.use((req,res) =>{
    res.status(404).render('404');
});

/////// helper functions ///////

// getPrefillSignup
// gets prefill data for signup page
// takes req.body
// returns object with prefill data
function getPrefillSignup(body){
    var prefillData = {
        firstName: body.firstName,
        lastName: body.lastName,
        username: body.username,
        email: body.email,
        question1: body.question1,
        question2: body.question2
    };
    return prefillData;
}

// makeNewUser
// creates a new User object
// takes req.body
// returns object with user data from signup Page
function makeNewUser(body){
    var currTime = new Date()
    var newUser = {
        username: body.username,
        password: body.password,
        email: body.email,
        security: {
            "Mothers maiden name": body.question1,
            "City of birth": body.question2
        },
        accountType: "user",
        loginAttempts: 3,
        loginRefresh: currTime,
        lock: currTime
    };
    return newUser;
}

/////// MongoDb related functions ///////

// addUser
// takes a user object
// returns nothing
async function addUser(userObj){
    await db.collection(userColl).insertOne(userObj);
}

// addMovie
// takes a movie object (different database collection)
// returns nothing
async function addMovie(movieObj){
    await db.collection(movieColl).insertOne(movieObj);
}

// checkCredentials
// takes a username and password
// returns a user object
async function checkCredentials(username, password) {
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    const result = await db.collection(userColl).findOne({username:username, password:password}, projection);
    return result;
}

// checkAvailability
// takes a username
// returns a user object
async function checkAvailability(username) {
    const projection = {_id: 0, email: 0, security: 0, accountType: 0, password: 0};
        
    var regstr = "";
    for( var i = 0; i < username.length; i++){
        if (username.charAt(i) == '$'){
            regstr += "\\$";
        }else{
            regstr += username.charAt(i);
        }
    }
    const result = await db.collection(userColl).findOne({username: {$regex: new RegExp('^' + regstr + '$', 'i')}}, projection);
    return result;
}
  
// findMovie
// takes a title string
// returns a movie object
async function findMovie(url) {
    const projection = { _id: 0, url: 1, title: 0, genre: 0, description: 0, views: 0 };
    const result = await db.collection(movieColl).findOne({ url: url }, projection);
    return result;
}

// getMovieID
// takes a title string
// returns _ID from movie object
async function getMovieID(url) {
    const projection = {_id: 0, url: 1, title:0, genre: 0, description: 0, views:0};
    const result = await db.collection(movieColl).findOne({url:url}, projection);
    return result._id;
}
  
// deleteMovie
// takes _ID of movie
// returns nothing
async function deleteMovie(id) {
    const projection = {title: 0, url: 0, genre: 0, description: 0, views:0};
    await db.collection(movieColl).deleteOne({_id:await id}, projection);
    return;
}
  
// addView
// takes _ID of movie
// returns nothing
async function addView(id) {
    const projection = {title: 0, url: 0, genre: 0, description: 0, views:0};
    const result = await db.collection(movieColl).findOne({_id:await id}, projection);
    await db.collection(movieColl).updateOne({ _id:await id },{ $set: { views:result.views+1 } })
    return;
}

// storeMovies
// takes nothing
// returns array of urls
async function storeMovies() {
    const projection = {_id:0, url:1, genre:1, description:0, views:0, title:1};
    const cursor = await db.collection(movieColl).find({}, projection);
    const result = await cursor.toArray();
    return result;
}

// lockAccount
// takes a username
// returns nothing
async function lockAccount(username) {
    var lockTime = new Date();
    lockTime.setHours(lockTime.getHours() + lockDurationHours);

    const updateResult = await db.collection(userColl).updateOne({username: username},{ $set: {lock: lockTime}});
        
    if(updateResult.modifiedCount === 0){
        console.log(`No user with username ${username}`);
        return null;
    }
        
    return;
}

// useAttempt
// takes a username
// returns loginAttempts 
async function useAttempt(username) {
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    var newAttemptsTime = new Date();
    newAttemptsTime.setMinutes(newAttemptsTime.getMinutes() + loginRefreshMin);
    const updateResult = await db.collection(userColl).updateOne({username: username},{ $inc: {loginAttempts: -1}, $set:{loginRefresh:newAttemptsTime}});

    if(updateResult.modifiedCount === 0){
        return null;
    }

    const result = await db.collection(userColl).findOne({username:username}, projection);
    return result.loginAttempts;
}

// refreshAttempts
// takes a username
// returns nothing
async function refreshAttempts(username,forceRefresh = false) {
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};

    const result = await db.collection(userColl).findOne({username: username},projection);
    if(!result){
        console.log(`No user with username ${username}`);
        return;
    }
    if(result.loginRefresh < new Date() || forceRefresh){
        await db.collection(userColl).updateOne({username: username},{ $set: {loginAttempts: loginAttempts}});
    }
    return;
}

// checkLock
// takes a username
// returns lock if account exists
async function checkLock(username) {
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};

    const result = await db.collection(userColl).findOne({username: username},projection);
    if(!result){
        console.log(`No user with username ${username}`);
        return;
    }
    return result.lock;
}


// getGenres
// takes nothing
// returns genre array from genreList mongodb object
async function getGenres(){
    const result = await db.collection(movieColl).findOne({name:"genreList"});
    if(result){
        return result.genres;
    }
    return null;
}

// addGenre
// takes a genre name string
// adds genre name string to genreList object in mongodb
// returns nothing
async function addGenre(genreName){
    await db.collection(movieColl).updateOne({name:"genreList"},{$push:{genres:genreName}},{upsert:true});
    return; 
}
