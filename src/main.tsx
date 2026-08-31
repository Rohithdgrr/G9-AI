import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: unknown) { console.error("App crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: "#1a1a1d", color: "#fca5a5", height: "100vh", overflow: "auto" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>App crashed</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "#0a0a0b", padding: 12, borderRadius: 8 }}>{String(this.state.error.stack || this.state.error.message)}</pre>
          <button onClick={() => location.reload()} style={{ marginTop: 12, padding: "8px 16px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 8 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
