"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Domyślny szablon tygodnia — używany do resetowania siatki dostępności przy edycji
const daysTemplate = [
  { day: 0, label: "Pn", enabled: false, start: "", end: "" },
  { day: 1, label: "Wt", enabled: false, start: "", end: "" },
  { day: 2, label: "Śr", enabled: false, start: "", end: "" },
  { day: 3, label: "Czw", enabled: false, start: "", end: "" },
  { day: 4, label: "Pt", enabled: false, start: "", end: "" },
  { day: 5, label: "Sb", enabled: false, start: "", end: "" },
  { day: 6, label: "Nd", enabled: false, start: "", end: "" },
];

export default function MyServicesPage() {
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null); // ID usługi z otwartym formularzem edycji (null = brak)
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAvailability, setEditAvailability] = useState(daysTemplate);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [editDescription, setEditDescription] = useState("");

  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashPhotos, setUnsplashPhotos] = useState([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashOpen, setUnsplashOpen] = useState(false);

  const router = useRouter();

  // Pobierz usługi należące do zalogowanego providera
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetch(`${API_URL}/my-services`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, [router]);

  // Odśwież listę usług z serwera po zapisaniu edycji
  const refreshServices = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/my-services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setServices(data);
  };

  // Uploaduje plik na serwer i zwraca URL do zapisu w bazie
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

  // Wybór zdjęcia z Unsplash — zapisz URL i zamknij panel
  const selectUnsplashPhoto = (photo) => {
    setEditImageUrl(photo.full);
    setEditImageFile(null); // wyczyść ewentualny plik z dysku
    setUnsplashOpen(false);
    setUnsplashPhotos([]);
    setUnsplashQuery("");
  };

  // Zwraca pełny URL zdjęcia — zewnętrzny (Unsplash) lub lokalny (/uploads/...)
  const imgSrc = (url) => url?.startsWith("http") ? url : `${API_URL}${url}`;

  // Otwiera formularz edycji i pobiera aktualną dostępność z API
  const startEdit = async (service, e) => {
    e.stopPropagation(); // zapobiega przekierowaniu na stronę usługi
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/services/${service.id}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const availData = await res.json();

    // Wypełnij szablon tygodnia danymi z bazy (tylko aktywne dni mają dane)
    const filled = daysTemplate.map((d) => {
      const existing = availData.find((a) => a.day_of_week === d.day);
      if (existing) {
        return { ...d, enabled: true, start: existing.start_time.slice(0, 5), end: existing.end_time.slice(0, 5) };
      }
      return { ...d };
    });
    setEditingId(service.id);
    setEditName(service.name);
    setEditDuration(String(service.duration));
    setEditPrice(String(service.price));
    setEditAvailability(filled);
    setEditImageFile(null);
    setEditImageUrl(service.image_url || null);
    setEditDescription(service.description || "");
    setUnsplashOpen(false);
  };

  // Zapisuje edycję usługi — jeśli wybrano nowy plik, najpierw go uploaduje
  const saveEdit = async (id, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!editName || !editDuration || !editPrice) {
      alert("Uzupełnij wszystkie pola");
      return;
    }
    let image_url = editImageUrl;
    if (editImageFile) image_url = await uploadImage(editImageFile, token);

    const res = await fetch(`${API_URL}/services/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: editName,
        duration: editDuration,
        price: editPrice,
        image_url,
        description: editDescription || null,
        // Wyślij tylko dni z zaznaczonym checkbox i uzupełnionymi godzinami
        availability: editAvailability.filter((d) => d.enabled && d.start && d.end),
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Błąd edycji");
      return;
    }
    await refreshServices();
    setEditingId(null);
    setEditImageFile(null);
    setEditImageUrl(null);
  };

  const deleteService = async (id, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    await fetch(`${API_URL}/services/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    // Usuń lokalnie bez ponownego fetch
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // Renderuje siatkę checkboxów z godzinami dla każdego dnia tygodnia
  const renderAvailabilityGrid = (avail, setAvail) => (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
      {avail.map((d, i) => (
        <div key={d.day} style={{ border: "1px solid #ccc", padding: "8px", borderRadius: "6px" }}>
          <label>
            <input
              type="checkbox"
              checked={d.enabled}
              onChange={(e) => {
                const updated = [...avail];
                updated[i] = { ...updated[i], enabled: e.target.checked };
                setAvail(updated);
              }}
            />
            {d.label}
          </label>
          {/* Godziny pojawiają się dopiero po zaznaczeniu dnia */}
          {d.enabled && (
            <div>
              <input
                type="time"
                value={d.start}
                onChange={(e) => {
                  const updated = [...avail];
                  updated[i] = { ...updated[i], start: e.target.value };
                  setAvail(updated);
                }}
              />
              <input
                type="time"
                value={d.end}
                onChange={(e) => {
                  const updated = [...avail];
                  updated[i] = { ...updated[i], end: e.target.value };
                  setAvail(updated);
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>Moje usługi</h1>
        <button
          onClick={() => router.push("/my-services/add")}
          style={{ position: "absolute", right: 0, padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
        >
          + Dodaj usługę
        </button>
      </div>

      {services.map((service) => (
        <div key={service.id}>
          {/* Kliknięcie w kartę przechodzi do szczegółów usługi */}
          <div
            onClick={() => router.push(`/service/${service.id}`)}
            style={{
              cursor: "pointer",
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: editingId === service.id ? "0" : "10px",
              // Zaokrąglenie tylko na górze gdy formularz edycji jest otwarty poniżej
              borderRadius: editingId === service.id ? "8px 8px 0 0" : "8px",
            }}
          >
            <h3>{service.name}</h3>
            <p>⏱ {service.duration} min</p>
            <p>💰 {service.price} zł</p>
            <button onClick={(e) => startEdit(service, e)} style={{ marginRight: "8px" }}>Edytuj</button>
            <button onClick={(e) => deleteService(service.id, e)}>Usuń</button>
          </div>

          {/* Formularz edycji — pojawia się pod kartą jako rozwinięcie */}
          {editingId === service.id && (
            <div
              style={{
                border: "1px solid #333",
                borderTop: "none",
                padding: "12px",
                marginBottom: "10px",
                borderRadius: "0 0 8px 8px",
                background: "#000",
                color: "#fff",
              }}
              onClick={(e) => e.stopPropagation()} // klik w formularz nie otwiera strony usługi
            >
              <h3 style={{ marginTop: 0, color: "#fff" }}>Edytuj usługę</h3>
              <input placeholder="Nazwa" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px", padding: "6px 8px", marginRight: "8px" }} />
              <input placeholder="Czas (min)" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} style={{ background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px", padding: "6px 8px", marginRight: "8px" }} />
              <input placeholder="Cena" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} style={{ background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px", padding: "6px 8px" }} />
              <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                <textarea
                  placeholder="Opis usługi (opcjonalnie)"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", maxWidth: "400px", padding: "6px", resize: "vertical", background: "#222", color: "#fff", border: "1px solid #555", borderRadius: "4px" }}
                />
              </div>
              <div style={{ margin: "10px 0" }}>
                <label style={{ display: "block", marginBottom: "4px", color: "#fff" }}>Zdjęcie usługi</label>
                {/* Podgląd aktualnego zdjęcia z bazy (tylko gdy nie wybrano nowego pliku) */}
                {editImageUrl && !editImageFile && (
                  <img
                    src={imgSrc(editImageUrl)}
                    alt="aktualne zdjęcie"
                    style={{ display: "block", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px", marginBottom: "6px" }}
                  />
                )}
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <input type="file" accept="image/*" onChange={(e) => { setEditImageFile(e.target.files[0] || null); }} style={{ color: "#fff" }} />
                  <button type="button" onClick={() => { setUnsplashOpen(true); setUnsplashQuery(editName); }} style={{ padding: "4px 10px", borderRadius: "4px", cursor: "pointer", background: "#333", color: "#fff", border: "1px solid #555" }}>
                    Szukaj na Unsplash
                  </button>
                </div>
                {/* Podgląd nowo wybranego pliku z dysku */}
                {editImageFile && (
                  <img
                    src={URL.createObjectURL(editImageFile)}
                    alt="podgląd"
                    style={{ marginTop: "8px", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px" }}
                  />
                )}
                {unsplashOpen && (
                  <div style={{ marginTop: "10px", border: "1px solid #555", borderRadius: "8px", padding: "10px", background: "#111" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                      <input
                        value={unsplashQuery}
                        onChange={(e) => setUnsplashQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
                        placeholder="np. fryzjer, masaż, siłownia..."
                        style={{ flex: 1, padding: "4px 8px", borderRadius: "4px", border: "1px solid #555", background: "#222", color: "#fff" }}
                      />
                      <button type="button" onClick={searchUnsplash} disabled={unsplashLoading} style={{ padding: "4px 12px", borderRadius: "4px", cursor: "pointer", background: "#333", color: "#fff", border: "1px solid #555" }}>
                        {unsplashLoading ? "Szukam..." : "Szukaj"}
                      </button>
                      <button type="button" onClick={() => setUnsplashOpen(false)} style={{ padding: "4px 8px", borderRadius: "4px", cursor: "pointer", background: "#333", color: "#fff", border: "1px solid #555" }}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                      {unsplashPhotos.map((p) => (
                        <img
                          key={p.id}
                          src={p.thumb}
                          alt={p.alt}
                          onClick={() => selectUnsplashPhoto(p)}
                          style={{ width: "100%", height: "150px", objectFit: "contain", background: "#333", borderRadius: "4px", cursor: "pointer" }}
                          title={`Zdjęcie: ${p.author}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <h4 style={{ color: "#fff" }}>Dostępność</h4>
              {renderAvailabilityGrid(editAvailability, setEditAvailability)}
              <div style={{ marginTop: "10px" }}>
                <button onClick={(e) => saveEdit(service.id, e)} style={{ marginRight: "8px", padding: "6px 16px", background: "#fff", color: "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>Zapisz</button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }} style={{ padding: "6px 16px", background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "4px", cursor: "pointer" }}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
