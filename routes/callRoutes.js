const express = require("express");
const router = express.Router();
const callController = require("../controllers/callController");

// Route to initiate a call
router.post("/make-call", callController.makeCall);

// Route for IVR welcome message
router.post("/ivr-welcome", callController.ivrWelcome);

// Route for handling IVR responses
router.post("/handle-ivr-response", callController.handleIvrResponse);

module.exports = router;