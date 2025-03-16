// controllers/userController.js
// controllers/userController.js
const { db, auth } = require("../firebase");
const { sendEmail } = require("../utils/emailUtil");
const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 3 }); // Cache TTL of 60 seconds

const getUserInfo = async (req, res) => {
  const { userId } = req.params;

  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }
    const userData = userDoc.data();
    return res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching user info:", error);
    return res.status(500).json({ message: "Error fetching user info" });
  }
};
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
      id: applicationRef.id, // Automatically generated document ID
      applicationId: generateAppID, // Generated application ID
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
      verified: true, // Marks if the application is verified
      paid: false, // Payment status
      documents: {}, // Placeholder for uploaded documents
      currentStatus: "Student Intake Form", // Tracks the current status of the application
      type, // Application type
      price, // Price of the application
      applicationStatus: [
        {
          statusname: "Student Intake Form",
          completed: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "payment",
          installmentsApplied: false,
          paid: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "documents uploaded",
          completed: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "sent for verification",
          time: new Date().toISOString(),
        },
        {
          statusname: "verified",
          time: new Date().toISOString(),
        },
        {
          statusname: "completed",
          time: new Date().toISOString(),
        },
      ],
    });

    // Commit the batch
    await batch.commit();

    console.log(newUser.uid);

    const token = await auth.createCustomToken(newUser.uid);
    const loginUrl = `${process.env.CLIENT_URL}/existing-applications?token=${token}`;

    const emailBody = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Certified Australia</title>
    <style>
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 650px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        }
        .email-header {
            background: white;
            color:black;
            padding: 30px;
            text-align: center;
        }
        .logo {
            margin-bottom: 20px;
            max-width: 200px;
        }
        .header-title {
            font-size: 28px;
            font-weight: 600;
            margin: 0;
            padding: 0;
        }
        .email-content {
            padding: 30px;
        }
        .welcome-text {
            font-size: 18px;
            margin-bottom: 25px;
            color: #2c3e50;
        }
        .application-details {
            background-color: #f8f9fa;
            border-left: 4px solid #089C34;
            padding: 20px;
            margin-bottom: 25px;
            border-radius: 4px;
            width: 100%;
        }
        .application-details h3 {
            margin-top: 0;
            color: #2c3e50;
        }
        .detail-list {
            list-style-type: none;
            padding-left: 0;
        }
        .detail-list li {
            padding: 8px 0;
            border-bottom: 1px dashed #e0e0e0;
        }
        .detail-list li:last-child {
            border-bottom: none;
        }
        .detail-name {
            font-weight: 600;
            color: #555;
            display: inline-block;
            width: 140px;
        }
        .cta-button {
            display: inline-block;
            background-color: #089C34;
            color: white !important; /* Ensure text is white */
            text-decoration: none;
            padding: 14px 30px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 50px;
            margin: 20px 0;
            text-align: center;
            transition: background-color 0.3s;
        }
        .cta-button:hover {
            background-color: #067a29;
            color: white !important; /* Ensure text stays white on hover */
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .section-title {
            font-size: 20px;
            color: #2c3e50;
            margin-top: 35px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #089C34;
        }
        .benefits-list {
            padding-left: 20px;
        }
        .benefits-list li {
            padding: 8px 0;
        }
        .benefit-title {
            font-weight: 600;
            color: #089C34;
        }
        .documents-container {
            background-color: #f8f9fa;
            border-radius: 4px;
            padding: 20px;
            margin: 25px 0;
            width: 100%;
        }
        .documents-title {
            font-size: 18px;
            color: #2c3e50;
            margin-top: 0;
            margin-bottom: 15px;
        }
        .documents-list {
            column-count: 2;
            column-gap: 20px;
            padding-left: 20px;
        }
        .documents-list li {
            break-inside: avoid;
            padding: 5px 0;
        }
        .divider {
            height: 1px;
            background-color: #e0e0e0;
            margin: 30px 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 25px;
            text-align: center;
            color: #555;
            font-size: 14px;
            border-top: 1px solid #e0e0e0;
        }
        .contact-info {
            margin-top: 20px;
        }
        .contact-info p {
            margin: 5px 0;
        }
        .contact-link {
            color: #089C34;
            text-decoration: none;
        }
        .contact-link:hover {
            text-decoration: underline;
        }
        @media only screen and (max-width: 600px) {
            .email-header {
                padding: 20px;
            }
            .email-content {
                padding: 20px;
            }
            .header-title {
                font-size: 24px;
            }
            .documents-list {
                column-count: 1;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia Logo" class="logo">
            <h1 class="header-title">Welcome to Certified Australia!</h1>
        </div>
        
        <div class="email-content">
            <p class="welcome-text">
                Hi ${firstName} ${lastName}, 
                <br>
                We're thrilled to see you taking this important step in your career journey! 🎉
                Your registration has been successfully completed.
            </p>
            
            <div class="application-details">
                <h3>Your Application Details</h3>
                <ul class="detail-list">
                    <li><span class="detail-name">Application ID:</span> ${generateAppID}</li>
                    <li><span class="detail-name">Cost:</span> $${price}</li>
                    <li><span class="detail-name">Qualification:</span> ${lookingForWhatQualification}</li>
                </ul>
            </div>
            
            <div class="button-container">
                <a href="${loginUrl}" class="cta-button" style="color: white !important;">Make Payment & Continue</a>
            </div>
            
            <p>
                Thank you for choosing us to support your journey. Our team is here to assist you every step of the way, ensuring a seamless experience and providing the resources you need to achieve your goals.
            </p>
            
            <h2 class="section-title">Why Choose RPL with Certified Australia?</h2>
            <ul class="benefits-list">
                <li><span class="benefit-title">Save Time And Money:</span> Achieve recognition for your existing skills without unnecessary training.</li>
                <li><span class="benefit-title">Career Advancement:</span> Strengthen your professional profile and meet industry standards.</li>
                <li><span class="benefit-title">Personalised Support:</span> Our dedicated team will assist you through every step of the process.</li>
            </ul>
            
            <div class="documents-container">
                <h3 class="documents-title">Documents You Will Need</h3>
                <ul class="documents-list">
                    <li>100 Points ID (Passport, Drivers Licence, Medicare)</li>
                    <li>Contact Information</li>
                    <li>Residential Address</li>
                    <li>Place of Birth</li>
                    <li>Copy of Visa</li>
                    <li>USI Number</li>
                    <li>Photo Evidence of you onsite (for trades, construction and automotive)</li>
                    <li>Video Evidence of you onsite (for trades, construction and automotive)</li>
                    <li>Reference Letter</li>
                    <li>Resume</li>
                </ul>
            </div>
            
            <p>
                We look forward to a successful journey together. If you have any questions or need assistance, please don't hesitate to contact us.
            </p>
        </div>
        
        <div class="footer">
            <strong>Best Regards,</strong>
            <p>The Certified Australia Team</p>
            
            <div class="contact-info">
                <p>Email: <a href="mailto:info@certifiedaustralia.com.au" class="contact-link">info@certifiedaustralia.com.au</a></p>
                <p>Phone: <a href="tel:1300044927" class="contact-link">1300 044 927</a></p>
                <p>Website: <a href="https://www.certifiedaustralia.com.au" class="contact-link">www.certifiedaustralia.com.au</a></p>
            </div>
        </div>
    </div>
</body>
</html>
`;

    const emailSubject = `Congratulations, ${firstName}! You're Just a Few Steps Away from Getting Certified!`;
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
    const adminEmail = "sohaibahmedsipra@gmail.com";
    const emailAdmin2 = "sohaib.sipra@calcite.live";

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
      applicationStatus: [
        {
          statusname: "Student Intake Form",
          completed: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "payment",
          installments: [
            {
              payment1: false,
              payment2: false,
            },
          ],
          paid: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "documents uploaded",
          completed: false,
          time: new Date().toISOString(),
        },
        {
          statusname: "sent for verification",
          time: new Date().toISOString(),
        },
        {
          statusname: "verified",
          time: new Date().toISOString(),
        },
        {
          statusname: "completed",
          time: new Date().toISOString(),
        },
      ],
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
  getUserInfo,
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
