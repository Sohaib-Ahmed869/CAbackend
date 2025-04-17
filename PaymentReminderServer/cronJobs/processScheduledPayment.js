const { db } = require("../config/firebase");
const { sendEmail } = require("../utils/emailUtil");
const { Client, Environment } = require("square");
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox, // or Environment.Sandbox for testing
});
const processScheduledPayment = async (applicationId) => {
  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) return;
    const userId = applicationDoc.data().userId;
    const userRef = await db.collection("users").doc(userId).get();
    const userEmail = userRef.exists ? userRef.data().email : null;
    const AppId = applicationDoc.data().applicationId;

    const appData = applicationDoc.data();
    const price = applicationDoc.data().price;
    const autoDebit = appData.autoDebit || {};

    if (!autoDebit.enabled || autoDebit.status !== "SCHEDULED") return;

    const payment = await squareClient.paymentsApi.createPayment({
      sourceId: autoDebit.squareCardId,
      idempotencyKey: `${applicationId}-${Date.now()}`,
      amountMoney: {
        amount: Math.round(autoDebit.amountDue * 100),
        currency: "AUD",
      },
      customerId: autoDebit.squareCustomerId,
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Scheduled payment for Application ID: ${applicationId}`,
    });

    if (payment.result.payment.status === "COMPLETED") {
      const updateData = {
        "autoDebit.status": "COMPLETED",
        amount_paid: price,
        paymentDate: new Date().toISOString(),
        full_paid: true,
      };

      await applicationRef.update(updateData);

      const formattedPaymentDate = new Date().toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });

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
                .header img {
                    max-width: 200px;
                }
                .content {
                    padding: 32px;
                    line-height: 1.6;
                }
                .message {
                    font-size: 16px;
                    color: #555;
                    margin-bottom: 20px;
                }
                .details-card {
                    background: #f9fafb;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    border-left: 4px solid #089C34;
                }
                .card-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #222;
                    margin-bottom: 15px;
                }
                .detail-item {
                    margin: 10px 0;
                    display: flex;
                    justify-content: space-between;
                }
                .detail-label {
                    color: #666;
                    font-weight: 500;
                    margin-right: 10px;
                }
                .detail-value {
                    font-weight: 500;
                    color: #222;
                }
                .footer {
                    background: #fff;
                    padding: 20px;
                    text-align: center;
                    font-size: 14px;
                    color: #666;
                }
                .footer a {
                    color: #666;
                    font-weight: 600;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
        <div class="email-container">
            <div class="header">
                <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia">
            </div>
            <div class="content">
                <h1 style="color: #089C34; margin-bottom: 25px;">Direct Debit Payment Confirmation</h1>
                
                <p class="message">Dear Applicant,</p>
                <p class="message">We're pleased to confirm your payment for application <strong>#${AppId}</strong> has been successfully processed. Below are your transaction details:</p>
  
                <div class="details-card">
                    <div class="card-title">Payment Details</div>
                    <div class="detail-item">
                        <span class="detail-label">Payment Type:</span>
                        <span class="detail-value">DIRECT DEBIT</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Amount Paid:</span>
                        <span class="detail-value">$${autoDebit.amountDue}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Processed Date:</span>
                        <span class="detail-value">${formattedPaymentDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Transaction ID:</span>
                        <span class="detail-value">${payment.result.payment.id}</span>
                    </div>
                </div>
            </div>
            <div class="footer">
                <p>© 2025 Certified Australia. All rights reserved.</p>
                <p>Need help? <a href="mailto:support@certifiedaustralia.com.au" class="footer-link">Contact Support</a></p>
            </div>
        </div>
    </body></html>`;
      const subject = `Payment Confirmation for Application ${AppId}`;
      await sendEmail(userEmail, emailBody, subject);

      return true;
    }
  } catch (error) {
    console.error("Scheduled Payment Error:", error);
    const applicationRef = db.collection("applications").doc(applicationId);
    await applicationRef.update({
      "autoDebit.status": "FAILED",
      "autoDebit.lastError": error.message,
    });
    return false;
  }
};
module.exports = { processScheduledPayment };
