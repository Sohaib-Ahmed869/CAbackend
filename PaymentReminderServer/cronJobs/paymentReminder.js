// const cron = require("node-cron");
// const { db } = require("../config/firebase");
// const { sendEmail } = require("../utils/emailUtil");
// const moment = require("moment");
// const generateEmailBody = require("../utils/generateEmailBody");

// const schedulePaymentReminders = async () => {
//   try {
//     console.log("🔄 Fetching latest application data...");

//     const applicationsSnapshot = await db.collection("applications").get();
//     const nowDate = moment().format("YYYY-MM-DD");
//     const now = moment();

//     for (const doc of applicationsSnapshot.docs) {
//       const application = doc.data();
//       const {
//         payment2Deadline,
//         payment2DeadlineTime,
//         full_paid,
//         userId,
//         applicationId,
//         price,
//         amount_paid,
//         paymentReminderEmailSentOn,
//       } = application;

//       if (!payment2Deadline || !payment2DeadlineTime || full_paid) continue;

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
//           const scheduledTime = moment(
//             `${payment2Deadline} ${payment2DeadlineTime}`,
//             "YYYY-MM-DD hh:mm A"
//           );

//           // Send email if overdue but within the last 24 hours
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
//         } else {
//           console.log(`⚠ No email found for userId: ${userId}`);
//         }
//       }
//     }
//   } catch (error) {
//     console.error("❌ Error scheduling payment reminders:", error);
//   }
// };

// // **Run cron job every 1 minute**
// cron.schedule("* * * * *", async () => {
//   await schedulePaymentReminders();
// });

// module.exports = { schedulePaymentReminders };
const cron = require("node-cron");
const { db } = require("../config/firebase");
const { sendEmail } = require("../utils/emailUtil");
const moment = require("moment");
const generateEmailBody = require("../utils/generateEmailBody");
const {
  processScheduledPayment,
} = require("../../controllers/applicationController");

// const processScheduledPayment = async (applicationId) => {
//   try {
//     const applicationRef = db.collection("applications").doc(applicationId);
//     const applicationDoc = await applicationRef.get();

//     if (!applicationDoc.exists) return;

//     const appData = applicationDoc.data();
//     const autoDebit = appData.autoDebit || {};

//     if (!autoDebit.enabled || autoDebit.status !== "SCHEDULED") return;

//     const payment = await squareClient.paymentsApi.createPayment({
//       sourceId: autoDebit.squareCardId,
//       idempotencyKey: `${applicationId}-${Date.now()}`,
//       amountMoney: {
//         amount: Math.round(autoDebit.amountDue * 100),
//         currency: "AUD",
//       },
//       customerId: autoDebit.squareCustomerId,
//       locationId: process.env.SQUARE_LOCATION_ID,
//       note: `Scheduled payment for Application ID: ${applicationId}`,
//     });

//     if (payment.result.payment.status === "COMPLETED") {
//       await applicationRef.update({
//         "autoDebit.status": "COMPLETED",
//         full_paid: true,
//         amount_paid: autoDebit.amountDue,
//         paymentDate: new Date().toISOString(),
//       });

//       await checkApplicationStatusAndSendEmails(
//         applicationId,
//         "scheduled_payment_made"
//       );
//       return true;
//     }
//   } catch (error) {
//     console.error("Scheduled Payment Error:", error);
//     const applicationRef = db.collection("applications").doc(applicationId);
//     await applicationRef.update({
//       "autoDebit.status": "FAILED",
//       "autoDebit.lastError": error.message,
//     });
//     return false;
//   }
// };

const schedulePaymentReminders = async () => {
  try {
    console.log("🔄 Fetching latest application data...");

    const applicationsSnapshot = await db.collection("applications").get();
    const nowDate = moment().format("YYYY-MM-DD");
    const now = moment();
    // const now = moment().tz('Australia/Sydney'); // Uncomment for production

    for (const doc of applicationsSnapshot.docs) {
      const application = doc.data();
      const {
        payment2Deadline,
        payment2DeadlineTime,
        full_paid,
        userId,
        applicationId,
        id,
        price,
        amount_paid,
        paymentReminderEmailSentOn,
        autoDebit = {},
      } = application;

      if (!payment2Deadline || !payment2DeadlineTime || full_paid) continue;

      const scheduledTime = moment(
        `${payment2Deadline} ${payment2DeadlineTime}`,
        "YYYY-MM-DD hh:mm A"
      );

      // Existing reminder logic
      const deadlineDate = moment(payment2Deadline, "YYYY-MM-DD").startOf(
        "day"
      );
      const daysLeft = deadlineDate.diff(moment().startOf("day"), "days");

      let reminderType = null;
      if (daysLeft > 0) {
        reminderType = `Reminder: ${daysLeft} days left to pay`;
      } else if (daysLeft === 0) {
        reminderType = "Reminder: Your Payment is due ";
      } else if (daysLeft < 0) {
        reminderType = `Overdue: Payment is pending (${Math.abs(daysLeft)} ${
          daysLeft > 1 ? "days" : "day"
        } overdue)`;
      }

      if (paymentReminderEmailSentOn === nowDate) {
        console.log(
          `🔄 Skipping email for Application ${applicationId}, already sent today.`
        );
        continue;
      }

      if (reminderType) {
        const userRef = await db.collection("users").doc(userId).get();
        const userEmail = userRef.exists ? userRef.data().email : null;

        if (userEmail) {
          if (
            now.isSameOrAfter(scheduledTime) &&
            now.diff(scheduledTime, "minutes") <= 1440
          ) {
            const subject = `Payment Reminder for Application ${applicationId}`;
            const body = await generateEmailBody({
              applicationId,
              price,
              amount_paid,
              deadline: payment2Deadline,
              reminderType,
              userId,
            });

            await sendEmail(userEmail, body, subject);
            console.log(
              `✅ Email sent to ${userEmail} for Application ${applicationId}`
            );

            await db.collection("applications").doc(doc.id).update({
              paymentReminderEmailSentOn: nowDate,
            });
          } else if (now.isBefore(scheduledTime)) {
            console.log(
              `⏳ Email for ${userEmail} is scheduled at ${payment2DeadlineTime}`
            );
          } else {
            console.log(
              `⏳ Skipping: More than 24 hours have passed since overdue time for ${applicationId}`
            );
          }
        }
      }

      // New direct debit processing logic
      if (autoDebit.enabled && autoDebit.status === "SCHEDULED") {
        const dueDate = autoDebit.dueDate
          ? moment(autoDebit.dueDate.toDate())
          : null;
        // For production: moment(autoDebit.dueDate.toDate()).tz('Australia/Sydney')

        if (autoDebit.amountDue <= 0) {
          console.log("⚡ No amount due for direct debit");
          await UpdateDebitStatus(id, "NO_AMOUNT_DUE");
          continue;
        }
        const paymentStatusChecks = {
          Payment1: application.paid,
          Payment2: application.full_paid,
          fullPayment: application.full_paid,
        };
        if (paymentStatusChecks[autoDebit.selectedPayment]) {
          console.log(`⚡ ${autoDebit.selectedPayment} already paid`);
          await UpdateDebitStatus(id, "MANUALLY_PAID");
          continue;
        }

        if (now.isSameOrAfter(dueDate)) {
          try {
            console.log(
              `⚡ Processing payment for Application ${applicationId}`
            );
            await processScheduledPayment(id);
          } catch (processError) {
            console.error("❌ Payment processing failed:", processError);
            await UpdateDebitStatus(id, "FAILED");
          }
        } else {
          console.log(`⏳ Payment scheduled at ${scheduledTime.format()}`);
          // await UpdateDebitStatus(id, "SCHEDULED");
        }
      }
    }
  } catch (error) {
    console.error("❌ Error in cron job:", error);
  }
};

// Run cron job every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  await schedulePaymentReminders();
});

const UpdateDebitStatus = async (applicationId, status) => {
  try {
    await db.collection("applications").doc(applicationId).update({
      "autoDebit.status": status,
      "autoDebit.updatedAt": new Date().toISOString(),
    });
    console.log(`✅ Updated status for ${applicationId} to ${status}`);
  } catch (error) {
    console.error("❌ Error updating debit status:", error);
    throw error; // Rethrow to handle in parent scope
  }
};
module.exports = { schedulePaymentReminders, processScheduledPayment };
