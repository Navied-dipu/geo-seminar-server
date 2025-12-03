const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();
const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://geo-seminar-client-qu2h.vercel.app",
    ],
    credentials: true,
  })
);

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
    app.get("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const book = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!book) {
          return res.status(404).send({ message: "Book not found" });
        }
        res.send(book);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // PATCH - Update book
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );
      res.send(result);
    });

    // DELETE - Delete book
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // POST /borrow
    app.post("/borrows", async (req, res) => {
      const { roll, bookId } = req.body;
      const user = await usersCollection.findOne({ roll });
      const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
      if (book.copies <= 0) {
        return res.status(400).send({ message: "No copies available" });
      }
      if (!user) {
        return res.status(400).send({ message: "User roll not found" });
      }
      const borrowDoc = {
        roll,
        email: user.email,
        userId: user._id,
        bookId: book._id,
        bookName: book.name,
        bookCode: book.code,
        author: book.author,
        borrowDate: new Date(),
        returned: false, // to track if returned
      };
      const result = await borrowBooksCollection.insertOne(borrowDoc);
      await booksCollection.updateOne(
        { _id: book._id },
        { $inc: { copies: -1 } }
      );
      res.send(result);
    });

    app.get("/borrowsall", async (req, res) => {
      const result = await borrowBooksCollection.find().toArray();
      res.send(result);
    });
    // ✅ Return a borrowed book
    app.patch("/borrows/return/:id", async (req, res) => {
      try {
        const borrowId = req.params.id;

        // Find the borrowed record
        const borrowRecord = await borrowBooksCollection.findOne({
          _id: new ObjectId(borrowId),
        });

        if (!borrowRecord) {
          return res.status(404).send({ message: "Borrow record not found" });
        }

        if (borrowRecord.returned) {
          return res.status(400).send({ message: "Book already returned" });
        }

        // Update borrow record → returned: true
        await borrowBooksCollection.updateOne(
          { _id: new ObjectId(borrowId) },
          {
            $set: {
              returned: true,
              returnDate: new Date(),
            },
          }
        );

        // Increase the book's available copies by +1
        await booksCollection.updateOne(
          { _id: new ObjectId(borrowRecord.bookId) },
          { $inc: { copies: 1 } }
        );

        res.send({
          message: "Book returned successfully",
          returned: true,
        });
      } catch (error) {
        console.error("Error updating return:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.get("/borrows", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }
      const user = await usersCollection.findOne({ email: email });
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      const borrowedBooks = await borrowBooksCollection
        .find({ userId: new ObjectId(user._id) })
        .toArray();

      res.send(borrowedBooks);
    });

    // users
    app.get("/users", async (req, res) => {
      const { email } = req.query;
      if (email) {
        const user = await usersCollection.findOne({ email });
        return res.send(user || {});
      }
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

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

module.exports = app;

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
