// controllers/documentController.js
const { db, bucket, auth } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/emailUtil");

const DocumentsFormByApplicationId = async (req, res) => {
  const { applicationId } = req.params;
  console.log(req.files);
  console.log(req.body);

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

    // Step 2: Upload PDFs to Firebase Storage in parallel and get URLs
    const fileUploadPromises = Object.entries(documentFiles).map(
      async ([key, fileArray]) => {
        const file = fileArray[0]; // Access the first file in the array
        if (!file) return null;

        const imageToken = uuidv4();
        const accessToken = uuidv4();
        const fileName = `${imageToken}`;
        const fileRef = bucket.file(fileName);

        // Create a write stream for Firebase Storage
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

        return {
          key,
          url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${fileName}?alt=media&token=${accessToken}`,
        };
      }
    );

    const uploadResults = await Promise.all(fileUploadPromises);

    // Collect file URLs
    const fileUrls = {};
    uploadResults.forEach((result) => {
      if (result) {
        fileUrls[result.key] = result.url;
      }
    });

    // Step 3: Update Firestore document with URLs of uploaded files
    const formRef = db.collection("documents").doc(documentsFormId);
    await formRef.update(fileUrls);

    // Update application status
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
      const emailBody = `...`; // Email content (same as original code)
      const emailSubject = "Documents Sent for Verification";
      await sendEmail(email, emailBody, emailSubject);
    }

    if (applicationDoc.data().paid) {
      const rto = await db.collection("users").where("role", "==", "rto").get();
      const rtoEmailsPromises = rto.docs.map(async (doc) => {
        const rtoEmail = doc.data().email;
        const rtoUserId = doc.data().id;
        const loginToken = await auth.createCustomToken(rtoUserId);
        const URL2 = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

        const emailBody = `...`; // RTO Email content (same as original code)
        const emailSubject = "Application Submitted";

        await sendEmail(rtoEmail, emailBody, emailSubject);
      });

      await Promise.all(rtoEmailsPromises);
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
