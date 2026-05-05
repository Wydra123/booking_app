const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");
const wsServer = require("../ws");

const addMinutes = (time, mins) => {
  const [date, t] = time.split("T");
  let [h, m] = t.split(":").map(Number);

  m += mins;
  h += Math.floor(m / 60);
  m = m % 60;

  return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

router.post("/appointments", authMiddleware, async (req, res) => {
  const { service_id, appointment_time } = req.body;
  const userId = req.user.userId;

  const service = await pool.query(
    "SELECT id, duration, name, user_id FROM services WHERE id = $1",
    [service_id]
  );

  const { duration, name: serviceName, user_id: providerId } = service.rows[0];
  const end_time = addMinutes(appointment_time, Number(duration));

  const conflict = await pool.query(
    `SELECT * FROM appointments
     WHERE service_id = $1
     AND appointment_time < $2
     AND end_time > $3`,
    [service_id, end_time, appointment_time]
  );

  if (conflict.rows.length > 0) {
    return res.status(400).json({ error: "Termin zajęty" });
  }

  const result = await pool.query(
    `INSERT INTO appointments (user_id, service_id, appointment_time, end_time)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, service_id, appointment_time, end_time]
  );

  const clientInfo = await pool.query(
    `SELECT u.email, p.first_name, p.last_name, p.phone
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const client = clientInfo.rows[0];
  const clientName = [client.first_name, client.last_name].filter(Boolean).join(" ") || client.email;

  wsServer.notifyProvider(providerId, {
    type: "new_booking",
    appointment: result.rows[0],
    serviceName,
    clientName,
    clientEmail: client.email,
    clientPhone: client.phone || null,
  });

  res.json(result.rows[0]);
});

router.delete("/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM appointments WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});

router.delete("/provider/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const result = await pool.query(
    `DELETE FROM appointments
     USING services
     WHERE appointments.id = $1
       AND appointments.service_id = services.id
       AND services.user_id = $2`,
    [id, userId]
  );

  if (result.rowCount === 0) {
    return res.status(403).json({ error: "Brak dostępu lub rezerwacja nie istnieje" });
  }

  res.send("Deleted");
});

router.get("/appointments/:serviceId", async (req, res) => {
  const result = await pool.query(
    "SELECT appointment_time, end_time FROM appointments WHERE service_id = $1",
    [req.params.serviceId]
  );

  res.json(result.rows);
});

router.get("/available-slots/:serviceId", async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }

    const service = await pool.query(
      "SELECT duration FROM services WHERE id = $1",
      [serviceId]
    );

    const duration = Number(service.rows[0].duration);

    const jsDay = new Date(date).getDay();
    const day = (jsDay + 6) % 7;

    const availability = await pool.query(
      "SELECT * FROM availability WHERE service_id = $1 AND day_of_week = $2",
      [serviceId, day]
    );

    if (availability.rows.length === 0) {
      return res.json([]);
    }

    const { start_time, end_time } = availability.rows[0];

    let slots = [];
    let current = `${date}T${start_time.slice(0, 5)}`;
    const end = `${date}T${end_time.slice(0, 5)}`;

    while (current < end) {
      const slotEnd = addMinutes(current, duration);
      slots.push({ start: current, end: slotEnd });
      current = addMinutes(current, 30);
    }

    const appointments = await pool.query(
      "SELECT appointment_time, end_time FROM appointments WHERE service_id = $1",
      [serviceId]
    );

    const result = slots.map((slot) => {
      const isTaken = appointments.rows.some((t) => {
        return slot.start >= t.appointment_time && slot.start < t.end_time;
      });

      return {
        time: slot.start,
        available: !isTaken,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/my-appointments", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    `SELECT appointments.*, services.name
     FROM appointments
     JOIN services ON appointments.service_id = services.id
     WHERE appointments.user_id = $1
     ORDER BY appointment_time ASC`,
    [userId]
  );

  res.json(result.rows);
});

module.exports = router;
