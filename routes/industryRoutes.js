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
} = require("../controllers/industryController");

router.post("/create", createIndustry);
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
