import { useState } from "react"
import { useAppStore } from "../store/appStore"
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const FINANCIAL = MONTHS.map((m, i) => ({
  month: m,
  revenue:  +(68 + i * 8.5 + Math.random() * 6).toFixed(1),
  opex:     +(24 + i * 0.4 + Math.random() * 2).toFixed(1),
  ebitda:   +(44 + i * 8 + Math.random() * 5).toFixed(1),
  co2:      +(180 + i * 12 + Math.random() * 10).toFixed(0),
}))

const KPI_TARGETS = [
  { key: "es_kpi_revenue",     value: "€142k",   target: "€150k",  pct: 95, color: "#10b981", trend: "+12%", trendUp: true },
  { key: "es_kpi_ebitda",      value: "€108k",   target: "€110k",  pct: 98, color: "#10b981", trend: "+18%", trendUp: true },
  { key: "es_kpi_roi",         value: "18.2%",   target: "18%",    pct: 101, color: "#10b981", trend: "+2.1pp", trendUp: true },
  { key: "es_kpi_co2",         value: "1,920t",  target: "1,800t", pct: 107, color: "#10b981", trend: "+6.7%", trendUp: true },
  { key: "es_kpi_uptime",      value: "98.4%",   target: "99%",    pct: 99,  color: "#f59e0b", trend: "-0.3pp", trendUp: false },
  { key: "es_kpi_dispatch",    value: "94.1%",   target: "92%",    pct: 102, color: "#10b981", trend: "+2.1pp", trendUp: true },
  { key: "es_kpi_cycles",      value: "1.2/d",   target: "1.5/d",  pct: 80,  color: "#f87171", trend: "-20%", trendUp: false },
  { key: "es_kpi_ppa",         value: "€0.062",  target: "€0.060", pct: 97,  color: "#f59e0b", trend: "+3.3%", trendUp: true },
]

const SITES_PERF = [
  { name: "Rotterdam",  revenue: 580, target: 550, roi: 22.5, uptime: 99.1, grade: "A+" },
  { name: "Rebordelo",  revenue: 380, target: 400, roi: 18.3, uptime: 97.8, grade: "B+" },
  { name: "Lisboa",     revenue: 290, target: 350, roi: 14.2, uptime: 94.2, grade: "B-" },
  { name: "Amsterdam",  revenue: 470, target: 450, roi: 20.1, uptime: 98.9, grade: "A" },
  { name: "Porto",      revenue: 0,   target: 220, roi: 0,    uptime: 0,    grade: "—" },
]

const gradeColor = { "A+": "#10b981", "A": "#10b981", "B+": "#60a5fa", "B-": "#f59e0b", "—": "#f87171" }

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
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function ExecutiveScorecard() {
  const { t } = useAppStore()
  const [period, setPeriod] = useState("ytd")
  const [exporting, setExporting] = useState(false)

  const handleExport = (type) => {
    setExporting(true)
    setTimeout(() => {
      setExporting(false)
      alert(`${t("es_export_success")} — ${type}`)
    }, 1800)
  }

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "22px 26px",
  }

  const totalRevenue = SITES_PERF.reduce((s, p) => s + p.revenue, 0)
  const avgROI = (SITES_PERF.filter(s => s.roi > 0).reduce((s, p) => s + p.roi, 0) / SITES_PERF.filter(s => s.roi > 0).length).toFixed(1)

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("es_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("es_sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4 }}>
            {["mtd", "qtd", "ytd"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: period === p ? "var(--accent)" : "transparent",
                color: period === p ? "#fff" : "var(--sub)",
              }}>{p.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => handleExport("PDF")} disabled={exporting} style={{
            background: exporting ? "var(--border)" : "var(--accent)", color: "#fff", border: "none",
            padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {exporting ? "⏳" : "📄"} {exporting ? t("es_generating") : t("es_export_pdf")}
          </button>
          <button onClick={() => handleExport("Email")} style={{
            background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)",
            padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13,
          }}>
            📧 {t("es_send_email")}
          </button>
        </div>
      </div>

      {/* Executive summary strip */}
      <div style={{
        ...cardStyle,
        background: "linear-gradient(135deg, var(--accent)18 0%, var(--surface) 100%)",
        border: "1px solid var(--accent)30",
        marginBottom: 24,
        display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr 1px 1fr",
        gap: 0,
      }}>
        {[
          { label: t("es_total_revenue"), value: `€${totalRevenue}k`, sub: t("es_ytd"), color: "#10b981" },
          null,
          { label: t("es_avg_roi"),       value: `${avgROI}%`,        sub: t("es_portfolio"), color: "#6366f1" },
          null,
          { label: t("es_co2_avoided"),   value: "4,820 t",           sub: t("es_ytd"),       color: "#10b981" },
          null,
          { label: t("es_npv_total"),     value: "€297k",             sub: t("es_projected"), color: "#f59e0b" },
        ].map((item, i) => item === null ? (
          <div key={i} style={{ background: "var(--border)", width: 1 }} />
        ) : (
          <div key={i} style={{ padding: "4px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: item.color }}>{item.value}</div>
            <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* KPI Grid */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("es_kpi_vs_target")}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {KPI_TARGETS.map(kpi => (
            <div key={kpi.key} style={cardStyle}>
              <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{t(kpi.key)}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: kpi.color }}>{kpi.value}</span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: kpi.trendUp ? "#10b981" : "#f87171",
                  background: kpi.trendUp ? "#10b98118" : "#f8717118",
                  padding: "2px 8px", borderRadius: 20,
                }}>{kpi.trend}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--sub)", marginBottom: 6 }}>
                <span>{t("es_target")}: {kpi.target}</span>
                <span style={{ color: kpi.color, fontWeight: 700 }}>{kpi.pct}%</span>
              </div>
              <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(kpi.pct, 100)}%`,
                  background: kpi.color,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div style={cardStyle}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("es_revenue_ebitda")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FINANCIAL.slice(-6)} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
              <XAxis dataKey="month" tick={{ fill: "var(--sub)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name={t("dash_revenue")} fill="#6366f1" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
              <Bar dataKey="ebitda" name="EBITDA" fill="#10b981" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={cardStyle}>
          <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("es_co2_trend")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={FINANCIAL.slice(-6)} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
              <XAxis dataKey="month" tick={{ fill: "var(--sub)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="co2" name="CO₂ t" stroke="#10b981" strokeWidth={2.2} fill="url(#co2Grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Site performance table */}
      <div style={cardStyle}>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("es_site_performance")}</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[t("location"), t("dash_revenue"), t("es_vs_target"), "ROI", t("cc_status_online"), t("es_grade")].map(h => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SITES_PERF.map(s => (
              <tr key={s.name} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "14px 14px", fontWeight: 700 }}>{s.name}</td>
                <td style={{ padding: "14px 14px", color: "#10b981", fontWeight: 700 }}>€{s.revenue}k</td>
                <td style={{ padding: "14px 14px" }}>
                  {s.revenue > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(s.revenue / s.target * 100, 100)}%`, background: s.revenue >= s.target ? "#10b981" : "#f59e0b", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, color: s.revenue >= s.target ? "#10b981" : "#f59e0b", fontWeight: 600 }}>
                        {Math.round(s.revenue / s.target * 100)}%
                      </span>
                    </div>
                  )}
                </td>
                <td style={{ padding: "14px 14px", fontWeight: 600, color: s.roi > 18 ? "#10b981" : s.roi > 12 ? "#f59e0b" : "#f87171" }}>{s.roi ? `${s.roi}%` : "—"}</td>
                <td style={{ padding: "14px 14px", color: s.uptime > 98 ? "#10b981" : s.uptime > 95 ? "#f59e0b" : "#f87171", fontWeight: 600 }}>{s.uptime ? `${s.uptime}%` : "—"}</td>
                <td style={{ padding: "14px 14px" }}>
                  <span style={{
                    background: `${gradeColor[s.grade]}18`, color: gradeColor[s.grade],
                    padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 900,
                  }}>{s.grade}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
