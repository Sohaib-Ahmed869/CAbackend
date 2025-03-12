// app.js
const cors = require("cors");
require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const { db } = require("./firebase");
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

const app = express();
app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(
  cors({
    origin: "*",
  })
);
app.use(logRequest);

app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rto", rtoRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/call", callRoutes);
app.use("/api/industry", industryRoutes);

app.get("/", (req, res) => {
  res.send("Certified Australia is running now again");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
