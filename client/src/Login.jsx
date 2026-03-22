import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const login = async () => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);

      window.dispatchEvent(new Event("authChanged"));

      navigate("/");
    } else {
      alert("Błąd logowania");
    }
  };

  return (
    <div>
      <h1>Login</h1>

      <input
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email"
      />

      <input
        type="password"
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
      />

      <button onClick={login}>Login</button>
    </div>
  );
}

export default Login;