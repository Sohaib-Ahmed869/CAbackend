// routes/userRoutes.js
const { authenticateUser } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const upload = require("../utils/multerconfig");
const express = require("express");
const multer = require("multer");
const {
  registerUser,
  verifyUser,
  registerUserbyAgent,
  changeEmail,
  changePhoneNumber,
  getUserInfo,
} = require("../controllers/userController");
const {
  updateApplicationStatus,
} = require("../controllers/applicationController");
const {
  DocumentsFormByApplicationId,
  uploadSingleFile,
  deleteSingleFile,
} = require("../controllers/documentController");
const {
  StudentIntakeFormByApplicationId,
} = require("../controllers/studentIntakeController");
const {
  updateInitialScreeningForm,
} = require("../controllers/initialScreeningController");

const router = express.Router();
router.get("/userDetails/:userId", getUserInfo);
router.post("/register", registerUser);
router.post("/registerByAgent", registerUserbyAgent);
router.put("/phonenumber/:userId", changePhoneNumber);
router.put("/email/:userId", changeEmail);
router.put("/updateApplicationStatus/:applicationId", updateApplicationStatus);
router.post(
  "/:applicationId/uploadSingle",
  upload.single("file"),
  uploadSingleFile
);
router.delete("/:applicationId/deleteSingle", deleteSingleFile);
router.post("/:applicationId/submitDocument", DocumentsFormByApplicationId);
router.put(
  "/StudentIntakeFormByApplicationId/:applicationId",
  upload.single("previousQualifications"),
  StudentIntakeFormByApplicationId
);
router.put(
  "/updateInitialScreeningForm/:applicationId",
  updateInitialScreeningForm
);

module.exports = router;
