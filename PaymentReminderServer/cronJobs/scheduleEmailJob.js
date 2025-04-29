const generateEmailBody = require("../utils/generateEmailBody");
const schedule = require("node-schedule");
const { db } = require("../config/firebase");
const { sendEmail } = require("../utils/emailUtil");
const moment = require("moment-timezone");
const { TIME_ZONES } = require("../utils/timeZoneconstants");

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
    scheduledJobs = {},
  } = application;

  try {
    if (full_paid) {
      console.log(
        `💰 Application ${appId || applicationId} is fully paid, skipping email`
      );
      return false;
    }

    // Always cancel existing job before rescheduling
    if (activeJobs.has(`email-${applicationId}`)) {
      const existingJob = activeJobs.get(`email-${applicationId}`);
      existingJob.cancel();
      activeJobs.delete(`email-${applicationId}`);
      console.log(`🔄 Cancelled existing email job for ${applicationId}`);
    }

    // Parse deadline with explicit timezone
    const deadlineDate = moment
      .tz(payment2Deadline, "YYYY-MM-DD", TIME_ZONES.DEFAULT)
      .startOf("day");
    const deadlineTime = moment.tz(
      `${payment2Deadline} ${payment2DeadlineTime}`,
      "YYYY-MM-DD hh:mm A",
      TIME_ZONES.DEFAULT
    );

    // Calculate days left using consistent timezone handling
    const nowInLocalTZ = moment().tz(TIME_ZONES.DEFAULT);
    const daysLeft = deadlineDate.diff(
      nowInLocalTZ.clone().startOf("day"),
      "days"
    );

    // Check if we're more than 24 hours past the deadline
    const isMoreThan24HoursPastDeadline = nowInLocalTZ.isAfter(
      deadlineTime.clone().add(24, "hours")
    );

    if (isMoreThan24HoursPastDeadline) {
      console.log(
        `⏰ More than 24 hours past deadline for ${
          appId || applicationId
        }, no more emails will be sent`
      );
      await docRef.update({
        "scheduledJobs.email": "completed",
        "scheduledJobs.emailCompleteReason": "past_deadline",
      });
      return false;
    }

    // Determine reminder type based on days remaining
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

    // Check if email already sent today - use consistent timezone
    const todayDate = nowInLocalTZ.format("YYYY-MM-DD");
    if (paymentReminderEmailSentOn === todayDate) {
      console.log(`📭 Email already sent today for ${appId || applicationId}`);
      await scheduleNextDayEmail();
      return false;
    }

    // Handle existing scheduled jobs from Firestore
    let scheduledTime;
    if (scheduledJobs.emailTime) {
      // Reinitialize existing scheduled time from Firestore
      scheduledTime = moment.utc(scheduledJobs.emailTime);
      console.log(
        `♻️ Reinitializing existing email job for ${
          appId || applicationId
        } at ${scheduledTime.format("YYYY-MM-DD HH:mm:ss")} UTC`
      );
    } else {
      // Calculate new scheduled time
      const initialScheduledTime = moment
        .tz(
          `${payment2Deadline} ${payment2DeadlineTime}`,
          "YYYY-MM-DD hh:mm A",
          TIME_ZONES.DEFAULT
        )
        .utc();

      const nowUTC = moment().utc();
      scheduledTime =
        nowUTC.isAfter(initialScheduledTime) || daysLeft <= 0
          ? nowUTC.clone().add(1, "minute")
          : initialScheduledTime;
    }

    console.log(
      `📅 Final scheduling for ${
        appId || applicationId
      } at ${scheduledTime.format("YYYY-MM-DD HH:mm:ss")} UTC`
    );

    // Schedule the email job
    const job = schedule.scheduleJob(scheduledTime.toDate(), async () => {
      console.log(
        `🚀 EXECUTING email job for application ${appId || applicationId}`
      );
      await sendReminderEmail();
      activeJobs.delete(`email-${applicationId}`);
      await scheduleNextDayEmail();
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
          applicationId: appId || applicationId,
          price,
          amount_paid,
          deadline: payment2Deadline,
          reminderType,
          userId,
        });

        await sendEmail(
          email,
          body,
          `Payment Reminder for Application ${appId || applicationId}`
        );

        await docRef.update({
          paymentReminderEmailSentOn: todayDate,
          "scheduledJobs.email": "completed",
          "scheduledJobs.lastEmailSent": new Date().toISOString(),
        });

        console.log(`✅ Email sent to ${email} for ${appId || applicationId}`);
      } catch (err) {
        console.error(`❌ Email failed for ${appId || applicationId}:`, err);
        await docRef.update({
          "scheduledJobs.email": "failed",
          "scheduledJobs.emailError": err.message,
          "scheduledJobs.emailFailedAt": new Date().toISOString(),
        });
      }
    }

    async function scheduleNextDayEmail() {
      if (isMoreThan24HoursPastDeadline) return;

      const tomorrow = nowInLocalTZ.clone().add(1, "day").startOf("day");
      const emailTime = moment.tz(
        `${tomorrow.format("YYYY-MM-DD")} ${payment2DeadlineTime}`,
        "YYYY-MM-DD hh:mm A",
        TIME_ZONES.DEFAULT
      );

      const nextEmailTimeUTC = emailTime.clone().utc();

      console.log(
        `📅 Scheduling next email for ${
          appId || applicationId
        } at ${nextEmailTimeUTC.format("YYYY-MM-DD HH:mm:ss")} UTC`
      );

      const nextDayJob = schedule.scheduleJob(
        nextEmailTimeUTC.toDate(),
        async () => {
          const freshDoc = await db
            .collection("applications")
            .doc(applicationId)
            .get();
          const freshApp = freshDoc.data();

          if (freshApp.full_paid) {
            console.log(`💰 Application now paid, skipping email`);
            activeJobs.delete(`email-${applicationId}`);
            return;
          }

          try {
            const user = await db.collection("users").doc(userId).get();
            const email = user.data()?.email;
            const newReminderType = calculateReminderType(freshApp);

            const body = await generateEmailBody({
              applicationId: appId || applicationId,
              price: freshApp.price,
              amount_paid: freshApp.amount_paid,
              deadline: freshApp.payment2Deadline,
              reminderType: newReminderType,
              userId,
            });

            await sendEmail(
              email,
              body,
              `Payment Reminder for Application ${appId || applicationId}`
            );

            const newTodayDate = moment()
              .tz(TIME_ZONES.DEFAULT)
              .format("YYYY-MM-DD");
            await freshDoc.ref.update({
              paymentReminderEmailSentOn: newTodayDate,
              "scheduledJobs.email": "completed",
              "scheduledJobs.lastEmailSent": new Date().toISOString(),
            });

            console.log(`✅ Next day email sent`);
            activeJobs.delete(`email-${applicationId}`);
            await scheduleEmailJob(
              freshApp,
              freshDoc.ref,
              moment().utc(),
              activeJobs
            );
          } catch (err) {
            console.error(`❌ Next day email failed:`, err);
            await freshDoc.ref.update({
              "scheduledJobs.email": "failed",
              "scheduledJobs.emailError": err.message,
              "scheduledJobs.emailFailedAt": new Date().toISOString(),
            });
          }
        }
      );

      activeJobs.set(`email-${applicationId}`, nextDayJob);
      await docRef.update({
        "scheduledJobs.email": "pending",
        "scheduledJobs.emailTime": nextEmailTimeUTC.toISOString(),
      });
    }

    function calculateReminderType(app) {
      const freshDeadlineDate = moment
        .tz(app.payment2Deadline, "YYYY-MM-DD", TIME_ZONES.DEFAULT)
        .startOf("day");
      const freshNow = moment().tz(TIME_ZONES.DEFAULT).startOf("day");
      const freshDaysLeft = freshDeadlineDate.diff(freshNow, "days");

      if (freshDaysLeft > 0)
        return `Reminder: ${freshDaysLeft} days left to pay`;
      if (freshDaysLeft === 0) return "Reminder: Your Payment is due today";
      return `Overdue: Payment is pending (${Math.abs(freshDaysLeft)} ${
        Math.abs(freshDaysLeft) > 1 ? "days" : "day"
      } overdue)`;
    }
  } catch (error) {
    console.error(`❌ Error processing ${appId || applicationId}:`, error);
    return false;
  }
};

module.exports = scheduleEmailJob;
