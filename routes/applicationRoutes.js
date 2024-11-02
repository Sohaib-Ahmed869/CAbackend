// routes/applicationRoutes.js
const express = require("express");
const upload = require("../utils/multerconfig");
const router = express.Router();
const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const { UploadCertificate } = require("../controllers/certificateController");

const {
  updateApplicationStatus,
  getUserApplications,
  createNewApplication,
} = require("../controllers/applicationController");

router.post("/new/:userId", createNewApplication);
router.get("/user/:userId", getUserApplications);
router.put(
  "/certificate/:applicationId/",
  upload.single("certificate"),
  UploadCertificate
);
module.exports = router;
