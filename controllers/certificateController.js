const { db, bucket } = require("../firebase");
const { v4: uuidv4 } = require("uuid");

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

    res.status(200).json({ message: "Certificate uploaded successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { UploadCertificate };
