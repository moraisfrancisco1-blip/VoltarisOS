import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, Legend
} from "recharts";

const accent = "#6366f1";
const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";
const blue = "#60a5fa";

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 24 };
const card2 = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 };

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec); }

const CHEMISTRIES = { LFP: { color: "#10b981", voltMin: 2.5, voltMax: 3.65, tempMax: 60, desc: "Lithium Iron Phosphate" }, NMC: { color: "#6366f1", voltMin: 2.8, voltMax: 4.2, tempMax: 45, desc: "Nickel Manganese Cobalt" }, LTO: { color: "#60a5fa", voltMin: 1.5, voltMax: 2.8, tempMax: 55, desc: "Lithium Titanate" } };

const MOCK_BATTERIES = [
  { id: "BESS-001", site: "Rotterdam North", capacity: 2000, soc: 74, voltage: 48.2, current: 320, temp: 28, cycles: 312, health: 97, status: "Charging", chemistry: "LFP", cells: 192, strings: 8, power_kw: 500, rte: 94.2, installed: "2022-03", firmware: "v3.4.1" },
  { id: "BESS-002", site: "Rebordelo I", capacity: 1000, soc: 41, voltage: 47.8, current: -280, temp: 33, cycles: 501, health: 89, status: "Discharging", chemistry: "NMC", cells: 96, strings: 4, power_kw: 250, rte: 91.8, installed: "2021-07", firmware: "v2.9.3" },
  { id: "BESS-003", site: "Rotterdam South", capacity: 2000, soc: 88, voltage: 49.1, current: 0, temp: 25, cycles: 198, health: 98, status: "Idle", chemistry: "LFP", cells: 192, strings: 8, power_kw: 500, rte: 95.1, installed: "2023-01", firmware: "v3.4.1" },
  { id: "BESS-004", site: "Lisbon Park", capacity: 500, soc: 22, voltage: 46.9, current: 180, temp: 38, cycles: 1102, health: 82, status: "Charging", chemistry: "NMC", cells: 48, strings: 2, power_kw: 125, rte: 88.4, installed: "2020-05", firmware: "v2.7.0" },
  { id: "BESS-005", site: "Madrid Grid", capacity: 4000, soc: 61, voltage: 48.8, current: -600, temp: 31, cycles: 88, health: 99, status: "Discharging", chemistry: "LFP", cells: 384, strings: 16, power_kw: 1000, rte: 95.8, installed: "2024-02", firmware: "v3.5.0" },
  { id: "BESS-006", site: "Hamburg Port", capacity: 1500, soc: 55, voltage: 47.5, current: 0, temp: 22, cycles: 445, health: 91, status: "Idle", chemistry: "LTO", cells: 144, strings: 6, power_kw: 300, rte: 97.2, installed: "2022-09", firmware: "v4.1.2" },
];

const TABS = ["Overview", "Cell Diagnostics", "Thermal", "Cycle Analysis", "Degradation", "BMS Config"];
const STATUS_COLORS = { Charging: green, Discharging: red, Idle: "#6b7280", Fault: red, Balancing: amber };
const STATUS_BG = { Charging: "#064e3b", Discharging: "#7f1d1d", Idle: "#1f2937", Fault: "#7f1d1d", Balancing: "#451a03" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg,#1a1f2e)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "var(--sub)", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

function SoCBar({ value, height = 10 }) {
  const color = value > 70 ? green : value > 30 ? amber : red;
  return (
    <div style={{ background: "#1f2937", borderRadius: 6, height, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.6s", boxShadow: `0 0 6px ${color}60` }} />
    </div>
  );
}

function HealthRing({ value, size = 70 }) {
  const r = size * 0.4, circ = 2 * Math.PI * r;
  const color = value > 90 ? green : value > 75 ? amber : red;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2,#1f2937)" strokeWidth={size * 0.09} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
        strokeDasharray={`${(value / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill="#fff" fontSize={size * 0.19} fontWeight="bold">{value}%</text>
    </svg>
  );
}

function TempGauge({ value, max = 60 }) {
  const pct = Math.min(value / max, 1);
  const color = pct < 0.5 ? green : pct < 0.75 ? amber : red;
  const angle = -135 + pct * 270;
  return (
    <svg width={80} height={56} viewBox="0 0 80 56">
      <path d="M8 48 A36 36 0 0 1 72 48" fill="none" stroke="#1f2937" strokeWidth={6} strokeLinecap="round" />
      <path d="M8 48 A36 36 0 0 1 72 48" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${pct * 113.1} 113.1`} style={{ filter: `drop-shadow(0 0 4px ${color}80)` }} />
      <line x1={40} y1={44} x2={40 + 22 * Math.cos((angle - 90) * Math.PI / 180)} y2={44 + 22 * Math.sin((angle - 90) * Math.PI / 180)}
        stroke={color} strokeWidth={2} strokeLinecap="round" />
      <text x={40} y={54} textAnchor="middle" fill="#fff" fontSize={11} fontWeight="bold">{value}°C</text>
    </svg>
  );
}

export default function BatteryManagement() {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [batteries, setBatteries] = useState(MOCK_BATTERIES);
  const [tick, setTick] = useState(0);
  const [chartRange, setChartRange] = useState("24h");

  // Live simulation
  useEffect(() => {
    const iv = setInterval(() => {
      setBatteries(prev => prev.map(b => ({
        ...b,
        soc: +(b.soc + (b.status === "Charging" ? rand(0.05, 0.2) : b.status === "Discharging" ? -rand(0.05, 0.2) : 0)).toFixed(1),
        temp: +(b.temp + (Math.random() - 0.49) * 0.3).toFixed(1),
        voltage: +(b.voltage + (Math.random() - 0.5) * 0.05).toFixed(2),
        current: +(b.current + (Math.random() - 0.5) * 5).toFixed(0),
      })));
      setTick(t => t + 1);
    }, 2500);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === "All" ? batteries : batteries.filter(b => b.status === filter);
  const bat = batteries[selected] || batteries[0];

  const totalCapacity = batteries.reduce((a, b) => a + b.capacity, 0);
  const totalPower = batteries.reduce((a, b) => a + b.power_kw, 0);
  const avgSoC = +(batteries.reduce((a, b) => a + b.soc, 0) / batteries.length).toFixed(1);
  const avgHealth = +(batteries.reduce((a, b) => a + b.health, 0) / batteries.length).toFixed(1);
  const chargingNow = batteries.filter(b => b.status === "Charging").length;
  const discharging = batteries.filter(b => b.status === "Discharging").length;
  const activePower = batteries.filter(b => b.status === "Discharging").reduce((a, b) => a + b.power_kw, 0);
  const totalStored = +(batteries.reduce((a, b) => a + b.capacity * b.soc / 100, 0) / 1000).toFixed(2);

  // Chart data
  const socHistory = Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    soc: Math.max(10, Math.min(98, bat.soc + Math.sin((i - 12) / 4) * 30 + rand(-5, 5))),
    power: i >= 1 && i <= 5 ? rand(200, 500) : i >= 8 && i <= 10 ? -rand(150, 400) : i >= 17 && i <= 20 ? -rand(300, 600) : rand(-50, 50),
    temp: bat.temp + Math.sin(i / 6) * 4 + rand(-1, 1),
  }));

  const cellData = Array.from({ length: bat.cells }, (_, i) => ({
    cell: i + 1,
    voltage: bat.voltage / (bat.cells / (bat.strings)) + rand(-0.02, 0.02, 3),
    temp: bat.temp + rand(-3, 6),
    balance: rand(0, 100),
  }));

  const cycleData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(2024, i, 1).toLocaleString("en", { month: "short" });
    return { month, cycles: Math.round(bat.cycles / 12 * (0.7 + Math.random() * 0.6)), capacity_fade: +(bat.capacity * (1 - i * 0.003) * rand(0.97, 1.03, 3)).toFixed(0), revenue: rand(800, 3200, 0) };
  });

  const degradationData = Array.from({ length: 10 }, (_, i) => ({
    year: `Y${i + 1}`,
    health_lfp: Math.max(70, 100 - i * 2.8),
    health_nmc: Math.max(65, 100 - i * 3.6),
    health_lto: Math.max(80, 100 - i * 1.5),
    this_unit: Math.max(68, bat.health - i * (bat.health - 70) / 9),
  }));

  const thermalMap = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => ({
      row, col,
      temp: bat.temp + rand(-5, 8),
      id: row * 12 + col,
    }))
  );

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Battery Energy Storage System</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>Real-time BESS monitoring, cell diagnostics, thermal management & lifecycle analytics</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
            <span style={{ color: green }}>●</span> <span style={{ color: "var(--sub)" }}>Live</span> · Updated {tick}s ago
          </div>
          <button style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            + Add BESS Unit
          </button>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Capacity", value: `${(totalCapacity / 1000).toFixed(1)} MWh`, sub: `${batteries.length} units`, color: accent },
          { label: "Max Power", value: `${totalPower} kW`, sub: "installed", color: blue },
          { label: "Stored Energy", value: `${totalStored} MWh`, sub: "currently stored", color: green },
          { label: "Fleet Avg SoC", value: `${avgSoC}%`, sub: "state of charge", color: avgSoC > 50 ? green : amber },
          { label: "Fleet Health", value: `${avgHealth}%`, sub: "avg SoH", color: avgHealth > 90 ? green : amber },
          { label: "Charging", value: chargingNow, sub: "units", color: green },
          { label: "Discharging", value: discharging, sub: `${activePower} kW active`, color: red },
          { label: "Avg RTE", value: `${(batteries.reduce((a, b) => a + b.rte, 0) / batteries.length).toFixed(1)}%`, sub: "round-trip eff.", color: "#a78bfa" },
        ].map(k => (
          <div key={k.label} style={{ ...card2, textAlign: "center" }}>
            <div style={{ color: "var(--sub)", fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ color: "var(--sub)", fontSize: 10, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>

        {/* Left: Battery list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Filter */}
          <div style={{ display: "flex", gap: 6 }}>
            {["All", "Charging", "Discharging", "Idle"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? accent : "var(--surface2)", color: filter === f ? "#fff" : "var(--sub)",
                border: `1px solid ${filter === f ? accent : "var(--border)"}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer"
              }}>{f}</button>
            ))}
          </div>

          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600 }}>
              BESS Units ({filtered.length})
            </div>
            {filtered.map((b, i) => {
              const idx = batteries.indexOf(b);
              return (
                <div key={b.id} onClick={() => setSelected(idx)} style={{
                  padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                  background: selected === idx ? "var(--surface2)" : "transparent",
                  borderLeft: selected === idx ? `3px solid ${accent}` : "3px solid transparent",
                  transition: "all 0.2s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{b.id}</span>
                      <div style={{ color: "var(--sub)", fontSize: 11, marginTop: 2 }}>{b.site} · {b.chemistry} · {(b.capacity / 1000).toFixed(1)} MWh</div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 99, fontWeight: 600,
                      background: STATUS_BG[b.status] || "#1f2937",
                      color: STATUS_COLORS[b.status] || "#6b7280"
                    }}>{b.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--sub)", width: 52 }}>SoC {b.soc}%</span>
                    <div style={{ flex: 1 }}><SoCBar value={b.soc} /></div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                    {[
                      { l: "Health", v: `${b.health}%`, c: b.health > 90 ? green : b.health > 75 ? amber : red },
                      { l: "Temp", v: `${b.temp}°C`, c: b.temp > 40 ? red : b.temp > 32 ? amber : green },
                      { l: "Power", v: `${Math.abs(b.current * 48 / 1000).toFixed(1)} kW`, c: "var(--text)" },
                      { l: "Cycles", v: b.cycles, c: "var(--sub)" },
                    ].map(m => (
                      <div key={m.l} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "var(--sub)" }}>{m.l}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: m.c }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Fleet SoC Summary */}
          <div style={card2}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Fleet SoC Distribution</div>
            {batteries.map(b => (
              <div key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--sub)", marginBottom: 3 }}>
                  <span>{b.id}</span><span>{b.soc}%</span>
                </div>
                <SoCBar value={b.soc} height={6} />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Unit header */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <HealthRing value={bat.health} size={80} />
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{bat.id}</div>
                  <div style={{ color: "var(--sub)", fontSize: 13 }}>{bat.site}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: STATUS_BG[bat.status], color: STATUS_COLORS[bat.status], fontWeight: 600 }}>{bat.status}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--surface2)", color: "var(--sub)" }}>{bat.chemistry} — {CHEMISTRIES[bat.chemistry]?.desc}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--surface2)", color: "var(--sub)" }}>FW {bat.firmware}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "right" }}>
                {[
                  { l: "Capacity", v: `${bat.capacity} kWh` },
                  { l: "Nominal Power", v: `${bat.power_kw} kW` },
                  { l: "Round-Trip Eff.", v: `${bat.rte}%` },
                  { l: "Installed", v: bat.installed },
                ].map(m => (
                  <div key={m.l}>
                    <div style={{ fontSize: 10, color: "var(--sub)" }}>{m.l}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Realtime metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
              {[
                { l: "SoC", v: `${bat.soc}%`, c: bat.soc > 70 ? green : bat.soc > 30 ? amber : red, icon: "🔋" },
                { l: "Voltage", v: `${bat.voltage}V`, c: blue, icon: "⚡" },
                { l: "Current", v: `${bat.current > 0 ? "+" : ""}${bat.current}A`, c: bat.current > 0 ? green : red, icon: "↕" },
                { l: "Temperature", v: `${bat.temp}°C`, c: bat.temp > 40 ? red : bat.temp > 32 ? amber : green, icon: "🌡" },
                { l: "Cycles", v: bat.cycles, c: "var(--text)", icon: "🔄" },
                { l: "Cells", v: `${bat.cells} / ${bat.strings}S`, c: "var(--sub)", icon: "⬛" },
              ].map(m => (
                <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.c }}>{m.v}</div>
                  <div style={{ fontSize: 10, color: "var(--sub)", marginTop: 2 }}>{m.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                background: tab === t ? accent : "var(--surface)", color: tab === t ? "#fff" : "var(--sub)",
                border: `1px solid ${tab === t ? accent : "var(--border)"}`, borderRadius: 8,
                padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: tab === t ? 600 : 400
              }}>{t}</button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "Overview" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>24h SoC + Power</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["24h", "7d", "30d"].map(r => (
                    <button key={r} onClick={() => setChartRange(r)} style={{
                      background: chartRange === r ? accent : "var(--surface2)", color: chartRange === r ? "#fff" : "var(--sub)",
                      border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer"
                    }}>{r}</button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={socHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={5} />
                    <YAxis yAxisId="soc" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis yAxisId="pwr" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area yAxisId="soc" type="monotone" dataKey="soc" stroke={green} fill={`${green}20`} strokeWidth={2} name="SoC %" />
                    <Bar yAxisId="pwr" dataKey="power" name="Power kW" fill={accent} opacity={0.7} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Degradation Forecast</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={degradationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis domain={[65, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="this_unit" stroke={accent} strokeWidth={2.5} dot={false} name="This Unit" />
                    <Line type="monotone" dataKey="health_lfp" stroke={green} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="LFP Avg" />
                    <Line type="monotone" dataKey="health_nmc" stroke={amber} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="NMC Avg" />
                    <ReferenceLine y={80} stroke={red} strokeDasharray="3 3" label={{ value: "EOL 80%", fill: red, fontSize: 10 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card, gridColumn: "span 2" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Monthly Revenue & Cycle Count</div>
                <ResponsiveContainer width="100%" height={140}>
                  <ComposedChart data={cycleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis yAxisId="cyc" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis yAxisId="rev" orientation="right" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar yAxisId="cyc" dataKey="cycles" fill={accent} opacity={0.8} name="Cycles" />
                    <Line yAxisId="rev" type="monotone" dataKey="revenue" stroke={green} strokeWidth={2} dot={false} name="Revenue €" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {tab === "Cell Diagnostics" && (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Cell-Level Voltage & Temperature ({bat.cells} cells, {bat.strings} strings)</div>
              <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 12 }}>Each column = 1 cell. Color = voltage deviation from nominal.</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(bat.cells, 24)}, 1fr)`, gap: 2, marginBottom: 16 }}>
                {cellData.slice(0, 24).map(c => {
                  const dev = Math.abs(c.voltage - (bat.voltage / (bat.cells / bat.strings)));
                  const bg = dev < 0.01 ? "#064e3b" : dev < 0.03 ? "#451a03" : "#7f1d1d";
                  const col = dev < 0.01 ? green : dev < 0.03 ? amber : red;
                  return (
                    <div key={c.cell} style={{ background: bg, borderRadius: 3, padding: "6px 2px", textAlign: "center", cursor: "pointer" }}
                      title={`Cell ${c.cell}: ${c.voltage.toFixed(3)}V, ${c.temp.toFixed(1)}°C`}>
                      <div style={{ fontSize: 8, color: col, fontWeight: 700 }}>{c.voltage.toFixed(2)}</div>
                      <div style={{ fontSize: 7, color: "var(--sub)", marginTop: 1 }}>{c.cell}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Cell Statistics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[
                  { l: "Max Voltage", v: `${Math.max(...cellData.map(c => c.voltage)).toFixed(3)}V`, c: red },
                  { l: "Min Voltage", v: `${Math.min(...cellData.map(c => c.voltage)).toFixed(3)}V`, c: green },
                  { l: "Delta V", v: `${(Math.max(...cellData.map(c => c.voltage)) - Math.min(...cellData.map(c => c.voltage))).toFixed(3)}V`, c: amber },
                  { l: "Balancing", v: `${cellData.filter(c => c.balance > 50).length} cells`, c: blue },
                ].map(m => (
                  <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 8, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 4 }}>{m.l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: m.c }}>{m.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "Thermal" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Thermal Heatmap</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 3 }}>
                  {thermalMap.flat().map(c => {
                    const norm = (c.temp - (bat.temp - 6)) / 14;
                    const r = Math.round(norm * 255);
                    const b2 = Math.round((1 - norm) * 100);
                    return (
                      <div key={c.id} style={{
                        height: 28, borderRadius: 3,
                        background: `rgb(${r},${Math.round(b2 * 0.5)},${b2})`,
                        opacity: 0.8, cursor: "pointer"
                      }} title={`${c.temp.toFixed(1)}°C`} />
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: "var(--sub)" }}>
                  <span style={{ color: blue }}>Cool ({(bat.temp - 6).toFixed(0)}°C)</span>
                  <span>Thermal Heatmap</span>
                  <span style={{ color: red }}>Hot ({(bat.temp + 8).toFixed(0)}°C)</span>
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Temperature Over Time</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={socHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={5} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={CHEMISTRIES[bat.chemistry]?.tempMax || 45} stroke={red} strokeDasharray="3 3" label={{ value: "Max", fill: red, fontSize: 10 }} />
                    <Area type="monotone" dataKey="temp" stroke={amber} fill={`${amber}20`} strokeWidth={2} name="°C" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
                  {[
                    { l: "Current", v: `${bat.temp}°C`, c: bat.temp > 38 ? red : green },
                    { l: "Max Allowed", v: `${CHEMISTRIES[bat.chemistry]?.tempMax || 45}°C`, c: amber },
                    { l: "Cooling Status", v: bat.temp > 35 ? "Active" : "Standby", c: bat.temp > 35 ? amber : green },
                  ].map(m => (
                    <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 8, padding: 10, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--sub)" }}>{m.l}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: m.c, marginTop: 4 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "Cycle Analysis" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Cycle History (12 months)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={cycleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cycles" fill={accent} radius={[4, 4, 0, 0]} name="Cycles" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Capacity Fade vs Cycles</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cycleData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="capacity_fade" stroke={amber} fill={`${amber}20`} strokeWidth={2} name="kWh Capacity" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...card, gridColumn: "span 2" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Cycle KPIs</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                  {[
                    { l: "Total Cycles", v: bat.cycles },
                    { l: "Est. Total Life", v: bat.chemistry === "LFP" ? "6000 cyc" : "2000 cyc" },
                    { l: "Life Used", v: `${((bat.cycles / (bat.chemistry === "LFP" ? 6000 : 2000)) * 100).toFixed(1)}%` },
                    { l: "DoD Avg", v: "80%" },
                    { l: "Calendar Age", v: `${new Date().getFullYear() - parseInt(bat.installed.split("-")[0])} yr` },
                  ].map(m => (
                    <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 10, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 4 }}>{m.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "Degradation" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ ...card, gridColumn: "span 2" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>SoH Degradation Forecast by Chemistry</div>
                <p style={{ color: "var(--sub)", fontSize: 12, marginBottom: 12 }}>Projected State of Health over 10 years. EOL at 80% SoH.</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={degradationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: "var(--sub)" }} />
                    <YAxis domain={[65, 100]} tick={{ fontSize: 11, fill: "var(--sub)" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="this_unit" stroke={accent} strokeWidth={3} dot={false} name={`${bat.id} (projected)`} />
                    <Line type="monotone" dataKey="health_lfp" stroke={green} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="LFP Fleet Avg" />
                    <Line type="monotone" dataKey="health_nmc" stroke={amber} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="NMC Fleet Avg" />
                    <Line type="monotone" dataKey="health_lto" stroke={blue} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="LTO Fleet Avg" />
                    <ReferenceLine y={80} stroke={red} strokeDasharray="3 3" label={{ value: "EOL threshold", fill: red, fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Replacement Planning</div>
                {batteries.map(b => {
                  const yearsLeft = Math.max(0, ((b.health - 80) / 3)).toFixed(1);
                  const urgency = yearsLeft < 1 ? red : yearsLeft < 3 ? amber : green;
                  return (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 60, fontSize: 11, fontWeight: 600 }}>{b.id}</div>
                      <div style={{ flex: 1, background: "#1f2937", borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${b.health}%`, height: "100%", background: urgency, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 11, color: urgency, width: 60, textAlign: "right" }}>{yearsLeft}y left</div>
                    </div>
                  );
                })}
              </div>
              <div style={card}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Degradation Factors</div>
                {[
                  { factor: "Calendar Aging", impact: 25, desc: "Time-dependent capacity loss" },
                  { factor: "Cycle Degradation", impact: 40, desc: "Charge/discharge cycles" },
                  { factor: "Temperature Stress", impact: 20, desc: "High-temp operation damage" },
                  { factor: "Over-charge / Over-discharge", impact: 15, desc: "Voltage boundary violations" },
                ].map(f => (
                  <div key={f.factor} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span>{f.factor}</span><span style={{ color: "var(--sub)" }}>{f.impact}%</span>
                    </div>
                    <div style={{ background: "#1f2937", borderRadius: 4, height: 6 }}>
                      <div style={{ width: `${f.impact}%`, height: "100%", background: accent, borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "var(--sub)", marginTop: 2 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "BMS Config" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[
                { title: "Charging Parameters", params: [
                  { l: "Max Charge Current", v: "320 A", editable: true },
                  { l: "CV Voltage", v: `${CHEMISTRIES[bat.chemistry]?.voltMax || 4.2}V/cell`, editable: true },
                  { l: "Charge Cutoff", v: "0.1C", editable: true },
                  { l: "Balancing Mode", v: "Passive Top Balance", editable: false },
                ] },
                { title: "Protection Thresholds", params: [
                  { l: "Over-Voltage Limit", v: `${((CHEMISTRIES[bat.chemistry]?.voltMax || 4.2) + 0.05).toFixed(2)}V`, editable: true },
                  { l: "Under-Voltage Limit", v: `${((CHEMISTRIES[bat.chemistry]?.voltMin || 2.8) - 0.05).toFixed(2)}V`, editable: true },
                  { l: "Over-Temperature", v: `${(CHEMISTRIES[bat.chemistry]?.tempMax || 45)}°C`, editable: true },
                  { l: "Max Discharge Rate", v: "2C", editable: true },
                ] },
                { title: "Dispatch Strategy", params: [
                  { l: "Min SoC Reserve", v: "10%", editable: true },
                  { l: "Max SoC Limit", v: "95%", editable: true },
                  { l: "Dispatch Mode", v: "AI Optimized", editable: false },
                  { l: "Priority", v: "FCR > Arbitrage > DR", editable: false },
                ] },
                { title: "Communication", params: [
                  { l: "Protocol", v: "MODBUS TCP / CAN", editable: false },
                  { l: "BMS IP", v: "192.168.10.1", editable: true },
                  { l: "Heartbeat", v: "1s", editable: true },
                  { l: "Data Log Rate", v: "100ms", editable: false },
                ] },
              ].map(section => (
                <div key={section.title} style={card2}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: accent }}>{section.title}</div>
                  {section.params.map(p => (
                    <div key={p.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12, color: "var(--sub)" }}>{p.l}</span>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{p.v}</span>
                        {p.editable && <button style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "var(--surface2)", border: `1px solid ${accent}`, color: accent, cursor: "pointer" }}>Edit</button>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
