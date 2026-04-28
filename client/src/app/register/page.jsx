"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorMessage } from "@/components/ErrorMessage";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const register = async () => {
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("Wypełnij wszystkie pola.");
      return;
    }
    if (password.length < 6) {
      setError("Hasło musi mieć co najmniej 6 znaków.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne.");
      return;
    }

    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Błąd rejestracji.");
      return;
    }

    router.push("/login");
  };

  return (
    <div>
      <h1>Rejestracja</h1>
      <ErrorMessage message={error} />
      <input onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="hasło" />
      <input type="password" onChange={(e) => setConfirmPassword(e.target.value)} placeholder="powtórz hasło" />
      <button onClick={register}>Zarejestruj się</button>
    </div>
  );
}
