const express = require("express");
const {
  submitRplIntakeForm,
  submitEnrolmentForm,
  getRplIntakeFormDetails,
  getEnrollmentFormDetails,
  markApplicationSubmitted,
  markAssessmentSubmitted,
} = require("../controllers/rtoFormsController");
const router = express.Router();

router.post("/submit-rpl-intake-form", submitRplIntakeForm);
router.post("/submit-enrollment-form", submitEnrolmentForm);
router.get("/rpl-intake/:applicationId", getRplIntakeFormDetails);
router.get("/rpl-enrollment-kit/:applicationId", getEnrollmentFormDetails);
// router.post("/generate-rpl-intake/:applicationId", generateRplIntake);
router.post("/mark-application-submitted", markApplicationSubmitted);
router.post("/mark-assessment-submitted", markAssessmentSubmitted);

module.exports = router;
