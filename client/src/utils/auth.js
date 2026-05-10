// Odczytuje dane zalogowanego użytkownika z tokenu JWT przechowywanego w localStorage
// JWT ma format: header.payload.signature — środkowa część to zakodowany base64 obiekt JSON
export const getUserFromToken = () => {
  if (typeof window === "undefined") return null; // ochrona przed SSR (Next.js może renderować na serwerze)
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1])); // dekoduj payload: { userId, role, email }
  } catch {
    return null; // token uszkodzony lub nieprawidłowy
  }
};
