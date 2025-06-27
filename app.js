// server.js
const cors = require("cors");
require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const { db } = require("./firebase");
const { bucket } = require("./firebase");
const path = require("path");
const { OpenAI } = require("openai");
const bodyParser = require("body-parser");

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
const taskRoutes = require("./routes/taskRoutes");
const timerRoutes = require("./routes/timerRoutes");
const FormRoutes = require("./routes/rtoFormRoutes");
const ForcastingRoutes = require("./routes/forecastingRoutes");
const {
  startPaymentPlanScheduler,
} = require("./schedulers/paymentPlanScheduler");

const app = express();
const PORT = process.env.PORT || 5000;

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(bodyParser.json());
app.use(
  cors({
    origin: [
      "https://ca-silk.vercel.app",
      "http://localhost:5173",
      "https://portal.certifiedaustralia.com.au",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Added OPTIONS
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept", // Required for file uploads
      "Origin", // Required for CORS
      "X-Requested-With", // Common for AJAX requests
    ],
    credentials: true, // Important for authenticated requests
  })
);
app.use(logRequest);
app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", true);
const isProduction = process.env.NODE_ENV === "production";

// API Routes
app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/form", FormRoutes);
// app.use("/api/admin", ipWhitelist, adminRoutes);
// app.use("/api/admin", authenticateAdmin, ipWhitelist, adminRoutes);
app.use("/api/rto", rtoRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/call", callRoutes);
app.use("/api/industry", industryRoutes);
app.use("/api/assessor", assessorRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/timer", timerRoutes);
app.use("/api/forecasting", ForcastingRoutes);
startPaymentPlanScheduler();

// Chatbot API endpoint
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received chatbot request:", req.body);
    const { message, chatHistory } = req.body;

    // Format the conversation history for OpenAI
    const formattedHistory = chatHistory.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.text,
    }));

    // Add system message with context about forms
    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant for Certified Australia, an RTO (Registered Training Organization) that helps students get certified. 
        Your job is to assist students with filling out their enrollment forms and RPL (Recognition of Prior Learning) assessment documents.
        
        The forms include:
        1. Enrollment Form - Contains personal details, contact information, language and cultural diversity, education details, etc.
        2. RPL Assessment Forms - Used for Recognition of Prior Learning, includes evidence collection, self-assessment, employment verification, and referee testimonials.
        
        Be specific and helpful with your answers. If a student is stuck on a particular section, explain what information they need to provide and why it's important.
        
        Important sections in the enrollment form include:
        - Personal details and contact information
        - Emergency contact details
        - Cultural and language diversity
        - Education history
        - Employment status
        - Previous qualifications
        
        Important sections in the RPL forms include:
        - Student declaration
        - Evidence collection (photos, payslips, certificates, work samples)
        - Self-assessment of competencies
        - Employment verification
        - Referee testimonials
        
        Answer questions clearly and concisely. If you don't know the answer, say so and suggest contacting Certified Australia directly at info@certifiedaustralia.com.au.`,
      },
      ...formattedHistory,
      {
        role: "user",
        content: message,
      },
    ];

    // Get response from OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Use appropriate model based on your needs
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    // Send response back to client
    res.json({
      response: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error("Error in chatbot API:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

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

// Root route
app.get("/", (req, res) => {
  res.send("Certified Australia API is running");
});

// Start the reminder scheduler
// startReminderScheduler();

// Start server
app.listen(PORT, () => {
  console.log(
    `Server running in ${
      isProduction ? "production" : "development"
    } mode on port ${PORT}`
  );
});
