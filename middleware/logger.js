// middleware/logger.js
const fs = require("fs");
const path = require("path");

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logRequest = (req, res, next) => {
  // Get the original send method
  const originalSend = res.send;

  // Get timestamp
  const timestamp = new Date().toISOString();

  // Get client IP
  const ip =
    req.headers["x-forwarded-for"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);

  // Create a log entry for the request
  const reqLog = {
    timestamp,
    ip,
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.body,
    params: req.params,
    query: req.query,
    route: req.route ? req.route.path : "Unknown",
  };

  // Log request
  console.log(
    `[${timestamp}] Request from ${ip} to ${req.method} ${req.originalUrl}`
  );

  // Override the send method to capture the response
  res.send = function (body) {
    // Get the response status
    const statusCode = res.statusCode;

    // Create a log entry for the response
    const resLog = {
      timestamp: new Date().toISOString(),
      statusCode,
      headers: res._headers,
      body: body,
    };

    // Create complete log entry
    const logEntry = {
      request: reqLog,
      response: resLog,
    };

    // Log to console
    console.log(
      `[${timestamp}] Response to ${ip} for ${req.method} ${req.originalUrl}: ${statusCode}`
    );

    // Write to log file
    const logFileName = `${new Date().toISOString().split("T")[0]}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    fs.appendFile(logFilePath, JSON.stringify(logEntry) + "\n", (err) => {
      if (err) {
        console.error("Error writing to log file:", err);
      }
    });

    // Call the original send method
    return originalSend.call(this, body);
  };

  next();
};

module.exports = logRequest;
