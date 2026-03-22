import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  const [services, setServices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_URL}/services`)
      .then((res) => res.json())
      .then((data) => setServices(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Usługi</h1>

      {services.map((service) => (
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