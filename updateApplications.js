const admin = require("firebase-admin");
const { db } = require("./firebase"); // Import Firestore instance

async function updateApplications() {
  const applicationsRef = db.collection("applications");
  const snapshot = await applicationsRef.get();

  if (snapshot.empty) {
    console.log("No applications found.");
    return;
  }

  const batch = db.batch();

  const newApplicationStatus = [
    {
      statusname: "Student Intake Form",
      completed: false,
      time: new Date().toISOString(),
    },
    {
      statusname: "payment",
      installmentsApplied: false,
      paid: false,
      time: new Date().toISOString(),
    },
    {
      statusname: "documents uploaded",
      completed: false,
      time: new Date().toISOString(),
    },
    {
      statusname: "sent for verification",
      verified: false,
      time: new Date().toISOString(),
    },
    {
      statusname: "verified",
      verified: false,
      time: new Date().toISOString(),
    },
    {
      statusname: "completed",
      completed: false,
      time: new Date().toISOString(),
    },
  ];

  snapshot.forEach((doc) => {
    const appRef = applicationsRef.doc(doc.id);
    batch.update(appRef, { applicationStatus: newApplicationStatus });
  });

  await batch.commit();
  console.log(" Successfully updated all applications!");
}

// Run the script
updateApplications()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(" Error updating applications:", error);
    process.exit(1);
  });
