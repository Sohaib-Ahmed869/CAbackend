// app.js
const cors = require("cors");
require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const { db } = require("./firebase");
const { bucket } = require("./firebase"); // Using your existing firebase.js file
const path = require("path");

const logRequest = require("./middleware/logger");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const userRoutes = require("./routes/userRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const rtoRoutes = require("./routes/rtoroutes");
const agentRoutes = require("./routes/agentRoutes");
const callRoutes = require("./routes/callRoutes");
const industryRoutes = require("./routes/industryRoutes");
const { startReminderScheduler } = require("./croneJobs/reminderScheduler");
const { authenticateAdmin } = require("./middleware/authenticate");
const ipWhitelist = require("./middleware/ipWhiteList");
const assessorRoutes = require("./routes/assesorRoutes");

const app = express();
app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    // origin: "https://portal.certifiedaustralia.com.au",
    // origin: "http://localhost:5173",
    origin: "https://ca-git-tester-sohaib-ahmeds-projects-a27ab513.vercel.app",
    // origin: "http://catestbucketnew.s3-website-ap-southeast-2.amazonaws.com",
  })
);
app.use(logRequest);
app.set("trust proxy", true);
const isProduction = process.env.NODE_ENV === "production";

app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/admin", ipWhitelist, adminRoutes);
// app.use("/api/admin", authenticateAdmin, ipWhitelist, adminRoutes);
app.use("/api/rto", rtoRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/call", callRoutes);
app.use("/api/industry", industryRoutes);
app.use("/api/assessor", assessorRoutes);
// proxy for downloading documents

app.get("/proxy-file", async (req, res) => {
  try {
    const fileUrl = req.query.url;

    if (!fileUrl) {
      return res.status(400).send("URL parameter is required");
    }

    console.log("Processing request for:", fileUrl);

    // Extract file path from the Firebase URL
    const urlObj = new URL(fileUrl);
    const pathPart = urlObj.pathname.split("/o/")[1];

    if (!pathPart) {
      return res.status(400).send("Invalid Firebase Storage URL format");
    }

    // Decode the path (Firebase URLs are URL-encoded)
    const filePath = decodeURIComponent(pathPart.split("?")[0]);
    console.log("Extracted file path:", filePath);

    // Get file from Firebase Storage
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.error("File not found in storage:", filePath);
      return res.status(404).send("File not found in storage");
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";

    // Set headers for proper file downloading
    res.setHeader("Content-Type", contentType);
    const fileName = path.basename(filePath);
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Stream the file to the response
    console.log(`Streaming file: ${fileName} (${contentType})`);

    const fileStream = file.createReadStream();

    // Handle stream errors
    fileStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).send(`Error streaming file: ${error.message}`);
      }
    });

    // Handle successful completion
    fileStream.on("end", () => {
      console.log("File stream completed successfully");
    });

    // Pipe the file stream to the response
    fileStream.pipe(res);
  } catch (error) {
    console.error("Proxy server error:", error);
    res.status(500).send(`Error processing request: ${error.message}`);
  }
});
app.get("/", (req, res) => {
  res.send("Certified Australia is running now again");
});

startReminderScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `Server running in ${
      isProduction ? "production" : "development"
    } mode on port ${PORT}`
  );
});
