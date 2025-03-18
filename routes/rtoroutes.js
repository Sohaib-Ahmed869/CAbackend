const express = require("express");
const {
  getApplications,
  registerRTO,
  getDashboardStats,
} = require("../controllers/rtoController");
const {
  requestMoreDocuments,
} = require("../controllers/HandleRequestedDocuments");

const router = express.Router();

router.get("/applications", getApplications);
router.post("/register", registerRTO);
router.get("/stats", getDashboardStats);
router.post("/request-documents/:id", requestMoreDocuments);

module.exports = router;
