import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

// Strona główna — lista wszystkich dostępnych usług z wyszukiwarką
function App() {
  const [services, setServices] = useState([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Przy pierwszym renderze pobieramy wszystkie usługi z API
  useEffect(() => {
    fetch(`${API_URL}/services`)
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, []);

  // Filtrujemy lokalnie — bez dodatkowego requestu do backendu
  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1>Usługi</h1>

      <input
        placeholder="Szukaj usługi..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: "16px", padding: "8px", width: "300px" }}
      />

      {filtered.length === 0 && query && (
        <p>Brak wyników dla „{query}"</p>
      )}

      {/* Każda usługa jest klikalnym kafelkiem prowadzącym do jej szczegółów */}
      {filtered.map((service) => (
        <div
          key={service.id}
          onClick={() => navigate(`/service/${service.id}`)}
          style={{ cursor: "pointer" }}
        >
          <h3>{service.name}</h3>
          <p>⏱ {service.duration} min</p>
          <p>💰 {service.price} zł</p>
        </div>
      ))}
    </div>
  );
}

export default App;
