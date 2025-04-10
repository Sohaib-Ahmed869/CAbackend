require("dotenv").config();
const express = require("express");
const {
  schedulePaymentReminders,
  startDailyReminderScheduler,
} = require("./cronJobs/paymentReminder");
const app = express();
const PORT = process.env.PORT || 5001;

schedulePaymentReminders();
startDailyReminderScheduler();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
