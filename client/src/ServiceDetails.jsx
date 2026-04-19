import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserFromToken } from "../utils/auth";
import { ErrorMessage, InfoMessage } from "./ErrorMessage";
import "./ServiceDetails.css";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

// Strona szczegółów usługi z wyborem terminu i rezerwacją
function ServiceDetails() {
  // id usługi z URL (np. /service/3)
  const { id } = useParams();
  const navigate = useNavigate();

  const [service, setService] = useState(null);
  // Wybrana data w formacie YYYY-MM-DD
  const [date, setDate] = useState("");
  // Lista slotów godzinowych zwrócona przez API dla wybranej daty
  const [slots, setSlots] = useState([]);
  // Wybrany slot (pełny timestamp)
  const [selectedSlot, setSelectedSlot] = useState(null);
  // Flaga informująca, że API odpowiedziało na zapytanie o sloty
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState([]);

  // Dane zalogowanego użytkownika (lub null jeśli niezalogowany)
  const user = getUserFromToken();

  // Pobieramy dane usługi i dostępność przy pierwszym renderze lub zmianie id
  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then(setService);

    fetch(`${API_URL}/services/${id}/availability`)
      .then((res) => res.json())
      .then(setAvailability);
  }, [id]);

  // Pobieramy rezerwacje usługi — tylko gdy zalogowany użytkownik jest jej właścicielem
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

  // Gdy użytkownik zmieni datę — pobieramy dostępne sloty dla tej daty
  // Reset stanu (slots, slotsLoaded, selectedSlot) odbywa się w onChange daty,
  // dzięki czemu useEffect wywołuje setState tylko asynchronicznie w .then()
  useEffect(() => {
    if (!date) return;
    fetch(`${API_URL}/available-slots/${id}?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data);
        setSlotsLoaded(true);
      });
  }, [date, id]);

  // Czekamy na załadowanie danych usługi
  if (!service) return <div>Ładowanie...</div>;

  // Właściciel usługi nie może jej sam zarezerwować — ukrywamy formularz rezerwacji
  const isOwner = user?.userId === service.user_id;

  // Rezerwuje wybrany slot — wymaga zalogowania i wybranego slotu
  const book = async () => {
    if (!user) {
      navigate("/login");
      return;
    }

    setBookingError("");
    setBookingSuccess(false);

    const token = localStorage.getItem("token");

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
      setBookingError(data.error || "Nie udało się zarezerwować terminu.");
      return;
    }

    setBookingSuccess(true);

    // Po rezerwacji odświeżamy sloty — zarezerwowany termin zmieni status na zajęty
    const refresh = await fetch(`${API_URL}/available-slots/${id}?date=${date}`);
    const refreshed = await refresh.json();
    setSlots(refreshed);
    setSelectedSlot(null);
  };

  // Liczba dostępnych (wolnych) slotów w wybranym dniu
  const availableCount = slots.filter((s) => s.available).length;

  return (
    <div className="service-container">
      <h1>{service.name}</h1>
      <p>⏱ {service.duration} min</p>
      <p>💰 {service.price} zł</p>
      {(service.first_name || service.last_name) ? (
        <p>👤 {[service.first_name, service.last_name].filter(Boolean).join(" ")}</p>
      ) : (
        <p>👤 {service.email}</p>
      )}
      {service.phone && <p>📞 {service.phone}</p>}

      {/* Lista rezerwacji — widoczna tylko dla właściciela usługi */}
      {isOwner && (
        <div style={{ marginTop: "24px" }}>
          <h2>Rezerwacje</h2>
          {bookings.length === 0 ? (
            <p>Brak rezerwacji.</p>
          ) : (
            bookings.map((b) => {
              const date = b.appointment_time.split("T")[0];
              const timeStart = b.appointment_time.split("T")[1];
              const timeEnd = b.end_time.split("T")[1];
              const name = [b.first_name, b.last_name].filter(Boolean).join(" ");
              return (
                <div
                  key={b.id}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "10px",
                    marginBottom: "8px",
                  }}
                >
                  <p>📅 {date} &nbsp; 🕐 {timeStart} – {timeEnd}</p>
                  <p>👤 {name || b.email}</p>
                  {name && <p style={{ color: "#666", fontSize: "14px" }}>{b.email}</p>}
                  {b.phone && <p>📞 {b.phone}</p>}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Formularz rezerwacji — ukryty dla właściciela usługi */}
      {!isOwner && (
        <>
          {/* Informacja dla niezalogowanych */}
          {!user && (
            <InfoMessage message="Zaloguj się, żeby zarezerwować termin." />
          )}

          {/* Dostępne dni tygodnia usługodawcy */}
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
                      {day && (
                        <div style={{ fontSize: "12px" }}>
                          {day.start_time.slice(0, 5)}–{day.end_time.slice(0, 5)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Wybór daty — zmiana trigguje fetch slotów; tutaj resetujemy też stan slotów
              żeby uniknąć synchronicznych setState wewnątrz useEffect */}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlots([]);
              setSlotsLoaded(false);
              setSelectedSlot(null);
              setBookingError("");
              setBookingSuccess(false);
            }}
          />

          {/* Brak dostępności w tym dniu — provider nie pracuje */}
          {slotsLoaded && slots.length === 0 && (
            <InfoMessage message="Usługodawca nie przyjmuje w tym dniu. Wybierz inną datę." />
          )}

          {/* Są sloty, ale wszystkie zajęte */}
          {slotsLoaded && slots.length > 0 && availableCount === 0 && (
            <InfoMessage message="Wszystkie terminy w tym dniu są już zajęte. Wybierz inną datę." />
          )}

          {/* Siatka przycisków z dostępnymi godzinami */}
          <div className="slots-container">
            {slots.map((slot) => {
              // Wycinamy tylko część godzinową z timestampa
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

          {bookingError && <ErrorMessage message={bookingError} />}

          {bookingSuccess && (
            <InfoMessage message="Rezerwacja została potwierdzona!" />
          )}

          {/* Przycisk "Zarezerwuj" aktywny tylko gdy wybrano slot */}
          {user && (
            <button
              className="book-btn"
              onClick={book}
              disabled={!selectedSlot}
            >
              Zarezerwuj
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default ServiceDetails;
