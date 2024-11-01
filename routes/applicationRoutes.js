// routes/applicationRoutes.js
const express = require("express");
const {
  updateApplicationStatus,
  getUserApplications,
} = require("../controllers/applicationController");
const upload = require("../utils/multerconfig");

const { UploadCertificate } = require("../controllers/certificateController");

const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/user/:userId", getUserApplications);
router.put(
  "/certificate/:applicationId/",
  upload.single("certificate"),
  UploadCertificate,

);
module.exports = router;
