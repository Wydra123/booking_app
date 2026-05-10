const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

// Pobierz profil zalogowanego użytkownika (imię, nazwisko, telefon)
router.get("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "SELECT * FROM user_profiles WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows[0] || {}); // zwróć pusty obiekt jeśli profil jeszcze nie istnieje
});

// Zapisz lub zaktualizuj profil (UPSERT — wstaw jeśli brak, nadpisz jeśli istnieje)
router.put("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { first_name, last_name, phone } = req.body;

  const result = await pool.query(
    `INSERT INTO user_profiles (user_id, first_name, last_name, phone, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE
       SET first_name = $2, last_name = $3, phone = $4, updated_at = now()
     RETURNING *`,
    [userId, first_name, last_name, phone]
  );

  res.json(result.rows[0]);
});

// Usuń konto wraz ze wszystkimi powiązanymi danymi (kaskadowe czyszczenie)
router.delete("/account", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  // Najpierw pobierz ID usług providera, żeby usunąć ich dostępność i rezerwacje
  const services = await pool.query(
    "SELECT id FROM services WHERE user_id = $1",
    [userId]
  );
  const serviceIds = services.rows.map((s) => s.id);

  if (serviceIds.length > 0) {
    await pool.query("DELETE FROM availability WHERE service_id = ANY($1)", [serviceIds]);
    await pool.query("DELETE FROM appointments WHERE service_id = ANY($1)", [serviceIds]);
  }

  // Usuń rezerwacje złożone przez tego użytkownika jako klient
  await pool.query("DELETE FROM appointments WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM services WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);

  res.send("Deleted");
});

module.exports = router;
