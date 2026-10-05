import { useEffect, useState } from "react";
import { C, glassCard } from "../ChartTheme";

export const API = import.meta.env.VITE_API_URL || "";

// "5 min ago" for an API timestamp (the backend sends naive UTC without a "Z").
export const ago = (iso) => {
  if (!iso) return "never";
  const t = new Date(iso + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? "" : "Z")).getTime();
  const s = Math.max((Date.now() - t) / 1000, 0);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

// GET several JSON endpoints in parallel. Re-runs when the list of paths changes.
export function useApi(paths) {
  const key = paths.join("|");
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ data: null, error: null });
    Promise.all(paths.map(p =>
      fetch(`${API}${p}`, { signal: ctrl.signal }).then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    ))
      .then(data => setState({ data, error: null }))
      .catch(e => { if (e.name !== "AbortError") setState({ data: null, error: e.message || "Failed to load" }); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

// Page frame shared by the real-data views: title, subtitle, content.
export function RealPage({ title, subtitle, children }) {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: -0.8 }}>{title}</h1>
        <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 3 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

export function LoadingCard() {
  return <div style={{ ...glassCard(C.indigo), color: "var(--sub)", fontSize: 13 }}>Loading…</div>;
}

export function ErrorCard({ error }) {
  return (
    <div style={{ ...glassCard(C.red), color: "var(--sub)", fontSize: 13 }}>
      Could not load the data ({error}). Try again in a moment.
    </div>
  );
}

// Empty state with an optional action button (onClick navigates to another page).
export function EmptyCard({ title, text, actionLabel, onAction }) {
  return (
    <div style={{ ...glassCard(C.amber), display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{title}</div>
      <div style={{ color: "var(--sub)", fontSize: 13, lineHeight: 1.6 }}>{text}</div>
      {actionLabel && onAction && (
        <div>
          <button onClick={onAction} style={{
            marginTop: 6, background: C.accent, color: "#0b1020", border: "none", borderRadius: 8,
            padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>{actionLabel}</button>
        </div>
      )}
    </div>
  );
}

export const sevColor = (sev) => {
  const s = (sev || "").toLowerCase();
  return s === "critical" || s === "error" ? C.red : s === "warning" ? C.amber : s === "ok" ? C.green : C.blue;
};

export const Chip = ({ color, children }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
    background: `${color}22`, color, border: `1px solid ${color}44`,
  }}>{children}</span>
);
