const { db, auth } = require("../firebase");

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

    //get all documents and add to applications
    const documentsSnapshot = await db.collection("documents").get();
    const documents = documentsSnapshot.docs.map((doc) => doc.data());

    applications.forEach((application) => {
      const document = documents.find(
        (document) => document.id === application.documentsFormId
      );
      application.document = document;
    });

    res.status(200).json(applications);
  } catch (error) {
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
    });
    res.status(201).json({ userId: user.user.uid });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
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
    const applicationsSnapshot = await db.collection("applications").get();
    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    stats.totalApplications = applications.length;

    stats.applicationsPending = applications.filter(
      (application) => application.currentStatus === "Sent to RTO"
    ).length;
    stats.applicationsCompleted = applications.filter(
      (application) => application.currentStatus === "Certificate Generated"
    ).length;
    stats.rejectedApplications = applications.filter(
      (application) => application.currentStatus === "Rejected by RTO"
    ).length;

    const rtoSnapshot = await db
      .collection("users")
      .where("role", "==", "rto")
      .get();
    stats.totalRTOs = rtoSnapshot.docs.length;

    applications.map((application) => {
      let time = application.status[application.status.length - 1].time;
      let date = new Date(time);
      console.log(date);
    });

    const applicationsCompletedInLastWeek = applications.filter(
      (application) =>
        application.currentStatus === "Certificate Generated" &&
        new Date(application.status[application.status.length - 1].time) >=
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    stats.applicationsCompletedInLastWeek =
      applicationsCompletedInLastWeek.length;

    const applicationsCompletedInLastMonth = applications.filter(
      (application) =>
        application.currentStatus === "Certificate Generated" &&
        new Date(application.status[application.status.length - 1].time) >=
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );

    stats.applicationsCompletedInLastMonth =
      applicationsCompletedInLastMonth.length;

    res.status(200).json(stats);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getApplications, registerRTO, getDashboardStats };
