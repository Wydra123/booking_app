"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getUserFromToken } from "@/utils/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function Navbar() {
  const router = useRouter();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    setUser(getUserFromToken());

    const updateAuth = () => {
      setToken(localStorage.getItem("token"));
      setUser(getUserFromToken());
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

      {user?.role === "client" && (
        <button
          onClick={async () => {
            const t = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/become-provider`, {
              method: "POST",
              headers: { Authorization: `Bearer ${t}` },
            });
            const data = await res.json();
            localStorage.setItem("token", data.token);
            window.dispatchEvent(new Event("authChanged"));
          }}
        >
          Zostań usługodawcą
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
        {token ? (
          <>
            <span>{user?.email}</span>
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
