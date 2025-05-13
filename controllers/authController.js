const { auth, db } = require("../firebase");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/emailUtil");
const adminEmail = process.env.CEO_EMAIL;

const newLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user document
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = userDoc.data();
    const { name, role, type, email } = userData;

    // 2FA Check Logic
    const requires2FA =
      ["admin", "assessor", "rto", "agent", "ceo"].includes(role) ||
      ["ceo", "agent", "rto", "manager"].includes(type);

    if (requires2FA && role !== "customer") {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log("2FA code:", code);
      // Store in Firestore
      await db
        .collection("twoFactorAuth")
        .doc(uid)
        .set({ code, expiresAt, attempts: 3, email });
      const emailOption =
        role === "rto" || role === "assessor" ? email : adminEmail;
      // Send email
      // const emailResponse = await sendVerificationEmail(
      //   emailOption,
      //   code,
      //   role,
      //   type
      // );

      // if (!emailResponse.success) {
      //   return res.status(500).json({ message: "Failed to send 2FA email" });
      // }
      return res.status(200).json({
        requires2FA: true,
        message: "2FA code sent to email",
        email,
        role,
        name,
      });
    }

    // Generate JWT
    const token = jwt.sign({ uid, role, type }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({ token, role, type });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ message: "Authentication failed" });
  }
};

const verify2FA = async (req, res) => {
  const { code, idToken } = req.body;

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const twoFARef = db.collection("twoFactorAuth").doc(uid);
    const doc = await twoFARef.get();

    if (!doc.exists) return res.status(400).json({ message: "Invalid code" });

    const { code: storedCode, attempts, expiresAt } = doc.data();

    if (expiresAt.toDate() < new Date()) {
      await twoFARef.delete();
      return res
        .status(400)
        .json({ message: "Code expired. Request a new one." });
    }

    if (attempts <= 0) {
      await twoFARef.delete();
      return res
        .status(400)
        .json({ message: "You have used all attempts. Request a new code." });
    }

    if (code !== storedCode) {
      if (attempts - 1 === 0) {
        await twoFARef.delete();
        return res.status(400).json({
          message: "Invalid code. No attempts remaining. Request a new code.",
        });
      } else {
        await twoFARef.update({ attempts: attempts - 1 });
        return res.status(400).json({
          message: `Invalid code. ${attempts - 1} attempts remaining`,
          attemptsLeft: attempts - 1,
        });
      }
    }

    // Generate final JWT
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    const token = jwt.sign(
      { uid, role: userData.role, type: userData.type },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await twoFARef.delete();
    res.json({
      token,
      role: userData.role,
      type: userData.type,
      name: userData.name,
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const resend2FACode = async (req, res) => {
  const { idToken } = req.body;

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Fetch user data
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found" });
    }
    const { email, role, type } = userDoc.data();

    const twoFARef = db.collection("twoFactorAuth").doc(uid);
    const doc = await twoFARef.get();

    if (doc.exists) {
      const { lastResent } = doc.data();
      if (lastResent && Date.now() - lastResent.toMillis() < 60000) {
        return res
          .status(429)
          .json({ message: "Wait 1 minute before resending" });
      }
    }
    const emailOption =
      role === "rto" || role === "assessor" ? email : adminEmail;
    // Generate new 2FA code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    await twoFARef.set({
      code: newCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 3,
      lastResent: new Date(),
      email,
    });

    const emailResponse = await sendVerificationEmail(
      emailOption,
      newCode,
      role,
      type
    );

    if (!emailResponse.success) {
      return res.status(500).json({ message: "Failed to send 2FA email" });
    }
    res.json({ message: "New code sent" });
  } catch (error) {
    console.error("Resend error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// email
const emailHeader = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Certified Australia</title>
  <style type="text/css">
    /* CLIENT-SPECIFIC STYLES */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; }

    /* RESET STYLES */
    img { border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }

    /* iOS BLUE LINKS */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Base container */
    .email-wrapper {
      width: 100%;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    /* Header */
    .email-header {
      background-color:rgb(255, 255, 255);
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    
    .logo-container {
      margin-bottom: 10px;
    }
    
    .logo {
      max-width: 250px;
      height: auto;
    }
    
    /* Body */
    .email-body {
      background-color: white;
      padding: 30px;
      border-radius: 0 0 8px 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    /* Footer */
    .email-footer {
      text-align: center;
      margin-top: 20px;
      padding: 20px;
      font-size: 14px;
      color: #666;
    }
    
    /* Typography */
    h1, h2, h3 {
      color: #2c3e50;
      margin-top: 0;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
    }
    
    h1 {
      color: white;
      font-size: 24px;
    }
    
    p, ul, ol, li {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: #333;
    }
    
    /* Buttons */
    .button-container {
      text-align: center;
      margin: 25px 0;
    }
    
    .button {
      background-color: #089C34;
      color: #ffffff !important;
      text-decoration: none;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      font-size: 16px;
      font-weight: bold;
      padding: 15px 30px;
      border-radius: 5px;
      display: inline-block;
    }
    
    /* Notes and status boxes */
    .important-note {
      background-color: #f8f9fa;
      border-left: 4px solid #089C34;
      padding: 15px;
      margin: 20px 0;
    }
    
    .status-item {
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 5px;
    }
    
    .status-complete {
      background-color: #e8f5e9;
      border-left: 4px solid #4caf50;
    }
    
    .status-pending {
      background-color: #fff8e1;
      border-left: 4px solid #ffc107;
    }
    
    .payment-details {
      background-color: #e8f4fd;
      border-left: 4px solid #2196f3;
      padding: 15px;
      margin: 20px 0;
    }
    
    /* MOBILE STYLES */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 10px !important;
      }
      
      .email-body {
        padding: 20px !important;
      }
      
      h1 { font-size: 22px !important; }
      h2 { font-size: 20px !important; }
      h3 { font-size: 18px !important; }
      
      .button {
        display: block !important;
        width: 100% !important;
      }
      
      .logo {
        max-width: 200px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4;">
  <div class="email-wrapper">
    <div class="email-container">
      <div class="email-header">
        <div class="logo-container">
          <img src="https://logosca.s3.ap-southeast-2.amazonaws.com/image-removebg-preview+(18).png" alt="Certified Australia Logo" class="logo">
        </div>
      </div>
      <div class="email-body">
`;
const emailFooter = `
      </div>
      <div class="email-footer">
        <p>
          <strong>Certified Australia</strong><br>
          Email: <a href="mailto:info@certifiedaustralia.com.au" style="color: #089C34; text-decoration: none;">info@certifiedaustralia.com.au</a><br>
          Phone: <a href="tel:1300044927" style="color: #089C34; text-decoration: none;">1300 044 927</a><br>
          Website: <a href="https://www.certifiedaustralia.com.au" style="color: #089C34; text-decoration: none;">www.certifiedaustralia.com.au</a>
        </p>
        <p>© ${new Date().getFullYear()} Certified Australia. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

const sendVerificationEmail = async (email, code, role, type) => {
  const name =
    role === "rto" || role === "assessor" || role === "agent" ? role : type;
  const emailSubject = `Your 2FA Verification Code for ` + name;
  const emailBody = `
    <h2>Dear User,</h2>
    
    <p> verification code for  ${name} is: <strong>${code}</strong>. This code will expire in 10 minutes.</p>
    
    <div class="important-note">
      <h3>Important Security Note</h3>
      <p>If you did not request this code, please ignore this email or contact support immediately.</p>
    </div>
    
    <p>Thank you for using Certified Australia.</p>
    
    <p>Warm regards,<br>The Certified Australia Team</p>
  `;

  try {
    // Ensure emailHeader and emailFooter are defined somewhere in the scope
    const fullEmailBody = emailHeader + emailBody + emailFooter;

    // Send email and await the result
    await sendEmail(email, fullEmailBody, emailSubject);

    return { success: true };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = { newLogin, verify2FA, resend2FACode };
