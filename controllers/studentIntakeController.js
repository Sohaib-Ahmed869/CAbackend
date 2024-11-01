// controllers/studentIntakeFormController.js
const { db } = require("../firebase");

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
