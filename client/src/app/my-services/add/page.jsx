"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Domyślny szablon tygodnia — wszystkie dni wyłączone, godziny puste
const daysTemplate = [
  { day: 0, label: "Pn", enabled: false, start: "", end: "" },
  { day: 1, label: "Wt", enabled: false, start: "", end: "" },
  { day: 2, label: "Śr", enabled: false, start: "", end: "" },
  { day: 3, label: "Czw", enabled: false, start: "", end: "" },
  { day: 4, label: "Pt", enabled: false, start: "", end: "" },
  { day: 5, label: "Sb", enabled: false, start: "", end: "" },
  { day: 6, label: "Nd", enabled: false, start: "", end: "" },
];

export default function AddServicePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [availability, setAvailability] = useState(daysTemplate);
  const [imageFile, setImageFile] = useState(null);   // plik wybrany z dysku
  const [imageUrl, setImageUrl] = useState(null);     // URL z Unsplash

  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashPhotos, setUnsplashPhotos] = useState([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);

  // Uploaduje zdjęcie na serwer i zwraca ścieżkę do zapisania w bazie
  const uploadImage = async (file, token) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`${API_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    return data.url || null;
  };

  // Wyszukuje zdjęcia na Unsplash przez backend (klucz API jest po stronie serwera)
  const searchUnsplash = async () => {
    if (!unsplashQuery.trim()) return;
    setUnsplashLoading(true);
    setUnsplashPhotos([]);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/unsplash/search?query=${encodeURIComponent(unsplashQuery)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setUnsplashPhotos(data);
      else alert(data.error || "Błąd wyszukiwania Unsplash");
    } catch {
      alert("Błąd połączenia z serwerem");
    } finally {
      setUnsplashLoading(false);
    }
  };

  // Ustaw wybraną fotkę jako URL i zamknij panel Unsplash
  const selectUnsplashPhoto = (photo) => {
    setImageUrl(photo.full);
    setImageFile(null); // wyczyść plik z dysku jeśli był wybrany
    setUnsplashOpen(false);
    setUnsplashPhotos([]);
    setUnsplashQuery("");
  };

  const addService = async () => {
    const token = localStorage.getItem("token");
    if (!name || !duration || !price) {
      alert("Uzupełnij wszystkie pola");
      return;
    }

    // Jeśli użytkownik wybrał plik z dysku, najpierw go uploaduj i pobierz URL
    let image_url = imageUrl;
    if (imageFile) image_url = await uploadImage(imageFile, token);

    const res = await fetch(`${API_URL}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        duration,
        price,
        image_url,
        description: description || null,
        // Wyślij tylko dni z zaznaczonym checkbox i uzupełnionymi godzinami
        availability: availability.filter((d) => d.enabled && d.start && d.end),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Błąd dodawania");
      return;
    }
    router.push("/my-services");
  };

  // Siatka checkboxów z godzinami dla każdego dnia tygodnia
  const renderAvailabilityGrid = () => (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
      {availability.map((d, i) => (
        <div key={d.day} style={{ border: "1px solid #ccc", padding: "8px", borderRadius: "6px" }}>
          <label>
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => {
                const updated = [...availability];
                updated[i] = { ...updated[i], enabled: e.target.checked };
                setAvailability(updated);
              }}
            />
            {d.label}
          </label>
          {/* Pola godzin pojawiają się dopiero po zaznaczeniu dnia */}
          {d.enabled && (
            <div>
              <input
                type="time"
                value={d.start}
                onChange={(e) => {
                  const updated = [...availability];
                  updated[i] = { ...updated[i], start: e.target.value };
                  setAvailability(updated);
                }}
              />
              <input
                type="time"
                value={d.end}
                onChange={(e) => {
                  const updated = [...availability];
                  updated[i] = { ...updated[i], end: e.target.value };
                  setAvailability(updated);
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => router.push("/my-services")}
          style={{ padding: "6px 14px", borderRadius: "6px", cursor: "pointer" }}
        >
          ← Wróć
        </button>
        <h1 style={{ margin: 0 }}>Dodaj usługę</h1>
      </div>

      {/* Alternatywna ścieżka — importuj dane z Google Places zamiast wpisywać ręcznie */}
      <div style={{ marginBottom: "16px" }}>
        <button
          onClick={() => router.push("/import-places")}
          style={{ padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}
        >
          Importuj z Google Places
        </button>
      </div>

      <input
        placeholder="Nazwa"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "8px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <input
        placeholder="Czas (min)"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "8px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <input
        placeholder="Cena"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        style={{ display: "block", width: "100%", marginBottom: "8px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
      />
      <textarea
        placeholder="Opis usługi (opcjonalnie)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ display: "block", width: "100%", marginBottom: "12px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", resize: "vertical", boxSizing: "border-box" }}
      />

      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>Zdjęcie usługi</label>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => { setImageFile(e.target.files[0] || null); setImageUrl(null); }}
          />
          <button
            type="button"
            onClick={() => { setUnsplashOpen(true); setUnsplashQuery(name); }}
            style={{ padding: "4px 10px", borderRadius: "4px", cursor: "pointer" }}
          >
            Szukaj na Unsplash
          </button>
        </div>

        {/* Podgląd wybranego zdjęcia — z pliku lub z Unsplash */}
        {(imageFile || imageUrl) && (
          <img
            src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
            alt="podgląd"
            style={{ marginTop: "8px", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px" }}
          />
        )}

        {unsplashOpen && (
          <div style={{ marginTop: "10px", border: "1px solid #ccc", borderRadius: "8px", padding: "10px" }}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                value={unsplashQuery}
                onChange={(e) => setUnsplashQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
                placeholder="np. fryzjer, masaż, siłownia..."
                style={{ flex: 1, padding: "4px 8px", borderRadius: "4px", border: "1px solid #ccc" }}
              />
              <button type="button" onClick={searchUnsplash} disabled={unsplashLoading} style={{ padding: "4px 12px", borderRadius: "4px", cursor: "pointer" }}>
                {unsplashLoading ? "Szukam..." : "Szukaj"}
              </button>
              <button type="button" onClick={() => setUnsplashOpen(false)} style={{ padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
              {unsplashPhotos.map((p) => (
                <img
                  key={p.id}
                  src={p.thumb}
                  alt={p.alt}
                  onClick={() => selectUnsplashPhoto(p)}
                  style={{ width: "100%", height: "150px", objectFit: "contain", background: "#f0f0f0", borderRadius: "4px", cursor: "pointer" }}
                  title={`Zdjęcie: ${p.author}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <h3>Dostępność</h3>
      {renderAvailabilityGrid()}

      <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
        <button
          onClick={addService}
          style={{ padding: "10px 24px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
        >
          Dodaj usługę
        </button>
        <button
          onClick={() => router.push("/my-services")}
          style={{ padding: "10px 24px", borderRadius: "6px", cursor: "pointer" }}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
