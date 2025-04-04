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
const ipaddr = require("ipaddr.js");

const ipWhitelist = (req, res, next) => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowedIps =
    process.env.ALLOWED_IPS?.split(",").map((ip) => ip.trim()) || [];

  // Get client IP
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;

  // Auto-allow localhost in development
  if (!isProduction) {
    const localIps = new Set(["127.0.0.1", "::1", "localhost"]);
    if (localIps.has(clientIp)) return next();
  }

  // Normalize IP (strip IPv6 prefix)
  const normalizedIp = clientIp.replace("::ffff:", "");

  // Debug logging
  console.log(`IP Check: ${normalizedIp} [${isProduction ? "PROD" : "DEV"}]`);
  console.log(`Allowed IPs: ${allowedIps.join(", ")}`);

  // IP Validation
  let isAllowed = false;
  try {
    const parsedClient = ipaddr.parse(normalizedIp);
    isAllowed = allowedIps.some((allowedIp) => {
      const parsedAllowed = ipaddr.parse(allowedIp);
      // Treat allowed IP as a single-host CIDR
      const cidr = parsedAllowed.toCIDR(); // e.g., "2001:4860:7:622::fe/128"
      const [cidrAddr, cidrMask] = ipaddr.parseCIDR(cidr);
      return parsedClient.match(cidrAddr, cidrMask);
    });
  } catch (e) {
    console.error("IP parsing error:", e);
    if (isProduction) {
      return res.status(403).json({ message: "Access denied" });
    }
  }

  if (!isAllowed) {
    console.warn(`IP Violation: ${normalizedIp}`);
    return res.status(403).json({
      message: "Office access required",
      ...(!isProduction && {
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
