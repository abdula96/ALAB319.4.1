import { MongoClient } from "mongodb";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const client = new MongoClient(process.env.ATLAS_URI);
let db;

// Initialize MongoDB connection
async function initializeDB() {
  try {
    const connection = await client.connect();
    console.log("Connected to MongoDB");
    db = connection.db("grade"); // Change database name to 'grade'

    // Ensure the 'grades' collection exists with at least one document
    const gradesCollection = db.collection("grades");
    const existingDocument = await gradesCollection.findOne({});
    if (!existingDocument) {
      await gradesCollection.insertOne({
        class_id: 101,
        learner_id: 1,
        score: 85, // Example document
      });
      console.log("Sample document inserted into 'grades' collection");
    }

    // Call functions to create indexes and validation
    await createIndexes();
    await createValidation();
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit process if the database connection fails
  }
}

// Create the necessary indexes
async function createIndexes() {
  try {
    await db.collection("grades").createIndex({ learner_id: 1 });
    await db.collection("grades").createIndex({ class_id: 1 });
    await db.collection("grades").createIndex({ learner_id: 1, class_id: 1 });
    console.log("Indexes created successfully");
  } catch (err) {
    console.error("Error creating indexes:", err);
  }
}

// Add validation for the grades collection
async function createValidation() {
  try {
    await db.command({
      collMod: "grades",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["class_id", "learner_id"],
          properties: {
            class_id: {
              bsonType: "int",
              minimum: 0,
              maximum: 300,
            },
            learner_id: {
              bsonType: "int",
              minimum: 0,
            },
          },
        },
      },
      validationAction: "warn",
    });
    console.log("Validation rules created successfully");
  } catch (err) {
    // Handle error gracefully; validation may already exist
    console.error("Error creating validation rules:", err);
  }
}

// Initialize the database connection
await initializeDB();

export default db;
