require("dotenv").config();
const express = require("express");
// const { startPaymentReminderCron } = require("./cronJobs/paymentReminder");
const { schedulePaymentReminders } = require("./cronJobs/paymentReminder");
const app = express();
const PORT = process.env.PORT || 5001;

// Start Payment Reminder Cron Job
// startPaymentReminderCron();
schedulePaymentReminders();
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
