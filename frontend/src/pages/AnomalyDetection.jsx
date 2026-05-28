import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"
import {
  AreaChart, Area, ComposedChart, Line, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts"

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec) }

function generateSensorData(anomalyHour = 14) {
  return Array.from({ length: 24 }, (_, i) => {
    const h = i
    const expected = h >= 6 && h <= 18 ? Math.max(0, Math.sin(((h - 6) / 12) * Math.PI) * 280) : 0
    const isAnomaly = h === anomalyHour
    const actual = isAnomaly ? expected * 0.62 : expected * (0.92 + Math.random() * 0.16)
    return {
      hour: `${String(h).padStart(2, "0")}:00`,
      expected: +expected.toFixed(1),
      actual: +actual.toFixed(1),
      deviation: +((actual - expected) / (expected || 1) * 100).toFixed(1),
      isAnomaly,
      temp: +(35 + Math.random() * 8 + (isAnomaly ? 12 : 0)).toFixed(1),
    }
  })
}

const ANOMALIES = [
  {
    id: 1, site: "Rotterdam", asset: "Panel B3-7", type: "anom_type_soiling",
    detected: "14:23", severity: "high", deviation: -38,
    desc: "anom_desc_soiling", action: "anom_action_clean",
    status: "open", irradiance: 820, actual: 142, expected: 228,
    cost: "€42/day", confidence: 94,
  },
  {
    id: 2, site: "Amsterdam", asset: "Inverter INV-02", type: "anom_type_inverter",
    detected: "09:41", severity: "critical", deviation: -72,
    desc: "anom_desc_inverter", action: "anom_action_inspect",
    status: "open", irradiance: 680, actual: 18, expected: 65,
    cost: "€180/day", confidence: 99,
  },
  {
    id: 3, site: "Lisboa", asset: "BESS Cell Pack C4", type: "anom_type_thermal",
    detected: "11:05", severity: "high", deviation: +18,
    desc: "anom_desc_thermal", action: "anom_action_throttle",
    status: "investigating", irradiance: null, actual: 52, expected: 44,
    cost: "Degradation risk", confidence: 88,
  },
  {
    id: 4, site: "Rebordelo", asset: "String S2-1..4", type: "anom_type_mismatch",
    detected: "13:18", severity: "medium", deviation: -22,
    desc: "anom_desc_mismatch", action: "anom_action_check_wiring",
    status: "open", irradiance: 790, actual: 64, expected: 82,
    cost: "€28/day", confidence: 81,
  },
  {
    id: 5, site: "Rotterdam", asset: "Wind Turbine WT-1", type: "anom_type_vibration",
    detected: "07:52", severity: "medium", deviation: null,
    desc: "anom_desc_vibration", action: "anom_action_bearing",
    status: "resolved", irradiance: null, actual: null, expected: null,
    cost: "—", confidence: 76,
  },
]

const severityColor = { critical: "#f87171", high: "#f59e0b", medium: "#60a5fa", low: "#10b981" }
const severityBg    = { critical: "#f8717118", high: "#f59e0b18", medium: "#60a5fa18", low: "#10b98118" }
const statusColor   = { open: "#f87171", investigating: "#f59e0b", resolved: "#10b981" }
const statusBg      = { open: "#f8717118", investigating: "#f59e0b18", resolved: "#10b98118" }

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

export default function AnomalyDetection() {
  const { t } = useAppStore()
  const [data] = useState(() => generateSensorData(14))
  const [anomalies, setAnomalies] = useState(ANOMALIES)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState("all")
  const [ticketId, setTicketId] = useState(null)

  const filtered = filter === "all" ? anomalies : anomalies.filter(a => a.severity === filter || a.status === filter)

  const openCount       = anomalies.filter(a => a.status === "open").length
  const criticalCount   = anomalies.filter(a => a.severity === "critical").length
  const resolvedToday   = anomalies.filter(a => a.status === "resolved").length
  const dailyCost       = "€250"

  const createTicket = (anomaly) => {
    const id = `TKT-${Math.floor(Math.random() * 9000 + 1000)}`
    setTicketId(id)
    setAnomalies(prev => prev.map(a => a.id === anomaly.id ? { ...a, status: "investigating" } : a))
  }

  const resolve = (id) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, status: "resolved" } : a))
    if (selected?.id === id) setSelected(null)
  }

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "22px 26px",
  }

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("anom_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("anom_sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {criticalCount > 0 && (
            <div style={{ background: "#f8717118", border: "1px solid #f8717130", color: "#f87171", padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
              🚨 {criticalCount} {t("anom_critical_alert")}
            </div>
          )}
          {ticketId && (
            <div style={{ background: "#10b98118", border: "1px solid #10b98130", color: "#10b981", padding: "8px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>
              ✓ {ticketId} {t("anom_ticket_created")}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: t("anom_open"),         value: openCount,     color: "#f87171", sub: t("anom_need_action") },
          { label: t("anom_critical"),     value: criticalCount, color: "#f87171", sub: t("anom_immediate") },
          { label: t("anom_revenue_loss"), value: dailyCost,     color: "#f59e0b", sub: t("anom_per_day") },
          { label: t("anom_resolved"),     value: resolvedToday, color: "#10b981", sub: t("anom_today") },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart + List */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Anomaly sensor chart */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("anom_chart_title")}</h3>
            <p style={{ color: "var(--sub)", fontSize: 12 }}>{t("anom_chart_sub")}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="expectedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
              <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x="14:00" stroke="#f87171" strokeDasharray="3 3" label={{ value: "⚠️ 14:23", fill: "#f87171", fontSize: 10 }} />
              <Area type="monotone" dataKey="expected" name={t("anom_expected")} stroke="#6366f1" strokeWidth={1.5} fill="url(#expectedGrad)" dot={false} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="actual" name={t("anom_actual")} stroke="#f59e0b" strokeWidth={2.2} fill="url(#actualGrad)" dot={(props) => {
                if (props.payload.isAnomaly) {
                  return <circle key={props.index} cx={props.cx} cy={props.cy} r={6} fill="#f87171" stroke="#fff" strokeWidth={2} />
                }
                return null
              }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature anomaly */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t("anom_temp_title")}</h3>
            <p style={{ color: "var(--sub)", fontSize: 12 }}>{t("anom_temp_sub")}</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line, rgba(128,128,128,0.1))" />
              <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickLine={false} axisLine={false} domain={[30, 60]} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: t("anom_warning_temp"), fill: "#f59e0b", fontSize: 10 }} />
              <ReferenceLine y={55} stroke="#f87171" strokeDasharray="3 3" label={{ value: t("anom_critical_temp"), fill: "#f87171", fontSize: 10 }} />
              <Area type="monotone" dataKey="temp" name="°C" stroke="#f87171" strokeWidth={2.2} fill="url(#tempGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Anomalies list */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>{t("anom_list_title")}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "open", "critical", "resolved"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: filter === f ? "var(--accent)" : "var(--bg)",
                color: filter === f ? "#fff" : "var(--sub)",
              }}>
                {f === "all" ? t("trading_all") : f === "open" ? t("anom_open") : f === "critical" ? t("anom_critical") : t("anom_resolved")}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(a => (
            <div key={a.id}>
              <div
                onClick={() => setSelected(selected?.id === a.id ? null : a)}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 120px 100px 90px 90px 130px",
                  alignItems: "center", gap: 16,
                  padding: "16px 20px", borderRadius: 14, cursor: "pointer",
                  border: `1px solid ${selected?.id === a.id ? "var(--accent)" : a.severity === "critical" ? "#f8717130" : "var(--border)"}`,
                  background: a.status === "resolved" ? "var(--bg)" : "var(--surface)",
                  opacity: a.status === "resolved" ? 0.7 : 1,
                  transition: "all 0.15s",
                }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t(a.type)}</div>
                  <div style={{ color: "var(--sub)", fontSize: 12 }}>{a.site} · {a.asset}</div>
                </div>
                <span style={{ background: severityBg[a.severity], color: severityColor[a.severity], padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textAlign: "center" }}>
                  {t(`anom_sev_${a.severity}`)}
                </span>
                <span style={{ color: "var(--sub)", fontSize: 12 }}>🕐 {a.detected}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: a.deviation < 0 ? "#f87171" : "#f59e0b" }}>
                  {a.deviation !== null ? `${a.deviation > 0 ? "+" : ""}${a.deviation}%` : "—"}
                </span>
                <span style={{ background: statusBg[a.status], color: statusColor[a.status], padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, textAlign: "center" }}>
                  {a.status === "open" ? t("anom_open") : a.status === "investigating" ? t("anom_investigating") : t("anom_resolved")}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {a.status !== "resolved" && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); createTicket(a) }}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                          background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700,
                        }}>🎫 {t("anom_ticket")}</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); resolve(a.id) }}
                        style={{
                          padding: "6px 12px", borderRadius: 8, border: "1px solid #10b981",
                          background: "transparent", color: "#10b981", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}>✓</button>
                    </>
                  )}
                </div>
              </div>

              {selected?.id === a.id && (
                <div style={{ margin: "0 0 0 0", padding: "16px 20px", background: "var(--bg)", borderRadius: "0 0 14px 14px", border: "1px solid var(--border)", borderTop: "none" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
                    {[
                      { label: t("anom_expected"), value: a.expected ? `${a.expected} kW` : "—", color: "#6366f1" },
                      { label: t("anom_actual"),   value: a.actual ? `${a.actual} kW` : "—",   color: "#f59e0b" },
                      { label: t("anom_cost"),     value: a.cost,  color: "#f87171" },
                      { label: t("anom_ai_conf"),  value: `${a.confidence}%`, color: "#10b981" },
                    ].map(item => (
                      <div key={item.label} style={{ padding: "12px", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontWeight: 800, color: item.color, fontSize: 18 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ color: "var(--sub)", fontSize: 13, marginBottom: 10 }}>{t(a.desc)}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => createTicket(a)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                      🎫 {t("anom_action_create_ticket")}
                    </button>
                    <button style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                      {t(a.action)}
                    </button>
                    <button style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                      {t("anom_action_assign")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
