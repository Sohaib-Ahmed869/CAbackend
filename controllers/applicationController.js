// controllers/applicationController.js
const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 });
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
    // Check if data is already in the cache
    const cachedApplications = cache.get(`userApplications:${userId}`);
    if (cachedApplications) {
      return res.status(200).json({ applications: cachedApplications });
    }

    // Step 1: Fetch user applications
    const applicationsSnapshot = await db
      .collection("applications")
      .where("userId", "==", userId)
      .get();

    if (applicationsSnapshot.empty) {
      return res
        .status(404)
        .json({ message: "No applications found for this user" });
    }

    // Step 2: Collect all form IDs from applications
    const applicationDocs = applicationsSnapshot.docs.map((doc) => doc.data());
    const initialFormIds = applicationDocs
      .map((app) => app.initialFormId)
      .filter(Boolean);
    const studentFormIds = applicationDocs
      .map((app) => app.studentFormId)
      .filter(Boolean);
    const documentsFormIds = applicationDocs
      .map((app) => app.documentsFormId)
      .filter(Boolean);

    // Step 3: Fetch all related forms in parallel
    const [initialFormsSnapshot, studentFormsSnapshot, documentsFormsSnapshot] =
      await Promise.all([
        db
          .collection("initialScreeningForms")
          .where("__name__", "in", initialFormIds)
          .get(),
        db
          .collection("studentIntakeForms")
          .where("__name__", "in", studentFormIds)
          .get(),
        db
          .collection("documents")
          .where("__name__", "in", documentsFormIds)
          .get(),
      ]);

    // Step 4: Map forms to their IDs for quick lookups
    const initialFormsMap = {};
    initialFormsSnapshot.docs.forEach((doc) => {
      initialFormsMap[doc.id] = doc.data();
    });

    const studentFormsMap = {};
    studentFormsSnapshot.docs.forEach((doc) => {
      studentFormsMap[doc.id] = doc.data();
    });

    const documentsFormsMap = {};
    documentsFormsSnapshot.docs.forEach((doc) => {
      documentsFormsMap[doc.id] = doc.data();
    });

    // Step 5: Enrich applications with related forms
    const applications = applicationDocs.map((app) => ({
      ...app,
      initialForm: initialFormsMap[app.initialFormId] || null,
      studentForm: studentFormsMap[app.studentFormId] || null,
      documentsForm: documentsFormsMap[app.documentsFormId] || null,
    }));

    // Store the result in cache
    cache.set(`userApplications:${userId}`, applications);

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
      userId: userId,
      firstName: null,
      lastName: null,
      middleName: null,
      USI: null,
      gender: null,
      dob: null,
      homeAddress: null,
      suburb: null,
      postcode: null,
      state: null,
      contactNumber: null,
      email: null,
      countryOfBirth: null,
      australianCitizen: null,
      aboriginalOrTorresStraitIslander: null,
      englishLevel: null,
      disability: null,
      educationLevel: null,
      previousQualifications: null,
      employmentStatus: null,
      businessName: null,
      position: null,
      employersLegalName: null,
      employersAddress: null,
      employersContactNumber: null,
      creditsTransfer: null,
      nameOfQualification: null,
      YearCompleted: null,
      agree: false,
      date: null,
      id: null,
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

    const generateAppID = "APP" + Math.floor(1000 + Math.random() * 9000);

    // Step 5: Create an application document linking all forms
    const applicationRef = await db.collection("applications").add({
      applicationId: generateAppID,
      id: null,
      userId: userId,
      initialFormId: initialFormRef.id,
      studentFormId: studentFormRef.id,
      documentsFormId: documentsFormRef.id,
      certificateId: null,
      status: [
        {
          statusname: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
      verified: true,
      paid: false,
      documents: {},
      currentStatus: "Student Intake Form",
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
          status: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
      verified: true,
      paid: false,
      documents: {},
      currentStatus: "Student Intake Form",
      type: type,
      price: price,
      agentId: agentId,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    res.status(201).json({ message: "Application created successfully" });

    //send email to agent
    const agentRef = db.collection("users").doc(agentId);
    const agentDoc = await agentRef.get();
    if (agentDoc.exists) {
      const { email, firstName, lastName } = agentDoc.data();
      const emailSubject = "New Application Created";
      const emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>A new application has been created for a user. Please log in to your account to view the application details and proceed with the verification process.</p>
        <strong>Application Details:</strong>
        <ul>
          <li>Application ID: ${applicationRef.id}</li>
          <li>Application Type: ${type}</li>
          <li>Price: ${price}</li>
          <li>Application Date: ${new Date().toISOString()}</li>
        </ul>

        <p>Thank you for your continued support.</p>
        
        <p>Warm regards,</p>
        <p><strong>Certified Australia</strong></p>
      `;

      await sendEmail(email, emailBody, emailSubject);
    }
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

    let userId = applicationData.userId;

    //remove , from price
    price = price.replace(",", "");

    // Fetch user's email from the 'users' collection
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const { email } = userDoc.data(); // Retrieve user's email

    //create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: price * 100,
      currency: "aud",
      description: "Application Processing Fee",
      receipt_email: email
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
    });

    const { price } = applicationDoc.data();
    let firstNameG = "";
    let lastNameG = "";
    let finalPrice = price.replace(",", "");
    // Fetch user email and send a notification
    const { userId } = applicationDoc.data();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const currentStatus = applicationDoc.data().currentStatus;

    const token = await auth.createCustomToken(userId);

    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    // Create a customer on Stripe
    // const customer = await stripe.customers.create({
    //   email: email,
    //   name: `${firstNameG} ${lastNameG}`,
    // });

    // await stripe.invoiceItems.create({
    //   customer: customer.id,
    //   amount: finalPrice,
    //   currency: "aud",
    //   description: "Application Processing Fee",
    // });

    // // Create the invoice
    // const invoice = await stripe.invoices.create({
    //   customer: customer.id,
    //   auto_advance: false, // Auto-finalizes the invoice
    // });

    // const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    // await stripe.invoices.finalizeInvoice(invoice.id);
    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();

      firstNameG = firstName;
      lastNameG = lastName;

      const emailSubject = "Payment Confirmation and Next Steps";
      const emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>We are delighted to inform you that your payment has been successfully received and confirmed.</p>
        

        <h3>Next Steps</h3>
        <ul>
          <li>Log in to your account on our platform.</li>
          <li>Navigate to the <strong>Existing Applications</strong> section in your dashboard.</li>
          <li>View your application and proceed with the next steps.</li>
        </ul>
      
        <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      
        
        <p>If you have any questions or need support with the form, feel free to contact our support team. We're here to assist you every step of the way!</p>
        
        <p>Thank you once again for choosing us. We look forward to supporting you on your educational journey.</p>
        
        <p>Warm regards,</p>
        <p><strong>Certified Australia</strong></p>
      `;

      await sendEmail(email, emailBody, emailSubject);
    }

    const initialFormId = applicationDoc.data().initialFormId;
    const initialFormsSnapshot = await db
      .collection("initialScreeningForms")
      .doc(initialFormId)
      .get();

    const { lookingForWhatQualification } = initialFormsSnapshot.data();
    const admin = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    admin.forEach(async (adminDoc) => {
      const adminData = adminDoc.data();
      const adminEmail = adminData.email;
      const adminUserId = adminData.id;

      const adminToken = await auth.createCustomToken(adminUserId);
      const adminUrl = `${process.env.CLIENT_URL}/admin?token=${adminToken}`;

      const adminEmailBody = `
        <h2 style="color: #2c3e50;">🎉 Payment Processed</h2>
        <p style="color: #2c3e50;">A payment has been made by ${firstNameG} ${lastNameG}.</p>
        <p><strong>Application Details:</strong></p>
        <ul>
          <li>Application ID: ${applicationDoc.id}</li>
          <li>Application Type: ${applicationDoc.data().type}</li>
          <li>Price: ${applicationDoc.data().price}</li>
          <li>Qualification Name: ${lookingForWhatQualification}</li>
        </ul>
        <p>Click below to view the application:</p>
        <a href="${adminUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      `;

      const adminEmailSubject = "Payment Processed";

      try {
        await sendEmail(adminEmail, adminEmailBody, adminEmailSubject);
        console.log(`Email sent to admin: ${adminEmail}`);
      } catch (err) {
        console.error(
          `Failed to send email to admin: ${adminEmail}. Error: ${err.message}`
        );
      }
    });

    // if(applicationDoc.data().agentId){
    //   const agentRef = db.collection("users").doc(applicationDoc.data().agentId);
    //   const agentDoc = await agentRef.get();
    //   if (agentDoc.exists) {
    //     const { email, firstName, lastName } = agentDoc.data();
    //     const emailSubject = "Payment Confirmation and Next Steps";
    //     const emailBody = `
    //       <h2>Dear ${firstName} ${lastName},</h2>

    //       <p>We are delighted to inform you that your client ${firstNameG} ${lastNameG} has made the payment for the application.</p>

    //       <p>The application has now progressed to the <strong>"Student Intake Form"</strong> stage. At this step, we kindly request you to guide your client to complete the necessary information in the intake form to proceed further.</p>

    //       <h3>Next Steps: Complete the Student Intake Form</h3>
    //       <ul>
    //         <li>Log in to your account on our platform.</li>
    //         <li>Navigate to the <strong>Existing Applications</strong> section in your dashboard.</li>
    //         <li>Fill in all required details accurately to ensure a smooth application process.</li>
    //       </ul>

    //       <p>If you have any questions or need support with the form, feel free to contact our support team. We're here to assist you every step of the way!</p>

    //       <p>Thank you once again for choosing us. We look forward to supporting you on your educational journey.</p>

    //       <p>Warm regards,</p>
    //       <p><strong>Certified Australia</strong></p>
    //     `;

    //     await sendEmail(email, emailBody, emailSubject);
    //   }
    // }

    if (applicationDoc.data().currentStatus === "Sent to RTO") {
      const rto = await db.collection("users").where("role", "==", "rto").get();
      rto.forEach(async (doc) => {
        const rtoEmail = doc.data().email;
        const rtoUserId = doc.data().id;
        const loginToken = await auth.createCustomToken(rtoUserId);
        const URL2 = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

        const emailBody = `
      <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
      <p style="color: #34495e;">Hello RTO,</p>
      <p>A user has completed their application</p>
      <strong>Application Details:</strong>
      <ul>
        <li>Application ID: ${applicationDoc.applicationId}</li>
        <li>Application Type: ${applicationDoc.data().type}</li>
        <li>Price: ${applicationDoc.data().price}</li>
        <li>Application Date: ${new Date().toISOString()}</li>
      </ul>
      <p>Click the button below to view their application, and upload the certificate:</p>
      <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Certificate</a>
      <p style="font-style: italic;">For more details, please visit the rto dashboard.</p>
      <p>Thank you for your attention.</p>
      <p>
    <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
        const emailSubject = "Application Submitted";

        await sendEmail(rtoEmail, emailBody, emailSubject);
      });
    }

    res.status(200).json({ message: "Application marked as paid" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const deleteApplication = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Step 1: Get the application document
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(500).json({ message: "Appli cation not found" });
    }

    const { initialFormId, studentFormId, documentsFormId } =
      applicationDoc.data();

    // Step 2: Delete connected forms
    const deletePromises = [];

    if (initialFormId) {
      const initialFormRef = db
        .collection("initialScreeningForms")
        .doc(initialFormId);
      deletePromises.push(initialFormRef.delete());
    }

    if (studentFormId) {
      const studentFormRef = db
        .collection("studentIntakeForms")
        .doc(studentFormId);
      deletePromises.push(studentFormRef.delete());
    }

    if (documentsFormId) {
      const documentsFormRef = db.collection("documents").doc(documentsFormId);
      deletePromises.push(documentsFormRef.delete());
    }

    // Step 3: Delete the application
    deletePromises.push(applicationRef.delete());

    // Wait for all deletions to complete
    await Promise.all(deletePromises);

    res.status(200).json({
      message: "Application and connected forms deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting application:", error.message);
    res
      .status(500)
      .json({ message: "Error deleting application and connected forms" });
  }
};

module.exports = {
  getUserApplications,
  createNewApplication,
  customerPayment,
  updateApplicationStatus,
  markApplicationAsPaid,
  createNewApplicationByAgent,
  deleteApplication,
};
