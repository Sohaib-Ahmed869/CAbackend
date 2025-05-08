const express = require("express");
const {
  submitRplIntakeForm,
  submitEnrolmentForm,
  getRplIntakeFormDetails,
  getEnrollmentFormDetails,
  generateRplIntake,
} = require("../controllers/rtoFormsController");
const router = express.Router();

router.post("/submit-rpl-intake-form", submitRplIntakeForm);
router.post("/submit-enrollment-form", submitEnrolmentForm);
router.get("/rpl-intake/:applicationId", getRplIntakeFormDetails);
router.get("/rpl-enrollment-kit/:applicationId", getEnrollmentFormDetails);
router.post("/generate-rpl-intake/:applicationId", generateRplIntake);

module.exports = router;
