import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

function MyAppointments() {
  const [appointments, setAppointments] = useState([]);

  const fetchAppointments = async () => {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/my-appointments`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    setAppointments(data);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const cancelAppointment = async (id) => {
    const token = localStorage.getItem("token");

    await fetch(`${API_URL}/appointments/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setAppointments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Moje rezerwacje</h1>

      {appointments.length === 0 && <p>Brak rezerwacji</p>}

      {appointments.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "8px",
          }}
        >
          <h3>{a.name}</h3>
          <p>📅 {new Date(a.appointment_time).toLocaleDateString('pl-PL')}</p>
          <p>⏱️ {new Date(a.appointment_time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
            })}</p>


          <button onClick={() => cancelAppointment(a.id)}>
            Anuluj
          </button>
        </div>
      ))}
    </div>
  );
}

export default MyAppointments;