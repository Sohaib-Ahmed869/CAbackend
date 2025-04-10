const express = require("express");
// const { authenticateUser } = require("../middleware/authMiddleware");
// const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getApplications,
  getAssessorPendingApplications,
  getAssessedApplications,
} = require("../controllers/adminController");

const router = express.Router();

router.get("/applications", getApplications);
router.get("/pending-applications", getAssessorPendingApplications);
router.get("/assessed-applications", getAssessedApplications);

module.exports = router;
