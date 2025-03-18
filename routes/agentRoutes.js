const express = require("express");
const {
  registerAgent,
  getCustomersByAgentId,
  getApplicationsByAgentId,
  getDashboardStats,
} = require("../controllers/agentController");
const {
  requestMoreDocuments,
} = require("../controllers/HandleRequestedDocuments");
const router = express.Router();

router.post("/register", registerAgent);
router.get("/customers/:agentId", getCustomersByAgentId);
router.get("/applications/:agentId", getApplicationsByAgentId);
router.post("/request-documents", requestMoreDocuments);

module.exports = router;
