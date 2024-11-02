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

const createNewApplication = async (req, res) => {
  const { userId } = req.params;

  const {
    formal_education,
    qualification,
    state,
    yearsOfExperience,
    locationOfExperience,
    industry,
    lookingForWhatQualification,
    type,
  } = req.body;

  console.log(req.body);
  try {
    // Step 1: Create an initial screening form
    const initialFormRef = await db.collection("initialScreeningForms").add({
      id: null,
      userId: userId,
      formal_education,
      qualification,
      state,
      yearsOfExperience,
      locationOfExperience,
      industry,
      lookingForWhatQualification,
    });

    //update the id in the initial screening form
    await db.collection("initialScreeningForms").doc(initialFormRef.id).update({
      id: initialFormRef.id,
    });

    // Step 2: Create a student intake form
    const studentFormRef = await db.collection("studentIntakeForms").add({
      id: null,
      course: null,
      intake: null,
      modeOfStudy: null,
      startDate: null,
      endDate: null,
      studentId: null,
      userId: userId,
    });

    //update the id in the student intake form
    await db.collection("studentIntakeForms").doc(studentFormRef.id).update({
      id: studentFormRef.id,
    });

    // Step 3: Create a documents form
    const documentsFormRef = await db.collection("documents").add({
      id: null,
      creditcard: null,
      resume: null,
      previousQualifications: null,
      reference1: null,
      reference2: null,
      employmentLetter: null,
      payslip: null,
      id: null,
    });

    //update the id in the documents form
    await db.collection("documents").doc(documentsFormRef.id).update({
      id: documentsFormRef.id,
    });

    // Step 5: Create an application document linking all forms
    const applicationRef = await db.collection("applications").add({
      id: null,
      userId: userId,
      initialFormId: initialFormRef.id,
      studentFormId: studentFormRef.id,
      documentsFormId: documentsFormRef.id,
      certificateId: null,
      status: [
        {
          statusname: "Waiting for Verification",
          time: new Date().toISOString(),
        },
      ],
      verified: false,
      paid: false,
      documents: {},
      currentStatus: "Waiting for Verification",
      type: type,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    res.status(201).json({ message: "Application created successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updateApplicationStatus,
  getUserApplications,
  createNewApplication,
};
