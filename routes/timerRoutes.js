// routes/timerRoutes.js
const express = require("express");
const {
  startTimer,
  pauseTimer,
  pingTimer,
  getAgentTimerLogs,
} = require("../controllers/timerController");

const router = express.Router();

router.post("/start", startTimer);
router.post("/pause", pauseTimer);
router.post("/ping", pingTimer);
router.get("/logs", getAgentTimerLogs);

module.exports = router;
