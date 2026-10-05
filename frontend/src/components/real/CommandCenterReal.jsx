import { C, glassCard, KpiCard } from "../ChartTheme";
import { ago, useApi, RealPage, LoadingCard, ErrorCard, EmptyCard, Chip, sevColor } from "./realShared";

const linkBtn = {
  background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

// Operations overview with the tenant's REAL numbers: live power (GET /api/dashboard/snapshot),
// device status (GET /api/devices), open alerts (GET /api/alerts) and sites (GET /api/sites).
// Shown when Simulation mode is off; the demo page stays as is.
export default function CommandCenterReal({ onNavigate }) {
  const { data, error } = useApi([
    "/api/dashboard/snapshot", "/api/devices", "/api/alerts?unacked_only=true&limit=50", "/api/sites",
  ]);
  const title = "Command Center";
  const subtitle = "Live status of your sites, devices and open alerts";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const [snap, devices, alerts, sites] = data;
  const online = devices.filter(d => d.status === "online").length;
  const offline = devices.filter(d => d.status === "offline" || d.status === "error").length;
  const critical = alerts.filter(a => ["critical", "error"].includes((a.severity || "").toLowerCase())).length;

  if (sites.length === 0 && devices.length === 0) {
    return (
      <RealPage title={title} subtitle={subtitle}>
        <EmptyCard title="Nothing to show yet" text="Add a site and connect a device, and its live status appears here."
          actionLabel={onNavigate ? "Go to Sites" : null} onAction={onNavigate ? () => onNavigate("sites") : null} />
      </RealPage>
    );
  }

  return (
    <RealPage title={title} subtitle={subtitle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Sites" value={sites.length} color={C.blue} icon="📍" sub="Configured" />
        <KpiCard label="Devices online" value={`${online} / ${devices.length}`} color={offline ? C.amber : C.green} icon="🔌"
          sub={offline ? `${offline} offline` : "All reporting"} />
        <KpiCard label="Live power" value={`${Number(snap.total_power_kw || 0).toFixed(2)} kW`} color={C.green} icon="⚡"
          sub={`Solar ${Number(snap.solar_kw || 0).toFixed(2)} kW`} />
        <KpiCard label="Open alerts" value={alerts.length} color={critical ? C.red : alerts.length ? C.amber : C.green} icon="🔔"
          sub={critical ? `${critical} critical` : "Not acknowledged"} />
      </div>

      <div style={glassCard(C.amber)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>
          Open alerts
        </div>
        {alerts.length === 0 ? (
          <div style={{ color: "var(--sub)", fontSize: 13 }}>No open alerts.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alerts.slice(0, 6).map(a => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <Chip color={sevColor(a.severity)}>{a.severity}</Chip>
                <span style={{ color: "var(--text)", fontWeight: 600 }}>{a.title}</span>
                <span style={{ color: "var(--sub)" }}>{a.device_name || ""}</span>
                <span style={{ color: "var(--sub)", marginLeft: "auto" }}>{ago(a.fired_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {onNavigate && <button style={linkBtn} onClick={() => onNavigate("dashboard")}>Open Dashboard</button>}
        {onNavigate && <button style={linkBtn} onClick={() => onNavigate("alerts")}>Manage alerts</button>}
        {onNavigate && <button style={linkBtn} onClick={() => onNavigate("fleet")}>Fleet</button>}
      </div>
    </RealPage>
  );
}
