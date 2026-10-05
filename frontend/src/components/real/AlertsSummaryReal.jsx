import { C, glassCard, KpiCard } from "../ChartTheme";
import { ago, useApi, RealPage, LoadingCard, ErrorCard, EmptyCard, Chip, sevColor } from "./realShared";

const th = { padding: "8px 12px", borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--sub)",
  fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 };
const td = { padding: "10px 12px", color: "var(--text)" };

// Anomaly view with the tenant's REAL alerts (GET /api/alerts). There is no machine-learning
// anomaly model behind this page yet: what is shown are the rule-based alerts raised for the
// tenant's devices (offline, thresholds), and the page says so. Acknowledging happens on the
// Alerts page. Shown when Simulation mode is off; the demo page stays as is.
export default function AlertsSummaryReal({ onNavigate }) {
  const { data, error } = useApi(["/api/alerts?limit=100"]);
  const title = "Anomaly Detection";
  const subtitle = "Alerts raised for your devices";

  if (error) return <RealPage title={title} subtitle={subtitle}><ErrorCard error={error} /></RealPage>;
  if (!data) return <RealPage title={title} subtitle={subtitle}><LoadingCard /></RealPage>;

  const alerts = data[0];
  const open = alerts.filter(a => !a.acknowledged);
  const bySev = (names) => open.filter(a => names.includes((a.severity || "").toLowerCase())).length;

  if (alerts.length === 0) {
    return (
      <RealPage title={title} subtitle={subtitle}>
        <EmptyCard title="No alerts" text="Nothing unusual has been detected on your devices. Alerts appear here when a device goes offline or crosses a threshold you set."
          actionLabel={onNavigate ? "Alert rules" : null} onAction={onNavigate ? () => onNavigate("alerts") : null} />
      </RealPage>
    );
  }

  return (
    <RealPage title={title} subtitle={subtitle}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <KpiCard label="Open alerts" value={open.length} color={open.length ? C.amber : C.green} icon="🔔" sub="Not acknowledged" />
        <KpiCard label="Critical" value={bySev(["critical", "error"])} color={C.red} icon="🚨" sub="Open" />
        <KpiCard label="Warnings" value={bySev(["warning"])} color={C.amber} icon="⚠️" sub="Open" />
        <KpiCard label="Info" value={bySev(["info"])} color={C.blue} icon="ℹ️" sub="Open" />
      </div>

      <div style={glassCard(C.amber)}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>
          Latest alerts
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["Severity", "Alert", "Device", "When", "Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {alerts.slice(0, 25).map(a => (
                <tr key={a.id}>
                  <td style={td}><Chip color={sevColor(a.severity)}>{a.severity}</Chip></td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    {a.message && <div style={{ color: "var(--sub)", fontSize: 12 }}>{a.message}</div>}
                  </td>
                  <td style={{ ...td, color: "var(--sub)" }}>{a.device_name || "—"}</td>
                  <td style={{ ...td, color: "var(--sub)" }}>{ago(a.fired_at)}</td>
                  <td style={{ ...td, color: a.acknowledged ? "var(--sub)" : C.amber }}>
                    {a.acknowledged ? `Acknowledged${a.acknowledged_by ? ` by ${a.acknowledged_by}` : ""}` : "Open"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {onNavigate && (
          <button onClick={() => onNavigate("alerts")} style={{
            marginTop: 14, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Acknowledge and manage alerts</button>
        )}
      </div>

      <div style={{ color: "var(--sub)", fontSize: 11, lineHeight: 1.6 }}>
        These are rule-based alerts (device offline, threshold crossed), not the output of a machine-learning
        anomaly model. Statistical anomaly detection will appear here once enough history is available.
      </div>
    </RealPage>
  );
}
