const express = require("express");
const { getApplications, registerRTO } = require("../controllers/rtoController");

const router = express.Router();

router.get("/applications", getApplications);
router.post("/register", registerRTO);

module.exports = router;
