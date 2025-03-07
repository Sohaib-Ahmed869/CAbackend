// controllers/documentController.js
const { db, bucket, auth } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/emailUtil");

const DocumentsFormByApplicationId = async (req, res) => {
  try {
    const { applicationId } = req.params;
    console.log("Final submit received:", req.body);

    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();
    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const appData = applicationDoc.data();
    const { userId, documentsFormId, paid, status } = appData;
    if (!documentsFormId) {
      return res
        .status(404)
        .json({ message: "Documents Form ID not found in application" });
    }
    if (!userId) {
      return res
        .status(404)
        .json({ message: "User ID not found in application" });
    }

    // 2. Update the application doc to reflect final submission
    const newStatus = {
      statusname: "Sent to RTO",
      time: new Date().toISOString(),
    };

    // Set documentsUploaded to true (or any field name you like)
    await applicationRef.update({
      documentsUploaded: true,
      currentStatus: "Sent to RTO",
      status: [...(status || []), newStatus],
    });
    // const userRef = db.collection("users").doc(userId);
    // const userDoc = await userRef.get();
    // if (userDoc.exists) {
    //   const { email, firstName, lastName } = userDoc.data();
    //   const emailBody = `
    //     <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
    //     <p style="color: #34495e;">Hello ${firstName} ${lastName},</p>
    //     <p>Your documents have been successfully uploaded.</p>
    //     <p style="font-style: italic;">Please wait while we verify your documents.</p>
    //     <p>Thank you for your attention.</p>
    //     <p>
    //       <strong>Best Regards,</strong><br>
    //       The Certified Australia Team<br>
    //       Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    //       Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    //       Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    //     </p>
    //   `;
    //   const emailSubject = "Documents Sent for Verification";
    //   await sendEmail(email, emailBody, emailSubject);
    // }
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
    const { email, firstName, lastName } = userDoc.data();
    let additionalContent = "";

    if (appData.paymentStatus && appData.paymentStatus.toLowerCase() === "pending") {
      additionalContent += `
        <p>Please complete your payment by clicking the button below:</p>
        <p>
          <a href="${process.env.PAYMENT_URL}" 
              style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Complete Payment
          </a>
        </p>
      `;
    }
    if (!appData.studentIntakeFormSubmitted) {
      additionalContent += `
        <p>Please complete your Student Intake Form by clicking the button below:</p>
        <p>
          <a href="${process.env.STUDENT_INTAKE_FORM_URL}" 
              style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Complete Student Intake Form
          </a>
        </p>
      `;
    }
    if(appData.paymentStatus && appData.paymentStatus.toLowerCase() === "pending"&&!appData.studentIntakeFormSubmitted){
      additionalContent += `
        <p>Please complete your Student Intake Form by clicking the button below:</p>
        <p>
          <a href="${process.env.STUDENT_INTAKE_FORM_URL}" 
              style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Complete Student Intake Form
          </a>
        </p>
      `;
      additionalContent += `
        <p>Please complete your payment by clicking the button below:</p>
        <p>
          <a href="${process.env.PAYMENT_URL}" 
              style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Complete Payment
          </a>
        </p>
      `;
    }

    const emailBody = `
      <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
      <p style="color: #34495e;">Hello ${firstName} ${lastName},</p>
      <p>Your documents have been successfully uploaded.</p>
      <p style="font-style: italic;">Please wait while we verify your documents.</p>
      ${additionalContent}
      <p>Thank you for your attention.</p>
      <p>
        <strong>Best Regards,</strong><br>
        The Certified Australia Team<br>
        Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
        Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
        Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
      </p>
    `;
    const emailSubject = "Documents Sent for Verification";
    await sendEmail(email, emailBody, emailSubject);
    }
    if (paid) {
      const rtoSnapshot = await db
        .collection("users")
        .where("role", "==", "rto")
        .get();

      const batchEmails = [];

      rtoSnapshot.forEach((doc) => {
        const rtoEmail = doc.data().email;
        const rtoUserId = doc.data().id;
        const loginToken = auth.createCustomToken(rtoUserId);
        const URL2 = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

        const emailBody = `
          <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
          <p style="color: #34495e;">Hello RTO,</p>
          <p>A user has completed their application.</p>
          <p>Click the button below to view the application:</p>
          <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Certificate</a>
          <p style="font-style: italic;">For more details, please visit the RTO dashboard.</p>
          <p>Thank you for your attention.</p>
          <p>
            <strong>Best Regards,</strong><br>
            The Certified Australia Team<br>
            Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
            Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
            Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
          </p>
        `;
        const emailSubject = "Application Submitted";

        batchEmails.push({
          to: rtoEmail,
          subject: emailSubject,
          body: emailBody,
        });
      });

      const emailBatchPromises = batchEmails.map((email) =>
        sendEmail(email.to, email.body, email.subject)
      );
      await Promise.all(emailBatchPromises);
    }

    return res.status(200).json({
      message: "Documents Form updated successfully and emails sent",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

const uploadSingleFile = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { fieldName } = req.body;

    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();
    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const appData = applicationDoc.data();
    const { userId, documentsFormId } = appData;
    if (!documentsFormId) {
      return res.status(404).json({ message: "Documents Form ID not found in application" });
    }
    if (!userId) {
      return res.status(404).json({ message: "User ID not found in application" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "No file provided" });
    }
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "video/mp4",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return res.status(400).json({
        message: "Invalid file format. Only JPG, PNG, PDF, DOCX, and MP4 files are allowed.",
      });
    }
    const imageToken = uuidv4();
    const accessToken = uuidv4();
    const fileName = `${userId}/${applicationId}/${fieldName}/${imageToken}_${file.originalname}`;
    const fileRef = bucket.file(fileName);

    await new Promise((resolve, reject) => {
      const blobStream = fileRef.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: { firebaseStorageDownloadTokens: accessToken },
        },
      });
      blobStream.on("error", (error) => reject(error));
      blobStream.on("finish", () => resolve());
      blobStream.end(file.buffer);
    });

    const encodedFileName = encodeURIComponent(fileName);
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedFileName}?alt=media&token=${accessToken}`;

    const documentsRef = db.collection("documents").doc(documentsFormId);
    await documentsRef.update({
      [fieldName]: {
        fileUrl,
        fileName,
        accessToken,
      },
    });

    return res.status(200).json({
      message: "File uploaded successfully",
      fileUrl,
    });
  }catch (error) {
    return res.status(404).json({ message: error.message });
  }
  finally {
    }
};
const deleteSingleFile = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { fieldName } = req.query;

    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();
    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const { documentsFormId } = applicationDoc.data();
    if (!documentsFormId) {
      return res
        .status(404)
        .json({ message: "Documents Form ID not found in application" });
    }

    const documentsRef = db.collection("documents").doc(documentsFormId);
    const documentsDoc = await documentsRef.get();
    if (!documentsDoc.exists) {
      return res.status(404).json({ message: "Documents form not found" });
    }

    const fieldData = documentsDoc.data()[fieldName];
    if (!fieldData) {
      return res
        .status(400)
        .json({ message: `No file stored for field: ${fieldName}` });
    }
    const { fileName } = fieldData;
    await bucket.file(fileName).delete();
    await documentsRef.update({
      [fieldName]: null,
    });

    return res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};
module.exports = { DocumentsFormByApplicationId,  uploadSingleFile,deleteSingleFile, };


