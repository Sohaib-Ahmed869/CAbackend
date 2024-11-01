// controllers/applicationController.js
const { db } = require("../firebase");

// Update Application Status
const updateApplicationStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { statusname } = req.body;
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();
    if (!doc.exists)
      return res.status(404).json({ message: "Application not found" });

    await applicationRef.update({
      status: admin.firestore.FieldValue.arrayUnion({
        statusname,
        time: new Date().toISOString(),
      }),
    });
    res.status(200).json({ message: "Application status updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//get all applications for a user
const getUserApplications = async (req, res) => {
  const { userId } = req.params;

  try {
    // Step 1: Query the 'applications' collection for documents with matching userId
    const applicationsRef = db.collection("applications");
    const snapshot = await applicationsRef.where("userId", "==", userId).get();

    // Step 2: Check if any applications exist
    if (snapshot.empty) {
      return res
        .status(404)
        .json({ message: "No applications found for this user" });
    }

    // Step 3: Map over the snapshot to get the applications and fetch related forms
    const applications = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const applicationData = doc.data();

        // Fetch initial screening form data if exists
        const initialFormData = applicationData.initialFormId
          ? (
              await db
                .collection("initialScreeningForms")
                .doc(applicationData.initialFormId)
                .get()
            ).data()
          : null;

        // Fetch student intake form data if exists
        const studentFormData = applicationData.studentFormId
          ? (
              await db
                .collection("studentIntakeForms")
                .doc(applicationData.studentFormId)
                .get()
            ).data()
          : null;

        // Fetch documents form data if exists
        const documentsFormData = applicationData.documentsFormId
          ? (
              await db
                .collection("documents")
                .doc(applicationData.documentsFormId)
                .get()
            ).data()
          : null;

        return {
          id: doc.id,
          ...applicationData,
          initialForm: initialFormData,
          studentForm: studentFormData,
          documentsForm: documentsFormData,
        };
      })
    );

    res.status(200).json({ applications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { updateApplicationStatus, getUserApplications };
