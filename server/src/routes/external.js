const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");

// NBP cache — refresh max raz na godzinę
let nbpCache = { rate: null, fetchedAt: 0 };

router.get("/api/nbp/eur", async (req, res) => {
  try {
    const now = Date.now();
    if (nbpCache.rate && now - nbpCache.fetchedAt < 60 * 60 * 1000) {
      return res.json({ rate: nbpCache.rate });
    }
    const response = await fetch("https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json");
    const data = await response.json();
    const rate = data.rates[0].mid;
    nbpCache = { rate, fetchedAt: now };
    res.json({ rate });
  } catch (err) {
    console.error("NBP error:", err);
    res.status(500).json({ error: "Błąd pobierania kursu NBP" });
  }
});

// Unsplash proxy — klucz API zostaje na serwerze
router.get("/api/unsplash/search", authMiddleware, async (req, res) => {
  const { query } = req.query;
  const key = process.env.UNSPLASH_ACCESS_KEY;

  if (!query) return res.status(400).json({ error: "Brak parametru query" });
  if (!key) return res.status(500).json({ error: "Klucz UNSPLASH_ACCESS_KEY nie jest skonfigurowany" });

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&orientation=landscape&client_id=${key}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      const msg = (data.errors || []).join(", ") || `HTTP ${response.status}`;
      console.error("Unsplash API error:", response.status, data);
      return res.status(502).json({ error: `Unsplash: ${msg}` });
    }

    const photos = (data.results || []).map((p) => ({
      id: p.id,
      thumb: p.urls.small,
      full: p.urls.regular,
      alt: p.alt_description || query,
      author: p.user.name,
    }));

    res.json(photos);
  } catch (err) {
    console.error("Unsplash error:", err);
    res.status(500).json({ error: "Błąd wyszukiwania zdjęć" });
  }
});

module.exports = router;
