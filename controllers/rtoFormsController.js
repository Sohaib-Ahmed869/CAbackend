const { db, auth, bucket } = require("../firebase");
const { generateEnrollmentPdf } = require("../utils/createEnrollmentForm");
const { fillEnrolmentForm } = require("../utils/FillEnrollmentForm");
const { fillRPLIntakeForm } = require("../utils/FillIntakeForm");

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
/**
 * Route handler to retrieve enrollment form details based on application ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getEnrollmentFormDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;

    // 1. Validate application exists
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ error: "Application not found" });
    }

    // 2. Check if the application has an enrollment form submitted
    const applicationData = applicationDoc.data();
    if (
      !applicationData.enrolmentFormSubmitted ||
      !applicationData.enrolmentFormId
    ) {
      return res
        .status(404)
        .json({ error: "Enrollment form not found for this application" });
    }

    // 3. Fetch the form document
    const formRef = db
      .collection("BuildingAndConstructionForms")
      .doc(applicationData.enrolmentFormId);
    const formDoc = await formRef.get();

    if (!formDoc.exists) {
      return res.status(404).json({ error: "Enrollment form not found" });
    }

    // 4. Validate form type
    const formData = formDoc.data();
    if (formData.formType !== "Enrolment") {
      return res.status(400).json({ error: "Form is not an enrollment form" });
    }

    // 5. Return the form data
    res.status(200).json({
      success: true,
      formId: formDoc.id,
      data: formData,
    });
  } catch (error) {
    console.error("Error retrieving enrollment form:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
};

// Route to generate and upload filled RPL Intake form
const generateRplIntake = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { formData } = req.body;

    console.log(formData)
    if (!applicationId) {
      return res
        .status(400)
        .json({ success: false, message: "Application ID is required" });
    }

    if (!formData) {
      return res
        .status(400)
        .json({ success: false, message: "Form data is required" });
    }

    // Get the application document to verify it exists
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();
    const userId = applicationDoc.data().userId;
    if (!applicationDoc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    }

    // Fill the PDF form and upload to Firebase
    const result = await generateEnrollmentPdf(
      formData,
      applicationId,
      userId,
      db,
      bucket
    );

    return res.status(200).json({
      success: true,
      message: "RPL Intake form generated and uploaded successfully",
      fileUrl: result.fileUrl,
    });
  } catch (error) {
    console.error("Error in generate-rpl-intake route:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate RPL Intake form",
      error: error.message,
    });
  }
};

module.exports = {
  submitRplIntakeForm,
  getEnrollmentFormDetails,
  submitEnrolmentForm,
  generateRplIntake,
  getRplIntakeFormDetails,
};
