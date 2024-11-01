// routes/userRoutes.js
const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const upload = require("../utils/multerconfig");
const express = require("express");
const { registerUser, verifyUser } = require("../controllers/userController");
const {
  updateApplicationStatus,
} = require("../controllers/applicationController");
const {
  DocumentsFormByApplicationId,
} = require("../controllers/documentController");
const {
  StudentIntakeFormByApplicationId,
} = require("../controllers/studentIntakeController");
const {
  updateInitialScreeningForm,
} = require("../controllers/initialScreeningController");

const router = express.Router();

router.post("/register", registerUser);
router.put(
  "/verify/:userId",
  authenticateUser,
  allowRoles(["admin"]),
  verifyUser
);
router.put("/updateApplicationStatus/:applicationId", updateApplicationStatus);
router.put(
  "/documentUpload/:applicationId",
  upload.fields([
    { name: "license", maxCount: 1 },
    { name: "passport", maxCount: 1 },
    { name: "birth_certificate", maxCount: 1 },
    { name: "medicare", maxCount: 1 },
    { name: "creditcard", maxCount: 1 },
    { name: "resume", maxCount: 1 },
    { name: "previousQualifications", maxCount: 1 },
    { name: "reference1", maxCount: 1 },
    { name: "reference2", maxCount: 1 },
    { name: "employmentLetter", maxCount: 1 },
    { name: "payslip", maxCount: 1 },
  ]),
  DocumentsFormByApplicationId
);

router.put(
  "/StudentIntakeFormByApplicationId/:applicationId",
  StudentIntakeFormByApplicationId
);
router.put(
  "/updateInitialScreeningForm/:applicationId",
  updateInitialScreeningForm
);

module.exports = router;
