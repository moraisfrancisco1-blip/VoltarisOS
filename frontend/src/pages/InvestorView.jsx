import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const val = { fontSize: 26, fontWeight: 700, color: "var(--text)" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const YEARS = ["2022","2023","2024","2025E","2026E","2027E","2028E","2029E","2030E"];
const genRevenue = () => YEARS.map((y, i) => ({
  y,
  solar_ppa: Math.round(800 + i * 120 + rand(-50, 50)),
  bess_arb: Math.round(200 + i * 80 + rand(-30, 30)),
  fcr: Math.round(100 + i * 40 + rand(-20, 20)),
  capex: i < 3 ? Math.round(1200 - i * 150) : 0,
  opex: Math.round(300 + i * 15),
}));

const SITES_FIN = [
  { name: "Herdade Solar Norte", capex: 8200, irr: 14.2, npv: 3840, dscr: 1.42, payback: 7.2, bessAge: 2.1, bessRemain: 67 },
  { name: "Parque BESS Sul", capex: 4500, irr: 18.6, npv: 2100, dscr: 1.68, payback: 5.8, bessAge: 1.5, bessRemain: 78 },
  { name: "Complexo Híbrido Évora", capex: 12400, irr: 16.1, npv: 5820, dscr: 1.55, payback: 6.4, bessAge: 0.8, bessRemain: 89 },
  { name: "Mini-Grid Alentejo", capex: 2100, irr: 22.4, npv: 980, dscr: 1.88, payback: 4.9, bessAge: 3.2, bessRemain: 52 },
  { name: "Parque Algarve", capex: 9800, irr: 13.8, npv: 4200, dscr: 1.38, payback: 7.8, bessAge: 1.9, bessRemain: 72 },
];

const WATERFALL = [
  { name: "Solar PPA", value: 1840, type: "positive" },
  { name: "BESS Arbitrage", value: 920, type: "positive" },
  { name: "FCR/aFRR", value: 480, type: "positive" },
  { name: "Capacity Market", value: 260, type: "positive" },
  { name: "O&M Costs", value: -340, type: "negative" },
  { name: "BESS Degradation", value: -180, type: "negative" },
  { name: "Financing", value: -420, type: "negative" },
  { name: "Net Revenue", value: 2560, type: "total" },
];

export default function InvestorView() {
  const [revenue] = useState(genRevenue());
  const [metrics, setMetrics] = useState({ totalCapex: 37000, portfolioIRR: 16.8, portfolioNPV: 16940, dscr: 1.58, payback: 6.4 });

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        ...m,
        portfolioIRR: parseFloat((m.portfolioIRR + rand(-0.1, 0.1)).toFixed(1)),
        portfolioNPV: Math.round(m.portfolioNPV + rand(-50, 50)),
      }));
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const wfData = (() => {
    let running = 0;
    return WATERFALL.map(w => {
      const base = w.type === "total" ? 0 : running;
      if (w.type !== "total") running += w.value;
      return { ...w, base, abs: Math.abs(w.value) };
    });
  })();

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Investor View</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 13, marginTop: 2 }}>Portfolio financials · IRR/NPV · BESS degradation · Revenue waterfall</div>
        </div>
        <button style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Export Report
        </button>
      </div>

      {/* Portfolio KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {[
          { label: "Total CapEx", value: `€${(metrics.totalCapex / 1000).toFixed(1)}M`, color: "var(--text)" },
          { label: "Portfolio IRR", value: `${metrics.portfolioIRR}%`, color: green },
          { label: "Portfolio NPV", value: `€${(metrics.portfolioNPV / 1000).toFixed(1)}M`, color: green },
          { label: "Avg DSCR", value: `${metrics.dscr}x`, color: blue },
          { label: "Avg Payback", value: `${metrics.payback} yrs`, color: amber },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Revenue projection */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Revenue Projection by Source (€k/year)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenue} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
            <XAxis dataKey="y" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
            <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit="k€" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="solar_ppa" stackId="a" fill={amber} name="Solar PPA" />
            <Bar dataKey="bess_arb" stackId="a" fill={purple} name="BESS Arbitrage" />
            <Bar dataKey="fcr" stackId="a" fill={blue} name="FCR/aFRR" radius={[4,4,0,0]} />
            <Line type="monotone" dataKey="opex" stroke={red} strokeWidth={2} dot={false} name="OpEx" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue Waterfall + Per-site table */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 14 }}>
        {/* Waterfall */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Revenue Waterfall (Annual €k)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {WATERFALL.map((w, i) => (
              <div key={w.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 110, fontSize: 11, color: "rgba(148,163,184,0.85)", textAlign: "right" }}>{w.name}</div>
                <div style={{ flex: 1, height: 22, position: "relative" }}>
                  <div style={{
                    position: "absolute",
                    left: w.type === "total" ? 0 : `${Math.max(0, wfData[i].base / 40)}%`,
                    width: `${Math.abs(w.value) / 40}%`,
                    maxWidth: "100%",
                    height: "100%",
                    borderRadius: 4,
                    background: w.type === "total" ? accent : w.value > 0 ? green : red,
                    opacity: 0.85,
                  }} />
                </div>
                <div style={{ width: 60, fontSize: 12, fontWeight: 600, textAlign: "right",
                  color: w.type === "total" ? accent : w.value > 0 ? green : red }}>
                  {w.value > 0 ? "+" : ""}€{w.value}k
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Per-site IRR/NPV */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 10 }}>Per-Site Financials</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                {["Site", "CapEx (€k)", "IRR", "NPV (€k)", "DSCR", "Payback"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 8px", fontSize: 10, color: "rgba(148,163,184,0.85)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SITES_FIN.map(s => (
                <tr key={s.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <td style={{ padding: "7px 8px", fontSize: 11, fontWeight: 600, color: "var(--text)" }}>{s.name.split(" ").slice(-2).join(" ")}</td>
                  <td style={{ padding: "7px 8px", fontSize: 11, color: "var(--text)" }}>€{s.capex.toLocaleString()}</td>
                  <td style={{ padding: "7px 8px", fontSize: 12, fontWeight: 700, color: s.irr > 16 ? green : amber }}>{s.irr}%</td>
                  <td style={{ padding: "7px 8px", fontSize: 11, color: green }}>€{s.npv.toLocaleString()}</td>
                  <td style={{ padding: "7px 8px", fontSize: 12, fontWeight: 700, color: s.dscr >= 1.5 ? green : amber }}>{s.dscr}x</td>
                  <td style={{ padding: "7px 8px", fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{s.payback}y</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BESS Degradation model */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>BESS Degradation & Replacement Cost Model</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {SITES_FIN.map(s => (
            <div key={s.name} style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{s.name.split(" ").slice(-2).join(" ")}</div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>Capacity Remaining</div>
              <div style={{ height: 6, background: "var(--surface2)", borderRadius: 3, marginBottom: 4 }}>
                <div style={{ width: `${s.bessRemain}%`, height: "100%", background: s.bessRemain > 70 ? green : s.bessRemain > 50 ? amber : red, borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: s.bessRemain > 70 ? green : s.bessRemain > 50 ? amber : red }}>{s.bessRemain}%</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", marginTop: 6 }}>Age: {s.bessAge} yrs</div>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)" }}>
                Replace in ~{Math.round((s.bessRemain - 60) / 3)} yrs
              </div>
              <div style={{ fontSize: 11, color: red, marginTop: 4, fontWeight: 600 }}>
                Cost: €{Math.round(s.capex * 0.18 * (1 - s.bessRemain / 100) + rand(50, 200))}k
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cumulative cash flow */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Cumulative Cash Flow Projection (€k)</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={revenue.map((r, i) => ({
              y: r.y,
              cumulative: YEARS.slice(0, i + 1).reduce((acc, _, j) => {
                const rv = revenue[j];
                return acc + (rv.solar_ppa + rv.bess_arb + rv.fcr) - rv.opex - (j === 0 ? 12000 : 0);
              }, 0),
            }))}
            margin={{ top: 5, right: 10, bottom: 0, left: -10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface2)" />
            <XAxis dataKey="y" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
            <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit="k€" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cumulative" stroke={accent} fill={accent} fillOpacity={0.2} name="Cumulative CF" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
