// controllers/applicationController.js
const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 });
const {
  checkApplicationStatusAndSendEmails,
} = require("../utils/applicationEmailService");
const { Client, Environment } = require("square");
const { Application } = require("twilio/lib/twiml/VoiceResponse");
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // or Environment.Sandbox for testing
});
const { TIME_ZONES } = require("../utils/timeZoneConstants");
// Update Application Status
const getAgentsKPIStats = async (req, res) => {
  try {
    // Fetch users and applications
    const [usersSnapshot, applicationsSnapshot] = await Promise.all([
      db.collection("users").get(),
      db.collection("applications").get(),
    ]);

    const users = usersSnapshot.docs.map((doc) => doc.data());
    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    // Filter only agent-type users
    const agents = users.filter((user) => user.type === "agent");

    // Create a result map for agent application counts
    const agentKPI = agents.map((agent) => {
      const assignedApps = applications.filter(
        (app) => app.assignedAdmin === agent.name
      );
      return {
        agentName: agent.name,
        applicationCount: assignedApps.length,
      };
    });

    return res.status(200).json({ agentKPI });
  } catch (error) {
    console.error("Error in getAgentsKPIStats:", error);
    return res.status(500).json({ message: error.message });
  }
};

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
const getApplicationById = async (req, res) => {
  const { applicationId } = req.params;

  try {
    // Step 1: Fetch the main application document
    const applicationRef = db.collection("applications").doc(applicationId);
    const doc = await applicationRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = doc.data();

    // Step 2: Extract related form IDs from the application
    const formIds = {
      initialFormId: applicationData.initialFormId,
      studentFormId: applicationData.studentFormId,
      documentsFormId: applicationData.documentsFormId,
    };

    // Step 3: Fetch all related forms in parallel
    const [initialFormSnapshot, studentFormSnapshot, documentsFormSnapshot] =
      await Promise.all([
        formIds.initialFormId
          ? db
              .collection("initialScreeningForms")
              .doc(formIds.initialFormId)
              .get()
          : Promise.resolve(null),
        formIds.studentFormId
          ? db.collection("studentIntakeForms").doc(formIds.studentFormId).get()
          : Promise.resolve(null),
        formIds.documentsFormId
          ? db.collection("documents").doc(formIds.documentsFormId).get()
          : Promise.resolve(null),
      ]);

    // Step 4: Build the response with nested forms
    const response = {
      ...applicationData,
      initialForm: initialFormSnapshot?.exists
        ? initialFormSnapshot.data()
        : null,
      studentForm: studentFormSnapshot?.exists
        ? studentFormSnapshot.data()
        : null,
      documentsForm: documentsFormSnapshot?.exists
        ? documentsFormSnapshot.data()
        : null,
    };

    // Step 5: Return the enriched application data
    res.status(200).json({ application: response });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching application",
      error: error.message,
    });
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
    expense,
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
      expense: expense || 0,
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
    expense,
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
      expense: expense || 0,
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

      // Use the comprehensive email service instead of the old function
      await checkApplicationStatusAndSendEmails(applicationId, "payment_made");

      res.status(200).json({ received: true });
    } else {
      res.status(200).json({ received: true });
    }
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: error.message });
  }
};

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
    const updateData = {};
    let isAutoDebitPayment = false;

    // Check if this was an auto-debit scheduled payment
    if (applicationData.autoDebit?.status === "SCHEDULED") {
      isAutoDebitPayment = true;
      console.log("Processing auto-debit payment update");
    }

    // Handle payment updates
    if (applicationData.partialScheme) {
      if (applicationData.paid) {
        // Final payment (payment2)
        updateData.full_paid = true;
        updateData.amount_paid = applicationData.price;
        updateData.payment2Date = new Date().toISOString();

        if (
          isAutoDebitPayment &&
          applicationData.autoDebit.selectedPayment === "payment2"
        ) {
          updateData["autoDebit.status"] = "MANUALLY_PAID";
          updateData["autoDebit.amountDue"] = 0;
        }
      } else {
        // Initial payment (payment1)
        updateData.paid = true;
        updateData.amount_paid = applicationData.payment1;
        updateData.payment1Date = new Date().toISOString();

        if (
          isAutoDebitPayment &&
          applicationData.autoDebit.selectedPayment === "Payment1"
        ) {
          updateData["autoDebit.status"] = "MANUALLY_PAID";
          updateData["autoDebit.amountDue"] = 0;
        }
      }
    } else {
      // Full payment
      updateData.paid = true;
      updateData.full_paid = true;
      updateData.amount_paid = applicationData.price;
      updateData.fullPaymentDate = new Date().toISOString();

      if (isAutoDebitPayment) {
        updateData["autoDebit.status"] = "MANUALLY_PAID";
        updateData["autoDebit.amountDue"] = 0;
      }
    }

    // Common status updates
    updateData.status = "COMPLETED";
    updateData.currentStatus = "Sent to Assessor";
    updateData.status = [
      ...(applicationData.status || []),
      {
        statusname: "Sent to Assessor",
        time: new Date().toISOString(),
      },
    ];

    // Always disable auto-debit if manually paid
    // if (!isAutoDebitPayment && applicationData.autoDebit?.enabled) {
    //   updateData["autoDebit.status"] = "MANUALLY_PAID";
    //   updateData["autoDebit.enabled"] = false;
    //   updateData["autoDebit.amountDue"] = 0;
    // }

    // Perform the update
    await applicationRef.update(updateData);

    // Send emails
    await checkApplicationStatusAndSendEmails(applicationId, "payment_made");

    return isInternal
      ? true
      : res.status(200).json({ message: "Application marked as paid" });
  } catch (error) {
    console.error("Error marking application as paid:", error);
    return isInternal
      ? false
      : res.status(500).json({ message: error.message });
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

  const emailaDMIN = "sohaibahmedsipra@gmail.com";
  const emailAdmin2 = "certified@calcite.live";
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
  // Divide the payment into two parts
  // First part is the initial payment
  // Second part is the remaining balance
  const { applicationId } = req.params;
  const {
    payment1,
    payment2,
    payment2Deadline,
    payment2DeadlineTime,
    directDebitChecked,
  } = req.body;

  try {
    // Update the application with the payment details
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = applicationDoc.data();

    await applicationRef.update({
      payment1: payment1,
      payment2: payment2,
      payment2Deadline: payment2Deadline,
      payment2DeadlineTime: payment2DeadlineTime,
      partialScheme: true,
      full_paid: false,
      amount_paid: 0,
    });
    if (directDebitChecked) {
      await applicationRef.update({
        "autoDebit.enabled": true,
      });
    }
    // Get user details for email notification
    const userRef = db.collection("users").doc(applicationData.userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const { email, firstName, lastName } = userData;

      // Create login token for the user
      const token = await auth.createCustomToken(applicationData.userId);
      const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

      // Format payment2Deadline for display
      const formattedDeadline = new Date(payment2Deadline).toLocaleDateString();

      // Prepare email content
      const emailSubject = "Payment Plan Created for Your Application";
      const emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>We've created a payment plan for your application with Certified Australia.</p>
        
        <div style="background-color: #e8f4fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
          <h3>Payment Plan Details:</h3>
          <ul>
            <li><strong>Initial Payment:</strong> $${payment1}</li>
            <li><strong>Second Payment:</strong> $${payment2}</li>
            <li><strong>Second Payment Deadline:</strong> ${formattedDeadline}</li>
            <li><strong>Total:</strong> $${
              Number(payment1) + Number(payment2)
            }</li>
          </ul>
        </div>
        
        <p>You can proceed with your initial payment by clicking the button below:</p>
        
        <div style="text-align: center; margin: 25px 0;">
          <a href="${loginUrl}" style="background-color: #089C34; color: #ffffff; text-decoration: none; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 16px; font-weight: bold; padding: 15px 30px; border-radius: 5px; display: inline-block;">Make Initial Payment</a>
        </div>
        
        <p>Please note that your application will be fully processed after completing both payments.</p>
        
        <p>If you have any questions about your payment plan, please don't hesitate to contact our support team.</p>
        
        <p>Thank you for choosing Certified Australia.</p>
        
        <p>Warm regards,<br>The Certified Australia Team</p>
      `;

      // Send email notification
      await sendEmail(email, emailBody, emailSubject);

      console.log(
        `Payment plan email sent to ${email} for application ${applicationId}`
      );
    }

    res
      .status(200)
      .json({ message: "Payment divided successfully and notification sent" });
  } catch (error) {
    console.error("Error dividing payment:", error.message);
    res.status(500).json({ message: "Error dividing payment" });
  }
};

const addPayment2DeadlineDate = async (req, res) => {
  const { applicationId } = req.params;
  const { payment2Deadline } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    await applicationRef.update({
      payment2Deadline: payment2Deadline,
    });

    res.status(200).json({ message: "Payment 2 deadline added successfully" });
  } catch (error) {
    console.error("Error adding payment 2 deadline:", error.message);
    res.status(500).json({ message: "Error adding payment 2 deadline" });
  }
};

// process direct debit Scheduled payment
const processScheduledPayment = async (applicationId) => {
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) return;
    const userId = applicationDoc.data().userId;
    const userRef = await db.collection("users").doc(userId).get();
    const userEmail = userRef.exists ? userRef.data().email : null;
    const AppId = applicationDoc.data().applicationId;

    const appData = applicationDoc.data();
    const price = applicationDoc.data().price;
    const autoDebit = appData.autoDebit || {};

    if (!autoDebit.enabled || autoDebit.status !== "SCHEDULED") return;

    const payment = await squareClient.paymentsApi.createPayment({
      sourceId: autoDebit.squareCardId,
      idempotencyKey: `${applicationId}-${Date.now()}`,
      amountMoney: {
        amount: Math.round(autoDebit.amountDue * 100),
        currency: "AUD",
      },
      customerId: autoDebit.squareCustomerId,
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Scheduled payment for Application ID: ${applicationId}`,
    });

    if (payment.result.payment.status === "COMPLETED") {
      const updateData = {
        "autoDebit.status": "COMPLETED",
        amount_paid: price,
        paymentDate: new Date().toISOString(),
        full_paid: true,
      };

      await applicationRef.update(updateData);

      const formattedPaymentDate = new Date().toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

      const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body {
                  font-family: 'Inter', sans-serif;
                  margin: 0;
                  padding: 0;
                  background-color: #f7f9fc;
                  color: #333;
              }
              .email-container {
                  max-width: 600px;
                  margin: 30px auto;
                  background: #fff;
                  border-radius: 12px;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                  overflow: hidden;
              }
              .header {
                  background: #fff;
                  padding: 24px;
                  text-align: center;
              }
              .header img {
                  max-width: 200px;
              }
              .content {
                  padding: 32px;
                  line-height: 1.6;
              }
              .message {
                  font-size: 16px;
                  color: #555;
                  margin-bottom: 20px;
              }
              .details-card {
                  background: #f9fafb;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 20px 0;
                  border-left: 4px solid #089C34;
              }
              .card-title {
                  font-size: 18px;
                  font-weight: 600;
                  color: #222;
                  margin-bottom: 15px;
              }
              .detail-item {
                  margin: 10px 0;
                  display: flex;
                  justify-content: space-between;
              }
              .detail-label {
                  color: #666;
                  font-weight: 500;
                  margin-right: 10px;
              }
              .detail-value {
                  font-weight: 500;
                  color: #222;
              }
              .footer {
                  background: #fff;
                  padding: 20px;
                  text-align: center;
                  font-size: 14px;
                  color: #666;
              }
              .footer a {
                  color: #666;
                  font-weight: 600;
                  text-decoration: none;
              }
          </style>
      </head>
      <body>
      <div class="email-container">
          <div class="header">
              <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
          </div>
          <div class="content">
              <h1 style="color: #089C34; margin-bottom: 25px;">Direct Debit Payment Confirmation</h1>
              
              <p class="message">Dear Applicant,</p>
              <p class="message">We're pleased to confirm your payment for application <strong>#${AppId}</strong> has been successfully processed. Below are your transaction details:</p>

              <div class="details-card">
                  <div class="card-title">Payment Details</div>
                  <div class="detail-item">
                      <span class="detail-label">Payment Type:</span>
                      <span class="detail-value">DIRECT DEBIT</span>
                  </div>
                  <div class="detail-item">
                      <span class="detail-label">Amount Paid:</span>
                      <span class="detail-value">$${autoDebit.amountDue}</span>
                  </div>
                  <div class="detail-item">
                      <span class="detail-label">Processed Date:</span>
                      <span class="detail-value">${formattedPaymentDate}</span>
                  </div>
                  <div class="detail-item">
                      <span class="detail-label">Transaction ID:</span>
                      <span class="detail-value">${payment.result.payment.id}</span>
                  </div>
              </div>
          </div>
          <div class="footer">
              <p>© 2025 Certified Australia. All rights reserved.</p>
              <p>Need help? <a href="mailto:support@certifiedaustralia.com.au" class="footer-link">Contact Support</a></p>
          </div>
      </div>
  </body></html>`;
      const subject = `Payment Confirmation for Application ${AppId}`;
      await sendEmail(userEmail, emailBody, subject);

      return true;
    }
  } catch (error) {
    console.error("Scheduled Payment Error:", error);
    const applicationRef = db.collection("applications").doc(applicationId);
    await applicationRef.update({
      "autoDebit.status": "FAILED",
      "autoDebit.lastError": error.message,
    });
    return false;
  }
};

// latest process payment with direct debit setup
// const processPayment = async (req, res) => {
//   const { applicationId } = req.params;
//   const { sourceId, price } = req.body;

//   try {
//     const amountInCents = Math.round(parseFloat(price) * 100);

//     // Process payment with actual sourceId
//     const payment = await squareClient.paymentsApi.createPayment({
//       // sourceId: sourceId, //
//       sourceId: "cnon:card-nonce-ok",
//       idempotencyKey: `${applicationId}-${Date.now()}`,
//       amountMoney: {
//         amount: amountInCents,
//         currency: "AUD",
//       },
//       locationId: process.env.SQUARE_LOCATION_ID,
//       note: `Application ID: ${applicationId}`,
//     });

//     if (payment.result.payment.status === "COMPLETED") {
//       // Update application payment status
//       const updated = await markApplicationAsPaid(req, res, true);
//       if (!updated) {
//         return res.status(500).json({
//           success: false,
//           message: "Failed to mark application as paid",
//         });
//       }
//       res.json({ success: true });

//       // Get updated application data
//       const applicationRef = db.collection("applications").doc(applicationId);
//       const applicationDoc = await applicationRef.get();
//       const applicationData = applicationDoc.data();
//       const userId = applicationData.userId;

//       // Check conditions for direct debit setup
//       if (
//         applicationData.partialScheme === true &&
//         applicationData.autoDebit?.enabled === true &&
//         applicationData.full_paid === false
//       ) {
//         const deadlineMoment = moment.tz(
//           `${applicationData.payment2Deadline} ${applicationData.payment2DeadlineTime}`,
//           "YYYY-MM-DD hh:mm A",
//           "Asia/Karachi"
//         );
//         // Create Square customer
//         const customerResponse = await squareClient.customersApi.createCustomer(
//           {
//             givenName: "Recurring Customer",
//             referenceId: `APP-${applicationId}-USER-${userId}`,
//           }
//         );

//         // Create Square card
//         const cardResponse = await squareClient.cardsApi.createCard({
//           idempotencyKey: `${applicationId}-${Date.now()}`,
//           sourceId: sourceId,
//           card: {
//             customerId: customerResponse.result.customer.id,
//           },
//         });

//         // Store dates as UTC
//         await applicationRef.update({
//           "autoDebit.squareCustomerId": customerResponse.result.customer.id,
//           "autoDebit.squareCardId": cardResponse.result.card.id,
//           "autoDebit.amountDue": applicationData.payment2,
//           "autoDebit.dueDate": deadlineMoment.utc().toDate(),
//           "autoDebit.status": "SCHEDULED",
//           "autoDebit.paymentTime": applicationData.payment2DeadlineTime,
//           "autoDebit.selectedPayment": "payment2",
//           "autoDebit.updatedAt": new Date().toISOString(),
//         }); // Prepare confirmation email
//         const userRef = await db.collection("users").doc(userId).get();
//         const userEmail = userRef.data().email;
//         const AppId = applicationData.applicationId;

//         const emailBody = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//             <style>
//                 @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
//                 body {
//                     font-family: 'Inter', sans-serif;
//                     margin: 0;
//                     padding: 0;
//                     background-color: #f7f9fc;
//                     color: #333;
//                 }
//                 .email-container {
//                     max-width: 600px;
//                     margin: 30px auto;
//                     background: #fff;
//                     border-radius: 12px;
//                     box-shadow: 0 4px 12px rgba(0,0,0,0.08);
//                     overflow: hidden;
//                 }
//                 .header {
//                     background: #fff;
//                     padding: 24px;
//                     text-align: center;
//                 }
//                 .header img {
//                     max-width: 200px;
//                 }
//                 .content {
//                     padding: 32px;
//                     line-height: 1.6;
//                 }
//                 .message {
//                     font-size: 16px;
//                     color: #555;
//                     margin-bottom: 20px;
//                 }
//                 .details-card {
//                     background: #f9fafb;
//                     border-radius: 8px;
//                     padding: 20px;
//                     margin: 20px 0;
//                     border-left: 4px solid #089C34;
//                 }
//                 .card-title {
//                     font-size: 18px;
//                     font-weight: 600;
//                     color: #222;
//                     margin-bottom: 15px;
//                 }
//                 .detail-item {
//                     margin: 10px 0;
//                     display: flex;
//                     justify-content: space-between;
//                 }
//                 .detail-label {
//                     color: #666;
//                     font-weight: 500;
//                     margin-right: 10px;
//                 }
//                 .detail-value {
//                     font-weight: 500;
//                     color: #222;
//                 }
//                 .footer {
//                     background: #fff;
//                     padding: 20px;
//                     text-align: center;
//                     font-size: 14px;
//                     color: #666;
//                 }
//                 .footer a {
//                     color: #666;
//                     font-weight: 600;
//                     text-decoration: none;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="email-container">
//                 <div class="header">
//                     <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
//                 </div>
//                 <div class="content">
//                     <h1 style="color: #089C34; margin-bottom: 25px;">Direct Debit Setup Notification</h1>

//                     <p class="message">Dear Applicant,</p>
//                     <p class="message">Direct debit  for application <strong>#${AppId}</strong> has been successfully set up. Below are your payment details:</p>

//                     <div class="details-card">
//                         <div class="card-title">Payment Schedule Details</div>

//                         <div class="detail-item">
//                             <span class="detail-label">Scheduled Amount:</span>
//                             <span class="detail-value"> $${
//                               applicationData.payment2
//                             }</span>
//                         </div>
//                         <div class="detail-item">
//                             <span class="detail-label">Payment Date:</span>
//                             <span class="detail-value"> ${new Date(
//                               deadlineDate
//                             ).toLocaleDateString("en-AU", {
//                               year: "numeric",
//                               month: "long",
//                               day: "numeric",
//                               timeZone: "UTC",
//                             })}</span>
//                         </div>
//                         <div class="detail-item">
//                             <span class="detail-label">Payment Method:</span>
//                             <span class="detail-value"> Automated Direct Debit</span>
//                         </div>
//                     </div>

//                     <p class="message" style="margin-top: 25px;">
//                         <strong>Important:</strong> Your payment will be automatically processed on the scheduled date.
//                         Please ensure sufficient funds are available in your account.
//                     </p>

//                     <p class="message">
//                         Need to update your payment details? Contact our support team for assistance.
//                     </p>
//                 </div>
//                <div class="footer">
//                     <p>© 2025 Certified Australia. All rights reserved.</p>
//                     <p>Need help? <a href="mailto:support@certifiedaustralia.com.au" class="footer-link">Contact Support</a></p>
//                 </div>
//             </div>
//         </body>
//         </html>`;
//         const subject = `Direct Debit Setup for Application ${AppId}`;

//         await sendEmail(userEmail, emailBody, subject);
//       }

//       await checkApplicationStatusAndSendEmails(applicationId, "payment_made");
//     } else {
//       return res
//         .status(400)
//         .json({ success: false, message: "Payment not completed" });
//     }
//   } catch (error) {
//     console.error("Payment Error:", error);
//     return res.status(400).json({ success: false, message: error.message });
//   }
// };

// // fix for direct debit timezone problem  process payment function

// // Define time zone constants
// const TIME_ZONES = {
//   DEFAULT: "Asia/Karachi",
//   SERVER: "UTC",
//   CLIENT: "Asia/Karachi",
// };

const moment = require("moment-timezone");
const processPayment = async (req, res) => {
  const { applicationId } = req.params;
  const { sourceId, price } = req.body;

  try {
    const amountInCents = Math.round(parseFloat(price) * 100);

    // Process payment with actual sourceId
    const payment = await squareClient.paymentsApi.createPayment({
      // sourceId: sourceId, //
      sourceId: "cnon:card-nonce-ok",
      idempotencyKey: `${applicationId}-${Date.now()}`,
      amountMoney: {
        amount: amountInCents,
        currency: "AUD",
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Application ID: ${applicationId}`,
    });

    if (payment.result.payment.status === "COMPLETED") {
      // Update application payment status
      const updated = await markApplicationAsPaid(req, res, true);
      if (!updated) {
        return res.status(500).json({
          success: false,
          message: "Failed to mark application as paid",
        });
      }
      res.json({ success: true });

      // Get updated application data
      const applicationRef = db.collection("applications").doc(applicationId);
      const applicationDoc = await applicationRef.get();
      const applicationData = applicationDoc.data();
      const userId = applicationData.userId;

      // Check conditions for direct debit setup
      if (
        applicationData.partialScheme === true &&
        applicationData.autoDebit?.enabled === true &&
        applicationData.full_paid === false
      ) {
        // Parse deadline with explicit timezone
        const deadlineMoment = moment.tz(
          `${applicationData.payment2Deadline} ${applicationData.payment2DeadlineTime}`,
          "YYYY-MM-DD hh:mm A",
          TIME_ZONES.DEFAULT
        );

        // Create Square customer
        const customerResponse = await squareClient.customersApi.createCustomer(
          {
            givenName: "Recurring Customer",
            referenceId: `APP-${applicationId}-USER-${userId}`,
          }
        );

        // Create Square card
        const cardResponse = await squareClient.cardsApi.createCard({
          idempotencyKey: `${applicationId}-${Date.now()}`,
          sourceId: sourceId,
          card: {
            customerId: customerResponse.result.customer.id,
          },
        });

        // Store dates as UTC consistently
        await applicationRef.update({
          "autoDebit.squareCustomerId": customerResponse.result.customer.id,
          "autoDebit.squareCardId": cardResponse.result.card.id,
          "autoDebit.amountDue": applicationData.payment2,
          "autoDebit.dueDate": deadlineMoment.utc().toDate(), // Store as UTC date object
          "autoDebit.status": "SCHEDULED",
          "autoDebit.paymentTime": applicationData.payment2DeadlineTime,
          "autoDebit.selectedPayment": "payment2",
          "autoDebit.updatedAt": new Date().toISOString(),
        });

        // Prepare confirmation email
        const userRef = await db.collection("users").doc(userId).get();
        const userEmail = userRef.data().email;
        const AppId = applicationData.applicationId;

        const emailBody = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body {
                    font-family: 'Inter', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f7f9fc;
                    color: #333;
                }
                .email-container {
                    max-width: 600px;
                    margin: 30px auto;
                    background: #fff;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                    overflow: hidden;
                }
                .header {
                    background: #fff;
                    padding: 24px;
                    text-align: center;
                }
                .header img {
                    max-width: 200px;
                }
                .content {
                    padding: 32px;
                    line-height: 1.6;
                }
                .message {
                    font-size: 16px;
                    color: #555;
                    margin-bottom: 20px;
                }
                .details-card {
                    background: #f9fafb;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    border-left: 4px solid #089C34;
                }
                .card-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #222;
                    margin-bottom: 15px;
                }
                .detail-item {
                    margin: 10px 0;
                    display: flex;
                    justify-content: space-between;
                }
                .detail-label {
                    color: #666;
                    font-weight: 500;
                    margin-right: 10px;
                }
                .detail-value {
                    font-weight: 500;
                    color: #222;
                }
                .footer {
                    background: #fff;
                    padding: 20px;
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                }
                .footer a {
                    color: #666;
                    font-weight: 600;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
                </div>
                <div class="content">
                    <h1 style="color: #089C34; margin-bottom: 25px;">Direct Debit Setup Notification</h1>
                    
                    <p class="message">Dear Applicant,</p>
                    <p class="message">Direct debit  for application <strong>#${AppId}</strong> has been successfully set up. Below are your payment details:</p>
        
                    <div class="details-card">
                        <div class="card-title">Payment Schedule Details</div>
                      
                        <div class="detail-item">
                            <span class="detail-label">Scheduled Amount:</span>
                            <span class="detail-value"> $${
                              applicationData.payment2
                            }</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Payment Date:</span>
                            <span class="detail-value"> ${deadlineMoment.format(
                              "MMMM D, YYYY"
                            )}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Payment Method:</span>
                            <span class="detail-value"> Automated Direct Debit</span>
                        </div>
                    </div>
        
                    <p class="message" style="margin-top: 25px;">
                        <strong>Important:</strong> Your payment will be automatically processed on the scheduled date. 
                        Please ensure sufficient funds are available in your account.
                    </p>
                    
                    <p class="message">
                        Need to update your payment details? Contact our support team for assistance.
                    </p>
                </div>
               <div class="footer">
                    <p>© 2025 Certified Australia. All rights reserved.</p>
                    <p>Need help? <a href="mailto:support@certifiedaustralia.com.au" class="footer-link">Contact Support</a></p>
                </div>
            </div>
        </body>
        </html>`;
        const subject = `Direct Debit Setup for Application ${AppId}`;

        await sendEmail(userEmail, emailBody, subject);
      }

      await checkApplicationStatusAndSendEmails(applicationId, "payment_made");
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

// end

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

    await applicationRef.update({
      discount: discount,
    });

    res.status(200).json({
      message: "Discount applied successfully",

      discount,
    });
  } catch (error) {
    console.error("Error applying discount:", error);
    res.status(500).json({ message: error.message });
  }
};

// Add Expenses

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

// Get Expenses
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
      applicationAssignmentDate: new Date().toISOString(),
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
      assessed: true,
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
  addPayment2DeadlineDate,
  createNewApplicationByAgent,
  deleteApplication,
  unArchiveApplication,
  dividePaymentIntoTwo,
  handleSquareWebhook,
  addExpenseToApplication,
  processPayment,
  handleSquareWebhook,
  exportApplicationsToCSV,
  addDiscountToApplication,
  getApplicationExpenses,
  assignApplicationToAdmin,
  updateCallAttempts,
  updateContactStatus,
  addAssessorNoteToApplication,
  sendToRTO,
  getApplicationStats,
  getApplicationById,
  processScheduledPayment,
  getAgentsKPIStats,
};
