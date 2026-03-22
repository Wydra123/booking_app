import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function MyServices() {
  const [services, setServices] = useState([]);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");

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

  const addService = async () => {
    const token = localStorage.getItem("token");

    if (!name || !duration || !price) {
      alert("Uzupełnij wszystkie pola");
      return;
    }

    const res = await fetch(`${API_URL}/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, duration, price }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Błąd dodawania");
      return;
    }

    const refresh = await fetch(`${API_URL}/my-services`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const refreshedData = await refresh.json();
    setServices(refreshedData);

    setName("");
    setDuration("");
    setPrice("");
  };

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

        <button onClick={addService}>Dodaj</button>
      </div>

      {services.map((service) => (
        <div
          key={service.id}
          onClick={() => navigate(`/service/${service.id}`)}
          style={{ cursor: "pointer" }}
        >
          <h3>{service.name}</h3>
          <p>⏱ {service.duration} min</p>
          <p>💰 {service.price} zł</p>

          <button onClick={() => deleteService(service.id)}>
            Usuń
          </button>
        </div>
      ))}
    </div>
  );
}

export default MyServices;