"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function HomePage() {
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch(`${API_URL}/services`)
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, []);

  const filtered = services.filter((s) => {
    if (!s.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (maxPrice !== "" && s.price > Number(maxPrice)) return false;
    if (maxDuration !== "" && s.duration > Number(maxDuration)) return false;
    return true;
  });

  return (
    <div style={{ padding: "20px" }}>
      <h1>Usługi</h1>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px", justifyContent: "center" }}>
        <input
          placeholder="Szukaj usługi..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: "8px", width: "220px" }}
        />
        <input
          type="number"
          placeholder="Maks. cena (zł)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          style={{ padding: "8px", width: "150px" }}
        />
        <input
          type="number"
          placeholder="Maks. czas (min)"
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          style={{ padding: "8px", width: "150px" }}
        />
      </div>

      {filtered.length === 0 && query && (
        <p>Brak wyników dla „{query}"</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", justifyContent: "center" }}>
        {filtered.map((service) => (
          <div
            key={service.id}
            onClick={() => router.push(`/service/${service.id}`)}
            style={{
              cursor: "pointer",
              border: "1px solid #ccc",
              borderRadius: "10px",
              width: "220px",
              overflow: "hidden",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                width: "220px",
                height: "160px",
                background: "#f0f0f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {service.image_url ? (
                <img
                  src={`${API_URL}${service.image_url}`}
                  alt={service.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: "48px", color: "#ccc" }}>🖼️</span>
              )}
            </div>
            <div style={{ padding: "10px" }}>
              <h3 style={{ margin: "0 0 6px" }}>{service.name}</h3>
              <p style={{ margin: "2px 0" }}>⏱ {service.duration} min</p>
              <p style={{ margin: "2px 0" }}>💰 {service.price} zł</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
