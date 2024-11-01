const express = require("express");
const { getApplications } = require("../controllers/rtoController");

const router = express.Router();

router.get("/applications", getApplications);

module.exports = router;
