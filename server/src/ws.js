const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { parse } = require("url");

// Mapa: userId -> Set<WebSocket> — provider może mieć kilka otwartych zakładek
const providerConnections = new Map();

//komentarz 
function init(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    // Token JWT przekazywany jako query param: /ws?token=<jwt>
    const { query } = parse(req.url, true);
    const token = query.token;

    if (!token) {
      ws.close(1008, "Missing token");
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "SECRET_KEY");
      userId = decoded.userId;
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }

    // Dodaj połączenie do zestawu dla tego providera
    if (!providerConnections.has(userId)) {
      providerConnections.set(userId, new Set());
    }
    providerConnections.get(userId).add(ws);

    // Posprzątaj po rozłączeniu — usuń mapę jeśli provider nie ma już żadnych połączeń
    ws.on("close", () => {
      const conns = providerConnections.get(userId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) providerConnections.delete(userId);
      }
    });
  });
}

// Wyślij wiadomość do wszystkich aktywnych połączeń danego providera
function notifyProvider(userId, data) {
  const conns = providerConnections.get(userId);
  if (!conns) return; // provider offline — nic nie robimy
  const msg = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(msg); // readyState 1 = OPEN
  }
}

module.exports = { init, notifyProvider };
