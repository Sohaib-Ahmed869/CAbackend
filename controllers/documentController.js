// controllers/documentController.js
const { db, bucket } = require("../firebase");
const { v4: uuidv4 } = require("uuid");

// Update Documents Form with PDF uploads
const DocumentsFormByApplicationId = async (req, res) => {
  const { applicationId } = req.params;
  console.log(req.files);
  console.log(req.body);
  //read the form data from the request
  const documentFiles = req.body;

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
