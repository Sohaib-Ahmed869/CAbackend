const express = require("express");
const {
  createTask,
  getAllTasks,
  updateTaskDetails,
  updateTaskStatus,
} = require("../controllers/tasksController");
const router = express.Router();

router.post("/", createTask);
router.get("/", getAllTasks);
router.patch("/:taskId/details", updateTaskDetails);
router.patch("/:taskId/status", updateTaskStatus);

module.exports = router;
