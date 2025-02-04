// controllers/userController.js
// controllers/userController.js
const { db, auth } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 }); // Cache TTL of 60 seconds

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
      return res.status(400).json({ message: "Error creating user" });
    }

    const userId = newUser.uid;

    // Firestore write batch
    const batch = db.batch();

    const usersDocRef = db.collection("users").doc(userId);
    batch.set(usersDocRef, {
      firstName,
      lastName,
      phone,
      email,
      country,
      password,
      toc,
      role: "customer",
      verified: false,
      id: userId,
    });

    const initialFormRef = db.collection("initialScreeningForms").doc();
    batch.set(initialFormRef, {
      userId,
      formal_education,
      qualification,
      state,
      yearsOfExperience,
      locationOfExperience,
      industry,
      lookingForWhatQualification,
      id: initialFormRef.id,
    });

    const studentFormRef = db.collection("studentIntakeForms").doc();
    batch.set(studentFormRef, {
      userId,
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
      id: studentFormRef.id,
    });

    const documentsFormRef = db.collection("documents").doc();
    batch.set(documentsFormRef, {
      userId,
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
      id: documentsFormRef.id,
    });

    const generateAppID = "APP" + Math.floor(1000 + Math.random() * 9000);

    const applicationRef = db.collection("applications").doc();
    batch.set(applicationRef, {
      id: applicationRef.id,
      applicationId: generateAppID,
      userId,
      initialFormId: initialFormRef.id,
      studentFormId: studentFormRef.id,
      documentsFormId: documentsFormRef.id,
      certificateId: null,
      status: [
        {
          statusname: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
      verified: true,
      paid: false,
      documents: {},
      currentStatus: "Student Intake Form",
      type,
      price,
    });

    // Commit the batch
    await batch.commit();

    console.log(newUser.uid);

    const token = await auth.createCustomToken(newUser.uid);
    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    const emailBody = `
    <h2 style="color: #2c3e50;">🎉 Welcome to Certified Australia, ${firstName} ${lastName}! 🎉</h2>

    <p>We are thrilled to see you taking this huge step in your career! 🥳 Your registration has been successfully completed, and you can visit your dashboard to complete the payment.</p>

    <strong>Your application Details:</strong>
    <ul>
    <li><strong>Application ID:</strong> ${generateAppID}</li>
    <li><strong>Cost:</strong> $${price}</li>
    <li><strong>Applied for:</strong> ${lookingForWhatQualification}</li>
    </ul>
    <p>Please click the button below to access your application:</p>
    <a href="${loginUrl}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Make Payment</a>

    <p>
    Thank you for choosing us to support your journey. Our team is here to assist you every step of the way, ensuring a seamless experience and providing the resources you need to achieve your goals. 🚀
    </p>

    <p>We look forward to a successful journey together. 🌟</p>
    
    <p style="font-style: italic;">
    If you have any questions or need assistance, please don't hesitate to <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">contact us 📧</a>.
    </p>

    <strong>Why Choose RPL with Certified Australia?</strong>

    <ul>
    <li><strong>Save Time And Money</strong> Achieve recognition for your existing skills without unnecessary training.</li>
    <li><strong>Career Advancement</strong> Strengthen your professional profile and meet industry standards.</li>
    <li><strong>Personalised Support:</strong> Our dedicated team will assist you through every step of the process.</li>
    </ul>

    <p style="margin-top:10px; margin-bottom:10px">-------------------------------------------------------------------------</p>
    <strong>Documents that will be needed</strong>
    <ul>
    <li>100 Points ID (Passport, Drivers Licence, Medicare)</li>
    <li>Contact Information</li>
    <li>Residential Address</li>
    <li>Place of Birth</li>
    <li>Copy of Visa</li>
    <li>USI Number</li>
    <li>Photo Evidence of you onsite (in case of trades,construction and automotive)</li>
    <li>Video Evidence of you onsite (incase of trades, construction and automotive)</li>
    <li>Reference Letter</li>
    <li>Resume</li>
    </ul>
    <p style="margin-top:10px; margin-bottom:10px">-------------------------------------------------------------------------</p>

  
    <p>
    <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
`;

    const emailSubject = `Congratulations, ${firstName}! You're Just a few Steps Away from Getting CERTIFIED with Certified Australia!`;
    const sendEmailPromise = sendEmail(email, emailBody, emailSubject);

    //get admin email
    const adminQuerySnapshot = await db
      .collection("users")
      .where("role", "==", "admin")
      .where("type", "==", "general")
      .get();

    const adminNotificationPromises = [];
    // adminQuerySnapshot.forEach((adminDoc) => {
    //   const adminData = adminDoc.data();
    //   const adminUserId = adminData.id;
    //   const adminEmail = adminData.email;
    //   const loginToken = auth.createCustomToken(adminUserId);
    //   const adminUrl = `${process.env.CLIENT_URL}/admin?token=${loginToken}`;
    const adminEmail = "applications@certifiedaustralia.com.au";

    const adminEmailBody = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello Admin,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
    
     
      <p style="font-style: italic;">For more details, please visit the admin dashboard.</p>
      <p>Thank you for your attention.</p>
     <p style="margin-top:10px; margin-bottom:10px">-------------------------------------------------------------------------</p>

  
    <p>
    <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
    const adminEmailSubject = "New User Registration";
    adminNotificationPromises.push(
      sendEmail(adminEmail, adminEmailBody, adminEmailSubject)
    );

    // Wait for email tasks to complete
    await Promise.all([sendEmailPromise, ...adminNotificationPromises]);

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
          statusname: "Student Intake Form",
          time: new Date().toISOString(),
        },
      ],
      verified: true,
      paid: false,
      documents: {},
      currentStatus: "Student Intake Form",
      type: type,
      price: price,
      agentId: agentId,
    });

    //update the id in the application form
    await db.collection("applications").doc(applicationRef.id).update({
      id: applicationRef.id,
    });

    console.log(newUser.uid);

    const emailBody = `<h2 style="color: #2c3e50;">🎉 Welcome to Certified Australia, {{firstName}} {{lastName}}! 🎉</h2>


<p>We're delighted to welcome you to our platform! 😊 Your registration, completed via our trusted agent, has been successful. Your application is now under review with the status <strong style="color: #3498db;">"Waiting for Verification" 🔍</strong>.</p>

<p style="font-size: 1.1em; color: #34495e;">
We appreciate the confidence you have placed in us, and we are committed to supporting you on this journey. Our team is ready to help you achieve your goals and make the most of the opportunities available. 🚀
</p>
<strong>Your application Details:</strong>
    <ul>
    <li><strong>Application ID:</strong> ${generateAppID}</li>
    <li><strong>Price:</strong> $${price}</li>
    <li><strong>Applied for:</strong> ${lookingForWhatQualification}</li>
    </ul>
<p style="margin-top: 20px; font-style: italic;">
For any inquiries or assistance, please feel free to <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">reach out to our support team 📧</a>.
</p>

<p>Thank you for joining us, and we look forward to a successful collaboration. 🤝</p>

<strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
`;
    const emailSubject = "Welcome to Our Platform";
    await sendEmail(email, emailBody, emailSubject);

    const admin = await db
      .collection("users")
      .where("role", "==", "admin")
      .where("type", "==", "general")
      .get();
    admin.forEach(async (doc) => {
      const adminEmail = doc.data().email;
      const adminUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(adminUserId);
      const URL = `${process.env.CLIENT_URL}/admin?token=${loginToken}`;

      const body_email = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello Admin,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
      <p>Click the button below to view the application:</p>
      <a href="${URL}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the admin dashboard.</p>
     <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
      const subject = "New User Registration";
      if (adminEmail !== "ceo@certifiedaustralia.com.au") {
        await sendEmail(adminEmail, body_email, subject);
      }
    });

    const rto = await db.collection("users").where("role", "==", "rto").get();
    rto.forEach(async (doc) => {
      const rtoEmail = doc.data().email;
      const rtoUserId = doc.data().id;
      const loginToken = await auth.createCustomToken(rtoUserId);
      const URL2 = `${process.env.CLIENT_URL}/rto?token=${loginToken}`;

      const emailBody = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>
      <p style="color: #34495e;">Hello RTO,</p>
      <p>A new user has registered on the platform. Please review the application and verify the user.</p>
       <strong>Application Details:</strong>
      <ul>
      <li>First Name: ${firstName}</li>
      <li>Last Name: ${lastName}</li>
      <li>Email: ${email}</li>
      <li>Phone: ${phone}</li>
      </ul>
      <p>Click the button below to view the application:</p>
      <a href="${URL2}" style="background-color: #089C34; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Application</a>
      <p style="font-style: italic;">For more details, please visit the rto dashboard.</p>
      <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
      const emailSubject = "New User Registration";

      await sendEmail(rtoEmail, emailBody, emailSubject);

      //send email to agent
      const agent = await db.collection("users").doc(agentId).get();
      const agentEmail = agent.data().email;
      const agentUserId = agent.data().id;
      const loginToken2 = await auth.createCustomToken(agentUserId);

      const emailBody2 = `
      <h2 style="color: #2c3e50;">🎉 New User Registration! 🎉</h2>

      <p style="color: #34495e;">Hello Agent,</p>
      <p>A new user has registered on the platform. Please review the application to complete it now.</p>
      <strong>Application Details:</strong>
      <ul>
      <li>First Name: ${firstName}</li>
      <li>Last Name: ${lastName}</li>
      <li>Email: ${email}</li>
      <li>Phone: ${phone}</li>
      <li>Price: $${price}</li>
      </ul>
      
      <strong>Best Regards,</strong><br>
    The Certified Australia Team<br>
    Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
    Phone: <a href="tel:1300044927" style="color: #3498db; text-decoration: none;">1300 044 927</a><br>
    Website: <a href="https://www.certifiedaustralia.com.au" style="color: #3498db; text-decoration: none;">www.certifiedaustralia.com.au</a>
    </p>
      `;
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

const changeEmail = async (req, res) => {
  const { userId } = req.params;
  const { email } = req.body;

  try {
    // Update email in Firebase Authentication
    await auth.updateUser(userId, { email });

    // Update email in Firestore
    await db.collection("users").doc(userId).update({ email });
    cache.del("applications");
    res.status(200).json({
      message:
        "User email updated successfully in both Firestore and Firebase Auth.",
    });
  } catch (error) {
    console.error("Error updating email:", error);
    res
      .status(500)
      .json({ message: "Error updating email. Please try again later." });
  }
};

const changePhoneNumber = async (req, res) => {
  const { userId } = req.params;
  const { phone } = req.body;

  try {
    // Update phone number in Firestore
    await db.collection("users").doc(userId).update({ phone });
    cache.del("applications");
    res.status(200).json({
      message: "User phone number updated successfully in Firestore.",
    });
  } catch (error) {
    console.error("Error updating phone number:", error);
    res.status(500).json({
      message: "Error updating phone number. Please try again later.",
    });
  }
};

module.exports = {
  changePhoneNumber,
  changeEmail,
  registerUser,
  verifyUser,
  registerUserbyAgent,
};

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
