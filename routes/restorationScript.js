// Application Restoration Script
const express = require("express");
const router = express.Router();
const { db } = require("../firebase");
const XLSX = require("xlsx");
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

/**
 * Restore applications from Excel file
 * POST /api/restore-applications
 */
router.post("/", upload.single("excelFile"), async (req, res) => {
  try {
    console.log("Starting application restoration...");

    // Check if file was uploaded
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Excel file is required" });
    }

    // Parse Excel data
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const applications = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Convert all values to strings
      defval: "", // Default empty cells to empty string
    });
    console.log(`Found ${applications.length} applications in CSV`);

    const results = {
      total: applications.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    // Process each application
    for (const app of applications) {
      try {
        // Make sure all values are strings for consistency
        Object.keys(app).forEach((key) => {
          if (app[key] !== null && app[key] !== undefined) {
            app[key] = String(app[key]).trim();
          }
        });

        // Skip applications with missing required fields
        if (
          !app["Application ID"] ||
          !app["First Name"] ||
          !app["Last Name"] ||
          !app["Email"]
        ) {
          results.skipped++;
          console.log(
            `Skipping application with insufficient data: ${
              app["Application ID"] || "Unknown"
            }`
          );
          continue;
        }

        const appId = String(app["Application ID"]).trim();

        // Get user data - try case-insensitive email match
        const email = app["Email"].trim().toLowerCase();
        const userSnapshot = await db
          .collection("users")
          .where("email", ">=", email)
          .where("email", "<=", email + "\uf8ff")
          .get();

        if (userSnapshot.empty) {
          // Try with User ID if we have it
          const userId = app["User ID"];
          let userDocSnapshot = null;

          if (userId) {
            userDocSnapshot = await db.collection("users").doc(userId).get();
            if (userDocSnapshot.exists) {
              // Found by user ID, can proceed
              const userData = userDocSnapshot.data();
              const userId = userDocSnapshot.id;
              console.log(
                `Found user by ID: ${userId} for application ${appId}`
              );
            } else {
              // Not found by either email or ID
              results.skipped++;
              console.log(
                `User with email ${email} or ID ${userId} not found, skipping application ${appId}`
              );
              continue;
            }
          } else {
            // No User ID to try
            results.skipped++;
            console.log(
              `User with email ${email} not found, skipping application ${appId}`
            );
            continue;
          }
        }

        // Get user ID either from snapshot or from direct doc fetch above
        let userId, userData;
        if (userSnapshot && !userSnapshot.empty) {
          userId = userSnapshot.docs[0].id;
          userData = userSnapshot.docs[0].data();
        } else if (app["User ID"]) {
          // This branch only executes if we already found user by ID in the previous block
          userId = app["User ID"];
          const userDoc = await db.collection("users").doc(userId).get();
          userData = userDoc.data();
        }

        // Find related forms for this user
        const initialFormSnapshot = await db
          .collection("initialScreeningForms")
          .where("userId", "==", userId)
          .get();

        const studentFormSnapshot = await db
          .collection("studentIntakeForms")
          .where("userId", "==", userId)
          .get();

        const documentsFormSnapshot = await db
          .collection("documents")
          .where("userId", "==", userId)
          .get();

        // Use existing forms or create new ones if needed
        let initialFormId = null;
        let studentFormId = null;
        let documentsFormId = null;

        // Get or create initial form
        if (!initialFormSnapshot.empty) {
          initialFormId = initialFormSnapshot.docs[0].id;
        } else {
          // Create a new initial form if one doesn't exist
          const initialFormRef = await db
            .collection("initialScreeningForms")
            .add({
              userId,
              id: null,
              formal_education: null,
              qualification: null,
              state: null,
              yearsOfExperience: null,
              locationOfExperience: null,
              industry: null,
              lookingForWhatQualification: null,
            });

          // Update with its own ID
          await db
            .collection("initialScreeningForms")
            .doc(initialFormRef.id)
            .update({
              id: initialFormRef.id,
            });

          initialFormId = initialFormRef.id;
        }

        // Get or create student form
        if (!studentFormSnapshot.empty) {
          studentFormId = studentFormSnapshot.docs[0].id;
        } else {
          // Create a new student form if one doesn't exist
          const studentFormRef = await db.collection("studentIntakeForms").add({
            userId,
            id: null,
            firstName: null,
            lastName: null,
            middleName: null,
            USI: null,
            gender: null,
            dob: null,
            homeAddress: null,
            suburb: null,
            postcode: null,
            state: null,
            contactNumber: null,
            email: null,
            countryOfBirth: null,
            australianCitizen: null,
            aboriginalOrTorresStraitIslander: null,
            englishLevel: null,
            disability: null,
            educationLevel: null,
            previousQualifications: null,
            employmentStatus: null,
            businessName: null,
            position: null,
            employersLegalName: null,
            employersAddress: null,
            employersContactNumber: null,
            creditsTransfer: null,
            nameOfQualification: null,
            YearCompleted: null,
            agree: false,
            date: null,
          });

          // Update with its own ID
          await db
            .collection("studentIntakeForms")
            .doc(studentFormRef.id)
            .update({
              id: studentFormRef.id,
            });

          studentFormId = studentFormRef.id;
        }

        // Get or create documents form
        if (!documentsFormSnapshot.empty) {
          documentsFormId = documentsFormSnapshot.docs[0].id;
        } else {
          // Create a new documents form if one doesn't exist
          const documentsFormRef = await db.collection("documents").add({
            userId,
            id: null,
            license: null,
            passport: null,
            birth_certificate: null,
            medicare: null,
            creditcard: null,
            resume: null,
            previousQualifications: null,
            reference1: null,
            reference2: null,
            employmentLetter: null,
            payslip: null,
          });

          // Update with its own ID
          await db.collection("documents").doc(documentsFormRef.id).update({
            id: documentsFormRef.id,
          });

          documentsFormId = documentsFormRef.id;
        }

        // Parse price value (removing commas and converting to number)
        let price = app["Price"];
        if (price) {
          price = String(price).replace(/,/g, "");
          // Handle scientific notation (like 6.10E+11) that Excel might generate
          if (price.includes("E")) {
            price = parseFloat(price).toString();
          }
        }

        // Parse payment status
        const isPaid = app["Payment Status"] === "Paid";

        // Use existing form IDs from Excel if available
        if (app["initialFormID"] && app["initialFormID"].trim() !== "") {
          // Check if this form ID exists
          const initialFormDoc = await db
            .collection("initialScreeningForms")
            .doc(app["initialFormID"])
            .get();
          if (initialFormDoc.exists) {
            initialFormId = app["initialFormID"];
          }
        }

        if (app["studentFormID"] && app["studentFormID"].trim() !== "") {
          // Check if this form ID exists
          const studentFormDoc = await db
            .collection("studentIntakeForms")
            .doc(app["studentFormID"])
            .get();
          if (studentFormDoc.exists) {
            studentFormId = app["studentFormID"];
          }
        }

        if (app["documentsFormId"] && app["documentsFormId"].trim() !== "") {
          // Check if this form ID exists
          const documentsFormDoc = await db
            .collection("documents")
            .doc(app["documentsFormId"])
            .get();
          if (documentsFormDoc.exists) {
            documentsFormId = app["documentsFormId"];
          }
        }

        // Determine current status based on payment status and document IDs
        let currentStatus = "Student Intake Form";
        //check if the student form is filled using fields from the student form
        const studentFormDoc = await db
          .collection("studentIntakeForms")
          .doc(studentFormId)
          .get();
        const studentFormData = studentFormDoc.data();
        if (
          studentFormData.firstName &&
          studentFormData.lastName &&
          studentFormData.dob &&
          studentFormData.homeAddress &&
          studentFormData.suburb
        ) {
          currentStatus = "Upload Documents";
        }

        // Parse date with appropriate format (DD/MM/YYYY)
        let createdDate;
        try {
          if (app["Date Created"]) {
            // Handle different date formats that Excel might provide
            const parts = app["Date Created"].split("/");
            if (parts.length === 3) {
              // Assuming DD/MM/YYYY format
              createdDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
              createdDate = new Date(app["Date Created"]);
            }

            // Check if date is valid
            if (isNaN(createdDate.getTime())) {
              createdDate = new Date();
            }
          } else {
            createdDate = new Date();
          }
        } catch (error) {
          console.log(
            `Error parsing date: ${app["Date Created"]}, using current date`
          );
          createdDate = new Date();
        }

        // Create a new application
        const applicationRef = await db.collection("applications").add({
          id: null,
          applicationId: appId,
          userId,
          initialFormId,
          studentFormId,
          documentsFormId,
          certificateId: null,
          status: [
            {
              statusname: currentStatus,
              time: createdDate.toISOString(),
            },
          ],
          verified: isPaid, // Consider verified if paid
          paid: isPaid,
          documents: {},
          currentStatus,
          type: "RPL", // Default value, adjust if available in CSV
          price: price || "0",
          createdAt: createdDate.toISOString(),
        });

        // Update the application with its own ID
        await db.collection("applications").doc(applicationRef.id).update({
          id: applicationRef.id,
        });

        results.created++;
        console.log(
          `Created application ${appId} for user ${app["First Name"]} ${app["Last Name"]}`
        );
      } catch (error) {
        console.error(
          `Error processing application ${app["Application ID"]}:`,
          error
        );
        results.errors.push({
          appId: app["Application ID"],
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Application restoration completed",
      results,
    });
  } catch (error) {
    console.error("Restoration script error:", error);
    return res.status(500).json({
      success: false,
      message: "Error restoring applications",
      error: error.message,
    });
  }
});

module.exports = router;
