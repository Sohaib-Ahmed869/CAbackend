const nodemailer = require("nodemailer");

// Configure the transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility function to send an email with attachments
const MailApplicationToRto = async (
  recipientEmail,
  emailBody,
  emailSubject,
  attachments = []
) => {
  try {
    const mailOptions = {
      from: `"Certified Australia" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: emailSubject,
      text: emailBody,
      html: `<div><p>${emailBody}</p></div>`,
      attachments, // Add attachments array here
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

module.exports = { MailApplicationToRto };
