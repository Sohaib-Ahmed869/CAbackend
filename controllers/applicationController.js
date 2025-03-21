// controllers/applicationController.js
const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
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
    price,
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
      price: price,
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

//create new application by agent for a user
const createNewApplicationByAgent = async (req, res) => {
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
    price,
    agentId,
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
          status: "Waiting for Verification",
          time: new Date().toISOString(),
        },
      ],
      verified: false,
      paid: false,
      documents: {},
      currentStatus: "Waiting for Verification",
      type: type,
      price: price,
      agentId: agentId,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    res.status(201).json({ message: "Application created successfully" });

    // //send email to user
    // const userRef = db.collection("users").doc(userId);
    // const userDoc = await userRef.get();
    // const userData = userDoc.data();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const customerPayment = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();
    if (!doc.exists)
      return res.status(404).json({ message: "Application not found" });

    //get price of application
    const applicationData = doc.data();
    let price = applicationData.price;

    //remove , from price
    price = price.replace(",", "");

    //create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price * 100,
      currency: "aud",
    });

    res.status(200).json({ client_secret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const markApplicationAsPaid = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();
    if (!applicationDoc.exists)
      return res.status(404).json({ message: "Application not found" });

    await applicationRef.update({
      paid: true,
      currentStatus: "Student Intake Form",
    });

    await applicationRef.update({
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
    });

    let firstNameG = "";
    let lastNameG = "";

    // Fetch user email and send a notification
    const { userId } = applicationDoc.data();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const token = await auth.createCustomToken(userId);

    const loginUrl = `https://certifiedaustralia.vercel.app/existing-applications?token=${token}`;

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();

      firstNameG = firstName;
      lastNameG = lastName;

      const emailSubject = "Payment Confirmation and Next Steps";
      const emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>We are delighted to inform you that your payment has been successfully received and confirmed.</p>
        
        <p>Your application has now progressed to the <strong>"Student Intake Form"</strong> stage. At this step, we kindly request you to complete the necessary information in the intake form to proceed further.</p>
        
        <h3>Next Steps: Complete the Student Intake Form</h3>
        <ul>
          <li>Log in to your account on our platform.</li>
          <li>Navigate to the <strong>Existing Applications</strong> section in your dashboard.</li>
          <li>Fill in all required details accurately to ensure a smooth application process.</li>
        </ul>

        <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Documents</a>
      
        
        <p>If you have any questions or need support with the form, feel free to contact our support team. We're here to assist you every step of the way!</p>
        
        <p>Thank you once again for choosing us. We look forward to supporting you on your educational journey.</p>
        
        <p>Warm regards,</p>
        <p><strong>Certified Australia</strong></p>
      `;

      await sendEmail(email, emailBody, emailSubject);
    }

    const admin = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    admin.forEach(async (doc) => {
      const adminEmail = doc.data().email;
      const adminUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(adminUserId);
      const URL = `https://certifiedaustralia.vercel.app/admin?token=${loginToken}`;

      const body_email = `
      <h2 style="color: #2c3e50;">🎉 Payment Made</h2>
      <p style="color: #2c3e50;">The user ${firstNameG} ${lastNameG} has made the payment for the application</p>
      <a href="${URL}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      `;
      const subject = "New Payment Processed";
      await sendEmail(adminEmail, body_email, subject);
    });

    res.status(200).json({ message: "Application marked as paid" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserApplications,
  createNewApplication,
  customerPayment,
  updateApplicationStatus,
  markApplicationAsPaid,
  createNewApplicationByAgent,
};
