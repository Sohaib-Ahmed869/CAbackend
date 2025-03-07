// controllers/applicationController.js
const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 });
const { Client, Environment } = require("square");
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // or Environment.Sandbox for testing
});
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
  let { price } = req.body;

  try {
    // Validate application
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = doc.data();
    const userId = applicationData.userId;

    // Clean price and convert to cents
    price = price.replace(/,/g, "");
    const amountInCents = Math.round(parseFloat(price) * 100);

    // Get user details
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const { email, firstName, lastName } = userDoc.data();

    try {
      // Create Square payment link with required parameters
      const response = await squareClient.checkoutApi.createPaymentLink({
        idempotencyKey: `${applicationId}-${Date.now()}`,
        order: {
          locationId: process.env.SQUARE_LOCATION_ID, // Required location ID
          lineItems: [
            {
              name: "Application Processing Fee",
              quantity: "1",
              basePriceMoney: {
                amount: amountInCents,
                currency: "AUD",
              },
            },
          ],
        },
        checkoutOptions: {
          redirectUrl: `${process.env.CLIENT_URL}/payment-success?applicationId=${applicationId}`,
          customerFields: {
            email: { required: true },
            firstName: { required: true },
            lastName: { required: true },
          },
        },
        prePopulatedData: {
          buyerEmail: email,
          buyerFirstName: firstName,
          buyerLastName: lastName,
        },
        note: `Application ID: ${applicationId}`,
      });

      if (response.result && response.result.paymentLink) {
        // Store payment link details in application
        await applicationRef.update({
          paymentLinkId: response.result.paymentLink.id,
          paymentStatus: "pending",
          paymentAmount: amountInCents,
          paymentCreatedAt: new Date().toISOString(),
        });

        console.log("Payment Link Created:", response.result.paymentLink.url);
        res.status(200).json({
          paymentLink: response.result.paymentLink.url,
          orderId: response.result.paymentLink.orderId,
        });
      } else {
        throw new Error("Failed to create payment link");
      }
    } catch (error) {
      console.error("Square API Error:", error);
      res.status(500).json({
        message: "Payment processing failed",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ message: error.message });
  }
};

const handleSquareWebhook = async (req, res) => {
  try {
    const event = req.body;

    if (
      event.type === "payment.updated" &&
      event.data?.object?.status === "COMPLETED"
    ) {
      const payment = event.data.object;
      const applicationId = payment.note.split(": ")[1];

      const applicationRef = db.collection("applications").doc(applicationId);
      const application = await applicationRef.get();

      if (!application.exists) {
        console.error(`Application ${applicationId} not found`);
        return res.status(404).send();
      }

      // Update application payment status
      await applicationRef.update({
        paid: true,
        paymentStatus: "completed",
        paymentCompletedAt: new Date().toISOString(),
        paymentId: payment.id,
      });

      // Send confirmation emails
      await sendPaymentConfirmationEmails(applicationId);

      res.status(200).json({ received: true });
    } else {
      res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Mark application as paid (used after webhook confirmation)
const markApplicationAsPaid = async (req, res, isInternal = false) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      if (isInternal) return false;
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = applicationDoc.data();

    // Update payment status based on payment scheme
    if (
      applicationData.partialScheme === true &&
      applicationData.paid === true
    ) {
      await applicationRef.update({
        full_paid: true,
        amount_paid: applicationData.price,
      });

      //update the application status
      await applicationRef.update({
        currentStatus: "Sent to Assessor",
        status: [
          ...applicationDoc.data().status,
          {
            statusname: "Sent to Assessor",
            time: new Date().toISOString(),
          },
        ],
      });
    } else if (
      applicationData.partialScheme === true &&
      applicationData.paid === false
    ) {
      await applicationRef.update({
        paid: true,
        full_paid: false,
        amount_paid: applicationData.payment1,
      });
    } else {
      await applicationRef.update({
        paid: true,
        full_paid: true,
        amount_paid: applicationData.price,
      });
      await applicationRef.update({
        currentStatus: "Sent to Assessor",
        status: [
          ...applicationDoc.data().status,
          {
            statusname: "Sent to Assessor",
            time: new Date().toISOString(),
          },
        ],
      });
    }

    if (!isInternal) {
      return res.status(200).json({ message: "Application marked as paid" });
    }
    return true;
  } catch (error) {
    console.error("Error marking application as paid:", error);
    if (isInternal) return false;
    return res.status(500).json({ message: error.message });
  }
};

// Helper function to send confirmation emails
async function sendPaymentConfirmationEmails(applicationId) {
  const applicationRef = db.collection("applications").doc(applicationId);
  const applicationDoc = await applicationRef.get();
  const applicationData = applicationDoc.data();

  // Get user details
  const userRef = db.collection("users").doc(applicationData.userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  // Generate login token
  const token = await auth.createCustomToken(applicationData.userId);
  const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

  // Send email to user
  if (userData) {
    const userEmailBody = `
      <h2>Dear ${userData.firstName} ${userData.lastName},</h2>
      <p>Thank you for your payment. Your application has been successfully processed.</p>
      <h3>Next Steps</h3>
      <ul>
        <li>Log in to your account to view your application status</li>
        <li>Complete any remaining requirements</li>
        <li>Track your application progress</li>
      </ul>
      <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p>If you have any questions, please contact our support team.</p>
      <p>Best regards,<br>Certified Australia</p>
    `;
    await sendEmail(userData.email, userEmailBody, "Payment Confirmation");
  }

  // // Send email to admin
  // const adminSnapshot = await db
  //   .collection("users")
  //   .where("role", "==", "admin")
  //   .get();
  // for (const adminDoc of adminSnapshot.docs) {
  //   const adminData = adminDoc.data();
  //   const adminToken = await auth.createCustomToken(adminData.id);
  //   const adminUrl = `${process.env.CLIENT_URL}/admin?token=${adminToken}`;

  const discount = applicationData.discount || 0;
  // const emailaDMIN = "applications@certifiedaustralia.com.au";
  // const emailAdmin2 = "ceo@certifiedaustralia.com.au";
  const emailaDMIN = "sohaibahmedsipra@gmail.com";
  const emailAdmin2 = "sohaib.sipra@calcite.live";
  //get ceo@certifiedaustralia.com.au id
  const adminSnapshot = await db
    .collection("users")
    .where("email", "==", emailAdmin2)
    .get();

  //create a url for the admin
  const adminToken = await auth.createCustomToken(adminSnapshot.docs[0].id);
  const adminUrl = `${process.env.CLIENT_URL}/admin?token=${adminToken}`;

  let price = applicationData.price;

  if (applicationData.partialScheme) {
    price = applicationData.amount_paid;
  } else if (discount > 0) {
    price = price - discount;
  } else {
    price = price;
  }

  const adminEmailBody = `
      <h2>New Payment Received</h2>
      <p>A payment has been processed for application ${applicationId}.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Application ID: ${applicationId}</li>
        <li>User: ${userData.firstName} ${userData.lastName}</li>
        <li>Amount: ${price}</li>

        <li><a href="${adminUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a></li>
        
        <li>Date: ${new Date().toISOString()}</li>
      </ul>
      
    `;
  await sendEmail(emailaDMIN, adminEmailBody, "New Payment Processed");
  await sendEmail(emailAdmin2, adminEmailBody, "New Payment Processed");
}

async function SendMailToAssessor(applicationId) {
  const applicationRef = db.collection("applications").doc(applicationId);
  const applicationDoc = await applicationRef.get();

  const applicationData = applicationDoc.data();

  // Get user details
  const userRef = db.collection("users").doc(applicationData.userId);
  const userDoc = await userRef.get();
  const userData = userDoc.data();

  // Send email to users with role assessor
  const assessorSnapshot = await db
    .collection("users")
    .where("role", "==", "assessor")
    .get();

  const assessorEmailBody = `
      <h2>New Application Recieved</h2>
      <p>A new application has been recieved for assessment.</p>
      <p><strong>Details:</strong></p>
      <ul>
        <li>Application ID: ${applicationId}</li>
        <li>User: ${userData.firstName} ${userData.lastName}</li>
        </ul>
    `;
  for (const assessorDoc of assessorSnapshot.docs) {
    const assessorData = assessorDoc.data();
    await sendEmail(
      assessorData.email,
      assessorEmailBody,
      "New Application Recieved"
    );
  }
}

const deleteApplication = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Step 1: Get the application document
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(500).json({ message: "Appli cation not found" });
    }

    //set the archive field to true
    await applicationRef.update({
      archive: true,
    });

    // const { initialFormId, studentFormId, documentsFormId } =
    //   applicationDoc.data();

    // // Step 2: Delete connected forms
    // const deletePromises = [];

    // if (initialFormId) {
    //   const initialFormRef = db
    //     .collection("initialScreeningForms")
    //     .doc(initialFormId);
    //   deletePromises.push(initialFormRef.delete());
    // }

    // if (studentFormId) {
    //   const studentFormRef = db
    //     .collection("studentIntakeForms")
    //     .doc(studentFormId);
    //   deletePromises.push(studentFormRef.delete());
    // }

    // if (documentsFormId) {
    //   const documentsFormRef = db.collection("documents").doc(documentsFormId);
    //   deletePromises.push(documentsFormRef.delete());
    // }

    // // Step 3: Delete the application
    // deletePromises.push(applicationRef.delete());

    // // Wait for all deletions to complete
    // await Promise.all(deletePromises);

    res.status(200).json({
      message: "Application and connected forms archived successfully",
    });
  } catch (error) {
    console.error("Error deleting application:", error.message);
    res
      .status(500)
      .json({ message: "Error deleting application and connected forms" });
  }
};

const unArchiveApplication = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Step 1: Get the application document
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(500).json({ message: "Application not found" });
    }

    //set the archive field to false
    await applicationRef.update({
      archive: false,
    });

    res.status(200).json({
      message: "Application unarchived successfully",
    });
  } catch (error) {
    console.error("Error unarchiving application:", error.message);

    res.status(500).json({ message: "Error unarchiving application" });
  }
};
const dividePaymentIntoTwo = async (req, res) => {
  const { applicationId } = req.params;
  const { payment1, payment2 } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found." });
    }

    const applicationData = applicationDoc.data();
    const userId = applicationData.userId;
    const applicationIDToMail = applicationData.applicationId;

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userEmail = userDoc.data().email;
    const userName = `${userDoc.data().firstName} ${userDoc.data().lastName}`;

    await applicationRef.update({
      payment1: payment1,
      payment2: payment2,
      partialScheme: true,
      full_paid: false,
      amount_paid: 0,
    });
    const token = await auth.createCustomToken(applicationData.userId);
    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;
    // Email Template
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Payment Installment Plan</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f9f9f9;
                margin: 0;
                padding: 0;
            }
            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #f7f7f7;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.3) !important;
            }
            .email-header {
                text-align: center;
                padding-bottom: 20px;
            }
            .email-header img {
                max-width: 150px;
            }
            .email-content {
                color: #333;
                font-size: 16px;
                line-height: 1.5;
            }
            .payment-breakdown {
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 15px;
            }
            .payment-breakdown p {
                margin: 5px 0;
            }
            .payment-button {
                display: inline-block;
                background-color: #009934;
                color: #fff !important;
                padding: 12px 20px;
                text-decoration: none;
                border-radius: 5px;
                margin-top: 20px;
                font-size: 16px;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            .footer a {
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>

    <div class="email-container">
        <div class="email-header">
          <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wUrVPXmmjHfiEam1_OOvAyse2Vb-ygiKj2i4zvyK9wTcDIVKIhiG2sjtDIT8vUcuyqK5kdTlu9NrOm" alt="Company Logo" style="width: 150px; height: auto; margin-bottom: 20px;">
          <h1>Payment Installment Plan</h1>
        </div>

        <div class="email-content">
            <p>Dear <strong>${userName}</strong>,</p>
            <p>We are pleased to inform you that your payment for application <strong>${applicationIDToMail}</strong> has been successfully divided into two installments.</p>

            <div class="payment-breakdown">
                <p><strong>First Payment:</strong> $${payment1}</p>
                <p><strong>Second Payment:</strong> $${payment2}</p>
            </div>

            <p>Please ensure the remaining amount is paid at your earliest convenience.</p>
            <p>If you have any questions, feel free to reach out to us.</p>

            <a href="${loginUrl}" class="payment-button">Make a Payment</a>
        </div>

        <div class="footer">
            <p>Best regards,<br><strong>The Certified Australia Team</strong></p>
            <p>Contact us: <a href="mailto:info@certifiedaustralia.com.au">info@certifiedaustralia.com.au</a> | <a href="tel:1300044927">1300 044 927</a></p>
            <p><a href="https://www.certifiedaustralia.com.au">www.certifiedaustralia.com.au</a></p>
        </div>
    </div>

    </body>
    </html>
    `;

    await sendEmail(
      userEmail,
      emailBody,
      "Your Payment Installment Plan Has Been Initiated"
    );

    res
      .status(200)
      .json({ message: "Payment divided successfully and emails sent." });
  } catch (error) {
    console.error("Error dividing payment:", error.message);
    res.status(500).json({ message: "Error dividing payment" });
  }
};

// const dividePaymentIntoTwo = async (req, res) => {
//   const { applicationId } = req.params;
//   const { payment1, payment2, userEmail } = req.body; // Ensure userEmail is sent in request

//   try {
//     // Update the application with the payment details
//     const applicationRef = db.collection("applications").doc(applicationId);
//     const applicationDoc = await applicationRef.get();

//     await applicationRef.update({
//       payment1: payment1,
//       payment2: payment2,
//       partialScheme: true,
//       full_paid: false,
//       amount_paid: 0,
//     });

//     //  Send Email to User
//     let emailSubject = "Your Payment has been Divided Successfully!";
//     let emailBody = `
//       Dear User,
//       <br /><br />
//       Your payment has been successfully divided into two parts:
//       <br />
//       - **First Payment:** $${payment1}
//       <br />
//       - **Second Payment:** $${payment2}
//       <br /><br />
//       Please complete your remaining payment at the earliest.
//       <br /><br />
//         <p>
//     <strong>Best Regards,</strong><br>
//     The Certified Australia Team<br>
//     Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
//     Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
//     Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
//     </p>
//     `;

//     await sendEmail(email, emailBody, emailSubject);

//     //  Send Email to Admin
//     emailSubject = `Payment Split for Application ${applicationId}`;
//     emailBody = `
//       Dear Admin,
//       <br /><br />
//       The payment for application **${applicationId}** has been divided successfully.
//       <br />
//       - **First Payment:** $${payment1}
//       <br />
//       - **Second Payment:** $${payment2}
//       <br /><br />
//       Please review the application details.
//       <br /><br />
//    <p>
//     <strong>Best Regards,</strong><br>
//     The Certified Australia Team<br>
//     Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
//     Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
//     Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
//     </p>
//     `;

//     await sendEmail(email, emailBody, emailSubject);

//     res
//       .status(200)
//       .json({ message: "Payment divided successfully and emails sent." });
//   } catch (error) {
//     console.error("Error dividing payment:", error.message);
//     res.status(500).json({ message: "Error dividing payment" });
//   }
// };

const processPayment = async (req, res) => {
  const { applicationId } = req.params;
  const { sourceId, price } = req.body;

  try {
    const amountInCents = Math.round(parseFloat(price) * 100);

    const payment = await squareClient.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: `${applicationId}-${Date.now()}`,
      amountMoney: {
        amount: amountInCents,
        currency: "AUD",
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Application ID: ${applicationId}`,
    });

    if (payment.result.payment.status === "COMPLETED") {
      // Update application status with isInternal flag
      const updated = await markApplicationAsPaid(req, res, true);
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: "Failed to mark application as paid",
        });
      }

      // Send confirmation emails
      await sendPaymentConfirmationEmails(applicationId);

      //if the updated status is sent to Accessor then send email to assessor
      const applicationRef = db.collection("applications").doc(applicationId);
      const applicationDoc = await applicationRef.get();
      const applicationData = applicationDoc.data();

      if (applicationData.currentStatus === "Sent to Assessor") {
        await SendMailToAssessor(applicationId);
      }

      return res.json({ success: true });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }
  } catch (error) {
    console.error("Payment Error:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const exportApplicationsToCSV = async (req, res) => {
  try {
    const BATCH_SIZE = 100; // Number of documents to process at once
    const applications = [];

    // Get all application IDs first
    const applicationsSnapshot = await db.collection("applications").get();
    const applicationDocs = applicationsSnapshot.docs;

    // Process applications in batches
    for (let i = 0; i < applicationDocs.length; i += BATCH_SIZE) {
      const batch = applicationDocs.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (doc) => {
        const application = doc.data();

        // Create a promise for user data fetch
        const userPromise = db
          .collection("users")
          .doc(application.userId)
          .get()
          .then((doc) => (doc.exists ? doc.data() : {}))
          .catch(() => ({})); // Handle missing documents gracefully

        // Wait for user data
        const user = await userPromise;

        // Get latest status
        const latestStatus = application.status?.[0] || {
          statusname: "",
          time: "",
        };
        const formattedDate = new Date(latestStatus.time)
          .toISOString()
          .split("T")[0];

        const colorStatus =
          application.color === "red"
            ? "Hot Lead"
            : application.color === "yellow"
            ? "Proceeded With Payment"
            : application.color === "gray"
            ? "Cold Lead"
            : application.color === "orange"
            ? "Warm Lead"
            : application.color === "lightblue"
            ? "Impacted Student"
            : application.color === "green"
            ? "Completed"
            : application.color === "pink"
            ? "Agent"
            : "N/A";

        return {
          "Application ID": application.applicationId || "",
          "First Name": user.firstName || "",
          "Last Name": user.lastName || "",
          Phone: user.phone || "",
          Email: user.email || "",
          Price: application.price || "",
          "Agent Assigned": application.assignedAdmin || "",
          "Current Status": application.currentStatus || "",
          "Color Status": colorStatus,
          "Date Created": formattedDate,
          "Payment Status": application.paid ? "Paid" : "Unpaid",
          "Contact Status": application.contactStatus || "",
          "Call Attempts": application.contactAttempts || "",
          Notes: application.note || "",
        };
      });

      // Wait for this batch to complete and add to results
      const batchResults = await Promise.all(batchPromises);
      applications.push(...batchResults);
    }

    // Sort by date
    applications.sort(
      (a, b) => new Date(b["Date Created"]) - new Date(a["Date Created"])
    );

    res.status(200).json({ applications });
  } catch (error) {
    console.error("Error exporting applications:", error);
    res.status(500).json({ message: error.message });
  }
};

const addDiscountToApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { discount } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = doc.data();
    const userId = applicationData.userId;
    const applicationIDToMail = applicationData.applicationId;

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userEmail = userDoc.data().email;
    const userName = `${userDoc.data().firstName} ${userDoc.data().lastName}`;

    await applicationRef.update({ discount: discount });

    // Email Template
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Discount Applied</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f9f9f9;
                margin: 0;
                padding: 0;
            }
            .email-container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #f7f7f7;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0px 4px 15px rgba(0, 0, 0, 0.3) !important;
            }
            .email-header {
                text-align: center;
                padding-bottom: 20px;
            }
            .email-content {
                color: #333;
                font-size: 16px;
                line-height: 1.5;
            }
            .discount-box {
                background-color: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                margin-top: 15px;
            }
            .discount-box p {
                margin: 5px 0;
            }
            .footer {
                margin-top: 20px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            .footer a {
                color: #007bff;
                text-decoration: none;
            }
        </style>
    </head>
    <body>

    <div class="email-container">
        <div class="email-header">
          <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wUrVPXmmjHfiEam1_OOvAyse2Vb-ygiKj2i4zvyK9wTcDIVKIhiG2sjtDIT8vUcuyqK5kdTlu9NrOm" alt="Company Logo" style="width: 150px; height: auto; margin-bottom: 20px;">

          <h1>Discount Applied Successfully</h1>
        </div>

        <div class="email-content">
            <p>Dear <strong>${userName}</strong>,</p>
            <p>We are pleased to inform you that a discount has been applied to your application <strong>${applicationIDToMail}</strong>.</p>

            <div class="discount-box">
                <p><strong>Discount Amount:</strong> $${discount}</p>
            </div>

            <p>If you have any questions, feel free to reach out to us.</p>
        </div>

        <div class="footer">
            <p>Best regards,<br><strong>The Certified Australia Team</strong></p>
            <p>Contact us: <a href="mailto:info@certifiedaustralia.com.au">info@certifiedaustralia.com.au</a> | <a href="tel:1300044927">1300 044 927</a></p>
            <p><a href="https://www.certifiedaustralia.com.au">www.certifiedaustralia.com.au</a></p>
        </div>
    </div>

    </body>
    </html>
    `;

    // Send email to the user
    await sendEmail(
      userEmail,
      emailBody,
      "Discount Applied to Your Application"
    );

    // Send email to the admin
    const adminEmail = "admin@certifiedaustralia.com.au";
    const adminEmailBody = `
      <p>Hello Admin,</p>
      <p>A discount of <strong>$${discount}</strong> has been applied to application <strong>${applicationIDToMail}</strong> for user <strong>${userName}</strong> (${userEmail}).</p>
      <p>Please review the updated application details in the system.</p>
    `;
    await sendEmail(
      adminEmail,
      adminEmailBody,
      "Discount Applied - Admin Notification"
    );

    res.status(200).json({
      message:
        "Discount applied successfully, and emails sent to user and admin.",
      discount,
    });
  } catch (error) {
    console.error("Error applying discount:", error);
    res.status(500).json({ message: "Error applying discount" });
  }
};

const addExpenseToApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { amount, description, date } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Get current expenses array or initialize if it doesn't exist
    const currentExpenses = doc.data().expenses || [];

    // Add new expense to the array
    const newExpense = {
      id: Date.now().toString(), // Simple unique ID
      amount,
      description,
      date,
      createdAt: new Date().toISOString(),
    };

    await applicationRef.update({
      expenses: [...currentExpenses, newExpense],
    });

    res.status(200).json({
      message: "Expense added successfully",
      expense: newExpense,
    });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: error.message });
  }
};

const getApplicationExpenses = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const expenses = doc.data().expenses || [];

    res.status(200).json({ expenses });
  } catch (error) {
    console.error("Error getting expenses:", error);
    res.status(500).json({ message: error.message });
  }
};

const assignApplicationToAdmin = async (req, res) => {
  const { applicationId } = req.params;
  const { adminName } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      assignedAdmin: adminName,
    });

    res.status(200).json({
      message: "Application assigned to admin successfully",
      adminName,
    });
  } catch (error) {
    console.error("Error assigning application to admin:", error);
    res.status(500).json({ message: error.message });
  }
};
const updateCallAttempts = async (req, res) => {
  const { applicationId } = req.params;
  const { contactAttempts } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      contactAttempts,
    });

    res.status(200).json({
      message: "Contact attempts updated successfully",
      contactAttempts,
    });
  } catch (error) {
    console.error("Error updating contact attempts:", error);
    res.status(500).json({ message: error.message });
  }
};

const updateContactStatus = async (req, res) => {
  const { applicationId } = req.params;
  const { contactStatus } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      contactStatus,
    });

    res.status(200).json({
      message: "Contact status updated successfully",
      contactStatus,
    });
  } catch (error) {
    console.error("Error updating contact status:", error);
    res.status(500).json({ message: error.message });
  }
};

const addAssessorNoteToApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { note } = req.body;
  const assessorNote = note;
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      assessorNote,
    });

    res.status(200).json({
      message: "Assessor note added successfully",
      assessorNote,
    });
  } catch (error) {
    console.error("Error adding assessor note:", error);
    res.status(500).json({ message: error.message });
  }
};

const sendToRTO = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      currentStatus: "Sent to RTO",
      status: [
        ...doc.data().status,
        {
          statusname: "Sent to RTO",
          time: new Date().toISOString(),
        },
      ],
    });

    res.status(200).json({
      message: "Application sent to RTO successfully",
    });
  } catch (error) {
    console.error("Error sending application to RTO:", error);
    res.status(500).json({ message: error.message });
  }
};

const getApplicationStats = async (req, res) => {
  try {
    const applicationsSnapshot = await db.collection("applications").get();
    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    // Initialize statistics object
    const stats = {
      qualificationStats: {},
      totalApplications: applications.length,
      paymentStats: {
        paid: 0,
        unpaid: 0,
        totalRevenue: 0,
      },
      statusDistribution: {},
      applicationsByMonth: {},
    };

    // Get all initialFormIds
    const initialFormIds = applications
      .map((app) => app.initialFormId)
      .filter((id) => id); // Remove null/undefined

    // Create a map to store all initial forms
    const initialFormsMap = {};

    // Process initial forms in batches of 30
    for (let i = 0; i < initialFormIds.length; i += 30) {
      const batch = initialFormIds.slice(i, i + 30);
      const batchSnapshot = await db
        .collection("initialScreeningForms")
        .where("__name__", "in", batch)
        .get();

      batchSnapshot.forEach((doc) => {
        initialFormsMap[doc.id] = doc.data();
      });
    }

    // Process each application
    applications.forEach((app) => {
      // Count by qualification if initial form exists
      if (app.initialFormId && initialFormsMap[app.initialFormId]) {
        const qualification =
          initialFormsMap[app.initialFormId].lookingForWhatQualification;
        if (qualification) {
          stats.qualificationStats[qualification] =
            (stats.qualificationStats[qualification] || 0) + 1;
        }
      }

      // Payment statistics
      if (app.paid) {
        stats.paymentStats.paid++;
        stats.paymentStats.totalRevenue += Number(app.price || 0);
      } else {
        stats.paymentStats.unpaid++;
      }

      // Status distribution
      const currentStatus = app.currentStatus || "Unknown";
      stats.statusDistribution[currentStatus] =
        (stats.statusDistribution[currentStatus] || 0) + 1;

      // Applications by month
      if (app.status && app.status.length > 0) {
        const creationDate = new Date(app.status[0].time);
        const monthYear = `${
          creationDate.getMonth() + 1
        }/${creationDate.getFullYear()}`;
        stats.applicationsByMonth[monthYear] =
          (stats.applicationsByMonth[monthYear] || 0) + 1;
      }
    });

    // Sort applications by month
    stats.applicationsByMonth = Object.fromEntries(
      Object.entries(stats.applicationsByMonth).sort((a, b) => {
        const [aMonth, aYear] = a[0].split("/");
        const [bMonth, bYear] = b[0].split("/");
        return new Date(aYear, aMonth - 1) - new Date(bYear, bMonth - 1);
      })
    );

    // Add some additional useful stats
    stats.completionRate = {
      percentage: (
        (stats.paymentStats.paid / stats.totalApplications) *
        100
      ).toFixed(2),
      total: stats.totalApplications,
      completed: stats.paymentStats.paid,
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error getting application stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
  unArchiveApplication,
  dividePaymentIntoTwo,
  handleSquareWebhook,
  processPayment,
  handleSquareWebhook,
  exportApplicationsToCSV,
  addDiscountToApplication,
  getApplicationExpenses,
  addExpenseToApplication,
  assignApplicationToAdmin,
  updateCallAttempts,
  updateContactStatus,
  addAssessorNoteToApplication,
  sendToRTO,
  getApplicationStats,
};
