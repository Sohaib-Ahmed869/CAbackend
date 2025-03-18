require("dotenv").config();
const express = require("express");
const cron = require("node-cron");
const { db } = require("./firebase");
const { sendEmail } = require("./emailUtil");
const moment = require("moment");

const app = express();
const PORT = process.env.PORT || 5000;

// Function to check deadlines and send reminders
const checkAndSendReminders = async () => {
  try {
    console.log("🔄 Running Payment Reminder Cron Job...");

    // Fetch applications where deadline exists and full payment is not made
    const applicationsSnapshot = await db.collection("applications").get();
    const now = moment().startOf("day");

    for (const doc of applicationsSnapshot.docs) {
      const application = doc.data();
      const {
        payment2Deadline,
        full_paid,
        userId,
        applicationId,
        price,
        amount_paid,
      } = application;

      if (!payment2Deadline || full_paid) continue; // Skip if no deadline or already paid

      const deadline = moment(payment2Deadline, "YYYY-MM-DD").startOf("day");
      const daysLeft = deadline.diff(now, "days");

      // Determine reminder type
      let reminderType = null;
      if ([10, 5, 3, 1].includes(daysLeft)) {
        reminderType = `Reminder: ${daysLeft} days left to pay`;
      } else if (daysLeft < 0) {
        reminderType = "Overdue: Payment is pending";
      }

      if (reminderType) {
        // 🔹 Fetch user email from "users" collection using userId
        const userRef = await db.collection("users").doc(userId).get();
        const userEmail = userRef.exists ? userRef.data().email : null;

        if (userEmail) {
          // 🔹 Prepare email content
          const subject = `Payment Reminder for Application ${applicationId}`;
          const body = `
            <p>Dear Applicant,</p>
            <p>Your application <b>${applicationId}</b> has a pending payment.</p>
            <p>${reminderType}. Please complete your payment before the deadline.</p>
            <p><b>Amount Due:</b> ${price - amount_paid}</p>
            <p><b>Deadline:</b> ${payment2Deadline}</p>
            <p>Regards,</p>
            <p>Certified Australia Team</p>
          `;

          // 🔹 Send email
          await sendEmail(userEmail, body, subject);
          console.log(
            `✅ Email sent to ${userEmail} for Application ${applicationId}`
          );
        } else {
          console.log(`⚠ No email found for userId: ${userId}`);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error checking payment reminders:", error);
  }
};

// 🔹 Schedule the cron job to run every day at 9 AM
cron.schedule("0 9 * * *", checkAndSendReminders, {
  timezone: "Australia/Sydney",
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
