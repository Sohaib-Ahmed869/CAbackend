// routes/applicationRoutes.js
const express = require("express");
const upload = require("../utils/multerconfig");
const router = express.Router();
const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { UploadCertificate } = require("../controllers/certificateController");

const {
  getUserApplications,
  createNewApplication,
  customerPayment,
  markApplicationAsPaid,
  createNewApplicationByAgent,
} = require("../controllers/applicationController");

router.post("/new/:userId", createNewApplication);
router.post("/newByAgent/:userId", createNewApplicationByAgent);
router.get("/user/:userId", getUserApplications);
router.put(
  "/certificate/:applicationId/",
  upload.single("certificate"),
  UploadCertificate
);
router.post("/payment/:applicationId", customerPayment);
router.put("/markAsPaid/:applicationId", markApplicationAsPaid);
module.exports = router;
