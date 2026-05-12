const express = require("express");
const router = express.Router();
const pool = require("../db");
const adminAuth = require("../middleware/adminAuth");

// Statystyki ogólne
router.get("/admin/stats", adminAuth, async (req, res) => {
  const [users, services, appointments] = await Promise.all([
    pool.query("SELECT COUNT(*) FROM users"),
    pool.query("SELECT COUNT(*) FROM services"),
    pool.query("SELECT COUNT(*) FROM appointments"),
  ]);

  res.json({
    users: parseInt(users.rows[0].count),
    services: parseInt(services.rows[0].count),
    appointments: parseInt(appointments.rows[0].count),
  });
});

// Lista wszystkich użytkowników z danymi profilu
router.get("/admin/users", adminAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT u.id, u.email, u.role,
            p.first_name, p.last_name, p.phone
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     ORDER BY u.id ASC`
  );
  res.json(result.rows);
});

// Zmiana roli użytkownika (client / provider / admin)
router.patch("/admin/users/:id/role", adminAuth, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const allowed = ["client", "provider", "admin"];
  if (!allowed.includes(role)) {
    return res.status(400).json({ error: "Nieprawidłowa rola" });
  }

  // Nie pozwól adminowi zdegradować samego siebie
  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ error: "Nie możesz zmienić własnej roli" });
  }

  const result = await pool.query(
    "UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role",
    [role, id]
  );

  if (result.rows.length === 0) return res.status(404).json({ error: "Nie znaleziono użytkownika" });

  res.json(result.rows[0]);
});

// Usunięcie użytkownika (kaskadowo usuwa jego usługi i rezerwacje)
router.delete("/admin/users/:id", adminAuth, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.userId) {
    return res.status(400).json({ error: "Nie możesz usunąć własnego konta" });
  }

  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  res.json({ ok: true });
});

// Lista wszystkich usług z danymi właściciela
router.get("/admin/services", adminAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT s.id, s.name, s.price, s.duration,
            u.email AS owner_email, u.id AS owner_id
     FROM services s
     JOIN users u ON s.user_id = u.id
     ORDER BY s.id DESC`
  );
  res.json(result.rows);
});

// Usunięcie dowolnej usługi przez admina
router.delete("/admin/services/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM services WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

// Lista wszystkich rezerwacji
router.get("/admin/appointments", adminAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT a.id, a.appointment_time, a.end_time,
            s.name AS service_name,
            u.email AS client_email
     FROM appointments a
     JOIN services s ON a.service_id = s.id
     JOIN users u ON a.user_id = u.id
     ORDER BY a.appointment_time DESC`
  );
  res.json(result.rows);
});

// Usunięcie dowolnej rezerwacji przez admina
router.delete("/admin/appointments/:id", adminAuth, async (req, res) => {
  await pool.query("DELETE FROM appointments WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
