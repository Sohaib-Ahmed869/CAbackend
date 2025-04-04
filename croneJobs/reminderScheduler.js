// const cron = require("node-cron");
// const { sendReminders } = require("./sendReminders");

// // Function to start the scheduler
// const startReminderScheduler = () => {
//   console.log("✅ Scheduler initialized. Reminders will run at 8 AM daily.");

//   // Schedule cron job to run daily at 8 AM
//   cron.schedule("0 8 * * *", async () => {
//     console.log("⏳ Running Scheduled Reminder Job...");
//     await sendReminders();
//   });
// };

// module.exports = { startReminderScheduler };
const cron = require("node-cron");
const { sendApplicationReminders } = require("./NextStepReminder");

// Function to start the scheduler
const startReminderScheduler = () => {
  console.log(
    "✅ Scheduler initialized. Reminders will run every 100 minutes."
  );

  // Schedule cron job to run every 5 minutes
  cron.schedule("*/100 * * * *", async () => {
    console.log("⏳ Running Scheduled Reminder Job...");
    await sendApplicationReminders();
  });
};

module.exports = { startReminderScheduler };
