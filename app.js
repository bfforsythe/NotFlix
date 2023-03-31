const express = require('express');
const path = require('path');
const app = express();
const { MongoClient } = require("mongodb");
const session = require('express-session');

// Program constant variables
const databaseName = "Notflix";
const userColl = "fortnite";
const movieColl = "movies";
const genres = ["Action","Horror","Romance"];
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

// setup MongoDb
const uri = "mongodb://127.0.0.1:27017";

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
        res.render('nfLogin',{response: "loginFail"});
        return;
    }

    refreshAttempts(user.username,true);
    console.log("Login Successful");
    req.session.user = user;
    res.redirect('/browsingPage');
});

app.post('/createUser', async (req,res)=>{
    const currUser = await checkAvailability(req.body.username);
    prefillData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        username: req.body.username,
        email: req.body.email,
        question1: req.body.question1,
        question2: req.body.question2
    }

    if(currUser){
        console.log("username taken");
        res.render('signup',{prefillData, response: "usernameTaken"});
    }else if(req.body.password.includes(req.body.username)){
        console.log("Password cannot contain username");
        res.render('signup',{prefillData, response: "passwordUsername"});
    }else{
        var currTime = new Date()
        var newUser = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
            security: {
                "Mothers maiden name": req.body.question1,
                "City of birth": req.body.question2
            },
            accountType: "user",
            loginAttempts: 3,
            loginRefresh: currTime,
            lock: currTime
        };
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
        url:req.body.ID,
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
    prefillData = {
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

app.get('/upload', (req,res)=>{
    const user = req.session.user;
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
        return urlData.filter(movie => movie.genre === movieGenre).map(movie => movie.url)
    }

    const newMovieGenres = {
        Action: getMovieGenre("Action"),
        Horror: getMovieGenre("Horror"),
        Romance: getMovieGenre("Romance")
      };

    res.render("browsingPage", { user, newMovieGenres });
});

// 404 page
app.use((req,res) =>{
    res.status(404).render('404');
});


/////// MongoDb related functions ///////

// addUser
// takes a user object
// returns nothing
async function addUser(userObj){
    const client = new MongoClient(uri);
    try{
        const database = client.db(databaseName);
        const collection = database.collection(userColl);

        await collection.insertOne(userObj);
    } finally {
        await client.close();
    }
}

// addMovie
// takes a movie object
// returns nothing
async function addMovie(movieObj){
    const client = new MongoClient(uri);
    try{
        const database = client.db(databaseName);
        const collection = database.collection(movieColl);

        await collection.insertOne(movieObj);
    } finally {
        await client.close();
    }
}

// checkCredentials
// takes a username and password
// returns a user object
async function checkCredentials(username, password) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);
        
        const result = await coll.findOne({username:username, password:password}, projection);
        return result;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// checkAvailability
// takes a username
// returns a user object
async function checkAvailability(username) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0, password: 0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);
        
        var regstr = "";
        for( var i = 0; i < username.length; i++){
            if (username.charAt(i) == '$'){
                regstr += "\\$";
            }else{
                regstr += username.charAt(i);
            }
        }
        const result = await coll.findOne({username: {$regex: new RegExp('^' + regstr + '$', 'i')}}, projection);
        return result;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}
  
// findMovie
// takes a title string
// returns a movie object
async function findMovie(url) {
    const client = new MongoClient(uri);
    const projection = { _id: 0, url: 1, title: 0, genre: 0, description: 0, views: 0 };
    try {
        await client.connect();
        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
        const result = await coll.findOne({ url: url }, projection);
        return result;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// getMovieID
// takes a title string
// returns _ID from movie object
async function getMovieID(url) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, url: 1, title:0, genre: 0, description: 0, views:0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
  
        const result = await coll.findOne({url:url}, projection);
        return result._id;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}
  
// deleteMovie
// takes _ID of movie
// returns nothing
async function deleteMovie(id) {
    const client = new MongoClient(uri);
    const projection = {title: 0, url: 0, genre: 0, description: 0, views:0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
  
        await coll.deleteOne({_id:await id}, projection);
        return;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}
  
// addView
// takes _ID of movie
// returns nothing
async function addView(id) {
    const client = new MongoClient(uri);
    const projection = {title: 0, url: 0, genre: 0, description: 0, views:0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
        
        const result = await coll.findOne({_id:await id}, projection);
        await coll.updateOne({ _id:await id },{ $set: { views:result.views+1 } })
        return;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// storeMovies
// takes nothing
// returns array of urls
async function storeMovies() {
    const client = new MongoClient(uri);
    const projection = {_id:0, url:1, genre:1, description:0, views:0};

    try {
        await client.connect();
        const db = client.db(databaseName);
        const coll = db.collection(movieColl);

        const cursor = await coll.find({}, projection);
        const result = await cursor.toArray();
        return result;
    } catch (error) {
        console.error("DB Error: ", error);
        throw error;
    } finally {
        await client.close();
    }
}

// lockAccount
// takes a username
// returns nothing
async function lockAccount(username) {
    const client = new MongoClient(uri);
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);
        
        var lockTime = new Date();
        lockTime.setHours(lockTime.getHours() + lockDurationHours);

        const updateResult = await coll.updateOne({username: username},{ $set: {lock: lockTime}});
        
        if(updateResult.modifiedCount === 0){
            console.log(`No user with username ${username}`);
            return null;
        }
        
        return;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// useAttempt
// takes a username
// returns loginAttempts 
async function useAttempt(username) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);

        var newAttemptsTime = new Date();
        newAttemptsTime.setMinutes(newAttemptsTime.getMinutes() + loginRefreshMin);
        const updateResult = await coll.updateOne({username: username},{ $inc: {loginAttempts: -1}, $set:{loginRefresh:newAttemptsTime}});

        if(updateResult.modifiedCount === 0){
            return null;
        }

        const result = await coll.findOne({username:username}, projection);
        return result.loginAttempts;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// refreshAttempts
// takes a username
// returns nothing
async function refreshAttempts(username,forceRefresh = false) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);

        const result = await coll.findOne({username: username},projection);
        if(!result){
            console.log(`No user with username ${username}`);
            return;
        }
        if(result.loginRefresh < new Date() || forceRefresh){
            await coll.updateOne({username: username},{ $set: {loginAttempts: loginAttempts}});
        }
        return;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

// checkLock
// takes a username
// returns lock if account exists
async function checkLock(username) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(userColl);

        const result = await coll.findOne({username: username},projection);
        if(!result){
            console.log(`No user with username ${username}`);
            return;
        }
        return result.lock;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
    }
}

//

