// Dekoduje payload tokena JWT z localStorage i zwraca go jako obiekt
// Zwraca null jeśli token nie istnieje lub jest nieprawidłowy
// Uwaga: to tylko dekodowanie (base64), NIE weryfikacja podpisu —
// walidacja odbywa się po stronie serwera przy każdym chronionym żądaniu
export const getUserFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    // JWT składa się z trzech części oddzielonych kropką: header.payload.signature
    // Indeks [1] to payload zakodowany w base64
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    // Token uszkodzony lub nieprawidłowy format
    return null;
  }
};
