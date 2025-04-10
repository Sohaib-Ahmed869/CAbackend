const schedule = require("node-schedule");
const { db } = require("../config/firebase");
const moment = require("moment");
const {
  processScheduledPayment,
} = require("../../controllers/applicationController");

const schedulePaymentJob = async (application, docRef, now, activeJobs) => {
  const {
    id: applicationId,
    applicationId: appId,
    autoDebit = {},
  } = application;

  if (!autoDebit.dueDate || !autoDebit.dueDate.toDate) {
    console.error(
      `❌ Invalid or missing dueDate for ${appId || applicationId}`
    );
    return false;
  }

  const dueDate = moment(autoDebit.dueDate.toDate());

  // Avoid duplicate scheduling
  if (activeJobs.has(`payment-${applicationId}`)) {
    console.log(
      `🔁 Job already scheduled for Application ID: ${applicationId}`
    );
    return false;
  }

  // CASE 1: Immediate payment required
  if (dueDate.isSameOrBefore(now)) {
    console.log(
      `⚡ Immediate payment required for ${applicationId}. Due date: ${dueDate.format(
        "YYYY-MM-DD HH:mm:ss"
      )}`
    );

    try {
      const latestDoc = await docRef.get();
      const latestData = latestDoc.data();

      if (latestData.full_paid) {
        console.log(`💰 Already marked full-paid: ${applicationId}. Skipping.`);
        await docRef.update({
          "scheduledJobs.payment": "skipped",
          "autoDebit.skippedAt": new Date().toISOString(),
        });
        return;
      }

      await processScheduledPayment(applicationId);
      await docRef.update({
        "scheduledJobs.payment": "completed",
        "autoDebit.processedAt": new Date().toISOString(),
      });

      console.log(`✅ Immediate payment processed for ${applicationId}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed immediate payment for ${applicationId}:`, error);
      await docRef.update({
        "scheduledJobs.payment": "failed",
        "autoDebit.status": "FAILED",
        "autoDebit.error": error.message,
        "autoDebit.failedAt": new Date().toISOString(),
      });
      return false;
    }
  }

  // CASE 2: Schedule for future
  try {
    console.log(
      `📅 Scheduling payment for ${appId || applicationId} at ${dueDate.format(
        "YYYY-MM-DD HH:mm:ss"
      )}`
    );

    const job = schedule.scheduleJob(dueDate.toDate(), async () => {
      console.log(
        `🚀 EXECUTING payment job for application ${appId || applicationId}`
      );

      try {
        const latestDoc = await db
          .collection("applications")
          .doc(applicationId)
          .get();
        const latestData = latestDoc.data();

        if (latestData.full_paid) {
          console.log(
            `💰 Already paid. Skipping processing for ${appId || applicationId}`
          );
          await latestDoc.ref.update({
            "scheduledJobs.payment": "skipped",
            "autoDebit.skippedAt": new Date().toISOString(),
          });
          return;
        }

        await processScheduledPayment(applicationId);

        await latestDoc.ref.update({
          "scheduledJobs.payment": "completed",
          "autoDebit.processedAt": new Date().toISOString(),
        });

        console.log(`✅ Scheduled payment completed for ${applicationId}`);
      } catch (error) {
        console.error(
          `❌ Scheduled payment failed for ${appId || applicationId}:`,
          error
        );
        await docRef.update({
          "scheduledJobs.payment": "failed",
          "autoDebit.status": "FAILED",
          "autoDebit.error": error.message,
          "autoDebit.failedAt": new Date().toISOString(),
        });
      }

      // Clean up after job
      activeJobs.delete(`payment-${applicationId}`);
    });

    // Track active job and mark in Firestore
    activeJobs.set(`payment-${applicationId}`, job);
    await docRef.update({
      "scheduledJobs.payment": "pending",
      "scheduledJobs.paymentTime": dueDate.toISOString(),
    });

    return true;
  } catch (error) {
    console.error(
      `❌ Failed to schedule job for ${appId || applicationId}:`,
      error
    );
    return false;
  }
};

module.exports = schedulePaymentJob;
