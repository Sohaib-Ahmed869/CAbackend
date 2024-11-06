// controllers/userController.js
// controllers/userController.js
const { db, auth } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");
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
    price,
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
      price: price,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    console.log(newUser.uid);

    const token = await auth.createCustomToken(newUser.uid);
    const loginUrl = `https://certifiedaustralia.vercel.app/existing-applications?token=${token}`;

    const emailBody = `
    <h2 style="color: #2c3e50;">🎉 Welcome to Our Platform, ${firstName} ${lastName}! 🎉</h2>


    <p>We are thrilled to have you join our community! 🥳 Your registration has been successfully completed, and your application is currently waiting for verification </p>

    <p>Please click the button below to access your application:</p>
    <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Make Payment</a>

    <p>
    Thank you for choosing us to support your journey. Our team is here to assist you every step of the way, ensuring a seamless experience and providing the resources you need to achieve your goals. 🚀
    </p>

    
    <p>We look forward to a successful journey together. 🌟</p>
    
    <p style="font-style: italic;">
    If you have any questions or need assistance, please don't hesitate to <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">contact us 📧</a>.
    </p>
    <p style="marginTop:10px; marginBottom:10px">-------------------------------------------------------------------------</p>
    <p><strong>Best Regards,</strong><br>Certified Australia</p>
    `;

    const emailSubject = "Welcome to Our Platform";
    await sendEmail(email, emailBody, emailSubject);

    //get admin email
    const admin = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    admin.forEach(async (doc) => {
      const adminUserId = doc.data().id;
      const adminEmail = doc.data().email;

      const loginToken = await auth.createCustomToken(adminUserId);
      const URL = `https://certifiedaustralia.vercel.app/admin?token=${loginToken}`;

      const emailBody = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello Admin,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the admin dashboard.</p>
      <p>Thank you for your attention.</p>
      <p style="font-size: 1.2em;"><strong>Warm Regards,</strong><br>Certified Australia</p>
      `;
      const emailSubject = "New User Registration";
      await sendEmail(adminEmail, emailBody, emailSubject);
    });

    //get rto email
    const rto = await db.collection("users").where("role", "==", "rto").get();
    rto.forEach(async (doc) => {
      const rtoEmail = doc.data().email;
      const rtoUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(rtoUserId);
      const URL2 = `https://certifiedaustralia.vercel.app/rto?token=${loginToken}`;

      const emailBody = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello RTO,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the rto dashboard.</p>
      <p>Thank you for your attention.</p>
      <p style="font-size: 1.2em;"><strong>Warm Regards,</strong><br>Certified Australia</p>
      `;
      const emailSubject = "New User Registration";

      await sendEmail(rtoEmail, emailBody, emailSubject);
    });

    return res.status(201).json({ userId: newUser.uid });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

const registerUserbyAgent = async (req, res) => {
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
    price,
    agentId,
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
      agentId: agentId,
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
      price: price,
      agentId: agentId,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    console.log(newUser.uid);

    const emailBody = `<h2 style="color: #2c3e50;">🎉 Welcome to Our Platform, {{firstName}} {{lastName}}! 🎉</h2>

<p>Dear <strong>{{firstName}} {{lastName}}</strong>,</p>

<p>We're delighted to welcome you to our platform! 😊 Your registration, completed via our trusted agent, has been successful. Your application is now under review with the status <strong style="color: #3498db;">"Waiting for Verification" 🔍</strong>.</p>

<p style="font-size: 1.1em; color: #34495e;">
We appreciate the confidence you have placed in us, and we are committed to supporting you on this journey. Our team is ready to help you achieve your goals and make the most of the opportunities available. 🚀
</p>

<p style="margin-top: 20px; font-style: italic;">
For any inquiries or assistance, please feel free to <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">reach out to our support team 📧</a>.
</p>

<p>Thank you for joining us, and we look forward to a successful collaboration. 🤝</p>

<p style="font-size: 1.2em;"><strong>Warm Regards,</strong><br>Certified Australia</p>
`;
    const emailSubject = "Welcome to Our Platform";
    await sendEmail(email, emailBody, emailSubject);

    const admin = await db
      .collection("users")
      .where("role", "==", "admin")
      .get();
    admin.forEach(async (doc) => {
      const adminEmail = doc.data().email;
      const adminUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(adminUserId);
      const URL = `https://certifiedaustralia.vercel.app/admin?token=${loginToken}`;

      const body_email = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello Admin,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the admin dashboard.</p>
      <p>Thank you for your attention.</p>
      <p style="font-size: 1.2em;"><strong>Warm Regards,</strong><br>Certified Australia</p>
      `;
      const subject = "New User Registration";
      await sendEmail(adminEmail, body_email, subject);
    });

    const rto = await db.collection("users").where("role", "==", "rto").get();
    rto.forEach(async (doc) => {
      const rtoEmail = doc.data().email;
      const rtoUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(rtoUserId);
      const URL2 = `https://certifiedaustralia.vercel.app/rto?token=${loginToken}`;

      const emailBody = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello RTO,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the rto dashboard.</p>
      <p>Thank you for your attention.</p>
      <p style="font-size: 1.2em;"><strong>Warm Regards,</strong><br>Certified Australia</p>
      `;
      const emailSubject = "New User Registration";

      await sendEmail(rtoEmail, emailBody, emailSubject);
    });
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

module.exports = { registerUser, verifyUser, registerUserbyAgent };

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
