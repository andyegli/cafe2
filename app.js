//Node.js cafe web application
//Author: Chathuni Wahalathantri
//Date created: 14 February 2024
//Updated: May 27, 2025 (Added user/product management, email as user key, menu table, custom food_type)

// Include required modules
var express = require('express');
var app = express();
var session = require('express-session');
var conn = require('./dbConfig');
var bodyParser = require('body-parser');

console.log('Starting application...');

// Set up EJS as the view engine
app.set('view engine', 'ejs');
console.log('View engine set to EJS');

// Set up session middleware
app.use(session({
    secret: 'yoursecret',
    resave: true,
    saveUninitialized: true
}));
console.log('Session middleware configured');

// Handle JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
console.log('JSON and URL-encoded parsers enabled');

// Serve static files from /public
app.use('/public', express.static('public'));
console.log('Static files served from /public');

// Body parser middleware for form data
app.use(bodyParser.urlencoded({ extended: false }));
console.log('Body parser middleware configured');

// Admin authentication middleware
const isAdmin = (req, res, next) => {
    console.log('Checking admin authentication:', { loggedin: req.session.loggedin, role: req.session.role });
    if (req.session.loggedin && req.session.role === 'admin') {
        return next();
    }
    console.log('Admin authentication failed, sending error response');
    res.send('Please login as an admin to view this page!');
};

// Home route
app.get('/', function(req, res) {
    console.log('Entering / route');
    res.render('home');
    console.log('Rendered home view');
});

// Login route
app.get('/login', function(req, res) {
    console.log('Entering /login route');
    res.render('login');
    console.log('Rendered login view');
});

// Register route (GET)
app.get('/register', function(req, res) {
    console.log('Entering /register GET route');
    res.render('register', { title: 'Register' });
    console.log('Rendered register view');
});

// Register route (POST)
app.post('/register', function(req, res) {
    console.log('Entering /register POST route', req.body);
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    if (username && email && password) {
        const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'customer')`;
        console.log('Executing query:', sql, [username, email, password]);
        conn.query(sql, [username, email, password], function(err, result) {
            if (err) {
                console.error('Query error:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    console.log('Duplicate email detected');
                    return res.send('A user with this email already exists!');
                }
                return res.status(500).send('Server Error');
            }
            console.log('Query result: Record inserted', result);
            res.render('login');
            console.log('Rendered login view');
        });
    } else {
        console.log('Missing required fields:', req.body);
        res.send('Please enter all required fields!');
    }
});

// Authentication route
app.post('/auth', function(req, res) {
    console.log('Entering /auth route', req.body);
    let email = req.body.email;
    let password = req.body.password;
    if (email && password) {
        const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
        console.log('Executing query:', sql, [email, password]);
        conn.query(sql, [email, password], function(error, results, fields) {
            if (error) {
                console.error('Query error:', error);
                return res.status(500).send('Server Error');
            }
            console.log('Query result:', results);
            if (results.length > 0) {
                req.session.loggedin = true;
                req.session.email = email;
                req.session.role = results[0].role;
                console.log('User authenticated:', { role: results[0].role, username: results[0].username });
                res.redirect('/membersOnly');
                console.log('Redirecting to /membersOnly');
            } else {
                console.log('Authentication failed: Incorrect email/password');
                res.send('Incorrect Email and/or Password!');
            }
        });
    } else {
        console.log('Missing email or password');
        res.send('Please enter Email and Password!');
    }
});

// Members-only route (admin, customer, or guest)
app.get('/membersOnly', function(req, res, next) {
    console.log('Entering /membersOnly route', { loggedin: req.session.loggedin, role: req.session.role });
    if (req.session.loggedin) {
        if (req.session.role === 'admin') {
            res.render('adminOnly', { adminEmail: req.session.email });
            console.log('Rendered adminOnly view for admin');
        } else if (req.session.role === 'customer') {
            res.render('customerOnly', { memberEmail: req.session.email });
            console.log('Rendered customerOnly view');
        } else {
            res.render('guestOnly', { guestEmail: req.session.email });
            console.log('Rendered guestOnly view');
        }
    } else {
        console.log('Not logged in, sending error response');
        res.send('Please login to view this page!');
    }
});

// Admin redirect route
app.get('/admin', isAdmin, (req, res) => {
    console.log('Entering /admin route, redirecting to /membersOnly');
    res.redirect('/membersOnly');
});

// User Management route
app.get('/admin/user-management', isAdmin, (req, res) => {
    console.log('Entering /admin/user-management route');
    const sql = 'SELECT email, username, role FROM users';
    console.log('Executing query:', sql);
    conn.query(sql, (err, users) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result: Fetched users', users);
        const roles = [
            { name: 'admin' },
            { name: 'customer' },
            { name: 'guest' }
        ];
        const error = req.query.error;
        res.render('userManagement', { users, roles, error });
        console.log('Rendered userManagement view', { error });
    });
});

// Add User route
app.post('/admin/add-user', isAdmin, (req, res) => {
    console.log('Entering /admin/add-user route', req.body);
    const { username, email, password, role } = req.body;
    if (username && email && password && role) {
        const checkSql = `SELECT email FROM users WHERE email = ?`;
        console.log('Executing check query:', checkSql, [email]);
        conn.query(checkSql, [email], (err, results) => {
            if (err) {
                console.error('Check query error:', err);
                return res.status(500).send('Server Error');
            }
            if (results.length > 0) {
                console.log('Duplicate email detected:', email);
                return res.redirect('/admin/user-management?error=duplicate');
            }
            const sql = `INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`;
            console.log('Executing insert query:', sql, [username, email, password, role]);
            conn.query(sql, [username, email, password, role], (err, result) => {
                if (err) {
                    console.error('Insert query error:', err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log('Duplicate email detected (race condition):', email);
                        return res.redirect('/admin/user-management?error=duplicate');
                    }
                    return res.status(500).send('Server Error');
                }
                console.log('Query result: User added', { username, email, role });
                res.redirect('/admin/user-management');
                console.log('Redirecting to /admin/user-management');
            });
        });
    } else {
        console.log('Missing fields in add-user:', req.body);
        res.send('All fields are required!');
    }
});

// Edit User route
app.post('/admin/edit-user/:email', isAdmin, (req, res) => {
    console.log('Entering /admin/edit-user route', { email: req.params.email, body: req.body });
    const { username, role, password } = req.body;
    const email = req.params.email;
    if (username && role) {
        let sql, params;
        if (password) {
            // Update password if provided
            sql = `UPDATE users SET username = ?, role = ?, password = ? WHERE email = ?`;
            params = [username, role, password, email];
        } else {
            // Skip password update if not provided
            sql = `UPDATE users SET username = ?, role = ? WHERE email = ?`;
            params = [username, role, email];
        }
        console.log('Executing query:', sql, params);
        conn.query(sql, params, (err, result) => {
            if (err) {
                console.error('Query error:', err);
                return res.status(500).send('Server Error');
            }
            console.log('Query result: User updated', { email, username, role, passwordUpdated: !!password, affectedRows: result.affectedRows });
            res.redirect('/admin/user-management');
            console.log('Redirecting to /admin/user-management');
        });
    } else {
        console.log('Missing fields in edit-user:', req.body);
        res.send('All fields are required!');
    }
});

// Delete User route
app.get('/admin/delete-user/:email', isAdmin, (req, res) => {
    console.log('Entering /admin/delete-user route', { email: req.params.email });
    const email = req.params.email;
    const sql = `DELETE FROM users WHERE email = ?`;
    console.log('Executing query:', sql, [email]);
    conn.query(sql, [email], (err, result) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result: User deleted', { email, affectedRows: result.affectedRows });
        res.redirect('/admin/user-management');
        console.log('Redirecting to /admin/user-management');
    });
});

// Product Management route
app.get('/admin/product-management', isAdmin, (req, res) => {
    console.log('Entering /admin/product-management route');
    // Fetch products
    const productSql = 'SELECT food_id AS id, food_name AS name, price, food_type AS category FROM menu';
    console.log('Executing product query:', productSql);
    conn.query(productSql, (err, products) => {
        if (err) {
            console.error('Product query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result: Fetched products', products);
        // Fetch distinct food_type values
        const typeSql = 'SELECT DISTINCT food_type FROM menu WHERE food_type IS NOT NULL';
        console.log('Executing type query:', typeSql);
        conn.query(typeSql, (err, types) => {
            if (err) {
                console.error('Type query error:', err);
                return res.status(500).send('Server Error');
            }
            const foodTypes = types.map(type => type.food_type);
            console.log('Query result: Fetched food types', foodTypes);
            const error = req.query.error;
            res.render('productManagement', { products, foodTypes, error });
            console.log('Rendered productManagement view', { error });
        });
    });
});

// Add Product route
app.post('/admin/add-product', isAdmin, (req, res) => {
    console.log('Entering /admin/add-product route', req.body);
    const { name, price, category, customCategory } = req.body;
    const finalCategory = category === 'Other' ? customCategory : category;
    if (name && price && finalCategory) {
        const checkSql = `SELECT food_name FROM menu WHERE food_name = ?`;
        console.log('Executing check query:', checkSql, [name]);
        conn.query(checkSql, [name], (err, results) => {
            if (err) {
                console.error('Check query error:', err);
                return res.status(500).send('Server Error');
            }
            if (results.length > 0) {
                console.log('Duplicate product name detected:', name);
                return res.redirect('/admin/product-management?error=duplicate');
            }
            const sql = `INSERT INTO menu (food_name, price, food_type) VALUES (?, ?, ?)`;
            console.log('Executing insert query:', sql, [name, parseFloat(price), finalCategory]);
            conn.query(sql, [name, parseFloat(price), finalCategory], (err, result) => {
                if (err) {
                    console.error('Insert query error:', err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log('Duplicate product name detected (race condition):', name);
                        return res.redirect('/admin/product-management?error=duplicate');
                    }
                    return res.status(500).send('Server Error');
                }
                console.log('Query result: Product added', { name, price, category: finalCategory, insertId: result.insertId });
                res.redirect('/admin/product-management');
                console.log('Redirecting to /admin/product-management');
            });
        });
    } else {
        console.log('Missing fields in add-product:', req.body);
        res.send('All fields are required!');
    }
});

// Edit Product route
app.post('/admin/edit-product/:id', isAdmin, (req, res) => {
    console.log('Entering /admin/edit-product route', { id: req.params.id, body: req.body });
    const { name, price, category, customCategory } = req.body;
    const id = req.params.id;
    const finalCategory = category === 'Other' ? customCategory : category;
    if (name && price && finalCategory) {
        const checkSql = `SELECT food_name FROM menu WHERE food_name = ? AND food_id != ?`;
        console.log('Executing check query:', checkSql, [name, id]);
        conn.query(checkSql, [name, id], (err, results) => {
            if (err) {
                console.error('Check query error:', err);
                return res.status(500).send('Server Error');
            }
            if (results.length > 0) {
                console.log('Duplicate product name detected:', name);
                return res.redirect('/admin/product-management?error=duplicate');
            }
            const sql = `UPDATE menu SET food_name = ?, price = ?, food_type = ? WHERE food_id = ?`;
            console.log('Executing update query:', sql, [name, parseFloat(price), finalCategory, id]);
            conn.query(sql, [name, parseFloat(price), finalCategory, id], (err, result) => {
                if (err) {
                    console.error('Update query error:', err);
                    if (err.code === 'ER_DUP_ENTRY') {
                        console.log('Duplicate product name detected (race condition):', name);
                        return res.redirect('/admin/product-management?error=duplicate');
                    }
                    return res.status(500).send('Server Error');
                }
                console.log('Query result: Product updated', { id, name, price, category: finalCategory, affectedRows: result.affectedRows });
                res.redirect('/admin/product-management');
                console.log('Redirecting to /admin/product-management');
            });
        });
    } else {
        console.log('Missing fields in edit-product:', req.body);
        res.send('All fields are required!');
    }
});

// Delete Product route
app.get('/admin/delete-product/:id', isAdmin, (req, res) => {
    console.log('Entering /admin/delete-product route', { id: req.params.id });
    const id = req.params.id;
    const sql = `DELETE FROM menu WHERE food_id = ?`;
    console.log('Executing query:', sql, [id]);
    conn.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result: Product deleted', { id, affectedRows: result.affectedRows });
        res.redirect('/admin/product-management');
        console.log('Redirecting to /admin/product-management');
    });
});

// Menu route
app.get('/menu', function(req, res) {
    console.log('Entering /menu route');
    const sql = 'SELECT * FROM foods';
    console.log('Executing query:', sql);
    conn.query(sql, function(err, result) {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result:', result);
        res.render('menuGaneshan', { title: 'My Menu', menuData: result });
        console.log('Rendered menuGaneshan view');
    });
});

// Contact route
app.get('/contact', function(req, res) {
    console.log('Entering /contact route');
    res.render('contact');
    console.log('Rendered contact view');
});

// Order route (GET)
app.get('/order', function(req, res) {
    console.log('Entering /order GET route');
    const sql = 'SELECT * FROM menu';
    console.log('Executing query:', sql);
    conn.query(sql, function(err, result) {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result:', result);
        res.render('order', { title: 'Order Now', menuData: result });
        console.log('Rendered order view');
    });
});

// Order route (POST)
app.post('/order', function(req, res, next) {
    console.log('Entering /order POST route', req.body);
    var prefName = req.body.prefName;
    var email = req.session.email;
    var type = req.body.type;
    var food = req.body.food;
    var quantity = req.body.quantity;
    console.log('Order details:', { prefName, email, type, food, quantity });
    const sql = `INSERT INTO orders (prefName, email, food, quantity) VALUES (?, ?, ?, ?)`;
    console.log('Executing query:', sql, [prefName, email, food, quantity]);
    conn.query(sql, [prefName, email, food, quantity], (err, orderResult) => {
        if (err) {
            console.error('Query error:', err);
            return res.status(500).send('Server Error');
        }
        console.log('Query result: Order record inserted', orderResult);
        res.render('home');
        console.log('Rendered home view');
    });
});

// Logout route
app.get('/logout', (req, res) => {
    console.log('Entering /logout route');
    req.session.destroy();
    res.redirect('/');
    console.log('Session destroyed, redirected to /');
});

// Start server
app.listen(3000, () => {
    console.log('Running at Port 3000');
});