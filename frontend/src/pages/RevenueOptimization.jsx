import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const rand = (min, max, dec = 1) => parseFloat((Math.random() * (max - min) + min).toFixed(dec));
const card = { background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };
const val = { fontSize: 26, fontWeight: 700, color: "#f1f5f9" };

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>)}
    </div>
  );
};

const genForecast = () => Array.from({ length: 24 }, (_, i) => ({
  h: `${i}h`,
  price: rand(40, 120),
  forecast: rand(38, 125),
  lower: rand(30, 70),
  upper: rand(80, 140),
  solar: i >= 7 && i <= 19 ? rand(0, 8) : 0,
  dispatch: rand(0, 4),
}));

const SCENARIOS = [
  { name: "Conservative", revenue: 4200, arbitrage: 820, fcr: 340, risk: "Low", color: blue },
  { name: "Balanced", revenue: 5840, arbitrage: 1420, fcr: 580, risk: "Medium", color: green },
  { name: "Aggressive", revenue: 7200, arbitrage: 2100, fcr: 840, risk: "High", color: amber },
  { name: "Solar Priority", revenue: 4900, arbitrage: 600, fcr: 280, risk: "Low", color: purple },
];

const AI_DISPATCH = [
  { time: "14:00–16:00", action: "Charge BESS", site: "All Sites", volume: "8.4 MWh", reason: "Low price window (€42/MWh)", confidence: 94, revenue: "+€340" },
  { time: "17:00–19:00", action: "Discharge BESS", site: "Herdade Norte", volume: "4.2 MWh", reason: "Peak demand (€118/MWh)", confidence: 88, revenue: "+€496" },
  { time: "18:30–20:00", action: "FCR Bid", site: "Parque BESS Sul", volume: "2.0 MW", reason: "Ancillary signal detected", confidence: 76, revenue: "+€128" },
  { time: "22:00–06:00", action: "Night Arbitrage", site: "Complexo Évora", volume: "6.0 MWh", reason: "Off-peak buy → peak sell", confidence: 82, revenue: "+€210" },
  { time: "09:00–11:00", action: "Solar Self-Cons.", site: "Parque Algarve", volume: "5.1 MWh", reason: "Maximise PPA self-consumption", confidence: 91, revenue: "+€180" },
];

export default function RevenueOptimization() {
  const [forecast] = useState(genForecast());
  const [selectedScenario, setSelectedScenario] = useState("Balanced");
  const [metrics, setMetrics] = useState({ todayRev: 5840, projectedRev: 8420, bestArb: 1420, aiUplift: 620 });
  const [autoDispatch, setAutoDispatch] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        todayRev: Math.round(m.todayRev + rand(-30, 50)),
        projectedRev: Math.round(m.projectedRev + rand(-50, 80)),
        bestArb: Math.round(m.bestArb + rand(-20, 30)),
        aiUplift: Math.round(m.aiUplift + rand(-10, 15)),
      }));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const selected = SCENARIOS.find(s => s.name === selectedScenario);

  const comparisonData = SCENARIOS.map(s => ({
    name: s.name,
    revenue: s.revenue,
    arbitrage: s.arbitrage,
    fcr: s.fcr,
    fill: s.color,
  }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>Revenue Optimization</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 13, marginTop: 2 }}>AI dispatch · Scenario analysis · Price forecast integration</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "rgba(148,163,184,0.85)" }}>Auto-Dispatch</span>
          <div onClick={() => setAutoDispatch(!autoDispatch)} style={{
            width: 40, height: 22, borderRadius: 11, cursor: "pointer",
            background: autoDispatch ? green : "rgba(255,255,255,0.08)", position: "relative"
          }}>
            <div style={{ position: "absolute", width: 16, height: 16, borderRadius: "50%", background: "#fff", top: 3, left: autoDispatch ? 21 : 3, transition: "left 0.2s" }} />
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20,
            background: autoDispatch ? "#10b98120" : "#f59e0b20",
            color: autoDispatch ? green : amber }}>
            {autoDispatch ? "Active" : "Manual"}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Today Revenue", value: `€${metrics.todayRev.toLocaleString()}`, color: green },
          { label: "Projected (EOD)", value: `€${metrics.projectedRev.toLocaleString()}`, color: blue },
          { label: "Best Arb Opportunity", value: `€${metrics.bestArb}`, color: amber },
          { label: "AI Dispatch Uplift", value: `+€${metrics.aiUplift}`, color: purple },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ ...val, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Price forecast + solar */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Price Forecast + Solar Generation + BESS Dispatch Plan</div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={forecast} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="h" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
            <YAxis yAxisId="price" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit=" €" />
            <YAxis yAxisId="power" orientation="right" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit=" MW" />
            <Tooltip content={<CustomTooltip />} />
            <Area yAxisId="price" type="monotone" dataKey="upper" fill={blue} fillOpacity={0.08} stroke="none" name="Upper Bound" />
            <Area yAxisId="price" type="monotone" dataKey="lower" fill="rgba(10,12,24,0.98)" fillOpacity={1} stroke="none" name="Lower Bound" />
            <Line yAxisId="price" type="monotone" dataKey="price" stroke={blue} strokeWidth={2.5} dot={false} name="DA Price" />
            <Line yAxisId="price" type="monotone" dataKey="forecast" stroke={purple} strokeWidth={2} strokeDasharray="4 2" dot={false} name="AI Forecast" />
            <Bar yAxisId="power" dataKey="solar" fill={amber} fillOpacity={0.4} name="Solar (MW)" />
            <Bar yAxisId="power" dataKey="dispatch" fill={green} fillOpacity={0.6} name="BESS Dispatch (MW)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario selector + comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 14 }}>
        {/* Selector */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Scenario Selector</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {SCENARIOS.map(s => (
              <div key={s.name}
                onClick={() => setSelectedScenario(s.name)}
                style={{
                  padding: 14, borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${selectedScenario === s.name ? s.color : "rgba(255,255,255,0.08)"}`,
                  background: selectedScenario === s.name ? `${s.color}12` : "rgba(255,255,255,0.08)",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selectedScenario === s.name ? s.color : "#f1f5f9" }}>{s.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: green }}>€{s.revenue.toLocaleString()}</div>
                </div>
                <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 4 }}>
                  Arbitrage €{s.arbitrage} · FCR €{s.fcr} · Risk:
                  <span style={{ color: s.risk === "Low" ? green : s.risk === "Medium" ? amber : red, marginLeft: 4 }}>{s.risk}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison bar chart */}
        <div style={card}>
          <div style={{ ...label, marginBottom: 12 }}>Scenario Revenue Comparison</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comparisonData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit="€" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Total Revenue" radius={[4, 4, 0, 0]}>
                {comparisonData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
              <Bar dataKey="arbitrage" name="Arbitrage" fill={purple} fillOpacity={0.6} radius={[4,4,0,0]} />
              <Bar dataKey="fcr" name="FCR" fill={blue} fillOpacity={0.6} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 10, padding: 10, background: "rgba(255,255,255,0.08)", borderRadius: 8, border: `1px solid ${selected?.color}` }}>
            <div style={{ fontSize: 12, color: "rgba(148,163,184,0.85)" }}>Active: <b style={{ color: selected?.color }}>{selectedScenario}</b></div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 2 }}>Expected revenue: <b style={{ color: green }}>€{selected?.revenue.toLocaleString()}</b> · Risk: <b style={{ color: selected?.risk === "Low" ? green : selected?.risk === "Medium" ? amber : red }}>{selected?.risk}</b></div>
          </div>
        </div>
      </div>

      {/* AI Dispatch recommendations */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={label}>AI Dispatch Recommendations</div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#6366f120", color: accent }}>
            GPT-4 Powered
          </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Time Window", "Action", "Site", "Volume", "Reason", "Confidence", "Est. Revenue"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "4px 10px", fontSize: 10, color: "rgba(148,163,184,0.85)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AI_DISPATCH.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{d.time}</td>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: accent }}>{d.action}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "#f1f5f9" }}>{d.site}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: amber }}>{d.volume}</td>
                <td style={{ padding: "8px 10px", fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{d.reason}</td>
                <td style={{ padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 40, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
                      <div style={{ width: `${d.confidence}%`, height: "100%", background: d.confidence > 85 ? green : amber, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 11, color: d.confidence > 85 ? green : amber }}>{d.confidence}%</span>
                  </div>
                </td>
                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: green }}>{d.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Apply All Recommendations
          </button>
          <button style={{ padding: "8px 18px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(148,163,184,0.85)", fontSize: 12, cursor: "pointer" }}>
            Review & Modify
          </button>
        </div>
      </div>
    </div>
  );
}
