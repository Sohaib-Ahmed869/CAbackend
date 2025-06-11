// schedulers/paymentPlanScheduler.js
const cron = require("node-cron");
const { db } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");
const { Client, Environment } = require("square");

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production, // or Environment.Sandbox for testing
});

// Process scheduled payment plan payments
const processScheduledPaymentPlanPayment = async (applicationId) => {
  try {
    console.log(
      `Processing scheduled payment for application: ${applicationId}`
    );

    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      console.log(`Application ${applicationId} not found`);
      return false;
    }

    const appData = applicationDoc.data();
    const paymentPlan = appData.paymentPlan;

    if (
      !paymentPlan ||
      !paymentPlan.directDebit?.enabled ||
      paymentPlan.status !== "ACTIVE"
    ) {
      console.log(`Payment plan not eligible for processing: ${applicationId}`);
      return false;
    }

    // Find next pending payment that is due
    const currentDate = new Date();
    const nextPayment = paymentPlan.paymentSchedule.find((payment) => {
      const dueDate = new Date(payment.dueDate);
      return payment.status === "PENDING" && currentDate >= dueDate;
    });

    if (!nextPayment) {
      console.log(`No pending payments due for application: ${applicationId}`);
      return false;
    }

    console.log(
      `Processing payment #${nextPayment.paymentNumber} for application: ${applicationId}`
    );

    // Process payment with Square
    const payment = await squareClient.paymentsApi.createPayment({
      sourceId: paymentPlan.directDebit.squareCardId,
      idempotencyKey: `${applicationId}-payment-${
        nextPayment.paymentNumber
      }-${Date.now()}`,
      amountMoney: {
        amount: Math.round(nextPayment.amount * 100),
        currency: "AUD",
      },
      customerId: paymentPlan.directDebit.squareCustomerId,
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Scheduled Payment Plan Payment #${nextPayment.paymentNumber} for Application ${applicationId}`,
    });

    if (payment.result.payment.status === "COMPLETED") {
      console.log(
        `Payment successful for application: ${applicationId}, payment #${nextPayment.paymentNumber}`
      );

      // Update payment schedule
      const updatedSchedule = paymentPlan.paymentSchedule.map((p) =>
        p.paymentNumber === nextPayment.paymentNumber
          ? {
              ...p,
              status: "COMPLETED",
              paidDate: new Date().toISOString(),
              transactionId: payment.result.payment.id,
            }
          : p
      );

      const completedPayments = paymentPlan.completedPayments + 1;
      // Ensure values are converted to numbers before adding
      const totalPaidAmount =
        Number(paymentPlan.totalPaidAmount || 0) +
        Number(nextPayment.amount || 0);
      const isFullyPaid = completedPayments === paymentPlan.numberOfPayments;

      // Update application
      const updateData = {
        "paymentPlan.paymentSchedule": updatedSchedule,
        "paymentPlan.completedPayments": completedPayments,
        "paymentPlan.totalPaidAmount": totalPaidAmount,
        "paymentPlan.lastPaymentDate": new Date().toISOString(),
      };

      if (isFullyPaid) {
        updateData["paymentPlan.status"] = "COMPLETED";
        updateData.paid = true;
        updateData.full_paid = true;
        updateData.currentStatus = "Sent to Assessor";
        updateData.status = [
          ...(appData.status || []),
          {
            statusname: "Sent to Assessor",
            time: new Date().toISOString(),
          },
        ];
        console.log(`Payment plan completed for application: ${applicationId}`);
      }

      await applicationRef.update(updateData);

      // Send email notification
      const userRef = await db.collection("users").doc(appData.userId).get();
      if (userRef.exists) {
        const userData = userRef.data();
        await sendPaymentPlanPaymentConfirmation(
          userData.email,
          userData.firstName,
          userData.lastName,
          appData.applicationId,
          nextPayment,
          isFullyPaid,
          totalPaidAmount,
          paymentPlan.totalAmount
        );
      }

      return true;
    } else {
      console.log(
        `Payment failed for application: ${applicationId}, status: ${payment.result.payment.status}`
      );
      return false;
    }
  } catch (error) {
    console.error(
      `Scheduled Payment Plan Payment Error for ${applicationId}:`,
      error
    );

    // Update payment plan with error status
    try {
      const applicationRef = db.collection("applications").doc(applicationId);
      await applicationRef.update({
        "paymentPlan.directDebit.status": "FAILED",
        "paymentPlan.directDebit.lastError": error.message,
        "paymentPlan.directDebit.lastFailedAt": new Date().toISOString(),
      });

      // Send failure notification email
      await sendPaymentFailureNotification(applicationId, error.message);
    } catch (updateError) {
      console.error(
        `Failed to update error status for ${applicationId}:`,
        updateError
      );
    }

    return false;
  }
};

// Check for scheduled payment plan payments
const checkScheduledPaymentPlans = async () => {
  try {
    console.log("Starting scheduled payment plan check...");

    const applicationsSnapshot = await db
      .collection("applications")
      .where("paymentPlanEnabled", "==", true)
      .where("paymentPlan.status", "==", "ACTIVE")
      .get();

    console.log(
      `Found ${applicationsSnapshot.docs.length} applications with active payment plans`
    );

    const results = {
      total: applicationsSnapshot.docs.length,
      processed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const doc of applicationsSnapshot.docs) {
      const appData = doc.data();

      // Only process if direct debit is enabled
      if (appData.paymentPlan?.directDebit?.enabled) {
        const success = await processScheduledPaymentPlanPayment(doc.id);
        if (success) {
          results.processed++;
        } else {
          results.failed++;
        }
      } else {
        results.skipped++;
      }

      // Add small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("Scheduled payment plan check completed:", results);

    // Log summary to admin if there were any issues
    if (results.failed > 0) {
      await sendAdminSummaryEmail(results);
    }
  } catch (error) {
    console.error("Error in scheduled payment plan check:", error);
    await sendAdminErrorNotification(error);
  }
};

// Send payment reminders for upcoming payments (non-direct debit)
const sendPaymentReminders = async () => {
  try {
    console.log("Checking for payment reminders...");

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const applicationsSnapshot = await db
      .collection("applications")
      .where("paymentPlanEnabled", "==", true)
      .where("paymentPlan.status", "==", "ACTIVE")
      .get();

    let remindersSent = 0;

    for (const doc of applicationsSnapshot.docs) {
      const appData = doc.data();
      const paymentPlan = appData.paymentPlan;

      // Skip if direct debit is enabled (no reminders needed)
      if (paymentPlan?.directDebit?.enabled) {
        continue;
      }

      // Find payments due tomorrow
      const upcomingPayments = paymentPlan?.paymentSchedule?.filter(
        (payment) => {
          const dueDate = new Date(payment.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return (
            payment.status === "PENDING" &&
            dueDate.getTime() === tomorrow.getTime()
          );
        }
      );

      // Send reminder email for upcoming payments
      if (upcomingPayments && upcomingPayments.length > 0) {
        const userRef = await db.collection("users").doc(appData.userId).get();
        if (userRef.exists) {
          const userData = userRef.data();
          await sendPaymentReminderEmail(
            userData.email,
            userData.firstName,
            userData.lastName,
            appData.applicationId,
            upcomingPayments[0]
          );
          remindersSent++;
        }
      }
    }

    console.log(`Payment reminders sent: ${remindersSent}`);
  } catch (error) {
    console.error("Error sending payment reminders:", error);
  }
};

// Email notification functions
const sendPaymentPlanPaymentConfirmation = async (
  email,
  firstName,
  lastName,
  applicationId,
  payment,
  isFullyPaid,
  totalPaidAmount,
  totalAmount
) => {
  const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f7f9fc;
                color: #333;
            }
            .email-container {
                max-width: 600px;
                margin: 30px auto;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                overflow: hidden;
            }
            .header {
                background: #fff;
                padding: 24px;
                text-align: center;
            }
            .content {
                padding: 32px;
                line-height: 1.6;
            }
            .details-card {
                background: #f9fafb;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #089C34;
            }
            .footer {
                background: #fff;
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
            </div>
            <div class="content">
                <h1 style="color: #089C34;">Automatic Payment Processed</h1>
                
                <p>Dear ${firstName} ${lastName},</p>
                <p>Your scheduled payment for application <strong>#${applicationId}</strong> has been successfully processed.</p>

                <div class="details-card">
                    <h3>Payment Details</h3>
                    <p><strong>Payment #${payment.paymentNumber}:</strong> $${
    payment.amount
  }</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Total Paid:</strong> $${totalPaidAmount} of $${totalAmount}</p>
                    <p><strong>Transaction ID:</strong> ${
                      payment.transactionId
                    }</p>
                </div>

                ${
                  isFullyPaid
                    ? `
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
                        <h3 style="color: #155724; margin-top: 0;">Payment Plan Complete! 🎉</h3>
                        <p style="color: #155724;">Congratulations! You have completed all payments for your application. Your application has been sent to the assessor for processing.</p>
                    </div>
                `
                    : `
                    <p>Thank you for your payment. Your next payment will be automatically processed as per your payment schedule.</p>
                `
                }
            </div>
            <div class="footer">
                <p>© 2025 Certified Australia. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>`;

  const subject = isFullyPaid
    ? `Payment Plan Complete - Application ${applicationId}`
    : `Automatic Payment Processed - Application ${applicationId}`;

  const userData = {
    firstName,
    lastName,
    email,
  };

  await sendEmail(email, emailBody, subject);

  const emailAdmin2 = "certified@calcite.live";
  const ceoEmail = process.env.CEO_EMAIL; // Add this line

  // Send to all admin emails
  const adminEmails = [emailAdmin2, ceoEmail].filter(Boolean); // Filter out any undefined emails

  const adminEmailBody = `
  <h2>Payment Plan Payment Processed</h2>
  <p>A scheduled payment has been processed for application ${applicationId}.</p>
  <p><strong>Details:</strong></p>
  <ul>
    <li>Application ID: ${applicationId}</li>
    <li>User: ${userData.firstName} ${userData.lastName}</li>
    <li>Payment #${payment.paymentNumber}: $${payment.amount}</li>
    <li>Total Paid: $${totalPaidAmount} of $${totalAmount}</li>
    <li>Date: ${new Date().toISOString()}</li>
    ${
      isFullyPaid
        ? "<li><strong>Status: Payment Plan Completed</strong></li>"
        : ""
    }
  </ul>
`;

  // Send emails to all admins
  for (const adminEmail of adminEmails) {
    await sendEmail(
      adminEmail,
      adminEmailBody,
      `Payment Plan Payment Processed - Application ${applicationId}`
    );
  }
};

const sendPaymentReminderEmail = async (
  email,
  firstName,
  lastName,
  applicationId,
  payment
) => {
  const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f7f9fc;
                color: #333;
            }
            .email-container {
                max-width: 600px;
                margin: 30px auto;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                overflow: hidden;
            }
            .header {
                background: #fff;
                padding: 24px;
                text-align: center;
            }
            .content {
                padding: 32px;
                line-height: 1.6;
            }
            .details-card {
                background: #fff3cd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #ffc107;
            }
            .footer {
                background: #fff;
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
            </div>
            <div class="content">
                <h1 style="color: #ffc107;">Payment Reminder</h1>
                
                <p>Dear ${firstName} ${lastName},</p>
                <p>This is a friendly reminder that your payment for application <strong>#${applicationId}</strong> is due tomorrow.</p>

                <div class="details-card">
                    <h3>Payment Due</h3>
                    <p><strong>Payment #${payment.paymentNumber}:</strong> $${
    payment.amount
  }</p>
                    <p><strong>Due Date:</strong> ${new Date(
                      payment.dueDate
                    ).toLocaleDateString()}</p>
                </div>

                <p>Please ensure your payment is made on time to avoid any delays in processing your application.</p>
                <p>You can make your payment by logging into your account on our platform.</p>
            </div>
            <div class="footer">
                <p>© 2025 Certified Australia. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>`;

  const subject = `Payment Reminder - Application ${applicationId}`;
  await sendEmail(email, emailBody, subject);
};

const sendPaymentFailureNotification = async (applicationId, errorMessage) => {
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (applicationDoc.exists) {
      const appData = applicationDoc.data();
      const userRef = await db.collection("users").doc(appData.userId).get();

      if (userRef.exists) {
        const userData = userRef.data();

        const emailBody = `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #dc3545;">Payment Processing Failed</h2>
              <p>Dear ${userData.firstName} ${userData.lastName},</p>
              <p>We were unable to process your scheduled payment for application <strong>#${appData.applicationId}</strong>.</p>
              <p><strong>Error:</strong> ${errorMessage}</p>
              <p>Please contact our support team or update your payment method to continue with your payment plan.</p>
              <p>Best regards,<br>Certified Australia</p>
            </div>
          </body>
          </html>`;

        await sendEmail(
          userData.email,
          emailBody,
          `Payment Failed - Application ${appData.applicationId}`
        );
      }
    }
  } catch (error) {
    console.error("Error sending payment failure notification:", error);
  }
};

const sendAdminSummaryEmail = async (results) => {
  const adminEmails = [
    "ceo@certifiedaustralia.com.au",
    "certified@calcite.live",
  ];

  const emailBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Payment Plan Processing Summary</h2>
        <p>Daily payment plan processing completed with the following results:</p>
        <ul>
          <li><strong>Total Applications:</strong> ${results.total}</li>
          <li><strong>Successfully Processed:</strong> ${results.processed}</li>
        
        </ul>
        <p>Date: ${new Date().toLocaleString()}</p>
        ${
          results.failed > 0
            ? '<p style="color: #dc3545;"><strong>Please review failed payments in the admin dashboard.</strong></p>'
            : ""
        }
      </div>
    </body>
    </html>`;

  for (const email of adminEmails) {
    try {
      await sendEmail(email, emailBody, "Payment Plan Processing Summary");
    } catch (error) {
      console.error(`Failed to send admin summary to ${email}:`, error);
    }
  }
};

const sendAdminErrorNotification = async (error) => {
  const adminEmails = [
    "ceo@certifiedaustralia.com.au",
    "certified@calcite.live",
  ];

  const emailBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #dc3545;">Payment Plan Scheduler Error</h2>
        <p>An error occurred during the scheduled payment plan processing:</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
          <pre>${error.message}</pre>
        </div>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        <p>Please check the server logs for more details.</p>
      </div>
    </body>
    </html>`;

  for (const email of adminEmails) {
    try {
      await sendEmail(email, emailBody, "Payment Plan Scheduler Error");
    } catch (error) {
      console.error(`Failed to send error notification to ${email}:`, error);
    }
  }
};

// Schedule jobs
const startPaymentPlanScheduler = () => {
  console.log("Starting Payment Plan Scheduler...");

  // Process scheduled payments every day at 9:00 AM
  cron.schedule("* 9 * * *", () => {
    console.log("Running scheduled payment plan check...");
    checkScheduledPaymentPlans();
  });

  // Send payment reminders every day at 8:00 AM
  cron.schedule("0 8 * * *", () => {
    console.log("Sending payment reminders...");
    sendPaymentReminders();
  });

  // Health check - log scheduler status every hour
  cron.schedule("0 * * * *", () => {
    console.log(
      `Payment Plan Scheduler is running - ${new Date().toISOString()}`
    );
  });

  console.log("Payment Plan Scheduler started successfully!");
  console.log("- Scheduled payments: Daily at 9:00 AM");
  console.log("- Payment reminders: Daily at 8:00 AM");
  console.log("- Health check: Every hour");
};

module.exports = {
  startPaymentPlanScheduler,
  checkScheduledPaymentPlans,
  sendPaymentReminders,
  processScheduledPaymentPlanPayment,
};
