// jobs/applicationReminders.js
const { app } = require("firebase-admin");
const { db } = require("../firebase");
const applicationReminderService = require("../utils/applicationReminderService");

const sendApplicationReminders = async () => {
  console.log("🚀 Starting application reminder process...");

  try {
    const applications = await db.collection("applications").get();
    const { applicationId } = applications.docs[0].data();
    if (applications.empty) {
      console.log("✅ No applications found");
      return;
    }

    console.log(`📊 Processing ${applications.size} applications`);

    const results = {
      total: 0,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const doc of applications.docs) {
      results.total++;
      const id = doc.id;

      try {
        const result = await applicationReminderService.checkAndSendReminder(
          id
        );

        if (result.success) {
          console.log(`📨 Sent reminder for ${id}`);
          results.sent++;
        } else {
          console.log(`⏩ Skipped ${id}: ${result.message}`);
          results.skipped++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${id}:`, error.message);
        results.errors++;
      }
    }

    console.log(`
      📝 Final Report:
      ==========================
      Total Applications: ${results.total}
      Reminders Sent:     ${results.sent}
      Skipped:            ${results.skipped}
      Errors:             ${results.errors}
      ==========================
    `);
  } catch (error) {
    console.error("💥 Critical error in reminder process:", error);
  }
};

module.exports = { sendApplicationReminders };
