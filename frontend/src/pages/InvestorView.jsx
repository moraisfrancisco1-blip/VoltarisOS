import { useState } from "react";

const accent = "#6366f1";
const card = { background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: 24 };

const LineChart = ({ data, color, height = 90 }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 400, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill={`url(#g-${color})`} points={`0,${h} ${pts.join(" ")} ${w},${h}`} />
      <polyline fill="none" stroke={color} strokeWidth={2.5} points={pts.join(" ")} />
    </svg>
  );
};

const years = [2020, 2021, 2022, 2023, 2024, 2025];

const financialData = {
  revenue: [68000, 82000, 104000, 128000, 149000, 170000],
  opex: [24000, 26000, 28000, 30000, 31000, 32000],
  ebitda: [44000, 56000, 76000, 98000, 118000, 138000],
  cumCashflow: [-350000, -294000, -218000, -120000, -2000, 136000],
};

const sites = [
  {
    name: "Rotterdam", capex: 420000, revYTD: 102000, opex: 19000, roi: 18.2,
    payback: 4.1, irr: 22.5, npv: 185000, co2: 1920, capacity: "500 kW / 1 MWh",
  },
  {
    name: "Rebordelo", capex: 280000, revYTD: 68000, opex: 13000, roi: 15.8,
    payback: 4.9, irr: 18.3, npv: 112000, co2: 1305, capacity: "250 kW / 500 kWh",
  },
];

export default function InvestorView() {
  const [period, setPeriod] = useState("ytd");

  const totalCapex = sites.reduce((a, s) => a + s.capex, 0);
  const totalRevYTD = sites.reduce((a, s) => a + s.revYTD, 0);
  const totalNPV = sites.reduce((a, s) => a + s.npv, 0);
  const avgROI = (sites.reduce((a, s) => a + s.roi, 0) / sites.length).toFixed(1);
  const avgIRR = (sites.reduce((a, s) => a + s.irr, 0) / sites.length).toFixed(1);

  const revGrowth = ((financialData.revenue[5] - financialData.revenue[4]) / financialData.revenue[4] * 100).toFixed(1);

  return (
    <div style={{ padding: 32, color: "#e5e7eb", minHeight: "100vh", background: "#0a0f1a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Investor View</h1>
          <p style={{ color: "#6b7280" }}>Financial performance, ROI, payback, and portfolio overview</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["ytd", "q1", "annual"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              background: period === p ? accent : "#1f2937",
              color: period === p ? "#fff" : "#6b7280",
              border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13,
              textTransform: "uppercase", fontWeight: 500,
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total CapEx Deployed", value: `€${(totalCapex / 1000).toFixed(0)}k`, color: "#e5e7eb", sub: "across 2 sites" },
          { label: "Revenue YTD", value: `€${(totalRevYTD / 1000).toFixed(0)}k`, color: "#10b981", sub: `+${revGrowth}% YoY` },
          { label: "Avg ROI", value: `${avgROI}%`, color: "#f59e0b", sub: "annualized" },
          { label: "Portfolio IRR", value: `${avgIRR}%`, color: accent, sub: "blended" },
          { label: "Total NPV", value: `€${(totalNPV / 1000).toFixed(0)}k`, color: "#60a5fa", sub: "10yr horizon" },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ color: "#6b7280", fontSize: 11, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ color: "#4b5563", fontSize: 11, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue + EBITDA charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Revenue Trend</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>2020–2025 (€)</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>
              €{(financialData.revenue[5] / 1000).toFixed(0)}k
            </div>
          </div>
          <LineChart data={financialData.revenue} color="#10b981" height={90} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginTop: 4 }}>
            {years.map(y => <span key={y}>{y}</span>)}
          </div>
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>EBITDA</div>
              <div style={{ fontSize: 11, color: "#6b7280" }}>2020–2025 (€)</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: accent }}>
              €{(financialData.ebitda[5] / 1000).toFixed(0)}k
            </div>
          </div>
          <LineChart data={financialData.ebitda} color={accent} height={90} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginTop: 4 }}>
            {years.map(y => <span key={y}>{y}</span>)}
          </div>
        </div>
      </div>

      {/* Cumulative cashflow */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Cumulative Cash Flow</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Break-even reached in 2025 · Total portfolio</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>+€136k</div>
        </div>
        <div style={{ position: "relative" }}>
          <LineChart data={financialData.cumCashflow} color="#f59e0b" height={110} />
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${(4 / 5) * 100}%`, width: 1, background: "#10b98166",
            pointerEvents: "none",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4b5563", marginTop: 4 }}>
          {years.map(y => <span key={y}>{y}</span>)}
        </div>
      </div>

      {/* Per-site breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {sites.map(s => (
          <div key={s.name} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{s.capacity}</div>
              </div>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "#064e3b", color: "#10b981" }}>Operating</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "CapEx", val: `€${(s.capex / 1000).toFixed(0)}k` },
                { label: "Revenue YTD", val: `€${(s.revYTD / 1000).toFixed(0)}k`, color: "#10b981" },
                { label: "OpEx YTD", val: `€${(s.opex / 1000).toFixed(0)}k` },
                { label: "ROI", val: `${s.roi}%`, color: "#f59e0b" },
                { label: "Payback", val: `${s.payback} yrs` },
                { label: "IRR", val: `${s.irr}%`, color: accent },
              ].map(m => (
                <div key={m.label} style={{ background: "#0d1117", padding: 12, borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: "#4b5563" }}>{m.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: m.color || "#e5e7eb" }}>{m.val}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, background: "#0d1117", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#6b7280" }}>NPV (10yr)</span>
              <span style={{ color: "#60a5fa", fontWeight: 600 }}>€{s.npv.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 8, background: "#0d1117", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#6b7280" }}>CO₂ Avoided</span>
              <span style={{ color: "#10b981", fontWeight: 600 }}>{s.co2.toLocaleString()} kg/yr</span>
            </div>
          </div>
        ))}
      </div>

      {/* P&L table */}
      <div style={card}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>P&L Summary (€)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "#6b7280", borderBottom: "1px solid #1f2937" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Line Item</th>
              {years.map(y => <th key={y} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {[
              { label: "Revenue", data: financialData.revenue, color: "#10b981" },
              { label: "OpEx", data: financialData.opex, color: "#ef4444" },
              { label: "EBITDA", data: financialData.ebitda, color: accent },
              { label: "Cumulative Cash Flow", data: financialData.cumCashflow, color: "#f59e0b" },
            ].map(row => (
              <tr key={row.label} style={{ borderBottom: "1px solid #0d1117" }}>
                <td style={{ padding: "10px 12px", color: "#9ca3af" }}>{row.label}</td>
                {row.data.map((v, i) => (
                  <td key={i} style={{ padding: "10px 12px", textAlign: "right", color: row.color, fontWeight: 500 }}>
                    {v < 0 ? `-€${Math.abs(v / 1000).toFixed(0)}k` : `€${(v / 1000).toFixed(0)}k`}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
