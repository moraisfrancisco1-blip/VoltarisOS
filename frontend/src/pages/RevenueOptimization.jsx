import { useState, useMemo } from "react"
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts"
import { useAppStore } from "../store/appStore"

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec) }

function generateScenarios() {
  return Array.from({ length: 24 }, (_, i) => {
    const h = i
    const solarPeak = h >= 9 && h <= 16
    const peakHour = h >= 17 && h <= 21
    const solar = solarPeak ? rand(80, 280) : rand(0, 20)
    const price = 35 + Math.sin(i / 3) * 28 + rand(-5, 5)
    const baseRevenue = price * 0.4
    const optimizedRevenue = baseRevenue * rand(1.15, 1.45)
    const bessOpportunity = peakHour ? rand(60, 180) : rand(0, 40)
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      h,
      price: +price.toFixed(2),
      solar,
      baseRevenue: +baseRevenue.toFixed(1),
      optimizedRevenue: +optimizedRevenue.toFixed(1),
      bessOpportunity: +bessOpportunity.toFixed(1),
      gridExport: solarPeak ? rand(20, 100) : 0,
    }
  })
}

const RECOMMENDATIONS = [
  {
    id: 1,
    type: "bess",
    priority: "critical",
    title: "rec_bess_discharge_title",
    desc: "rec_bess_discharge_desc",
    gain: "+€318",
    window: "17:00–20:00",
    confidence: 94,
    action: "rec_action_schedule",
  },
  {
    id: 2,
    type: "solar",
    priority: "high",
    title: "rec_solar_curtail_title",
    desc: "rec_solar_curtail_desc",
    gain: "+€142",
    window: "12:00–14:00",
    confidence: 87,
    action: "rec_action_optimize",
  },
  {
    id: 3,
    type: "fcr",
    priority: "high",
    title: "rec_fcr_title",
    desc: "rec_fcr_desc",
    gain: "+€210",
    window: "09:00–17:00",
    confidence: 81,
    action: "rec_action_activate",
  },
  {
    id: 4,
    type: "ev",
    priority: "medium",
    title: "rec_ev_shift_title",
    desc: "rec_ev_shift_desc",
    gain: "+€64",
    window: "02:00–06:00",
    confidence: 76,
    action: "rec_action_configure",
  },
  {
    id: 5,
    type: "trading",
    priority: "medium",
    title: "rec_da_buy_title",
    desc: "rec_da_buy_desc",
    gain: "+€88",
    window: "Tomorrow 03:00–07:00",
    confidence: 71,
    action: "rec_action_trade",
  },
]

const SCENARIOS = [
  { name: "sc_base",    revenue: 842,  co2: 1.2, cycles: 1.0, label: "#6b7280" },
  { name: "sc_ai",      revenue: 1284, co2: 0.8, cycles: 1.2, label: "#6366f1" },
  { name: "sc_max",     revenue: 1508, co2: 0.6, cycles: 1.8, label: "#10b981" },
]

const priorityColor = { critical: "#f87171", high: "#f59e0b", medium: "#60a5fa" }
const priorityBg    = { critical: "#f8717118", high: "#f59e0b18", medium: "#60a5fa18" }
const typeIcon = { bess: "⚡", solar: "☀️", fcr: "🔁", ev: "🔌", trading: "📈" }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "var(--tooltip-bg)", border: "1px solid var(--border-strong)",
      borderRadius: 12, padding: "12px 16px", fontSize: 12,
      backdropFilter: "blur(20px)", boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
    }}>
      <div style={{ color: "var(--sub)", marginBottom: 8, fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
            <span style={{ color: "var(--sub)", fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{typeof p.value === "number" ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueOptimization() {
  const { t } = useAppStore()
  const [data] = useState(generateScenarios)
  const [accepted, setAccepted] = useState({})
  const [activeScenario, setActiveScenario] = useState("sc_ai")

  const totalGain = RECOMMENDATIONS
    .filter(r => !accepted[r.id])
    .reduce((sum, r) => sum + parseInt(r.gain.replace(/[^0-9]/g, "")), 0)

  const acceptedGain = RECOMMENDATIONS
    .filter(r => accepted[r.id])
    .reduce((sum, r) => sum + parseInt(r.gain.replace(/[^0-9]/g, "")), 0)

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "22px 26px",
  }

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("rev_opt_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("rev_opt_sub")}</p>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #10b98120, #10b98108)",
          border: "1px solid #10b98130",
          borderRadius: 16, padding: "16px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{t("rev_opt_opportunity")}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#10b981" }}>+€{totalGain}</div>
          <div style={{ fontSize: 12, color: "var(--sub)" }}>{t("rev_opt_today")}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: t("rev_opt_accepted_gain"), value: `+€${acceptedGain}`, color: "#10b981", sub: `${Object.keys(accepted).length} ${t("rev_opt_actions")}` },
          { label: t("rev_opt_pending"),       value: `€${totalGain}`,     color: "#f59e0b", sub: `${RECOMMENDATIONS.filter(r => !accepted[r.id]).length} ${t("rev_opt_recs")}` },
          { label: t("rev_opt_ai_confidence"), value: "87%",               color: "#6366f1", sub: t("rev_opt_model_v2") },
          { label: t("rev_opt_best_window"),   value: "17:00",             color: "#f87171", sub: t("rev_opt_peak_discharge") },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main 2-col */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginBottom: 20 }}>

        {/* Revenue chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("rev_opt_chart_title")}</h3>
            <p style={{ color: "var(--sub)", fontSize: 13 }}>{t("rev_opt_chart_sub")}</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b7280" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
              <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bessOpportunity" name="BESS Opp." fill="#f59e0b" fillOpacity={0.6} barSize={8} />
              <Area type="monotone" dataKey="baseRevenue" name={t("rev_opt_base")} stroke="#6b7280" strokeWidth={1.5} fill="url(#baseGrad)" dot={false} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="optimizedRevenue" name={t("rev_opt_optimized")} stroke="#10b981" strokeWidth={2.2} fill="url(#optGrad)" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Scenario comparison */}
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("rev_opt_scenarios")}</h3>
          {SCENARIOS.map(sc => (
            <div key={sc.name}
              onClick={() => setActiveScenario(sc.name)}
              style={{
                padding: "14px 16px", borderRadius: 12, marginBottom: 10, cursor: "pointer",
                border: `1px solid ${activeScenario === sc.name ? sc.label : "var(--border)"}`,
                background: activeScenario === sc.name ? sc.label + "12" : "var(--bg)",
                transition: "all 0.2s",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: activeScenario === sc.name ? sc.label : "var(--text)" }}>{t(sc.name)}</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: sc.label }}>€{sc.revenue}</span>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--sub)" }}>
                <span>CO₂: {sc.co2} t</span>
                <span>{t("bat_cycles")}: {sc.cycles}x</span>
              </div>
              <div style={{ marginTop: 8, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(sc.revenue / 1508) * 100}%`, background: sc.label, borderRadius: 2 }} />
              </div>
            </div>
          ))}

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4 }}>
            <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 8 }}>{t("rev_opt_uplift")}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>
              +{Math.round((1284 - 842) / 842 * 100)}%
            </div>
            <div style={{ fontSize: 12, color: "var(--sub)" }}>{t("rev_opt_vs_base")}</div>
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("rev_opt_ai_recs")}</h3>
            <p style={{ color: "var(--sub)", fontSize: 13 }}>{t("rev_opt_ai_recs_sub")}</p>
          </div>
          <button style={{
            background: "var(--accent)", color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13,
          }}
            onClick={() => {
              const all = {}
              RECOMMENDATIONS.forEach(r => { all[r.id] = true })
              setAccepted(all)
            }}>
            {t("rev_opt_accept_all")}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {RECOMMENDATIONS.map(rec => (
            <div key={rec.id} style={{
              display: "grid", gridTemplateColumns: "44px 1fr 120px 100px 120px",
              alignItems: "center", gap: 16,
              padding: "16px 20px", borderRadius: 14,
              background: accepted[rec.id] ? "var(--bg)" : "var(--surface)",
              border: `1px solid ${accepted[rec.id] ? "var(--border)" : priorityColor[rec.priority] + "40"}`,
              opacity: accepted[rec.id] ? 0.6 : 1,
              transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 24, textAlign: "center" }}>{typeIcon[rec.type]}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{t(rec.title)}</div>
                <div style={{ color: "var(--sub)", fontSize: 12 }}>{t(rec.desc)}</div>
                <div style={{ color: "var(--sub)", fontSize: 11, marginTop: 4 }}>🕐 {rec.window}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981" }}>{rec.gain}</div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>{t("rev_opt_gain")}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: rec.confidence > 85 ? "#10b981" : rec.confidence > 75 ? "#f59e0b" : "#f87171" }}>
                  {rec.confidence}%
                </div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>{t("rev_opt_conf")}</div>
                <div style={{ marginTop: 4, height: 3, background: "var(--border)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: `${rec.confidence}%`, background: rec.confidence > 85 ? "#10b981" : "#f59e0b", borderRadius: 2 }} />
                </div>
              </div>
              <button
                onClick={() => setAccepted(a => ({ ...a, [rec.id]: !a[rec.id] }))}
                style={{
                  padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 12,
                  background: accepted[rec.id] ? "var(--border)" : "var(--accent)",
                  color: accepted[rec.id] ? "var(--sub)" : "#fff",
                }}>
                {accepted[rec.id] ? t("rev_opt_accepted") : t(rec.action)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
