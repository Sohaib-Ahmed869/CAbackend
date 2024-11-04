const { db, auth } = require("../firebase");
const {sendEmail} = require("../utils/emailUtil");
const bcrypt = require("bcrypt");
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
    const snapshot = await db.collection("applications").get();

    const applications = snapshot.docs.map((doc) => ({
      ...doc.data(),
      applicationId: doc.id,
    }));

    //get the initial screening form data and add to applications
    const initialScreeningFormsSnapshot = await db
      .collection("initialScreeningForms")
      .get();
    const initialScreeningForms = initialScreeningFormsSnapshot.docs.map(
      (doc) => doc.data()
    );

    applications.forEach((application) => {
      //get the document id which matches application.initialFormId form.id === application.applicationId
      const initialScreeningForm = initialScreeningForms.find(
        (form) => form.id === application.initialFormId
      );
      application.isf = initialScreeningForm;
    });

    //get user data and add to applications
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => doc.data());

    applications.forEach((application) => {
      const user = users.find((user) => user.id === application.userId);
      application.user = user;
    });

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
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();

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
         
         <p>If you have any questions or require assistance, please don't hesitate to reach out to our support team. We're here to help!</p>
         
         <p>Thank you for choosing us, and we look forward to welcoming you as a valuable member of our community.</p>
         
         <p>Warm regards,</p>
         <p><strong>Certified Australia</strong></p>
       `;

      await sendEmail(email, emailBody, emailSubject);
    }

    res.status(200).json({ message: "Application verified successfully" });
  } catch (error) {
    console.log(error)
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
  let stats = {
    totalApplications: 0,
    totalCustomers: 0,
    totalAgents: 0,
    verifiedApplications: 0,
    verifiedCustomers: 0,
    paidApplications: 0,
    rtoApplications: 0,
  };

  try {
    const applicationsSnapshot = await db.collection("applications").get();
    stats.totalApplications = applicationsSnapshot.size;

    const customersSnapshot = await db
      .collection("users")
      .where("role", "==", "customer")
      .get();
    stats.totalCustomers = customersSnapshot.size;

    const agentsSnapshot = await db
      .collection("users")
      .where("role", "==", "agent")
      .get();
    stats.totalAgents = agentsSnapshot.size;

    const verifiedApplicationsSnapshot = await db
      .collection("applications")
      .where("verified", "==", true)
      .get();
    stats.verifiedApplications = verifiedApplicationsSnapshot.size;

    const verifiedCustomersSnapshot = await db
      .collection("users")
      .where("role", "==", "customer")
      .where("verified", "==", true)
      .get();
    stats.verifiedCustomers = verifiedCustomersSnapshot.size;

    const paidApplicationsSnapshot = await db
      .collection("applications")
      .where("paid", "==", true)
      .get();
    stats.paidApplications = paidApplicationsSnapshot.size;

    const rtoApplicationsSnapshot = await db
      .collection("applications")
      .where("currentStatus", "==", "Sent to RTO")
      .get();

    stats.rtoApplications = rtoApplicationsSnapshot.size;

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
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
};
