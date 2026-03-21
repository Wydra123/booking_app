const API_URL = import.meta.env.VITE_API_URL;
const token = localStorage.getItem("token");
import { useEffect, useState } from "react";


function App() {
  const [services, setServices] = useState([]);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/services`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, []);

  const addService = async () => {
    if (!name || !duration || !price) {
      alert("Uzupełnij wszystkie pola");
      return;
    }
    await fetch(`${API_URL}/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        duration,
        price,
      }),
    });

    setName("");
    setDuration("");
    setPrice("");

    const res = await fetch(`${API_URL}/services`)
    const data = await res.json();
    setServices(data);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Usługi</h1>

      {/* 🔥 FORMULARZ */}
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

      {/* 🔥 LISTA */}
      {services.map((service) => (
        <div
          key={service.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "8px",
          }}
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