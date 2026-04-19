const express = require("express");
const app = express();
require("dotenv").config(); // Ładuje zmienne środowiskowe z pliku .env

app.use(express.json()); // Parsowanie ciała żądań jako JSON

const cors = require("cors");
app.use(cors()); // Zezwolenie na żądania cross-origin (frontend na innym porcie)

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use("/uploads", express.static(uploadsDir));

const { Pool } = require("pg");

// Pula połączeń z bazą PostgreSQL — dane logowania z .env
const pool = new Pool({
  host: "db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

pool.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT").catch(() => {});
pool.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT").catch(() => {});

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Transporter SMTP — dane logowania z .env
const mailer = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  debug: true,
  logger: true,
});

console.log("[MAIL] Konfiguracja SMTP:", {
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  user: process.env.MAIL_USER,
  from: process.env.MAIL_FROM,
  passSet: !!process.env.MAIL_PASS,
});

mailer.verify((err, success) => {
  if (err) {
    console.error("[MAIL] Błąd weryfikacji połączenia SMTP:", err.message);
  } else {
    console.log("[MAIL] Połączenie SMTP zweryfikowane pomyślnie:", success);
  }
});

// Klucz do podpisywania tokenów JWT — powinien być w .env na produkcji
const SECRET = "SECRET_KEY";


// Middleware sprawdzający token JWT w nagłówku Authorization: Bearer <token>
// Dokłada zdekodowane dane użytkownika do req.user i przekazuje dalej
// Zwraca 401 gdy brak nagłówka, 403 gdy token nieważny/wygasły
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.sendStatus(401);

  const token = authHeader.split(" ")[1]; // wycinamy część po "Bearer "

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.sendStatus(403);
  }
};


// Tworzy tabelę profili jeśli jeszcze nie istnieje — uruchamiane raz przy starcie serwera
pool.query(`
  CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id integer PRIMARY KEY REFERENCES public.users(id),
    first_name text,
    last_name text,
    phone text,
    updated_at timestamp without time zone DEFAULT now()
  )
`).catch((err) => console.error("Błąd tworzenia tabeli user_profiles:", err));


// Usuwa konto zalogowanego użytkownika wraz ze wszystkimi powiązanymi danymi
app.delete("/account", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  // Pobieramy id usług użytkownika, żeby usunąć ich dostępność i rezerwacje
  const services = await pool.query(
    "SELECT id FROM services WHERE user_id = $1",
    [userId]
  );
  const serviceIds = services.rows.map((s) => s.id);

  if (serviceIds.length > 0) {
    await pool.query("DELETE FROM availability WHERE service_id = ANY($1)", [serviceIds]);
    await pool.query("DELETE FROM appointments WHERE service_id = ANY($1)", [serviceIds]);
  }

  // Usuwamy rezerwacje złożone przez użytkownika, profil i usługi
  await pool.query("DELETE FROM appointments WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM services WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM users WHERE id = $1", [userId]);

  res.send("Deleted");
});


// Zwraca profil zalogowanego użytkownika (imię, nazwisko, telefon)
app.get("/profile", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "SELECT * FROM user_profiles WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows[0] || {});
});


// Zapisuje lub aktualizuje profil zalogowanego użytkownika (upsert)
app.put("/profile", authMiddleware, async (req, res) => {
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


// Healthcheck — sprawdzenie czy serwer działa
app.get("/", (req, res) => {
  res.send("Backend działa 🚀");
});

// Healthcheck bazy danych — zwraca aktualny czas z PostgreSQL
app.get("/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

// Rejestracja nowego użytkownika
// Sprawdza unikalność emaila, hashuje hasło bcryptem, zapisuje z rolą "client"
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email i hasło są wymagane." });
  }

  // Sprawdź czy email już istnieje
  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: "Konto z tym adresem email już istnieje." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (email, password, role) VALUES ($1, $2, 'client') RETURNING *",
    [email, hashedPassword]
  );

  // Wysyłamy mail powitalny — błąd maila nie blokuje rejestracji
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


// Logowanie użytkownika
// Weryfikuje hasło bcryptem, zwraca token JWT z userId, rolą i emailem
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (user.rows.length === 0) {
    return res.status(400).json({ error: "Nie znaleziono użytkownika o podanym emailu." });
  }

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) {
    return res.status(400).json({ error: "Nieprawidłowe hasło." });
  }

  // Generujemy token z danymi użytkownika — rola trafia do frontendu bez dodatkowego requestu
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


// Zmiana roli zalogowanego użytkownika z "client" na "provider"
// Zwraca nowy token JWT z już zaktualizowaną rolą
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


// Upload zdjęcia usługi — zwraca URL zapisanego pliku
app.post("/upload", authMiddleware, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Brak pliku" });
  res.json({ url: `/uploads/${req.file.filename}` });
});


// Zwraca wszystkie dostępne usługi (publiczny endpoint — bez autoryzacji)
app.get("/services", async (req, res) => {
  const result = await pool.query("SELECT * FROM services");
  res.json(result.rows);
});


// Dodaje nową usługę wraz z dostępnością (tylko dla providerów)
// availability to tablica dni tygodnia z godzinami start/end
app.post("/services", authMiddleware, async (req, res) => {
  if (req.user.role !== "provider") {
    return res.status(403).json({ error: "Only providers can add services" });
  }

  const { name, duration, price, availability, image_url, description } = req.body;
  const userId = req.user.userId;

  const service = await pool.query(
    "INSERT INTO services (name, duration, price, user_id, image_url, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    [name, duration, price, userId, image_url || null, description || null]
  );

  const serviceId = service.rows[0].id;

  // Zapisujemy dostępność dla każdego zaznaczonego dnia tygodnia
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

// Zwraca szczegóły jednej usługi wraz z emailem właściciela (JOIN z tabelą users)
app.get("/services/:id", async (req, res) => {
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


// Aktualizuje usługę — tylko właściciel może edytować (warunek user_id)
// Usuwa starą dostępność i wstawia nową na podstawie przesłanej tablicy
app.put("/services/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const { name, duration, price, availability, image_url, description } = req.body;

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


// Zwraca rezerwacje danej usługi wraz z danymi klientów — tylko dla właściciela usługi
app.get("/services/:id/bookings", authMiddleware, async (req, res) => {
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


// Zwraca dostępność dla danej usługi (używane przy edycji)
app.get("/services/:id/availability", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM availability WHERE service_id = $1",
    [req.params.id]
  );
  res.json(result.rows);
});


// Usuwa usługę — tylko właściciel może usunąć swoją usługę (warunek user_id = $2)
app.delete("/services/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM services WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});


// Zwraca usługi należące do zalogowanego providera
app.get("/my-services", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const result = await pool.query(
    "SELECT * FROM services WHERE user_id = $1",
    [userId]
  );

  res.json(result.rows);
});

// Tworzy rezerwację dla wybranego slotu
// Oblicza end_time na podstawie czasu trwania usługi,
// sprawdza konflikt z istniejącymi rezerwacjami (nakładanie się przedziałów czasowych)
app.post("/appointments", authMiddleware, async (req, res) => {
  const { service_id, appointment_time } = req.body;
  const userId = req.user.userId;

  const service = await pool.query(
    "SELECT duration FROM services WHERE id = $1",
    [service_id]
  );

  const duration = Number(service.rows[0].duration);

  // Pomocnicza funkcja dodająca minuty do timestampa w formacie "YYYY-MM-DDTHH:MM"
  const addMinutes = (time, mins) => {
    const [date, t] = time.split("T");
    let [h, m] = t.split(":").map(Number);

    m += mins;
    h += Math.floor(m / 60);
    m = m % 60;

    return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const end_time = addMinutes(appointment_time, duration);

  // Sprawdzenie konfliktu: czy istnieje rezerwacja nakładająca się z żądanym przedziałem
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

// Anuluje rezerwację — tylko właściciel rezerwacji może ją usunąć (warunek user_id = $2)
app.delete("/appointments/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  await pool.query(
    "DELETE FROM appointments WHERE id = $1 AND user_id = $2",
    [id, userId]
  );

  res.send("Deleted");
});

// Zwraca wszystkie rezerwacje dla danej usługi (appointment_time i end_time)
// Używane wewnętrznie do sprawdzania zajętości slotów
app.get("/appointments/:serviceId", async (req, res) => {
  const result = await pool.query(
    "SELECT appointment_time, end_time FROM appointments WHERE service_id = $1",
    [req.params.serviceId]
  );

  res.json(result.rows);
});


// Zwraca listę slotów godzinowych dla danej usługi i daty
// Sloty generowane co 30 min w oknie dostępności providera,
// każdy slot oznaczony flagą available: true/false na podstawie istniejących rezerwacji
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

    // getDay() zwraca 0=niedziela…6=sobota, przeliczamy na 0=Pn…6=Nd
    const jsDay = new Date(date).getDay();
    const day = (jsDay + 6) % 7;

    // Pobieramy godziny pracy providera dla danego dnia tygodnia
    const availability = await pool.query(
      "SELECT * FROM availability WHERE service_id = $1 AND day_of_week = $2",
      [serviceId, day]
    );

    // Brak wpisu w availability = provider nie pracuje w tym dniu
    if (availability.rows.length === 0) {
      return res.json([]);
    }

    const { start_time, end_time } = availability.rows[0];

    // Pomocnicza funkcja dodająca minuty do timestampa w formacie "YYYY-MM-DDTHH:MM"
    const addMinutes = (time, mins) => {
      const [date, t] = time.split("T");
      let [h, m] = t.split(":").map(Number);

      m += mins;
      h += Math.floor(m / 60);
      m = m % 60;

      return `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    let slots = [];

    // Generujemy sloty co 30 minut od start_time do end_time
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

    // Pobieramy istniejące rezerwacje dla tej usługi
    const appointments = await pool.query(
      "SELECT appointment_time, end_time FROM appointments WHERE service_id = $1",
      [serviceId]
    );

    // Oznaczamy każdy slot jako zajęty jeśli jego start mieści się w przedziale istniejącej rezerwacji
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

// Zwraca rezerwacje zalogowanego użytkownika posortowane chronologicznie
// JOIN z services żeby dołączyć nazwę usługi
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
