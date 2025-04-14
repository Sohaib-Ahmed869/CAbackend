// const cron = require("node-cron");
// const { db } = require("../config/firebase");
// const { sendEmail } = require("../utils/emailUtil");
// const moment = require("moment");
// const generateEmailBody = require("../utils/generateEmailBody");
// const {
//   processScheduledPayment,
// } = require("../../controllers/applicationController");
// const schedulePaymentReminders = async () => {
//   try {
//     console.log("🔄 Fetching latest application data...");

//     const applicationsSnapshot = await db.collection("applications").get();
//     const nowDate = moment().format("YYYY-MM-DD");
//     const now = moment();
//     // const now = moment().tz('Australia/Sydney'); // Uncomment for production

//     for (const doc of applicationsSnapshot.docs) {
//       const application = doc.data();
//       const {
//         payment2Deadline,
//         payment2DeadlineTime,
//         full_paid,
//         userId,
//         applicationId,
//         id,
//         price,
//         amount_paid,
//         paymentReminderEmailSentOn,
//         autoDebit = {},
//       } = application;

//       if (!payment2Deadline || !payment2DeadlineTime || full_paid) continue;

//       const scheduledTime = moment(
//         `${payment2Deadline} ${payment2DeadlineTime}`,
//         "YYYY-MM-DD hh:mm A"
//       );

//       // Existing reminder logic
//       const deadlineDate = moment(payment2Deadline, "YYYY-MM-DD").startOf(
//         "day"
//       );
//       const daysLeft = deadlineDate.diff(moment().startOf("day"), "days");

//       let reminderType = null;
//       if (daysLeft > 0) {
//         reminderType = `Reminder: ${daysLeft} days left to pay`;
//       } else if (daysLeft === 0) {
//         reminderType = "Reminder: Your Payment is due ";
//       } else if (daysLeft < 0) {
//         reminderType = `Overdue: Payment is pending (${Math.abs(daysLeft)} ${
//           daysLeft > 1 ? "days" : "day"
//         } overdue)`;
//       }

//       if (paymentReminderEmailSentOn === nowDate) {
//         console.log(
//           `🔄 Skipping email for Application ${applicationId}, already sent today.`
//         );
//         continue;
//       }

//       if (reminderType) {
//         const userRef = await db.collection("users").doc(userId).get();
//         const userEmail = userRef.exists ? userRef.data().email : null;

//         if (userEmail) {
//           if (
//             now.isSameOrAfter(scheduledTime) &&
//             now.diff(scheduledTime, "minutes") <= 1440
//           ) {
//             const subject = `Payment Reminder for Application ${applicationId}`;
//             const body = await generateEmailBody({
//               applicationId,
//               price,
//               amount_paid,
//               deadline: payment2Deadline,
//               reminderType,
//               userId,
//             });

//             await sendEmail(userEmail, body, subject);
//             console.log(
//               `✅ Email sent to ${userEmail} for Application ${applicationId}`
//             );

//             await db.collection("applications").doc(doc.id).update({
//               paymentReminderEmailSentOn: nowDate,
//             });
//           } else if (now.isBefore(scheduledTime)) {
//             console.log(
//               `⏳ Email for ${userEmail} is scheduled at ${payment2DeadlineTime}`
//             );
//           } else {
//             console.log(
//               `⏳ Skipping: More than 24 hours have passed since overdue time for ${applicationId}`
//             );
//           }
//         }
//       }

//       // New direct debit processing logic
//       if (autoDebit.enabled && autoDebit.status === "SCHEDULED") {
//         const dueDate = autoDebit.dueDate
//           ? moment(autoDebit.dueDate.toDate())
//           : null;
//         // For production: moment(autoDebit.dueDate.toDate()).tz('Australia/Sydney')

//         if (autoDebit.amountDue <= 0) {
//           console.log("⚡ No amount due for direct debit");
//           await UpdateDebitStatus(id, "NO_AMOUNT_DUE");
//           continue;
//         }
//         const paymentStatusChecks = {
//           Payment2: application.full_paid,
//         };
//         if (paymentStatusChecks[autoDebit.selectedPayment]) {
//           console.log(`⚡ ${autoDebit.selectedPayment} already paid`);
//           await UpdateDebitStatus(id, "MANUALLY_PAID");
//           continue;
//         }

//         if (now.isSameOrAfter(dueDate)) {
//           try {
//             console.log(
//               `⚡ Processing payment for Application ${applicationId}`
//             );
//             await processScheduledPayment(id);
//           } catch (processError) {
//             console.error("❌ Payment processing failed:", processError);
//             await UpdateDebitStatus(id, "FAILED");
//           }
//         } else {
//           console.log(`⏳ Payment scheduled at ${scheduledTime.format()}`);
//           // await UpdateDebitStatus(id, "SCHEDULED");
//         }
//       }
//     }
//   } catch (error) {
//     console.error("❌ Error in cron job:", error);
//   }
// };

// // Run cron job every 5 minutes
// cron.schedule("*/5 * * * *", async () => {
//   await schedulePaymentReminders();
// });

// const UpdateDebitStatus = async (applicationId, status) => {
//   try {
//     await db.collection("applications").doc(applicationId).update({
//       "autoDebit.status": status,
//       "autoDebit.updatedAt": new Date().toISOString(),
//     });
//     console.log(`✅ Updated status for ${applicationId} to ${status}`);
//   } catch (error) {
//     console.error("❌ Error updating debit status:", error);
//     throw error; // Rethrow to handle in parent scope
//   }
// };
// module.exports = { schedulePaymentReminders, processScheduledPayment };

// const { db } = require("../config/firebase");
// const moment = require("moment");
// const schedulePaymentJob = require("./schedulePaymentJob");
// const scheduleEmailJob = require("./scheduleEmailJob");
// const cancelJobs = require("./cancelJobs");

// // Store active jobs in memory
// const activeJobs = new Map();

// const schedulePaymentReminders = async () => {
//   try {
//     console.log("🔄 Initializing scheduled jobs...");
//     const startTime = Date.now();

//     const applicationsSnapshot = await db.collection("applications").get();
//     console.log(
//       `📊 Found ${applicationsSnapshot.size} applications to process`
//     );
//     const now = moment();

//     let emailsScheduled = 0;
//     let paymentsScheduled = 0;
//     let jobsCancelled = 0;
//     let skipped = 0;
//     let timeConflictsFixed = 0;

//     for (const doc of applicationsSnapshot.docs) {
//       const application = doc.data();
//       const {
//         id: applicationId,
//         applicationId: appId, // User-facing ID
//         payment2Deadline,
//         payment2DeadlineTime,
//         full_paid,
//         userId,
//         autoDebit = {},
//         scheduledJobs = {},
//       } = application;

//       console.log(`\n🔍 Processing application ${appId || applicationId}`);

//       // Cleanup existing jobs if application is paid
//       if (full_paid) {
//         console.log(
//           `💰 Application ${
//             appId || applicationId
//           } is fully paid, cancelling jobs`
//         );
//         cancelJobs(applicationId, activeJobs);
//         jobsCancelled++;
//         continue;
//       }

//       // Check for time conflicts and fix them
//       if (autoDebit?.dueDate && scheduledJobs?.paymentTime) {
//         const dueDateFromAutoDebit = moment(autoDebit.dueDate.toDate());
//         const dueDateFromScheduled = moment(scheduledJobs.paymentTime);

//         // Check if times differ by more than 1 minute
//         if (
//           Math.abs(dueDateFromAutoDebit.diff(dueDateFromScheduled, "minutes")) >
//           1
//         ) {
//           console.log(
//             `⚠️ TIME CONFLICT DETECTED for ${appId || applicationId}:`
//           );
//           console.log(
//             `   - autoDebit.dueDate: ${dueDateFromAutoDebit.format(
//               "YYYY-MM-DD HH:mm:ss"
//             )}`
//           );
//           console.log(
//             `   - scheduledJobs.paymentTime: ${dueDateFromScheduled.format(
//               "YYYY-MM-DD HH:mm:ss"
//             )}`
//           );

//           // Cancel existing job as it's using incorrect time
//           console.log(`🔄 Cancelling job with incorrect time`);
//           cancelJobs(applicationId);

//           // Reset scheduled job status to force rescheduling
//           await doc.ref.update({
//             "scheduledJobs.payment": null,
//             "scheduledJobs.paymentTime": null,
//           });
//           console.log(`🔄 Reset scheduled job status to force rescheduling`);
//           timeConflictsFixed++;
//         }
//       }

//       // Schedule Email Reminder
//       if (payment2Deadline && payment2DeadlineTime && !scheduledJobs?.email) {
//         const scheduledTime = moment(
//           `${payment2Deadline} ${payment2DeadlineTime}`,
//           "YYYY-MM-DD hh:mm A"
//         );

//         console.log(
//           `📧 Email reminder time: ${scheduledTime.format(
//             "YYYY-MM-DD HH:mm:ss"
//           )}`
//         );

//         if (scheduleEmailJob(application, doc.ref, now)) {
//           emailsScheduled++;
//         } else {
//           skipped++;
//         }
//       } else {
//         if (!payment2Deadline || !payment2DeadlineTime) {
//           console.log(`⚠️ Missing deadline info for ${appId || applicationId}`);
//         } else if (scheduledJobs?.email) {
//           console.log(
//             `📝 Email job already exists: ${scheduledJobs.email} at ${
//               scheduledJobs.emailTime || "unknown time"
//             }`
//           );
//         }
//       }

//       // Schedule Payment - Note the !scheduledJobs?.payment check to ensure rescheduling after conflict fix
//       if (
//         autoDebit.enabled &&
//         autoDebit.status === "SCHEDULED" &&
//         !scheduledJobs?.payment
//       ) {
//         console.log(
//           `💳 Auto debit enabled for ${appId || applicationId}, amount: ${
//             autoDebit.amountDue
//           }`
//         );

//         if (schedulePaymentJob(application, doc.ref, now)) {
//           paymentsScheduled++;
//         } else {
//           skipped++;
//         }
//       } else {
//         if (!autoDebit.enabled) {
//           console.log(
//             `ℹ️ Auto debit not enabled for ${appId || applicationId}`
//           );
//         } else if (autoDebit.status !== "SCHEDULED") {
//           console.log(
//             `ℹ️ Auto debit status: ${autoDebit.status} for ${
//               appId || applicationId
//             }`
//           );
//         } else if (scheduledJobs?.payment) {
//           console.log(
//             `📝 Payment job already exists: ${scheduledJobs.payment} at ${
//               scheduledJobs.paymentTime || "unknown time"
//             }`
//           );

//           // Double check the time matches autoDebit.dueDate
//           if (autoDebit?.dueDate) {
//             const dueDateFromAutoDebit = moment(autoDebit.dueDate.toDate());
//             const scheduledTime = moment(scheduledJobs.paymentTime);
//             console.log(
//               `   - Stored autoDebit time: ${dueDateFromAutoDebit.format(
//                 "YYYY-MM-DD HH:mm:ss"
//               )}`
//             );
//             console.log(
//               `   - Scheduled job time: ${scheduledTime.format(
//                 "YYYY-MM-DD HH:mm:ss"
//               )}`
//             );
//           }
//         }
//       }
//     }

//     const duration = (Date.now() - startTime) / 1000;
//     console.log(`\n✅ Scheduling complete in ${duration.toFixed(2)}s`);
//     console.log(
//       `📊 Summary: ${emailsScheduled} emails scheduled, ${paymentsScheduled} payments scheduled`
//     );
//     console.log(
//       `📊 Changes: ${jobsCancelled} jobs cancelled, ${skipped} skipped, ${timeConflictsFixed} time conflicts fixed`
//     );
//     console.log(`🗂️ Total active jobs: ${activeJobs.size}`);

//     // Log all active jobs
//     console.log("\n📋 Active Jobs List:");
//     activeJobs.forEach((job, key) => {
//       console.log(
//         `   - ${key}: Next run at ${
//           job.nextInvocation() ? job.nextInvocation().toISOString() : "unknown"
//         }`
//       );
//     });
//   } catch (error) {
//     console.error("❌ Error initializing jobs:", error);
//     console.error(error.stack);
//   }
// };

// module.exports = {
//   schedulePaymentReminders,
// };
const cron = require("node-cron");
const { db } = require("../config/firebase");
const moment = require("moment");
const schedulePaymentJob = require("./schedulePaymentJob");
const scheduleEmailJob = require("./scheduleEmailJob");
const cancelJobs = require("./cancelJobs");

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
    const now = moment();

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
        const dueDateFromAutoDebit = moment(autoDebit.dueDate.toDate());
        const dueDateFromScheduled = moment(scheduledJobs.paymentTime);

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
            )}`
          );
          console.log(
            `   - scheduledJobs.paymentTime: ${dueDateFromScheduled.format(
              "YYYY-MM-DD HH:mm:ss"
            )}`
          );

          console.log(`🔄 Cancelling job with incorrect time`);
          cancelJobs(applicationId);

          await doc.ref.update({
            "scheduledJobs.payment": null,
            "scheduledJobs.paymentTime": null,
          });
          console.log(`🔄 Reset scheduled job status to force rescheduling`);
          timeConflictsFixed++;
        }
      }

      if (payment2Deadline && payment2DeadlineTime && !scheduledJobs?.email) {
        const scheduledTime = moment(
          `${payment2Deadline} ${payment2DeadlineTime}`,
          "YYYY-MM-DD hh:mm A"
        );

        console.log(
          `📧 Email reminder time: ${scheduledTime.format(
            "YYYY-MM-DD HH:mm:ss"
          )}`
        );

        if (scheduleEmailJob(application, doc.ref, now, activeJobs)) {
          emailsScheduled++;
        } else {
          skipped++;
        }
      } else {
        if (!payment2Deadline || !payment2DeadlineTime) {
          console.log(`⚠️ Missing deadline info for ${appId || applicationId}`);
        } else if (scheduledJobs?.email) {
          console.log(
            `📝 Email job already exists: ${scheduledJobs.email} at ${
              scheduledJobs.emailTime || "unknown time"
            }`
          );
        }
      }

      if (
        autoDebit.enabled &&
        (autoDebit.status === "SCHEDULED" || autoDebit.status === "FAILED") &&
        !scheduledJobs?.payment
      ) {
        console.log(
          `💳 Auto debit enabled for ${appId || applicationId}, amount: ${
            autoDebit.amountDue
          }`
        );

        if (schedulePaymentJob(application, doc.ref, now, activeJobs)) {
          paymentsScheduled++;
        } else {
          skipped++;
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
              scheduledJobs.paymentTime || "unknown time"
            }`
          );
          if (autoDebit?.dueDate) {
            const dueDateFromAutoDebit = moment(autoDebit.dueDate.toDate());
            const scheduledTime = moment(scheduledJobs.paymentTime);
            console.log(
              `   - Stored autoDebit time: ${dueDateFromAutoDebit.format(
                "YYYY-MM-DD HH:mm:ss"
              )}`
            );
            console.log(
              `   - Scheduled job time: ${scheduledTime.format(
                "YYYY-MM-DD HH:mm:ss"
              )}`
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
      console.log(
        `   - ${key}: Next run at ${
          job.nextInvocation() ? job.nextInvocation().toISOString() : "unknown"
        }`
      );
    });
  } catch (error) {
    console.error("❌ Error initializing jobs:", error);
    console.error(error.stack);
  }
};
// async function handleAutoDebitUpdate(application) {
//   const docRef = db.collection("applications").doc(application.id);
//   const now = moment();

//   // Recheck scheduling logic
//   if (
//     application.autoDebit?.dueDate &&
//     application.scheduledJobs?.paymentTime &&
//     application.autoDebit?.status === "SCHEDULED"
//   ) {
//     const dueDate = moment(application.autoDebit.dueDate.toDate());
//     const scheduledTime = moment(application.scheduledJobs.paymentTime);

//     if (!dueDate.isSame(scheduledTime)) {
//       console.log(`🔄 Rescheduling due to real-time update`);
//       await schedulePaymentJob(application, docRef, now, activeJobs);
//     }
//   }
// }
async function handleAutoDebitUpdate(application, activeJobs) {
  const docRef = db.collection("applications").doc(application.id);
  const now = moment();

  if (
    application.autoDebit?.dueDate &&
    application.autoDebit?.status === "SCHEDULED"
  ) {
    const dueDate = moment(application.autoDebit.dueDate.toDate());
    const scheduledTime = moment(application.scheduledJobs.paymentTime);

    if (!dueDate.isSame(scheduledTime)) {
      console.log(`🔄 Rescheduling due to real-time update`);

      // 1. Cancel existing job
      cancelJobs(application.id, activeJobs); // Pass activeJobs to cancelJobs

      // 2. Clear stale scheduling data in Firestore
      await docRef.update({
        "scheduledJobs.payment": null,
        "scheduledJobs.paymentTime": null,
      });

      // 3. Schedule new job with updated time
      await schedulePaymentJob(application, docRef, now, activeJobs);
    }
  }
}
// Schedule the above function to run at 8 AM daily
// const startDailyReminderScheduler = () => {
//   cron.schedule("0 8 * * *", async () => {
//     console.log("\n⏰ Running daily job at 8 AM...");
//     await schedulePaymentReminders();
//   });
// };
const startDailyReminderScheduler = () => {
  cron.schedule("* * * * *", async () => {
    console.log("\n⏰ Running job after  15 min...");
    await schedulePaymentReminders();
  });
};

module.exports = {
  schedulePaymentReminders,
  startDailyReminderScheduler,
};
