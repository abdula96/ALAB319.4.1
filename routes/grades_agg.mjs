import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

/**
 * It is not best practice to separate these routes
 * like we have done here. This file was created
 * specifically for educational purposes, to contain
 * all aggregation routes in one place.
 */

/**
 * Grading Weights by Score Type:
 * - Exams: 50%
 * - Quizzes: 30%
 * - Homework: 20%
 */

// Get the weighted average of a specified learner's grades, per class
router.get("/learner/:id/avg-class", async (req, res) => {
  let collection = await db.collection("grades");

  try {
    let result = await collection
      .aggregate([
        {
          $match: { learner_id: Number(req.params.id) },
        },
        {
          $unwind: { path: "$scores" },
        },
        {
          $group: {
            _id: "$class_id",
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
            class_id: "$_id",
            avg: {
              $sum: [
                { $multiply: [{ $avg: "$exam" }, 0.5] },
                { $multiply: [{ $avg: "$quiz" }, 0.3] },
                { $multiply: [{ $avg: "$homework" }, 0.2] },
              ],
            },
          },
        },
      ])
      .toArray();

    if (result.length === 0) {
      res.status(200).json({ message: "No grades found for this learner." });
    } else {
      res.status(200).json(result);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error while fetching data");
  }
});

export default router;
