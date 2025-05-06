const { db, auth } = require("../firebase");

const submitRplIntakeForm = async (req, res) => {
  try {
    const { applicationId, formData } = req.body;

    // 1. Validate application exists
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 2. Generate form type identifier
    const qualificationSlug = formData.courseQualification
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const formType = `${qualificationSlug}Submitted`;

    // 3. Create new form document
    const formRef = await db.collection("BuildingAndConstructionForms").add({
      formType: "RPLIntake",
      formData: formData,
      userId: applicationDoc.data().userId,
      applicationId: applicationId,
      qualificationCode: formData.courseQualification.split(" ")[0],
      qualificationName: formData.courseQualification,
      status: "submitted",
      referenceId: `RPL-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 4. Update application document
    const updateData = {
      rplIntakeSubmitted: true,
      rplIntakeId: formRef.id,
    };

    await applicationRef.update(updateData);

    res.status(201).json({
      message: "Form submitted successfully",
      formId: formRef.id,
      applicationUpdate: updateData,
    });
  } catch (error) {
    console.error("Error submitting intake form:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};
const submitEnrolmentForm = async (req, res) => {
  try {
    const { applicationId, formData } = req.body;

    // 1. Validate application exists
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 2. Get initial screening form data
    const initialFormId = applicationDoc.data().initialFormId;
    if (!initialFormId) {
      return res
        .status(400)
        .json({ error: "Initial screening form not found" });
    }

    const initialFormDoc = await db
      .collection("initialScreeningForms")
      .doc(initialFormId)
      .get();
    if (!initialFormDoc.exists) {
      return res
        .status(404)
        .json({ error: "Initial screening form data not found" });
    }

    const { industry } = initialFormDoc.data();
    if (!industry) {
      return res
        .status(400)
        .json({ error: "Industry not found in initial screening data" });
    }

    // 3. Determine target collection based on industry
    const formattedIndustry = industry
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
    const collectionName = `${formattedIndustry}Forms`;

    // 4. Create new form document
    const formRef = await db.collection(collectionName).add({
      formType: "Enrolment",
      formData: formData,
      userId: applicationDoc.data().userId,
      applicationId: applicationId,
      industry: industry,
      qualificationCode:
        formData.courseSelection.selectedCourse.split(" - ")[0],
      qualificationName: formData.courseSelection.selectedCourse,
      status: "submitted",
      referenceId: `ENROL-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 5. Update application document
    const updateData = {
      enrolmentFormSubmitted: true,
      enrolmentFormId: formRef.id,
    };

    await applicationRef.update(updateData);

    res.status(201).json({
      message: "Enrolment form submitted successfully",
      formId: formRef.id,
      collection: collectionName,
      applicationUpdate: updateData,
    });
  } catch (error) {
    console.error("Error submitting enrolment form:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};
/**
 * Get RPL intake form details by application ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRplIntakeFormDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;

    // 1. Validate application exists
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 2. Check if the application has an RPL intake form submitted
    const applicationData = applicationDoc.data();
    if (!applicationData.rplIntakeSubmitted || !applicationData.rplIntakeId) {
      return res
        .status(404)
        .json({ error: "RPL intake form not found for this application" });
    }

    // 3. Fetch the form document
    const formRef = db
      .collection("BuildingAndConstructionForms")
      .doc(applicationData.rplIntakeId);
    const formDoc = await formRef.get();

    if (!formDoc.exists) {
      return res.status(404).json({ error: "RPL intake form not found" });
    }

    // 4. Validate form type
    const formData = formDoc.data();
    if (formData.formType !== "RPLIntake") {
      return res.status(400).json({ error: "Form is not an RPL intake form" });
    }

    // 5. Return the form data
    res.status(200).json({
      success: true,
      formId: formDoc.id,
      data: formData,
    });
  } catch (error) {
    console.error("Error retrieving RPL intake form:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

module.exports = {
  submitRplIntakeForm,
  submitEnrolmentForm,
  getRplIntakeFormDetails,
};
