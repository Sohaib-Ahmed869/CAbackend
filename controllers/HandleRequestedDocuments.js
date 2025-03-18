const { db } = require("../firebase");
const multer = require("multer");
const { getStorage } = require("firebase-admin/storage");
const { sendEmail } = require("../utils/emailUtil");
// const requestMoreDocuments = async (req, res) => {
//   const { id } = req.params;
//   const { requestedDocuments } = req.body;

//   try {
//     // Fetch the application document
//     const applicationRef = db.collection("applications").doc(id);
//     const applicationDoc = await applicationRef.get();

//     if (!applicationDoc.exists) {
//       return res.status(404).json({ message: "Application not found" });
//     }

//     // Get existing requestedDocuments from the application (if any)
//     const existingData = applicationDoc.data();
//     const existingDocuments = existingData.requestedDocuments || [];

//     // Ensure requestedDocuments is a valid array
//     if (!Array.isArray(requestedDocuments) || requestedDocuments.length === 0) {
//       return res.status(400).json({ message: "No documents requested" });
//     }

//     // Convert existing documents into a map using the name as the key
//     const documentMap = new Map(
//       existingDocuments.map((doc) => [doc.name.toLowerCase(), doc])
//     );

//     // Add or update documents
//     requestedDocuments.forEach((doc) => {
//       const docNameLower = doc.name.toLowerCase(); // Normalize name comparison

//       if (documentMap.has(docNameLower)) {
//         // If the document name exists, update its requestedDate
//         documentMap.get(docNameLower).requestedDate = new Date().toISOString();
//       } else {
//         // Otherwise, add the new document
//         documentMap.set(docNameLower, {
//           id: doc.id,
//           name: doc.name,
//           requestedDate: new Date().toISOString(),
//         });
//       }
//     });

//     // Convert back to an array
//     const updatedDocuments = Array.from(documentMap.values());

//     // Update the application with merged documents & set documentsUploaded to false
//     await applicationRef.update({
//       requestedDocuments: updatedDocuments,
//       documentsUploaded: false, // Set to false when new documents are requested
//     });

//     res.status(200).json({ message: "Documents requested successfully" });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };
// Multer setup for handling file uploads
const requestMoreDocuments = async (req, res) => {
  const { id } = req.params;
  const { requestedDocuments } = req.body;

  try {
    // Fetch application document
    const applicationRef = db.collection("applications").doc(id);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const existingData = applicationDoc.data();
    const userId = existingData.userId;
    const documentsFormId = existingData.documentsFormId;
    const applicationId = existingData.applicationId;

    // Validate requested documents
    if (!Array.isArray(requestedDocuments) || requestedDocuments.length === 0) {
      return res.status(400).json({ message: "No documents requested" });
    }

    // Merge documents logic
    const existingDocuments = existingData.requestedDocuments || [];
    const documentMap = new Map(
      existingDocuments.map((doc) => [doc.name.toLowerCase(), doc])
    );

    requestedDocuments.forEach((doc) => {
      const docNameLower = doc.name.toLowerCase();
      documentMap.set(docNameLower, {
        ...doc,
        requestedDate: new Date().toISOString(),
      });
    });

    const updatedDocuments = Array.from(documentMap.values());

    // Update application
    await applicationRef.update({
      requestedDocuments: updatedDocuments,
      documentsUploaded: false,
    });

    // Fetch user details
    const userDoc = await db.collection("users").doc(userId).get();
    let userData = { firstName: "", lastName: "", email: "" };
    if (userDoc.exists) userData = userDoc.data();

    // Fetch documents form data
    const documentsFormDoc = await db
      .collection("documents")
      .doc(documentsFormId)
      .get();
    const documentsFormData = documentsFormDoc.exists
      ? documentsFormDoc.data()
      : {};

    // Generate document status list
    const documentStatusList = updatedDocuments
      .map((doc) => {
        const docField = documentsFormData[doc.name];
        const status = docField?.fileUrl
          ? `<a href="${docField.fileUrl}" style="color: #089C34; text-decoration: none;">Uploaded</a>`
          : '<span style="color: #dc3545;">Pending</span>';
        return `<li>${doc.name}: ${status}</li>`;
      })
      .join("");
    const adminEmail = "applications@certifiedaustralia.com.au";

    // User Email Template
    const userEmailBody = `
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
                max-width: 640px;
                margin: 30px auto;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                overflow: hidden;
            }
            .header {
                background: #089C34;
                color: #fff;
                padding: 32px;
                text-align: center;
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
            }
            .card-title {
                font-size: 18px;
                font-weight: 600;
                color: #222;
            }
            .document-list {
                list-style: none;
                padding: 0;
                margin: 10px 0;
            }
      .document-item {
    display: flex;
    justify-content: space-between !important; /* Ensures name is on the left and status on the right */
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eaeaea;
}

.document-name {
width:350px;
    font-weight: 500;
    color: #444;
    flex-grow: 1; /* Ensures name takes up available space */
    text-align: left;
}

.status-pill {
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    min-width: 100px; /* Ensures proper width */
    text-align: center;
}

.uploaded {
    background: #e6f4ea;
    color: #089C34;
    border: 1px solid #089C34;
}

.pending {
    background: #fef2f2;
    color: #d93025;
    border: 1px solid #d93025;
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
            }
            .footer {
                background: #f1f3f5;
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
                <p class="message">
                    Hello, <br>We are updating you on your document submission status. Please review the details below.
                </p>
                <div class="status-card">
                    <h3 class="card-title">Requested Documents</h3>
               <ul class="document-list">
    ${updatedDocuments
      .map((doc) => {
        const docField = documentsFormData[doc.name];
        const isUploaded = !!docField?.fileUrl;
        return `
        <li class="document-item">
            <span class="document-name">${doc.name}</span>
            <span class="status-pill ${isUploaded ? "uploaded" : "pending"}">
                ${isUploaded ? "Uploaded ✓" : "Pending ⓘ"}
            </span>
        </li>`;
      })
      .join("")}
</ul>

                </div>
                <p class="message">
                    To complete your application, please upload all required documents through your portal.
                </p>
          
            </div>
            <div class="footer">
                <p>© 2025 Certified Australia. All rights reserved.</p>
                <p>Need help? <a href="mailto:support@certifiedaustralia.com.au">Contact Support</a></p>
            </div>
        </div>
    </body>
    </html>`;

    await sendEmail(
      userData.email,
      userEmailBody,
      "Document Status Update - Certified Australia"
    );

    // Admin Email Template
    const adminEmailBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: 'Inter', sans-serif;
                background: #f8f9fb;
                color: #333;
                padding: 0;
            }
            .email-container {
                max-width: 640px;
                margin: 30px auto;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            }
            .header {
                background: #089C34;
                color: #fff;
                padding: 28px;
                text-align: center;
            }
            .content {
                padding: 28px;
                line-height: 1.6;
            }
            .status-card {
                background: #f9fafb;
                padding: 16px;
                border-left: 4px solid #089C34;
                border-radius: 6px;
                margin: 20px 0;
            }
            .document-list {
                list-style: none;
                padding: 0;
            }
      .document-item {
    display: flex;
    justify-content: space-between !important; /* Ensures name is on the left and status on the right */
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #eaeaea;
}

.document-name {
width:350px;

    font-weight: 500;
    color: #444;
    flex-grow: 1; /* Ensures name takes up available space */
    text-align: left;
}

.status-pill {
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 14px;
    font-weight: 600;
    text-align: center;
    white-space: nowrap;
    min-width: 100px; /* Ensures proper width */
    text-align: center;
}

.uploaded {
    background: #e6f4ea;
    color: #089C34;
    border: 1px solid #089C34;
}

.pending {
    background: #fef2f2;
    color: #d93025;
    border: 1px solid #d93025;
}
      .footer {
                background: #f1f3f5;
                padding: 16px;
                text-align: center;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="header">
                <h2>Admin Notification</h2>
            </div>
            <div class="content">
                <h3>Application ID: ${applicationId}</h3>
                <p><strong>Applicant:</strong> ${userData.firstName} ${
      userData.lastName
    }</p>
                <div class="status-card">
                    <h3>Documents Overview</h3>
           <ul class="document-list">
    ${updatedDocuments
      .map((doc) => {
        const docField = documentsFormData[doc.name];
        const isUploaded = !!docField?.fileUrl;
        return `
        <li class="document-item">
            <span class="document-name">${doc.name}</span>
            <span class="status-pill ${isUploaded ? "uploaded" : "pending"}">
                ${isUploaded ? "Uploaded ✓" : "Pending ⓘ"}
            </span>
        </li>`;
      })
      .join("")}
</ul>


                </div>
            </div>
            <div class="footer">
                <p>Certified Australia - Document Management</p>
            </div>
        </div>
    </body>
    </html>`;

    await sendEmail(
      adminEmail,
      adminEmailBody,
      `Document Update - ${applicationId}`
    );

    res.status(200).json({ message: "Documents updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const upload = multer({ storage: multer.memoryStorage() });

// Upload requested documents to Firebase Storage
const uploadRequestedDocuments = async (req, res) => {
  const { applicationId } = req.params;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const storage = getStorage().bucket();
    let uploadedFiles = [];

    // Upload each file to Firebase Storage
    await Promise.all(
      req.files.map(async (file) => {
        const fileName = `documents/${applicationId}/${file.originalname}`;
        const fileRef = storage.file(fileName);

        await fileRef.save(file.buffer, {
          metadata: { contentType: file.mimetype },
        });

        const fileURL = `https://firebasestorage.googleapis.com/v0/b/${
          storage.name
        }/o/${encodeURIComponent(fileName)}?alt=media`;

        uploadedFiles.push({ name: file.originalname, url: fileURL });
      })
    );

    // Update Firestore with uploaded file URLs
    await applicationRef.update({
      uploadedDocuments: uploadedFiles,
    });

    res
      .status(200)
      .json({ message: "Documents uploaded successfully", uploadedFiles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Export with Multer middleware
module.exports = {
  uploadRequestedDocuments: [
    upload.array("documents"),
    uploadRequestedDocuments,
  ],
};

module.exports = { requestMoreDocuments };
