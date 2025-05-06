const express = require("express");
const {
  submitRplIntakeForm,
  submitEnrolmentForm,
  getRplIntakeFormDetails,
} = require("../controllers/rtoFormsController");
const router = express.Router();

router.post("/submit-rpl-intake-form", submitRplIntakeForm);
router.post("/submit-enrollment-form", submitEnrolmentForm);
router.get("/rpl-intake/:applicationId", getRplIntakeFormDetails);

module.exports = router;
