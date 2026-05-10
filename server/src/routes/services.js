const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

// Pobierz wszystkie usługi (widoczne publicznie, bez logowania)
router.get("/services", async (req, res) => {
  const result = await pool.query("SELECT * FROM services");
  res.json(result.rows);
});

// Dodaj nową usługę — tylko dla providerów
router.post("/services", authMiddleware, async (req, res) => {
  if (req.user.role !== "provider") {
    return res.status(403).json({ error: "Only providers can add services" });
  }

  const { name, duration, price, availability, image_url, description } = req.body;
  const userId = req.user.userId;

  // Wstaw usługę do bazy i pobierz przydzielone ID
  const service = await pool.query(
    "INSERT INTO services (name, duration, price, user_id, image_url, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [name, duration, price, userId, image_url || null, description || null]
  );

  const serviceId = service.rows[0].id;

  // Zapisz dostępność tylko dla dni, które provider oznaczył jako aktywne
  for (const day of availability) {
    if (day.enabled) {
      await pool.query(
        `INSERT INTO availability (service_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)`,
        [serviceId, day.day, day.start, day.end]
      );
    }
  }

  res.json(service.rows[0]);
});

// Pobierz szczegóły jednej usługi wraz z danymi kontaktowymi providera
router.get("/services/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `SELECT services.*, users.email,
            up.first_name, up.last_name, up.phone
     FROM services
     JOIN users ON services.user_id = users.id
     LEFT JOIN user_profiles up ON up.user_id = users.id
     WHERE services.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(result.rows[0]);
});

// Edytuj usługę — tylko właściciel może ją modyfikować
router.put("/services/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const { name, duration, price, availability, image_url, description } = req.body;

  // Upewnij się, że zalogowany użytkownik jest właścicielem tej usługi
  const check = await pool.query(
    "SELECT id FROM services WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  if (check.rows.length === 0) {
    return res.status(403).json({ error: "Brak uprawnień" });
  }

  const result = await pool.query(
    "UPDATE services SET name = $1, duration = $2, price = $3, image_url = $4, description = $5 WHERE id = $6 RETURNING *",
    [name, duration, price, image_url !== undefined ? image_url : null, description || null, id]
  );

  // Przebuduj dostępność od zera — usuń starą i wstaw nową
  await pool.query("DELETE FROM availability WHERE service_id = $1", [id]);

  for (const day of availability) {
    if (day.enabled) {
      await pool.query(
        "INSERT INTO availability (service_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)",
        [id, day.day, day.start, day.end]
      );
    }
  }

  res.json(result.rows[0]);
});

// Usuń usługę — warunek user_id zapobiega usunięciu cudzej usługi
router.delete("/services/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM services WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});

// Pobierz listę rezerwacji dla danej usługi — tylko dla jej właściciela
router.get("/services/:id/bookings", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const check = await pool.query(
    "SELECT id FROM services WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  if (check.rows.length === 0) {
    return res.status(403).json({ error: "Brak uprawnień" });
  }

  const result = await pool.query(
    `SELECT appointments.id, appointments.appointment_time, appointments.end_time,
            users.email,
            up.first_name, up.last_name, up.phone
     FROM appointments
     JOIN users ON appointments.user_id = users.id
     LEFT JOIN user_profiles up ON up.user_id = users.id
     WHERE appointments.service_id = $1
     ORDER BY appointments.appointment_time ASC`,
    [id]
  );

  res.json(result.rows);
});

// Pobierz okna dostępności dla danej usługi (dni tygodnia + godziny)
router.get("/services/:id/availability", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM availability WHERE service_id = $1",
    [req.params.id]
  );
  res.json(result.rows);
});

// Pobierz usługi należące do zalogowanego providera
router.get("/my-services", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "SELECT * FROM services WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows);
});

module.exports = router;
