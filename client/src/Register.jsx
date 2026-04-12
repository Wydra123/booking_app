import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorMessage } from "./ErrorMessage";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Komunikat błędu wyświetlany pod formularzem
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const register = async () => {
    setError("");

    // Walidacja po stronie klienta przed wysłaniem żądania
    if (!email || !password) {
      setError("Wypełnij wszystkie pola.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    // Obsługa błędu rejestracji zwróconego przez backend (np. email już zajęty)
    if (!res.ok) {
      setError(data.error || "Błąd rejestracji.");
      return;
    }

    // Po udanej rejestracji przekierowujemy na stronę logowania
    navigate("/login");
  };

  return (
    <div>
      <h1>Rejestracja</h1>
      <ErrorMessage message={error} />
      <input onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="hasło" />
      <button onClick={register}>Zarejestruj się</button>
    </div>
  );
}

export default Register;
