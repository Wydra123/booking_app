import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserFromToken } from "../utils/auth";
import "./ServiceDetails.css";

const API_URL = import.meta.env.VITE_API_URL;

function ServiceDetails() {
  const { id } = useParams();

  const [service, setService] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const user = getUserFromToken();

  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then(setService);
  }, [id]);

  useEffect(() => {
    if (!date) return;

    fetch(`${API_URL}/available-slots/${id}?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("SLOTS:", data);
        setSlots(data);
      });
  }, [date, id]);

  if (!service) return <div>Loading...</div>;

  const isOwner = user?.userId === service.user_id;

  const book = async () => {
    const token = localStorage.getItem("token");

    if (!selectedSlot) {
      alert("Wybierz godzinę");
      return;
    }

    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        service_id: service.id,
        appointment_time: selectedSlot,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Zarezerwowano!");

    const refresh = await fetch(
      `${API_URL}/available-slots/${id}?date=${date}`
    );
    const refreshed = await refresh.json();
    setSlots(refreshed);

    setSelectedSlot(null);
  };

  return (
    <div className="service-container">
      <h1>{service.name}</h1>

      <p>⏱ {service.duration} min</p>
      <p>💰 {service.price} zł</p>
      <p>👤 {service.email}</p>

      {!isOwner && (
        <>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelectedSlot(null);
            }}
          />

          <div className="slots-container">
            {slots.map((slot) => {
              const time = slot.time.split("T")[1];

              const isAvailable = !!slot.available;
              const isSelected = selectedSlot === slot.time;

              return (
                <button
                  key={slot.time}
                  disabled={!isAvailable}
                  onClick={() => {
                    if (!isAvailable) return;
                    setSelectedSlot(slot.time);
                  }}
                  className={`slot-btn 
                    ${!isAvailable ? "slot-disabled" : ""}
                    ${isSelected ? "slot-selected" : ""}
                  `}
                >
                  {time}
                </button>
              );
            })}
          </div>

          <button
            className="book-btn"
            onClick={book}
            disabled={!selectedSlot}
          >
            Zarezerwuj
          </button>
        </>
      )}
    </div>
  );
}

export default ServiceDetails;