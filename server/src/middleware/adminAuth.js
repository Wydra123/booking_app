const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "SECRET_KEY";

const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== "admin") return res.sendStatus(403);
    req.user = decoded;
    next();
  } catch {
    return res.sendStatus(403);
  }
};

module.exports = adminAuth;
