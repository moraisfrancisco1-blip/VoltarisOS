import { useState } from "react";

const accent = "#6366f1";
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 };

const initialAlerts = [
  { id: 1, type: "critical", icon: "🔴", title: "Battery Temp High", message: "Unit #2 Rebordelo: 38°C exceeds threshold (35°C)", time: "2 min ago", site: "Rebordelo", ack: false },
  { id: 2, type: "warning", icon: "🟡", title: "Low SoC", message: "Unit #2 Rebordelo: SoC at 18% — below 20% threshold", time: "14 min ago", site: "Rebordelo", ack: false },
  { id: 3, type: "info", icon: "🔵", title: "Demand Response Event", message: "DR event scheduled for 17:00 today — 150 kW reduction required", time: "1h ago", site: "All", ack: true },
  { id: 4, type: "warning", icon: "🟡", title: "Charger Fault", message: "CH-04 Rebordelo: Communication timeout — check connection", time: "2h ago", site: "Rebordelo", ack: false },
  { id: 5, type: "info", icon: "🔵", title: "Forecast Update", message: "Tomorrow's peak solar pushed to 14:30 due to cloud cover", time: "3h ago", site: "All", ack: true },
  { id: 6, type: "critical", icon: "🔴", title: "Grid Frequency Alert", message: "Frequency dropped to 49.72 Hz — FCR response triggered", time: "5h ago", site: "Rotterdam", ack: true },
];

const thresholds = [
  { key: "battery_temp", label: "Battery Temperature", value: 35, unit: "°C", min: 20, max: 60 },
  { key: "battery_soc_low", label: "Battery SoC Low", value: 20, unit: "%", min: 5, max: 50 },
  { key: "battery_soc_high", label: "Battery SoC High", value: 90, unit: "%", min: 50, max: 100 },
  { key: "freq_low", label: "Frequency Low", value: 49.8, unit: "Hz", min: 49, max: 50 },
  { key: "freq_high", label: "Frequency High", value: 50.2, unit: "Hz", min: 50, max: 51 },
  { key: "price_spike", label: "Price Spike Alert", value: 120, unit: "€/MWh", min: 50, max: 500 },
];

const typeStyle = {
  critical: { bg: "#7f1d1d", text: "#ef4444", border: "#ef444433" },
  warning: { bg: "#451a03", text: "#f59e0b", border: "#f59e0b33" },
  info: { bg: "#1e3a5f", text: "#60a5fa", border: "#60a5fa33" },
};

export default function AlertsNotifications() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const [filter, setFilter] = useState("all");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [webhookAlerts, setWebhookAlerts] = useState(false);
  const [thresh, setThresh] = useState(thresholds);
  const [tab, setTab] = useState("active");

  const acknowledge = id => setAlerts(a => a.map(al => al.id === id ? { ...al, ack: true } : al));
  const dismiss = id => setAlerts(a => a.filter(al => al.id !== id));

  const filtered = alerts.filter(a => {
    if (filter === "all") return true;
    return a.type === filter;
  });

  const unacked = alerts.filter(a => !a.ack).length;

  const Toggle = ({ value, onChange, label }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 13 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 11, background: value ? accent : "#374151",
        cursor: "pointer", position: "relative", transition: "background 0.2s"
      }}>
        <div style={{ position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Alerts & Notifications</h1>
          <p style={{ color: "var(--sub)" }}>Threshold config, active alerts, and notification delivery</p>
        </div>
        {unacked > 0 && (
          <div style={{ background: "#7f1d1d", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#ef4444" }}>
            {unacked} unacknowledged alert{unacked > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--surface)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid var(--border)" }}>
        {["active", "thresholds", "channels"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "transparent",
            color: tab === t ? "#fff" : "#6b7280",
            border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500,
            textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>

      {tab === "active" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["all", "critical", "warning", "info"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? "#1f2937" : "transparent",
                color: filter === f ? "#e5e7eb" : "#6b7280",
                border: "1px solid var(--border)", borderRadius: 8, padding: "6px 16px",
                cursor: "pointer", fontSize: 13, textTransform: "capitalize",
              }}>{f} {f === "all" ? `(${alerts.length})` : `(${alerts.filter(a => a.type === f).length})`}</button>
            ))}
            <button onClick={() => setAlerts(a => a.map(x => ({ ...x, ack: true })))} style={{
              marginLeft: "auto", background: "#064e3b", color: "#10b981", border: "none",
              borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13,
            }}>Acknowledge All</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: "var(--sub)", padding: 40 }}>No alerts in this category</div>
            )}
            {filtered.map(alert => {
              const ts = typeStyle[alert.type];
              return (
                <div key={alert.id} style={{
                  background: alert.ack ? "var(--surface2)" : "var(--surface)",
                  border: `1px solid ${alert.ack ? "#1f2937" : ts.border}`,
                  borderLeft: `4px solid ${ts.text}`,
                  borderRadius: 10, padding: 16,
                  opacity: alert.ack ? 0.6 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18 }}>{alert.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                          {alert.title}
                          <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 99, background: ts.bg, color: ts.text, marginLeft: 8 }}>
                            {alert.type}
                          </span>
                          {alert.ack && <span style={{ fontSize: 11, color: "var(--sub)", marginLeft: 8 }}>acknowledged</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--sub)" }}>{alert.message}</div>
                        <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>
                          Site: {alert.site} · {alert.time}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!alert.ack && (
                        <button onClick={() => acknowledge(alert.id)} style={{
                          background: "#064e3b", color: "#10b981", border: "none",
                          borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12,
                        }}>Ack</button>
                      )}
                      <button onClick={() => dismiss(alert.id)} style={{
                        background: "#1f2937", color: "var(--sub)", border: "none",
                        borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12,
                      }}>Dismiss</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "thresholds" && (
        <div style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Alert Thresholds</h2>
          <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 20 }}>Configure when alerts are triggered</p>
          {thresh.map((t, i) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range" min={t.min} max={t.max} step={t.unit === "Hz" ? 0.05 : 1}
                  value={t.value}
                  onChange={e => {
                    const v = [...thresh];
                    v[i] = { ...v[i], value: parseFloat(e.target.value) };
                    setThresh(v);
                  }}
                  style={{ width: 180, accentColor: accent }}
                />
                <span style={{ fontSize: 14, fontWeight: 600, width: 80, textAlign: "right" }}>
                  {t.value} {t.unit}
                </span>
              </div>
            </div>
          ))}
          <button style={{
            marginTop: 20, background: accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13,
          }}>Save Thresholds</button>
        </div>
      )}

      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Delivery Channels</h2>
            <Toggle value={emailAlerts} onChange={setEmailAlerts} label="Email alerts" />
            <Toggle value={smsAlerts} onChange={setSmsAlerts} label="SMS alerts" />
            <Toggle value={webhookAlerts} onChange={setWebhookAlerts} label="Webhook / Slack" />
            {emailAlerts && (
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: "var(--sub)" }}>Alert email address</label>
                <input defaultValue="admin@voltaris.com" style={{
                  display: "block", width: "100%", marginTop: 4, background: "var(--surface2)",
                  border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px",
                  color: "var(--text)", fontSize: 13, boxSizing: "border-box",
                }} />
              </div>
            )}
            {webhookAlerts && (
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: "var(--sub)" }}>Webhook URL</label>
                <input placeholder="https://hooks.slack.com/..." style={{
                  display: "block", width: "100%", marginTop: 4, background: "var(--surface2)",
                  border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px",
                  color: "var(--text)", fontSize: 13, boxSizing: "border-box",
                }} />
              </div>
            )}
          </div>
          <div style={card}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Notification Schedule</h2>
            <p style={{ fontSize: 12, color: "var(--sub)", marginBottom: 16 }}>Control when non-critical notifications are sent</p>
            {[
              { label: "Critical alerts", val: "Always (24/7)" },
              { label: "Warning alerts", val: "Business hours" },
              { label: "Info alerts", val: "Daily digest" },
              { label: "Daily report", val: "08:00 local time" },
            ].map(n => (
              <div key={n.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--sub)" }}>{n.label}</span>
                <span style={{ fontWeight: 500 }}>{n.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
