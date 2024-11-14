// controllers/studentIntakeFormController.js
const { db, auth } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");

// Update Student Intake Form by applicationId
const StudentIntakeFormByApplicationId = async (req, res) => {
  const { applicationId } = req.params;
  console.log(req.body);
  const body = req.body;
  const {
    firstName,
    lastName,
    middleName,
    USI,
    gender,
    dob,
    homeAddress,
    suburb,
    state,
    postcode,
    contactNumber,
    email,
    countryOfBirth,
    australianCitizen,
    aboriginalOrTorresStraitIslander,
    englishLevel,
    disability,
    previousQualitifications,
    employmentStatus,
    businessName,
    position,
    employersLegalName,
    employersAddress,
    employersContactNumber,
    creditsTransfer,
    nameOfQualification,
    YearCompleted,
    agree,
    date,
  } = body;

  try {
    const applicationRef = db.collection("applications").doc(applicationId);
    const applicationDoc = await applicationRef.get();

    if (!applicationDoc.exists) {
      return res.status(404).json({ message: "Application not found" });
    }

    const { studentFormId } = applicationDoc.data();
    if (!studentFormId) {
      return res
        .status(404)
        .json({ message: "Student Intake Form ID not found in application" });
    }

    const formRef = db.collection("studentIntakeForms").doc(studentFormId);
    await formRef.update({
      firstName,
      lastName,
      middleName,
      USI,
      gender,
      dob,
      homeAddress,
      suburb,
      state,
      postcode,
      contactNumber,
      email,
      countryOfBirth,
      australianCitizen,
      aboriginalOrTorresStraitIslander,
      englishLevel,
      disability,
      employmentStatus,
      businessName,
      position,
      employersLegalName,
      employersAddress,
      employersContactNumber,
      creditsTransfer,
      nameOfQualification,
      YearCompleted,
      agree,
      date,
    });

    // Update the application status
    await applicationRef.update({
      currentStatus: "Upload Documents",
      status: [
        ...applicationDoc.data().status,
        {
          statusname: "Waiting for Documents",
          time: new Date().toISOString(),
        },
      ],
    });

    const userId = applicationDoc.data().userId;
    // Send email notification to the user
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    const token = await auth.createCustomToken(userId);

    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();
      const emailSubject = "Student Intake Form Submission and Next Steps";
      const emailBody = `
  <h2>Dear ${firstName} ${lastName},</h2>
  
  <p>Thank you for completing and submitting your Student Intake Form. We have successfully received the details you provided, and your application has moved to the next stage.</p>
  
  <h3>Next Steps: Document Upload</h3>
  <p>To proceed with your application, please upload the necessary documents using the link below:</p>
  <h4>Documents Required:</h4>
  <ul>
    <li><strong>Proof of Work Experience:</strong> Resume, job references, or detailed job descriptions.</li>
    <li><strong>Educational Transcripts:</strong> Copies of qualifications, certificates, or diplomas.</li>
    <li><strong>Skill Evidence:</strong> Additional certifications or training certificates.</li>
    <li><strong>Photo and Video Evidence (if applicable):</strong> Demonstrations of your work or projects that showcase your skills.</li>
    <li><strong>Identification Documents:</strong> A copy of your ID or passport.</li>
  </ul>
  <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Upload Documents</a>

  <p>We appreciate your cooperation and attention to detail. Should you need any assistance, please feel free to reach out to our support team at any time.</p>
  
  <p>Thank you for choosing us. We look forward to supporting you further in this journey.</p>
  
  <p>
    <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
`;

      await sendEmail(email, emailBody, emailSubject);
    }

    res
      .status(200)
      .json({ message: "Student Intake Form updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { StudentIntakeFormByApplicationId };

//example put request
// PUT /applications/:applicationId/student-intake
// {
//   "firstName": "John",
//   "lastName": "Doe",
//   "middleName": "Smith",
//   "USI": "123456789",
//   "gender": "Male",
//   "dob": "1990-01-01",
//   "homeAddress": "123 Main St",
//   "suburb": "Sydney",
//   "state": "NSW",
//   "postcode": "2000",
//   "country": "Australia",
//   "phone": "1234567890",
//   "email": "johndoe@gmail.com",
//   "countryOfBirth": "Australia",
//   "australianCitizen": true,
//   "aboriginalOrTorresStraitIslander": false,
//   "englishLevel": "Advanced",
//   "disability": "None",
//   "educationlevel": "High School",
//   "previousQualitificaitons": null,
//   "employmentStatus": "Employed",
//   "businessName": "ABC Company",
//   "position": "Manager",
//   "employersLegalName": "ABC Pty Ltd",
//   "employersAddress": "456 George St",
//   "employersContactNumber": "0987654321",
//   "creditsTransfer": false,
//   "nameOfQualification": null,
//   "yearCompleted": null,
//   "agree": true,
//   "date": "2021-01-01"
// }
