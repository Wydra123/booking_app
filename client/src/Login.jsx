import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ErrorMessage } from "./ErrorMessage";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Komunikat błędu wyświetlany pod formularzem
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const login = async () => {
    setError("");

    // Walidacja po stronie klienta przed wysłaniem żądania
    if (!email || !password) {
      setError("Wypełnij email i hasło.");
      return;
    }

    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    // Obsługa błędu logowania zwróconego przez backend
    if (!res.ok || !data.token) {
      setError(data.error || "Nieprawidłowy email lub hasło.");
      return;
    }

    // Zapisujemy token i informujemy resztę aplikacji o zmianie stanu auth
    localStorage.setItem("token", data.token);
    window.dispatchEvent(new Event("authChanged"));
    navigate("/");
  };

  return (
    <div>
      <h1>Logowanie</h1>
      <ErrorMessage message={error} />
      <input onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="hasło" />
      <button onClick={login}>Zaloguj się</button>
    </div>
  );
}

export default Login;
