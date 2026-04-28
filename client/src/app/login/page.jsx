"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage } from "@/components/ErrorMessage";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const login = async () => {
    setError("");

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

    if (!res.ok || !data.token) {
      setError(data.error || "Nieprawidłowy email lub hasło.");
      return;
    }

    localStorage.setItem("token", data.token);
    window.dispatchEvent(new Event("authChanged"));
    router.push("/");
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
