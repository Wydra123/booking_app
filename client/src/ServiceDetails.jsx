import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserFromToken } from "../utils/auth";

const API_URL = import.meta.env.VITE_API_URL;

function ServiceDetails() {
  const { id } = useParams();
  const [service, setService] = useState(null);

  const user = getUserFromToken();

  useEffect(() => {
    fetch(`${API_URL}/services/${id}`)
      .then((res) => res.json())
      .then((data) => setService(data))
      .catch((err) => console.error(err));
  }, [id]);

  if (!service) return <div>Loading...</div>;

  // 🔥 DOPIERO TU
  const isOwner = user && service.user_id === user.userId;

  return (
    <div style={{ padding: "20px" }}>
      {/* 🔥 DANE USŁUGI */}
      <h1>{service.name}</h1>

      <p>⏱ {service.duration} min</p>
      <p>💰 {service.price} zł</p>
      <p>👤 {service.email}</p>

      {/* 🔥 AKCJE */}
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
          <button>Zarezerwuj (soon)</button>
        )}
      </div>
    </div>
  );
}

export default ServiceDetails;