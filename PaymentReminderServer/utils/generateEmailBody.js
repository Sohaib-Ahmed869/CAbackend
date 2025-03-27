const { auth } = require("../config/firebase");
const generateEmailBody = async ({
  applicationId,
  price,
  amount_paid,
  deadline,
  reminderType,
  userId,
}) => {
  const amountOwed = price - amount_paid;
  const isOverdue = reminderType.includes("Overdue");
  const token = await auth.createCustomToken(userId);
  const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

  return `
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
                background:  #fff;
                color: #fff;
                padding: 24px;
                text-align: center;
                font-size: 20px;
                font-weight: 600;
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
            .status-card {
                background: #f9fafb;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #089C34;
                box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.05);
            }
            .card-title {
                font-size: 18px;
                font-weight: 600;
                color: #222;
                margin-bottom: 10px;
            }
            .cta {
                text-align: center;
                margin: 30px 0;
            }
            .cta a {
                background: #089C34;
                color: #fff;
                padding: 14px 26px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                box-shadow: 0 4px 10px rgba(8, 156, 52, 0.3);
                transition: background 0.3s ease-in-out;
            }
            .cta a:hover {
                background: #07752a;
            }
            .footer {
                background: #fff;
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #666;
            }
            .footer a {
                color: #089C34;
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
                <h1> ${
                  isOverdue
                    ? "⚠ Overdue Payment Reminder"
                    : "💰 Payment Reminder"
                } </h1>
                <p class="message">
                    Dear Applicant, <br><br>
                    Your application <b>#${applicationId}</b> has a pending payment.
                </p>
                <div class="status-card">
                    <h3 class="card-title">${reminderType}</h3>
                    <p><b>Price:</b> $${price}</p>
                    <p><b>Amount Paid:</b> $${amount_paid}</p>
                    <p><b>Amount Owed:</b> $${amountOwed}</p>
                    <p><b>Deadline:</b> ${deadline}</p>
                </div>
                <p class="message">
                    Please complete your payment as soon as possible to avoid any delays in your application process.
                </p>
                <div class="cta">
                    <a href=${loginUrl}>Make Payment</a>
                </div>
            </div>
            <div class="footer">
                <p>© 2025 Certified Australia. All rights reserved.</p>
                <p>Need help? <a href="mailto:support@certifiedaustralia.com.au">Contact Support</a></p>
            </div>
        </div>
    </body>
    </html>`;
};

module.exports = generateEmailBody;
