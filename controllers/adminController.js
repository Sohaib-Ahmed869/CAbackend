const { db, auth } = require("../firebase");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { sendEmail } = require("../utils/emailUtil");
const bcrypt = require("bcrypt");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 }); // Cache TTL of 60 seconds
const {
  checkApplicationStatusAndSendEmails,
} = require("../utils/applicationEmailService");

// update agent targets
// Add/Update Targets for Agents
const updateAgentTargets = async (req, res) => {
  const { agentId } = req.params;
  const { targetType, targetValue, date } = req.body;

  // Validate required fields
  if (!targetType || !targetValue || !date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields: targetType, targetValue, date",
    });
  }

  // Ensure targetValue is a valid number
  const numericTargetValue = Number(targetValue);
  if (isNaN(numericTargetValue) || numericTargetValue <= 0) {
    return res.status(400).json({
      success: false,
      message: "Target value must be a positive number",
    });
  }

  try {
    const targetDate = new Date(date);

    // Validate date format
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    const formattedDate = targetDate.toISOString().split("T")[0];

    // Reference Firestore collection (one document per agent)
    const targetRef = db.collection("targets").doc(agentId);

    // Fetch the existing document
    const docSnapshot = await targetRef.get();
    let existingTargets = [];

    if (docSnapshot.exists) {
      const data = docSnapshot.data();
      existingTargets = data.targets || [];
    }

    // Check if an entry for the given date exists
    const existingEntryIndex = existingTargets.findIndex(
      (entry) => entry.date === formattedDate
    );

    if (existingEntryIndex !== -1) {
      // Update the existing entry
      existingTargets[existingEntryIndex][targetType] = numericTargetValue;
    } else {
      // Create a new entry for the date
      existingTargets.push({
        date: formattedDate,
        [targetType]: numericTargetValue,
        createdAt: new Date(),
      });
    }

    // Update Firestore document
    await targetRef.set(
      {
        targets: existingTargets,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    res.status(200).json({
      success: true,
      message: "Target updated successfully",
      agentId,
      targetType,
      targetValue: numericTargetValue,
      date: formattedDate,
    });
  } catch (error) {
    console.error("Target update error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      code: error.code || "firestore/unknown",
    });
  }
};
const getAgentTargets = async (req, res) => {
  try {
    const snapshot = await db.collection("targets").get();

    if (snapshot.empty) {
      console.log("No matching documents in Firestore.");
      return res.status(200).json([]);
    }

    const targets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("🔥 All Fetched Targets from Firestore:", targets);

    res.status(200).json(targets); // Send all data to frontend
  } catch (error) {
    console.error("Error fetching targets:", error);
    res.status(500).json({
      message: "Failed to fetch targets",
      error: error.message,
    });
  }
};

// Update Expense of an application
const updateExpense = async (req, res) => {
  const { applicationId } = req.params;
  const { newExpense } = req.body;

  // Validate newExpense
  if (newExpense === undefined || newExpense === null) {
    return res.status(400).json({ message: "Expense value is required" });
  }

  try {
    // Fetch the application
    const appRef = db.collection("applications").doc(applicationId);
    const appDoc = await appRef.get();

    if (!appDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = appDoc.data();
    const initialFormId = applicationData.initialFormId;

    if (!initialFormId) {
      return res
        .status(400)
        .json({ message: "Initial Form ID not found in application" });
    }

    // Fetch and update the initialScreeningForm
    const isfRef = db.collection("initialScreeningForms").doc(initialFormId);
    const isfDoc = await isfRef.get();

    if (!isfDoc.exists) {
      return res
        .status(404)
        .json({ message: "Initial Screening Form not found" });
    }

    // Update the expense field with merge option
    await isfRef.update({ expense: newExpense }, { merge: true });

    res.status(200).json({
      message: "Expense updated successfully",
      expense: newExpense,
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    res
      .status(500)
      .json({ message: "Failed to update expense", error: error.message });
  }
};
const getAgents = async (req, res) => {
  try {
    const snapshot = await db.collection("users").get();
    const snapshotdata = snapshot.docs.map((doc) => doc.data());
    const agents = snapshotdata.filter((user) => user.type === "agent");
    res.status(200).json(agents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch agents", error: error.message });
  }
};

// Update Qualification of an application
const UpdateQualification = async (req, res) => {
  const id = req.params.id;
  const { industry, qualification, price, expense } = req.body;

  try {
    // Reference to the application document
    const applicationRef = db.collection("applications").doc(id);
    const applicationSnapshot = await applicationRef.get();

    if (!applicationSnapshot.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = applicationSnapshot.data();
    const { initialFormId, partialScheme } = applicationData;

    // Prepare update data
    let updateData = { price };

    // If partialScheme is true, split price into two equal payments
    if (partialScheme) {
      const halfPrice = price / 2;
      updateData.payment1 = halfPrice;
      updateData.payment2 = halfPrice;
    }

    // Update the application document
    await applicationRef.update(updateData);

    // Update initialScreeningForms collection using studentFormId
    if (initialFormId) {
      const screeningQuery = await db
        .collection("initialScreeningForms")
        .where("id", "==", initialFormId)
        .get();

      if (!screeningQuery.empty) {
        // Get the first matching document
        const screeningDoc = screeningQuery.docs[0].ref;

        // Prepare update data
        const studentUpdateData = {};
        if (industry) studentUpdateData.industry = industry;
        if (qualification)
          studentUpdateData.lookingForWhatQualification = qualification;
        if (expense) studentUpdateData.expense = expense;

        // Update the initialScreeningForms document
        await screeningDoc.update(studentUpdateData);
      } else {
        console.warn("No matching initialScreeningForms document found.");
      }
    } else {
      console.warn("No studentFormId found in the application document.");
    }

    res.status(200).json({
      message: "Qualification and related fields updated successfully",
    });
  } catch (error) {
    console.error("Error updating qualification:", error);
    res.status(500).json({ message: "Error updating qualification" });
  }
};

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
  const { email, password, name, type } = req.body;

  try {
    const user = await auth.createUser({
      email,
      password,
    });

    //store in users collection
    await db
      .collection("users")
      .doc(user.uid)
      .set({
        email,
        role: "admin",
        type: type,
        id: user.uid,
        name: name || "default",
      });

    res.status(200).json({ message: "Admin registered successfully" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Error registering admin" });
  }
};

//register assessor
const registerAssessor = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await auth.createUser({
      email,
      password,
    });

    //store in users collection
    await db.collection("users").doc(user.uid).set({
      email,
      role: "assessor",
      id: user.uid,
    });

    res.status(200).json({ message: "Assessor registered successfully" });
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Error registering assessor" });
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

const getAdminApplications = async (req, res) => {
  try {
    console.log("here");

    const { userId } = req.params;

    //get the admin
    const admin = await db.collection("users").doc(userId).get();

    if (!admin.exists) {
      return res.status(404).json({ message: "Admin not found" });
    }

    //get the email of the admin
    const email = admin.data().email;

    console.log(email);

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

    if (email === "gabi@certifiedaustralia.com.au") {
      let applications = applicationsSnapshot.docs.map((doc) => {
        const application = doc.data();

        return {
          ...application,
          isf: initialScreeningForms[application.initialFormId] || null,
          document: documentsForms[application.documentsFormId] || null,
          sif: studentIntakeForms[application.studentFormId] || null,
          user: users[application.userId] || null,
        };
      });

      applications = applications.filter(
        (application) => application.assignedAdmin === "Gabi"
      );

      cache.set("applications", applications); // Store results in cache
      return res.status(200).json(applications);
    } else if (email == "ehsan@certifiedaustralia.com.au") {
      let applications = applicationsSnapshot.docs.map((doc) => {
        const application = doc.data();

        return {
          ...application,
          isf: initialScreeningForms[application.initialFormId] || null,
          document: documentsForms[application.documentsFormId] || null,
          sif: studentIntakeForms[application.studentFormId] || null,
          user: users[application.userId] || null,
        };
      });

      applications = applications.filter(
        (application) => application.assignedAdmin == "Ehsan"
      );

      console.log(applications);

      cache.set("applications", applications); // Store results in cache
      return res.status(200).json(applications);
    } else {
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
    }
  } catch (error) {
    console.log(error);
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
    //get user id from the params of the request
    const userId = req.params.id;

    // Get the user document
    const userDoc = await db.collection("users").doc(userId).get();
    let type;

    if (userDoc.data().role === "admin") {
      type = userDoc.data().type;
    }

    // Check if the user exists
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if the user is an admin

    // Get all applications
    const applicationsSnapshot = await db.collection("applications").get();
    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    // Get all users
    const usersSnapshot = await db.collection("users").get();
    const users = usersSnapshot.docs.map((doc) => doc.data());

    // Calculate stats
    const totalApplications = applications.length;

    // Calculate total payments (sum of all prices where payment is completed)
    const totalPayments = applications
      .filter((app) => app.paid)
      .reduce((sum, app) => {
        let price = app.partialScheme
          ? app.full_paid
            ? app.price.replace(",", "")
            : app.amount_paid
          : app.price.replace(",", "");
        //filter out NaNs
        price = isNaN(price) ? 0 : parseFloat(price);
        return sum + price;
      }, 0);

    const totalPaymentsWithPartial = applications
      .filter((app) => app.paid && app.partialScheme)
      .reduce((sum, app) => {
        let price = app.full_paid
          ? app.price.replace(",", "")
          : app.amount_paid;
        //filter out NaNs
        price = isNaN(price) ? 0 : parseFloat(price);
        return sum + price;
      }, 0);

    const totalPaymentsWithoutPartial = applications
      .filter((app) => app.paid && !app.partialScheme)
      .reduce((sum, app) => {
        let price = app.price.replace(",", "");
        //filter out NaNs
        price = isNaN(price) ? 0 : parseFloat(price);
        return sum + price;
      }, 0);

    const totalRemainingPaymentsINPartial = applications
      .filter((app) => app.partialScheme && !app.full_paid)
      .reduce((sum, app) => {
        let price = app.price.replace(",", "") - app.amount_paid;
        //filter out NaNs
        price = isNaN(price) ? 0 : parseFloat(price);
        return sum + price;
      }, 0);

    // Count paid applications
    const paidApplications = applications.filter((app) => app.paid).length;

    // Count certificates generated
    const certificatesGenerated = applications.filter(
      (app) =>
        app.currentStatus === "Certificate Generated" ||
        app.currentStatus === "Dispatched" ||
        app.currentStatus === "Completed"
    ).length;

    // Count RTO applications
    const rtoApplications = applications.filter(
      (app) => app.currentStatus === "Sent to RTO"
    ).length;

    // Count pending payments
    const pendingPayments = applications.filter(
      (app) => !app.paid && app.currentStatus !== "Rejected"
    ).length;

    // Count total customers (users with role 'customer')
    const totalCustomers = users.filter(
      (user) => user.role === "customer"
    ).length;

    // Count total agents
    const totalAgents = users.filter((user) => user.type === "agent").length;

    const colorStatusCount = {
      hotLead: applications.filter((app) => app.color === "red").length,
      warmLead: applications.filter((app) => app.color === "orange").length,
      coldLead: applications.filter((app) => app.color === "gray").length,
      others: applications.filter(
        (app) =>
          app.color !== "red" && app.color !== "orange" && app.color !== "gray"
      ).length,
    };

    return res.status(200).json({
      totalApplications,
      totalPayments: type === "general" ? 0 : totalPayments,
      totalPaymentsWithPartial:
        type === "general" ? 0 : totalPaymentsWithPartial,
      totalPaymentsWithoutPartial:
        type === "general" ? 0 : totalRemainingPaymentsINPartial,
      paidApplications,
      certificatesGenerated,
      rtoApplications,
      pendingPayments,
      totalCustomers,
      totalAgents,
      colorStatusCount,
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
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

const resendEmail = async (req, res) => {
  const { applicationId } = req.params; // Changed from userId to applicationId

  try {
    // Fetch the application data
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicationData = applicationDoc.data();
    const { userId } = applicationData;

    // Fetch user data
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Trigger email sending based on the application's current status
    const result = await checkApplicationStatusAndSendEmails(
      applicationId,
      "manual_trigger" // This will use the contextual email logic
    );

    if (result.success) {
      res.status(200).json({
        message: "Email resent successfully",
        emailType: result.result.emailType,
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error("Error resending email:", error);
    res
      .status(500)
      .json({ message: "Error resending email", error: error.message });
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

const updateStudentIntakeForm = async (req, res) => {
  const { studentFormId } = req.params;
  const updatedFormData = req.body;

  try {
    const formRef = db.collection("studentIntakeForms").doc(studentFormId);
    const formDoc = await formRef.get();

    if (!formDoc.exists) {
      return res.status(404).json({ message: "Student intake form not found" });
    }

    // Remove qualification/certification fields from the update if they exist
    const { lookingForWhatQualification, qualification, ...allowedUpdates } =
      updatedFormData;

    await formRef.update(allowedUpdates);

    // Clear the applications cache since form data has changed
    cache.del("applications");

    res
      .status(200)
      .json({ message: "Student intake form updated successfully" });
  } catch (error) {
    console.error("Error updating student intake form:", error);
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
  getAgents,
  getDashboardStats,
  addNoteToApplication,
  resendEmail,
  addColorToApplication,
  getAdminApplications,
  updateStudentIntakeForm,
  registerAssessor,
  UpdateQualification,
  updateExpense,
  getAgentTargets,
  updateAgentTargets,
};
