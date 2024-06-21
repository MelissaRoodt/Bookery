import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let books = [
    {
        title: "Dragon Age",
        rating: "4",
        author: "john king", 
        year: "2023", 
        summary: "It was well written."
    },
    {
        title: "Warrior way",
        rating: "2",
        author: "leon soul", 
        year: "2018", 
        summary: "The ending was repetitive"
    },
    {
        title: "Warrior way",
        rating: "2",
        author: "leon soul", 
        year: "2018", 
        summary: "The ending was repetitive"
    }
]

app.get("/", (req, res) => {
    res.render("index.ejs", {books: books});
});

app.get("/add", (req, res) => {
    res.render("add.ejs");
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