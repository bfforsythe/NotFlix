const fs = require('fs');
const express = require('express');
const app = express();


// register view engine
app.set('view engine', 'ejs');

// middleware and static files (look at this tutorial https://www.youtube.com/watch?v=_GJKAs7A0_4&list=PL4cUxeGkcC9jsz4LDYc6kv3ymONOKxwBU&index=8)
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));
//app.use(morgan('dev'));

app.listen(8080);

// ejs allows javascript code inside html
// all internal code lines must start with <% and end with %>
// any code to output something to the screen must start with <%= and end with %>
// to include another ejs file start with <%- and end with %>
app.get('/', (req, res) =>{
    res.render('nfLogin',{remainingAttempts: 3});
});

app.post('/login', (req,res)=>{
    // read file for now and save username and password
    fs.readFile("credentials.json", 'utf8', (err,data)=>{
        const obj = JSON.parse(data);
        var remainingAttempts = req.body.remainingAttempts;
        if(obj[req.body.username] != undefined){
            console.log("youre in");
            res.redirect('/');
        }else{
            remainingAttempts--;
            res.render('nfLogin',{remainingAttempts: remainingAttempts});
        }
    });
});

app.get('/signup', (req, res) =>{
    res.render('signup');
});

app.post('/createUser', (req,res)=>{
    // write to saved file a new user
    console.log(req.body.username + " signed up");
    res.redirect('/');
});

app.get('/sign-up',(req,res) =>{
    res.redirect('signup');
});

app.use((req,res) =>{
    res.status(404).render('404');
});
