"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ProfilePage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Niezalogowany użytkownik nie ma tu czego szukać
    if (!token) {
      router.push("/login");
      return;
    }

    // Wypełnij formularz danymi z bazy jeśli profil już istnieje
    fetch(`${API_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setFirstName(data.first_name || "");
        setLastName(data.last_name || "");
        setPhone(data.phone || "");
      })
      .catch((err) => console.error(err));
  }, [router]);

  // Zapisuje profil — backend robi UPSERT, więc działa zarówno przy pierwszym zapisie jak i aktualizacji
  const save = async () => {
    setError("");
    setSaved(false);
    const token = localStorage.getItem("token");

    const res = await fetch(`${API_URL}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone }),
    });

    if (!res.ok) {
      setError("Błąd zapisu danych.");
      return;
    }

    setSaved(true);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Mój profil</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label>
          Imię
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Imię"
            style={{ display: "block", marginTop: "4px", padding: "12px", width: "100%", fontSize: "16px" }}
          />
        </label>

        <label>
          Nazwisko
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Nazwisko"
            style={{ display: "block", marginTop: "4px", padding: "12px", width: "100%", fontSize: "16px" }}
          />
        </label>

        <label>
          Numer telefonu
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+48 000 000 000"
            style={{ display: "block", marginTop: "4px", padding: "12px", width: "100%", fontSize: "16px" }}
          />
        </label>

        <button onClick={save} style={{ marginTop: "6px", padding: "8px" }}>
          Zapisz
        </button>

        {saved && <p style={{ color: "green" }}>Dane zostały zapisane.</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}

        <hr style={{ marginTop: "24px" }} />

        {/* Usunięcie konta jest nieodwracalne — backend kasuje wszystkie powiązane dane kaskadowo */}
        <button
          onClick={async () => {
            if (!window.confirm("Czy na pewno chcesz usunąć konto? Tej operacji nie można cofnąć.")) return;
            const token = localStorage.getItem("token");
            await fetch(`${API_URL}/account`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            localStorage.removeItem("token");
            window.dispatchEvent(new Event("authChanged"));
            router.push("/");
          }}
          style={{ padding: "8px", background: "#e53935", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Usuń konto
        </button>
      </div>
    </div>
  );
}
