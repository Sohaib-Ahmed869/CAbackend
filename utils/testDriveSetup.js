// testDriveComprehensive.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  testDriveSetup,
  createDriveFolder,
  uploadFileToDrive,
} = require("./googleDriveUtils");

async function runComprehensiveTest() {
  console.log("🔍 Starting comprehensive Google Drive API test...");

  try {
    // Test 1: Basic authentication
    console.log("\n📋 Test 1: Testing basic authentication and connection...");
    const authResult = await testDriveSetup();

    if (!authResult) {
      console.error("❌ Authentication test failed. Stopping further tests.");
      return;
    }

    console.log("✅ Authentication test passed successfully!");

    // Test 2: Create a folder
    console.log("\n📋 Test 2: Creating a test folder in Google Drive...");
    const folderName = `Test_Folder_${Date.now()}`;
    const folderInfo = await createDriveFolder(folderName);

    console.log(`✅ Folder created successfully!`);
    console.log(`📁 Folder ID: ${folderInfo.folderId}`);
    console.log(`🔗 Folder Link: ${folderInfo.folderLink}`);

    // Test 3: Create a test file for upload
    console.log("\n📋 Test 3: Creating and uploading a test file...");

    // Create a temporary test file
    const testFilePath = path.join(__dirname, "test_file.txt");
    fs.writeFileSync(
      testFilePath,
      "This is a test file for Google Drive upload test."
    );

    // For the uploadFileToDrive function, we need a URL, not a file path
    // In a real scenario, you would have a URL from your firebase or other storage
    // For this test, we'll simulate it with a publicly accessible URL
    const testFileUrl =
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    const testFileName = "test_document.pdf";

    try {
      const uploadResult = await uploadFileToDrive(
        testFileUrl,
        testFileName,
        folderInfo.folderId
      );

      console.log("✅ Test file uploaded successfully!");
      console.log(`📄 File ID: ${uploadResult.fileId}`);
      console.log(`👁️ View Link: ${uploadResult.viewLink}`);
      console.log(`⬇️ Download Link: ${uploadResult.downloadLink}`);
    } catch (uploadError) {
      console.error("❌ Test file upload failed:", uploadError.message);
    }

    // Clean up - remove the test file
    try {
      fs.unlinkSync(testFilePath);
      console.log("🧹 Cleaned up test file.");
    } catch (cleanupError) {
      console.warn("⚠️ Could not clean up test file:", cleanupError.message);
    }

    console.log("\n🎉 All tests completed!");
    console.log("📝 Summary:");
    console.log("- Authentication: ✅");
    console.log("- Folder Creation: ✅");
    console.log(`- File Upload: ${uploadResult ? "✅" : "❌"}`);
    console.log(
      "\nYou can verify the results by checking the Google Drive folder:"
    );
    console.log(folderInfo.folderLink);
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    if (error.response) {
      console.error("Error details:", error.response.data);
    }
  }
}

runComprehensiveTest().catch((error) => {
  console.error("Test execution failed:", error);
});
