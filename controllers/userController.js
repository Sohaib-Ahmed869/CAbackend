// controllers/userController.js
// controllers/userController.js
const { db, auth } = require("../firebase");

// Register User
const registerUser = async (req, res) => {
  const {
    firstName,
    lastName,
    phone,
    email,
    country,
    toc,
    formal_education,
    qualification,
    state,
    yearsOfExperience,
    locationOfExperience,
    industry,
    lookingForWhatQualification,
    password,
    type,
  } = req.body;

  console.log(req.body);

  try {
    // Step 1: Check if the user already exists in Firebase Auth
    const existingUser = await auth.getUserByEmail(email).catch(() => null);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Step 2: Create the user in Firebase Authentication
    const newUser = await auth.createUser({
      email,
      password: password,
      displayName: `${firstName} ${lastName}`,
      phoneNumber: phone,
    });

    if (!newUser) {
      //check why it is not working
      if (newUser.errorInfo.code === "auth/email-already-exists") {
        return res.status(400).json({ message: "Email already exists" });
      }
      if (newUser.errorInfo.code === "auth/invalid-email") {
        return res.status(400).json({ message: "Invalid email" });
      }
      if (newUser.errorInfo.code === "auth/weak-password") {
        return res.status(400).json({ message: "Weak password" });
      }
      if (newUser.errorInfo.code === "auth/operation-not-allowed") {
        return res.status(400).json({ message: "Operation not allowed" });
      }
      if (newUser.errorInfo.code === "auth/invalid-phone-number") {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      return res.status(400).json({ message: "Error creating user" });
    }

    // Step 3: Save additional user data in Firestore
    await db.collection("users").doc(newUser.uid).set({
      firstName,
      lastName,
      phone,
      email,
      country,
      password,
      toc,
      role: "customer",
      verified: false,
      id: newUser.uid,
    });

    // Step 4: Create empty form documents for the user
    const initialFormRef = await db.collection("initialScreeningForms").add({
      userId: newUser.uid,
      formal_education,
      qualification,
      state,
      yearsOfExperience,
      locationOfExperience,
      industry,
      lookingForWhatQualification,
      id: null,
    });

    //update the id in the initial form
    await db.collection("initialScreeningForms").doc(initialFormRef.id).update({
      id: initialFormRef.id,
    });

    const studentFormRef = await db.collection("studentIntakeForms").add({
      userId: newUser.uid,
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
      id: null,
    });

    //update the id in the student form
    await db.collection("studentIntakeForms").doc(studentFormRef.id).update({
      id: studentFormRef.id,
    });

    const documentsFormRef = await db.collection("documents").add({
      userId: newUser.uid,
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
      id: null,
    });

    //update the id in the documents form
    await db.collection("documents").doc(documentsFormRef.id).update({
      id: documentsFormRef.id,
    });

    // Step 5: Create an application document linking all forms
    const applicationRef = await db.collection("applications").add({
      id: null,
      userId: newUser.uid,
      initialFormId: initialFormRef.id,
      studentFormId: studentFormRef.id,
      documentsFormId: documentsFormRef.id,
      certificateId: null,
      status: [
        {
          statusname: "Waiting for Verification",
          time: new Date().toISOString(),
        },
      ],
      verified: false,
      paid: false,
      documents: {},
      currentStatus: "Waiting for Verification",
      type: type,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    console.log(newUser.uid);

    return res.status(201).json({ userId: newUser.uid });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

// Verify User (Admin only)
const verifyUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await db.collection("users").doc(userId).update({ verified: true });
    res.status(200).json({ message: "User verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, verifyUser };

//example post request
// {
//     "firstName": "John",
//     "lastName": "Doe",
//     "phone": "+1234567890",
//     "email": "abc@gmail.com",
//     "country": "US",
//     "toc": true
// "formal_education": "Yes",
// "qualification": "Bachelor",
// "state": "NSW",
// "yearsOfExperience": 5,
// "locationOfExperience": "Australia",
// "industry": "IT",
// "lookingForWhatQualification": "Master",
//     "password": "password"
// }
