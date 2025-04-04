const jwt = require("jsonwebtoken");

const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);

    // Allowed roles array
    const allowedRoles = ["admin", "assessor", "rto", "agent", "manager"];

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient privileges for this resource",
      });
    }

    req.user = user;
    next();
  });
};

module.exports = { authenticateAdmin };
