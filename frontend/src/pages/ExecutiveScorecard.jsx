import { useState, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine
} from "recharts"

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b"
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa"

const rand = (min, max, dec = 1) => +(Math.random() * (max - min) + min).toFixed(dec)

const card = {
  background: "#1e293b",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: 20,
  position: "relative",
  overflow: "hidden",
}
const label = { fontSize: 11, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }

const CustomTooltip = ({ active, payload, label: lb }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{lb}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 12, color: p.color }}>{p.name}: <b>{p.value}</b></div>
      ))}
    </div>
  )
}

// ── Fleet health score ring ──────────────────────────────────────────────────
function HealthRing({ score, size = 140 }) {
  const r = 52, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const arc = (score / 100) * circ * 0.75
  const color = score > 80 ? green : score > 60 ? amber : red
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.6} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={10}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={26} fontWeight={800}>{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(148,163,184,0.85)" fontSize={10} fontWeight={600}>FLEET HEALTH</text>
    </svg>
  )
}

// ── Revenue gauge ────────────────────────────────────────────────────────────
function RevenueGauge({ pct, size = 140 }) {
  const r = 52, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const arc = Math.min(pct / 100, 1) * circ * 0.75
  const color = pct >= 100 ? green : pct >= 90 ? amber : red
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10}
        strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
      <text x={cx} y={cy - 6} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>{pct}%</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(148,163,184,0.85)" fontSize={10} fontWeight={600}>VS TARGET</text>
    </svg>
  )
}

// ── Static data ──────────────────────────────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const FINANCIALS = MONTHS.map((m, i) => ({
  month: m,
  revenue: +(68 + i * 8.5 + Math.random() * 6).toFixed(1),
  target: +(70 + i * 9).toFixed(1),
  opex: +(24 + i * 0.4 + Math.random() * 2).toFixed(1),
  ebitda: +(44 + i * 8 + Math.random() * 5).toFixed(1),
}))

const KPI_CARDS = [
  { label: "YTD Revenue",   value: "€1.24M",  target: "€1.30M",  pct: 95,  color: green,  trend: "+12% YoY",  up: true },
  { label: "EBITDA Margin", value: "76.1%",   target: "75%",     pct: 101, color: green,  trend: "+3.2pp",    up: true },
  { label: "Portfolio ROI", value: "18.2%",   target: "18%",     pct: 101, color: green,  trend: "+2.1pp",    up: true },
  { label: "CO₂ Avoided",  value: "1,920 t", target: "1,800 t", pct: 107, color: green,  trend: "+6.7%",     up: true },
  { label: "Fleet Uptime",  value: "98.4%",   target: "99%",     pct: 99,  color: amber,  trend: "-0.3pp",    up: false },
  { label: "Dispatch Rate", value: "94.1%",   target: "92%",     pct: 102, color: green,  trend: "+2.1pp",    up: true },
  { label: "BESS Cycles/d", value: "1.2",     target: "1.5",     pct: 80,  color: red,    trend: "-20%",      up: false },
  { label: "Avg PPA Price", value: "€62/MWh", target: "€60",     pct: 97,  color: amber,  trend: "+3.3%",     up: true },
]

const SITES_PERF = [
  { name: "Rotterdam",       revenue: 580, target: 550, roi: 22.5, uptime: 99.1, grade: "A+", trend: +4.8  },
  { name: "Porto Solar",     revenue: 430, target: 450, roi: 19.2, uptime: 98.7, grade: "A",  trend: -2.1  },
  { name: "Évora Híbrido",   revenue: 320, target: 300, roi: 17.8, uptime: 97.9, grade: "B+", trend: +6.1  },
  { name: "Alentejo Grid",   revenue: 210, target: 220, roi: 15.4, uptime: 99.4, grade: "B",  trend: -1.3  },
  { name: "Algarve PV",      revenue: 100, target: 120, roi: 12.1, uptime: 91.2, grade: "C",  trend: -9.4  },
]

const TOP_RISKS = [
  { sev: "high",   text: "Algarve PV uptime below SLA — 91.2% vs 95% contracted",     owner: "O&M Team"     },
  { sev: "medium", text: "BESS cycle rate trending down — battery degradation signal", owner: "Asset Mgmt"   },
  { sev: "medium", text: "PPA renewal due Q1 2026 — Porto Solar exposure €430k/yr",   owner: "Commercial"   },
  { sev: "low",    text: "Grid curtailment risk: Évora — new regulation draft in review", owner: "Regulatory" },
]

const GRADE_COLOR = { "A+": green, "A": green, "B+": amber, "B": amber, "C": red, "D": red }
const SEV_COL = { high: red, medium: amber, low: blue }

// ─────────────────────────────────────────────────────────────────────────────
export default function ExecutiveScorecard() {
  const [healthScore, setHealthScore] = useState(87)
  const [revPct, setRevPct] = useState(95)
  const [live, setLive] = useState(false)

  useEffect(() => {
    setLive(true)
    const t = setInterval(() => {
      setHealthScore(s => Math.min(99, Math.max(60, s + rand(-1, 1, 0))))
      setRevPct(s => Math.min(105, Math.max(85, s + rand(-0.5, 0.5, 1))))
    }, 3000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>Executive Scorecard</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 12, marginTop: 2 }}>Portfolio performance · Investor summary · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["5 Sites", "€1.24M YTD", "87 MW Portfolio"].map(t => (
            <span key={t} style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20, padding: "4px 12px", fontSize: 12, color: "rgba(148,163,184,0.85)"
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Top gauges + KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 160px 1fr", gap: 14, alignItems: "start" }}>
        {/* Health ring */}
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px" }}>
          <HealthRing score={healthScore} size={140} />
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(148,163,184,0.85)", textAlign: "center" }}>
            {healthScore >= 85 ? "Excellent" : healthScore >= 70 ? "Good" : "Needs Attention"}
          </div>
        </div>

        {/* Revenue gauge */}
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 12px" }}>
          <RevenueGauge pct={+revPct.toFixed(0)} size={140} />
          <div style={{ marginTop: 8, fontSize: 11, color: "rgba(148,163,184,0.85)", textAlign: "center" }}>Revenue vs Target</div>
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 2 }}>€1.24M / €1.30M</div>
        </div>

        {/* 8 KPI cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {KPI_CARDS.map(k => (
            <div key={k.label} style={{
              background: "rgba(255,255,255,0.08)",
              border: `1px solid rgba(255,255,255,0.12)`,
              borderTop: `3px solid ${k.color}50`,
              borderRadius: 10, padding: "12px 14px"
            }}>
              <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "rgba(148,163,184,0.85)" }}>Target: {k.target}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: k.up ? green : red }}>{k.trend}</span>
              </div>
              {/* Mini progress */}
              <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ height: "100%", borderRadius: 2, background: k.color, width: `${Math.min(k.pct, 105)}%`, transition: "width 0.8s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 12-month financial chart */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={label}>12-Month Revenue vs Target & EBITDA</div>
          <div style={{ display: "flex", gap: 14 }}>
            {[[green, "Revenue"], [accent, "Target"], [purple, "EBITDA"]].map(([c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 3, borderRadius: 2, background: c }} />
                <span style={{ fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={FINANCIALS} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} />
            <YAxis tick={{ fontSize: 10, fill: "rgba(148,163,184,0.85)" }} unit="k€" />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke={green} fill={green} fillOpacity={0.15} strokeWidth={2} name="Revenue (k€)" />
            <Line type="monotone" dataKey="target" stroke={accent} strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="Target (k€)" />
            <Bar dataKey="ebitda" fill={purple} fillOpacity={0.5} radius={[4, 4, 0, 0]} name="EBITDA (k€)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Per-site scorecard + Top risks */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
        {/* Site table */}
        <div style={card}>
          <div style={label}>Per-Site Performance Scorecard</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                {["Site", "Revenue (k€)", "Target", "vs Target", "ROI", "Uptime", "MoM", "Grade"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "rgba(148,163,184,0.85)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SITES_PERF.map(s => {
                const vt = +((s.revenue / s.target) * 100).toFixed(0)
                const vtColor = vt >= 100 ? green : vt >= 90 ? amber : red
                return (
                  <tr key={s.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                    <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{s.name}</td>
                    <td style={{ padding: "10px 10px", fontSize: 13, color: green, fontWeight: 700 }}>{s.revenue}</td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: "rgba(148,163,184,0.85)" }}>{s.target}</td>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
                        background: `${vtColor}15`, color: vtColor
                      }}>{vt}%</span>
                    </td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: accent }}>{s.roi}%</td>
                    <td style={{ padding: "10px 10px", fontSize: 12, color: s.uptime >= 98 ? green : s.uptime >= 95 ? amber : red }}>{s.uptime}%</td>
                    <td style={{ padding: "10px 10px", fontSize: 12, fontWeight: 700, color: s.trend >= 0 ? green : red }}>
                      {s.trend >= 0 ? "+" : ""}{s.trend}%
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <span style={{
                        fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 8,
                        background: `${GRADE_COLOR[s.grade]}20`, color: GRADE_COLOR[s.grade]
                      }}>{s.grade}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Top risks + investor snapshot */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Risks */}
          <div style={card}>
            <div style={label}>Top Portfolio Risks</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {TOP_RISKS.map((r, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "8px 10px", borderRadius: 8,
                  background: `${SEV_COL[r.sev]}08`,
                  border: `1px solid ${SEV_COL[r.sev]}25`
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: SEV_COL[r.sev], flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#f1f5f9", lineHeight: 1.4 }}>{r.text}</div>
                    <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", marginTop: 3 }}>Owner: {r.owner}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Investor snapshot */}
          <div style={{
            ...card,
            background: "linear-gradient(135deg, #6366f110, #a78bfa08)",
            borderColor: `${accent}30`,
          }}>
            <div style={{ ...label, color: accent }}>Investor Snapshot</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
              {[
                { l: "IRR (project)",   v: "14.2%",   c: green  },
                { l: "DSCR",           v: "1.38x",   c: green  },
                { l: "LCOE",           v: "€38/MWh", c: accent },
                { l: "Payback Period", v: "6.4 yrs",  c: amber  },
                { l: "Equity Multiple", v: "2.1x",   c: green  },
                { l: "PPA Duration",   v: "8.3 yrs",  c: blue   },
              ].map(item => (
                <div key={item.l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.c }}>{item.v}</div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.85)", marginTop: 2 }}>{item.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
