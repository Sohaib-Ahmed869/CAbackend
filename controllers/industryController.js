const { db } = require("../firebase");
const { FieldValue } = require("firebase-admin").firestore;
// Controller to handle industry creation
exports.createIndustry = async (req, res) => {
  const { name, description } = req.body;
  console.log(req.body);
  try {
    const industry = await db.collection("industries").add({
      name,
      description,
      certifications: [],
    });
    res.send({ status: "industry created", id: industry.id });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
};

// Controller to handle industry retrieval
exports.getIndustries = async (req, res) => {
  try {
    const snapshot = await db.collection("industries").get();

    const certificationsSnapshot = await db.collection("certifications").get();
    const industries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      certifications: certificationsSnapshot.docs.map((cert) => {
        if (cert.data().industryId === doc.id) return cert.data();
      }),
    }));

    //clear the nulls in certifications
    industries.forEach((industry) => {
      industry.certifications = industry.certifications.filter(
        (cert) => cert !== undefined
      );
    });
    res.send({ industries });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Controller to handle industry update
exports.updateIndustry = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    await db.collection("industries").doc(id).update({
      name,
      description,
    });
    res.send({ status: "industry updated" });
  } catch (error) {
    console.log("ok");
    res.status(500).send({ error: error.message });
  }
};

// Controller to handle industry deletion
exports.deleteIndustry = async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("industries").doc(id).delete();
    res.send({ status: "industry deleted" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// Controller to add Certification to Industry
exports.addCertificationToIndustry = async (req, res) => {
  const { industryId, qualification, price, type } = req.body;

  console.log(req.body);
  try {
    const certification = await db.collection("certifications").add({
      industryId,
      qualification,
      price,
      type,
    });

    res.send({
      status: "certification added to industry",
      id: certification.id,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
};

// Controller to remove Certification from Industry
exports.removeCertificationFromIndustry = async (req, res) => {
  const { industryId, certificationId } = req.body;

  try {
    await db.collection("certifications").doc(certificationId).delete();

    res.send({ status: "certification removed from industry" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// controller to delete certification
// Controller to delete certification by name
exports.deleteCertification = async (req, res) => {
  const { name } = req.query;
  console.log(name);
  try {
    // Fetch the certification document by name
    const certificationsSnapshot = await db
      .collection("certifications")
      .where("qualification", "==", name)
      .get();

    console.log(certificationsSnapshot.docs.map((doc) => doc.qualification));

    if (certificationsSnapshot.empty) {
      return res.status(404).json({ message: "Certification not found" });
    }

    // Delete all certifications matching the given name
    const deletePromises = certificationsSnapshot.docs.map((doc) =>
      db.collection("certifications").doc(doc.id).delete()
    );

    await Promise.all(deletePromises);

    res.send({
      status: "Certification(s) deleted successfully",
      deletedCertificationName: name,
    });
  } catch (error) {
    console.error("Error deleting certification:", error);
    res.status(500).send({ error: error.message });
  }
};

exports.addMultipleIndustries = async (req, res) => {
  const industries = req.body;
  try {
    industries.forEach(async (industry) => {
      await db.collection("industries").add(industry);
    });
    res.send({ status: "industries added" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

exports.addMultipleCertifications = async (req, res) => {
  const certifications = req.body;
  try {
    certifications.forEach(async (certification) => {
      await db.collection("certifications").add(certification);
    });

    res.send({ status: "certifications added" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};
// Controller to update the price of a certification
exports.updateCertificationPrice = async (req, res) => {
  const { newPrice, certificationName } = req.body;

  console.log(certificationName);
  try {
    // Fetch the certification document by certification name
    const certificationsSnapshot = await db
      .collection("certifications")
      .where("qualification", "==", certificationName)
      .get();

    if (certificationsSnapshot.empty) {
      return res.status(404).json({ message: "Certification not found" });
    }

    // Update the price field for all matching certifications (if needed for more than one)
    const batch = db.batch();

    certificationsSnapshot.docs.forEach((doc) => {
      const certRef = db.collection("certifications").doc(doc.id);
      batch.update(certRef, { price: newPrice });
    });

    await batch.commit();

    res.send({ status: "Certification price updated successfully" });
  } catch (error) {
    console.error("Error updating certification price:", error);
    res.status(500).send({ error: error.message });
  }
};

/**
 * Exports all industries and their certification names as a simplified JSON
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with industries and their certification names
 */
exports.exportIndustriesAndCertifications = async (req, res) => {
  try {
    console.log("Exporting industries and certification names...");
    // Fetch all industries
    const industriesSnapshot = await db.collection("industries").get();

    if (industriesSnapshot.empty) {
      return res.status(404).json({ message: "No industries found" });
    }

    const result = [];

    // Process each industry
    for (const industryDoc of industriesSnapshot.docs) {
      const industryData = industryDoc.data();
      const industryId = industryDoc.id;

      // Get all certifications for this industry
      const certificationsSnapshot = await db
        .collection("certifications")
        .where("industryId", "==", industryId)
        .get();

      // Format industry data with only certification names
      const industryEntry = {
        id: industryId,
        name: industryData.name,
        certifications: []
      };

      // Add only certification names to the industry
      certificationsSnapshot.forEach((certDoc) => {
        const certData = certDoc.data();
        // Push the qualification (certification name) to the array
        if (certData.qualification) {
          industryEntry.certifications.push({
            id: certDoc.id,
            name: certData.qualification
          });
        }
      });

      result.push(industryEntry);
    }

    return res.status(200).json({
      message: "Industries and certification names exported successfully",
      data: result
    });
  } catch (error) {
    console.error("Error exporting industries and certification names:", error);
    return res.status(500).json({
      message: "Failed to export industries and certification names",
      error: error.message
    });
  }
};