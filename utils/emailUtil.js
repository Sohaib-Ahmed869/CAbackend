// emailUtil.js
const nodemailer = require("nodemailer");

// Configure the transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service provider (e.g., Gmail, Outlook, etc.)
  auth: {
    user: process.env.EMAIL_USER, // Your email address (store in environment variable for security)
    pass: process.env.EMAIL_PASS, // Your email password (store in environment variable)
  },
});

// Utility function to send an email
const sendEmail = async (recipientEmail, emailBody, emailSubject) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender's email address
      to: recipientEmail, // Recipient's email address
      subject: emailSubject, // Subject of the email
      text: emailBody, // Plain text body
      html: ` 
        <div>
          <p>${emailBody}</p>
        </div>
        <div>
          <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wUrVPXmmjHfiEam1_OOvAyse2Vb-ygiKj2i4zvyK9wTcDIVKIhiG2sjtDIT8vUcuyqK5kdTlu9NrOm" alt="Company Logo" style="width: 150px; height: auto; margin-bottom: 20px;">
        </div>`, // HTML body (optional, if you want to format it)
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: ", info.response);
    return { success: true, message: "Email sent successfully" };
  } catch (error) {
    console.error("Error sending email: ", error);
    return { success: false, message: "Failed to send email", error };
  }
};

module.exports = { sendEmail };
