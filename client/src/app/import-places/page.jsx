"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const PRICE_LABELS = { 0: "Bezpłatne", 1: "Tanie (~50 zł)", 2: "Średnie (~100 zł)", 3: "Drogie (~200 zł)", 4: "Bardzo drogie (~400 zł)" };

export default function ImportPlacesPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [durations, setDurations] = useState({});
  const [imported, setImported] = useState({});
  const [importing, setImporting] = useState({});
  const router = useRouter();

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/import/places/search?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Błąd wyszukiwania"); return; }
      setResults(data);
      if (data.length === 0) setError("Brak wyników dla podanego zapytania.");
    } catch {
      setError("Błąd połączenia z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  const importPlace = async (place_id) => {
    const token = localStorage.getItem("token");
    const duration = durations[place_id] || 60;
    setImporting((prev) => ({ ...prev, [place_id]: true }));
    try {
      const res = await fetch(`${API_URL}/import/places/${place_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ duration: Number(duration) }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Błąd importowania"); return; }
      setImported((prev) => ({ ...prev, [place_id]: true }));
    } catch {
      alert("Błąd połączenia z serwerem.");
    } finally {
      setImporting((prev) => ({ ...prev, [place_id]: false }));
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      <button onClick={() => router.push("/my-services")} style={{ marginBottom: "16px" }}>
        ← Wróć do moich usług
      </button>
      <h1>Importuj z Google Places</h1>
      <p style={{ color: "#555", marginBottom: "16px" }}>
        Wyszukaj prawdziwe miejsca i zaimportuj je jako usługi. Godziny otwarcia zostaną automatycznie wczytane jako dostępność.
      </p>

      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="np. fryzjer Warszawa, siłownia Kraków..."
          style={{ flex: 1, padding: "8px 12px", fontSize: "15px", borderRadius: "6px", border: "1px solid #ccc" }}
        />
        <button onClick={search} disabled={loading} style={{ padding: "8px 20px", borderRadius: "6px", cursor: loading ? "default" : "pointer" }}>
          {loading ? "Szukam..." : "Szukaj"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
        {results.map((place) => (
          <div key={place.place_id} style={{ border: "1px solid #ddd", borderRadius: "10px", overflow: "hidden", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
            {place.photo_reference ? (
              <img
                src={`${API_URL}/import/places/photo?ref=${encodeURIComponent(place.photo_reference)}`}
                alt={place.name}
                style={{ width: "100%", height: "160px", objectFit: "cover" }}
              />
            ) : (
              <div style={{ width: "100%", height: "160px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa" }}>
                Brak zdjęcia
              </div>
            )}
            <div style={{ padding: "12px" }}>
              <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>{place.name}</h3>
              <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#666" }}>{place.address}</p>
              {place.rating != null && <p style={{ margin: "0 0 4px", fontSize: "13px" }}>⭐ {place.rating}</p>}
              {place.price_level != null && <p style={{ margin: "0 0 8px", fontSize: "13px" }}>{PRICE_LABELS[place.price_level]}</p>}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px" }}>Czas (min):</label>
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={durations[place.place_id] ?? 60}
                  onChange={(e) => setDurations((prev) => ({ ...prev, [place.place_id]: e.target.value }))}
                  style={{ width: "64px", padding: "4px 6px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>
              {imported[place.place_id] ? (
                <p style={{ color: "green", fontWeight: "bold", margin: 0 }}>✓ Zaimportowano!</p>
              ) : (
                <button
                  onClick={() => importPlace(place.place_id)}
                  disabled={importing[place.place_id]}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", cursor: importing[place.place_id] ? "default" : "pointer" }}
                >
                  {importing[place.place_id] ? "Importuję..." : "Importuj jako usługę"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
