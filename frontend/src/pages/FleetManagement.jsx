import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const initFleet = () => [
  { id: 1, name: "Herdade Solar Norte", type: "hybrid", country: "PT", solarKw: 4200, bessKwh: 8400, bessKw: 2100, soc: 78, solarNow: 3.8, bessNow: 2.1, revenue: 1840, uptime: 99.2, temp: 31, status: "online", alerts: 0, lastSync: "just now" },
  { id: 2, name: "Parque BESS Sul", type: "bess_only", country: "PT", solarKw: 2800, bessKwh: 5600, bessKw: 3400, soc: 45, solarNow: 2.2, bessNow: 3.1, revenue: 1240, uptime: 98.7, temp: 34, status: "online", alerts: 0, lastSync: "2m ago" },
  { id: 3, name: "Complexo Híbrido Évora", type: "hybrid", country: "PT", solarKw: 6100, bessKwh: 12200, bessKw: 4000, soc: 91, solarNow: 5.6, bessNow: 0, revenue: 2420, uptime: 97.1, temp: 42, status: "warning", alerts: 2, lastSync: "just now" },
  { id: 4, name: "Mini-Grid Alentejo", type: "solar_only", country: "PT", solarKw: 1500, bessKwh: 1800, bessKw: 900, soc: 33, solarNow: 1.3, bessNow: 0.8, revenue: 540, uptime: 99.8, temp: 29, status: "online", alerts: 0, lastSync: "5m ago" },
  { id: 5, name: "Parque Algarve", type: "solar_only", country: "PT", solarKw: 5000, bessKwh: 7500, bessKw: 2600, soc: 62, solarNow: 0, bessNow: 0, revenue: 0, uptime: 0, temp: 38, status: "offline", alerts: 3, lastSync: "2h ago" },
  { id: 6, name: "Serra da Estrela Wind+BESS", type: "wind_bess", country: "PT", solarKw: 0, bessKwh: 9600, bessKw: 3200, soc: 55, solarNow: 0, bessNow: 2.8, revenue: 980, uptime: 96.4, temp: 22, status: "online", alerts: 1, lastSync: "just now" },
];

const genHourly = () => Array.from({ length: 24 }, (_, i) => ({
  h: `${i}h`,
  solar: i >= 6 && i <= 20 ? rand(5, 18) : 0,
  bess: rand(2, 10),
  revenue: rand(200, 800, 0),
}));

export default function FleetManagement() {
  const [fleet, setFleet] = useState(initFleet());
  const [hourly] = useState(genHourly());
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("revenue");
  const [metrics, setMetrics] = useState({ totalSolar: 19.1, totalBess: 9.8, totalRevenue: 7020, online: 5, alerts: 6 });

  useEffect(() => {
    const t = setInterval(() => {
      setFleet(f => f.map(site => ({
        ...site,
        soc: site.status !== "offline" ? Math.min(100, Math.max(10, site.soc + rand(-1, 1, 0))) : site.soc,
        solarNow: site.status !== "offline" ? parseFloat(Math.max(0, site.solarNow + rand(-0.2, 0.2)).toFixed(1)) : 0,
        temp: site.status !== "offline" ? parseFloat((site.temp + rand(-0.3, 0.3)).toFixed(1)) : site.temp,
        revenue: site.status !== "offline" ? Math.max(0, site.revenue + rand(-20, 40, 0)) : 0,
      })));
      setMetrics(m => ({
        ...m,
        totalSolar: parseFloat((m.totalSolar + rand(-0.3, 0.3)).toFixed(1)),
        totalRevenue: Math.round(m.totalRevenue + rand(-30, 60)),
      }));
    }, 2500);
    return () => clearInterval(t);
  }, []);

  const filtered = fleet
    .filter(s => filter === "all" || s.status === filter || s.type === filter)
    .sort((a, b) => b[sortBy] - a[sortBy]);

  const statusColor = (s) => s === "online" ? green : s === "warning" ? amber : red;
  const statusBg = (s) => `${statusColor(s)}20`;

  const revenueChart = fleet.map(s => ({ name: s.name.split(" ")[0], revenue: s.revenue, solar: s.solarNow, fill: statusColor(s.status) }));
  const socChart = fleet.map(s => ({ name: s.name.split(" ")[0], soc: s.soc, fill: s.soc > 70 ? green : s.soc > 40 ? amber : red }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Fleet Management</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Multi-site Solar + BESS portfolio overview</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", "online", "warning", "offline"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              background: filter === f ? accent : "var(--surface2)",
              color: filter === f ? "#fff" : "var(--sub)",
              border: `1px solid ${filter === f ? accent : "var(--border)"}`,
            }}>{f === "all" ? "All Sites" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Fleet Solar Output", value: `${metrics.totalSolar} MW`, color: amber },
          { label: "BESS Dispatched", value: `${metrics.totalBess} MW`, color: purple },
          { label: "Today Revenue", value: `€${metrics.totalRevenue.toLocaleString()}`, color: green },
          { label: "Sites Online", value: `${metrics.online} / ${fleet.length}`, color: green },
          { label: "Active Alerts", value: metrics.alerts, color: metrics.alerts > 0 ? red : green },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue + SoC charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Today Revenue by Site (€)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueChart} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--sub)" }} unit="€" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {revenueChart.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>BESS State of Charge by Site (%)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={socChart} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--sub)" }} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="soc" radius={[0, 6, 6, 0]}>
                {socChart.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 24h fleet power */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Fleet 24h Generation Profile</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={hourly} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} />
            <YAxis yAxisId="power" tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" MW" />
            <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} unit="€" />
            <Tooltip content={<CustomTooltip />} />
            <Area yAxisId="power" type="monotone" dataKey="solar" stroke={amber} fill={amber} fillOpacity={0.3} name="Solar" />
            <Area yAxisId="power" type="monotone" dataKey="bess" stroke={purple} fill={purple} fillOpacity={0.25} name="BESS" />
            <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke={green} strokeWidth={2.5} dot={false} name="Revenue €" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Site cards grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={label}>Site Details ({filtered.length})</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--sub)" }}>Sort by:</span>
            {["revenue", "soc", "solarNow", "uptime"].map(s => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                background: sortBy === s ? "var(--surface2)" : "none",
                color: sortBy === s ? accent : "var(--sub)",
                border: `1px solid ${sortBy === s ? accent : "transparent"}`,
              }}>{s === "solarNow" ? "Solar" : s === "uptime" ? "Uptime" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {filtered.map(site => (
            <div key={site.id} style={{ ...card, position: "relative" }}>
              {/* Status dot */}
              <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6 }}>
                {site.alerts > 0 && (
                  <span style={{ fontSize: 10, background: "#ef444420", color: red, padding: "2px 7px", borderRadius: 10 }}>
                    {site.alerts} alert{site.alerts > 1 ? "s" : ""}
                  </span>
                )}
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(site.status) }} />
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2, paddingRight: 60 }}>{site.name}</div>
              <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 12 }}>
                {site.type.replace("_", " ")} · {site.country} · {site.lastSync}
              </div>

              {/* SoC bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: "var(--sub)" }}>BESS SoC</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: site.soc > 70 ? green : site.soc > 40 ? amber : red }}>{site.soc}%</span>
                </div>
                <div style={{ height: 5, background: "var(--border)", borderRadius: 3 }}>
                  <div style={{ width: `${site.soc}%`, height: "100%", borderRadius: 3, transition: "width 0.4s",
                    background: site.soc > 70 ? green : site.soc > 40 ? amber : red }} />
                </div>
              </div>

              {/* Metrics grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { l: "Solar", v: `${site.solarNow} MW`, c: amber },
                  { l: "BESS", v: `${site.bessNow} MW`, c: purple },
                  { l: "Revenue", v: `€${site.revenue}`, c: green },
                  { l: "Uptime", v: `${site.uptime}%`, c: site.uptime > 95 ? green : amber },
                  { l: "Temp", v: `${site.temp}°C`, c: site.temp > 40 ? red : "var(--text)" },
                  { l: site.solarKw > 0 ? `${(site.solarKw/1000).toFixed(1)} MWp` : `${(site.bessKwh/1000).toFixed(1)} MWh`, v: "capacity", c: "var(--sub)" },
                ].map(m => (
                  <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "var(--sub)", marginBottom: 2 }}>{m.l}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary table */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Fleet Summary Table</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Site", "Type", "Status", "Solar Now", "BESS SoC", "Revenue", "Uptime", "Temp", "Alerts"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "5px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fleet.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{s.name}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{s.type.replace("_", " ")}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: statusBg(s.status), color: statusColor(s.status) }}>{s.status}</span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 12, color: amber }}>{s.solarNow} MW</td>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: s.soc > 70 ? green : s.soc > 40 ? amber : red }}>{s.soc}%</td>
                <td style={{ padding: "8px 10px", fontSize: 12, color: green }}>€{s.revenue.toLocaleString()}</td>
                <td style={{ padding: "8px 10px", fontSize: 12, color: s.uptime > 95 ? green : s.uptime > 0 ? amber : red }}>{s.uptime}%</td>
                <td style={{ padding: "8px 10px", fontSize: 12, color: s.temp > 40 ? red : "var(--text)" }}>{s.temp}°C</td>
                <td style={{ padding: "8px 10px" }}>
                  {s.alerts > 0
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: red }}>{s.alerts}</span>
                    : <span style={{ fontSize: 11, color: green }}>✓</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
