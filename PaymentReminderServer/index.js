require("dotenv").config();
const express = require("express");
// const { startPaymentReminderCron } = require("./cronJobs/paymentReminder");
const { schedulePaymentReminders } = require("./cronJobs/paymentReminder");
const app = express();
const PORT = process.env.PORT || 5001;
const cron = require("node-cron");

// Start Payment Reminder Cron Job
// startPaymentReminderCron();
schedulePaymentReminders();
cron.schedule("*/2 * * * *", async () => {
  await schedulePaymentReminders();
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
