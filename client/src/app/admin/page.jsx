"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserFromToken } from "@/utils/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const TABS = ["Statystyki", "Użytkownicy", "Usługi", "Rezerwacje"];
const ROLES = ["client", "provider", "admin"];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState("Statystyki");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sprawdź rolę — jeśli nie admin, wróć na stronę główną
  useEffect(() => {
    const user = getUserFromToken();
    if (!user || user.role !== "admin") {
      router.replace("/");
    }
  }, []);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  });

  const fetchStats = async () => {
    const res = await fetch(`${API_URL}/admin/stats`, { headers: authHeaders() });
    setStats(await res.json());
  };

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/users`, { headers: authHeaders() });
    setUsers(await res.json());
    setLoading(false);
  };

  const fetchServices = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/services`, { headers: authHeaders() });
    setServices(await res.json());
    setLoading(false);
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const res = await fetch(`${API_URL}/admin/appointments`, { headers: authHeaders() });
    setAppointments(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "Statystyki") fetchStats();
    if (tab === "Użytkownicy") fetchUsers();
    if (tab === "Usługi") fetchServices();
    if (tab === "Rezerwacje") fetchAppointments();
  }, [tab]);

  const changeRole = async (id, role) => {
    const res = await fetch(`${API_URL}/admin/users/${id}/role`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    } else {
      const err = await res.json();
      alert(err.error || "Błąd zmiany roli");
    }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Usunąć użytkownika ${email}? Spowoduje to usunięcie wszystkich jego danych.`)) return;
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
    else alert("Błąd usuwania użytkownika");
  };

  const deleteService = async (id, name) => {
    if (!confirm(`Usunąć usługę "${name}"?`)) return;
    const res = await fetch(`${API_URL}/admin/services/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) setServices((prev) => prev.filter((s) => s.id !== id));
    else alert("Błąd usuwania usługi");
  };

  const deleteAppointment = async (id) => {
    if (!confirm("Usunąć tę rezerwację?")) return;
    const res = await fetch(`${API_URL}/admin/appointments/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) setAppointments((prev) => prev.filter((a) => a.id !== id));
    else alert("Błąd usuwania rezerwacji");
  };

  const fmt = (dt) =>
    new Date(dt).toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Panel admina</h1>

      {/* Zakładki */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              background: tab === t ? "#333" : "#fff",
              color: tab === t ? "#fff" : "#333",
              cursor: "pointer",
              fontWeight: tab === t ? "bold" : "normal",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* STATYSTYKI */}
      {tab === "Statystyki" && stats && (
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {[
            { label: "Użytkownicy", value: stats.users },
            { label: "Usługi", value: stats.services },
            { label: "Rezerwacje", value: stats.appointments },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                border: "1px solid #ccc",
                borderRadius: "10px",
                padding: "24px 40px",
                textAlign: "center",
                minWidth: "160px",
              }}
            >
              <div style={{ fontSize: "42px", fontWeight: "bold" }}>{value}</div>
              <div style={{ color: "#666", marginTop: "6px" }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* UŻYTKOWNICY */}
      {tab === "Użytkownicy" && (
        <>
          {loading ? (
            <p>Ładowanie...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Email</th>
                  <th style={th}>Imię i nazwisko</th>
                  <th style={th}>Telefon</th>
                  <th style={th}>Rola</th>
                  <th style={th}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={td}>{u.id}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td style={td}>{u.phone || "—"}</td>
                    <td style={td}>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: "4px" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        style={dangerBtn}
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* USŁUGI */}
      {tab === "Usługi" && (
        <>
          {loading ? (
            <p>Ładowanie...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Nazwa</th>
                  <th style={th}>Cena</th>
                  <th style={th}>Czas (min)</th>
                  <th style={th}>Właściciel</th>
                  <th style={th}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={td}>{s.id}</td>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.price} zł</td>
                    <td style={td}>{s.duration}</td>
                    <td style={td}>{s.owner_email}</td>
                    <td style={td}>
                      <button
                        onClick={() => deleteService(s.id, s.name)}
                        style={dangerBtn}
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* REZERWACJE */}
      {tab === "Rezerwacje" && (
        <>
          {loading ? (
            <p>Ładowanie...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Usługa</th>
                  <th style={th}>Klient</th>
                  <th style={th}>Termin</th>
                  <th style={th}>Koniec</th>
                  <th style={th}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={td}>{a.id}</td>
                    <td style={td}>{a.service_name}</td>
                    <td style={td}>{a.client_email}</td>
                    <td style={td}>{fmt(a.appointment_time)}</td>
                    <td style={td}>{fmt(a.end_time)}</td>
                    <td style={td}>
                      <button
                        onClick={() => deleteAppointment(a.id)}
                        style={dangerBtn}
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

const th = { padding: "10px 12px", fontWeight: "bold" };
const td = { padding: "10px 12px" };
const dangerBtn = {
  padding: "4px 12px",
  borderRadius: "4px",
  border: "1px solid #c00",
  background: "#fff",
  color: "#c00",
  cursor: "pointer",
};
