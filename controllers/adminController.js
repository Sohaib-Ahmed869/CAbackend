const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
const bcrypt = require("bcrypt");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 }); // Cache TTL of 60 seconds

// Admin Login
const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await auth.signInWithEmailAndPassword(email, password);

    res.status(200).json({ message: "Login successful" });
  } catch (error) {
    res.status(401).json({ message: "Invalid email or password" });
  }
};

// register admin
const registerAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await auth.createUser({
      email,
      password,
    });

    //store in users collection
    await db.collection("users").doc(user.uid).set({
      email,
      role: "admin",
      id: user.uid,
    });

    res.status(200).json({ message: "Admin registered successfully" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Error registering admin" });
  }
};

const getCustomers = async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .where("role", "==", "customer")
      .get();

    // Map over the snapshot to include the document ID as `userId`
    const customers = snapshot.docs.map((doc) => ({
      ...doc.data(),
      userId: doc.id, // Set userId as the document ID
    }));

    // Retrieve all applications
    const applicationsSnapshot = await db.collection("applications").get();
    const applicationsData = applicationsSnapshot.docs.map((doc) => doc.data());

    // Calculate the total number of applications per customer
    customers.forEach((customer) => {
      const customerApplications = applicationsData.filter(
        (application) => application.userId === customer.userId
      );
      customer.totalApplications = customerApplications.length;
    });

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyCustomer = async (req, res) => {
  const { userId } = req.params;

  try {
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    await userRef.update({ verified: true });

    res.status(200).json({ message: "User verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getApplications = async (req, res) => {
  try {
    const cachedApplications = cache.get("applications");
    if (cachedApplications) {
      return res.status(200).json(cachedApplications); // Serve from cache
    }

    const [
      applicationsSnapshot,
      initialScreeningFormsSnapshot,
      documentsFormsSnapshot,
      studentIntakeFormsSnapshot,
      usersSnapshot,
    ] = await Promise.all([
      db.collection("applications").get(),
      db.collection("initialScreeningForms").get(),
      db.collection("documents").get(),
      db.collection("studentIntakeForms").get(),
      db.collection("users").get(),
    ]);

    const initialScreeningForms = {};
    initialScreeningFormsSnapshot.docs.forEach((doc) => {
      initialScreeningForms[doc.id] = doc.data();
    });

    const documentsForms = {};
    documentsFormsSnapshot.docs.forEach((doc) => {
      documentsForms[doc.id] = doc.data();
    });

    const studentIntakeForms = {};
    studentIntakeFormsSnapshot.docs.forEach((doc) => {
      studentIntakeForms[doc.id] = doc.data();
    });

    const users = {};
    usersSnapshot.docs.forEach((doc) => {
      users[doc.id] = doc.data();
    });

    const applications = applicationsSnapshot.docs.map((doc) => {
      const application = doc.data();

      return {
        ...application,
        isf: initialScreeningForms[application.initialFormId] || null,
        document: documentsForms[application.documentsFormId] || null,
        sif: studentIntakeForms[application.studentFormId] || null,
        user: users[application.userId] || null,
      };
    });

    cache.set("applications", applications); // Store results in cache
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyApplication = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      verified: true,
      currentStatus: "Waiting for Payment",
    });

    //add to application statuses array
    await applicationRef.update({
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Waiting for Payment",
          time: new Date().toISOString(),
        },
      ],
    });

    // Fetch user email and send a notification
    const { userId } = applicationDoc.data();
    const { price } = applicationDoc.data();

    let finalPrice = price.replace(",", "");
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();

      // Create a customer on Stripe
      const customer = await stripe.customers.create({
        email: email,
        name: `${firstName} ${lastName}`,
      });

      // Create an invoice item (adjust parameters to match your needs)
      await stripe.invoiceItems.create({
        customer: customer.id,
        amount: finalPrice,
        currency: "aud",
        description: "Application Processing Fee",
      });

      // Create the invoice
      const invoice = await stripe.invoices.create({
        customer: customer.id,
        auto_advance: false, // Auto-finalizes the invoice
      });

      // Finalize the invoice and retrieve it to get the hosted URL
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(
        invoice.id
      );

      // Finalize and send the invoice
      await stripe.invoices.finalizeInvoice(invoice.id);

      const token = await auth.createCustomToken(userId);
      const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

      const emailSubject = "Your Application Has Been Verified!";
      const emailBody = `
         <h2>Dear ${firstName} ${lastName},</h2>
         
         <p>Congratulations! We are pleased to inform you that your application has been successfully <strong>verified</strong>.</p>
         
         <p>Your application status is now <strong>"Waiting for Payment"</strong>. To complete the next step and finalize your registration, please proceed with the payment at your earliest convenience.</p>
         
         <h3>How to Make Your Payment:</h3>
         
         <ul>
         <li>Log in to your account on our platform.</li>
         <li>Navigate to the <strong>Existing Applications</strong> section in your dashboard.</li>
         <li>Follow the instructions to complete your payment securely.</li>
         </ul>
         
         <p>You can view and pay your invoice here: <a href="${finalizedInvoice.hosted_invoice_url}">Pay Invoice</a></p>
         
         <a href="${loginUrl}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Fill Student Intake Form</a>
         
         <p>If you have any questions or require assistance, please don't hesitate to reach out to our support team. We're here to help!</p>
         
         <p>Thank you for choosing us, and we look forward to welcoming you as a valuable member of our community.</p>
         
         <p>Warm regards,</p>
         <p><strong>Certified Australia</strong></p>
       `;

      await sendEmail(email, emailBody, emailSubject);
    }

    res.status(200).json({ message: "Application verified successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const markApplicationAsPaid = async (req, res) => {
  const { applicationId } = req.params;

  console.log(applicationId);
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      paid: true,
      currentStatus: "Student Intake Form",
    });

    //add to application statuses array
    await applicationRef.update({
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
    });

    res.status(200).json({ message: "Application marked as paid" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const [
      applicationsSnapshot,
      customersSnapshot,
      agentsSnapshot,
      verifiedApplicationsSnapshot,
      verifiedCustomersSnapshot,
      paidApplicationsSnapshot,
      rtoApplicationsSnapshot,
    ] = await Promise.all([
      db.collection("applications").get(),
      db.collection("users").where("role", "==", "customer").get(),
      db.collection("users").where("role", "==", "agent").get(),
      db.collection("applications").where("verified", "==", true).get(),
      db
        .collection("users")
        .where("role", "==", "customer")
        .where("verified", "==", true)
        .get(),
      db.collection("applications").where("paid", "==", true).get(),
      db
        .collection("applications")
        .where("currentStatus", "==", "Sent to RTO")
        .get(),
    ]);

    const stats = {
      totalApplications: applicationsSnapshot.size,
      totalCustomers: customersSnapshot.size,
      totalAgents: agentsSnapshot.size,
      verifiedApplications: verifiedApplicationsSnapshot.size,
      verifiedCustomers: verifiedCustomersSnapshot.size,
      paidApplications: paidApplicationsSnapshot.size,
      rtoApplications: rtoApplicationsSnapshot.size,
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addNoteToApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { note } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({
      note: note,
    });

    //delete the cache
    cache.del("applications");

    res.status(200).json({ message: "Note added successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resend Email to User
const resendEmail = async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch the user's email by userId from the 'users' collection
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const token = await auth.createCustomToken(userId);
    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const { email, firstName, lastName } = userDoc.data();

    // Email content
    const emailSubject = "Progress Update for Your Application";
    const emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>To view the progress of your application, please visit your <strong>Student Portal</strong>.</p>
      
      <a href="${loginUrl}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
        Go to Student Portal
      </a>
      
      <p>If you have any questions, please feel free to contact our support team.</p>
      
      <p>Best regards,</p>
      <p><strong>Your Application Team</strong></p>
    `;

    // Send the email
    await sendEmail(email, emailBody, emailSubject);

    res.status(200).json({ message: "Email resent successfully" });
  } catch (error) {
    console.error("Error resending email:", error);
    res.status(500).json({ message: "Error resending email" });
  }
};

const addColorToApplication = async (req, res) => {
  const { applicationId } = req.params;
  const { colorToBeAdded } = req.body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    await applicationRef.update({ color: colorToBeAdded });

    cache.del("applications");
    res.status(200).json({
      message: "Color updated successfully",
      applicationId,
      color: colorToBeAdded,
    });
  } catch (error) {
    console.error("Error updating application color:", error);
    res.status(500).json({
      message: "Failed to update application color",
      error: error.message,
    });
  }
};

module.exports = {
  adminLogin,
  registerAdmin,
  getCustomers,
  verifyCustomer,
  getApplications,
  verifyApplication,
  markApplicationAsPaid,
  getDashboardStats,
  addNoteToApplication,
  resendEmail,
  addColorToApplication,
};
