const fs = require('fs');
const express = require('express');
const path = require('path');
const app = express();
const { MongoClient } = require("mongodb");
const session = require('express-session');

// Program constant variables
const databaseName = "Notflix";
const userColl = "users";
const movieColl = "movies";
const loginAttempts = 3;
const genres = ["Action","Horror","Romance"];


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
app.listen(5000);

/////// post requests ///////
app.post('/goHome', (req,res)=>{
    res.redirect('/');
});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const user = await checkCredentials(username, password);
    var remainingAttempts = req.body.remainingAttempts;
    
    if (user) {
        console.log("Login Successful");
        req.session.user = user;
        res.redirect('/browsingPage');
    } else {
        console.log("Login Failed");
        remainingAttempts--;
        console.log("Username or password incorrect\n " + remainingAttempts + " attempts remaining");
        res.render('nfLogin',{remainingAttempts: remainingAttempts, response: "loginFail"});
    }
});

app.post('/createUser', async (req,res)=>{
    // write to saved file a new user
    const currUser = await checkAvailability(req.body.username);

    if(currUser){
        console.log("username taken");
        res.render('signup',{response: "usernameTaken"});
    }else if(req.body.password.includes(req.body.username)){
        console.log("Password cannot contain username");
        res.render('signup',{response: "passwordUsername"});
    }else{
        var obj = {
            username: req.body.username,
            password: req.body.password,
            email: req.body.email,
            security: {
                "Mothers maiden name": req.body.question1,
                "City of birth": req.body.question2
            },
            accountType: "user"
        };
        addUser(obj).catch(console.dir);
        
        console.log("Account Created");
        res.render("nfLogin",{remainingAttempts:loginAttempts, response:"createdAccount"});
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

app.post('/uploadMovie',async (req,res)=>{
    var obj = {
        title:req.body.title,
        url:req.body.ID,
        genre:req.body.genre,
        description:req.body.description,
        views:req.body.views
    }
    var previousEntry = await findMovie(obj.url);
    console.log("PREEEEEEVIOUS IS: ", previousEntry);
    if(!previousEntry){
        addMovie(obj).catch(console.dir);
    }else{
        deleteMovie(await getMovieID(obj.url)).catch(console.dir);
        addMovie(obj).catch(console.dir);
        req.session.movie = ""
    }
    console.log("Movie Uploaded")
    res.redirect('/browsingPage');
});

/////// website directories ///////
app.get('/', (req, res) =>{
    res.render('nfLogin',{remainingAttempts: loginAttempts,response: "start"});
});

app.get('/watchPage/:url', async (req, res) => {
    const user = req.session.user;
    const url = req.params.url; // change title to url
    const vidData = await findMovie(url);
    addView(getMovieID(vidData.url));
    res.render('watchPage', { user, vidData });
});

app.get('/signup', (req, res) =>{
    res.render('signup',{response:""});
});

app.get('/sign-up',(req,res) =>{
    res.redirect('signup');
});

app.get('/upload', (req,res)=>{
    movie = req.session.movie
    console.log("VIEWSSS",movie.views);
    res.render("upload",{genres, movie})
});

app.get('/browsingPage', async (req,res) =>{
    const user = req.session.user;
    const [urlData] = await Promise.all([storeMovies(), ]);

    const newMovieGenres = {
        Action: urlData.filter(movie => movie.genre === "Action").map(movie => movie.url),
        Horror: urlData.filter(movie => movie.genre === "Horror").map(movie => movie.url),
        Romance: urlData.filter(movie => movie.genre === "Romance").map(movie => movie.url)
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
async function addUser(obj){
    const client = new MongoClient(uri);
    try{
        const database = client.db(databaseName);
        const collection = database.collection(userColl);

        const result = await collection.insertOne(obj);
    } finally {
        await client.close();
    }
}

// addMovie
// takes a movie object
// returns nothing
async function addMovie(obj){
    const client = new MongoClient(uri);
    try{
        const database = client.db(databaseName);
        const collection = database.collection(movieColl);

        const result = await collection.insertOne(obj);
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
// takes a username and password
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




//Store Movies
// takes nothing
// returns array of urls
async function storeMovies() {
    const client = new MongoClient(uri);
    const projection = {_id:0, url:1, genre:1, description:0, views:0};

    try {
        await client.connect();
        const db = client.db("Notflix");
        const coll = db.collection("movies");

        const cursor = await coll.find({}, projection);
        const result = await cursor.toArray();
        //console.log("------RESULT--------- ", result);
        return result;
    } catch (error) {
        console.error("DB Error: ", error);
        throw error;
    } finally {
        await client.close();
    }
}
  
  