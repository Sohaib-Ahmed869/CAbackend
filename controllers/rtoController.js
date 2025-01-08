const { db, auth } = require("../firebase");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 20 });
const getApplications = async (req, res) => {
  try {
    // Fetch applications and related data in parallel
    const [
      applicationsSnapshot,
      initialScreeningFormsSnapshot,
      usersSnapshot,
      studentIntakeFormsSnapshot,
      documentsSnapshot,
    ] = await Promise.all([
      db.collection("applications").get(),
      db.collection("initialScreeningForms").get(),
      db.collection("users").get(),
      db.collection("studentIntakeForms").get(),
      db.collection("documents").get(),
    ]);

    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    // Create maps for quick lookups
    const initialScreeningForms = Object.fromEntries(
      initialScreeningFormsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const users = Object.fromEntries(
      usersSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const studentIntakeForms = Object.fromEntries(
      studentIntakeFormsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const documents = Object.fromEntries(
      documentsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );

    // Enrich applications with related data
    const enrichedApplications = applications.map((application) => ({
      ...application,
      isf: initialScreeningForms[application.initialFormId] || null,
      user: users[application.userId] || null,
      sif: studentIntakeForms[application.studentFormId] || null,
      document: documents[application.documentsFormId] || null,
    }));

    // Cache the enriched applications
    cache.set("applications", enrichedApplications);

    res.status(200).json(enrichedApplications);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const registerRTO = async (req, res) => {
  const { email, password, type } = req.body;
  console.log(email, password, type);
  try {
    const user = await auth.createUser({
      email,
      password,
    });
    await db.collection("users").doc(user.uid).set({
      email: email,
      role: "rto",
      type: type,
      id: user.uid,
    });
    res.status(201).json({ userId: user.uid });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  const cachedStats = cache.get("dashboardStats");
  if (cachedStats) {
    return res.status(200).json(cachedStats);
  }

  let stats = {
    totalApplications: 0,
    applicationsPending: 0,
    totalRTOs: 0,
    applicationsCompleted: 0,
    applicationsCompletedInLastWeek: 0,
    applicationsCompletedInLastMonth: 0,
    rejectedApplications: 0,
  };

  try {
    // Fetch all applications and RTO users in parallel
    const [applicationsSnapshot, rtoSnapshot] = await Promise.all([
      db.collection("applications").get(),
      db.collection("users").where("role", "==", "rto").get(),
    ]);

    const applications = applicationsSnapshot.docs.map((doc) => doc.data());
    stats.totalApplications = applications.length;
    stats.totalRTOs = rtoSnapshot.docs.length;

    // Process applications for various statuses
    applications.forEach((application) => {
      if (application.currentStatus === "Sent to RTO") {
        stats.applicationsPending++;
      } else if (application.currentStatus === "Certificate Generated") {
        stats.applicationsCompleted++;

        const completionDate = new Date(
          application.status[application.status.length - 1].time
        );
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        if (completionDate >= oneWeekAgo) {
          stats.applicationsCompletedInLastWeek++;
        }
        if (completionDate >= oneMonthAgo) {
          stats.applicationsCompletedInLastMonth++;
        }
      } else if (application.currentStatus === "Rejected by RTO") {
        stats.rejectedApplications++;
      }
    });

    // Cache the computed stats
    cache.set("dashboardStats", stats);

    res.status(200).json(stats);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getApplications, registerRTO, getDashboardStats };
