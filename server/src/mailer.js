const nodemailer = require("nodemailer");

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

module.exports = mailer;
