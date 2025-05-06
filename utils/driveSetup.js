const { google } = require("googleapis");
const fs = require("fs");
const axios = require("axios");
const stream = require("stream");

// Configure Google Drive API
const setupDriveClient = () => {
  // Load credentials from environment variables or a file
  const credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };

  // Create a JWT auth client
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/drive"]
  );

  // Create drive client
  return google.drive({ version: "v3", auth });
};

// Create a folder in Google Drive
const createDriveFolder = async (folderName) => {
  const drive = setupDriveClient();

  try {
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const response = await drive.files.create({
      resource: folderMetadata,
      fields: "id, webViewLink",
    });

    return {
      folderId: response.data.id,
      folderLink: response.data.webViewLink,
    };
  } catch (error) {
    console.error("Error creating folder:", error.message);
    throw error;
  }
};

// Upload a file to Google Drive from URL
const uploadFileToDrive = async (fileUrl, fileName, folderId) => {
  const drive = setupDriveClient();

  try {
    // Download file from URL
    const response = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });

    // Create a pass-through stream
    const bufferStream = new stream.PassThrough();
    response.data.pipe(bufferStream);

    // Determine MIME type based on file extension
    const getFileMimeType = (fileName) => {
      const extension = fileName.split(".").pop().toLowerCase();
      const mimeTypes = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        mp4: "video/mp4",
        mov: "video/quicktime",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        txt: "text/plain",
      };
      return mimeTypes[extension] || "application/octet-stream";
    };

    // Create file metadata
    const fileMetadata = {
      name: fileName,
      parents: [folderId], // Put the file in the specific folder
    };

    // Create media upload
    const media = {
      mimeType: getFileMimeType(fileName),
      body: bufferStream,
    };

    // Upload the file
    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    // Update permissions to make the file viewable by anyone with the link
    await drive.permissions.create({
      fileId: uploadedFile.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    // Get updated file with links
    const file = await drive.files.get({
      fileId: uploadedFile.data.id,
      fields: "webViewLink, webContentLink",
    });

    return {
      fileId: uploadedFile.data.id,
      viewLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink,
    };
  } catch (error) {
    console.error("Error uploading file:", error.message);
    throw error;
  }
};

module.exports = {
  createDriveFolder,
  uploadFileToDrive,
};
