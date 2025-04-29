const schedule = require("node-schedule");
const { db } = require("../config/firebase");
const moment = require("moment-timezone");
const { processScheduledPayment } = require("./processScheduledPayment");

// Import time zone constants
const { TIME_ZONES } = require("../utils/timeZoneconstants");

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

  // Parse stored due date as UTC (how it's stored in Firestore)
  const dueDate = moment.utc(autoDebit.dueDate.toDate());

  // Check if the due date is in the past (CRITICAL CHECK)
  const isPastDue = dueDate.isSameOrBefore(now);

  console.log(`🔍 Checking payment timing for ${appId || applicationId}:`);
  console.log(`   - Due date: ${dueDate.format("YYYY-MM-DD HH:mm:ss")} UTC`);
  console.log(`   - Current: ${now.format("YYYY-MM-DD HH:mm:ss")} UTC`);
  console.log(`   - Is past due: ${isPastDue ? "YES" : "NO"}`);
  console.log(
    `   - Local time (${TIME_ZONES.DEFAULT}): ${dueDate
      .clone()
      .tz(TIME_ZONES.DEFAULT)
      .format("YYYY-MM-DD HH:mm:ss")}`
  );

  // Avoid duplicate scheduling - but allow immediate processing for past due
  if (activeJobs.has(`payment-${applicationId}`) && !isPastDue) {
    console.log(
      `🔁 Job already scheduled for Application ID: ${applicationId}`
    );
    return false;
  }

  // Always cancel existing job if we're processing a past due payment
  if (isPastDue && activeJobs.has(`payment-${applicationId}`)) {
    console.log(
      `🗑️ Cancelling scheduled job for immediate processing of ${applicationId}`
    );
    const existingJob = activeJobs.get(`payment-${applicationId}`);
    existingJob.cancel();
    activeJobs.delete(`payment-${applicationId}`);
  }

  // CASE 1: Immediate payment required - process it right away
  if (isPastDue) {
    console.log(`⚡ IMMEDIATE PAYMENT REQUIRED for ${applicationId}.`);
    console.log(`   - Due date: ${dueDate.format("YYYY-MM-DD HH:mm:ss")} UTC`);
    console.log(`   - Current: ${now.format("YYYY-MM-DD HH:mm:ss")} UTC`);
    console.log(`   - Time difference: ${now.diff(dueDate, "hours")} hours`);

    try {
      console.log(`🔄 Processing immediate payment for ${applicationId}...`);
      const latestDoc = await docRef.get();
      const latestData = latestDoc.data();

      if (latestData.full_paid) {
        console.log(`💰 Already marked full-paid: ${applicationId}. Skipping.`);
        await docRef.update({
          "scheduledJobs.payment": "skipped",
          "autoDebit.skippedAt": new Date().toISOString(),
        });
        return true; // Job was handled
      }

      // Force immediate payment processing
      console.log(`🚀 EXECUTING immediate payment for ${applicationId}`);
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
    console.log(`📅 Scheduling payment for ${appId || applicationId}`);
    console.log(`   - Due date: ${dueDate.format("YYYY-MM-DD HH:mm:ss")} UTC`);
    console.log(
      `   - Local time (${TIME_ZONES.DEFAULT}): ${dueDate
        .clone()
        .tz(TIME_ZONES.DEFAULT)
        .format("YYYY-MM-DD HH:mm:ss")}`
    );

    // Schedule job using the UTC date
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
          "scheduledJobs.paymentTime": dueDate.toISOString(), // Already UTC
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
      "scheduledJobs.paymentTime": dueDate.toISOString(), // Already UTC
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
