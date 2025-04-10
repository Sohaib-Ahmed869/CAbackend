const express = require("express");
const {
  getApplications,
  registerRTO,
  getDashboardStats,
  getAllRtos,
  sendApplicationToRto,
  getRTOPaginatedApplications,
} = require("../controllers/rtoController");
const {
  requestMoreDocuments,
} = require("../controllers/HandleRequestedDocuments");

const router = express.Router();

router.get("/applications", getApplications);
router.get("/paginated-rto-applications", getRTOPaginatedApplications);
router.post("/register", registerRTO);
router.get("/stats", getDashboardStats);
router.post("/request-documents/:id", requestMoreDocuments);
router.post("/sendApplicationtoRto", sendApplicationToRto);
router.get("/getAllRtos", getAllRtos);
module.exports = router;
