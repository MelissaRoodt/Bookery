import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import moment from "moment";

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Bookery",
    password: "123456",
    port: 5432,
});

db.connect();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let books = [
    {
        title: "Dragon Age",
        isbn: "0385472579",
        rating: "4",
        author: "john king", 
        date: "2023-01-01", 
        summary: "It was well written."
    },
    {
        title: "Warrior way",
        isbn: "0385472579",
        rating: "2",
        author: "leon soul", 
        date: "2018-01-01", 
        summary: "The ending was repetitive"
    }
]

app.get("/", async (req, res) => {
    //use public api
    const results = await axios.get("https://api.quotable.io/random");
    const quote = results.data;

    //use postgress database
    const database_results = await db.query("SELECT * FROM books");
    let db_books = [];
    database_results.rows.forEach((book) => {
        const dateFormatted = book.date.toISOString().slice(0,10);
        book.date = dateFormatted;
        db_books.push(book);
    });

    res.render("index.ejs", {books: db_books, content: quote});//change books : books if you dont have the database setup yet
});

app.get("/add", (req, res) => {
    res.render("add.ejs");
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
      console.log(err);
      res.redirect("/");
    }
});

app.get("/update", (req, res) => {
    res.render("update.ejs");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.listen(port, () => {
    console.log("Server running on port: " + port)
})