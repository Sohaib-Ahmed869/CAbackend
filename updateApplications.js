const admin = require("firebase-admin");
const { db } = require("./firebase"); // Import Firestore instance

async function updateApplications() {
  try {
    const applicationsRef = db.collection("initialScreeningForms");
    const snapshot = await applicationsRef.get();

    if (snapshot.empty) {
      console.log("❌ No applications found.");
      return;
    }

    const batch = db.batch();

    snapshot.forEach((doc) => {
      const appRef = applicationsRef.doc(doc.id);
      batch.update(appRef, { expense: 500 }); // ✅ Now it's a number, not a string
    });

    await batch.commit();
    console.log("✅ Successfully updated all applications!");
  } catch (error) {
    console.error("❌ Error updating applications:", error);
  }
}

// Run the script
updateApplications()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
