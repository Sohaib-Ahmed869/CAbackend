const express = require("express");

const router = express.Router();

const {
  createIndustry,
  getIndustries,
  updateIndustry,
  deleteIndustry,
  addCertificationToIndustry,
  removeCertificationFromIndustry,
  deleteCertification,
  addMultipleIndustries,
  addMultipleCertifications,
  updateCertificationPrice,
  exportIndustriesAndCertifications
} = require("../controllers/industryController");

// Route to export industries and certifications
router.get("/export", exportIndustriesAndCertifications);
router.delete("/certification", deleteCertification);
router.post("/create", createIndustry);
router.post("/create-multiple", addMultipleIndustries);
router.post("/certification/create-multiple", addMultipleCertifications);
router.get("/", getIndustries);
router.put("/updatePrice", updateCertificationPrice);
router.put("/:id", updateIndustry);
router.delete("/:id", deleteIndustry);
router.post("/certification", addCertificationToIndustry);
router.delete(
  "/:industryId/certification/:certificationId",
  removeCertificationFromIndustry
);

module.exports = router;
