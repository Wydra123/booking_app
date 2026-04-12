import { useEffect, useState } from "react";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

// Strona z listą rezerwacji zalogowanego użytkownika
function MyAppointments() {
  const [appointments, setAppointments] = useState([]);

  // Ładujemy rezerwacje przy pierwszym renderze
  // Logika fetch jest inline — setState wywoływane tylko asynchronicznie w .then()
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/my-appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAppointments(data));
  }, []);

  // Anulowanie rezerwacji — prosi o potwierdzenie, wysyła DELETE do API,
  // a po sukcesie usuwa element z lokalnej listy bez przeładowania strony
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

    // Optymistyczna aktualizacja — usuwamy z listy bez ponownego fetcha
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
          {/* Wyświetlamy datę i godzinę oddzielnie z lokalizacją polską */}
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
