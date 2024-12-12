import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

// Create a single grade entry
router.post("/", async (req, res) => {
  let collection = await db.collection("grades");
  let newDocument = req.body;

  // Rename fields for backwards compatibility
  if (newDocument.student_id) {
    newDocument.learner_id = newDocument.student_id;
    delete newDocument.student_id;
  }

  try {
    let result = await collection.insertOne(newDocument);
    res.status(201).send(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating grade entry");
  }
});

// Get a single grade entry
router.get("/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { _id: ObjectId(req.params.id) };

  try {
    let result = await collection.findOne(query);
    if (!result) {
      res.status(404).send({ message: "Grade entry not found" });
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching grade entry");
  }
});

// Add a score to a grade entry
router.patch("/:id/add", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { _id: ObjectId(req.params.id) };

  try {
    let result = await collection.updateOne(query, {
      $push: { scores: req.body },
    });
    if (!result.matchedCount) {
      res.status(404).send({ message: "Grade entry not found" });
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding score");
  }
});

// Remove a score from a grade entry
router.patch("/:id/remove", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { _id: ObjectId(req.params.id) };

  try {
    let result = await collection.updateOne(query, {
      $pull: { scores: req.body },
    });
    if (!result.matchedCount) {
      res.status(404).send({ message: "Grade entry not found" });
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error removing score");
  }
});

// Delete a single grade entry
router.delete("/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { _id: ObjectId(req.params.id) };

  try {
    let result = await collection.deleteOne(query);
    if (!result.deletedCount) {
      res.status(404).send({ message: "Grade entry not found" });
    } else {
      res.status(200).send({ message: "Grade entry deleted" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting grade entry");
  }
});

// Get route for backwards compatibility
router.get("/student/:id", async (req, res) => {
  res.redirect(`/learner/${req.params.id}`);
});

// Get a learner's grade data
router.get("/learner/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { learner_id: Number(req.params.id) };

  // Check for class_id parameter
  if (req.query.class) query.class_id = Number(req.query.class);

  try {
    let result = await collection.find(query).toArray();
    if (!result || result.length === 0) {
      res.status(404).send({ message: "No grades found for this learner." });
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching learner grades");
  }
});

// Delete a learner's grade data
router.delete("/learner/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { learner_id: Number(req.params.id) };

  try {
    let result = await collection.deleteOne(query);
    if (!result.deletedCount) {
      res.status(404).send({ message: "Learner grade data not found" });
    } else {
      res.status(200).send({ message: "Learner grade data deleted" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting learner grade data");
  }
});

// Get a class's grade data
router.get("/class/:id", async (req, res) => {
  let collection = await db.collection("grades");
  let query = { class_id: Number(req.params.id) };

  // Check for learner_id parameter
  if (req.query.learner) query.learner_id = Number(req.query.learner);

  try {
    let result = await collection.find(query).toArray();
    if (!result || result.length === 0) {
      res.status(404).send({ message: "No grades found for this class" });
    } else {
      res.status(200).send(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching class grades");
  }
});

// Stats route - Number of learners with weighted average > 70%
router.get("/stats", async (req, res) => {
  let collection = await db.collection("grades");

  try {
    let result = await collection
      .aggregate([
        {
          $unwind: { path: "$scores" },
        },
        {
          $group: {
            _id: "$learner_id", // Group by learner_id
            quiz: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "quiz"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
            exam: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "exam"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
            homework: {
              $push: {
                $cond: {
                  if: { $eq: ["$scores.type", "homework"] },
                  then: "$scores.score",
                  else: "$$REMOVE",
                },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            learner_id: "$_id",
            avg: {
              $sum: [
                { $multiply: [{ $avg: "$exam" }, 0.5] },
                { $multiply: [{ $avg: "$quiz" }, 0.3] },
                { $multiply: [{ $avg: "$homework" }, 0.2] },
              ],
            },
          },
        },
        {
          $match: {
            avg: { $gt: 70 }, // Filter learners with avg greater than 70
          },
        },
        {
          $count: "learners_above_70", // Count learners above 70%
        },
      ])
      .toArray();

    let totalLearners = await collection.distinct("learner_id").length;

    if (result.length > 0) {
      const learnersAbove70 = result[0].learners_above_70;
      const percentage = ((learnersAbove70 / totalLearners) * 100).toFixed(2);

      res.status(200).json({
        total_learners: totalLearners,
        learners_above_70: learnersAbove70,
        percentage_above_70: percentage,
      });
    } else {
      res.status(200).json({
        total_learners: totalLearners,
        learners_above_70: 0,
        percentage_above_70: 0,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error while fetching statistics");
  }
});

export default router;
