require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const http = require("http");
const wsServer = require("./ws");

const app = express();

app.use(express.json());
app.use(cors());

const pool = require("./db");
require("./mailer");
const authMiddleware = require("./middleware/auth");

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

pool.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT").catch(() => {});
pool.query("ALTER TABLE services ADD COLUMN IF NOT EXISTS description TEXT").catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id integer PRIMARY KEY REFERENCES public.users(id),
    first_name text,
    last_name text,
    phone text,
    updated_at timestamp without time zone DEFAULT now()
  )
`).catch((err) => console.error("Błąd tworzenia tabeli user_profiles:", err));

app.use(require("./routes/auth"));
app.use(require("./routes/profile"));
app.use(require("./routes/services"));
app.use(require("./routes/appointments"));
app.use(require("./routes/googlePlaces"));
app.use(require("./routes/external"));

app.post("/upload", authMiddleware, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Brak pliku" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get("/", (req, res) => {
  res.send("Backend działa");
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

const server = http.createServer(app);
wsServer.init(server);
server.listen(3001, () => {
  console.log("Server running on port 3001");
});
