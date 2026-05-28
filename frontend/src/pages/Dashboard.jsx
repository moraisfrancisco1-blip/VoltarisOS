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
const val = { fontSize: 26, fontWeight: 700, color: "var(--text)" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  );
};

const SITES = [
  { id: 1, name: "Herdade Solar Norte", soc: 78, solar: 4.2, bess: 2.1, status: "online" },
  { id: 2, name: "Parque BESS Sul", soc: 45, solar: 2.8, bess: 3.4, status: "online" },
  { id: 3, name: "Complexo Híbrido Évora", soc: 91, solar: 6.1, bess: 4.0, status: "warning" },
  { id: 4, name: "Mini-Grid Alentejo", soc: 33, solar: 1.5, bess: 0.9, status: "online" },
  { id: 5, name: "Parque Fotovoltaico Algarve", soc: 62, solar: 5.0, bess: 2.6, status: "offline" },
];

function SoCRing({ soc, size = 60 }) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const fill = (soc / 100) * circ;
  const color = soc > 70 ? green : soc > 40 ? amber : red;
  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill={color} fontSize={12} fontWeight={700}>{soc}%</text>
    </svg>
  );
}

function PowerFlowDiagram({ solar, bess, grid, load }) {
  const nodes = [
    { id: "solar", label: "Solar", value: `${solar} MW`, color: amber, x: 80, y: 60 },
    { id: "bess", label: "BESS", value: `${bess} MW`, color: purple, x: 80, y: 160 },
    { id: "grid", label: "Grid", value: `${grid} MW`, color: blue, x: 80, y: 260 },
    { id: "load", label: "Load", value: `${load} MW`, color: green, x: 260, y: 160 },
  ];
  const flows = [
    { from: [120, 80], to: [260, 160], color: amber },
    { from: [120, 170], to: [260, 170], color: purple },
    { from: [120, 260], to: [260, 180], color: blue },
  ];
  return (
    <svg viewBox="0 0 360 320" style={{ width: "100%", height: 200 }}>
      {flows.map((f, i) => (
        <line key={i} x1={f.from[0]} y1={f.from[1]} x2={f.to[0]} y2={f.to[1]}
          stroke={f.color} strokeWidth={2} strokeDasharray="4 2" opacity={0.7} />
      ))}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x - 40} y={n.y - 20} width={80} height={40} rx={8}
            fill="var(--surface2)" stroke={n.color} strokeWidth={1.5} />
          <text x={n.x} y={n.y - 4} textAnchor="middle" fill={n.color} fontSize={11} fontWeight={700}>{n.label}</text>
          <text x={n.x} y={n.y + 11} textAnchor="middle" fill="var(--text)" fontSize={11}>{n.value}</text>
        </g>
      ))}
    </svg>
  );
}

export default function Dashboard() {
  const genPower = () => Array.from({ length: 24 }, (_, i) => ({
    h: `${i}h`,
    solar: i >= 6 && i <= 20 ? rand(0.5, 8) : 0,
    bess: rand(0.5, 4),
    wind: rand(0.2, 2.5),
    load: rand(3, 9),
  }));

  const [power, setPower] = useState(genPower());
  const [sites, setSites] = useState(SITES.map(s => ({ ...s })));
  const [metrics, setMetrics] = useState({ solar: 14.2, bess: 12.5, revenue: 4820, arbitrage: 340, co2: 8.4 });
  const [arb, setArb] = useState({ buy: 42.1, sell: 87.3, spread: 45.2, signal: "BUY NOW" });
  const [alerts] = useState([
    { id: 1, type: "warning", msg: "Complexo Évora: SoC above 90% — throttle charge", ts: "14:32" },
    { id: 2, type: "info", msg: "Arbitrage window: next peak in 38 min", ts: "14:28" },
    { id: 3, type: "error", msg: "Algarve site offline — check inverter comms", ts: "13:55" },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        solar: parseFloat((m.solar + rand(-0.3, 0.3)).toFixed(1)),
        bess: parseFloat((m.bess + rand(-0.2, 0.2)).toFixed(1)),
        revenue: Math.round(m.revenue + rand(-20, 40)),
        arbitrage: Math.round(m.arbitrage + rand(-5, 10)),
        co2: parseFloat((m.co2 + rand(-0.05, 0.05)).toFixed(2)),
      }));
      setSites(s => s.map(site => ({ ...site, soc: Math.min(100, Math.max(10, site.soc + rand(-2, 2, 0))) })));
      setArb(a => ({
        buy: parseFloat((a.buy + rand(-1, 1)).toFixed(1)),
        sell: parseFloat((a.sell + rand(-1, 1)).toFixed(1)),
        spread: parseFloat((a.sell - a.buy).toFixed(1)),
        signal: a.spread > 40 ? "BUY NOW" : "HOLD",
      }));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const revenueBySource = [
    { name: "Solar PPA", value: rand(1200, 1800, 0), color: amber },
    { name: "BESS Arbitrage", value: rand(800, 1400, 0), color: purple },
    { name: "FCR/aFRR", value: rand(400, 900, 0), color: blue },
    { name: "Capacity Market", value: rand(200, 500, 0), color: green },
  ];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Operations Center</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Live · {new Date().toLocaleString()}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["5 sites", "14.2 MW Solar", "12.5 MWh BESS"].map(t => (
            <span key={t} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "var(--sub)" }}>{t}</span>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Solar Output", value: `${metrics.solar} MW`, delta: "+0.3 MW", color: amber },
          { label: "BESS Dispatched", value: `${metrics.bess} MW`, delta: "discharging", color: purple },
          { label: "Today Revenue", value: `€${metrics.revenue.toLocaleString()}`, delta: "+€340 vs yesterday", color: green },
          { label: "Arbitrage P&L", value: `€${metrics.arbitrage}`, delta: "last 4h", color: blue },
          { label: "CO₂ Avoided", value: `${metrics.co2} t`, delta: "today", color: green },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 4 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Power Flow + Fleet SoC */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Live Power Flow</div>
          <PowerFlowDiagram solar={metrics.solar} bess={metrics.bess} grid={rand(1, 3)} load={rand(8, 14)} />
        </div>
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Fleet BESS State of Charge</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sites.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <SoCRing soc={s.soc} size={52} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--sub)" }}>Solar {s.solar} MW · BESS {s.bess} MW</div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                  background: s.status === "online" ? "#10b98120" : s.status === "warning" ? "#f59e0b20" : "#ef444420",
                  color: s.status === "online" ? green : s.status === "warning" ? amber : red
                }}>{s.status}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 24h Power Chart */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>24h Generation & Load Profile</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={power} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" MW" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="solar" stackId="1" stroke={amber} fill={amber} fillOpacity={0.25} name="Solar" />
            <Area type="monotone" dataKey="bess" stackId="1" stroke={purple} fill={purple} fillOpacity={0.25} name="BESS" />
            <Area type="monotone" dataKey="wind" stackId="1" stroke={blue} fill={blue} fillOpacity={0.2} name="Wind" />
            <Line type="monotone" dataKey="load" stroke={red} strokeWidth={2} dot={false} name="Load" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Arbitrage + Revenue by source + Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {/* Arbitrage */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Arbitrage Signal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>Buy Price (off-peak)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: green }}>€{arb.buy}/MWh</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>Sell Price (peak)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: red }}>€{arb.sell}/MWh</div>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>Spread</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>€{arb.spread}/MWh</div>
              </div>
              <div style={{ padding: "6px 16px", borderRadius: 20, fontWeight: 700, fontSize: 13,
                background: arb.signal === "BUY NOW" ? "#10b98120" : "#f59e0b20",
                color: arb.signal === "BUY NOW" ? green : amber }}>
                {arb.signal}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--sub)" }}>Next peak window: ~38 min · Est. revenue €{Math.round(arb.spread * 4.5)}</div>
          </div>
        </div>

        {/* Revenue by source */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Today Revenue by Source</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueBySource} layout="vertical" margin={{ left: 10, right: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--sub)" }} unit="€" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {revenueBySource.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Live Alerts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                  background: a.type === "error" ? red : a.type === "warning" ? amber : blue }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4 }}>{a.msg}</div>
                  <div style={{ fontSize: 10, color: "var(--sub)" }}>{a.ts}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "var(--sub)", cursor: "pointer" }}>
              View All Alerts
            </button>
          </div>
        </div>
      </div>

      {/* Site health table */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Site Health Summary</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Site", "Status", "Solar MW", "BESS SoC", "BESS MW", "Temp °C", "Last Sync"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, color: "var(--sub)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "8px 10px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12,
                    background: s.status === "online" ? "#10b98120" : s.status === "warning" ? "#f59e0b20" : "#ef444420",
                    color: s.status === "online" ? green : s.status === "warning" ? amber : red }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 13, color: amber }}>{s.solar}</td>
                <td style={{ padding: "8px 10px", fontSize: 13, color: s.soc > 70 ? green : s.soc > 40 ? amber : red }}>{s.soc}%</td>
                <td style={{ padding: "8px 10px", fontSize: 13, color: purple }}>{s.bess}</td>
                <td style={{ padding: "8px 10px", fontSize: 13, color: "var(--text)" }}>{rand(28, 42)}°C</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>Just now</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
