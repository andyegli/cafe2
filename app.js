//Node.js cafe web application
//Author: Chathuni Wahalathantri
//Date created: 14 February 2024

//This line uses the require function to include the express module.
var express = require('express');
//This line creates an instance called app in the express application.
var app = express();

//This line uses the require function to include the express-session module.
var session = require('express-session');
//This line contains the configuration to connect the database.
var conn = require('./dbConfig');
var bodyParser = require('body-parser');

//This line sets up the express application to use 'EJS' as the view engine.
app.set('view engine','ejs');
//This will set up the express application to include the session middleware.
app.use(session({
	secret: 'yoursecret',
	resave: true,
	saveUninitialized: true
}));

//These lines will ensure that the express application can handle both JSON and URL-encoded data.
app.use(express.json());
app.use(express.urlencoded({extended: false}));

//This line will check for any request with a URL path starting with '/public'.
app.use('/public', express.static('public'));

// Body parser middleware to parse form data
app.use(bodyParser.urlencoded({ extended: false }));

//This will make a GET request to the URL of your server to
//render the 'home' view and send HTML content as response.
app.get('/',function(req,res){
    res.render("home");
});

app.get('/login',function(req,res){
    res.render("login");
});

app.get('/register',function(req,res){
    res.render("register",{title:'Register'});
});

//This will send a POST request to '/register' which will store 
//the user information in a table.
app.post('/register', function(req, res) {
	let username = req.body.username;
	let email = req.body.email;
	let password = req.body.password;
	if (username && password) {
		var sql = `INSERT INTO users (username, email, password) VALUES ("${username}", "${email}", "${password}")`;
		conn.query(sql, function(err, result) {
			if (err) throw err;
			console.log('record inserted');
			res.render('login');
		})
	}
	else {
		console.log("Error");
	}
});

//This will check whether the records in the table match with the credentials 
//entered during login.
app.post('/auth', function(req, res) {
	let email = req.body.email;
	let password = req.body.password;
	if (email && password) {
		conn.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], 
		function(error, results, fields) {
			if (error) throw error;
			if (results.length > 0) {
				req.session.loggedin = true;
				req.session.email = email;
				req.session.role = results[0].role;
				console.log("User role:",results[0].role);
				console.log("User name:",results[0].username);
				res.redirect('/membersOnly');
			} else {
				res.send('Incorrect Email and/or Password!');
			}			
			res.end();
		});
	} else {
		res.send('Please enter Username and Password!');
		res.end();
	}
});

//Users can access this if they are logged in
app.get('/membersOnly', function (req, res, next) {
	if (req.session.loggedin) {
		console.log("Member only role:", req.session.role);
		if(req.session.role === "admin"){
			res.render('adminOnly', {adminEmail: req.session.email});
		}
		else if(req.session.role === "customer"){
			res.render('customerOnly', {memberEmail: req.session.email});
		}
		else{
			res.render('guestOnly', {guestEmail: req.session.email});

		}
	}
	else {
		res.send('Please login to view this page!');
	}
});

app.get('/menu', function (req,res){
	conn.query("SELECT * FROM foods", function(err,result){
		if (err) throw err;
		console.log(result);
        res.render('menuGaneshan',{title: 'My Menu', menuData:result});
	});
});

app.get('/contact',function(req,res){
    res.render("contact");
});

app.get('/order',function(req,res){
	conn.query("SELECT * FROM menu", function (err, result) {
		if (err) throw err;
		console.log(result);
		res.render('order',{title:'Order Now', menuData: result});
	});
});

app.post('/order', function(req, res, next) {
    var prefName = req.body.prefName;
    var email = req.session.email;
	var type = req.body.type;
    var food = req.body.food;
    var quantity = req.body.quantity;
    //var userId = req.body.userId; 
    //console.log(userId);
	console.log(email);
	console.log(type);
	console.log(food);
    //This query is used to link the tables orders and users using username as foreign key.
    conn.query(`INSERT INTO orders (prefName, email, food, quantity) VALUES ("${prefName}", "${email}", "${food}", "${quantity}")`, (err, orderResult) => {
    		if (err) throw err;
			console.log('Order record inserted');
        	res.render('home');
		});
    });


  
//This will be used to return to home page after the members logout.
app.get('/logout',(req,res) => {
	req.session.destroy();
	res.redirect('/');
});

app.listen(3000);
console.log('Running at Port 3000');



