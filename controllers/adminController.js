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
const updateAutoDebit = async (req, res) => {
  const { applicationId } = req.params;
  const { dueDate, time, setScheduled } = req.body;

  if (!dueDate || !time) {
    return res.status(400).json({ message: "Due date and time are required" });
  }

  try {
    const appRef = db.collection("applications").doc(applicationId);
    const appDoc = await appRef.get();

    if (!appDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const formattedTimestamp = new Date(`${dueDate}T${time}:00`);

    const updates = {
      "autoDebit.dueDate": formattedTimestamp,
      "autoDebit.paymentTime": time,
      "autoDebit.updatedAt": new Date().toISOString(),
    };

    if (setScheduled !== undefined) {
      updates["autoDebit.status"] = "SCHEDULED";
    }

    await appRef.update(updates);

    res.status(200).json({
      message: "Auto-debit updated successfully",
      dueDate: formattedTimestamp,
      time,
      status: updates["autoDebit.status"] || "unchanged",
    });
  } catch (error) {
    console.error("Error updating auto-debit:", error);
    res.status(500).json({
      message: "Failed to update auto-debit",
      error: error.message,
    });
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
// paginated getApplications for students tab in admin
const getStudentApplications = async (req, res) => {
  try {
    // Parse query parameters
    const {
      page = 1,
      limit = 10,
      search,
      assignedAdmin,
      colorFilter,
      industry,
      callAttempts,
      sortField = "dateCreated",
      sortDirection = "desc",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Check cache first
    const cachedApplications = cache.get("applications");
    let applications;

    if (cachedApplications) {
      applications = cachedApplications;
    } else {
      // Fetch all data if not cached
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

      // Process related data
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

      applications = applicationsSnapshot.docs.map((doc) => {
        const application = doc.data();

        return {
          ...application,
          isf: initialScreeningForms[application.initialFormId] || null,
          document: documentsForms[application.documentsFormId] || null,
          sif: studentIntakeForms[application.studentFormId] || null,
          user: users[application.userId] || null,
        };
      });

      cache.set("applications", applications);
    }

    // Apply filters
    let filtered = [...applications];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.applicationId?.toLowerCase().includes(searchLower) ||
          app.user?.firstName?.toLowerCase().includes(searchLower) ||
          app.user?.lastName?.toLowerCase().includes(searchLower) ||
          app.user?.phone?.includes(search) ||
          app.isf?.industry?.toLowerCase().includes(searchLower) ||
          app.isf?.lookingForWhatQualification
            ?.toLowerCase()
            .includes(searchLower)
      );
    }

    // Assignment filter
    if (assignedAdmin && assignedAdmin !== "All") {
      if (assignedAdmin === "N/A") {
        filtered = filtered.filter((app) => !app.assignedAdmin);
      } else {
        filtered = filtered.filter(
          (app) => app.assignedAdmin === assignedAdmin
        );
      }
    }

    // Color filter
    if (colorFilter && colorFilter !== "All") {
      const colorMap = {
        "Hot Lead": "red",
        "Warm Lead": "orange",
        "Cold Lead": "gray",
        "Proceeded With Payment": "yellow",
        "Impacted Student": "lightblue",
        Agent: "pink",
        Completed: "green",
        Default: "white",
      };

      if (colorFilter === "Default") {
        filtered = filtered.filter(
          (app) => !app.color || app.color === "white"
        );
      } else {
        const targetColor = colorMap[colorFilter];
        filtered = filtered.filter((app) => app.color === targetColor);
      }
    }

    // Industry filter
    if (industry && industry !== "All") {
      filtered = filtered.filter((app) => app.isf?.industry === industry);
    }

    // Call attempts filter
    if (callAttempts && callAttempts !== "All") {
      if (callAttempts === "None") {
        filtered = filtered.filter((app) => !app.contactAttempts);
      } else {
        const attempts = parseInt(callAttempts);
        filtered = filtered.filter((app) =>
          attempts >= 5
            ? app.contactAttempts >= 5
            : app.contactAttempts === attempts
        );
      }
    }

    // Filter out archived
    filtered = filtered.filter((app) => !app.archive);

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      const dateA = a.status?.[0]?.time
        ? new Date(a.status[0].time)
        : new Date(0);
      const dateB = b.status?.[0]?.time
        ? new Date(b.status[0].time)
        : new Date(0);

      switch (sortField) {
        case "dateCreated":
          comparison = dateB - dateA;
          break;
        case "customerName":
          const nameA = `${a.user?.firstName || ""} ${a.user?.lastName || ""}`;
          const nameB = `${b.user?.firstName || ""} ${b.user?.lastName || ""}`;
          comparison = nameA.localeCompare(nameB);
          break;
        case "status":
          comparison = (a.currentStatus || "").localeCompare(
            b.currentStatus || ""
          );
          break;
        case "payment":
          // Payment status comparison logic
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedApplications = filtered.slice(startIndex, endIndex);

    res.status(200).json({
      applications: paginatedApplications,
      totalApplications: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// end

// paginated applications function
const getPaginatedApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status = "All",
      dateFilter = "all",
      sortField = "date",
      sortDirection = "desc",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Check cache first
    const cachedApplications = cache.get("applications");
    let applications;

    if (cachedApplications) {
      applications = cachedApplications;
    } else {
      // Fetch all data if not cached (same as your existing code)
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

      // Process related data (same as your existing code)
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

      applications = applicationsSnapshot.docs
        .map((doc) => {
          const application = doc.data();
          return {
            ...application,
            isf: initialScreeningForms[application.initialFormId] || null,
            document: documentsForms[application.documentsFormId] || null,
            sif: studentIntakeForms[application.studentFormId] || null,
            user: users[application.userId] || null,
          };
        })
        .filter((app) => !app.archive);

      cache.set("applications", applications);
    }

    // Apply filters
    let filtered = [...applications];

    // Status filter
    if (status !== "All") {
      if (status === "Certificate Issued") {
        filtered = filtered.filter(
          (app) => app.currentStatus === "Certificate Generated"
        );
      } else {
        filtered = filtered.filter((app) => app.currentStatus === status);
      }
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (app) =>
          app.applicationId?.toString().includes(searchLower) ||
          app.id?.toString().includes(searchLower) ||
          `${app.user?.firstName} ${app.user?.lastName}`
            .toLowerCase()
            .includes(searchLower) ||
          app.isf?.lookingForWhatQualification
            ?.toLowerCase()
            .includes(searchLower) ||
          app.currentStatus?.toLowerCase().includes(searchLower)
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      filtered = filtered.filter((app) => {
        const appDate = new Date(app.status[0].time);
        switch (dateFilter) {
          case "today":
            return appDate >= today;
          case "week":
            return appDate >= weekStart;
          case "month":
            return appDate >= monthStart;
          case "year":
            return appDate >= yearStart;
          default:
            return true;
        }
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.status[0].time);
      const dateB = new Date(b.status[0].time);

      switch (sortField) {
        case "date":
          return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
        case "name":
          const nameA =
            `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();
          const nameB =
            `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();
          return sortDirection === "asc"
            ? nameA.localeCompare(nameB)
            : nameB.localeCompare(nameA);
        case "qualification":
          const qualA = (
            a.isf?.lookingForWhatQualification || ""
          ).toLowerCase();
          const qualB = (
            b.isf?.lookingForWhatQualification || ""
          ).toLowerCase();
          return sortDirection === "asc"
            ? qualA.localeCompare(qualB)
            : qualB.localeCompare(qualA);
        case "status":
          return sortDirection === "asc"
            ? a.currentStatus.localeCompare(b.currentStatus)
            : b.currentStatus.localeCompare(a.currentStatus);
        case "payment":
          return sortDirection === "asc"
            ? (a.paid ? 1 : 0) - (b.paid ? 1 : 0)
            : (b.paid ? 1 : 0) - (a.paid ? 1 : 0);
        default:
          return 0;
      }
    });

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedApplications = filtered.slice(startIndex, endIndex);

    res.status(200).json({
      applications: paginatedApplications,
      totalApplications: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// end

// stats for applications tab on admin portal
const getApplicationsStats = async (req, res) => {
  try {
    // Check cache first
    const cachedStats = cache.get("global-stats");
    if (cachedStats) {
      return res.status(200).json(cachedStats);
    }

    // Fetch all related data like in pagination
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

    // Create lookup maps like in pagination
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

    // Map applications with related data like in pagination
    const allApplications = applicationsSnapshot.docs.map((doc) => {
      const application = doc.data();
      return {
        ...application,
        isf: initialScreeningForms[application.initialFormId] || null,
        document: documentsForms[application.documentsFormId] || null,
        sif: studentIntakeForms[application.studentFormId] || null,
        user: users[application.userId] || null,
      };
    });

    // Rest of your stats calculation remains the same
    const totalApplications = allApplications.length;
    const completedApplications = allApplications.filter((app) =>
      ["Certificate Generated", "Dispatched", "Completed"].includes(
        app.currentStatus
      )
    ).length;

    const paidApplications = allApplications.filter((app) => app.paid).length;

    const statusCounts = {
      studentForm: allApplications.filter(
        (app) => app.currentStatus === "Student Intake Form"
      ).length,
      uploadDocuments: allApplications.filter(
        (app) => app.currentStatus === "Upload Documents"
      ).length,
      sentToRTO: allApplications.filter(
        (app) => app.currentStatus === "Sent to RTO"
      ).length,
      certificateGenerated: allApplications.filter(
        (app) => app.currentStatus === "Certificate Generated"
      ).length,
    };

    const qualificationCount = allApplications.reduce((acc, app) => {
      const qual = app.isf?.lookingForWhatQualification || "Unknown";
      acc[qual] = (acc[qual] || 0) + 1;
      return acc;
    }, {});

    const mostPopularQualification = Object.entries(qualificationCount).reduce(
      (acc, [name, count]) => (count > acc.count ? { name, count } : acc),
      { name: "N/A", count: 0 }
    );

    const stats = {
      totalApplications,
      completedApplications,
      paidApplications,
      unpaidApplications: totalApplications - paidApplications,
      completionRate:
        totalApplications > 0
          ? Number(
              ((completedApplications / totalApplications) * 100).toFixed(1)
            )
          : 0,
      paymentRate:
        totalApplications > 0
          ? Number(((paidApplications / totalApplications) * 100).toFixed(1))
          : 0,
      mostPopularQualification,
      statusCounts,
      qualificationDistribution: qualificationCount,
      lastUpdated: new Date().toISOString(),
    };

    // Cache the complete stats
    cache.set("global-stats", stats, 900);

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching global statistics",
      error: error.message,
    });
  }
};
//end

// Payment tab stats for admin portal
const getPaymentStats = async (req, res) => {
  try {
    const cachedStats = cache.get("payment-stats");
    if (cachedStats) return res.json(cachedStats);

    // Fetch all related data
    const [applicationsSnapshot, initialScreeningFormsSnapshot, usersSnapshot] =
      await Promise.all([
        db.collection("applications").get(),
        db.collection("initialScreeningForms").get(),
        db.collection("users").get(),
      ]);

    // Create lookup maps
    const initialScreeningForms = {};
    initialScreeningFormsSnapshot.docs.forEach((doc) => {
      initialScreeningForms[doc.id] = doc.data();
    });

    const users = {};
    usersSnapshot.docs.forEach((doc) => {
      users[doc.id] = doc.data();
    });

    // Map applications with related data
    const allApplications = applicationsSnapshot.docs.map((doc) => {
      const application = doc.data();
      return {
        ...application,
        isf: initialScreeningForms[application.initialFormId] || null,
        user: users[application.userId] || null,
      };
    });

    // Calculate stats
    const stats = {
      totalApplications: allApplications.length,
      completedPayments: allApplications.filter(
        (app) => app.paid && !app.partialScheme
      ).length,
      partialPayments: allApplications.filter(
        (app) => app.partialScheme && app.paid && !app.full_paid
      ).length,
      fullPaidPayments: allApplications.filter(
        (app) => app.partialScheme && app.full_paid
      ).length,
      pendingPayments: allApplications.filter((app) => !app.paid).length,
      totalRevenue: allApplications.reduce((total, app) => {
        if (!app.paid) return total;

        let amount = 0;
        const parsePrice = (price) =>
          parseFloat(String(price).replace(/,/g, "")) || 0;

        if (app.discount) {
          amount = parsePrice(app.price) - parsePrice(app.discount);
        } else if (app.partialScheme) {
          const payment1 = parsePrice(app.payment1);
          const payment2 = parsePrice(app.payment2);
          amount = app.full_paid ? payment1 + payment2 : payment1;
        } else {
          amount = parsePrice(app.price);
        }

        return total + amount;
      }, 0),
      popularQualifications: allApplications.reduce((acc, app) => {
        const qual = app.isf?.lookingForWhatQualification || "Unknown";
        acc[qual] = (acc[qual] || 0) + 1;
        return acc;
      }, {}),
    };

    cache.set("payment-stats", stats, 900); // 15min cache
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//end
// paginated payments tab applications
const getPaginatedPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "All Payments",
      sortBy = "date",
      sortDirection = "desc",
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Check cache first
    const cachedApplications = cache.get("applications");
    let applications;

    if (cachedApplications) {
      applications = cachedApplications;
    } else {
      // Fetch all related data
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

      // Create lookup maps
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

      // Map applications with related data
      applications = applicationsSnapshot.docs.map((doc) => {
        const application = doc.data();
        return {
          ...application,
          isf: initialScreeningForms[application.initialFormId] || null,
          document: documentsForms[application.documentsFormId] || null,
          sif: studentIntakeForms[application.studentFormId] || null,
          user: users[application.userId] || null,
        };
      });

      cache.set("applications", applications);
    }

    // Apply filters
    let filtered = [...applications];

    // Status filter
    switch (status) {
      case "Payments Completed":
        filtered = filtered.filter((app) => app.paid && !app.partialScheme);
        break;
      case "Waiting for Payment":
        filtered = filtered.filter((app) => !app.paid);
        break;
      case "Partial Payment":
        filtered = filtered.filter(
          (app) => app.partialScheme && app.paid && !app.full_paid
        );
        break;
    }

    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((app) => {
        const studentName = `${app.user?.firstName || ""} ${
          app.user?.lastName || ""
        }`.toLowerCase();
        const qualification =
          app.isf?.lookingForWhatQualification?.toLowerCase() || "";

        return (
          studentName.includes(searchLower) ||
          (app.applicationId || "").toLowerCase().includes(searchLower) ||
          qualification.includes(searchLower)
        );
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      const parsePrice = (price) =>
        parseFloat(String(price).replace(/,/g, "")) || 0;
      const getSortValue = (app) => {
        switch (sortBy) {
          case "date":
            return new Date(app.status?.[0]?.time || 0);
          case "amount":
            if (app.discount)
              return parsePrice(app.price) - parsePrice(app.discount);
            if (app.partialScheme) {
              const p1 = parsePrice(app.payment1);
              const p2 = parsePrice(app.payment2);
              return app.full_paid ? p1 + p2 : p1;
            }
            return parsePrice(app.price);
          case "name":
            return `${app.user?.firstName} ${app.user?.lastName}`.toLowerCase();
          default:
            return 0;
        }
      };

      const aValue = getSortValue(a);
      const bValue = getSortValue(b);

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedResults = filtered.slice(startIndex, endIndex);

    res.json({
      applications: paginatedResults,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching paginated payments",
      error: error.message,
    });
  }
};
//end
// assessor Paginated Applications
const getAssessorPendingApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      industry = "All",
      dateFilter = "All",
      status = "pending", // 'pending' or 'assessed'
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));

    // Just use a simple query to get paid applications
    const query = db.collection("applications").where("paid", "==", true);

    // Execute the query
    const applicationsSnapshot = await query.get();

    let applications = await Promise.all(
      applicationsSnapshot.docs.map(async (doc) => {
        const appData = doc.data();

        // Fetch related data
        const [user, isf, sif, document] = await Promise.all([
          db.collection("users").doc(appData.userId).get(),
          db
            .collection("initialScreeningForms")
            .doc(appData.initialFormId)
            .get(),
          db.collection("studentIntakeForms").doc(appData.studentFormId).get(),
          db.collection("documents").doc(appData.documentsFormId).get(),
        ]);

        return {
          id: doc.id,
          ...appData,
          user: user.exists ? user.data() : null,
          isf: isf.exists ? isf.data() : null,
          sif: sif.exists ? sif.data() : null,
          document: document.exists ? document.data() : null,
        };
      })
    );

    // Do the rest of the filtering in memory
    applications = applications.filter((app) => {
      // Check if student form is filled
      const hasStudentForm =
        app.sif &&
        Object.keys(app.sif).length > 0 &&
        app.sif.firstName &&
        app.sif.lastName &&
        app.sif.dob;

      // Check if documents are uploaded
      const hasDocuments =
        app.document &&
        Object.keys(app.document).length > 0 &&
        app.document.resume;

      // Check if payment is completed
      const isPaymentComplete =
        app.paid === true &&
        (!app.partialScheme || (app.partialScheme && app.full_paid === true));

      // Check if certificate is not uploaded
      const certificateNotUploaded =
        app.currentStatus !== "Certificate Generated" &&
        app.currentStatus !== "Completed" &&
        app.currentStatus !== "Dispatched";

      const isAssessed = app.assessed === true;

      if (status === "pending") {
        return (
          hasStudentForm &&
          hasDocuments &&
          isPaymentComplete &&
          certificateNotUploaded &&
          !isAssessed
        );
      } else {
        return (
          hasStudentForm && hasDocuments && isPaymentComplete && isAssessed
        );
      }
    });
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      applications = applications.filter((app) => {
        const name = `${app.user?.firstName || ""} ${
          app.user?.lastName || ""
        }`.toLowerCase();
        const appId = (app.applicationId || "").toLowerCase();
        const qualification = (
          app.isf?.lookingForWhatQualification || ""
        ).toLowerCase();

        return (
          name.includes(searchLower) ||
          appId.includes(searchLower) ||
          qualification.includes(searchLower)
        );
      });
    }

    // Apply industry filter
    if (industry !== "All") {
      applications = applications.filter(
        (app) => app.isf?.industry === industry
      );
    }

    // Apply date filter
    if (dateFilter !== "All") {
      const days = parseInt(dateFilter);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      applications = applications.filter((app) => {
        const appDate = new Date(app.status?.[0]?.time || 0);
        return appDate >= cutoffDate;
      });
    }

    // Sorting
    applications.sort((a, b) => {
      const aValue =
        sortBy === "date"
          ? new Date(a.status?.[0]?.time || 0)
          : `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();

      const bValue =
        sortBy === "date"
          ? new Date(b.status?.[0]?.time || 0)
          : `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();

      return sortOrder === "asc"
        ? aValue - bValue || aValue.localeCompare(bValue)
        : bValue - aValue || bValue.localeCompare(aValue);
    });

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginated = applications.slice(startIndex, endIndex);

    res.json({
      applications: paginated,
      total: applications.length,
      totalPages: Math.ceil(applications.length / limitNum),
      currentPage: pageNum,
      itemsPerPage: limitNum,
    });
  } catch (error) {
    console.error("Error fetching assessor applications:", error);
    res.status(500).json({
      message: "Error fetching applications",
      error: error.message,
    });
  }
};
const getAssessedApplications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      statusFilter = "All",
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));

    // Base query
    let query = db
      .collection("applications")
      .where("assessed", "==", true)
      .where("paid", "==", true);

    // Execute base query
    const applicationsSnapshot = await query.get();

    let applications = await Promise.all(
      applicationsSnapshot.docs.map(async (doc) => {
        const appData = doc.data();

        // Fetch related data
        const [user, isf, sif, document] = await Promise.all([
          db.collection("users").doc(appData.userId).get(),
          db
            .collection("initialScreeningForms")
            .doc(appData.initialFormId)
            .get(),
          db.collection("studentIntakeForms").doc(appData.studentFormId).get(),
          db.collection("documents").doc(appData.documentsFormId).get(),
        ]);

        return {
          id: doc.id,
          ...appData,
          user: user.exists ? user.data() : null,
          isf: isf.exists ? isf.data() : null,
          sif: sif.exists ? sif.data() : null,
          document: document.exists ? document.data() : null,
        };
      })
    );
    // Status filter
    if (statusFilter !== "All") {
      applications = applications.filter(
        (app) => app.currentStatus === statusFilter
      );
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      applications = applications.filter((app) => {
        const name = `${app.user?.firstName || ""} ${
          app.user?.lastName || ""
        }`.toLowerCase();
        const appId = (app.applicationId || "").toLowerCase();
        return name.includes(searchLower) || appId.includes(searchLower);
      });
    }

    // Sorting
    applications.sort((a, b) => {
      const aValue =
        sortBy === "date"
          ? new Date(a.status?.[0]?.time || 0)
          : `${a.user?.firstName} ${a.user?.lastName}`.toLowerCase();

      const bValue =
        sortBy === "date"
          ? new Date(b.status?.[0]?.time || 0)
          : `${b.user?.firstName} ${b.user?.lastName}`.toLowerCase();

      return sortOrder === "asc"
        ? aValue - bValue || aValue.localeCompare(bValue)
        : bValue - aValue || bValue.localeCompare(aValue);
    });

    // Pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginated = applications.slice(startIndex, endIndex);

    res.json({
      applications: paginated,
      total: applications.length,
      totalPages: Math.ceil(applications.length / limitNum),
      currentPage: pageNum,
      itemsPerPage: limitNum,
    });
  } catch (error) {
    console.error("Error fetching RTO applications:", error);
    res.status(500).json({
      message: "Error fetching applications",
      error: error.message,
    });
  }
};
// end
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
// Optimizing Api endpoint for dashboard stats

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.params.id;
    const agentFilter = req.query.agentId; // Get agent filter from query params

    // Get the user document
    const userDocSnap = await db.collection("users").doc(userId).get();
    if (!userDocSnap.exists) {
      return res.status(404).json({ message: "User not found" });
    }
    const userData = userDocSnap.data();
    let type = null;
    if (userData.role === "admin") {
      type = userData.type;
    }

    // Fetch applications and users concurrently
    const [applicationsSnapshot, usersSnapshot] = await Promise.all([
      db.collection("applications").get(),
      db.collection("users").get(),
    ]);

    const applicationsDocs = applicationsSnapshot.docs;
    const usersDocs = usersSnapshot.docs;
    let applications = applicationsDocs.map((doc) => doc.data());

    if (agentFilter && agentFilter !== "reset") {
      applications = applications.filter(
        (app) => app.assignedAdmin === agentFilter
      );
    }

    // Initialize aggregate counters
    const totalApplications = applications.length;
    let totalPayments = 0;
    let totalPaymentsWithPartial = 0;
    let totalPaymentsWithoutPartial = 0;
    let totalRemainingPaymentsINPartial = 0;
    let paidApplications = 0;
    let certificatesGenerated = 0;
    let rtoApplications = 0;
    let pendingPayments = 0;
    const colorStatusCount = {
      hotLead: 0,
      warmLead: 0,
      coldLead: 0,
      others: 0,
    };

    // Process applications in one pass
    applications.forEach((app) => {
      // Calculate payments only for paid applications
      if (app.paid) {
        paidApplications++;
        let paidAmount = 0;
        if (app.partialScheme) {
          if (app.full_paid) {
            // When partial scheme and full paid, use the full price
            const price = parseFloat(app.price.replace(",", "")) || 0;
            paidAmount = price;
            totalPaymentsWithPartial += price;
          } else {
            // When partial scheme and not full paid, use the amount paid
            const amountPaid = parseFloat(app.amount_paid) || 0;
            paidAmount = amountPaid;
            totalPaymentsWithPartial += amountPaid;
          }
        } else {
          // When not a partial scheme, use the full price
          const price = parseFloat(app.price.replace(",", "")) || 0;
          paidAmount = price;
          totalPaymentsWithoutPartial += price;
        }
        totalPayments += paidAmount;
      }
      if (app.partialScheme && !app.full_paid) {
        const fullPrice = parseFloat(app.price.replace(",", "")) || 0;
        const amountPaid = parseFloat(app.amount_paid) || 0;
        totalRemainingPaymentsINPartial += fullPrice - amountPaid;
      }
      // Count certificate generated statuses
      if (
        app.currentStatus === "Certificate Generated" ||
        app.currentStatus === "Dispatched" ||
        app.currentStatus === "Completed"
      ) {
        certificatesGenerated++;
      }

      // Count RTO applications
      if (app.currentStatus === "Sent to RTO") {
        rtoApplications++;
      }

      // Count pending payments (applications not paid and not rejected)
      if (!app.paid && app.currentStatus !== "Rejected") {
        pendingPayments++;
      }

      // Tally up color statuses
      switch (app.color) {
        case "red":
          colorStatusCount.hotLead++;
          break;
        case "orange":
          colorStatusCount.warmLead++;
          break;
        case "gray":
          colorStatusCount.coldLead++;
          break;
        default:
          colorStatusCount.others++;
          break;
      }
    });

    // Process users in one pass to count customers and agents
    let totalCustomers = 0;
    let totalAgents = 0;
    usersDocs.forEach((doc) => {
      const user = doc.data();
      if (user.role === "customer") {
        totalCustomers++;
      }
      if (user.type === "agent") {
        totalAgents++;
      }
    });

    // If the user type is "general", override payment details to zero
    if (type === "general") {
      totalPayments = 0;
      totalPaymentsWithPartial = 0;
      totalPaymentsWithoutPartial = 0;
    }
    const completedApplications = applications.filter(
      (app) => app.currentStatus === "Certificate Generated"
    ).length;

    const conversionRate = totalApplications
      ? ((paidApplications / totalApplications) * 100).toFixed(1)
      : 0;

    const completionRate = totalApplications
      ? ((completedApplications / totalApplications) * 100).toFixed(1)
      : 0;

    // Return the computed statistics
    return res.status(200).json({
      totalApplications,
      totalPayments,
      totalPaymentsWithPartial,
      totalPaymentsWithoutPartial:
        type === "general" ? 0 : totalRemainingPaymentsINPartial,
      paidApplications,
      certificatesGenerated,
      rtoApplications,
      pendingPayments,
      totalCustomers,
      totalAgents,
      colorStatusCount,
      conversionRate,
      completionRate,
    });
  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    return res.status(500).json({ message: error.message });
  }
};

//get charts data
const getChartData = async (req, res) => {
  try {
    const userId = req.params.id;
    const agentFilter = req.query.agentId; // Get agent filter from query params

    // Get the user document
    const userDocSnap = await db.collection("users").doc(userId).get();
    if (!userDocSnap.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch applications
    const applicationsSnapshot = await db.collection("applications").get();
    let applicationsDocs = applicationsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const isfSnapshot = await db.collection("initialScreeningForms").get();
    const initialScreeningForms = {};
    isfSnapshot.docs.forEach((doc) => {
      initialScreeningForms[doc.id] = doc.data();
    });

    // Apply agent filter if provided
    if (agentFilter && agentFilter !== "reset") {
      applicationsDocs = applicationsDocs.filter(
        (app) => app.assignedAdmin === agentFilter
      );
    }

    // Process chart data
    const chartsData = processChartsData(
      applicationsDocs,
      initialScreeningForms
    );

    return res.status(200).json({
      charts: {
        ...chartsData,
        colorStatusData: {
          labels: ["Hot Lead", "Warm Lead", "Cold Lead"],
          series: [
            (chartsData.colorStatusCount.hotLead /
              (chartsData.colorStatusCount.hotLead +
                chartsData.colorStatusCount.warmLead +
                chartsData.colorStatusCount.coldLead) || 0) * 100,
            (chartsData.colorStatusCount.warmLead /
              (chartsData.colorStatusCount.hotLead +
                chartsData.colorStatusCount.warmLead +
                chartsData.colorStatusCount.coldLead) || 0) * 100,
            (chartsData.colorStatusCount.coldLead /
              (chartsData.colorStatusCount.hotLead +
                chartsData.colorStatusCount.warmLead +
                chartsData.colorStatusCount.coldLead) || 0) * 100,
          ],
          numbers: [
            chartsData.colorStatusCount.hotLead,
            chartsData.colorStatusCount.warmLead,
            chartsData.colorStatusCount.coldLead,
          ],
        },
      },
    });
  } catch (error) {
    console.error("Error getting chart data:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Complete chart processing function to match frontend components
const processChartsData = (applications, initialScreeningForms) => {
  // Weekly Data
  const weeklyData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    series: [
      { name: "Paid", data: new Array(7).fill(0) },
      { name: "Pending", data: new Array(7).fill(0) },
    ],
  };

  // Status Data
  const statusData = {
    labels: [
      "Student Intake Form",
      "Upload Documents",
      "Sent to RTO",
      "Waiting for Verification",
      "Certificate Generated",
      "Assessed",
    ],
    series: new Array(6).fill(0),
  };

  // Funnel Data with fill colors
  const funnelOrder = [
    "Student Intake Form",
    "Upload Documents",
    "Sent to RTO",
    "Waiting for Verification",
    "Certificate Generated",
  ];
  const funnelColors = ["#064e3b", "#065f46", "#047857", "#059669", "#10b981"];
  const funnelData = funnelOrder.map((status, index) => ({
    name: status,
    count: 0,
    fill: funnelColors[index],
  }));

  // Qualifications Data
  const qualificationsData = {};

  // Color Status
  const colorStatusCount = { hotLead: 0, warmLead: 0, coldLead: 0, others: 0 };

  // Monthly Trends
  const monthlyTrends = {};

  applications.forEach((app) => {
    // Weekly processing
    if (app.status?.[0]?.time) {
      const date = new Date(app.status[0].time);
      const dayIndex = (date.getDay() + 6) % 7;
      const seriesIndex = app.paid ? 0 : 1;
      weeklyData.series[seriesIndex].data[dayIndex]++;
    }

    // Status processing
    const status = getApplicationStatus(app);
    switch (status) {
      case "Student Intake Form":
      case "Student Intake Form Pending":
        statusData.series[0]++;
        break;
      case "Documents Pending":
        statusData.series[1]++;
        break;
      case "Waiting Assessment":
        statusData.series[3]++;
        break;
      case "Assessed":
        statusData.series[5]++;
        break;
      case "Sent to RTO":
        statusData.series[2]++;
        break;
      case "Certificate Generated":
        statusData.series[4]++;
        break;
    }

    // Funnel processing
    const funnelIndex = funnelOrder.indexOf(app.currentStatus);
    if (funnelIndex > -1) funnelData[funnelIndex].count++;

    // Qualifications processing
    const isf = initialScreeningForms[app.initialFormId];
    const qual = isf?.lookingForWhatQualification || "Unknown";
    qualificationsData[qual] = (qualificationsData[qual] || 0) + 1;
    // Color status processing
    switch (app.color) {
      case "red":
        colorStatusCount.hotLead++;
        break;
      case "orange":
        colorStatusCount.warmLead++;
        break;
      case "gray":
        colorStatusCount.coldLead++;
        break;
      default:
        colorStatusCount.others++;
        break;
    }

    // Monthly trends processing
    if (app.status?.[0]?.time) {
      const date = new Date(app.status[0].time);
      const monthKey = `${date.toLocaleString("default", {
        month: "short",
      })} ${date.getFullYear()}`;
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { applications: 0, revenue: 0 };
      }
      monthlyTrends[monthKey].applications++;

      // Revenue calculation
      let revenue = 0;
      if (app.full_paid) {
        revenue = parseFloat(app.amount_paid) || 0;
      } else if (app.partialScheme) {
        revenue =
          (parseFloat(app.payment1) || 0) + (parseFloat(app.payment2) || 0);
      }
      monthlyTrends[monthKey].revenue += revenue;
    }
  });

  // Process qualifications into top 5
  const topQualifications = Object.entries(qualificationsData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  // Process monthly trends into array
  const monthlyData = Object.entries(monthlyTrends)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => new Date(`1 ${a.month}`) - new Date(`1 ${b.month}`));

  return {
    weeklyData,
    statusData: { series: statusData.series, labels: statusData.labels },
    funnelData: funnelData.filter((d) => d.count > 0),
    topQualifications,
    colorStatusCount,
    monthlyTrends: monthlyData,
  };
};

// Helper function to mirror frontend status calculation
function getApplicationStatus(app) {
  if (app.currentStatus === "Certificate Generated")
    return "Certificate Generated";
  if (app.currentStatus === "Sent to RTO") return "Sent to RTO";
  if (app.assessed) return "Assessed";

  const hasForm = app.studentIntakeFormSubmitted;
  const hasDocs = app.documentsUploaded;
  const hasPaid = app.full_paid;

  if (hasForm && hasDocs && hasPaid) return "Waiting Assessment";
  if (hasForm && hasDocs) return "Payment Pending";
  if (hasForm && hasPaid) return "Documents Pending";
  if (hasForm) return "Student Intake Form";
  if (hasPaid && !hasForm) return "Student Intake Form Pending";
  return "Not Started";
}
// charts functions end

// const getDashboardStats = async (req, res) => {
//   try {
//     //get user id from the params of the request
//     const userId = req.params.id;

//     // Get the user document
//     const userDoc = await db.collection("users").doc(userId).get();
//     let type;

//     if (userDoc.data().role === "admin") {
//       type = userDoc.data().type;
//     }

//     // Check if the user exists
//     if (!userDoc.exists) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Check if the user is an admin

//     // Get all applications
//     const applicationsSnapshot = await db.collection("applications").get();
//     const applications = applicationsSnapshot.docs.map((doc) => doc.data());

//     // Get all users
//     const usersSnapshot = await db.collection("users").get();
//     const users = usersSnapshot.docs.map((doc) => doc.data());

//     // Calculate stats
//     const totalApplications = applications.length;

//     // Calculate total payments (sum of all prices where payment is completed)
//     const totalPayments = applications
//       .filter((app) => app.paid)
//       .reduce((sum, app) => {
//         let price = app.partialScheme
//           ? app.full_paid
//             ? app.price.replace(",", "")
//             : app.amount_paid
//           : app.price.replace(",", "");
//         //filter out NaNs
//         price = isNaN(price) ? 0 : parseFloat(price);
//         return sum + price;
//       }, 0);

//     const totalPaymentsWithPartial = applications
//       .filter((app) => app.paid && app.partialScheme)
//       .reduce((sum, app) => {
//         let price = app.full_paid
//           ? app.price.replace(",", "")
//           : app.amount_paid;
//         //filter out NaNs
//         price = isNaN(price) ? 0 : parseFloat(price);
//         return sum + price;
//       }, 0);

//     const totalPaymentsWithoutPartial = applications
//       .filter((app) => app.paid && !app.partialScheme)
//       .reduce((sum, app) => {
//         let price = app.price.replace(",", "");
//         //filter out NaNs
//         price = isNaN(price) ? 0 : parseFloat(price);
//         return sum + price;
//       }, 0);

//     const totalRemainingPaymentsINPartial = applications
//       .filter((app) => app.partialScheme && !app.full_paid)
//       .reduce((sum, app) => {
//         let price = app.price.replace(",", "") - app.amount_paid;
//         //filter out NaNs
//         price = isNaN(price) ? 0 : parseFloat(price);
//         return sum + price;
//       }, 0);

//     // Count paid applications
//     const paidApplications = applications.filter((app) => app.paid).length;

//     // Count certificates generated
//     const certificatesGenerated = applications.filter(
//       (app) =>
//         app.currentStatus === "Certificate Generated" ||
//         app.currentStatus === "Dispatched" ||
//         app.currentStatus === "Completed"
//     ).length;

//     // Count RTO applications
//     const rtoApplications = applications.filter(
//       (app) => app.currentStatus === "Sent to RTO"
//     ).length;

//     // Count pending payments
//     const pendingPayments = applications.filter(
//       (app) => !app.paid && app.currentStatus !== "Rejected"
//     ).length;

//     // Count total customers (users with role 'customer')
//     const totalCustomers = users.filter(
//       (user) => user.role === "customer"
//     ).length;

//     // Count total agents
//     const totalAgents = users.filter((user) => user.type === "agent").length;

//     const colorStatusCount = {
//       hotLead: applications.filter((app) => app.color === "red").length,
//       warmLead: applications.filter((app) => app.color === "orange").length,
//       coldLead: applications.filter((app) => app.color === "gray").length,
//       others: applications.filter(
//         (app) =>
//           app.color !== "red" && app.color !== "orange" && app.color !== "gray"
//       ).length,
//     };

//     return res.status(200).json({
//       totalApplications,
//       totalPayments: type === "general" ? 0 : totalPayments,
//       totalPaymentsWithPartial:
//         type === "general" ? 0 : totalPaymentsWithPartial,
//       totalPaymentsWithoutPartial:
//         type === "general" ? 0 : totalRemainingPaymentsINPartial,
//       paidApplications,
//       certificatesGenerated,
//       rtoApplications,
//       pendingPayments,
//       totalCustomers,
//       totalAgents,
//       colorStatusCount,
//     });
//   } catch (error) {
//     console.error("Error getting dashboard stats:", error);
//     res.status(500).json({ message: error.message });
//   }
// };
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
  getChartData,
  updateAutoDebit,
  getStudentApplications,
  getPaginatedApplications,
  getApplicationsStats,
  getPaymentStats,
  getPaginatedPayments,
  getAssessedApplications,
  getAssessorPendingApplications,
};
