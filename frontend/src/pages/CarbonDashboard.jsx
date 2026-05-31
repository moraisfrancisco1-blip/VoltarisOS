import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from "recharts";
import { C, ChartDefs, PremiumTooltip, axisStyle, gridStyle, glassCard, KpiCard } from "../components/ChartTheme";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const genMonthly = () => MONTHS.map(m => ({
  m,
  avoided: rand(80, 220, 0),
  scope1: rand(2, 12, 1),
  scope2: rand(5, 25, 1),
  scope3: rand(10, 40, 1),
  credits: rand(0, 50, 0),
}));

const SITES_CO2 = [
  { name: "Herdade Solar Norte",    avoided: 142, scope1: 3.2, scope2: 11.4, scope3: 18.0, credits: 12 },
  { name: "Parque BESS Sul",        avoided: 98,  scope1: 1.8, scope2: 8.6,  scope3: 22.4, credits: 8  },
  { name: "Complexo Híbrido Évora", avoided: 218, scope1: 4.1, scope2: 14.2, scope3: 31.0, credits: 24 },
  { name: "Mini-Grid Alentejo",     avoided: 54,  scope1: 0.9, scope2: 4.8,  scope3: 9.2,  credits: 5  },
  { name: "Parque Algarve",         avoided: 176, scope1: 2.6, scope2: 12.0, scope3: 25.5, credits: 18 },
];

const CREDITS = [
  { id: "VCU-2024-001", type: "Solar Generation", qty: 120, price: 28.4, status: "verified", value: 3408 },
  { id: "VCU-2024-002", type: "BESS Arbitrage",   qty: 45,  price: 31.2, status: "pending",  value: 1404 },
  { id: "VCU-2024-003", type: "Grid Avoided",     qty: 88,  price: 26.8, status: "verified", value: 2358 },
  { id: "VCU-2024-004", type: "EV Displacement",  qty: 34,  price: 29.5, status: "retired",  value: 1003 },
];

export default function CarbonDashboard() {
  const [monthly] = useState(genMonthly);
  const [metrics, setMetrics] = useState({ avoided: 688, scope1: 12.6, scope2: 51.0, scope3: 106.1, credits: 67, creditValue: 8173 });
  const [gridIntensity, setGridIntensity] = useState(210);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        avoided:     parseFloat((m.avoided + rand(-2, 3)).toFixed(1)),
        scope1:      parseFloat((m.scope1  + rand(-0.1, 0.1)).toFixed(1)),
        scope2:      parseFloat((m.scope2  + rand(-0.2, 0.2)).toFixed(1)),
        scope3:      parseFloat((m.scope3  + rand(-0.3, 0.3)).toFixed(1)),
        credits:     m.credits,
        creditValue: Math.round(m.creditValue + rand(-20, 30)),
      }));
      setGridIntensity(v => Math.round(Math.max(100, Math.min(350, v + rand(-5, 5)))));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const scopeData = [
    { name: "Scope 1", value: metrics.scope1, fill: C.green,  desc: "Direct emissions" },
    { name: "Scope 2", value: metrics.scope2, fill: C.blue,   desc: "Purchased energy" },
    { name: "Scope 3", value: metrics.scope3, fill: C.purple, desc: "Value chain" },
  ];

  const giColor = gridIntensity < 150 ? C.green : gridIntensity < 250 ? C.amber : C.red;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.8,
            textShadow: `0 0 30px ${C.green}40` }}>Carbon Dashboard</h1>
          <div style={{ color: "rgba(148,163,184,0.6)", fontSize: 13, marginTop: 3 }}>Emissions tracking · Carbon credits · Scope 1/2/3</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "rgba(148,163,184,0.6)" }}>Grid intensity:</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: giColor, textShadow: `0 0 12px ${giColor}60` }}>
            {gridIntensity} gCO₂/kWh
          </div>
          <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20,
            background: `${giColor}15`, color: giColor, border: `1px solid ${giColor}35`,
            boxShadow: `0 0 10px ${giColor}20`, fontWeight: 700 }}>
            {gridIntensity < 150 ? "Very Clean" : gridIntensity < 250 ? "Moderate" : "High Carbon"}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        <KpiCard lbl="CO₂ Avoided YTD" value={`${metrics.avoided} t`}  color={C.green}  icon="🌿" sub="All sites combined" />
        <KpiCard lbl="Scope 1"         value={`${metrics.scope1} t`}   color={C.green}  icon="🏭" sub="Direct emissions" />
        <KpiCard lbl="Scope 2"         value={`${metrics.scope2} t`}   color={C.blue}   icon="⚡" sub="Purchased energy" />
        <KpiCard lbl="Scope 3"         value={`${metrics.scope3} t`}   color={C.purple} icon="🔗" sub="Value chain" />
        <KpiCard lbl="Carbon Credits"  value={`${metrics.credits} tCO₂e`} color={C.amber} icon="🏅" sub={`€${metrics.creditValue.toLocaleString()} portfolio`} />
      </div>

      {/* Monthly trend + scope donut */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>

        <div style={glassCard(C.green)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.green}08, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>
            Monthly CO₂ Avoided vs Emissions
          </div>
          <ResponsiveContainer width="100%" height={210} style={{ position: "relative" }}>
            <ComposedChart data={monthly} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="carb_avoided" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.green} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={C.green} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="m" tick={axisStyle} />
              <YAxis tick={axisStyle} unit=" t" />
              <Tooltip content={<PremiumTooltip unit=" t" />} />
              <Bar dataKey="avoided" fill="url(#carb_avoided)" name="CO₂ Avoided" radius={[5, 5, 0, 0]}
                style={{ filter: `drop-shadow(0 2px 8px ${C.green}40)` }} />
              <Line type="monotone" dataKey="scope1" stroke={C.red}    strokeWidth={2}   dot={false} name="Scope 1" style={{ filter: `drop-shadow(0 0 4px ${C.red}60)` }} />
              <Line type="monotone" dataKey="scope2" stroke={C.blue}   strokeWidth={2}   dot={false} name="Scope 2" />
              <Line type="monotone" dataKey="scope3" stroke={C.purple} strokeWidth={1.5} dot={false} name="Scope 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={glassCard(C.blue)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.blue}08, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>
            Scope Breakdown
          </div>
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <PieChart width={150} height={150}>
              <defs>
                {scopeData.map((s, i) => (
                  <filter key={i} id={`pieGlow_${i}`}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                ))}
              </defs>
              <Pie data={scopeData} cx={70} cy={70} innerRadius={40} outerRadius={62}
                dataKey="value" paddingAngle={4} strokeWidth={0}>
                {scopeData.map((s, i) => (
                  <Cell key={i} fill={s.fill} style={{ filter: `drop-shadow(0 0 6px ${s.fill}80)` }} />
                ))}
              </Pie>
            </PieChart>
            {/* Center label */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>
                {(metrics.scope1 + metrics.scope2 + metrics.scope3).toFixed(0)}
              </div>
              <div style={{ fontSize: 9, color: "rgba(148,163,184,0.6)" }}>tCO₂e</div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
            {scopeData.map(s => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", borderRadius: 8, background: `${s.fill}08`,
                border: `1px solid ${s.fill}20` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.fill,
                    boxShadow: `0 0 6px ${s.fill}` }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{s.name}</div>
                    <div style={{ fontSize: 9, color: "rgba(148,163,184,0.5)" }}>{s.desc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: s.fill,
                  textShadow: `0 0 8px ${s.fill}60` }}>{s.value} t</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-site breakdown */}
      <div style={glassCard(C.purple)}>
        <div style={{ position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${C.purple}06, transparent 70%)`,
          pointerEvents: "none" }} />
        <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>
          Per-Site CO₂ Avoided vs Emissions
        </div>
        <ResponsiveContainer width="100%" height={210} style={{ position: "relative" }}>
          <BarChart data={SITES_CO2} margin={{ left: -10, right: 10 }}>
            <defs>
              {[C.green, C.red, C.blue, C.purple].map((c, i) => (
                <linearGradient key={i} id={`site_g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.4} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="name" tick={axisStyle} tickFormatter={v => v.split(" ").slice(-1)[0]} />
            <YAxis tick={axisStyle} unit=" t" />
            <Tooltip content={<PremiumTooltip unit=" t" />} />
            <Bar dataKey="avoided" fill="url(#site_g0)" name="CO₂ Avoided" radius={[5,5,0,0]}
              style={{ filter: `drop-shadow(0 2px 6px ${C.green}40)` }} />
            <Bar dataKey="scope1"  fill="url(#site_g1)" name="Scope 1"     radius={[5,5,0,0]} />
            <Bar dataKey="scope2"  fill="url(#site_g2)" name="Scope 2"     radius={[5,5,0,0]} />
            <Bar dataKey="scope3"  fill="url(#site_g3)" name="Scope 3"     radius={[5,5,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Credits chart + registry */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        <div style={glassCard(C.amber)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.amber}07, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700, position: "relative" }}>
            Carbon Credits Generated (Monthly)
          </div>
          <ResponsiveContainer width="100%" height={175} style={{ position: "relative" }}>
            <BarChart data={monthly} margin={{ left: -10, right: 10 }}>
              <defs>
                <linearGradient id="cred_grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={C.amber} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={C.amber} stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} />
              <XAxis dataKey="m" tick={axisStyle} />
              <YAxis tick={axisStyle} unit=" t" />
              <Tooltip content={<PremiumTooltip unit=" t" />} />
              <Bar dataKey="credits" fill="url(#cred_grad)" name="Credits" radius={[5,5,0,0]}
                style={{ filter: `drop-shadow(0 2px 8px ${C.amber}40)` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={glassCard(C.green)}>
          <div style={{ position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${C.green}07, transparent 70%)`,
            pointerEvents: "none" }} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700, position: "relative" }}>
            Carbon Credit Registry
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, position: "relative" }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.6)" }}>Portfolio Value</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.green,
                textShadow: `0 0 16px ${C.green}60` }}>€{metrics.creditValue.toLocaleString()}</div>
            </div>
            <button style={{ padding: "7px 16px", background: `${C.green}18`, border: `1px solid ${C.green}40`,
              borderRadius: 10, color: C.green, fontSize: 12, cursor: "pointer", fontWeight: 700,
              boxShadow: `0 0 12px ${C.green}20` }}>Export to Registry</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", position: "relative" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["ID", "Type", "Qty", "Price", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 6px", fontSize: 10,
                    color: "rgba(148,163,184,0.5)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CREDITS.map((c, i) => {
                const sc = c.status === "verified" ? C.green : c.status === "pending" ? C.amber : C.accent;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                    <td style={{ padding: "7px 6px", fontSize: 11, color: C.accent, fontWeight: 700 }}>{c.id}</td>
                    <td style={{ padding: "7px 6px", fontSize: 11, color: "#e2e8f0" }}>{c.type}</td>
                    <td style={{ padding: "7px 6px", fontSize: 11, color: "#e2e8f0" }}>{c.qty}</td>
                    <td style={{ padding: "7px 6px", fontSize: 11, color: C.amber, fontWeight: 700 }}>€{c.price}</td>
                    <td style={{ padding: "7px 6px" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
                        background: `${sc}15`, color: sc, border: `1px solid ${sc}30`,
                        fontWeight: 700 }}>{c.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Impact equivalents */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Cars Off Road / Year",  value: `${Math.round(metrics.avoided / 0.12).toLocaleString()} cars`,  color: C.green,  icon: "🚗", sub: "Based on avg 120g/km/12k km" },
          { label: "Equivalent Trees",       value: `${Math.round(metrics.avoided * 40).toLocaleString()} trees`,  color: C.teal,   icon: "🌳", sub: "25kg CO₂ per tree/year" },
          { label: "Grid Displacement",      value: `${Math.round(metrics.avoided / 0.00021).toLocaleString()} kWh`, color: C.blue,   icon: "⚡", sub: "At avg 210 gCO₂/kWh" },
        ].map(k => (
          <div key={k.label} style={{ ...glassCard(k.color), textAlign: "center" }}>
            <div style={{ position: "absolute", inset: 0,
              background: `radial-gradient(ellipse at 50% 20%, ${k.color}10, transparent 70%)`,
              pointerEvents: "none" }} />
            <div style={{ fontSize: 36, marginBottom: 8, position: "relative" }}>{k.icon}</div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.7)", textTransform: "uppercase",
              letterSpacing: 1, marginBottom: 8, fontWeight: 700, position: "relative" }}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: k.color, position: "relative",
              textShadow: `0 0 16px ${k.color}60` }}>{k.value}</div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.45)", marginTop: 6, position: "relative" }}>{k.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
