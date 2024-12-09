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
} = require("../controllers/applicationController");

router.delete("/deleteApplication/:applicationId", deleteApplication);
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
module.exports = router;
