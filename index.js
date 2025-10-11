const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

dotenv.config();
const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2z2tafq.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("seminardb");
    const booksCollection = db.collection("booksdb");

    // POST /books - Add new book
    app.post("/books", async (req, res) => {
      try {
        const newBook = req.body;
        const result = await booksCollection.insertOne(newBook);
        res.status(201).send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add book" });
      }
    });
    // GET /books?search=GETh-2001
    app.get("/books", async (req, res) => {
      const search = req.query.search;
      try {
        let query = {};
        if (search) {
          const regex = new RegExp(search, "i"); // case-insensitive
          query = { $or: [{ name: regex }, { code: regex }] };
        }
        const result = await booksCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch books" });
      }
    });

    // GET /books - Get all books (optional)
    app.get("/books", async (req, res) => {
      try {
        const result = await booksCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch books" });
      }
    });

    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  res.send("Server with CORS is running 🚀");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
