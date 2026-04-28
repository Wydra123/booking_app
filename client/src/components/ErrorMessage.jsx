function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#fff0f0",
      border: "1px solid #f5c6c6",
      color: "#c0392b",
      borderRadius: "6px",
      padding: "10px 14px",
      margin: "10px 0",
      fontSize: "14px",
    }}>
      {message}
    </div>
  );
}

function InfoMessage({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#f0f7ff",
      border: "1px solid #c6dcf5",
      color: "#1a5f9e",
      borderRadius: "6px",
      padding: "10px 14px",
      margin: "10px 0",
      fontSize: "14px",
    }}>
      {message}
    </div>
  );
}

export { ErrorMessage, InfoMessage };
