// app.js
const cors = require("cors");
require("dotenv").config();
const express = require("express");
const { db } = require("./firebase");

const userRoutes = require("./routes/userRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const rtoRoutes = require("./routes/rtoroutes");

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

app.use("/api/users", userRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/rto", rtoRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
