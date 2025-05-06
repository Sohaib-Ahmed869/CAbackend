const express = require("express");
const {
  createTask,
  getAllTasks,
  updateTaskDetails,
  updateTaskStatus,
  getAppIDs,
  getApplicationDetails,
} = require("../controllers/tasksController");
const router = express.Router();

router.post("/", createTask);
router.get("/", getAllTasks);
router.patch("/:taskId/details", updateTaskDetails);
router.patch("/:taskId/status", updateTaskStatus);
router.get("/getAppIDs", getAppIDs);
router.get("/getApplicationDetails/:applicationId", getApplicationDetails);

module.exports = router;
