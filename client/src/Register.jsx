import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const register = async () => {
    if (!email || !password) {
      alert("Uzupełnij dane");
      return;
    }

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Błąd rejestracji");
      return;
    }

    alert("Zarejestrowano!");
    navigate("/login");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Rejestracja</h1>

      <input
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Hasło"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={register} style={{ marginTop: "10px" }}>
        Zarejestruj
      </button>
    </div>
  );
}

export default Register;