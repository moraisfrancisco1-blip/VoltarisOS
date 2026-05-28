import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis
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
  { name: "Herdade Solar Norte", avoided: 142, scope1: 3.2, scope2: 11.4, scope3: 18.0, credits: 12 },
  { name: "Parque BESS Sul", avoided: 98, scope1: 1.8, scope2: 8.6, scope3: 22.4, credits: 8 },
  { name: "Complexo Híbrido Évora", avoided: 218, scope1: 4.1, scope2: 14.2, scope3: 31.0, credits: 24 },
  { name: "Mini-Grid Alentejo", avoided: 54, scope1: 0.9, scope2: 4.8, scope3: 9.2, credits: 5 },
  { name: "Parque Algarve", avoided: 176, scope1: 2.6, scope2: 12.0, scope3: 25.5, credits: 18 },
];

const CREDITS = [
  { id: "VCU-2024-001", type: "Solar Generation", qty: 120, price: 28.4, status: "verified", value: 3408 },
  { id: "VCU-2024-002", type: "BESS Arbitrage", qty: 45, price: 31.2, status: "pending", value: 1404 },
  { id: "VCU-2024-003", type: "Grid Avoided", qty: 88, price: 26.8, status: "verified", value: 2358 },
  { id: "VCU-2024-004", type: "EV Displacement", qty: 34, price: 29.5, status: "retired", value: 1003 },
];

export default function CarbonDashboard() {
  const [monthly] = useState(genMonthly());
  const [metrics, setMetrics] = useState({ avoided: 688, scope1: 12.6, scope2: 51.0, scope3: 106.1, credits: 67, creditValue: 8173 });
  const [gridIntensity, setGridIntensity] = useState(210);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        avoided: parseFloat((m.avoided + rand(-2, 3)).toFixed(1)),
        scope1: parseFloat((m.scope1 + rand(-0.1, 0.1)).toFixed(1)),
        scope2: parseFloat((m.scope2 + rand(-0.2, 0.2)).toFixed(1)),
        scope3: parseFloat((m.scope3 + rand(-0.3, 0.3)).toFixed(1)),
        credits: m.credits,
        creditValue: Math.round(m.creditValue + rand(-20, 30)),
      }));
      setGridIntensity(v => Math.round(Math.max(100, Math.min(350, v + rand(-5, 5)))));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const scopeData = [
    { name: "Scope 1", value: metrics.scope1, fill: green, desc: "Direct emissions" },
    { name: "Scope 2", value: metrics.scope2, fill: blue, desc: "Purchased energy" },
    { name: "Scope 3", value: metrics.scope3, fill: purple, desc: "Value chain" },
  ];

  const radarData = SITES_CO2.map(s => ({ site: s.name.split(" ")[0], avoided: s.avoided, scope1: s.scope1 * 10, credits: s.credits * 3 }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Carbon Dashboard</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Emissions tracking · Carbon credits · Scope 1/2/3</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "var(--sub)" }}>Grid intensity:</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: gridIntensity < 150 ? green : gridIntensity < 250 ? amber : red }}>
            {gridIntensity} gCO₂/kWh
          </div>
          <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 12, background: "var(--surface2)", color: "var(--sub)", border: "1px solid var(--border)" }}>
            {gridIntensity < 150 ? "Very Clean" : gridIntensity < 250 ? "Moderate" : "High Carbon"}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "CO₂ Avoided YTD", value: `${metrics.avoided} t`, color: green },
          { label: "Scope 1 Emissions", value: `${metrics.scope1} t`, color: green },
          { label: "Scope 2 Emissions", value: `${metrics.scope2} t`, color: blue },
          { label: "Scope 3 Emissions", value: `${metrics.scope3} t`, color: purple },
          { label: "Carbon Credits", value: `${metrics.credits} tCO₂e`, color: amber },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly trend + scope breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Monthly CO₂ Avoided vs Emissions</div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthly} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" t" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avoided" fill={green} fillOpacity={0.8} name="CO₂ Avoided" radius={[4,4,0,0]} />
              <Line type="monotone" dataKey="scope1" stroke={red} strokeWidth={2} dot={false} name="Scope 1" />
              <Line type="monotone" dataKey="scope2" stroke={blue} strokeWidth={2} dot={false} name="Scope 2" />
              <Line type="monotone" dataKey="scope3" stroke={purple} strokeWidth={2} dot={false} name="Scope 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Scope Breakdown</div>
          <PieChart width={140} height={140} style={{ margin: "0 auto", display: "block" }}>
            <Pie data={scopeData} cx={65} cy={65} innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={3}>
              {scopeData.map((s, i) => <Cell key={i} fill={s.fill} />)}
            </Pie>
          </PieChart>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {scopeData.map(s => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.fill }} />
                  <span style={{ fontSize: 12, color: "var(--sub)" }}>{s.name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.value} t</div>
                  <div style={{ fontSize: 9, color: "var(--sub)" }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-site CO2 breakdown */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Per-Site CO₂ Avoided vs Emissions</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={SITES_CO2} margin={{ left: -10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--sub)" }} tickFormatter={v => v.split(" ").slice(-1)[0]} />
            <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" t" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="avoided" fill={green} fillOpacity={0.8} name="CO₂ Avoided" radius={[4,4,0,0]} />
            <Bar dataKey="scope1" fill={red} fillOpacity={0.6} name="Scope 1" radius={[4,4,0,0]} />
            <Bar dataKey="scope2" fill={blue} fillOpacity={0.6} name="Scope 2" radius={[4,4,0,0]} />
            <Bar dataKey="scope3" fill={purple} fillOpacity={0.6} name="Scope 3" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Avoided vs grid + Carbon credit tracker */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Monthly credits */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Carbon Credits Generated (Monthly)</div>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={monthly} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
              <XAxis dataKey="m" tick={{ fontSize: 10, fill: "var(--sub)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} unit=" t" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="credits" fill={amber} fillOpacity={0.85} name="Credits" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Credit registry */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Carbon Credit Registry</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--sub)" }}>Total Portfolio Value</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: green }}>€{metrics.creditValue.toLocaleString()}</div>
            </div>
            <button style={{ padding: "6px 14px", background: "#10b98120", border: "1px solid #10b981", borderRadius: 8, color: green, fontSize: 12, cursor: "pointer" }}>
              Export to Registry
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["ID", "Type", "Qty (tCO₂e)", "Price", "Status"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 6px", fontSize: 10, color: "var(--sub)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CREDITS.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px", fontSize: 11, color: accent }}>{c.id}</td>
                  <td style={{ padding: "6px", fontSize: 11, color: "var(--text)" }}>{c.type}</td>
                  <td style={{ padding: "6px", fontSize: 11, color: "var(--text)" }}>{c.qty}</td>
                  <td style={{ padding: "6px", fontSize: 11, color: amber }}>€{c.price}</td>
                  <td style={{ padding: "6px" }}>
                    <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 8,
                      background: c.status === "verified" ? "#10b98120" : c.status === "pending" ? "#f59e0b20" : "#6366f120",
                      color: c.status === "verified" ? green : c.status === "pending" ? amber : accent }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avoided emissions vs grid equivalent */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Equivalent Cars Off Road", value: Math.round(metrics.avoided / 0.12) + " cars/year", color: green, icon: "🚗" },
          { label: "Equivalent Trees Planted", value: Math.round(metrics.avoided * 40) + " trees", color: green, icon: "🌳" },
          { label: "Grid Displacement (kWh)", value: Math.round(metrics.avoided / 0.00021).toLocaleString() + " kWh", color: blue, icon: "⚡" },
        ].map(k => (
          <div key={k.label} style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{k.icon}</div>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
