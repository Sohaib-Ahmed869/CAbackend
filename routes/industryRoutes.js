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
  addMultipleCertifications
} = require("../controllers/industryController");

router.post("/create", createIndustry);
router.post("/create-multiple", addMultipleIndustries);
router.post("/certification/create-multiple", addMultipleCertifications);
router.get("/", getIndustries);
router.put("/:id", updateIndustry);
router.delete("/:id", deleteIndustry);
router.post(
  "/certification",
  addCertificationToIndustry
);
router.delete(
  "/:industryId/certification/:certificationId",
  removeCertificationFromIndustry
);
router.delete("/certification/:id", deleteCertification);

module.exports = router;
