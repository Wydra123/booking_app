const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { parse } = require("url");

// userId -> Set<WebSocket>
const providerConnections = new Map();

function init(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
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

    if (!providerConnections.has(userId)) {
      providerConnections.set(userId, new Set());
    }
    providerConnections.get(userId).add(ws);

    ws.on("close", () => {
      const conns = providerConnections.get(userId);
      if (conns) {
        conns.delete(ws);
        if (conns.size === 0) providerConnections.delete(userId);
      }
    });
  });
}

function notifyProvider(userId, data) {
  const conns = providerConnections.get(userId);
  if (!conns) return;
  const msg = JSON.stringify(data);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

module.exports = { init, notifyProvider };
