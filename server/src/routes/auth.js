const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const mailer = require("../mailer");
const authMiddleware = require("../middleware/auth");

const SECRET = process.env.JWT_SECRET || "SECRET_KEY";

// Rejestracja nowego użytkownika (rola domyślna: client)
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email i hasło są wymagane." });
  }

  // Sprawdź czy konto z tym emailem już istnieje
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: "Konto z tym adresem email już istnieje." });
  }

  // Hashuj hasło przed zapisem do bazy (10 rund salt)
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'client') RETURNING *",
    [email, hashedPassword]
  );

  // Wyślij mail powitalny — błąd maila nie blokuje rejestracji
  console.log(`[MAIL] Próba wysłania maila powitalnego do: ${email}`);
  mailer.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Witamy w serwisie!",
    text: `Cześć!\n\nTwoje konto zostało pomyślnie utworzone.\nMożesz się teraz zalogować pod adresem: ${email}\n\nPozdrawiamy,\nZespół serwisu`,
  }).then((info) => {
    console.log(`[MAIL] Mail powitalny wysłany do ${email}. MessageId: ${info.messageId}, Response: ${info.response}`);
  }).catch((err) => {
    console.error(`[MAIL] Błąd wysyłania maila do ${email}:`, err.message);
    console.error("[MAIL] Szczegóły błędu:", err);
  });

  res.json(result.rows[0]);
});

// Logowanie — zwraca token JWT jeśli dane są poprawne
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (user.rows.length === 0) {
    return res.status(400).json({ error: "Nie znaleziono użytkownika o podanym emailu." });
  }

  // Porównaj podane hasło z hashem z bazy
  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) {
    return res.status(400).json({ error: "Nieprawidłowe hasło." });
  }

  // Wygeneruj token JWT z danymi użytkownika (bez expiry — token ważny bezterminowo)
  const token = jwt.sign(
    {
      userId: user.rows[0].id,
      role: user.rows[0].role,
      email: user.rows[0].email,
    },
    SECRET
  );

  res.json({ token });
});

// Zmiana roli zalogowanego użytkownika na "provider" i zwrócenie nowego tokenu
router.post("/become-provider", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "UPDATE users SET role = 'provider' WHERE id = $1 RETURNING *",
    [userId]
  );

  const user = result.rows[0];

  // Nowy token musi zawierać zaktualizowaną rolę, żeby frontend od razu ją widział
  const token = jwt.sign(
    {
      userId: user.id,
      role: user.role,
      email: user.email,
    },
    SECRET
  );

  res.json({ token });
});

module.exports = router;
