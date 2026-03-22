import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserFromToken } from "../utils/auth";

const API_URL = import.meta.env.VITE_API_URL;

function Navbar() {
  const navigate = useNavigate();

  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(getUserFromToken());

  // 🔥 nasłuchiwanie zmian auth
  useEffect(() => {
    const updateAuth = () => {
      setToken(localStorage.getItem("token"));
      setUser(getUserFromToken());
    };

    window.addEventListener("authChanged", updateAuth);

    return () => {
      window.removeEventListener("authChanged", updateAuth);
    };
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
      {/* 🔥 NAV */}
      <button onClick={() => navigate("/")}>
        Wszystkie usługi
      </button>

      {user?.role === "provider" && (
        <button onClick={() => navigate("/my-services")}>
          Moje usługi
        </button>
      )}

      {/* 🔥 ZOSTAŃ PROVIDEREM */}
        {user?.role === "client" && (
        <button
            onClick={async () => {
            const token = localStorage.getItem("token");

            const res = await fetch(`${API_URL}/become-provider`, {
                method: "POST",
                headers: {
                Authorization: `Bearer ${token}`,
                },
            });

            const data = await res.json();

            // 🔥 NOWY TOKEN
            localStorage.setItem("token", data.token);

            // 🔥 POWIADOM REACT
            window.dispatchEvent(new Event("authChanged"));
            }}
        >
            Zostań usługodawcą
        </button>
        )}
        
      {/* 🔥 RIGHT */}
      <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
        {token ? (
            // <><span>{user?.email?.split("@")[0]}</span>
            <><span>{user?.email}</span>
            <button
                onClick={() => {
                    localStorage.removeItem("token");

                    window.dispatchEvent(new Event("authChanged"));

                    navigate("/");
                } }
            >
                Logout
            </button></>
        ) : (
          <>
            <button onClick={() => navigate("/register")}>
              Register
            </button>
            <button onClick={() => navigate("/login")}>
              Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default Navbar;