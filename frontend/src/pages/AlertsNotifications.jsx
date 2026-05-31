import { useState } from "react";
import { C, glassCard } from "../components/ChartTheme";

const accent = C.indigo;

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
  critical: { color: C.red, bg: `${C.red}18`, border: `${C.red}44`, glow: `0 0 12px ${C.red}33` },
  warning:  { color: C.amber, bg: `${C.amber}15`, border: `${C.amber}44`, glow: `0 0 12px ${C.amber}33` },
  info:     { color: C.blue, bg: `${C.blue}15`, border: `${C.blue}44`, glow: "none" },
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

  const filtered = alerts.filter(a => filter === "all" || a.type === filter);
  const unacked = alerts.filter(a => !a.ack).length;

  const Toggle = ({ value, onChange, label }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 13, color: "#e2e8f0" }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 40, height: 22, borderRadius: 11,
        background: value ? accent : "rgba(255,255,255,0.1)",
        boxShadow: value ? `0 0 10px ${accent}66` : "none",
        cursor: "pointer", position: "relative", transition: "background 0.2s, box-shadow 0.2s"
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 20 : 2, width: 18, height: 18,
          borderRadius: "50%", background: "#fff", transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.4)"
        }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32, color: "#f1f5f9", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, color: "#f1f5f9" }}>Alerts & Notifications</h1>
          <p style={{ color: "rgba(148,163,184,0.7)", margin: 0 }}>Threshold config, active alerts, and notification delivery</p>
        </div>
        {unacked > 0 && (
          <div style={{
            background: `${C.red}15`, border: `1px solid ${C.red}55`,
            borderRadius: 10, padding: "10px 18px", fontSize: 13, color: C.red,
            boxShadow: `0 0 16px ${C.red}22`, fontWeight: 600,
          }}>
            ⚠ {unacked} unacknowledged alert{unacked > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 24,
        background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 4,
        width: "fit-content", border: "1px solid rgba(255,255,255,0.08)"
      }}>
        {["active", "thresholds", "channels"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "transparent",
            color: tab === t ? "#fff" : "rgba(148,163,184,0.6)",
            border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 500,
            textTransform: "capitalize",
            boxShadow: tab === t ? `0 0 12px ${accent}55` : "none",
            transition: "all 0.15s",
          }}>{t}</button>
        ))}
      </div>

      {tab === "active" && (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["all", "critical", "warning", "info"].map(f => {
              const ts = typeStyle[f] || {};
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: active ? (ts.bg || "rgba(255,255,255,0.1)") : "rgba(255,255,255,0.04)",
                  color: active ? (ts.color || "#f1f5f9") : "rgba(148,163,184,0.6)",
                  border: `1px solid ${active ? (ts.border || "rgba(255,255,255,0.2)") : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 13,
                  textTransform: "capitalize",
                  boxShadow: active && ts.glow ? ts.glow : "none",
                }}>
                  {f} {f === "all" ? `(${alerts.length})` : `(${alerts.filter(a => a.type === f).length})`}
                </button>
              );
            })}
            <button onClick={() => setAlerts(a => a.map(x => ({ ...x, ack: true })))} style={{
              marginLeft: "auto", background: `${C.green}18`, color: C.green,
              border: `1px solid ${C.green}44`, borderRadius: 8, padding: "6px 16px",
              cursor: "pointer", fontSize: 13, boxShadow: `0 0 10px ${C.green}22`,
            }}>Acknowledge All</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.length === 0 && (
              <div style={{ ...glassCard(C.indigo), textAlign: "center", color: "rgba(148,163,184,0.5)", padding: 40 }}>
                No alerts in this category
              </div>
            )}
            {filtered.map(alert => {
              const ts = typeStyle[alert.type];
              return (
                <div key={alert.id} style={{
                  background: alert.ack ? "rgba(255,255,255,0.025)" : "rgba(15,18,32,0.92)",
                  border: `1px solid ${alert.ack ? "rgba(255,255,255,0.06)" : ts.border}`,
                  borderLeft: `3px solid ${alert.ack ? "rgba(255,255,255,0.15)" : ts.color}`,
                  borderRadius: 10, padding: 16,
                  opacity: alert.ack ? 0.55 : 1,
                  boxShadow: alert.ack ? "none" : ts.glow,
                  backdropFilter: "blur(8px)",
                  transition: "opacity 0.3s",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18 }}>{alert.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "#f1f5f9" }}>
                          {alert.title}
                          <span style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 99,
                            background: ts.bg, color: ts.color,
                            border: `1px solid ${ts.border}`,
                            marginLeft: 8, textTransform: "uppercase", letterSpacing: 0.5,
                          }}>
                            {alert.type}
                          </span>
                          {alert.ack && <span style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", marginLeft: 8 }}>acknowledged</span>}
                        </div>
                        <div style={{ fontSize: 13, color: "rgba(148,163,184,0.7)" }}>{alert.message}</div>
                        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.45)", marginTop: 4 }}>
                          Site: {alert.site} · {alert.time}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!alert.ack && (
                        <button onClick={() => acknowledge(alert.id)} style={{
                          background: `${C.green}18`, color: C.green,
                          border: `1px solid ${C.green}44`, borderRadius: 6, padding: "5px 12px",
                          cursor: "pointer", fontSize: 12, boxShadow: `0 0 8px ${C.green}22`,
                        }}>Ack</button>
                      )}
                      <button onClick={() => dismiss(alert.id)} style={{
                        background: "rgba(255,255,255,0.05)", color: "rgba(148,163,184,0.6)",
                        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
                        padding: "5px 12px", cursor: "pointer", fontSize: 12,
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
        <div style={glassCard(C.indigo)}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: "#f1f5f9" }}>Alert Thresholds</h2>
          <p style={{ color: "rgba(148,163,184,0.6)", fontSize: 12, marginBottom: 20 }}>Configure when alerts are triggered</p>
          {thresh.map((t, i) => (
            <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0" }}>{t.label}</div>
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
                <span style={{ fontSize: 14, fontWeight: 700, width: 90, textAlign: "right", color: C.indigo,
                  textShadow: `0 0 8px ${C.indigo}88` }}>
                  {t.value} {t.unit}
                </span>
              </div>
            </div>
          ))}
          <button style={{
            marginTop: 20, background: accent, color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 24px", cursor: "pointer", fontSize: 13,
            boxShadow: `0 0 16px ${accent}55`, fontWeight: 600,
          }}>Save Thresholds</button>
        </div>
      )}

      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div style={glassCard(C.indigo)}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#f1f5f9" }}>Delivery Channels</h2>
            <Toggle value={emailAlerts} onChange={setEmailAlerts} label="Email alerts" />
            <Toggle value={smsAlerts} onChange={setSmsAlerts} label="SMS alerts" />
            <Toggle value={webhookAlerts} onChange={setWebhookAlerts} label="Webhook / Slack" />
            {emailAlerts && (
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Alert email address</label>
                <input defaultValue="admin@voltaris.com" style={{
                  display: "block", width: "100%", marginTop: 4,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px",
                  color: "#e2e8f0", fontSize: 13, boxSizing: "border-box",
                }} />
              </div>
            )}
            {webhookAlerts && (
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Webhook URL</label>
                <input placeholder="https://hooks.slack.com/..." style={{
                  display: "block", width: "100%", marginTop: 4,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px",
                  color: "#e2e8f0", fontSize: 13, boxSizing: "border-box",
                }} />
              </div>
            )}
          </div>
          <div style={glassCard(C.blue)}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: "#f1f5f9" }}>Notification Schedule</h2>
            <p style={{ fontSize: 12, color: "rgba(148,163,184,0.6)", marginBottom: 16 }}>Control when non-critical notifications are sent</p>
            {[
              { label: "Critical alerts", val: "Always (24/7)", color: C.red },
              { label: "Warning alerts", val: "Business hours", color: C.amber },
              { label: "Info alerts", val: "Daily digest", color: C.blue },
              { label: "Daily report", val: "08:00 local time", color: C.green },
            ].map(n => (
              <div key={n.label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13,
              }}>
                <span style={{ color: "rgba(148,163,184,0.6)" }}>{n.label}</span>
                <span style={{ fontWeight: 600, color: n.color, textShadow: `0 0 8px ${n.color}55` }}>{n.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
