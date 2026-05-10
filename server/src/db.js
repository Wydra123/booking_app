const { Pool } = require("pg");

// Pula połączeń do PostgreSQL — używana w całym backendzie przez pool.query()
// Dane połączenia pobierane ze zmiennych środowiskowych (plik .env)
const pool = new Pool({
  host: "db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 5432,
});

module.exports = pool;
