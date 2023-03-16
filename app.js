const fs = require('fs');
const express = require('express');
const path = require('path');
const app = express();
const { MongoClient } = require("mongodb");


// register view engine
app.set('view engine', 'ejs');

// middleware and static files (look at this tutorial https://www.youtube.com/watch?v=_GJKAs7A0_4&list=PL4cUxeGkcC9jsz4LDYc6kv3ymONOKxwBU&index=8)
app.use(express.static(path.join(__dirname,'public')));
app.use(express.urlencoded({extended: true}));
//app.use(morgan('dev'));

// setup MongoDb
const uri = "mongodb://127.0.0.1:27017";

app.listen(8888);

// ejs allows javascript code inside html
// all internal code lines must start with <% and end with %>
// any code to output something to the screen must start with <%= and end with %>
// to include another ejs file start with <%- and end with %>
app.get('/', (req, res) =>{
    res.render('nfLogin',{remainingAttempts: 3,response: "start"});
});

//process.stdin.on('data', function(){
//    console.log("You did a thing");
//    console.log(Date.now());
//    process.exit();
//});

app.post('/goHome', (req,res)=>{
    res.redirect('/');
});


app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const result = await findUser(username, password);
    var remainingAttempts = req.body.remainingAttempts;
    
    if (result) {
        console.log("Login Successful");
      res.redirect('/watchPage');
    } else {
        console.log("Login Failed");
        remainingAttempts--;
        console.log("Username or password incorrect\n " + remainingAttempts + " attempts remaining");
        res.render('nfLogin',{remainingAttempts: remainingAttempts, response: "loginFail"});
    }
  });

app.get('/watchPage', async (req,res) =>{
    const vidData = await findMovie("Joe The Biden");
    res.render('watchPage', { vidData });
});

app.get('/signup', (req, res) =>{
    res.render('signup');
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

app.get('/sign-up',(req,res) =>{
    res.redirect('signup');
});


app.get('/upload', (req,res)=>{
    const genres = [];
    genres.push("Select","Action","Horror","Romance");
    res.render("upload",{genres:genres})
});    

app.post('/uploadMovie',(req,res)=>{
    var obj = {
        title:req.body.title,
        url:req.body.ID,
        genre:req.body.genre,
        description:req.body.description,
        views:0
    }
    addMovie(obj).catch(console.dir);
    res.redirect("/");
});

app.use((req,res) =>{
    res.status(404).render('404');
});


// MongoDb related functions

async function addUser(obj){
    const client = new MongoClient(uri);
    try{
        const database = client.db("Notflix");
        const collection = database.collection("users");

        const result = await collection.insertOne(obj);
    } finally {
        await client.close();
    }
}

async function addMovie(obj){
    const client = new MongoClient(uri);
    try{
        const database = client.db("Notflix");
        const collection = database.collection("movies");

        const result = await collection.insertOne(obj);
    } finally {
        await client.close();
    }
}

async function findUser(username, password) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, email: 0, security: 0, accountType: 0};
    try {
        await client.connect();
        console.log("Connected to the database");

        const db = client.db("Notflix");
        const coll = db.collection("users");
        
        const result = await coll.findOne({username:username, password:password}, projection);
        return result;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
        console.log("Database connection closed");
    }
}
  

async function findMovie(title) {
    const client = new MongoClient(uri);
    const projection = {_id: 0, url: 0, genre: 0, description: 0, views:0};
    try {
        await client.connect();
        console.log("Connected to the database");

        const db = client.db("Notflix");
        const coll = db.collection("movies");
  
        const result = await coll.findOne({title:title}, projection);
        //console.log("Query result: ", result);
        return result;
    } catch (error) {
        console.error("Database error: ", error);
    } finally {
        await client.close();
        console.log("Database connection closed");
    }
}
  
  
  
  
  
  