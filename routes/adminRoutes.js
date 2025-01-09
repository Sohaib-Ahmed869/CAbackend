const express = require("express");
// const { authenticateUser } = require("../middleware/authMiddleware");
// const { allowRoles } = require("../middleware/roleMiddleware");
const {
  adminLogin,
  registerAdmin,
  getCustomers,
  verifyCustomer,
  getApplications,
  verifyApplication,
  markApplicationAsPaid,
  getDashboardStats,
  addNoteToApplication,
  resendEmail,
  addColorToApplication,
  getAdminApplications
} = require("../controllers/adminController");

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", registerAdmin);
router.get("/customers", getCustomers);
router.put("/verify/:userId", verifyCustomer);
router.get("/applications", getApplications);
router.get("/applications/:userId", getAdminApplications);
router.put("/verifyApplication/:apxplicationId", verifyApplication);
router.put("/markApplicationAsPaid/:applicationId", markApplicationAsPaid);
router.get("/dashboardStats/:id", getDashboardStats);
router.put("/addNoteToApplication/:applicationId", addNoteToApplication);
router.post("/resend/:userId", resendEmail);
router.put("/colorToApplication/:applicationId", addColorToApplication);

module.exports = router;
