// const ipWhitelist = (req, res, next) => {
//   // Allow localhost in development
//   const isDevelopment = process.env.NODE_ENV === "development";

//   const allowedIps = process.env.ALLOWED_IPS.split(",").map((ip) => ip.trim());

//   // Get client IP considering proxy configuration
//   const clientIp = (
//     req.headers["x-forwarded-for"]?.split(",")[0] ||
//     req.ip ||
//     req.connection.remoteAddress
//   ).trim();

//   // Add automatic localhost allowance for development
//   if (isDevelopment) {
//     allowedIps.push("127.0.0.1", "::1");
//   }

//   console.log(`Checking access for IP: ${clientIp}`);
//   console.log(`Allowed IPs: ${allowedIps.join(", ")}`);

//   if (!allowedIps.includes(clientIp)) {
//     console.warn(`IP Violation: ${clientIp}`);
//     return res.status(403).json({
//       message: "Office access required",
//       debug: {
//         yourIp: clientIp,
//         allowedIps,
//         environment: process.env.NODE_ENV,
//       },
//     });
//   }

//   next();
// };

// module.exports = ipWhitelist;
const ipWhitelist = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowedIps = process.env.ALLOWED_IPS.split(",").map((ip) => ip.trim());

  // Get client IP considering proxy configuration
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;

  // Auto-allow localhost in development
  if (!isProduction) {
    const localIps = new Set(["127.0.0.1", "::1", "localhost"]);
    if (localIps.has(clientIp)) {
      return next();
    }
  }

  // Convert IPv6 loopback to IPv4 for consistency
  const normalizedIp = clientIp.replace("::ffff:", "");

  // Debug logging
  console.log(`IP Check: ${normalizedIp} [${isProduction ? "PROD" : "DEV"}]`);
  console.log(`Allowed IPs: ${allowedIps.join(", ")}`);

  if (!allowedIps.includes(normalizedIp)) {
    console.warn(`IP Violation: ${normalizedIp}`);
    return res.status(403).json({
      message: "Office access required",
      ...(!isProduction && {
        // Debug info only in dev
        debug: {
          detectedIp: normalizedIp,
          allowedIps,
          xForwardedFor: req.headers["x-forwarded-for"],
          environment: process.env.NODE_ENV,
        },
      }),
    });
  }

  next();
};

module.exports = ipWhitelist;
