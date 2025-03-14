// routes/applicationRoutes.js
const express = require("express");
const upload = require("../utils/multerconfig");
const router = express.Router();
const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  UploadCertificate,
  requestMoreDocuments,
} = require("../controllers/certificateController");

const {
  getUserApplications,
  createNewApplication,
  customerPayment,
  markApplicationAsPaid,
  createNewApplicationByAgent,
  deleteApplication,
  dividePaymentIntoTwo,
  processPayment,
  handleSquareWebhook,
  exportApplicationsToCSV,
  addDiscountToApplication,
  getApplicationExpenses,
  addExpenseToApplication,
  assignApplicationToAdmin,
  updateCallAttempts,
  updateContactStatus,
  unArchiveApplication,
  addAssessorNoteToApplication,
  sendToRTO,
  getApplicationStats,
  getApplicationById,
} = require("../controllers/applicationController");

router.delete("/deleteApplication/:applicationId", deleteApplication);
router.put("/unArchiveApplication/:applicationId", unArchiveApplication);
router.post("/new/:userId", createNewApplication);
router.post("/newByAgent/:userId", createNewApplicationByAgent);
router.get("/user/:userId", getUserApplications);
router.put(
  "/certificate/:applicationId/",
  upload.single("certificate"),
  UploadCertificate
);
router.put("/requestMoreDocuments/:applicationId", requestMoreDocuments);

router.post("/payment/:applicationId", customerPayment);
router.put("/markAsPaid/:applicationId", markApplicationAsPaid);
router.put("/dividePayment/:applicationId", dividePaymentIntoTwo);
router.post("/processPayment/:applicationId", processPayment);
router.post("/webhook", handleSquareWebhook);
router.get("/export", exportApplicationsToCSV);
router.put("/discount/:applicationId", addDiscountToApplication);
router.post("/expense/:applicationId", addExpenseToApplication);
router.get("/expenses/:applicationId", getApplicationExpenses);
router.put("/assign/:applicationId", assignApplicationToAdmin);
router.put("/callAttempts/:applicationId", updateCallAttempts);
router.put("/contactStatus/:applicationId", updateContactStatus);
router.put("/assessorNote/:applicationId", addAssessorNoteToApplication);
router.put("/sendToRTO/:applicationId", sendToRTO);
router.get("/stats", getApplicationStats);
router.get("/applications-by-id/:applicationId", getApplicationById);

module.exports = router;
