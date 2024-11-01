// controllers/initialScreeningController.js
const { db } = require("../firebase");

// Update Initial Screening Form by applicationId
const updateInitialScreeningForm = async (req, res) => {
  const { applicationId } = req.params;
  const {
    formal_education,
    qualification,
    state,
    yearsOfExperience,
    locationOfExperience,
    industry,
    lookingForWhatQualification,
  } = req.body;

  try {
    // Step 1: Fetch the application document using applicationId
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Step 2: Get the initialFormId from the application document
    const { initialFormId } = applicationDoc.data();
    if (!initialFormId) {
      return res
        .status(404)
        .json({
          message: "Initial Screening Form ID not found in application",
        });
    }

    // Step 3: Update the initial screening form document using initialFormId
    const formRef = db.collection("initialScreeningForms").doc(initialFormId);
    await formRef.update({
      formal_education,
      qualification,
      state,
      yearsOfExperience,
      locationOfExperience,
      industry,
      lookingForWhatQualification,
    });

    res
      .status(200)
      .json({ message: "Initial Screening Form updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { updateInitialScreeningForm };

//example put request
// PUT /applications/:applicationId/initial-screening
// {
//   "formal_education": "High School",
//   "qualification": "Diploma",
//   "state": "NSW",
//   "yearsOfExperience": 5,
//   "locationOfExperience": "Australia",
//   "industry": "IT",
//   "lookingForWhatQualification": "Bachelor's Degree"
// }
