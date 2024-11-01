const express = require("express");
// const { authenticateUser } = require("../middleware/authMiddleware");
// const { allowRoles } = require("../middleware/roleMiddleware");
const { adminLogin, registerAdmin, getCustomers, verifyCustomer, getApplications, verifyApplication, markApplicationAsPaid } = require("../controllers/adminController");

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", registerAdmin);
router.get("/customers", getCustomers);
router.put("/verify/:userId", verifyCustomer);
router.get("/applications", getApplications);
router.put("/verifyApplication/:applicationId", verifyApplication);
router.put("/markApplicationAsPaid/:applicationId", markApplicationAsPaid);

module.exports = router;
