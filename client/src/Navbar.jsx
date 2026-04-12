import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getUserFromToken } from "../utils/auth";

// Adres backendu pobierany ze zmiennej środowiskowej Vite
const API_URL = import.meta.env.VITE_API_URL;

function Navbar() {
  const navigate = useNavigate();

  // Token JWT przechowywany w localStorage — używany do sprawdzenia czy użytkownik jest zalogowany
  const [token, setToken] = useState(localStorage.getItem("token"));

  // Obiekt użytkownika zdekodowany z tokena (zawiera m.in. email i role)
  const [user, setUser] = useState(getUserFromToken());

  useEffect(() => {
    // Funkcja odświeżająca stan auth po zmianie tokena
    const updateAuth = () => {
      setToken(localStorage.getItem("token"));
      setUser(getUserFromToken());
    };

    // Nasłuchujemy na własne zdarzenie "authChanged" emitowane po login/logout/zmianie roli
    window.addEventListener("authChanged", updateAuth);

    // Cleanup — usuwamy listener przy odmontowaniu komponentu
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
      {/* Przycisk widoczny zawsze — powrót do listy wszystkich usług */}
      <button onClick={() => navigate("/")}>
        Wszystkie usługi
      </button>

      {/* Widoczny tylko dla usługodawcy (provider) — przejście do zarządzania własnymi usługami */}
      {user?.role === "provider" && (
        <button onClick={() => navigate("/my-services")}>
          Moje usługi
        </button>
      )}

      {/* Widoczny dla każdego zalogowanego użytkownika — przejście do listy rezerwacji */}
      {token && (
        <button onClick={() => navigate("/my-appointments")}>
            Moje rezerwacje
        </button>
        )}

        {/* Widoczny tylko dla klienta — wysyła żądanie do API o zmianę roli na provider,
            po odpowiedzi zapisuje nowy token i emituje zdarzenie authChanged */}
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

            // Nadpisujemy token — nowy token zawiera już rolę "provider"
            localStorage.setItem("token", data.token);

            // Informujemy resztę aplikacji o zmianie stanu autoryzacji
            window.dispatchEvent(new Event("authChanged"));
            }}
        >
            Zostań usługodawcą
        </button>
        )}

      {/* Sekcja po prawej stronie — dane zalogowanego użytkownika lub przyciski auth */}
      <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
        {token ? (
            <><span>{user?.email}</span>
            {/* Wylogowanie: usuwamy token, emitujemy authChanged, przekierowujemy na stronę główną */}
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
            {/* Niezalogowany użytkownik widzi przyciski rejestracji i logowania */}
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
