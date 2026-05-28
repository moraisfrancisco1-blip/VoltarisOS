import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const val = { fontSize: 26, fontWeight: 700, color: "var(--text)" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const initSites = () => [
  { id: 1, name: "Herdade Solar Norte", status: "online", soc: 78, solarMW: 4.2, bessMW: 2.1, mode: "charge", setpoint: 70, temp: 31 },
  { id: 2, name: "Parque BESS Sul", status: "online", soc: 45, solarMW: 2.8, bessMW: 3.4, mode: "discharge", setpoint: 100, temp: 34 },
  { id: 3, name: "Complexo Híbrido Évora", status: "warning", soc: 91, solarMW: 6.1, bessMW: 4.0, mode: "standby", setpoint: 0, temp: 42 },
  { id: 4, name: "Mini-Grid Alentejo", status: "online", soc: 33, solarMW: 1.5, bessMW: 0.9, mode: "charge", setpoint: 50, temp: 29 },
  { id: 5, name: "Parque Fotovoltaico Algarve", status: "offline", soc: 62, solarMW: 0, bessMW: 0, mode: "offline", setpoint: 0, temp: 38 },
];

const genEvents = () => Array.from({ length: 12 }, (_, i) => ({
  id: i,
  ts: `${14 - Math.floor(i / 2)}:${String((i % 2) * 30).padStart(2, "0")}`,
  type: ["info", "warning", "error", "success"][i % 4],
  msg: [
    "BESS Parque Sul: Discharge command executed — 100 kW",
    "Herdade Norte: SoC 78% — Charge setpoint updated",
    "Complexo Évora: High temp alert 42°C — throttle active",
    "FCR activation received — Fleet response 2.4 MW",
    "Intraday arbitrage executed — €286 profit",
    "Algarve site: Comms lost — inverter offline",
    "Scheduled night charge started — 3 sites",
    "Grid signal: Frequency deviation — BESS responding",
    "Manual override: Évora BESS to standby",
    "Revenue target hit: €5,000 for today",
    "Predictive alert: Cell-12 temp trending high",
    "Auto-dispatch approved — AI recommendation applied",
  ][i],
}));

export default function CommandCenter() {
  const [sites, setSites] = useState(initSites());
  const [events, setEvents] = useState(genEvents());
  const [metrics, setMetrics] = useState({ online: 4, total: 5, totalPower: 10.2, activeAlerts: 2, cmdSent: 14 });
  const [bulkMode, setBulkMode] = useState("");
  const [bulkSetpoint, setBulkSetpoint] = useState(50);
  const [selected, setSelected] = useState([]);

  const powerHistory = Array.from({ length: 20 }, (_, i) => ({
    t: `${i * 3}m`, solar: rand(3, 14), bess: rand(1, 8)
  }));

  useEffect(() => {
    const t = setInterval(() => {
      setSites(s => s.map(site => ({
        ...site,
        soc: site.status !== "offline"
          ? Math.min(100, Math.max(5, site.soc + (site.mode === "charge" ? rand(0, 1.5, 0) : site.mode === "discharge" ? -rand(0, 1.5, 0) : 0)))
          : site.soc,
        temp: site.status !== "offline" ? Math.min(55, Math.max(20, site.temp + rand(-0.5, 0.5, 1))) : site.temp,
        solarMW: site.status !== "offline" ? parseFloat((site.solarMW + rand(-0.1, 0.1)).toFixed(1)) : 0,
      })));
      setMetrics(m => ({
        ...m,
        totalPower: parseFloat((m.totalPower + rand(-0.3, 0.3)).toFixed(1)),
      }));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const sendBulkCommand = () => {
    if (!bulkMode) return;
    setSites(s => s.map(site =>
      (selected.length === 0 || selected.includes(site.id)) && site.status !== "offline"
        ? { ...site, mode: bulkMode, setpoint: bulkSetpoint }
        : site
    ));
    setEvents(ev => [
      { id: Date.now(), ts: new Date().toLocaleTimeString().slice(0, 5), type: "success",
        msg: `Bulk command: ${bulkMode.toUpperCase()} ${bulkSetpoint}kW → ${selected.length === 0 ? "All" : selected.length} sites` },
      ...ev.slice(0, 11),
    ]);
  };

  const sendSiteCommand = (siteId, mode, setpoint) => {
    setSites(s => s.map(site => site.id === siteId ? { ...site, mode, setpoint } : site));
    const site = sites.find(s => s.id === siteId);
    setEvents(ev => [
      { id: Date.now(), ts: new Date().toLocaleTimeString().slice(0, 5), type: "info",
        msg: `${site?.name}: ${mode.toUpperCase()} ${setpoint}kW dispatched` },
      ...ev.slice(0, 11),
    ]);
  };

  const statusBg = (s) => s === "online" ? "#10b98120" : s === "warning" ? "#f59e0b20" : "#ef444420";
  const statusColor = (s) => s === "online" ? green : s === "warning" ? amber : red;
  const eventColor = (t) => t === "error" ? red : t === "warning" ? amber : t === "success" ? green : blue;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Command Center</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Fleet-wide BESS dispatch · Real-time controls · Event feed</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "#10b98120", color: green, border: "1px solid #10b981" }}>
            {metrics.online}/{metrics.total} sites online
          </span>
          <span style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: "#ef444420", color: red, border: "1px solid #ef4444" }}>
            {metrics.activeAlerts} active alerts
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Fleet Solar Output", value: `${metrics.totalPower} MW`, color: amber },
          { label: "Sites Online", value: `${metrics.online} / ${metrics.total}`, color: green },
          { label: "Commands Sent Today", value: metrics.cmdSent, color: accent },
          { label: "Active Alerts", value: metrics.activeAlerts, color: red },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Bulk command bar */}
      <div style={{ ...card, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>BULK COMMAND</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["charge", "discharge", "standby", "fcr_mode"].map(m => (
              <button key={m} onClick={() => setBulkMode(m)} style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: bulkMode === m ? accent : "var(--surface2)",
                color: bulkMode === m ? "#fff" : "var(--sub)",
                border: `1px solid ${bulkMode === m ? accent : "var(--border)"}`,
              }}>{m.replace("_", " ").toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>SETPOINT (kW)</div>
          <input type="number" value={bulkSetpoint} onChange={e => setBulkSetpoint(Number(e.target.value))}
            style={{ width: 80, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>TARGET</div>
          <select onChange={e => {
            const v = e.target.value;
            setSelected(v === "all" ? [] : v === "online" ? sites.filter(s => s.status === "online").map(s => s.id) : []);
          }} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontSize: 13 }}>
            <option value="all">All Sites</option>
            <option value="online">Online Only</option>
          </select>
        </div>
        <button onClick={sendBulkCommand} style={{ padding: "8px 20px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Send Command
        </button>
        <button style={{ padding: "8px 16px", background: "#ef444420", border: "1px solid #ef4444", borderRadius: 8, color: red, fontSize: 12, cursor: "pointer" }}>
          EMERGENCY STOP ALL
        </button>
      </div>

      {/* Per-site controls */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Per-Site BESS Dispatch Controls</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sites.map(site => (
            <div key={site.id} style={{
              display: "grid", gridTemplateColumns: "2fr 80px 80px 80px 120px 1fr auto",
              gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)"
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{site.name}</div>
                <div style={{ fontSize: 10, color: "var(--sub)" }}>Solar {site.solarMW} MW · Temp {site.temp.toFixed(1)}°C</div>
              </div>
              <div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: statusBg(site.status), color: statusColor(site.status) }}>
                  {site.status}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--sub)" }}>SoC</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: site.soc > 70 ? green : site.soc > 40 ? amber : red }}>{site.soc}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--sub)" }}>BESS</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: purple }}>{site.bessMW} MW</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 2 }}>Mode</div>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 8,
                  background: site.mode === "charge" ? "#10b98120" : site.mode === "discharge" ? "#ef444420" : "#f59e0b20",
                  color: site.mode === "charge" ? green : site.mode === "discharge" ? red : amber }}>
                  {site.mode.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4 }}>
                  <div style={{ width: `${site.soc}%`, height: "100%", borderRadius: 4,
                    background: site.soc > 70 ? green : site.soc > 40 ? amber : red }} />
                </div>
              </div>
              {site.status !== "offline" && (
                <div style={{ display: "flex", gap: 6 }}>
                  {["charge", "discharge", "standby"].map(m => (
                    <button key={m} onClick={() => sendSiteCommand(site.id, m, site.setpoint)} style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 10, cursor: "pointer",
                      background: site.mode === m ? accent : "var(--surface2)",
                      color: site.mode === m ? "#fff" : "var(--sub)",
                      border: `1px solid ${site.mode === m ? accent : "var(--border)"}`,
                    }}>{m[0].toUpperCase()}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Power history + Event feed */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Fleet Power (Last 60 min)</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={powerHistory} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" MW" />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="solar" stroke={amber} fill={amber} fillOpacity={0.25} name="Solar" />
              <Area type="monotone" dataKey="bess" stroke={purple} fill={purple} fillOpacity={0.25} name="BESS" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Live Event Feed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
            {events.map(e => (
              <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 4, flexShrink: 0, background: eventColor(e.type) }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.4 }}>{e.msg}</div>
                  <div style={{ fontSize: 9, color: "var(--sub)" }}>{e.ts}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
