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
app.listen(8888);

/////// post requests ///////
app.post('/goHome', (req,res)=>{
    res.redirect('/');
});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const user = await findUser(username, password);
    var remainingAttempts = req.body.remainingAttempts;
    
    if (user) {
        console.log("Login Successful");
        req.session.user = user;
        res.redirect('/watchPage');
    } else {
        console.log("Login Failed");
        remainingAttempts--;
        console.log("Username or password incorrect\n " + remainingAttempts + " attempts remaining");
        res.render('nfLogin',{remainingAttempts: remainingAttempts, response: "loginFail"});
    }
});

app.post('/createUser', (req,res)=>{
    // write to saved file a new user
    var data = fs.readFileSync("credentials.json");
    var json = JSON.parse(data);
    const currUser = json.find(obj => obj['username'].toUpperCase() === req.body.username.toUpperCase());

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
        res.render("nfLogin",{remainingAttempts:3, response:"createdAccount"});
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
        views:0
    }
    var previousEntry = findMovie(obj.title)
    if(!previousEntry){
        addMovie(obj).catch(console.dir);
    }else{
        // shoulve done something with upsert, but it does work
        // https://www.mongodb.com/docs/manual/reference/method/db.collection.update/
        deleteMovie(await getMovieID(obj.title)).catch(console.dir);
        addMovie(obj).catch(console.dir);
        req.session.movie = ""
    }
    console.log("Movie Uploaded")
    res.redirect("/");
});

/////// website directories ///////
app.get('/', (req, res) =>{
    res.render('nfLogin',{remainingAttempts: 3,response: "start"});
});

app.get('/watchPage', async (req,res) =>{
    const user = req.session.user;
    const vidData = await findMovie("A");   // to make dynamic, need a way to pass title where "A" is
    addView(getMovieID(vidData.title));
    res.render('watchPage', { user, vidData });
});

app.get('/signup', (req, res) =>{
    res.render('signup');
});

app.get('/sign-up',(req,res) =>{
    res.redirect('signup');
});

app.get('/upload', (req,res)=>{
    movie = req.session.movie
    const genres = [];
    genres.push("Action","Horror","Romance");
    res.render("upload",{genres, movie})
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

// findUser
// takes a username and password
// returns a user object
async function findUser(username, password) {
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
  
// findMovie
// takes a title string
// returns a movie object
async function findMovie(title) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, url: 0, genre: 0, description: 0, views:0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
  
        const result = await coll.findOne({title:title}, projection);
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
async function getMovieID(title) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, url: 0, genre: 0, description: 0, views:0};
    try {
        await client.connect();

        const db = client.db(databaseName);
        const coll = db.collection(movieColl);
  
        const result = await coll.findOne({title:title}, projection);
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
  
  