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
    const usersCollection = db.collection("usersdb");
    const borrowBooksCollection = db.collection("borrowBooksdb");

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

    // GET /books - Get all books (optional)
    app.get("/books", async (req, res) => {
      const result = await booksCollection.find().toArray();
      res.send(result);
    });
    // POST /borrow
    app.post("/borrow", async (req, res) => {
      try {
        const { roll, code } = req.body;
console.log(roll)
        const student = await usersCollection.findOne({ roll });
        if (!student) {
          return res.status(404).send({ message: "Roll number not found" });
        }

        const book = await booksCollection.findOne({ _id: new ObjectId(code) });
        if (!book) {
          return res.status(404).send({ message: "Book not found" });
        }

        // Parse copies safely
        const copies = parseInt(book.copies?.$numberInt || book.copies || 0);
        if (copies <= 0) {
          return res.status(400).send({ message: "No copies available" });
        }

        // Update copies
        await booksCollection.updateOne(
          { _id: new ObjectId(code) },
          { $set: { "copies.$numberInt": (copies - 1).toString() } }
        );

        await borrowBooksCollection.insertOne({
          roll,
          code,
          bookName: book.name,
          author: book.author,
          borrowedAt: new Date(),
        });

        res.send({ message: "Book borrowed successfully", success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    //
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const user = await usersCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }
        res.send(user);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Failed to fetch user" });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          return res.status(200).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(user);
        res.send({
          message: "User saved successfully",
          inserted: true,
          result,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
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
