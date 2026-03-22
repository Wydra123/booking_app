const express = require("express");
const app = express();

app.use(express.json());

const cors = require("cors");
app.use(cors());

const { Pool } = require("pg");

const pool = new Pool({
  host: "db",
  user: "postgres",
  password: "postgres",
  database: "myapp",
  port: 5432,
});

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "SECRET_KEY";


const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.sendStatus(403);
  }
};


app.get("/", (req, res) => {
  res.send("Backend działa 🚀");
});

app.get("/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'client') RETURNING *",
    [email, hashedPassword]
  );

  res.json(result.rows[0]);
});


app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (user.rows.length === 0) {
    return res.status(400).json({ error: "User not found" });
  }

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) {
    return res.status(400).json({ error: "Wrong password" });
  }

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


app.post("/become-provider", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "UPDATE users SET role = 'provider' WHERE id = $1 RETURNING *",
    [userId]
  );

  const user = result.rows[0];

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


app.get("/services", async (req, res) => {
  const result = await pool.query("SELECT * FROM services");
  res.json(result.rows);
});


app.post("/services", authMiddleware, async (req, res) => {
  if (req.user.role !== "provider") {
    return res.status(403).json({ error: "Only providers can add services" });
  }

  const { name, duration, price, availability } = req.body;
  const userId = req.user.userId;

  const service = await pool.query(
    "INSERT INTO services (name, duration, price, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
    [name, duration, price, userId]
  );

  const serviceId = service.rows[0].id;

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

app.get("/services/:id", async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    "SELECT services.*, users.email FROM services JOIN users ON services.user_id = users.id WHERE services.id = $1",
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(result.rows[0]);
});


app.delete("/services/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM services WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});



app.get("/my-services", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "SELECT * FROM services WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows);
});

app.post("/appointments", authMiddleware, async (req, res) => {
  const { service_id, appointment_time } = req.body;
  const userId = req.user.userId;

  const service = await pool.query(
    "SELECT duration FROM services WHERE id = $1",
    [service_id]
  );

  const duration = Number(service.rows[0].duration);

  const addMinutes = (time, mins) => {
    const [date, t] = time.split("T");
    let [h, m] = t.split(":").map(Number);

    m += mins;
    h += Math.floor(m / 60);
    m = m % 60;

    return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const end_time = addMinutes(appointment_time, duration);

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

  res.json(result.rows[0]);
});

app.delete("/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM appointments WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});

app.get("/appointments/:serviceId", async (req, res) => {
  const result = await pool.query(
    "SELECT appointment_time, end_time FROM appointments WHERE service_id = $1",
    [req.params.serviceId]
  );

  res.json(result.rows);
});


app.get("/available-slots/:serviceId", async (req, res) => {
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

    const addMinutes = (time, mins) => {
      const [date, t] = time.split("T");
      let [h, m] = t.split(":").map(Number);

      m += mins;
      h += Math.floor(m / 60);
      m = m % 60;

      return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    let slots = [];

    let current = `${date}T${start_time.slice(0, 5)}`;
    const end = `${date}T${end_time.slice(0, 5)}`;

    while (current < end) {
      const slotEnd = addMinutes(current, duration);

      slots.push({
        start: current,
        end: slotEnd,
      });

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

app.get("/my-appointments", authMiddleware, async (req, res) => {
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

app.listen(3001, () => {
  console.log("Server running on port 3001");
});