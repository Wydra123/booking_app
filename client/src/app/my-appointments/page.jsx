"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/my-appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAppointments(data));
  }, []);

  const cancelAppointment = async (id) => {
    const confirmed = window.confirm("Na pewno chcesz anulować tę rezerwację?");
    if (!confirmed) return;

    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/appointments/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      alert("Nie udało się anulować rezerwacji.");
      return;
    }

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
          <p>📅 {new Date(a.appointment_time).toLocaleDateString("pl-PL")}</p>
          <p>
            ⏱️{" "}
            {new Date(a.appointment_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <button onClick={() => cancelAppointment(a.id)}>Anuluj</button>
        </div>
      ))}
    </div>
  );
}
