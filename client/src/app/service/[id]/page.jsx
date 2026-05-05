"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserFromToken } from "@/utils/auth";
import { ErrorMessage, InfoMessage } from "@/components/ErrorMessage";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/^http/, "ws");

export default function ServiceDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [service, setService] = useState(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [user, setUser] = useState(null);
  const [eurRate, setEurRate] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    setUser(getUserFromToken());
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then(setService);

    fetch(`${API_URL}/services/${id}/availability`)
      .then((res) => res.json())
      .then(setAvailability);

    fetch(`${API_URL}/api/nbp/eur`)
      .then((res) => res.json())
      .then((data) => setEurRate(data.rate))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!service || !user || user.userId !== service.user_id) return;
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/services/${id}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setBookings)
      .catch((err) => console.error(err));
  }, [service, id, user?.userId]);

  useEffect(() => {
    if (!date) return;
    fetch(`${API_URL}/available-slots/${id}?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data);
        setSlotsLoaded(true);
      });
  }, [date, id]);

  useEffect(() => {
    if (!service || !user || user.userId !== service.user_id) return;
    const token = localStorage.getItem("token");
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type !== "new_booking") return;
      if (data.appointment.service_id !== service.id) return;
      setNotifications((prev) => [data, ...prev]);
      fetch(`${API_URL}/services/${id}/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then(setBookings)
        .catch(() => {});
    };

    return () => ws.close();
  }, [service?.user_id, user?.userId, id]);

  if (!service) return <div>Ładowanie...</div>;

  const isOwner = user?.userId === service.user_id;

  const book = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setBookingError("");
    setBookingSuccess(false);

    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ service_id: service.id, appointment_time: selectedSlot }),
    });

    const data = await res.json();

    if (!res.ok) {
      setBookingError(data.error || "Nie udało się zarezerwować terminu.");
      return;
    }

    setBookingSuccess(true);

    const refresh = await fetch(`${API_URL}/available-slots/${id}?date=${date}`);
    const refreshed = await refresh.json();
    setSlots(refreshed);
    setSelectedSlot(null);
  };

  const cancelBooking = async (bookingId) => {
    if (!confirm("Czy na pewno chcesz anulować tę rezerwację?")) return;
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/provider/appointments/${bookingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
    }
  };

  const availableCount = slots.filter((s) => s.available).length;

  return (
    <div className="service-container">
      {service.image_url && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <img
            src={service.image_url.startsWith("http") ? service.image_url : `${API_URL}${service.image_url}`}
            alt={service.name}
            style={{ width: "100%", maxWidth: "400px", height: "260px", objectFit: "cover", borderRadius: "10px" }}
          />
        </div>
      )}
      <h1>{service.name}</h1>
      
      <p style={{ lineHeight: 1.5 }}>⏱ {service.duration} min</p>
      <p>
        💰 {service.price} zł
        {eurRate && <span style={{ color: "#888", fontSize: "14px"}}> ≈ {(service.price / eurRate).toFixed(2)} EUR</span>}
      </p>
      {(service.first_name || service.last_name) ? (
        <p>👤 {[service.first_name, service.last_name].filter(Boolean).join(" ")}</p>
      ) : (
        <p>👤 {service.email}</p>
      )}
      {service.phone && <p>📞 {service.phone}</p>}
      {service.description && (
        <p style={{ marginTop: "12px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{service.description}</p>
      )}

      {isOwner && (
        <div style={{ marginTop: "24px" }}>
          <h2>Rezerwacje</h2>

          {notifications.map((n, i) => (
            <div
              key={i}
              style={{
                background: "#e6f4ea",
                border: "1px solid #2a7a3b",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <p style={{ fontWeight: "bold", marginBottom: "4px", color: "#2a7a3b" }}>
                  Nowa rezerwacja!
                </p>
                <p>👤 {n.clientName}</p>
                <p>
                  📅 {n.appointment.appointment_time.split("T")[0]}&nbsp;&nbsp;
                  🕐 {n.appointment.appointment_time.split("T")[1]} – {n.appointment.end_time.split("T")[1]}
                </p>
                {n.clientPhone && <p>📞 {n.clientPhone}</p>}
              </div>
              <button
                onClick={() => setNotifications((prev) => prev.filter((_, j) => j !== i))}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#666", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}

          {bookings.length === 0 ? (
            <p>Brak rezerwacji.</p>
          ) : (
            bookings.map((b) => {
              const bDate = b.appointment_time.split("T")[0];
              const timeStart = b.appointment_time.split("T")[1];
              const timeEnd = b.end_time.split("T")[1];
              const bName = [b.first_name, b.last_name].filter(Boolean).join(" ");
              return (
                <div key={b.id} style={{ border: "1px solid #ccc", borderRadius: "8px", padding: "10px", marginBottom: "8px" }}>
                  <p>📅 {bDate} &nbsp; 🕐 {timeStart} – {timeEnd}</p>
                  <p>👤 {bName || b.email}</p>
                  {bName && <p style={{ color: "#666", fontSize: "14px" }}>{b.email}</p>}
                  {b.phone && <p>📞 {b.phone}</p>}
                  <button
                    onClick={() => cancelBooking(b.id)}
                    style={{ marginTop: "8px", background: "#e53e3e", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", cursor: "pointer" }}
                  >
                    Anuluj rezerwację
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {!isOwner && (
        <>
          {!user && <InfoMessage message="Zaloguj się, żeby zarezerwować termin." />}

          {availability.length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ marginBottom: "6px" }}>Dostępne dni:</p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["Pn", "Wt", "Śr", "Czw", "Pt", "Sb", "Nd"].map((label, i) => {
                  const day = availability.find((a) => a.day_of_week === i);
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        background: day ? "#e6f4ea" : "#f5f5f5",
                        color: day ? "#2a7a3b" : "#aaa",
                        fontSize: "14px",
                      }}
                    >
                      <div style={{ fontWeight: "bold" }}>{label}</div>
                      {day && <div style={{ fontSize: "12px" }}>{day.start_time.slice(0, 5)}–{day.end_time.slice(0, 5)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", justifyContent: "center" }}>
            <button
              onClick={() => {
                const d = new Date(date || new Date());
                d.setDate(d.getDate() - 1);
                const val = d.toISOString().split("T")[0];
                setDate(val); setSlots([]); setSlotsLoaded(false); setSelectedSlot(null);
                setBookingError(""); setBookingSuccess(false);
              }}
            >◀</button>

            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value); setSlots([]); setSlotsLoaded(false);
                setSelectedSlot(null); setBookingError(""); setBookingSuccess(false);
              }}
            />

            <button
              onClick={() => {
                const d = new Date(date || new Date());
                d.setDate(d.getDate() + 1);
                const val = d.toISOString().split("T")[0];
                setDate(val); setSlots([]); setSlotsLoaded(false); setSelectedSlot(null);
                setBookingError(""); setBookingSuccess(false);
              }}
            >▶</button>
          </div>

          {slotsLoaded && slots.length === 0 && (
            <InfoMessage message="Usługodawca nie przyjmuje w tym dniu. Wybierz inną datę." />
          )}

          {slotsLoaded && slots.length > 0 && availableCount === 0 && (
            <InfoMessage message="Wszystkie terminy w tym dniu są już zajęte. Wybierz inną datę." />
          )}

          <div className="slots-container">
            {slots.map((slot) => {
              const time = slot.time.split("T")[1];
              const isAvailable = !!slot.available;
              const isSelected = selectedSlot === slot.time;
              return (
                <button
                  key={slot.time}
                  disabled={!isAvailable}
                  onClick={() => { if (!isAvailable) return; setSelectedSlot(slot.time); }}
                  className={`slot-btn ${!isAvailable ? "slot-disabled" : ""} ${isSelected ? "slot-selected" : ""}`}
                >
                  {time}
                </button>
              );
            })}
          </div>

          {bookingError && <ErrorMessage message={bookingError} />}
          {bookingSuccess && <InfoMessage message="Rezerwacja została potwierdzona!" />}

          {user && (
            <button className="book-btn" onClick={book} disabled={!selectedSlot}>
              Zarezerwuj
            </button>
          )}
        </>
      )}
    </div>
  );
}
