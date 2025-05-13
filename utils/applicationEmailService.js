// utils/applicationEmailService.js
const { db, auth } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");

/**
 * Comprehensive application status email service
 * Sends contextual emails based on the completion status of:
 * - Student Intake Form
 * - Document uploads
 * - Payment (full or partial)
 */

// Email template components with improved mobile compatibility
// Change this section in your emailHeader constant
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

/**
 * Checks the application status and sends appropriate emails based on trigger event
 * @param {string} applicationId - The application ID
 * @param {string} triggerEvent - The event that triggered this check ('sif_completed', 'docs_uploaded', 'payment_made')
 * @returns {Promise<Object>} Status of the email sending operation
 */
const checkApplicationStatusAndSendEmails = async (
  applicationId,
  triggerEvent
) => {
  try {
    console.log(
      `Checking application ${applicationId} status for trigger: ${triggerEvent}`
    );

    // Get application data
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      console.error(`Application ${applicationId} not found`);
      return { success: false, message: "Application not found" };
    }

    const applicationData = applicationDoc.data();
    const {
      userId,
      studentFormId,
      documentsFormId,
      paid,
      partialScheme,
      payment1,
      payment2,
      amount_paid,
      price,
      discount = 0,
      full_paid,
      currentStatus,
      documentsUploaded,
      studentIntakeFormSubmitted,
    } = applicationData;

    // Get user data
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`User ${userId} not found`);
      return { success: false, message: "User not found" };
    }

    const userData = userDoc.data();
    const { email, firstName, lastName } = userData;

    // Create login token for user to access their application
    const token = await auth.createCustomToken(userId);
    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    // Check SIF status - prioritize the flag if set
    let sifCompleted = Boolean(studentIntakeFormSubmitted);

    if (!sifCompleted && studentFormId) {
      try {
        const sifRef = db.collection("studentIntakeForms").doc(studentFormId);
        const sifDoc = await sifRef.get();
        if (sifDoc.exists) {
          const sifData = sifDoc.data();
          sifCompleted = sifData.firstName && sifData.lastName && sifData.agree;

          // Update the flag if we detected it's complete
          if (sifCompleted && !studentIntakeFormSubmitted) {
            await applicationRef.update({ studentIntakeFormSubmitted: true });
          }
        }
      } catch (error) {
        console.error("Error checking SIF status:", error);
      }
    }

    // Check documents status
    const docsCompleted = Boolean(documentsUploaded);

    // Check payment status
    const paymentCompleted = Boolean(paid);
    const partialPaymentMade = partialScheme && paid && !full_paid;
    const fullPaymentMade = (paid && full_paid) || (paid && !partialScheme);

    // Calculate remaining payment amount if on partial payment scheme
    let remainingPayment = 0;
    if (partialPaymentMade && payment2) {
      remainingPayment = payment2;
    }

    // Determine application status based on all three components
    const applicationStatus = {
      sifCompleted,
      docsCompleted,
      paymentCompleted,
      partialPaymentMade,
      fullPaymentMade,
      remainingPayment,
      price,
      discount,
      amountPaid:
        amount_paid ||
        (paid ? (partialScheme ? payment1 : price - discount) : 0),
    };

    console.log(`Application ${applicationId} status:`, applicationStatus);

    // Handle email sending based on the trigger event
    let result;

    switch (triggerEvent) {
      case "payment_made":
        result = await handlePaymentEmailNotification(
          applicationId,
          applicationStatus,
          userData,
          loginUrl,
          partialPaymentMade
        );
        break;

      case "docs_uploaded":
        result = await handleDocsUploadedEmailNotification(
          applicationId,
          applicationStatus,
          userData,
          loginUrl
        );
        break;

      case "sif_completed":
        result = await handleSIFCompletedEmailNotification(
          applicationId,
          applicationStatus,
          userData,
          loginUrl
        );
        break;

      case "manual_trigger":
      default:
        // For manual triggers, determine the most appropriate email
        result = await sendContextBasedEmail(
          applicationId,
          applicationStatus,
          userData,
          loginUrl
        );
        break;
    }

    return {
      success: true,
      message: "Email notification sent based on application status",
      status: applicationStatus,
      result,
    };
  } catch (error) {
    console.error("Error in checkApplicationStatusAndSendEmails:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Handles payment-specific email notifications
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status object
 * @param {Object} userData - The user data
 * @param {string} loginUrl - The login URL with token
 * @param {boolean} isPartialPayment - Whether this is a partial payment
 * @returns {Promise<Object>} Result of the email sending
 */
const handlePaymentEmailNotification = async (
  applicationId,
  status,
  userData,
  loginUrl,
  isPartialPayment
) => {
  const { firstName, lastName, email } = userData;

  let emailSubject;
  let emailBody;

  // Case: Payment completed fully
  if (status.fullPaymentMade) {
    if (status.sifCompleted && status.docsCompleted) {
      // Everything is complete - send completion email
      emailSubject = "Application Complete - Submitted for Approval";
      emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Congratulations! We're pleased to inform you that your payment has been processed successfully and your application has been submitted for approval.</p>
        
        <div class="payment-details">
          <h3>Payment Details:</h3>
          <ul>
            <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
            <li><strong>Total Application Fee:</strong> $${
              status.price - status.discount
            }</li>
            ${
              status.discount > 0
                ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
                : ""
            }
          </ul>
        </div>
        
        <div class="important-note">
          <h3>Application Status: Complete</h3>
          <ul>
            <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
            <li class="status-item status-complete">✅ Required Documents: Uploaded</li>
            <li class="status-item status-complete">✅ Payment: Completed</li>
          </ul>
        </div>
        
        <p>Our assessment team is now reviewing your application and will provide updates as they become available. You can track the progress of your application at any time by clicking the button below.</p>
        
        <div class="button-container">
          <a href="${loginUrl}" class="button">View Application Status</a>
        </div>
        
        <p>Thank you for choosing Certified Australia for your certification needs.</p>
        
        <p>Warm regards,<br>The Certified Australia Team</p>
      `;

      // Notify RTO team
      await notifyRTOTeam(applicationId, userData);

      await notifyAdminAboutFullPayment(applicationId, status, userData);
    } else if (status.sifCompleted && !status.docsCompleted) {
      // SIF complete, payment complete, but docs pending
      emailSubject =
        "Payment Received - Documents Required to Complete Your Application";
      emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Thank you for your payment. Your payment has been processed successfully.</p>
        
        <div class="payment-details">
          <h3>Payment Details:</h3>
          <ul>
            <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
            <li><strong>Total Application Fee:</strong> $${
              status.price - status.discount
            }</li>
            ${
              status.discount > 0
                ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
                : ""
            }
          </ul>
        </div>
        
        <div class="important-note">
          <h3>Application Status:</h3>
          <ul>
            <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
            <li class="status-item status-pending">⚠️ Required Documents: Pending</li>
            <li class="status-item status-complete">✅ Payment: Completed</li>
          </ul>
        </div>
        
        <p>To complete your application, we still need you to upload the required documentation. Please click the button below to proceed with uploading your documents:</p>
        
        <div class="button-container">
          <a href="${loginUrl}" class="button">Upload Documents</a>
        </div>
        
        <h3>Required Documents:</h3>
        <ul>
          <li><strong>Proof of Work Experience:</strong> Resume, job references, or detailed job descriptions</li>
          <li><strong>Educational Transcripts:</strong> Copies of qualifications, certificates, or diplomas</li>
          <li><strong>Skill Evidence:</strong> Additional certifications or training certificates</li>
          <li><strong>Identification Documents:</strong> A copy of your ID or passport</li>
        </ul>
        
        <p>Thank you for choosing Certified Australia for your certification needs.</p>
        
        <p>Warm regards,<br>The Certified Australia Team</p>
      `;
    } else if (!status.sifCompleted) {
      // Payment complete but SIF pending
      emailSubject = "Payment Received - Complete Your Application";
      emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Thank you for your payment. Your payment has been processed successfully.</p>
        
        <div class="payment-details">
          <h3>Payment Details:</h3>
          <ul>
            <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
            <li><strong>Total Application Fee:</strong> $${
              status.price - status.discount
            }</li>
            ${
              status.discount > 0
                ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
                : ""
            }
          </ul>
        </div>
        
        <div class="important-note">
          <h3>Application Status:</h3>
          <ul>
            <li class="status-item status-pending">⚠️ Student Intake Form: Incomplete</li>
            <li class="status-item status-pending">⚠️ Required Documents: Pending</li>
            <li class="status-item status-complete">✅ Payment: Completed</li>
          </ul>
        </div>
        
        <p>To complete your application, please fill out your Student Intake Form and upload the required documentation. Click the button below to proceed:</p>
        
        <div class="button-container">
          <a href="${loginUrl}" class="button">Complete Application</a>
        </div>
        
        <p>Thank you for choosing Certified Australia for your certification needs.</p>
        
        <p>Warm regards,<br>The Certified Australia Team</p>
      `;
    }
  }
  // Case: Partial payment
  else if (isPartialPayment) {
    emailSubject = "Partial Payment Received - Payment Details";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for your partial payment for your application.</p>
      
      <div class="payment-details">
        <h3>Payment Details:</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
          <li><strong>Remaining Balance:</strong> $${
            status.remainingPayment
          }</li>
          <li><strong>Total Application Fee:</strong> $${
            status.price - status.discount
          }</li>
          ${
            status.discount > 0
              ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
              : ""
          }
        </ul>
      </div>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item ${
            status.sifCompleted ? "status-complete" : "status-pending"
          }">${status.sifCompleted ? "✅" : "⚠️"} Student Intake Form: ${
      status.sifCompleted ? "Complete" : "Incomplete"
    }</li>
          <li class="status-item ${
            status.docsCompleted ? "status-complete" : "status-pending"
          }">${status.docsCompleted ? "✅" : "⚠️"} Required Documents: ${
      status.docsCompleted ? "Uploaded" : "Pending"
    }</li>
          <li class="status-item status-pending">⚠️ Payment: Partial (Remaining: $${
            status.remainingPayment
          })</li>
        </ul>
      </div>
      
      <p>To complete your application process, please make the remaining payment by clicking the button below:</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Complete Payment</a>
      </div>
      
      <p>Your application will be sent for approval once all requirements are completed.</p>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;

    // Always notify admin about partial payments
    await notifyAdminAboutPartialPayment(applicationId, status, userData);
  }

  // Send the email
  if (emailSubject && emailBody) {
    const fullEmailBody = emailHeader + emailBody + emailFooter;
    await sendEmail(email, fullEmailBody, emailSubject);
    const adminEmail = "ceo@certifiedaustralia.com.au";
    await sendEmail(adminEmail, fullEmailBody, "Partial Payment Received");
    console.log(`Payment notification email sent to ${email}`);
    return { success: true, emailType: "payment" };
  }

  return {
    success: false,
    message: "No appropriate payment email template found",
  };
};

/**
 * Handles document upload email notifications
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status object
 * @param {Object} userData - The user data
 * @param {string} loginUrl - The login URL with token
 * @returns {Promise<Object>} Result of the email sending
 */
const handleDocsUploadedEmailNotification = async (
  applicationId,
  status,
  userData,
  loginUrl
) => {
  const { firstName, lastName, email } = userData;

  let emailSubject;
  let emailBody;

  // Case: Documents completed and everything else complete
  if (status.docsCompleted && status.sifCompleted && status.fullPaymentMade) {
    emailSubject = "Application Complete - Submitted for Approval";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Congratulations! We're pleased to inform you that your documents have been uploaded successfully and your application has been submitted for approval.</p>
      
      <div class="important-note">
        <h3>Application Status: Complete</h3>
        <ul>
          <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
          <li class="status-item status-complete">✅ Required Documents: Uploaded</li>
          <li class="status-item status-complete">✅ Payment: Completed ($${status.amountPaid})</li>
        </ul>
      </div>
      
      <p>Our assessment team is now reviewing your application and will provide updates as they become available. You can track the progress of your application at any time by clicking the button below.</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">View Application Status</a>
      </div>
      
      <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;

    // Notify RTO team
    await notifyRTOTeam(applicationId, userData);
  }
  // Case: Documents completed, SIF complete, but payment pending
  else if (
    status.docsCompleted &&
    status.sifCompleted &&
    !status.paymentCompleted
  ) {
    emailSubject = "Documents Uploaded - Final Payment Required";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for uploading your documents. They have been received successfully.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
          <li class="status-item status-complete">✅ Required Documents: Uploaded</li>
          <li class="status-item status-pending">⚠️ Payment: Pending</li>
        </ul>
      </div>
      
      <p>Your application is almost complete! The final step is to complete the payment of $${
        status.price - status.discount
      }. Please click the button below to proceed with payment:</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Complete Payment</a>
      </div>

      <div class="button-container">
  <a href="${loginUrl}" class="button">Go to Dashboard</a>
</div>
      
      <p>Your application will be sent for approval immediately after your payment is processed.</p>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;
  }
  // Case: Documents completed but partial payment
  else if (
    status.docsCompleted &&
    status.sifCompleted &&
    status.partialPaymentMade
  ) {
    emailSubject = "Documents Uploaded - Remaining Payment Required";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for uploading your documents. They have been received successfully.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
          <li class="status-item status-complete">✅ Required Documents: Uploaded</li>
          <li class="status-item status-pending">⚠️ Payment: Partial (Remaining: $${
            status.remainingPayment
          })</li>
        </ul>
      </div>
      
      <div class="payment-details">
        <h3>Payment Details:</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
          <li><strong>Remaining Balance:</strong> $${
            status.remainingPayment
          }</li>
          <li><strong>Total Application Fee:</strong> $${
            status.price - status.discount
          }</li>
        </ul>
      </div>
      
      <p>To complete your application process, please make the remaining payment by clicking the button below:</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Complete Payment</a>
      </div>

      <div class="button-container">
  <a href="${loginUrl}" class="button">Go to Dashboard</a>
</div>
      
      <p>Your application will be sent for approval once the full payment is received.</p>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;
  }
  // Case: Documents completed, but SIF pending (this should be rare)
  else if (status.docsCompleted && !status.sifCompleted) {
    emailSubject = "Documents Uploaded - Complete Your Student Intake Form";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for uploading your documents. They have been received successfully.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-pending">⚠️ Student Intake Form: Incomplete</li>
          <li class="status-item status-complete">✅ Required Documents: Uploaded</li>
          <li class="status-item ${
            status.paymentCompleted ? "status-complete" : "status-pending"
          }">${status.paymentCompleted ? "✅" : "⚠️"} Payment: ${
      status.paymentCompleted ? "Complete" : "Pending"
    }</li>
        </ul>
      </div>
      
      <p>To proceed with your application, please complete your Student Intake Form by clicking the button below:</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Complete Student Intake Form</a>
      </div>
      
      ${
        status.paymentCompleted
          ? `<p>We've noticed that you've already completed the payment for your application. Thank you for your prompt attention to this matter.</p>`
          : `<p>After completing your Student Intake Form, you'll need to proceed with the payment to finalize your application.</p>`
      }
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;
  }

  // Send the email
  if (emailSubject && emailBody) {
    const fullEmailBody = emailHeader + emailBody + emailFooter;
    await sendEmail(email, fullEmailBody, emailSubject);
    console.log(`Document upload notification email sent to ${email}`);
    return { success: true, emailType: "documents" };
  }

  return {
    success: false,
    message: "No appropriate document email template found",
  };
};

/**
 * Handles Student Intake Form completion email notifications
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status object
 * @param {Object} userData - The user data
 * @param {string} loginUrl - The login URL with token
 * @returns {Promise<Object>} Result of the email sending
 */
const handleSIFCompletedEmailNotification = async (
  applicationId,
  status,
  userData,
  loginUrl
) => {
  const { firstName, lastName, email } = userData;

  let emailSubject;
  let emailBody;

  // Case: SIF completed but docs and payment pending
  if (
    status.sifCompleted &&
    !status.docsCompleted &&
    !status.paymentCompleted
  ) {
    emailSubject = "Student Intake Form Completed - Next Steps";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for completing your Student Intake Form.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
          <li class="status-item status-pending">⚠️ Required Documents: Pending</li>
          <li class="status-item status-pending">⚠️ Payment: Pending</li>
        </ul>
      </div>
      
      <h3>Next Steps:</h3>
      <p>To proceed with your application, please upload the following required documents:</p>
      <ul>
        <li><strong>Proof of Work Experience:</strong> Resume, job references, or detailed job descriptions</li>
        <li><strong>Educational Transcripts:</strong> Copies of qualifications, certificates, or diplomas</li>
        <li><strong>Skill Evidence:</strong> Additional certifications or training certificates</li>
        <li><strong>Identification Documents:</strong> A copy of your ID</li>
        <li><strong>Identification Documents:</strong> A copy of your ID or passport</li>
      </ul>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Upload Documents</a>
      </div>

      <div class="button-container">
  <a href="${loginUrl}" class="button">Go to Dashboard</a>
</div>
      
      <p>Once you've uploaded your documents, you'll need to complete the payment of $${
        status.price - status.discount
      } to finalize your application.</p>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;
  }
  // Case: SIF completed, docs pending, but payment already made
  else if (
    status.sifCompleted &&
    !status.docsCompleted &&
    status.paymentCompleted
  ) {
    emailSubject = "Student Intake Form Completed - Upload Documents";
    emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for completing your Student Intake Form.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-complete">✅ Student Intake Form: Complete</li>
          <li class="status-item status-pending">⚠️ Required Documents: Pending</li>
          <li class="status-item status-complete">✅ Payment: ${
            status.partialPaymentMade ? "Partially " : ""
          }Completed</li>
        </ul>
      </div>
      
      ${
        status.partialPaymentMade
          ? `
      <div class="payment-details">
        <h3>Payment Details:</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
          <li><strong>Remaining Balance:</strong> $${
            status.remainingPayment
          }</li>
          <li><strong>Total Application Fee:</strong> $${
            status.price - status.discount
          }</li>
        </ul>
      </div>
      `
          : ""
      }
      
      <h3>Next Steps:</h3>
      <p>To proceed with your application, please upload the following required documents:</p>
      <ul>
        <li><strong>Proof of Work Experience:</strong> Resume, job references, or detailed job descriptions</li>
        <li><strong>Educational Transcripts:</strong> Copies of qualifications, certificates, or diplomas</li>
        <li><strong>Skill Evidence:</strong> Additional certifications or training certificates</li>
        <li><strong>Identification Documents:</strong> A copy of your ID or passport</li>
      </ul>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Upload Documents</a>
      </div>
      
      <p>Thank you for choosing Certified Australia.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;
  }

  // Send the email
  if (emailSubject && emailBody) {
    const fullEmailBody = emailHeader + emailBody + emailFooter;
    await sendEmail(email, fullEmailBody, emailSubject);
    console.log(`SIF completion notification email sent to ${email}`);
    return { success: true, emailType: "sif" };
  }

  return { success: false, message: "No appropriate SIF email template found" };
};

/**
 * Fallback method for manual triggers - chooses the most appropriate email based on application status
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status object
 * @param {Object} userData - The user data
 * @param {string} loginUrl - The login URL with token
 * @returns {Promise<Object>} Result of the email sending
 */
const sendContextBasedEmail = async (
  applicationId,
  status,
  userData,
  loginUrl
) => {
  // Determine the best email to send based on application status
  if (status.sifCompleted && status.docsCompleted && status.fullPaymentMade) {
    return handlePaymentEmailNotification(
      applicationId,
      status,
      userData,
      loginUrl,
      false
    );
  } else if (
    status.sifCompleted &&
    status.docsCompleted &&
    status.partialPaymentMade
  ) {
    return handlePaymentEmailNotification(
      applicationId,
      status,
      userData,
      loginUrl,
      true
    );
  } else if (
    status.sifCompleted &&
    status.docsCompleted &&
    !status.paymentCompleted
  ) {
    return handleDocsUploadedEmailNotification(
      applicationId,
      status,
      userData,
      loginUrl
    );
  } else if (status.sifCompleted && !status.docsCompleted) {
    return handleSIFCompletedEmailNotification(
      applicationId,
      status,
      userData,
      loginUrl
    );
  } else if (!status.sifCompleted) {
    // Create a simple reminder email for incomplete SIF
    const { firstName, lastName, email } = userData;

    const emailSubject = "Complete Your Application with Certified Australia";
    const emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      
      <p>Thank you for starting your application with Certified Australia.</p>
      
      <div class="important-note">
        <h3>Application Status:</h3>
        <ul>
          <li class="status-item status-pending">⚠️ Student Intake Form: Incomplete</li>
          <li class="status-item status-pending">⚠️ Required Documents: Pending</li>
          <li class="status-item ${
            status.paymentCompleted ? "status-complete" : "status-pending"
          }">
            ${status.paymentCompleted ? "✅" : "⚠️"} Payment: ${
      status.paymentCompleted ? "Complete" : "Pending"
    }
          </li>
        </ul>
      </div>
      
      <p>To continue with your certification process, please complete your Student Intake Form by clicking the button below:</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Complete Your Application</a>
      </div>

      <div class="button-container">
  <a href="${loginUrl}" class="button">Go to Dashboard</a>
</div>

      
      <h3>Application Process Overview:</h3>
      <ol>
        <li>Complete the Student Intake Form with your personal and educational details</li>
        <li>Upload required documentation to support your application</li>
        <li>Complete the payment process</li>
        <li>Application review and approval</li>
      </ol>
      
      <p>If you need assistance with any part of the application process, please don't hesitate to contact our support team.</p>
      
      <p>Thank you for choosing Certified Australia for your certification needs.</p>
      
      <p>Warm regards,<br>The Certified Australia Team</p>
    `;

    const fullEmailBody = emailHeader + emailBody + emailFooter;
    await sendEmail(email, fullEmailBody, emailSubject);
    console.log(`General application reminder email sent to ${email}`);
    return { success: true, emailType: "general_reminder" };
  }

  return {
    success: false,
    message: "Could not determine appropriate email template",
  };
};

/**
 * Notifies the RTO team when an application is fully completed
 * @param {string} applicationId - The application ID
 * @param {Object} userData - The user data
 * @returns {Promise<void>}
 */
const notifyRTOTeam = async (applicationId, userData) => {
  try {
    const { firstName, lastName } = userData;

    // Get all RTO users
    const rtoSnapshot = await db
      .collection("users")
      .where("role", "==", "rto")
      .get();

    if (rtoSnapshot.empty) {
      console.log("No RTO users found to notify");
      return;
    }

    const batchEmails = [];

    for (const doc of rtoSnapshot.docs) {
      const rtoData = doc.data();
      const rtoEmail = rtoData.email;
      const rtoUserId = doc.id;

      // Create token for RTO login
      const loginToken = await auth.createCustomToken(rtoUserId);
      const rtoLoginUrl = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

      const emailSubject = "New Completed Application Ready for Review";
      const emailBody =
        emailHeader +
        `
        <h2>New Application Ready for Review</h2>
        
        <p>Hello ${rtoData.firstName || "RTO Team Member"},</p>
        
        <p>A new application has been fully completed and is ready for your review.</p>
        
        <div class="important-note">
          <h3>Application Details:</h3>
          <ul>
            <li><strong>Application ID:</strong> ${applicationId}</li>
            <li><strong>Applicant Name:</strong> ${firstName} ${lastName}</li>
            <li><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</li>
          </ul>
        </div>
        
        <p>All required components (Student Intake Form, Documents, and Payment) have been completed.</p>
        
        <div class="button-container">
          <a href="${rtoLoginUrl}" class="button">Review Application</a>
        </div>
        
        <p>Please review this application at your earliest convenience.</p>
        
        <p>Thank you,<br>Certified Australia System</p>
      ` +
        emailFooter;

      batchEmails.push({
        to: rtoEmail,
        subject: emailSubject,
        body: emailBody,
      });
    }

    // Send all emails in parallel
    const emailPromises = batchEmails.map((email) =>
      sendEmail(email.to, email.body, email.subject)
    );

    await Promise.all(emailPromises);
    console.log(
      `Notified ${batchEmails.length} RTO team members about application ${applicationId}`
    );
  } catch (error) {
    console.error("Error notifying RTO team:", error);
  }
};

/**
 * Notifies the admin team about full payments
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status
 * @param {Object} userData - The user data
 * @returns {Promise<void>}
 */
const notifyAdminAboutFullPayment = async (applicationId, status, userData) => {
  try {
    const { firstName, lastName } = userData;

    // Define admin emails
    const adminEmails = [
      "ceo@certifiedaustralia.com.au",
      "applications@certifiedaustralia.com.au",
      "sohaibsipra868@gmail.com",
    ];

    // Get admin user for login URL
    const adminSnapshot = await db
      .collection("users")
      .where("role", "==", "admin")
      .limit(1)
      .get();

    let adminLoginUrl = process.env.CLIENT_URL + "/admin";

    if (!adminSnapshot.empty) {
      const adminDoc = adminSnapshot.docs[0];
      const adminToken = await auth.createCustomToken(adminDoc.id);
      adminLoginUrl = `${process.env.CLIENT_URL}/admin?token=${adminToken}`;
    }

    const emailSubject = "Full Payment Received - Application Complete";
    const emailBody =
      emailHeader +
      `
      <h2>Full Payment Notification</h2>
      
      <p>Hello Administrator,</p>
      
      <p>A full payment has been received for an application.</p>
      
      <div class="important-note">
        <h3>Application Details:</h3>
        <ul>
          <li><strong>Application ID:</strong> ${applicationId}</li>
          <li><strong>Applicant Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</li>
        </ul>
      </div>
      
      <div class="payment-details">
        <h3>Payment Information:</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
          <li><strong>Total Application Fee:</strong> $${
            status.price - status.discount
          }</li>
          ${
            status.discount > 0
              ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
              : ""
          }
        </ul>
      </div>
      
      <p>The application is now complete and has been sent for assessment.</p>
      
      <div class="button-container">
        <a href="${adminLoginUrl}" class="button">View Application</a>
      </div>
      
      <p>Please proceed with the assessment process.</p>
      
      <p>Thank you,<br>Certified Australia System</p>
    ` +
      emailFooter;

    // Send emails to all admin emails
    const uniqueEmails = [...new Set(adminEmails)]; // Remove duplicates
    const emailPromises = uniqueEmails.map((email) =>
      sendEmail(email, emailBody, emailSubject)
    );

    await Promise.all(emailPromises);
    console.log(
      `Notified ${uniqueEmails.length} administrators about full payment for application ${applicationId}`
    );
  } catch (error) {
    console.error("Error notifying admin about full payment:", error);
  }
};

/**
 * Notifies the admin team about partial payments
 * @param {string} applicationId - The application ID
 * @param {Object} status - The application status
 * @param {Object} userData - The user data
 * @returns {Promise<void>}
 */
const notifyAdminAboutPartialPayment = async (
  applicationId,
  status,
  userData
) => {
  try {
    const { firstName, lastName } = userData;

    // Define admin emails
    const adminEmails = [
      "ceo@certifiedaustralia.com.au",
      "applications@certifiedaustralia.com.au",
      "sohaibsipra868@gmail.com",
    ];

    // Get admin user for login URL
    const adminSnapshot = await db
      .collection("users")
      .where("role", "==", "admin")
      .limit(1)
      .get();

    let adminLoginUrl = process.env.CLIENT_URL + "/admin";

    if (!adminSnapshot.empty) {
      const adminDoc = adminSnapshot.docs[0];
      const adminToken = await auth.createCustomToken(adminDoc.id);
      adminLoginUrl = `${process.env.CLIENT_URL}/admin?token=${adminToken}`;
    }

    const emailSubject = "Partial Payment Received - Application Update";
    const emailBody =
      emailHeader +
      `
      <h2>Partial Payment Notification</h2>
      
      <p>Hello Administrator,</p>
      
      <p>A partial payment has been received for an application.</p>
      
      <div class="important-note">
        <h3>Application Details:</h3>
        <ul>
          <li><strong>Application ID:</strong> ${applicationId}</li>
          <li><strong>Applicant Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Payment Date:</strong> ${new Date().toLocaleDateString()}</li>
        </ul>
      </div>
      
      <div class="payment-details">
        <h3>Payment Information:</h3>
        <ul>
          <li><strong>Amount Paid:</strong> $${status.amountPaid}</li>
          <li><strong>Remaining Balance:</strong> $${
            status.remainingPayment
          }</li>
          <li><strong>Total Application Fee:</strong> $${
            status.price - status.discount
          }</li>
          ${
            status.discount > 0
              ? `<li><strong>Discount Applied:</strong> $${status.discount}</li>`
              : ""
          }
        </ul>
      </div>
      
      <p>The applicant has been notified about the remaining balance and instructed to complete the payment.</p>
      
      <div class="button-container">
        <a href="${adminLoginUrl}" class="button">View Application</a>
      </div>
      
      <p>Please monitor this application for the completion of the payment.</p>
      
      <p>Thank you,<br>Certified Australia System</p>
    ` +
      emailFooter;

    // Send emails to all admin emails
    const uniqueEmails = [...new Set(adminEmails)]; // Remove duplicates
    const emailPromises = uniqueEmails.map((email) =>
      sendEmail(email, emailBody, emailSubject)
    );

    await Promise.all(emailPromises);
    console.log(
      `Notified ${uniqueEmails.length} administrators about partial payment for application ${applicationId}`
    );
  } catch (error) {
    console.error("Error notifying admin about partial payment:", error);
  }
};

module.exports = {
  checkApplicationStatusAndSendEmails,
};
