import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from "recharts";
import { C, ChartDefs, PremiumTooltip, axisStyle, gridStyle, glassCard, KpiCard } from "../components/ChartTheme";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

const SITES = [
  { id: 1, name: "Herdade Solar Norte",        soc: 78, solar: 4.2, bess: 2.1, status: "online"  },
  { id: 2, name: "Parque BESS Sul",             soc: 45, solar: 2.8, bess: 3.4, status: "online"  },
  { id: 3, name: "Complexo Híbrido Évora",      soc: 91, solar: 6.1, bess: 4.0, status: "warning" },
  { id: 4, name: "Mini-Grid Alentejo",          soc: 33, solar: 1.5, bess: 0.9, status: "online"  },
  { id: 5, name: "Parque Fotovoltaico Algarve", soc: 62, solar: 5.0, bess: 2.6, status: "offline" },
];

// ── SoC Ring (3D glow) ────────────────────────────────────────────────────────
function SoCRing({ soc, size = 56 }) {
  const r = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const fill = (soc / 100) * circ;
  const color = soc > 70 ? C.green : soc > 40 ? C.amber : C.red;
  return (
    <svg width={size} height={size} style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <filter id={`soc_glow_${soc}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Track */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      {/* Fill shadow */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={9} opacity={0.1}
        strokeDasharray={`${fill} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round" />
      {/* Fill */}
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5.5}
        strokeDasharray={`${fill} ${circ}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        filter={`url(#soc_glow_${soc})`}
        style={{ transition: "stroke-dasharray 0.6s ease, stroke 0.3s" }} />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill={color} fontSize={10} fontWeight={900}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}>{soc}%</text>
    </svg>
  );
}

// ── Power Flow Diagram (3D depth) ─────────────────────────────────────────────
function PowerFlowDiagram({ solar, bess, grid, load }) {
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDash(d => (d + 2) % 24), 60);
    return () => clearInterval(t);
  }, []);

  const nodes = [
    { id: "solar", label: "Solar",  value: `${solar} MW`, color: C.amber,  x: 70,  y: 55  },
    { id: "bess",  label: "BESS",   value: `${bess} MW`,  color: C.purple, x: 70,  y: 155 },
    { id: "grid",  label: "Grid",   value: `${grid} MW`,  color: C.blue,   x: 70,  y: 255 },
    { id: "load",  label: "Load",   value: `${load} MW`,  color: C.green,  x: 290, y: 155 },
  ];
  const flows = [
    { x1: 118, y1: 67,  x2: 248, y2: 143, color: C.amber,  width: 2.5 },
    { x1: 118, y1: 155, x2: 248, y2: 155, color: C.purple, width: 2.5 },
    { x1: 118, y1: 247, x2: 248, y2: 167, color: C.blue,   width: 2.5 },
  ];

  return (
    <svg viewBox="0 0 380 310" style={{ width: "100%", height: 220 }}>
      <defs>
        <radialGradient id="loadGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.green} stopOpacity={0.2} />
          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
        </radialGradient>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Load ambient glow */}
      <circle cx={290} cy={155} r={50} fill="url(#loadGlow)" />

      {flows.map((f, i) => {
        const mx = (f.x1 + f.x2) / 2;
        const my = (f.y1 + f.y2) / 2;
        return (
          <g key={i}>
            {/* Deep shadow tube */}
            <line x1={f.x1} y1={f.y1+3} x2={f.x2} y2={f.y2+3}
              stroke="#000" strokeWidth={f.width + 4} opacity={0.2} strokeLinecap="round" />
            {/* Glow halo */}
            <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
              stroke={f.color} strokeWidth={f.width + 6} opacity={0.08} strokeLinecap="round" />
            {/* Main line */}
            <line x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2}
              stroke={f.color} strokeWidth={f.width}
              strokeDasharray="10 7" strokeDashoffset={-dash}
              opacity={0.9} strokeLinecap="round" />
            {/* Moving dot */}
            <circle cx={mx} cy={my} r={4} fill={f.color} opacity={0.95}
              style={{ filter: `drop-shadow(0 0 5px ${f.color})` }} />
          </g>
        );
      })}

      {nodes.map(n => (
        <g key={n.id}>
          {/* 3D shadow offset */}
          <rect x={n.x - 39} y={n.y - 20 + 4} width={78} height={44} rx={12} fill="#000" opacity={0.25} />
          {/* Glow halo */}
          <rect x={n.x - 42} y={n.y - 23} width={84} height={50} rx={14} fill={n.color} opacity={0.07} />
          {/* Card body */}
          <rect x={n.x - 40} y={n.y - 21} width={80} height={46} rx={12}
            fill="rgba(15,18,32,0.95)" stroke={n.color} strokeWidth={1.5} />
          {/* Top highlight (3D shine) */}
          <rect x={n.x - 38} y={n.y - 19} width={76} height={3} rx={3}
            fill="rgba(255,255,255,0.08)" />
          <text x={n.x} y={n.y - 4} textAnchor="middle" fill={n.color} fontSize={9.5} fontWeight={800}
            letterSpacing={0.8} style={{ textTransform: "uppercase" }}>{n.label}</text>
          <text x={n.x} y={n.y + 13} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={900}
            style={{ filter: `drop-shadow(0 0 6px ${n.color}80)` }}>{n.value}</text>
        </g>
      ))}
    </svg>
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
    { name: "Solar PPA",       value: rand(1200, 1800, 0), color: C.amber  },
    { name: "BESS Arbitrage",  value: rand(800,  1400, 0), color: C.purple },
    { name: "FCR/aFRR",        value: rand(400,   900, 0), color: C.blue   },
    { name: "Capacity Market", value: rand(200,   500, 0), color: C.green  },
  ];

  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.8,
            textShadow: `0 0 30px ${C.accent}40` }}>Operations Center</h1>
          <div style={{ color: "rgba(148,163,184,0.7)", fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.green,
              boxShadow: `0 0 8px ${C.green}`, animation: "livepin 2s infinite" }} />
            Live · {now}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "5 Sites", color: C.accent },
            { label: "14.2 MW Solar", color: C.amber },
            { label: "12.5 MWh BESS", color: C.purple },
          ].map(({ label: l, color: c }) => (
            <span key={l} style={{
              background: `linear-gradient(135deg, ${c}15, ${c}08)`,
              border: `1px solid ${c}35`, borderRadius: 20,
              padding: "5px 14px", fontSize: 12, color: c, fontWeight: 700,
              boxShadow: `0 2px 8px ${c}20`,
            }}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiCard lbl="Solar Output"    value={`${metrics.solar} MW`}         sub="↑ +0.3 MW vs 1h ago"    color={C.amber}  icon="☀️" />
        <KpiCard lbl="BESS Dispatched" value={`${metrics.bess} MW`}          sub="Discharging"              color={C.purple} icon="🔋" />
        <KpiCard lbl="Today Revenue"   value={`€${metrics.revenue.toLocaleString()}`} sub="↑ +€340 vs yesterday" color={C.green}  icon="💶" />
        <KpiCard lbl="Arbitrage P&L"   value={`€${metrics.arbitrage}`}       sub="Last 4 hours"             color={C.blue}   icon="⚡" />
        <KpiCard lbl="CO₂ Avoided"     value={`${metrics.co2} t`}            sub="Today"                    color={C.teal}   icon="🌿" />
      </div>

      {/* ── Power Flow + Fleet SoC ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Power Flow */}
        <div style={glassCard(C.amber)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 80% 0%, ${C.amber}08 0%, transparent 60%)`,
            pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, position: "relative" }}>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Live Power Flow</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green,
                boxShadow: `0 0 8px ${C.green}`, animation: "livepin 2s infinite" }} />
              <span style={{ fontSize: 10, color: "rgba(148,163,184,0.6)" }}>Live</span>
            </div>
          </div>
          <PowerFlowDiagram solar={metrics.solar} bess={metrics.bess} grid={rand(1, 3)} load={rand(8, 14)} />
        </div>

        {/* Fleet SoC */}
        <div style={glassCard(C.purple)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 80% 0%, ${C.purple}08 0%, transparent 60%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontWeight: 700, position: "relative" }}>Fleet BESS — State of Charge</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
            {sites.map(s => {
              const sc = s.status === "online" ? C.green : s.status === "warning" ? C.amber : C.red;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 10px", borderRadius: 10,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <SoCRing soc={s.soc} size={50} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", marginTop: 2 }}>Solar {s.solar} MW · BESS {s.bess} MW</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                    background: `${sc}15`, color: sc, border: `1px solid ${sc}30`,
                    boxShadow: `0 0 8px ${sc}20`, letterSpacing: 0.5,
                  }}>{s.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 24h Power Chart ── */}
      <div style={glassCard(C.accent)}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${C.accent}08 0%, transparent 70%)`,
          pointerEvents: "none" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, position: "relative" }}>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>24h Generation & Load Profile</div>
          <div style={{ display: "flex", gap: 16 }}>
            {[[C.amber, "Solar"], [C.purple, "BESS"], [C.blue, "Wind"], [C.red, "Load"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 3, borderRadius: 2, background: c, boxShadow: `0 0 6px ${c}` }} />
                <span style={{ fontSize: 11, color: "rgba(148,163,184,0.7)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220} style={{ position: "relative" }}>
          <AreaChart data={power} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
            <ChartDefs />
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="h" tick={axisStyle} />
            <YAxis tick={axisStyle} unit=" MW" />
            <Tooltip content={<PremiumTooltip unit=" MW" />} />
            <Area type="monotone" dataKey="wind"  stackId="1" stroke={C.blue}   fill="url(#grad_wind)"  strokeWidth={0}   name="Wind" />
            <Area type="monotone" dataKey="bess"  stackId="1" stroke={C.purple} fill="url(#grad_bess)"  strokeWidth={0}   name="BESS" />
            <Area type="monotone" dataKey="solar" stackId="1" stroke={C.amber}  fill="url(#grad_solar)" strokeWidth={0}   name="Solar" />
            {/* Stroke lines on top */}
            <Area type="monotone" dataKey="wind"  stackId="2" stroke={C.blue}   fill="none" strokeWidth={1.5} name="Wind"  dot={false} />
            <Area type="monotone" dataKey="bess"  stackId="2" stroke={C.purple} fill="none" strokeWidth={1.5} name="BESS"  dot={false} />
            <Area type="monotone" dataKey="solar" stackId="2" stroke={C.amber}  fill="none" strokeWidth={2}   name="Solar" dot={false} />
            <Line  type="monotone" dataKey="load"  stroke={C.red}    strokeWidth={2.5} dot={false} name="Load"
              style={{ filter: `drop-shadow(0 0 4px ${C.red}80)` }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        {/* Arbitrage Signal */}
        <div style={glassCard(C.green)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.green}10 0%, transparent 60%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>Arbitrage Signal</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, position: "relative" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", marginBottom: 3 }}>Buy (off-peak)</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.green, fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 16px ${C.green}60` }}>€{arb.buy}</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>per MWh</div>
            </div>
            <div style={{ alignSelf: "center", fontSize: 22, color: "rgba(255,255,255,0.2)",
              textShadow: "0 0 10px rgba(255,255,255,0.1)" }}>→</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)", marginBottom: 3 }}>Sell (peak)</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: C.red, fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 16px ${C.red}60` }}>€{arb.sell}</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)" }}>per MWh</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12, position: "relative",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.6)" }}>Spread</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>€{arb.spread}/MWh</div>
            </div>
            <div style={{
              padding: "7px 20px", borderRadius: 22, fontWeight: 900, fontSize: 12,
              background: arb.signal === "BUY NOW" ? `${C.green}20` : `${C.amber}18`,
              color:      arb.signal === "BUY NOW" ? C.green : C.amber,
              border:     `1px solid ${arb.signal === "BUY NOW" ? C.green : C.amber}40`,
              boxShadow:  `0 0 16px ${arb.signal === "BUY NOW" ? C.green : C.amber}25`,
              letterSpacing: 1,
            }}>{arb.signal}</div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.5)", marginTop: 10, position: "relative" }}>
            Next peak ~38 min · Est. +€{Math.round(arb.spread * 4.5)}
          </div>
        </div>

        {/* Revenue by source */}
        <div style={glassCard(C.purple)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.purple}08 0%, transparent 60%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>Today Revenue by Source</div>
          <ResponsiveContainer width="100%" height={175} style={{ position: "relative" }}>
            <BarChart data={revenueBySource} layout="vertical" margin={{ left: 0, right: 14 }}>
              <defs>
                {revenueBySource.map((r, i) => (
                  <linearGradient key={i} id={`rev_grad_${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={r.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={r.color} stopOpacity={0.5} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis type="number" tick={axisStyle} unit="€" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
              <Tooltip content={<PremiumTooltip unit="€" />} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={22}>
                {revenueBySource.map((r, i) => (
                  <Cell key={i} fill={`url(#rev_grad_${i})`}
                    style={{ filter: `drop-shadow(0 2px 6px ${r.color}50)` }} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live Alerts */}
        <div style={glassCard(C.red)}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.red}08 0%, transparent 60%)`,
            pointerEvents: "none" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, position: "relative" }}>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Live Alerts</div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 10px", borderRadius: 12,
              background: `${C.red}20`, color: C.red, border: `1px solid ${C.red}30`,
              boxShadow: `0 0 10px ${C.red}20` }}>
              {alerts.filter(a => a.type === "error").length} critical
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {alerts.map(a => {
              const c = a.type === "error" ? C.red : a.type === "warning" ? C.amber : C.blue;
              return (
                <div key={a.id} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)"
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 3, flexShrink: 0,
                    background: c, boxShadow: `0 0 8px ${c}, 0 0 3px ${c}`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.45 }}>{a.msg}</div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", marginTop: 2 }}>{a.ts}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, textAlign: "center", position: "relative" }}>
            <button style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "7px 18px", fontSize: 12, color: "rgba(148,163,184,0.7)",
              cursor: "pointer", transition: "all 0.2s",
            }}>View All Alerts</button>
          </div>
        </div>
      </div>

      {/* ── Site Health Table ── */}
      <div style={glassCard(C.blue)}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${C.blue}06 0%, transparent 60%)`,
          pointerEvents: "none" }} />
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontWeight: 700, position: "relative" }}>Site Health Summary</div>
        <table style={{ width: "100%", borderCollapse: "collapse", position: "relative" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["Site", "Status", "Solar MW", "BESS SoC", "BESS MW", "Temp °C", "Last Sync"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 12px", fontSize: 10,
                  color: "rgba(148,163,184,0.5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map((s, i) => {
              const sc = s.status === "online" ? C.green : s.status === "warning" ? C.amber : C.red;
              const soc = s.soc > 70 ? C.green : s.soc > 40 ? C.amber : C.red;
              return (
                <tr key={s.id} style={{
                  borderBottom: "1px solid rgba(255,255,255,0.03)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  transition: "background 0.15s",
                }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{s.name}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                      background: `${sc}15`, color: sc, border: `1px solid ${sc}30`,
                      boxShadow: `0 0 8px ${sc}15` }}>{s.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: C.amber, fontWeight: 700,
                    textShadow: `0 0 8px ${C.amber}40` }}>{s.solar}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: soc, fontWeight: 900,
                    textShadow: `0 0 8px ${soc}40` }}>{s.soc}%</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: C.purple }}>{s.bess}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#e2e8f0" }}>{rand(28, 42)}°C</td>
                  <td style={{ padding: "10px 12px", fontSize: 11, color: "rgba(148,163,184,0.5)" }}>Just now</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes livepin {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
