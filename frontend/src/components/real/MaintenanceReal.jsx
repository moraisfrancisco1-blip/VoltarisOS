import { useEffect, useState } from "react";
import { C, glassCard, KpiCard } from "../ChartTheme";

const API = import.meta.env.VITE_API_URL || "";

const sevColor = (sev) => (sev === "ok" ? C.green : sev === "warning" ? C.amber : sev === "info" ? C.blue : C.red);
const healthColor = (h) => (h >= 80 ? C.green : h >= 50 ? C.amber : C.red);

const ago = (iso) => {
  if (!iso) return "never";
  const s = Math.max((Date.now() - new Date(iso + (iso.endsWith("Z") ? "" : "Z")).getTime()) / 1000, 0);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const th = { padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--sub)",
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 };
const td = { padding: "10px 12px", color: "var(--text)" };

// Maintenance with the tenant's REAL devices and alerts (GET /api/maintenance/assets and
// /schedule). The health score is a documented rule-based heuristic over status, last-seen
// and unacknowledged alerts -- not a predictive model -- and the page says so.
// Shown when Simulation mode is off; the demo page stays as is.
export default function MaintenanceReal() {
  const [assets, setAssets] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const get = (path) => fetch(`${API}${path}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    Promise.all([get("/api/maintenance/assets"), get("/api/maintenance/schedule")])
      .then(([a, s]) => { setAssets(a.assets || []); setSchedule(s.schedule || []); })
      .catch(e => { if (e.name !== "AbortError") setError(e.message || "Failed to load"); });
    return () => ctrl.abort();
  }, []);

  const wrap = { padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 };
  const header = (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "var(--text)", letterSpacing: -0.8 }}>Maintenance</h1>
      <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 3 }}>
        Health of your connected devices and open maintenance work
      </div>
    </div>
  );

  if (error) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.red), color: "var(--sub)", fontSize: 13 }}>
          Could not load maintenance data ({error}). Try again in a moment.
        </div>
      </div>
    );
  }
  if (!assets || !schedule) {
    return (
      <div style={wrap}>
        {header}
        <div style={{ ...glassCard(C.indigo), color: "var(--sub)", fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  const avgHealth = assets.length ? Math.round(assets.reduce((a, x) => a + (x.health || 0), 0) / assets.length) : null;
  const needAttention = assets.filter(x => x.severity && x.severity !== "ok").length;
  const openAlerts = assets.reduce((a, x) => a + (x.active_alerts || 0), 0);

  return (
    <div style={wrap}>
      {header}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Devices" value={assets.length} color={C.blue} icon="🔌" sub="Monitored" />
        <KpiCard label="Average health" value={avgHealth == null ? "—" : `${avgHealth}`} color={avgHealth == null ? C.indigo : healthColor(avgHealth)}
          icon="💚" sub="Out of 100" />
        <KpiCard label="Need attention" value={needAttention} color={needAttention ? C.amber : C.green} icon="🛠️"
          sub="Health below 80" />
        <KpiCard label="Open alerts" value={openAlerts} color={openAlerts ? C.red : C.green} icon="🔔" sub="Not acknowledged" />
      </div>

      <div style={glassCard(C.green)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          Devices
        </div>
        {assets.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>No devices yet. Connect one under Integrations and it will show up here.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>{["Device", "Site", "Type", "Status", "Health", "Alerts", "Last seen"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{a.name}</td>
                    <td style={{ ...td, color: "var(--sub)" }}>{a.site || "—"}</td>
                    <td style={{ ...td, color: "var(--sub)" }}>{a.type || "—"}</td>
                    <td style={td}>{a.status || "unknown"}{a.enabled === false ? " (disabled)" : ""}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 70, height: 6, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(Math.max(a.health || 0, 0), 100)}%`, height: "100%", background: healthColor(a.health || 0) }} />
                        </div>
                        <span style={{ fontWeight: 800, color: healthColor(a.health || 0) }}>{a.health}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: a.active_alerts ? C.red : "var(--sub)" }}>{a.active_alerts || 0}</td>
                    <td style={{ ...td, color: "var(--sub)" }}>{ago(a.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={glassCard(C.amber)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          Maintenance schedule
        </div>
        {schedule.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>Nothing to do. No open alerts and no offline devices.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>{["Device", "Site", "Type", "Severity", "Due", "Days left"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {schedule.map(s => (
                  <tr key={s.id}>
                    <td style={{ ...td, fontWeight: 600 }}>{s.asset_name || "—"}</td>
                    <td style={{ ...td, color: "var(--sub)" }}>{s.site || "—"}</td>
                    <td style={{ ...td, color: "var(--sub)" }}>{s.type}</td>
                    <td style={{ ...td, fontWeight: 700, color: sevColor((s.severity || "").toLowerCase()) }}>{s.severity}</td>
                    <td style={td}>{s.due_date}</td>
                    <td style={td}>{s.days_remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        Health is a rule-based score (device status, how recently it reported, and unacknowledged alerts), not a
        predictive model. Failure probability and degradation are not shown because there is not yet enough history
        (irradiance, expected-vs-actual production) to compute them reliably.
      </div>
    </div>
  );
}
