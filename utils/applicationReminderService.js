// services/applicationReminderService.js
const { db } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");

const emailHeader = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Certified Australia</title>
  <style type="text/css">
    /* CLIENT-SPECIFIC STYLES */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* RESET STYLES */
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Base container */
    .email-wrapper {
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* Header */
    .email-header {
      background-color:rgb(255, 255, 255);
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    
    .logo-container {
      margin-bottom: 10px;
    }
    
    .logo {
      max-width: 250px;
      height: auto;
    }
    
    /* Body */
    .email-body {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    /* Footer */
    .email-footer {
      text-align: center;
      margin-top: 20px;
      padding: 20px;
      font-size: 14px;
      color: #666;
    }
    
    /* Typography */
    h1, h2, h3 {
      color: #2c3e50;
      margin-top: 0;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    }
    
    h1 {
      color: white;
      font-size: 24px;
    }
    
    p, ul, ol, li {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
    }
    
    /* Buttons */
    .button-container {
      text-align: center;
      margin: 25px 0;
    }
    
    .button {
      background-color: #089C34;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
    }
    
    /* Notes and status boxes */
    .important-note {
      background-color: #f8f9fa;
      border-left: 4px solid #089C34;
      padding: 15px;
      margin: 20px 0;
    }
    
    .status-item {
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 5px;
    }
    
    .status-complete {
      background-color: #e8f5e9;
      border-left: 4px solid #4caf50;
    }
    
    .status-pending {
      background-color: #fff8e1;
      border-left: 4px solid #ffc107;
    }
    
    .payment-details {
      background-color: #e8f4fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
    }
    
    /* MOBILE STYLES */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 10px !important;
      }
      
      .email-body {
        padding: 20px !important;
      }
      
      h1 { font-size: 22px !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      
      .button {
        display: block !important;
        width: 100% !important;
      }
      
      .logo {
        max-width: 200px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <div class="logo-container">
          <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia Logo" class="logo">
        </div>
      </div>
      <div class="email-body">
`;
const emailFooter = `
      </div>
      <div class="email-footer">
        <p>
          <strong>Certified Australia</strong><br>
          Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #089C34; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
          Phone: <a href="tel:1300044927" style="color: #089C34; text-decoration: none;">1300 044 927</a><br>
          Website: <a href="https://www.certifiedaustralia.com.au" style="color: #089C34; text-decoration: none;">www.certifiedaustralia.com.au</a>
        </p>
        <p>© ${new Date().getFullYear()} Certified Australia. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const applicationReminderService = {
  async checkAndSendReminder(id) {
    try {
      const applicationRef = db.collection("applications").doc(id);
      const applicationDoc = await applicationRef.get();
      const { applicationId } = applicationDoc.data();
      if (!applicationDoc.exists) {
        return {
          success: false,
          message: "Application not found",
          applicationId,
        };
      }

      const applicationData = applicationDoc.data();

      // Check if email was already sent today
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      if (applicationData.ApplicationReminderEmailDate) {
        const lastSent = applicationData.ApplicationReminderEmailDate.toDate();
        lastSent.setUTCHours(0, 0, 0, 0);

        if (lastSent.getTime() === today.getTime()) {
          return {
            success: false,
            message: "Daily reminder already sent",
            applicationId,
          };
        }
      }

      if (applicationReminderService.isApplicationComplete(applicationData)) {
        return {
          success: false,
          message: "Application complete - no reminder sent",
          applicationId,
        };
      }

      const userDoc = await db
        .collection("users")
        .doc(applicationData.userId)
        .get();
      if (!userDoc.exists) {
        return { success: false, message: "User not found", applicationId };
      }

      const emailResult = await applicationReminderService.prepareReminderEmail(
        applicationId,
        applicationData,
        userDoc.data()
      );

      if (!emailResult.success) {
        return emailResult;
      }

      // Update last reminder date
      await applicationRef.update({
        ApplicationReminderEmailDate: new Date(),
      });

      return {
        success: true,
        message: "Reminder email sent",
        applicationId,
      };
    } catch (error) {
      console.error(`Error processing ${applicationId}:`, error);
      return { success: false, message: error.message, applicationId };
    }
  },

  isApplicationComplete(applicationData) {
    return (
      applicationData.currentStatus === "Complete" ||
      (applicationData.studentIntakeFormSubmitted &&
        applicationData.documentsUploaded &&
        applicationData.paid &&
        (!applicationData.partialScheme || applicationData.full_paid))
    );
  },

  async prepareReminderEmail(applicationId, applicationData, userData) {
    const { email, firstName, lastName } = userData;
    const pendingSteps =
      applicationReminderService.getPendingSteps(applicationData);

    if (pendingSteps.length === 0) {
      return { success: false, message: "No pending steps found" };
    }

    const loginUrl = `${process.env.CLIENT_URL}/applications/${applicationId}`;
    const emailContent = applicationReminderService.buildEmailContent(
      applicationId,
      pendingSteps,
      firstName,
      lastName,
      loginUrl,
      applicationData
    );

    try {
      await sendEmail(email, emailContent.body, emailContent.subject);
      return { success: true, message: "Reminder email sent" };
    } catch (error) {
      return { success: false, message: "Failed to send email" };
    }
  },

  getPendingSteps(applicationData) {
    const steps = [];
    if (!applicationData.studentIntakeFormSubmitted) {
      steps.push("Complete Student Intake Form");
    }
    if (!applicationData.documentsUploaded) {
      steps.push("Upload Required Documents");
    }
    if (
      !applicationData.paid ||
      (applicationData.partialScheme && !applicationData.full_paid)
    ) {
      steps.push("Complete Payment");
    }
    return steps;
  },

  buildEmailContent(
    applicationId,
    pendingSteps,
    firstName,
    lastName,
    loginUrl,
    appData
  ) {
    const paymentDetails = appData.partialScheme
      ? `
      <div class="payment-details">
        <h3>Payment Status for Application ${applicationId}:</h3>
        <ul>
          <li>Amount Paid: $${appData.amount_paid || 0}</li>
          <li>Remaining Balance: $${(
            appData.price - (appData.amount_paid || 0)
          ).toFixed(2)}</li>
        </ul>
      </div>
    `
      : "";

    return {
      subject: `Action Required: Complete Your Application (ID: ${applicationId})`,
      body: `
        ${emailHeader}
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <div class="important-note">
          <h3>Application ID: <span style="color: #089C34;">${applicationId}</span></h3>
          <h3>Pending Steps:</h3>
          <ul>
            ${pendingSteps
              .map(
                (step) => `
              <li class="status-item status-pending">
                ⚠️ ${step}
              </li>
            `
              )
              .join("")}
          </ul>
        </div>

        ${paymentDetails}

        <div class="button-container">
          <a href="${loginUrl}" class="button">
            Continue Application
          </a>
        </div>

        <p style="margin-top: 20px;">
          <strong>Need assistance with application ${applicationId}?</strong><br>
          Contact our support team at 
          <a href="mailto:support@certifiedaustralia.com.au" style="color: #089C34;">
            support@certifiedaustralia.com.au
          </a>
        </p>
        ${emailFooter}
      `,
    };
  },
};

module.exports = applicationReminderService;
