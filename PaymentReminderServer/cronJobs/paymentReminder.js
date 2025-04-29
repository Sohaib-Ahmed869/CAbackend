const cron = require("node-cron");
const { db } = require("../config/firebase");
const moment = require("moment-timezone");
const schedulePaymentJob = require("./schedulePaymentJob");
const scheduleEmailJob = require("./scheduleEmailJob");
const cancelJobs = require("./cancelJobs");

// Import time zone constants
const { TIME_ZONES } = require("../utils/timeZoneconstants");

// Store active jobs in memory
const activeJobs = new Map();

const schedulePaymentReminders = async () => {
  try {
    console.log("🔄 Initializing scheduled jobs...");
    const startTime = Date.now();

    // Detect changes
    const applicationsRef = db.collection("applications");

    const observer = applicationsRef
      .where("autoDebit.enabled", "==", true)
      .onSnapshot(async (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "modified") {
            const app = change.doc.data();
            console.log(
              `⚡ Real-time update detected for ${app.applicationId}`
            );
            await handleAutoDebitUpdate(app, activeJobs);
          }
        });
      });

    // Get all applications
    const applicationsSnapshot = await db.collection("applications").get();
    console.log(
      `📊 Found ${applicationsSnapshot.size} applications to process`
    );
    const now = moment().utc(); // Ensure 'now' is UTC for consistent comparisons

    let emailsScheduled = 0;
    let paymentsScheduled = 0;
    let jobsCancelled = 0;
    let skipped = 0;
    let timeConflictsFixed = 0;

    for (const doc of applicationsSnapshot.docs) {
      const application = doc.data();
      const {
        id: applicationId,
        applicationId: appId,
        payment2Deadline,
        payment2DeadlineTime,
        full_paid,
        userId,
        autoDebit = {},
        scheduledJobs = {},
      } = application;

      console.log(`\n🔍 Processing application ${appId || applicationId}`);

      if (full_paid) {
        console.log(
          `💰 Application ${
            appId || applicationId
          } is fully paid, cancelling jobs`
        );
        cancelJobs(applicationId, activeJobs);
        jobsCancelled++;
        continue;
      }

      if (autoDebit?.dueDate && scheduledJobs?.paymentTime) {
        // Consistently parse both dates as UTC for comparison
        const dueDateFromAutoDebit = moment.utc(autoDebit.dueDate.toDate());
        const dueDateFromScheduled = moment.utc(scheduledJobs.paymentTime);

        if (
          Math.abs(dueDateFromAutoDebit.diff(dueDateFromScheduled, "minutes")) >
          1
        ) {
          console.log(
            `⚠️ TIME CONFLICT DETECTED for ${appId || applicationId}:`
          );
          console.log(
            `   - autoDebit.dueDate: ${dueDateFromAutoDebit.format(
              "YYYY-MM-DD HH:mm:ss"
            )} UTC`
          );
          console.log(
            `   - scheduledJobs.paymentTime: ${dueDateFromScheduled.format(
              "YYYY-MM-DD HH:mm:ss"
            )} UTC`
          );
          console.log(
            `   - Local time (${TIME_ZONES.DEFAULT}): ${dueDateFromAutoDebit
              .clone()
              .tz(TIME_ZONES.DEFAULT)
              .format("YYYY-MM-DD HH:mm:ss")}`
          );

          console.log(`🔄 Cancelling job with incorrect time`);
          cancelJobs(applicationId, activeJobs);

          await doc.ref.update({
            "scheduledJobs.payment": null,
            "scheduledJobs.paymentTime": null,
          });
          console.log(`🔄 Reset scheduled job status to force rescheduling`);
          timeConflictsFixed++;
        }
      }

      // Existing code...
      if (payment2Deadline && payment2DeadlineTime) {
        // Always attempt to schedule/reschedule emails even if job exists
        const scheduledTime = moment
          .tz(
            `${payment2Deadline} ${payment2DeadlineTime}`,
            "YYYY-MM-DD hh:mm A",
            TIME_ZONES.DEFAULT
          )
          .utc();

        // Check if existing job needs recreation
        if (scheduledJobs.email === "pending" && scheduledJobs.emailTime) {
          const storedTime = moment.utc(scheduledJobs.emailTime);
          if (storedTime.isAfter(now)) {
            // Future job needs recreation
            console.log(
              `🔁 Reinitializing email job for ${appId || applicationId}`
            );
            scheduleEmailJob(application, doc.ref, now, activeJobs);
          }
        } else {
          // Proceed to schedule new email job if conditions met
          if (scheduleEmailJob(application, doc.ref, now, activeJobs)) {
            emailsScheduled++;
          } else {
            skipped++;
          }
        }
      } else {
        if (!payment2Deadline || !payment2DeadlineTime) {
          console.log(`⚠️ Missing deadline info for ${appId || applicationId}`);
        } else if (scheduledJobs?.email) {
          console.log(
            `📝 Email job already exists: ${scheduledJobs.email} at ${
              scheduledJobs.emailTime
                ? moment
                    .utc(scheduledJobs.emailTime)
                    .format("YYYY-MM-DD HH:mm:ss") + " UTC"
                : "unknown time"
            }`
          );
        }
      }

      // In schedulePaymentReminders function:
      if (
        autoDebit.enabled &&
        (autoDebit.status === "SCHEDULED" || autoDebit.status === "FAILED")
      ) {
        // Check if we need to reinitialize from Firestore
        if (scheduledJobs.payment === "pending" && scheduledJobs.paymentTime) {
          const storedTime = moment.utc(scheduledJobs.paymentTime);
          if (storedTime.isAfter(now)) {
            console.log(
              `♻️ Reinitializing payment job for ${appId || applicationId}`
            );
            schedulePaymentJob(application, doc.ref, now, activeJobs);
          }
        } else {
          if (schedulePaymentJob(application, doc.ref, now, activeJobs)) {
            paymentsScheduled++;
          } else {
            skipped++;
          }
        }
      } else {
        if (!autoDebit.enabled) {
          console.log(
            `ℹ️ Auto debit not enabled for ${appId || applicationId}`
          );
        } else if (autoDebit.status !== "SCHEDULED") {
          console.log(
            `ℹ️ Auto debit status: ${autoDebit.status} for ${
              appId || applicationId
            }`
          );
        } else if (scheduledJobs?.payment) {
          console.log(
            `📝 Payment job already exists: ${scheduledJobs.payment} at ${
              scheduledJobs.paymentTime
                ? moment
                    .utc(scheduledJobs.paymentTime)
                    .format("YYYY-MM-DD HH:mm:ss") + " UTC"
                : "unknown time"
            }`
          );
          if (autoDebit?.dueDate) {
            const dueDateFromAutoDebit = moment.utc(autoDebit.dueDate.toDate());
            const scheduledTime = moment.utc(scheduledJobs.paymentTime);
            console.log(
              `   - Stored autoDebit time: ${dueDateFromAutoDebit.format(
                "YYYY-MM-DD HH:mm:ss"
              )} UTC`
            );
            console.log(
              `   - Scheduled job time: ${scheduledTime.format(
                "YYYY-MM-DD HH:mm:ss"
              )} UTC`
            );
            console.log(
              `   - Local time (${TIME_ZONES.DEFAULT}): ${dueDateFromAutoDebit
                .clone()
                .tz(TIME_ZONES.DEFAULT)
                .format("YYYY-MM-DD HH:mm:ss")}`
            );
          }
        }
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Scheduling complete in ${duration.toFixed(2)}s`);
    console.log(
      `📊 Summary: ${emailsScheduled} emails scheduled, ${paymentsScheduled} payments scheduled`
    );
    console.log(
      `📊 Changes: ${jobsCancelled} jobs cancelled, ${skipped} skipped, ${timeConflictsFixed} time conflicts fixed`
    );
    console.log(`🗂️ Total active jobs: ${activeJobs.size}`);

    console.log("\n📋 Active Jobs List:");
    activeJobs.forEach((job, key) => {
      const nextRun = job.nextInvocation()
        ? moment.utc(job.nextInvocation()).format("YYYY-MM-DD HH:mm:ss") +
          " UTC"
        : "unknown";
      console.log(`   - ${key}: Next run at ${nextRun}`);
    });
  } catch (error) {
    console.error("❌ Error initializing jobs:", error);
    console.error(error.stack);
  }
};

async function handleAutoDebitUpdate(application, activeJobs) {
  const docRef = db.collection("applications").doc(application.id);
  const now = moment().utc(); // Ensure 'now' is in UTC

  // Check if auto debit is enabled and scheduled
  if (
    application.autoDebit?.status === "SCHEDULED" &&
    application.autoDebit?.dueDate
  ) {
    // Check if job is already scheduled
    if (application.scheduledJobs?.paymentTime) {
      // Parse both as UTC for consistent comparison
      const dueDate = moment.utc(application.autoDebit.dueDate.toDate());
      const scheduledTime = moment.utc(application.scheduledJobs.paymentTime);

      // Only reschedule if times are different
      if (!dueDate.isSame(scheduledTime)) {
        console.log(
          `🔄 Rescheduling due to real-time update for ${application.applicationId}`
        );
        console.log(
          `   - New due date: ${dueDate.format("YYYY-MM-DD HH:mm:ss")} UTC`
        );
        console.log(
          `   - Old scheduled: ${scheduledTime.format(
            "YYYY-MM-DD HH:mm:ss"
          )} UTC`
        );

        // 1. Cancel existing job
        cancelJobs(application.id, activeJobs);

        // 2. Clear existing schedule data
        await docRef.update({
          "scheduledJobs.payment": null,
          "scheduledJobs.paymentTime": null,
        });

        // 3. Schedule new job with updated time
        await schedulePaymentJob(application, docRef, now, activeJobs);
      }
    } else {
      // No existing job - schedule new one
      console.log(`⏳ First-time scheduling for ${application.applicationId}`);
      await schedulePaymentJob(application, docRef, now, activeJobs);
    }
  } else {
    console.log(`ℹ️ Auto debit not scheduled for ${application.applicationId}`);
    cancelJobs(application.id, activeJobs);
  }
}

// Schedule the job to run every 5 minutes
const startDailyReminderScheduler = () => {
  cron.schedule("*/5 * * * *", async () => {
    console.log("\n⏰ Running job every 5 minutes...");
    await schedulePaymentReminders();
  });
};

module.exports = {
  schedulePaymentReminders,
  startDailyReminderScheduler,
};
