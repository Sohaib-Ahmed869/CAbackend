const express = require("express");
const {
  newLogin,
  verify2FA,
  resend2FACode,
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", newLogin);
router.post("/verify-2fa", verify2FA);
router.post("/resend-2fa", resend2FACode);

module.exports = router;
