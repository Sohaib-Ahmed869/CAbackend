const { db, bucket, auth } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/emailUtil");

const express = require("express");
const app = express();

const UploadCertificate = async (req, res) => {
  try {
    const { applicationId } = req.params;

    console.log("Received file:", req.file); // For `multer`

    if (!req.file) {
      return res.status(400).json({ message: "No certificate file uploaded." });
    }

    const certificate = req.file;
    console.log("Application ID:", applicationId);
    console.log("Certificate File:", certificate);
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    //upload the document and store its link in application.certificateId

    const certificateId = uuidv4();
    const certificateFile = bucket.file(certificateId);
    const certificateToken = uuidv4();
    const certificateFileName = `${certificateId}`;
    let certificateUrl = "";
    const blobStream = certificateFile.createWriteStream({
      metadata: {
        contentType: certificate.mimetype,
        metadata: { firebaseStorageDownloadTokens: certificateToken },
      },
    });

    await new Promise((resolve, reject) => {
      blobStream.on("error", (error) => reject(error));
      blobStream.on("finish", () => {
        certificateUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${certificateFileName}?alt=media&token=${certificateToken}`;
        resolve();
      });
      blobStream.end(certificate.buffer);
    });

    await applicationRef.update({
      certificateId: certificateUrl,
    });

    //update application status
    await applicationRef.update({
      currentStatus: "Certificate Generated",
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Certificate Generated",
          time: new Date().toISOString(),
        },
      ],
    });
    // Fetch user email and send notification
    const { userId } = applicationDoc.data();
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const token = await auth.createCustomToken(userId);

    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();
      const emailBody = `
      <h2>Dear ${firstName} ${lastName},</h2>
      <p>Contragulations! YOU ARE NOW CERTIFIED! 🥳
      You can download it from the following link:</p>
      <p>Congratulations! We’re excited to inform you that your Recognition of Prior Learning (RPL) application has been successfully assessed, and you are now CERTIFIED in your chosen qualification.</p>
     <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Certificate</a>

      <p>You can access the digital version of your certificate in your student portal. Simply log in to download and view it.</p>
      <p>
    <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
      const emailSubject = "Certificate Generated";
      await sendEmail(email, emailBody, emailSubject);
    }

    if (userDoc.exists) {
      //get admin ID
      const adminSnapshot = await db
        .collection("users")
        .where("role", "==", "admin")
        .get();

      //send email to admin
      adminSnapshot.forEach(async (doc) => {
        const { email } = doc.data();
        const id = doc.id;
        const loginToken = await auth.createCustomToken(id);
        const loginUrl = `${process.env.CLIENT_URL}/admin?token=${loginToken}`;

        const emailBody = `
        <h2>New Certificate Generated</h2>
        <p>A new certificate has been generated for the user.
        You can view it by clicking on the link below:</p>
        <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Certificate</a>
        <p>For more details, please visit your dashboard.</p>
        <p>Regards,</p>
        <p>Certified Australia</p>
        `;

        const emailSubject = "Certificate Generated";
        await sendEmail(email, emailBody, emailSubject);
      });
    }

    res.status(200).json({ message: "Certificate uploaded successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { UploadCertificate };
