import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import moment from "moment"; //used for date formatting
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session ({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use(passport.initialize());
app.use(passport.session());

//this should be in enviroment variables, however this is a local application that will not be hosted on the web
const db = new pg.Client({
    user: process.env.USER,
    host: process.env.HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT,
});
db.connect();

async function getQouteAPI(){
    const results = await axios.get("https://api.quotable.io/random");
    const quote = results.data;
    return quote;
}

async function getBooks(database_results) {
    let db_books = [];
    database_results.rows.forEach((book) => {
        const dateFormatted = book.date.toISOString().slice(0, 10);
        book.date = dateFormatted;
        db_books.push(book);
    });
    return db_books;
}

app.get("/", async (req, res) => {
    if(req.isAuthenticated()){
        try{
            //use cookies to check if logedin
            const quote = await getQouteAPI();

            //use postgress database
            const database_results = await db.query("SELECT * FROM books ORDER BY title ASC");
            const db_books = await getBooks(database_results);
    
            res.render("index.ejs", {books: db_books, content: quote});
        }catch (err){
            console.error('Error retrieving data from database:', err);
            res.status(500).send(`Internal server error`);
        }
        
    }else{
        res.redirect("/login");
    }
});

app.get("/add", (req, res) => {
    if(req.isAuthenticated()){
        res.render("add.ejs");
    }else{
        res.redirect("/login");
    }
});

app.get("/update/:id", async (req, res) => {
    if(req.isAuthenticated()){
        try{
            const database_results = await db.query("SELECT * FROM books WHERE id = $1",
                [req.params.id]
            );
            const db_books = await getBooks(database_results);
            res.render("update.ejs", {books: db_books});
        }catch(err){
            console.error('Error fetching or rendering book update page:', err);
            res.status(500).send('Internal Server Error');
        }
        
    }else{
        res.redirect("/login");
    }
});

app.get("/delete/:id", async (req, res) => {
    if(req.isAuthenticated()){
        try {
            const result = await db.query("DELETE FROM books WHERE id = $1", [req.params.id]);
            if (result.rowCount === 0) {
                console.log(`No book deleted with id ${req.params.id}`);
                res.status(404).send('Book not found');
                return;
            }
            res.redirect("/");
        } catch (err) {
            console.error('Error deleting book:', err);
            res.status(500).send('Internal Server Error');
        }
        
    }else{
        res.redirect("/login");
    }
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/logout", (req, res) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
});

app.get("/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);
  
app.get("/auth/google/main",
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/login",
    })
);

app.post("/filter", async (req, res) => {
    if(req.isAuthenticated()){
        const quote = await getQouteAPI();

        const title = req.body["title"];
        if(title == ""){
            //if no filter then go home page
            res.redirect("/");
        }else {
            try{
                //if filter entered then do query
                const database_results = await db.query("SELECT * FROM books WHERE LOWER(title) LIKE '%' || $1 || '%';",
                    [title]);

                const db_books = await getBooks(database_results);
                res.render("index.ejs", {books: db_books, content: quote});//change books : books if you dont have the database setup yet
            }catch(err){
                console.error('Error filtering books:', err);
                res.status(500).send('Internal Server Error');
            }
        }
    }else {
        res.redirect("/login")
    }
    
});

app.post("/add", async (req, res) =>{
    const book = {
        title: req.body["title"],
        isbn: req.body["isbn"],
        rating: req.body["rating"],
        author: req.body["author"], 
        date: req.body["date"], 
        summary: req.body["summary"]
    }
    try{
        const results = await db.query("INSERT INTO books (title, author, isbn, rating, date, summary) VALUES ($1, $2, $3, $4, $5, $6)",
            [book.title, book.author, book.isbn, book.rating, book.date, book.summary]);
        
            res.redirect("/");
    }catch (err) {
        console.error('Error inserting book:', err);
        res.status(500).send('Internal Server Error');
    }
});

app.post("/update", async (req, res) => {
    const book = {
        id: req.body["id"],
        title: req.body["title"],
        isbn: req.body["isbn"],
        rating: req.body["rating"],
        author: req.body["author"], 
        date: req.body["date"], 
        summary: req.body["summary"]
    }
    console.log(book);

    try{
        await db.query("UPDATE books SET title=($1), author=($2), isbn=($3), rating=($4), date=($5), summary=($6) WHERE id=($7)",
            [book.title, book.author, book.isbn, book.rating, book.date, book.summary, book.id]);
            
            res.redirect("/");
    }catch (err) {
        console.error('Error updating book:', err);
        res.status(401).send(`Book not modified with ID: ${book.id}`);
    }
});

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;
    const re_password = req.body.re_password;

    if(password === re_password){
        try{
            const checkResults = await db.query("SELECT * FROM users WHERE email = $1", 
                [email]
            );
            if(checkResults.rows.length > 0){
                res.render("login.ejs", {error: "Email already exist try logging in"});
            }else{
                //password hashing
                bcrypt.hash(password, saltRounds, async (err, hash) => {
                    if(err) {
                        console.log(err);
                    }else{
                        const result = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", 
                            [email, hash] 
                         );
                         const user = result.rows[0];
                         req.login(user, (err) => {
                            if(err) {
                                console.log(err);
                            }
                            res.redirect("/");
                         });
                    }
                });  
            }
        }catch (err) {
            console.error('Error registering user:', err);
            res.status(500).send("Internal Server Error");
        }
    }else{
        res.render("register.ejs", {error: "Passwords are not identical."});
    }
});

app.post("/login",
    passport.authenticate("local", {
      successRedirect: "/",
      failureRedirect: "/login",
    })
);

passport.use(new Strategy (async function verify (username, password, cb) {
try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);

    if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashPassword = user.password;

        bcrypt.compare(password, storedHashPassword, (err, result) =>{
            if(err){
                return cb(err);
            }else if(result) {
                return cb (null, user);
            }else{
                return cb (null, false); //password failed
            }
        });
    } else {
        return cb("user not found");
    }
    } catch (err) {
    return cb(err);
    }
}));

passport.use("google",
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "http://localhost:3000/auth/google/main",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      },
      async (accessToken, refreshToken, profile, cb) => {
        try {
          console.log(profile);
          const result = await db.query("SELECT * FROM users WHERE email = $1", [
            profile.email,
          ]);
          if (result.rows.length === 0) {
            const newUser = await db.query(
              "INSERT INTO users (email, password) VALUES ($1, $2)",
              [profile.email, "google"]
            );
            return cb(null, newUser.rows[0]);
          } else {
            return cb(null, result.rows[0]);
          }
        } catch (err) {
          return cb(err);
        }
      }
    )
  );

passport.serializeUser((user, cb) => {
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(port, () => {
    console.log("Server running on port: " + port)
})

