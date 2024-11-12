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
    const industries = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
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
    console.log(error);
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

    await db
      .collection("industries")
      .doc(industryId)
      .update({
        certifications: FieldValue.arrayUnion({
          id: certification.id,
          ...req.body,
        }),
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
    await db
      .collection("industries")
      .doc(industryId)
      .update({
        certifications: FieldValue.arrayRemove(certificationId),
      });

    await db.collection("certifications").doc(certificationId).delete();

    res.send({ status: "certification removed from industry" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};

// controller to delete certification
exports.deleteCertification = async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("certifications").doc(id).delete();
    //also delete certification from all industries
    const industries = await db
      .collection("industries")
      .where("certifications", "array-contains", id)
      .get();
    industries.forEach(async (doc) => {
      await db
        .collection("industries")
        .doc(doc.id)
        .update({
          certifications: db.FieldValue.arrayRemove(id),
        });
    });

    res.send({ status: "certification deleted" });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
};
