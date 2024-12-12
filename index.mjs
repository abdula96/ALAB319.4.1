import express from "express";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5050;
const app = express();

// Import routes
import grades from "./routes/grades.mjs";
import gradesAgg from "./routes/grades_agg.mjs";

// Middleware for JSON parsing
app.use(express.json());

// Default route
app.get("/", (req, res) => {
  res.send("Welcome to the Grades API.");
});

// Register routes
app.use("/grades", grades);
app.use("/grades/stats", gradesAgg);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    error: "Internal Server Error",
    message: "Something went wrong. Please try again later.",
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
