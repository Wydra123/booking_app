import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

// Szablon 7 dni tygodnia (0=Pn … 6=Nd), domyślnie wszystkie wyłączone
const daysTemplate = [
  { day: 0, label: "Pn", enabled: false, start: "", end: "" },
  { day: 1, label: "Wt", enabled: false, start: "", end: "" },
  { day: 2, label: "Śr", enabled: false, start: "", end: "" },
  { day: 3, label: "Czw", enabled: false, start: "", end: "" },
  { day: 4, label: "Pt", enabled: false, start: "", end: "" },
  { day: 5, label: "Sb", enabled: false, start: "", end: "" },
  { day: 6, label: "Nd", enabled: false, start: "", end: "" },
];

// Panel usługodawcy — przeglądanie, dodawanie, edytowanie i usuwanie własnych usług
function MyServices() {
  const [services, setServices] = useState([]);

  // Pola formularza nowej usługi
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [availability, setAvailability] = useState(daysTemplate);
  const [imageFile, setImageFile] = useState(null);
  const [description, setDescription] = useState("");

  // Stan edycji — id edytowanej usługi oraz pola formularza edycji
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAvailability, setEditAvailability] = useState(daysTemplate);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [editDescription, setEditDescription] = useState("");

  const navigate = useNavigate();

  // Przy pierwszym renderze: sprawdzamy token i pobieramy usługi providera
  useEffect(() => {
    const token = localStorage.getItem("token");

    // Brak tokena — przekierowanie na login
    if (!token) {
      navigate("/login");
      return;
    }

    fetch(`${API_URL}/my-services`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, [navigate]);

  // Pobiera listę usług providera i aktualizuje stan
  const refreshServices = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/my-services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setServices(data);
  };

  // Wysyła plik na serwer i zwraca URL
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

  // Dodaje nową usługę — wysyła dane formularza + dostępność do API,
  // po sukcesie odświeża listę i resetuje formularz
  const addService = async () => {
    const token = localStorage.getItem("token");

    if (!name || !duration || !price) {
      alert("Uzupełnij wszystkie pola");
      return;
    }

    let image_url = null;
    if (imageFile) image_url = await uploadImage(imageFile, token);

    const res = await fetch(`${API_URL}/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        duration,
        price,
        image_url,
        description: description || null,
        availability: availability.filter((d) => d.enabled && d.start && d.end),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Błąd dodawania");
      return;
    }

    await refreshServices();

    // Czyszczenie formularza po dodaniu
    setName("");
    setDuration("");
    setPrice("");
    setAvailability(daysTemplate);
    setImageFile(null);
    setDescription("");
  };

  // Otwiera formularz edycji dla wybranej usługi, pobierając jej aktualną dostępność
  const startEdit = async (service, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/services/${service.id}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const availData = await res.json();

    // Nakładamy istniejące dane dostępności na szablon 7 dni
    const filled = daysTemplate.map((d) => {
      const existing = availData.find((a) => a.day_of_week === d.day);
      if (existing) {
        return {
          ...d,
          enabled: true,
          start: existing.start_time.slice(0, 5),
          end: existing.end_time.slice(0, 5),
        };
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
  };

  // Zapisuje zmiany edytowanej usługi
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: editName,
        duration: editDuration,
        price: editPrice,
        image_url,
        description: editDescription || null,
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

  // Usuwa usługę po stronie API i lokalnie aktualizuje listę
  const deleteService = async (id, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/services/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // Pomocniczy renderer siatki dostępności (współdzielony przez formularz dodawania i edycji)
  const renderAvailabilityGrid = (avail, setAvail) => (
    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
      {avail.map((d, i) => (
        <div
          key={d.day}
          style={{ border: "1px solid #ccc", padding: "8px", borderRadius: "6px" }}
        >
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
      <h1>Moje usługi</h1>

      {/* Formularz dodawania nowej usługi */}
      <div style={{ marginBottom: "20px" }}>
        <h2>Dodaj usługę</h2>

        <input
          placeholder="Nazwa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Czas (min)"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />

        <input
          placeholder="Cena"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />

        <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
          <textarea
            placeholder="Opis usługi (opcjonalnie)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: "100%", maxWidth: "400px", padding: "6px", resize: "vertical" }}
          />
        </div>

        <div style={{ margin: "10px 0" }}>
          <label style={{ display: "block", marginBottom: "4px" }}>Zdjęcie usługi</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0] || null)}
          />
          {imageFile && (
            <img
              src={URL.createObjectURL(imageFile)}
              alt="podgląd"
              style={{ marginTop: "8px", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px" }}
            />
          )}
        </div>

        <h3>Dostępność</h3>
        {renderAvailabilityGrid(availability, setAvailability)}

        <button onClick={addService}>Dodaj</button>
      </div>

      {/* Lista istniejących usług */}
      {services.map((service) => (
        <div key={service.id}>
          <div
            onClick={() => navigate(`/service/${service.id}`)}
            style={{
              cursor: "pointer",
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: editingId === service.id ? "0" : "10px",
              borderRadius: editingId === service.id ? "8px 8px 0 0" : "8px",
            }}
          >
            <h3>{service.name}</h3>
            <p>⏱ {service.duration} min</p>
            <p>💰 {service.price} zł</p>

            {/* stopPropagation zapobiega przejściu do szczegółów przy akcjach */}
            <button
              onClick={(e) => startEdit(service, e)}
              style={{ marginRight: "8px" }}
            >
              Edytuj
            </button>
            <button onClick={(e) => deleteService(service.id, e)}>Usuń</button>
          </div>

          {/* Formularz edycji — widoczny tylko dla aktualnie edytowanej usługi */}
          {editingId === service.id && (
            <div
              style={{
                border: "1px solid #ccc",
                borderTop: "none",
                padding: "12px",
                marginBottom: "10px",
                borderRadius: "0 0 8px 8px",
                background: "#e8e8e8",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ marginTop: 0 }}>Edytuj usługę</h3>

              <input
                placeholder="Nazwa"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />

              <input
                placeholder="Czas (min)"
                value={editDuration}
                onChange={(e) => setEditDuration(e.target.value)}
              />

              <input
                placeholder="Cena"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />

              <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                <textarea
                  placeholder="Opis usługi (opcjonalnie)"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", maxWidth: "400px", padding: "6px", resize: "vertical" }}
                />
              </div>

              <div style={{ margin: "10px 0" }}>
                <label style={{ display: "block", marginBottom: "4px" }}>Zdjęcie usługi</label>
                {editImageUrl && !editImageFile && (
                  <img
                    src={`${API_URL}${editImageUrl}`}
                    alt="aktualne zdjęcie"
                    style={{ display: "block", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px", marginBottom: "6px" }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditImageFile(e.target.files[0] || null)}
                />
                {editImageFile && (
                  <img
                    src={URL.createObjectURL(editImageFile)}
                    alt="podgląd"
                    style={{ marginTop: "8px", width: "120px", height: "80px", objectFit: "cover", borderRadius: "6px" }}
                  />
                )}
              </div>

              <h4>Dostępność</h4>
              {renderAvailabilityGrid(editAvailability, setEditAvailability)}

              <div style={{ marginTop: "10px" }}>
                <button
                  onClick={(e) => saveEdit(service.id, e)}
                  style={{ marginRight: "8px" }}
                >
                  Zapisz
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(null);
                  }}
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default MyServices;
