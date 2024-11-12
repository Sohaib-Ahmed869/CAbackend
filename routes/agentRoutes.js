const express = require("express");
const {
  registerAgent,
  getCustomersByAgentId,
  getApplicationsByAgentId,
  getDashboardStats
} = require("../controllers/agentController");
const router = express.Router();

router.post("/register", registerAgent);
router.get("/customers/:agentId", getCustomersByAgentId);
router.get("/applications/:agentId", getApplicationsByAgentId);


module.exports = router;
