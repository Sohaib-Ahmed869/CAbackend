// roleMiddleware.js
const allowRoles = (allowedRoles) => (req, res, next) => {
  const { role } = req.user;
  if (!allowedRoles.includes(role)) return res.status(403).json({ message: "Forbidden" });
  next();
};

module.exports = { allowRoles };
