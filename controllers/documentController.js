// controllers/documentController.js
const { db, bucket, auth } = require("../firebase");
const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../utils/emailUtil");
const {
  checkApplicationStatusAndSendEmails,
} = require("../utils/applicationEmailService");

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

    // Update the application doc to reflect final submission
    const newStatus = {
      statusname: "Documents Uploaded",
      time: new Date().toISOString(),
    };

    // Set documentsUploaded to true
    await applicationRef.update({
      documentsUploaded: true,
      currentStatus: "Documents Uploaded",
      status: [...(status || []), newStatus],
    });

    // Use the comprehensive email service instead of sending emails directly
    await checkApplicationStatusAndSendEmails(applicationId, "docs_uploaded");

    return res.status(200).json({
      message:
        "Documents Form updated successfully and appropriate emails sent",
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
      return res
        .status(404)
        .json({ message: "Documents Form ID not found in application" });
    }
    if (!userId) {
      return res
        .status(404)
        .json({ message: "User ID not found in application" });
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
        message:
          "Invalid file format. Only JPG, PNG, PDF, DOCX, and MP4 files are allowed.",
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
  } catch (error) {
    return res.status(404).json({ message: error.message });
  } finally {
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
module.exports = {
  DocumentsFormByApplicationId,
  uploadSingleFile,
  deleteSingleFile,
};
