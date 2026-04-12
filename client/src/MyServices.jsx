import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

// Panel usługodawcy — przeglądanie, dodawanie i usuwanie własnych usług
function MyServices() {
  const [services, setServices] = useState([]);

  // Pola formularza nowej usługi
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");

  // Szablon dostępności — 7 dni tygodnia (0=Pn … 6=Nd), domyślnie wszystkie wyłączone
  const daysTemplate = [
    { day: 0, label: "Pn", enabled: false, start: "", end: "" },
    { day: 1, label: "Wt", enabled: false, start: "", end: "" },
    { day: 2, label: "Śr", enabled: false, start: "", end: "" },
    { day: 3, label: "Czw", enabled: false, start: "", end: "" },
    { day: 4, label: "Pt", enabled: false, start: "", end: "" },
    { day: 5, label: "Sb", enabled: false, start: "", end: "" },
    { day: 6, label: "Nd", enabled: false, start: "", end: "" },
  ];

  // Stan dostępności — kopia szablonu modyfikowana przez checkboxy i inputy czasu
  const [availability, setAvailability] = useState(daysTemplate);

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

  // Dodaje nową usługę — wysyła dane formularza + dostępność do API,
  // po sukcesie odświeża listę i resetuje formularz
  const addService = async () => {
    const token = localStorage.getItem("token");

    if (!name || !duration || !price) {
      alert("Uzupełnij wszystkie pola");
      return;
    }

    // Wysyłamy tylko dni, które mają zaznaczony checkbox i uzupełnione godziny
    const filteredAvailability = availability.filter(
      (d) => d.enabled && d.start && d.end
    );

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
        availability: filteredAvailability,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Błąd dodawania");
      return;
    }

    // Pobieramy świeżą listę z backendu zamiast dopisywać lokalnie
    const refresh = await fetch(`${API_URL}/my-services`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const refreshedData = await refresh.json();
    setServices(refreshedData);

    // Czyszczenie formularza po dodaniu
    setName("");
    setDuration("");
    setPrice("");
    setAvailability(daysTemplate);
  };

  // Usuwa usługę po stronie API i lokalnie aktualizuje listę
  const deleteService = async (id) => {
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/services/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setServices((prev) => prev.filter((s) => s.id !== id));
  };

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

        <h3>Dostępność</h3>

        {/* Siatka dni tygodnia — checkbox włącza widoczność pól godzinowych */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {availability.map((d, i) => (
            <div
              key={d.day}
              style={{
                border: "1px solid #ccc",
                padding: "8px",
                borderRadius: "6px",
              }}
            >
              <label>
                <input
                  type="checkbox"
                  checked={d.enabled}
                  onChange={(e) => {
                    const updated = [...availability];
                    updated[i].enabled = e.target.checked;
                    setAvailability(updated);
                  }}
                />
                {d.label}
              </label>

              {/* Pola godzin start/end pojawiają się tylko gdy dzień jest włączony */}
              {d.enabled && (
                <div>
                  <input
                    type="time"
                    value={d.start}
                    onChange={(e) => {
                      const updated = [...availability];
                      updated[i].start = e.target.value;
                      setAvailability(updated);
                    }}
                  />

                  <input
                    type="time"
                    value={d.end}
                    onChange={(e) => {
                      const updated = [...availability];
                      updated[i].end = e.target.value;
                      setAvailability(updated);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addService}>Dodaj</button>
      </div>

      {/* Lista istniejących usług — klik na kafelek prowadzi do szczegółów */}
      {services.map((service) => (
        <div
          key={service.id}
          onClick={() => navigate(`/service/${service.id}`)}
          style={{
            cursor: "pointer",
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "8px",
          }}
        >
          <h3>{service.name}</h3>
          <p>⏱ {service.duration} min</p>
          <p>💰 {service.price} zł</p>

          {/* stopPropagation zapobiega przejściu do szczegółów przy kliknięciu "Usuń" */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteService(service.id);
            }}
          >
            Usuń
          </button>
        </div>
      ))}
    </div>
  );
}

export default MyServices;
