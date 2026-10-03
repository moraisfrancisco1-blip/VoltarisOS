import { useState, useEffect, useCallback } from "react";

// Lists the account's logins (GET /api/sessions) and lets the user end one or all
// the others. Ending the CURRENT one signs this browser out, so it is labelled.
const fmt = (iso) => (iso ? new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString() : "—");

export default function ActiveSessions({ accent, onSignedOut }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error();
      setSessions(await res.json());
      setError("");
    } catch {
      setError("Could not load active sessions.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const end = async (s) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (s.current) onSignedOut?.(); else await load();
    } catch {
      setError("Could not end that session.");
    } finally {
      setBusy(false);
    }
  };

  const endOthers = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/sessions/revoke-others", { method: "POST" });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("Could not sign out the other sessions.");
    } finally {
      setBusy(false);
    }
  };

  const others = (sessions || []).filter((s) => !s.current).length;
  const btn = { fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
    border: "1px solid var(--border, #333)", background: "transparent", color: "var(--text)" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Active sessions</h2>
        <button style={{ ...btn, opacity: others && !busy ? 1 : 0.5 }} disabled={!others || busy} onClick={endOthers}>
          Sign out all other sessions
        </button>
      </div>
      <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 12 }}>
        Where your account is signed in. End any session you don't recognise.
      </p>
      {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>{error}</div>}
      {sessions === null && !error && <div style={{ fontSize: 12, color: "var(--sub)" }}>Loading…</div>}
      {(sessions || []).map((s) => (
        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0",
          borderTop: "1px solid var(--border, #2a2a2a)", fontSize: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.user_agent || "Unknown device"}
              {s.current && <span style={{ marginLeft: 8, color: accent }}>● this session</span>}
            </div>
            <div style={{ color: "var(--sub)" }}>
              {s.ip_address || "unknown IP"} · signed in {fmt(s.created_at)} · last active {fmt(s.last_seen_at)}
            </div>
          </div>
          <button style={btn} disabled={busy} onClick={() => end(s)}>{s.current ? "Sign out" : "End"}</button>
        </div>
      ))}
    </div>
  );
}
