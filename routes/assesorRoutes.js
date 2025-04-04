const express = require("express");
// const { authenticateUser } = require("../middleware/authMiddleware");
// const { allowRoles } = require("../middleware/roleMiddleware");
const { getApplications } = require("../controllers/adminController");

const router = express.Router();

router.get("/applications", getApplications);

module.exports = router;
