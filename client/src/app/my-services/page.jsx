"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");
  const [availability, setAvailability] = useState(daysTemplate);
  const [imageFile, setImageFile] = useState(null);
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editAvailability, setEditAvailability] = useState(daysTemplate);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);
  const [editDescription, setEditDescription] = useState("");
  const router = useRouter();

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

  const refreshServices = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/my-services`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setServices(data);
  };

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
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    setName("");
    setDuration("");
    setPrice("");
    setAvailability(daysTemplate);
    setImageFile(null);
    setDescription("");
  };

  const startEdit = async (service, e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/services/${service.id}/availability`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const availData = await res.json();
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
  };

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
    setServices((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

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

      <div style={{ marginBottom: "20px" }}>
        <h2>Dodaj usługę</h2>
        <input placeholder="Nazwa" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Czas (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <input placeholder="Cena" value={price} onChange={(e) => setPrice(e.target.value)} />
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
          <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} />
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

      {services.map((service) => (
        <div key={service.id}>
          <div
            onClick={() => router.push(`/service/${service.id}`)}
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
            <button onClick={(e) => startEdit(service, e)} style={{ marginRight: "8px" }}>Edytuj</button>
            <button onClick={(e) => deleteService(service.id, e)}>Usuń</button>
          </div>

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
              <input placeholder="Nazwa" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input placeholder="Czas (min)" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} />
              <input placeholder="Cena" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
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
                <input type="file" accept="image/*" onChange={(e) => setEditImageFile(e.target.files[0] || null)} />
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
                <button onClick={(e) => saveEdit(service.id, e)} style={{ marginRight: "8px" }}>Zapisz</button>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
