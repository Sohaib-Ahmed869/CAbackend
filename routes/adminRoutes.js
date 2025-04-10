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
  getAdminApplications,
  updateStudentIntakeForm,
  registerAssessor,
  UpdateQualification,
  updateExpense,
  getAgents,
  getAgentTargets,
  updateAgentTargets,
  getChartData,
  updateAutoDebit,
  getStudentApplications,
  getPaginatedApplications,
  getApplicationsStats,
  getPaymentStats,
  getPaginatedPayments,
} = require("../controllers/adminController");

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", registerAdmin);
router.post("/resend/:applicationId", resendEmail);
router.put("/verify/:userId", verifyCustomer);
router.put("/addNoteToApplication/:applicationId", addNoteToApplication);
router.put("/verifyApplication/:apxplicationId", verifyApplication);
router.put("/markApplicationAsPaid/:applicationId", markApplicationAsPaid);
router.put("/colorToApplication/:applicationId", addColorToApplication);
router.put("/student-intake-form/:studentFormId", updateStudentIntakeForm);
router.get("/customers", getCustomers);
//
router.get("/applications", getApplications);
router.get("/student-applications", getStudentApplications);
router.get("/paginated-applications", getPaginatedApplications);
router.get("/paginated-payment-applications", getPaginatedPayments);
router.get("/applications-stats", getApplicationsStats);
router.get("/payment-stats", getPaymentStats);
//
router.get("/applications/:userId", getAdminApplications);
router.get("/dashboardStats/:id", getDashboardStats);
router.get("/chart-data/:id", getChartData);
router.post("/register-assessor", registerAssessor);
router.patch("/updateQualification/:id", UpdateQualification);
router.patch("/updateExpense/:applicationId", updateExpense);
router.get("/getAgents", getAgents);
router.get("/targets", getAgentTargets);
router.patch("/targets/:agentId", updateAgentTargets);
router.put("/auto-debit/:applicationId", updateAutoDebit);
module.exports = router;
