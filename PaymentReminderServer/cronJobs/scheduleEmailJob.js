const generateEmailBody = require("../utils/generateEmailBody");
const schedule = require("node-schedule");
const { db } = require("../config/firebase");
const { sendEmail } = require("../utils/emailUtil");
const moment = require("moment");

const scheduleEmailJob = async (application, docRef, now, activeJobs) => {
  const {
    id: applicationId,
    applicationId: appId,
    payment2Deadline,
    payment2DeadlineTime,
    userId,
    price,
    amount_paid,
    paymentReminderEmailSentOn,
    full_paid,
  } = application;

  try {
    if (full_paid) {
      console.log(`💰 Application ${appId} is fully paid, skipping email`);
      return false;
    }

    // Calculate days left logic from old code
    const deadlineDate = moment(payment2Deadline, "YYYY-MM-DD").startOf("day");
    const daysLeft = deadlineDate.diff(moment().startOf("day"), "days");

    let reminderType = null;
    if (daysLeft > 0) {
      reminderType = `Reminder: ${daysLeft} days left to pay`;
    } else if (daysLeft === 0) {
      reminderType = "Reminder: Your Payment is due today";
    } else {
      reminderType = `Overdue: Payment is pending (${Math.abs(daysLeft)} ${
        Math.abs(daysLeft) > 1 ? "days" : "day"
      } overdue)`;
    }

    // Check if email already sent today
    const nowDate = moment().format("YYYY-MM-DD");
    if (paymentReminderEmailSentOn === nowDate) {
      console.log(`📭 Email already sent today for ${appId}`);
      return false;
    }

    // Determine scheduled time (from original cron logic)
    // const scheduledTime = moment(
    //   `${payment2Deadline} ${payment2DeadlineTime}`,
    //   "YYYY-MM-DD hh:mm A"
    // );
    const scheduledTime = moment
      .tz(
        `${payment2Deadline} ${payment2DeadlineTime}`,
        "YYYY-MM-DD hh:mm A",
        "Asia/Karachi" // User's local timezone
      )
      .utc();
    // Schedule behavior from original cron implementation
    if (now.isSameOrAfter(scheduledTime)) {
      // Immediate send if within 24h window
      if (now.diff(scheduledTime, "minutes") <= 1440) {
        console.log(`⏰ Sending immediate email for ${appId}`);
        await sendReminderEmail();
        return true;
      }
      console.log(`⏳ Skipping ${appId} (over 24h overdue)`);
      return false;
    }

    // Schedule future job
    console.log(
      `📅 Scheduling email for ${appId} at ${scheduledTime.format()}`
    );
    const job = schedule.scheduleJob(scheduledTime.toDate(), async () => {
      await sendReminderEmail();
    });

    // Track job and update Firestore
    activeJobs.set(`email-${applicationId}`, job);
    await docRef.update({
      "scheduledJobs.email": "pending",
      "scheduledJobs.emailTime": scheduledTime.toISOString(),
    });
    return true;

    async function sendReminderEmail() {
      try {
        const user = await db.collection("users").doc(userId).get();
        const email = user.data()?.email;

        if (!email) {
          console.error(`⚠️ No email found for user ${userId}`);
          return;
        }

        const body = await generateEmailBody({
          applicationId: appId,
          price,
          amount_paid,
          deadline: payment2Deadline,
          reminderType,
          userId,
        });

        await sendEmail(
          email,
          body,
          `Payment Reminder for Application ${appId}`
        );

        await docRef.update({
          paymentReminderEmailSentOn: nowDate,
          "scheduledJobs.email": "completed",
        });

        console.log(`✅ Email sent to ${email} for ${appId}`);
      } catch (err) {
        console.error(`❌ Email failed for ${appId}:`, err);
        await docRef.update({
          "scheduledJobs.email": "failed",
          "scheduledJobs.emailError": err.message,
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error processing ${appId}:`, error);
    return false;
  }
};

module.exports = scheduleEmailJob;
