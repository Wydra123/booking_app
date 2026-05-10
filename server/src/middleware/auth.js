const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "SECRET_KEY";

// Middleware sprawdzający token JWT w nagłówku Authorization: Bearer <token>
// Jeśli token jest poprawny, dane użytkownika trafiają do req.user i request idzie dalej
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.sendStatus(401); // brak nagłówka = niezalogowany

  const token = authHeader.split(" ")[1]; // wyciąga sam token z "Bearer <token>"

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // { userId, role, email }
    next();
  } catch {
    return res.sendStatus(403); // token nieważny lub wygasły
  }
};

module.exports = authMiddleware;
