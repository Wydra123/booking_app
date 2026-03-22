import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserFromToken } from "../utils/auth";

const API_URL = import.meta.env.VITE_API_URL;

function ServiceDetails() {
  const { id } = useParams();

  const [service, setService] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [takenSlots, setTakenSlots] = useState([]);

  const user = getUserFromToken();

  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then((data) => setService(data))
      .catch((err) => console.error(err));
  }, [id]);

  useEffect(() => {
    fetch(`${API_URL}/appointments/${id}`)
      .then((res) => res.json())
      .then((data) => setTakenSlots(data))
      .catch((err) => console.error(err));
  }, [id]);

  if (!service) return <div>Loading...</div>;

  const isOwner = user?.userId === service.user_id;

  // 🔥 BEZ Date i bez UTC
  const isTaken = (date, time) => {
    if (!date || !time) return false;

    const selected = `${date} ${time}`;

    return takenSlots.some((slot) =>
      slot.appointment_time.startsWith(selected)
    );
  };

    console.log(takenSlots);

  const book = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Musisz się zalogować");
      return;
    }

    if (!date || !time) {
      alert("Wybierz datę i godzinę");
      return;
    }

    if (isTaken(date, time)) {
      alert("Ten termin jest już zajęty");
      return;
    }

    const appointment_time = `${date} ${time}`; // 🔥 zmiana

    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        service_id: service.id,
        appointment_time,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Błąd rezerwacji");
      return;
    }

    alert("Zarezerwowano!");

    const refresh = await fetch(`${API_URL}/appointments/${id}`);
    const refreshedData = await refresh.json();
    setTakenSlots(refreshedData);
    
    setDate("");
    setTime("");
  };
  
  return (
    <div style={{ padding: "20px" }}>
      <h1>{service.name}</h1>

      <p>⏱ {service.duration} min</p>
      <p>💰 {service.price} zł</p>
      <p>👤 {service.email}</p>

      <div style={{ marginTop: "20px" }}>
        {isOwner && (
          <>
            <button
              onClick={async () => {
                const token = localStorage.getItem("token");

                await fetch(`${API_URL}/services/${service.id}`, {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });

                window.location.href = "/";
              }}
            >
              Usuń usługę
            </button>

            <button onClick={() => alert("edit coming soon")}>
              Edytuj
            </button>
          </>
        )}

        {!isOwner && (
          <div style={{ marginTop: "20px" }}>
            <h3>Zarezerwuj</h3>

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />

            <button onClick={book} disabled={!date || !time}>
              Zarezerwuj
            </button>

            {date && time && isTaken(date, time) && (
              <p style={{ color: "red" }}>
                ❌ Ten termin jest zajęty
              </p>
            )}

            {takenSlots.length > 0 && (
              <div style={{ marginTop: "10px" }}>
                <p>Zajęte terminy:</p>
                {takenSlots.map((slot) => (
                  <div key={slot.appointment_time}>
                    <p>{new Date(slot.appointment_time).toLocaleDateString('pl-PL')}{' '}
                      {new Date(slot.appointment_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                        })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ServiceDetails;