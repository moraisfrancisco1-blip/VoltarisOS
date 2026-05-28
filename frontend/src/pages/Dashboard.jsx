import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 22,
  position: "relative",
  overflow: "hidden",
};

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(8px)" }}>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 5 }}>{lb}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span><b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

const SITES = [
  { id: 1, name: "Herdade Solar Norte",       soc: 78, solar: 4.2, bess: 2.1, status: "online"  },
  { id: 2, name: "Parque BESS Sul",            soc: 45, solar: 2.8, bess: 3.4, status: "online"  },
  { id: 3, name: "Complexo Híbrido Évora",     soc: 91, solar: 6.1, bess: 4.0, status: "warning" },
  { id: 4, name: "Mini-Grid Alentejo",         soc: 33, solar: 1.5, bess: 0.9, status: "online"  },
  { id: 5, name: "Parque Fotovoltaico Algarve",soc: 62, solar: 5.0, bess: 2.6, status: "offline" },
];

// ── SoC Ring ─────────────────────────────────────────────────────────────────
function SoCRing({ soc, size = 56 }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const fill = (soc / 100) * circ;
  const color = soc > 70 ? green : soc > 40 ? amber : red;
  return (
    <svg width={size} height={size} style={{ display: "block", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={5.5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5.5}
        strokeDasharray={`${fill} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease, stroke 0.3s" }} />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill={color} fontSize={11} fontWeight={800}>{soc}%</text>
    </svg>
  );
}

// ── Premium Power Flow ────────────────────────────────────────────────────────
function PowerFlowDiagram({ solar, bess, grid, load }) {
  const ref = useRef(0);
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDash(d => (d + 2) % 20), 80);
    return () => clearInterval(t);
  }, []);

  const nodes = [
    { id: "solar", label: "Solar",  value: `${solar} MW`, color: amber,  x: 60,  y: 60  },
    { id: "bess",  label: "BESS",   value: `${bess} MW`,  color: purple, x: 60,  y: 160 },
    { id: "grid",  label: "Grid",   value: `${grid} MW`,  color: blue,   x: 60,  y: 260 },
    { id: "load",  label: "Load",   value: `${load} MW`,  color: green,  x: 280, y: 160 },
  ];
  const flows = [
    { x1: 108, y1: 72,  x2: 240, y2: 148, color: amber  },
    { x1: 108, y1: 160, x2: 240, y2: 160, color: purple },
    { x1: 108, y1: 252, x2: 240, y2: 172, color: blue   },
  ];

  return (
    <svg viewBox="0 0 360 320" style={{ width: "100%", height: 220 }}>
      {/* glow behind load node */}
      <circle cx={280} cy={160} r={34} fill={green} opacity={0.06} />

      {flows.map((f, i) => (
        <g key={i}>
          {/* shadow line */}
          <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.color} strokeWidth={4} opacity={0.08} />
          {/* animated dashed line */}
          <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
            stroke={f.color} strokeWidth={2}
            strokeDasharray="8 6" strokeDashoffset={-dash}
            opacity={0.8} />
          {/* arrow head */}
          <circle cx={f.x2 - (f.x2 - f.x1) * 0.12} cy={f.y2 - (f.y2 - f.y1) * 0.12} r={3} fill={f.color} opacity={0.9} />
        </g>
      ))}

      {nodes.map(n => (
        <g key={n.id}>
          {/* node glow */}
          <rect x={n.x - 42} y={n.y - 24} width={84} height={48} rx={12} fill={n.color} opacity={0.05} />
          {/* node border */}
          <rect x={n.x - 40} y={n.y - 22} width={80} height={44} rx={10} fill="var(--surface2)" stroke={n.color} strokeWidth={1.5} />
          <text x={n.x} y={n.y - 5} textAnchor="middle" fill={n.color} fontSize={10} fontWeight={700} letterSpacing={0.5}>{n.label}</text>
          <text x={n.x} y={n.y + 12} textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight={700}>{n.value}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Animated KPI number ───────────────────────────────────────────────────────
function AnimKPI({ value, color, label: lbl, sub, accentColor }) {
  return (
    <div style={{
      ...card,
      borderTop: `3px solid ${accentColor}50`,
      background: `linear-gradient(160deg, var(--surface), var(--surface))`,
    }}>
      <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{lbl}</div>
      <div style={{
        fontSize: 28, fontWeight: 800, color: accentColor, lineHeight: 1,
        fontVariantNumeric: "tabular-nums", transition: "color 0.3s"
      }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const genPower = () => Array.from({ length: 24 }, (_, i) => ({
    h: `${i}h`,
    solar: i >= 6 && i <= 20 ? rand(0.5, 8) : 0,
    bess:  rand(0.5, 4),
    wind:  rand(0.2, 2.5),
    load:  rand(3, 9),
  }));

  const [power,   setPower]   = useState(genPower);
  const [sites,   setSites]   = useState(() => SITES.map(s => ({ ...s })));
  const [metrics, setMetrics] = useState({ solar: 14.2, bess: 12.5, revenue: 4820, arbitrage: 340, co2: 8.4 });
  const [arb,     setArb]     = useState({ buy: 42.1, sell: 87.3, spread: 45.2, signal: "BUY NOW" });
  const [tick,    setTick]    = useState(0);
  const [alerts]              = useState([
    { id: 1, type: "warning", msg: "Complexo Évora: SoC above 90% — throttle charge",   ts: "14:32" },
    { id: 2, type: "info",    msg: "Arbitrage window: next peak in 38 min",               ts: "14:28" },
    { id: 3, type: "error",   msg: "Algarve site offline — check inverter comms",        ts: "13:55" },
  ]);

  useEffect(() => {
    const t = setInterval(() => {
      setTick(x => x + 1);
      setMetrics(m => ({
        solar:     parseFloat((m.solar     + rand(-0.3,  0.3 )).toFixed(1)),
        bess:      parseFloat((m.bess      + rand(-0.2,  0.2 )).toFixed(1)),
        revenue:   Math.round(m.revenue   + rand(-20,   40   )),
        arbitrage: Math.round(m.arbitrage + rand(-5,    10   )),
        co2:       parseFloat((m.co2       + rand(-0.05, 0.05)).toFixed(2)),
      }));
      setSites(s => s.map(site => ({ ...site, soc: Math.min(100, Math.max(10, site.soc + rand(-2, 2, 0))) })));
      setArb(a => {
        const b = parseFloat((a.buy  + rand(-1, 1)).toFixed(1));
        const s = parseFloat((a.sell + rand(-1, 1)).toFixed(1));
        const sp = parseFloat((s - b).toFixed(1));
        return { buy: b, sell: s, spread: sp, signal: sp > 40 ? "BUY NOW" : "HOLD" };
      });
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const revenueBySource = [
    { name: "Solar PPA",       value: rand(1200, 1800, 0), color: amber  },
    { name: "BESS Arbitrage",  value: rand(800,  1400, 0), color: purple },
    { name: "FCR/aFRR",        value: rand(400,   900, 0), color: blue   },
    { name: "Capacity Market", value: rand(200,   500, 0), color: green  },
  ];

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: -0.5 }}>Operations Center</h1>
          <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 3, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: green, animation: "livepin 2s infinite" }} />
            Live · {now}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "5 Sites", color: accent },
            { label: "14.2 MW Solar", color: amber },
            { label: "12.5 MWh BESS", color: purple },
          ].map(({ label: l, color: c }) => (
            <span key={l} style={{
              background: `${c}10`,
              border: `1px solid ${c}30`,
              borderRadius: 20, padding: "4px 14px",
              fontSize: 12, color: c, fontWeight: 600
            }}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <AnimKPI lbl="Solar Output"    value={`${metrics.solar} MW`}         sub="+0.3 MW vs 1h ago"        accentColor={amber}  />
        <AnimKPI lbl="BESS Dispatched" value={`${metrics.bess} MW`}          sub="discharging"              accentColor={purple} />
        <AnimKPI lbl="Today Revenue"   value={`€${metrics.revenue.toLocaleString()}`} sub="+€340 vs yesterday" accentColor={green}  />
        <AnimKPI lbl="Arbitrage P&L"   value={`€${metrics.arbitrage}`}        sub="last 4 hours"             accentColor={blue}   />
        <AnimKPI lbl="CO₂ Avoided"     value={`${metrics.co2} t`}            sub="today"                    accentColor={green}  />
      </div>

      {/* ── Power Flow + Fleet SoC ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Power Flow */}
        <div style={{ ...card, borderTop: `3px solid ${amber}40` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1 }}>Live Power Flow</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: green, animation: "livepin 2s infinite" }} />
              <span style={{ fontSize: 10, color: "var(--sub)" }}>Animated</span>
            </div>
          </div>
          <PowerFlowDiagram solar={metrics.solar} bess={metrics.bess} grid={rand(1, 3)} load={rand(8, 14)} />
        </div>

        {/* Fleet SoC */}
        <div style={{ ...card, borderTop: `3px solid ${purple}40` }}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Fleet BESS — State of Charge</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {sites.map(s => {
              const socColor = s.soc > 70 ? green : s.soc > 40 ? amber : red;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <SoCRing soc={s.soc} size={52} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 1 }}>Solar {s.solar} MW · BESS {s.bess} MW</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 11px", borderRadius: 20,
                    background: s.status === "online" ? "#10b98118" : s.status === "warning" ? "#f59e0b18" : "#ef444418",
                    color:      s.status === "online" ? green        : s.status === "warning" ? amber        : red,
                    border:     `1px solid ${s.status === "online" ? green : s.status === "warning" ? amber : red}30`,
                  }}>{s.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 24h Power Chart ── */}
      <div style={{ ...card, borderTop: `3px solid ${accent}40` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1 }}>24h Generation & Load Profile</div>
          <div style={{ display: "flex", gap: 14 }}>
            {[[amber, "Solar"], [purple, "BESS"], [blue, "Wind"], [red, "Load"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 11, color: "var(--sub)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={power} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <defs>
              {[[amber, "solar"], [purple, "bess"], [blue, "wind"]].map(([c, id]) => (
                <linearGradient key={id} id={`g_${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={c} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={c} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" MW" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="solar" stackId="1" stroke={amber}  fill={`url(#g_solar)`} strokeWidth={1.5} name="Solar" />
            <Area type="monotone" dataKey="bess"  stackId="1" stroke={purple} fill={`url(#g_bess)`}  strokeWidth={1.5} name="BESS" />
            <Area type="monotone" dataKey="wind"  stackId="1" stroke={blue}   fill={`url(#g_wind)`}  strokeWidth={1.5} name="Wind" />
            <Line  type="monotone" dataKey="load" stroke={red} strokeWidth={2.5} dot={false} name="Load" strokeDasharray="0" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom row: Arbitrage + Revenue + Alerts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        {/* Arbitrage */}
        <div style={{ ...card, borderTop: `3px solid ${green}40` }}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Arbitrage Signal</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 2 }}>Buy (off-peak)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: green, fontVariantNumeric: "tabular-nums" }}>€{arb.buy}</div>
              <div style={{ fontSize: 10, color: "var(--sub)" }}>per MWh</div>
            </div>
            <div style={{ alignSelf: "center", fontSize: 20, color: "var(--border)" }}>→</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 2 }}>Sell (peak)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: red, fontVariantNumeric: "tabular-nums" }}>€{arb.sell}</div>
              <div style={{ fontSize: 10, color: "var(--sub)" }}>per MWh</div>
            </div>
          </div>
          <div style={{
            borderTop: "1px solid var(--border)", paddingTop: 12,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--sub)" }}>Spread</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>€{arb.spread}/MWh</div>
            </div>
            <div style={{
              padding: "7px 18px", borderRadius: 22, fontWeight: 800, fontSize: 13,
              background: arb.signal === "BUY NOW" ? "#10b98120" : "#f59e0b18",
              color:      arb.signal === "BUY NOW" ? green : amber,
              border:     `1px solid ${arb.signal === "BUY NOW" ? green : amber}40`,
              letterSpacing: 0.5,
            }}>{arb.signal}</div>
          </div>
          <div style={{ fontSize: 11, color: "var(--sub)", marginTop: 10 }}>
            Next peak ~38 min · Est. +€{Math.round(arb.spread * 4.5)}
          </div>
        </div>

        {/* Revenue by source */}
        <div style={{ ...card, borderTop: `3px solid ${purple}40` }}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Today Revenue by Source</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={revenueBySource} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--sub)" }} unit="€" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} width={100} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={22}>
                {revenueBySource.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live Alerts */}
        <div style={{ ...card, borderTop: `3px solid ${red}40` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1 }}>Live Alerts</div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 12,
              background: "#ef444420", color: red
            }}>{alerts.filter(a => a.type === "error").length} critical</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {alerts.map(a => {
              const c = a.type === "error" ? red : a.type === "warning" ? amber : blue;
              return (
                <div key={a.id} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 0", borderBottom: "1px solid var(--border)"
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 3, flexShrink: 0,
                    background: c,
                    boxShadow: a.type === "error" ? `0 0 0 3px ${c}25` : "none",
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.45 }}>{a.msg}</div>
                    <div style={{ fontSize: 10, color: "var(--sub)", marginTop: 2 }}>{a.ts}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 10,
              padding: "7px 18px", fontSize: 12, color: "var(--sub)", cursor: "pointer",
            }}>View All Alerts</button>
          </div>
        </div>
      </div>

      {/* ── Site Health Table ── */}
      <div style={{ ...card, borderTop: `3px solid ${blue}40` }}>
        <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Site Health Summary</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Site", "Status", "Solar MW", "BESS SoC", "BESS MW", "Temp °C", "Last Sync"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10, color: "var(--sub)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s, i) => {
              const statusColor = s.status === "online" ? green : s.status === "warning" ? amber : red;
              const socColor    = s.soc > 70 ? green : s.soc > 40 ? amber : red;
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface2)" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`
                    }}>{s.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: amber, fontWeight: 600 }}>{s.solar}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: socColor, fontWeight: 700 }}>{s.soc}%</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: purple }}>{s.bess}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--text)" }}>{rand(28, 42)}°C</td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--sub)" }}>Just now</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes livepin {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 ${green}60; }
          50%       { opacity: 0.7; box-shadow: 0 0 0 5px transparent; }
        }
      `}</style>
    </div>
  );
}
