// controllers/studentIntakeFormController.js
const { db } = require("../firebase");
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

    if (userDoc.exists) {
      const { email, firstName, lastName } = userDoc.data();
      const emailSubject = "Student Intake Form Submission and Next Steps";
      const emailBody = `
        <h2>Dear ${firstName} ${lastName},</h2>
        
        <p>Thank you for completing and submitting your Student Intake Form. We have successfully received the details you provided, and your application has moved to the next stage.</p>
        
        <h3>Next Steps: Document Upload</h3>
        <p>To ensure a seamless progression in your application process, we kindly request you to upload the necessary documents <strong>(in pdf format)</strong>. These documents help us verify your information and keep your application on track.</p>
        
        <h4>Instructions for Document Upload:</h4>
        <ul>
          <li>Log in to your account on our platform.</li>
          <li>Navigate to the <strong>Document Upload</strong> section in your dashboard.</li>
          <li>Follow the prompts to securely upload all required documents.</li>
        </ul>
        
        <p>We appreciate your cooperation and attention to detail. Should you need any assistance or have questions regarding the document upload process, please feel free to reach out to our support team at any time.</p>
        
        <p>Thank you for your diligence and for choosing us. We look forward to supporting you further in this journey.</p>
        
        <p>Warm regards,</p>
        <p><strong>Certified Australia</strong></p>
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
