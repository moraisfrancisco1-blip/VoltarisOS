import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, Legend
} from "recharts";

const accent = "#6366f1";
const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";
const blue = "#60a5fa";
const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec); }

const ASSETS = [
  { id: "INV-001", type: "Inverter", site: "Rotterdam North", model: "SMA Sunny Tripower 25000", age: 3.2, health: 94, rul: 8.4, lastPM: "2025-01-15", nextPM: "2025-07-15", alerts: 0, runtime: 28000, efficiency: 97.8, status: "Good", parts: ["IGBT Module", "Capacitors", "Fans"] },
  { id: "INV-002", type: "Inverter", site: "Rebordelo I", model: "Fronius Symo 24.0", age: 5.1, health: 78, rul: 3.1, lastPM: "2024-11-20", nextPM: "2025-05-20", alerts: 2, runtime: 44600, efficiency: 96.1, status: "Warning", parts: ["Cooling Fan", "DC Fuse"] },
  { id: "BESS-001", type: "BESS Module", site: "Rotterdam North", model: "BYD Battery-Box Premium", age: 2.8, health: 97, rul: 9.2, lastPM: "2025-02-01", nextPM: "2025-08-01", alerts: 0, runtime: 24500, efficiency: 94.2, status: "Good", parts: ["BMS Firmware"] },
  { id: "BESS-002", type: "BESS Module", site: "Madrid Grid", model: "Tesla Megapack 2", age: 1.2, health: 99, rul: 11.8, lastPM: "2025-03-10", nextPM: "2025-09-10", alerts: 0, runtime: 10500, efficiency: 95.8, status: "Good", parts: [] },
  { id: "BESS-004", type: "BESS Module", site: "Lisbon Park", model: "CATL EnerC 500", age: 4.9, health: 82, rul: 2.8, lastPM: "2024-09-01", nextPM: "2025-03-01", alerts: 3, runtime: 42900, efficiency: 88.4, status: "Critical", parts: ["Cell Replacement", "Cooling System", "BMS Update"] },
  { id: "TRF-001", type: "Transformer", site: "Rotterdam North", model: "ABB 1MVA Dry Type", age: 7.5, health: 71, rul: 2.2, lastPM: "2024-06-10", nextPM: "2024-12-10", alerts: 4, runtime: 65700, efficiency: 98.9, status: "Critical", parts: ["Winding Insulation", "Oil Analysis", "Tap Changer"] },
  { id: "PNL-001", type: "Solar Panel Array", site: "Rebordelo I", model: "Longi HiMO 6 — 96 panels", age: 4.0, health: 88, rul: 16.0, lastPM: "2025-01-05", nextPM: "2025-07-05", alerts: 1, runtime: 35000, efficiency: 21.3, status: "Warning", parts: ["Cleaning", "Connection Check"] },
  { id: "MTR-001", type: "Smart Meter", site: "Hamburg Port", model: "Landis+Gyr E650", age: 2.1, health: 96, rul: 12.9, lastPM: "2025-02-15", nextPM: "2025-08-15", alerts: 0, runtime: 18400, efficiency: 99.8, status: "Good", parts: [] },
];

const STATUS_COLOR = { Good: green, Warning: amber, Critical: red };
const STATUS_BG = { Good: "#064e3b", Warning: "#451a03", Critical: "#7f1d1d" };

const WORK_ORDERS = [
  { id: "WO-2847", asset: "TRF-001", title: "Transformer insulation test & oil analysis", priority: "Critical", assigned: "João Silva", due: "2025-06-02", status: "In Progress", cost: 4200 },
  { id: "WO-2848", asset: "BESS-004", title: "Cell module replacement — strings 2 & 4", priority: "High", assigned: "Ana Costa", due: "2025-06-05", status: "Scheduled", cost: 12800 },
  { id: "WO-2849", asset: "INV-002", title: "Cooling fan replacement + firmware update", priority: "High", assigned: "Miguel Santos", due: "2025-06-10", status: "Scheduled", cost: 850 },
  { id: "WO-2850", asset: "PNL-001", title: "Panel cleaning & EL imaging inspection", priority: "Medium", assigned: "Unassigned", due: "2025-06-20", status: "Open", cost: 3200 },
  { id: "WO-2846", asset: "INV-001", title: "Routine 6-month preventive maintenance", priority: "Low", assigned: "Pedro Lima", due: "2025-07-15", status: "Scheduled", cost: 600 },
];

const ANOMALY_FEED = [
  { time: "14:23", asset: "TRF-001", type: "Thermal", msg: "Winding temp 78°C — 8°C above baseline", sev: "Critical" },
  { time: "11:45", asset: "BESS-004", type: "Cell Voltage", msg: "String 2 cell delta-V = 42mV (limit: 20mV)", sev: "High" },
  { time: "09:12", asset: "INV-002", type: "Vibration", msg: "Fan bearing vibration +35% above normal", sev: "Medium" },
  { time: "08:30", asset: "PNL-001", type: "Performance", msg: "Array PR dropped to 0.76 (expected 0.83)", sev: "Low" },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "rgba(148,163,184,0.85)", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PredictiveMaintenance() {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("Assets");
  const [filter, setFilter] = useState("All");
  const [ticker, setTicker] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTicker(t => t + 1), 4000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === "All" ? ASSETS : ASSETS.filter(a => a.status === filter);
  const asset = ASSETS[selected];

  const critical = ASSETS.filter(a => a.status === "Critical").length;
  const warning = ASSETS.filter(a => a.status === "Warning").length;
  const avgHealth = (ASSETS.reduce((a, b) => a + b.health, 0) / ASSETS.length).toFixed(1);
  const maintenanceCost = WORK_ORDERS.reduce((a, b) => a + b.cost, 0);
  const overdueCount = WORK_ORDERS.filter(w => w.status === "Open").length;

  // Sensor trend for selected asset
  const sensorData = Array.from({ length: 30 }, (_, i) => ({
    day: `D-${29 - i}`,
    temp: asset.type === "Transformer" ? rand(65, 80) : rand(22, 42),
    vibration: rand(0.1, asset.status === "Critical" ? 3.2 : 1.0, 2),
    efficiency: +(asset.efficiency + Math.sin(i / 5) * 1.5 + rand(-0.5, 0.5)).toFixed(1),
    rul: Math.max(0, asset.rul - (29 - i) * 0.02),
  }));

  const costData = [
    { month: "Jan", planned: 2400, unplanned: 800, avoided: 5200 },
    { month: "Feb", planned: 1800, unplanned: 0, avoided: 3100 },
    { month: "Mar", planned: 3200, unplanned: 1400, avoided: 7800 },
    { month: "Apr", planned: 2100, unplanned: 600, avoided: 4500 },
    { month: "May", planned: 4800, unplanned: 2200, avoided: 9200 },
    { month: "Jun", planned: 1200, unplanned: 0, avoided: 2800 },
  ];

  const PRIORITY_COLOR = { Critical: red, High: amber, Medium: blue, Low: green };

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--surface)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Predictive Maintenance</h1>
          <p style={{ color: "rgba(148,163,184,0.85)", fontSize: 14 }}>AI-driven asset health monitoring, RUL prediction & automated work order management</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: red, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            🚨 {critical} Critical
          </button>
          <button style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
            + Work Order
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Fleet Health", v: `${avgHealth}%`, c: avgHealth > 90 ? green : amber },
          { l: "Critical Assets", v: critical, c: red },
          { l: "Warning Assets", v: warning, c: amber },
          { l: "Open Work Orders", v: overdueCount, c: amber },
          { l: "Maintenance Budget", v: `€${(maintenanceCost / 1000).toFixed(1)}k`, c: blue },
          { l: "Avoided Failures", v: "€32.6k", c: green },
        ].map(k => (
          <div key={k.l} style={{ ...card, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["Assets", "Work Orders", "Cost Analysis", "Anomaly Feed"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "var(--surface)", color: tab === t ? "#fff" : "rgba(148,163,184,0.85)",
            border: `1px solid ${tab === t ? accent : "var(--surface2)"}`, borderRadius: 8,
            padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: tab === t ? 600 : 400
          }}>{t}</button>
        ))}
      </div>

      {tab === "Assets" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
          {/* Asset list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Critical", "Warning", "Good"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? accent : "var(--surface2)", color: filter === f ? "#fff" : "rgba(148,163,184,0.85)",
                  border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer"
                }}>{f}</button>
              ))}
            </div>
            {filtered.map((a, i) => {
              const idx = ASSETS.indexOf(a);
              return (
                <div key={a.id} onClick={() => setSelected(idx)} style={{
                  ...card, padding: 14, cursor: "pointer",
                  border: `1px solid ${selected === idx ? accent : "var(--surface2)"}`,
                  borderLeft: `3px solid ${STATUS_COLOR[a.status]}`,
                  background: selected === idx ? "var(--surface2)" : "var(--surface)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{a.id}</div>
                      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{a.type} · {a.site}</div>
                    </div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: STATUS_BG[a.status], color: STATUS_COLOR[a.status], fontWeight: 600, alignSelf: "flex-start" }}>{a.status}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                    {[
                      { l: "Health", v: `${a.health}%`, c: STATUS_COLOR[a.status] },
                      { l: "RUL", v: `${a.rul}y`, c: a.rul < 3 ? red : a.rul < 5 ? amber : green },
                      { l: "Alerts", v: a.alerts, c: a.alerts > 0 ? red : green },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: "center", background: "var(--surface2)", borderRadius: 6, padding: "6px 4px" }}>
                        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.85)" }}>{m.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                  {a.parts.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {a.parts.map(p => (
                        <span key={p} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, background: "#451a03", color: amber }}>{p}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{asset.id} — {asset.model}</div>
                  <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 13, marginTop: 2 }}>{asset.type} · {asset.site} · Age: {asset.age}y · {asset.runtime.toLocaleString()} h runtime</div>
                </div>
                <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 99, background: STATUS_BG[asset.status], color: STATUS_COLOR[asset.status], fontWeight: 700 }}>{asset.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                {[
                  { l: "Health (SoH)", v: `${asset.health}%`, c: STATUS_COLOR[asset.status] },
                  { l: "Remaining Life", v: `${asset.rul} years`, c: asset.rul < 3 ? red : amber },
                  { l: "Efficiency", v: `${asset.efficiency}%`, c: green },
                  { l: "Active Alerts", v: asset.alerts, c: asset.alerts > 0 ? red : green },
                  { l: "Next PM", v: asset.nextPM, c: "#f1f5f9" },
                ].map(m => (
                  <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>30-Day Sensor Trend</div>
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} interval={6} />
                    <YAxis yAxisId="temp" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
                    <YAxis yAxisId="eff" orientation="right" domain={[85, 100]} tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="temp" type="monotone" dataKey="temp" stroke={amber} fill={`${amber}20`} strokeWidth={2} name="Temp °C" />
                    <Line yAxisId="eff" type="monotone" dataKey="efficiency" stroke={green} strokeWidth={2} dot={false} name="Efficiency %" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Remaining Useful Life Projection</div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={sensorData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} interval={6} />
                    <YAxis tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={2} stroke={red} strokeDasharray="3 3" label={{ value: "Action needed", fill: red, fontSize: 10 }} />
                    <Area type="monotone" dataKey="rul" stroke={accent} fill={`${accent}20`} strokeWidth={2} name="RUL (years)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Parts needed */}
            {asset.parts.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: red }}>⚠ Parts Required — {asset.id}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {asset.parts.map(p => (
                    <div key={p} style={{ background: "#451a03", border: "1px solid #92400e", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: amber }}>{p}</span>
                      <button style={{ fontSize: 10, padding: "2px 8px", background: amber, color: "#000", border: "none", borderRadius: 4, cursor: "pointer" }}>Order</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "Work Orders" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Active Work Orders</h2>
            <div style={{ fontSize: 13, color: "rgba(148,163,184,0.85)" }}>Total budget: <span style={{ color: blue, fontWeight: 700 }}>€{maintenanceCost.toLocaleString()}</span></div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                {["WO #", "Asset", "Description", "Priority", "Assigned To", "Due Date", "Cost", "Status"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "rgba(148,163,184,0.85)", fontWeight: 500, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORK_ORDERS.map((w, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <td style={{ padding: "12px", fontWeight: 700, color: accent }}>{w.id}</td>
                  <td style={{ padding: "12px" }}>{w.asset}</td>
                  <td style={{ padding: "12px", maxWidth: 240 }}>{w.title}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: w.priority === "Critical" ? "#7f1d1d" : w.priority === "High" ? "#451a03" : "var(--surface2)", color: PRIORITY_COLOR[w.priority] }}>{w.priority}</span>
                  </td>
                  <td style={{ padding: "12px", color: w.assigned === "Unassigned" ? red : "#f1f5f9" }}>{w.assigned}</td>
                  <td style={{ padding: "12px", color: "rgba(148,163,184,0.85)" }}>{w.due}</td>
                  <td style={{ padding: "12px", color: blue, fontWeight: 600 }}>€{w.cost.toLocaleString()}</td>
                  <td style={{ padding: "12px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: w.status === "In Progress" ? "#1e3a5f" : w.status === "Open" ? "#451a03" : "var(--surface2)", color: w.status === "In Progress" ? blue : w.status === "Open" ? amber : "rgba(148,163,184,0.85)" }}>{w.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Cost Analysis" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...card, gridColumn: "span 2" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Maintenance Cost Breakdown — Planned vs Unplanned + Avoided Failure Savings</div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }} />
                <YAxis yAxisId="cost" tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }} />
                <YAxis yAxisId="avoid" orientation="right" tick={{ fontSize: 11, fill: "rgba(148,163,184,0.85)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="cost" dataKey="planned" fill={blue} name="Planned €" stackId="a" />
                <Bar yAxisId="cost" dataKey="unplanned" fill={red} name="Unplanned €" stackId="a" radius={[2, 2, 0, 0]} />
                <Line yAxisId="avoid" type="monotone" dataKey="avoided" stroke={green} strokeWidth={2.5} dot={{ r: 4, fill: green }} name="Avoided Failures €" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Cost Efficiency KPIs</div>
            {[
              { l: "Total planned maintenance", v: "€15,500", c: blue },
              { l: "Unplanned downtime cost", v: "€5,000", c: red },
              { l: "Avoided failure value", v: "€32,600", c: green },
              { l: "Net ROI on predictive maintenance", v: "€12.1 per €1 spent", c: green },
              { l: "Avg MTBF (fleet)", v: "4,280 hours", c: amber },
              { l: "Avg MTTR", v: "6.4 hours", c: amber },
            ].map(m => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.12)", fontSize: 13 }}>
                <span style={{ color: "rgba(148,163,184,0.85)" }}>{m.l}</span>
                <span style={{ color: m.c, fontWeight: 700 }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Asset Health Distribution</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ASSETS.map(a => ({ name: a.id, health: a.health, rul: a.rul }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="health" name="Health %" radius={[4, 4, 0, 0]}>
                  {ASSETS.map((a, i) => <Cell key={i} fill={STATUS_COLOR[a.status]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "Anomaly Feed" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>
          <div style={card}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Active Anomaly Detections</div>
            {ANOMALY_FEED.map((a, i) => (
              <div key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", padding: "14px 0", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[a.sev] || amber, marginTop: 6, flexShrink: 0, boxShadow: `0 0 6px ${STATUS_COLOR[a.sev] || amber}` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.asset}</span>
                    <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "var(--surface2)", color: "rgba(148,163,184,0.85)" }}>{a.type}</span>
                    <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: STATUS_BG[a.sev] || "#451a03", color: STATUS_COLOR[a.sev] || amber }}>{a.sev}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{a.msg}</div>
                  <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 4 }}>Detected at {a.time} today</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button style={{ fontSize: 11, padding: "4px 10px", background: accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>Create WO</button>
                  <button style={{ fontSize: 11, padding: "4px 10px", background: "var(--surface2)", color: "rgba(148,163,184,0.85)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, cursor: "pointer" }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>AI Diagnostics Summary</div>
            {[
              { l: "Models running", v: "8 ML pipelines" },
              { l: "Sensor streams", v: "142 active" },
              { l: "Anomalies today", v: ANOMALY_FEED.length },
              { l: "Auto-resolved", v: 3 },
              { l: "Tickets created", v: 2 },
              { l: "Next full scan", v: "in 14 min" },
            ].map(m => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.12)", fontSize: 13 }}>
                <span style={{ color: "rgba(148,163,184,0.85)" }}>{m.l}</span>
                <span style={{ fontWeight: 700 }}>{m.v}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Fault Type Distribution</div>
            {[
              { type: "Thermal", pct: 38, color: red },
              { type: "Cell Voltage", pct: 28, color: amber },
              { type: "Vibration", pct: 18, color: blue },
              { type: "Performance", pct: 16, color: green },
            ].map(f => (
              <div key={f.type} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                  <span>{f.type}</span><span style={{ color: "rgba(148,163,184,0.85)" }}>{f.pct}%</span>
                </div>
                <div style={{ background: "#1f2937", borderRadius: 3, height: 5 }}>
                  <div style={{ width: `${f.pct}%`, height: "100%", background: f.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
