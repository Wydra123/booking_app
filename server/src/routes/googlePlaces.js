const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/auth");

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

router.get("/import/places/search", authMiddleware, async (req, res) => {
  const { query, location, radius = 5000 } = req.query;

  if (!query) return res.status(400).json({ error: "Parametr 'query' jest wymagany" });
  if (!GOOGLE_API_KEY) return res.status(500).json({ error: "Klucz GOOGLE_PLACES_API_KEY nie jest skonfigurowany" });

  try {
    let url = `${PLACES_BASE}/textsearch/json?query=${encodeURIComponent(query)}&language=pl&key=${GOOGLE_API_KEY}`;
    if (location) url += `&location=${location}&radius=${radius}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return res.status(502).json({ error: data.error_message || data.status });
    }

    const places = (data.results || []).map((p) => ({
      place_id: p.place_id,
      name: p.name,
      address: p.formatted_address,
      rating: p.rating ?? null,
      price_level: p.price_level ?? null,
      photo_reference: p.photos?.[0]?.photo_reference || null,
      types: p.types,
    }));

    res.json(places);
  } catch (err) {
    console.error("Google Places search error:", err);
    res.status(500).json({ error: "Błąd wyszukiwania" });
  }
});

router.get("/import/places/photo", async (req, res) => {
  const { ref } = req.query;
  if (!ref || !GOOGLE_API_KEY) return res.status(400).end();

  try {
    const url = `${PLACES_BASE}/photo?maxwidth=800&photo_reference=${encodeURIComponent(ref)}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).end();

    res.set("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "public, max-age=86400");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Google Places photo error:", err);
    res.status(500).end();
  }
});

router.post("/import/places/:place_id", authMiddleware, async (req, res) => {
  if (req.user.role !== "provider") {
    return res.status(403).json({ error: "Tylko providerzy mogą importować usługi" });
  }

  if (!GOOGLE_API_KEY) return res.status(500).json({ error: "Klucz GOOGLE_PLACES_API_KEY nie jest skonfigurowany" });

  const { place_id } = req.params;
  const { duration = 60 } = req.body;
  const userId = req.user.userId;

  try {
    const fields = "name,formatted_address,opening_hours,price_level,photos,editorial_summary";
    const detailsUrl = `${PLACES_BASE}/details/json?place_id=${encodeURIComponent(place_id)}&fields=${fields}&language=pl&key=${GOOGLE_API_KEY}`;

    const response = await fetch(detailsUrl);
    const data = await response.json();

    if (data.status !== "OK") {
      return res.status(502).json({ error: data.error_message || data.status });
    }

    const place = data.result;

    let image_url = null;
    if (place.photos?.[0]?.photo_reference) {
      image_url = `/import/places/photo?ref=${encodeURIComponent(place.photos[0].photo_reference)}`;
    }

    const priceMap = { 0: 0, 1: 50, 2: 100, 3: 200, 4: 400 };
    const price = place.price_level != null ? priceMap[place.price_level] : 100;
    const description = place.editorial_summary?.overview || place.formatted_address || null;

    const serviceResult = await pool.query(
      "INSERT INTO services (name, duration, price, user_id, image_url, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [place.name, duration, price, userId, image_url, description]
    );

    const serviceId = serviceResult.rows[0].id;
    const periods = place.opening_hours?.periods || [];

    for (const period of periods) {
      if (!period.open || !period.close) continue;
      const day = (period.open.day + 6) % 7;
      const start = `${period.open.time.slice(0, 2)}:${period.open.time.slice(2)}`;
      const end = `${period.close.time.slice(0, 2)}:${period.close.time.slice(2)}`;
      await pool.query(
        "INSERT INTO availability (service_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)",
        [serviceId, day, start, end]
      );
    }

    res.json({ ...serviceResult.rows[0], availability_imported: periods.length });
  } catch (err) {
    console.error("Google Places import error:", err);
    res.status(500).json({ error: "Błąd importowania" });
  }
});

module.exports = router;
