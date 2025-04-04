const { db, auth } = require("../firebase");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 20 });
const fs = require("fs");
const path = require("path");
const { sendEmail } = require("../utils/emailUtil");
const { MailApplicationToRto } = require("../utils/MailApplicationToRto");

const getAllRtos = async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const rtoAdmins = usersSnapshot.docs
      .filter((doc) => doc.data().role === "rto")
      .map((admin) => ({
        // name: admin.data().name, // Ensure 'name' exists in Firestore
        email: admin.data().email,
        id: admin.data().id,
        role: admin.data().role,
      }));

    res.status(200).json(rtoAdmins);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error fetching RTO admins" });
  }
};

const sendApplicationToRto = async (req, res) => {
  try {
    const { application, rto } = req.body;

    if (!application || !rto) {
      return res.status(400).json({
        success: false,
        message: "Missing application or RTO details.",
      });
    }

    // Extract user email and documents
    const rtoEmail = rto || "asadawan16900@gmail.com"; // Replace with actual RTO email
    const userEmail = application.user?.email || "No Email Provided";

    // Prepare Email Body with Styled HTML
    const emailBody = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Application Submission</title>
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
                  max-width: 600px;
                  margin: 30px auto;
                  background: #fff;
                  border-radius: 12px;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                  overflow: hidden;
              }
              .header {
                  background: #089C34;
                  color: #fff;
                  padding: 24px;
                  text-align: center;
                  font-size: 20px;
                  font-weight: 600;
              }
              .header img {
                  max-width: 200px;
              }
              .content {
                  padding: 32px;
                  line-height: 1.6;
              }
              .section {
                  background: #f9fafb;
                  border-radius: 8px;
                  padding: 20px;
                  margin: 20px 0;
                  border-left: 4px solid #089C34;
                  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.05);
              }
              .section h3 {
                  font-size: 18px;
                  font-weight: 600;
                  color: #222;
                  margin-bottom: 10px;
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
                  <h2>Application Details of ${
                    application.applicationId
                  } for RTO Assessment  </h2>
                  <p>Dear RTO,</p>
                  <p> Below are the details of the application:</p>

                  
                  ${
                    application.sif
                      ? `
    <div style="border: 1px solid #ddd;                   border-left: 4px solid #089C34;
; padding: 15px; margin: 15px 0; border-radius: 8px;   display: grid; grid-template-columns: 1fr 1fr;               box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.05);
; background-color: #f9f9f9;">
      <h3 style=" font-size: 18px;
                  font-weight: 600;
                  color: #222;
                  margin-bottom: 10px;">Student Intake Form (SIF)</h3>
      <p><strong>First Name:</strong> ${application.sif.firstName || "N/A"}</p>
      <p><strong>Middle Name:</strong> ${
        application.sif.middleName || "N/A"
      }</p>
      <p><strong>Last Name:</strong> ${application.sif.lastName || "N/A"}</p>
      <p><strong>USI:</strong> ${application.sif.USI || "N/A"}</p>
      <p><strong>Gender:</strong> ${application.sif.gender || "N/A"}</p>
      <p><strong>Date of Birth:</strong> ${application.sif.dob || "N/A"}</p>
      <p><strong>Email:</strong> ${application.sif.email || "N/A"}</p>
      <p><strong>Phone:</strong> ${application.sif.contactNumber || "N/A"}</p>
      <p><strong>Home Address:</strong> ${
        application.sif.homeAddress || "N/A"
      }</p>
      <p><strong>Suburb:</strong> ${application.sif.suburb || "N/A"}</p>
      <p><strong>State:</strong> ${application.sif.state || "N/A"}</p>
      <p><strong>Postcode:</strong> ${application.sif.postcode || "N/A"}</p>
      <p><strong>Country of Birth:</strong> ${
        application.sif.countryOfBirth || "N/A"
      }</p>
      <p><strong>Aboriginal or Torres Strait Islander:</strong> ${
        application.sif.aboriginalOrTorresStraitIslander || "N/A"
      }</p>
      <p><strong>Australian Citizen:</strong> ${
        application.sif.australianCitizen || "N/A"
      }</p>
      <p><strong>Employment Status:</strong> ${
        application.sif.employmentStatus || "N/A"
      }</p>
      <p><strong>English Level:</strong> ${
        application.sif.englishLevel || "N/A"
      }</p>
      <p><strong>Previous Qualifications:</strong> ${
        application.sif.previousQualifications || "N/A"
      }</p>
      <p><strong>Year Completed:</strong> ${
        application.sif.YearCompleted || "N/A"
      }</p>
      <p><strong>Disability:</strong> ${application.sif.disability || "N/A"}</p>
      <p><strong>Credits Transfer:</strong> ${
        application.sif.creditsTransfer || "N/A"
      }</p>
      <p><strong>Name of Qualification:</strong> ${
        application.sif.nameOfQualification || "N/A"
      }</p>
      <p><strong>Business Name:</strong> ${
        application.sif.businessName || "N/A"
      }</p>
      <p><strong>Employer's Legal Name:</strong> ${
        application.sif.employersLegalName || "N/A"
      }</p>
      <p><strong>Employer's Contact Number:</strong> ${
        application.sif.employersContactNumber || "N/A"
      }</p>
      <p><strong>Employer's Address:</strong> ${
        application.sif.employersAddress || "N/A"
      }</p>
      <p><strong>Position:</strong> ${application.sif.position || "N/A"}</p>
      <p><strong>Date:</strong> ${application.sif.date || "N/A"}</p>
      <p><strong>Agreement:</strong> ${application.sif.agree ? "Yes" : "No"}</p>
    </div>
  `
                      : ""
                  }

                  ${
                    application.isf
                      ? `
                  <div class="section">
                      <h3>Initial Screening Form Details</h3>
                      <p><strong>Formal Education:</strong> ${
                        application.isf.formal_education || "N/A"
                      }</p>
                      <p><strong>Qualification:</strong> ${
                        application.isf.qualification || "N/A"
                      }</p>
                      <p><strong>State:</strong> ${application.isf.state}</p>
                      <p><strong>Industry:</strong> ${
                        application.isf.industry
                      }</p>
                      <p><strong>Experience:</strong> ${
                        application.isf.yearsOfExperience
                      }</p>
                      <p><strong>Experience Location:</strong> ${
                        application.isf.locationOfExperience
                      }</p>
                  </div>
                  `
                      : ""
                  }

                  <div class="section">
                      <h3>User Information</h3>
                      <p><strong>Name:</strong> ${application.user.firstName} ${
      application.user.lastName
    }</p>
                      <p><strong>Email:</strong> ${application.user.email}</p>
                      <p><strong>Phone:</strong> ${application.user.phone}</p>
                      <p><strong>Country:</strong> ${
                        application.user.country
                      }</p>
                  </div>

                  <p>Best regards,</p>
                  <p>Your Application System</p>
              </div>
              <div class="footer">
                  <p>© 2025 Certified Australia. All rights reserved.</p>
                  <p>Need help? <a href="mailto:support@certifiedaustralia.com.au">Contact Support</a></p>
              </div>
          </div>
      </body>
      </html>
    `;

    // Extract document attachments from Firebase URLs
    const attachments = [];

    if (application.document) {
      Object.entries(application.document).forEach(([key, fileData]) => {
        if (fileData?.fileUrl) {
          const filePathParts = fileData.fileName.split("/");
          const folderName = filePathParts[filePathParts.length - 2]; // Second last part (Resume23, etc.)
          const fileFullName = filePathParts[filePathParts.length - 1]; // Full filename
          const fileExtension = fileFullName.substring(
            fileFullName.lastIndexOf(".")
          ); // Extract extension

          attachments.push({
            filename: `${folderName}${fileExtension}`, // Example: Resume23.pdf
            path: fileData.fileUrl, // Firebase URL
          });

          console.log(`✅ Added attachment: ${folderName}${fileExtension}`);
        }
      });
    }

    // Send Email with Attachments
    await MailApplicationToRto(
      rtoEmail,
      emailBody,
      `Details of Application ${application.applicationId}`,
      attachments
    );

    return res.status(200).json({
      success: true,
      message: "Application sent successfully to RTO!",
    });
  } catch (error) {
    console.error("Error sending application:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send application", error });
  }
};

const getApplications = async (req, res) => {
  try {
    // Fetch applications and related data in parallel
    const [
      applicationsSnapshot,
      initialScreeningFormsSnapshot,
      usersSnapshot,
      studentIntakeFormsSnapshot,
      documentsSnapshot,
    ] = await Promise.all([
      db.collection("applications").get(),
      db.collection("initialScreeningForms").get(),
      db.collection("users").get(),
      db.collection("studentIntakeForms").get(),
      db.collection("documents").get(),
    ]);

    const applications = applicationsSnapshot.docs.map((doc) => doc.data());

    // Create maps for quick lookups
    const initialScreeningForms = Object.fromEntries(
      initialScreeningFormsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const users = Object.fromEntries(
      usersSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const studentIntakeForms = Object.fromEntries(
      studentIntakeFormsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );
    const documents = Object.fromEntries(
      documentsSnapshot.docs.map((doc) => [doc.id, doc.data()])
    );

    // Enrich applications with related data
    const enrichedApplications = applications.map((application) => ({
      ...application,
      isf: initialScreeningForms[application.initialFormId] || null,
      user: users[application.userId] || null,
      sif: studentIntakeForms[application.studentFormId] || null,
      document: documents[application.documentsFormId] || null,
    }));

    // Cache the enriched applications
    cache.set("applications", enrichedApplications);

    res.status(200).json(enrichedApplications);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const registerRTO = async (req, res) => {
  try {
    const { email, password, type } = req.body;
    console.log(email, password, type);
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    console.log("Registering RTO:", { email, password, type });

    const user = await auth.createUser({ email, password });

    await db
      .collection("users")
      .doc(user.uid)
      .set({
        email: email || "",
        role: "rto",
        type: type || "default", // Ensure type is not undefined
        id: user.uid,
      });

    res.status(201).json({ userId: user.uid });
  } catch (error) {
    console.error("Error registering RTO:", error);
    res.status(500).json({ message: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  const cachedStats = cache.get("dashboardStats");
  if (cachedStats) {
    return res.status(200).json(cachedStats);
  }

  let stats = {
    totalApplications: 0,
    applicationsPending: 0,
    totalRTOs: 0,
    applicationsCompleted: 0,
    applicationsCompletedInLastWeek: 0,
    applicationsCompletedInLastMonth: 0,
    rejectedApplications: 0,
  };

  try {
    // Fetch all applications and RTO users in parallel
    const [applicationsSnapshot, rtoSnapshot] = await Promise.all([
      db.collection("applications").get(),
      db.collection("users").where("role", "==", "rto").get(),
    ]);

    const applications = applicationsSnapshot.docs.map((doc) => doc.data());
    stats.totalApplications = applications.length;
    stats.totalRTOs = rtoSnapshot.docs.length;

    // Process applications for various statuses
    applications.forEach((application) => {
      if (application.currentStatus === "Sent to RTO") {
        stats.applicationsPending++;
      } else if (application.currentStatus === "Certificate Generated") {
        stats.applicationsCompleted++;

        const completionDate = new Date(
          application.status[application.status.length - 1].time
        );
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        if (completionDate >= oneWeekAgo) {
          stats.applicationsCompletedInLastWeek++;
        }
        if (completionDate >= oneMonthAgo) {
          stats.applicationsCompletedInLastMonth++;
        }
      } else if (application.currentStatus === "Rejected by RTO") {
        stats.rejectedApplications++;
      }
    });

    // Cache the computed stats
    cache.set("dashboardStats", stats);

    res.status(200).json(stats);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getApplications,
  getAllRtos,
  registerRTO,
  getDashboardStats,
  sendApplicationToRto,
};
