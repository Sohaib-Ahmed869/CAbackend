// googleDriveUtils.js
const { google } = require("googleapis");
const axios = require("axios");
const stream = require("stream");

// Initialize auth client
const initializeAuth = () => {
  try {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };

    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/drive"]
    );

    return auth;
  } catch (error) {
    console.error("Error initializing Google auth:", error);
    throw error;
  }
};

// Create a folder in Google Drive
const createDriveFolder = async (folderName) => {
  try {
    const auth = initializeAuth();
    const drive = google.drive({ version: "v3", auth });

    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folder = await drive.files.create({
      resource: folderMetadata,
      fields: "id",
    });

    const folderId = folder.data.id;

    // Set permissions to make the folder accessible with anyone with the link
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Get folder link
    const folderLink = `https://drive.google.com/drive/folders/${folderId}`;

    return {
      folderId,
      folderLink,
    };
  } catch (error) {
    console.error("Error creating Google Drive folder:", error);
    throw error;
  }
};

// Upload a file to Google Drive
const uploadFileToDrive = async (fileUrl, fileName, parentFolderId) => {
  try {
    const auth = initializeAuth();
    const drive = google.drive({ version: "v3", auth });

    // Download file from URL
    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream",
    });

    // Prepare the buffer stream
    const bufferStream = new stream.PassThrough();
    response.data.pipe(bufferStream);

    // Determine MIME type (simplified version)
    const extension = fileName.split(".").pop().toLowerCase();
    let mimeType = "application/octet-stream"; // Default

    // Map common extensions to MIME types
    const mimeTypes = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      txt: "text/plain",
    };

    if (mimeTypes[extension]) {
      mimeType = mimeTypes[extension];
    }

    // Create file metadata
    const fileMetadata = {
      name: fileName,
      parents: [parentFolderId],
    };

    // Create media
    const media = {
      mimeType: mimeType,
      body: bufferStream,
    };

    // Upload the file
    const file = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    const fileId = file.data.id;

    // Set permissions to make the file accessible to anyone with the link
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Get file links
    const viewLink = `https://drive.google.com/file/d/${fileId}/view`;
    const downloadLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

    return {
      fileId,
      viewLink,
      downloadLink,
    };
  } catch (error) {
    console.error("Error uploading file to Google Drive:", error);
    throw error;
  }
};

// Test function for Google Drive API
const testDriveSetup = async () => {
  try {
    // Load credentials from environment variables
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };

    if (!credentials.client_email || !credentials.private_key) {
      console.error(
        "Missing Google Drive API credentials in environment variables"
      );
      return false;
    }

    // Create a JWT auth client
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ["https://www.googleapis.com/auth/drive"]
    );

    // Test auth by listing files
    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.list({
      pageSize: 10,
      fields: "files(id, name)",
    });

    console.log("✅ Google Drive API connection successful!");
    console.log("Files in Drive:", response.data.files);
    return true;
  } catch (error) {
    console.error("❌ Google Drive API connection failed:", error.message);
    if (error.response) {
      console.error("Error details:", error.response.data);
    }
    return false;
  }
};

module.exports = {
  createDriveFolder,
  uploadFileToDrive,
  testDriveSetup,
};
