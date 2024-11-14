// controllers/documentController.js
const { db, bucket, auth } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/emailUtil");

// Update Documents Form with PDF uploads
const DocumentsFormByApplicationId = async (req, res) => {
  const { applicationId } = req.params;
  console.log(req.files);
  console.log(req.body);
  //read the form data from the request
  const documentFiles = req.files;

  try {
    // Step 1: Get documentsFormId from application document
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

    // Step 2: Upload PDFs to Firebase Storage and get URLs
    const fileUrls = {};

    for (const [key, fileArray] of Object.entries(documentFiles)) {
      const file = fileArray[0]; // Access the first file in the array

      if (!file) {
        continue;
      }

      const imageToken = uuidv4();

      const accessToken = uuidv4();
      const fileName = `${imageToken}`;
      const fileRef = bucket.file(fileName);

      // Create a write stream for Firebase Storage
      const blobStream = fileRef.createWriteStream({
        metadata: {
          contentType: file.mimetype,
          metadata: { firebaseStorageDownloadTokens: accessToken },
        },
      });

      // Await for the stream to finish
      await new Promise((resolve, reject) => {
        blobStream.on("error", (error) => reject(error));
        blobStream.on("finish", () => {
          const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileName}?alt=media&token=${accessToken}`;
          fileUrls[key] = fileUrl;
          resolve();
        });
        blobStream.end(file.buffer);
      });
    }

    // Step 3: Update Firestore document with URLs of uploaded files
    const formRef = db.collection("documents").doc(documentsFormId);
    await formRef.update(fileUrls);

    //update application status
    await applicationRef.update({
      currentStatus: "Sent to RTO",
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Sent to RTO",
          time: new Date().toISOString(),
        },
      ],
    });
    const userId = applicationDoc.data().userId;
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();
      const emailBody = `
     <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
      <p style="color: #34495e;">Hello ${firstName} ${lastName},</p>
      <p>Your documents have been successfully uploaded.</p>
      <p style="font-style: italic;">Please wait while we verify your documents.</p>
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

    if (applicationDoc.data().paid) {
      const rto = await db.collection("users").where("role", "==", "rto").get();
      rto.forEach(async (doc) => {
        const rtoEmail = doc.data().email;
        const rtoUserId = doc.data().id;
        const loginToken = await auth.createCustomToken(rtoUserId);
        const URL2 = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

        const emailBody = `
      <h2 style="color: #2c3e50;">🎉 Application Completed! 🎉</h2>
      <p style="color: #34495e;">Hello RTO,</p>
      <p>A user has completed their application</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Certificate</a>
      <p style="font-style: italic;">For more details, please visit the rto dashboard.</p>
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

        await sendEmail(rtoEmail, emailBody, emailSubject);
      });
    }

    res.status(200).json({
      message: "Documents Form updated successfully",
      files: fileUrls,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { DocumentsFormByApplicationId };
