const express = require("express");
const {
  getApplications,
  registerRTO,
  getDashboardStats,
} = require("../controllers/rtoController");

const router = express.Router();

router.get("/applications", getApplications);
router.post("/register", registerRTO);
router.get("/stats", getDashboardStats);

module.exports = router;
  