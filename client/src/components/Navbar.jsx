"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserFromToken } from "@/utils/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Navbar() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);   // dane z JWT: { userId, role, email }
  const [profile, setProfile] = useState(null); // dane z bazy: { first_name, last_name, phone }

  // Pobierz profil z API, żeby wyświetlić imię i nazwisko zamiast emaila
  const fetchProfile = async (t) => {
    if (!t) { setProfile(null); return; }
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      setProfile(data);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    const t = localStorage.getItem("token");
    setToken(t);
    setUser(getUserFromToken());
    fetchProfile(t);

    // Nasłuchuj zdarzenia "authChanged" emitowanego przy logowaniu / wylogowaniu / zmianie roli
    // Dzięki temu Navbar odświeża się bez przeładowania strony
    const updateAuth = () => {
      const t = localStorage.getItem("token");
      setToken(t);
      setUser(getUserFromToken());
      fetchProfile(t);
    };

    window.addEventListener("authChanged", updateAuth);
    return () => window.removeEventListener("authChanged", updateAuth);
  }, []);

  return (
    <div
      style={{
        padding: "10px",
        borderBottom: "1px solid #ccc",
        marginBottom: "20px",
        display: "flex",
        gap: "10px",
      }}
    >
      <button onClick={() => router.push("/")}>Wszystkie usługi</button>

      {/* Przycisk "Moje usługi" widoczny tylko dla providerów */}
      {user?.role === "provider" && (
        <button onClick={() => router.push("/my-services")}>Moje usługi</button>
      )}

      {token && (
        <button onClick={() => router.push("/my-appointments")}>
          Moje rezerwacje
        </button>
      )}

      {token && (
        <button onClick={() => router.push("/profile")}>Mój profil</button>
      )}

      {/* Klient może jednorazowo awansować się na providera — backend wymienia token na nowy z rolą "provider" */}
      {user?.role === "client" && (
        <button
          onClick={async () => {
            const t = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/become-provider`, {
              method: "POST",
              headers: { Authorization: `Bearer ${t}` },
            });
            const data = await res.json();
            localStorage.setItem("token", data.token); // zapisz nowy token z zaktualizowaną rolą
            window.dispatchEvent(new Event("authChanged")); // poinformuj Navbar i inne komponenty
          }}
        >
          Zostań usługodawcą
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
        {token ? (
          <>
            {/* Wyświetl imię i nazwisko jeśli uzupełnione, w przeciwnym razie email */}
            <span>
              {(profile?.first_name || profile?.last_name)
                ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
                : user?.email}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("token");
                window.dispatchEvent(new Event("authChanged"));
                router.push("/");
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <button onClick={() => router.push("/register")}>Register</button>
            <button onClick={() => router.push("/login")}>Login</button>
          </>
        )}
      </div>
    </div>
  );
}

export default Navbar;
