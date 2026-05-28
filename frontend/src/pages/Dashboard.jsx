import { useEffect, useState, useRef } from "react"
import axios from "axios"
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid, Cell
} from "recharts"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec) }

function generateTimeseries(hours = 48) {
  return Array.from({ length: hours }, (_, i) => {
    const h = i % 24
    const solar = h >= 6 && h <= 19 ? Math.max(0, Math.sin(((h - 6) / 13) * Math.PI) * rand(160, 260)) : 0
    const load = rand(60, 120) + (h >= 8 && h <= 20 ? rand(30, 70) : 0)
    const grid = Math.max(0, load - solar - rand(10, 30))
    const battery = 40 + 40 * Math.sin(((h) / 24) * Math.PI)
    const price = rand(45, 145)
    const co2 = +(solar * 0.082).toFixed(1)
    const wind = rand(0, 80) + (h >= 10 && h <= 18 ? rand(20, 60) : 0)
    return {
      time: i < 24 ? `${String(h).padStart(2,"0")}:00` : `+${String(h).padStart(2,"0")}:00`,
      hour: h, dayIdx: Math.floor(i / 24),
      solar: +solar.toFixed(1), load: +load.toFixed(1), grid: +grid.toFixed(1),
      battery: +battery.toFixed(1), price, co2, wind: +wind.toFixed(1),
    }
  })
}

const BASE_TS = generateTimeseries(48)
const now_h = new Date().getHours()
const CURRENT = BASE_TS[now_h] || BASE_TS[12]

/* ─── Premium Tooltip ─────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "var(--tooltip-bg)", border: "1px solid var(--border-strong)",
      borderRadius: "12px", padding: "12px 16px", fontSize: "12px", zIndex: 100,
      backdropFilter: "blur(20px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    }}>
      <div style={{ color: "var(--sub)", marginBottom: "8px", fontWeight: "700", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "16px", marginBottom: "4px", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: p.color }} />
            <span style={{ color: "var(--sub)", fontSize: "11px" }}>{p.name}</span>
          </div>
          <span style={{ color: "var(--text)", fontWeight: "700", fontSize: "13px" }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── Sparkline ───────────────────────────────────────────────────────────── */
function Sparkline({ data, dataKey, color, height = 44 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} fill={`url(#spark-${dataKey}-${color.replace("#","")})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ─── Battery Ring ────────────────────────────────────────────────────────── */
function BatteryRing({ soc }) {
  const r = 52, circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(soc, 0), 100)
  const dash = (pct / 100) * circ
  const ringColor = pct > 60 ? "#4ade80" : pct > 30 ? "#f59e0b" : "#f87171"
  const ringGlow = pct > 60 ? "rgba(74,222,128,0.3)" : pct > 30 ? "rgba(245,158,11,0.3)" : "rgba(248,113,113,0.3)"
  return (
    <div style={{ position: "relative", width: "130px", height: "130px" }}>
      {/* Outer glow ring */}
      <div style={{ position: "absolute", inset: "-8px", borderRadius: "50%", background: `radial-gradient(circle, ${ringGlow} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="var(--surface2)" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={ringColor} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 8px ${ringColor})` }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "26px", fontWeight: "900", color: ringColor, textShadow: `0 0 20px ${ringColor}80` }}>{pct.toFixed(0)}%</div>
        <div style={{ fontSize: "10px", color: "var(--sub)", letterSpacing: "2px", textTransform: "uppercase" }}>SoC</div>
      </div>
    </div>
  )
}

/* ─── Premium Icon Box ────────────────────────────────────────────────────── */
function IconBox({ icon, color, size = 40 }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`,
      borderRadius: `${size * 0.28}px`,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color,
      boxShadow: `0 0 20px ${color}20, inset 0 1px 0 ${color}20`,
      flexShrink: 0,
    }}>
      {icon}
    </div>
  )
}

/* ─── KPI Card ────────────────────────────────────────────────────────────── */
function KPICard({ label, value, unit, color, trend, sparkData, sparkKey, icon, subtitle }) {
  const [hovered, setHovered] = useState(false)
  const up = trend >= 0
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        backdropFilter: "blur(20px)",
        borderRadius: "16px", padding: "20px 22px",
        border: `1px solid ${hovered ? `${color}40` : "var(--border)"}`,
        display: "flex", flexDirection: "column", gap: "10px",
        position: "relative", overflow: "hidden",
        cursor: "default",
        transition: "border 0.2s, box-shadow 0.2s, transform 0.2s",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? `0 8px 30px ${color}20, 0 0 0 1px ${color}20` : "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      {/* Ambient glow top-right */}
      <div style={{
        position: "absolute", top: "-30px", right: "-30px",
        width: "100px", height: "100px", borderRadius: "50%",
        background: `${color}20`, filter: "blur(30px)", pointerEvents: "none",
        transition: "opacity 0.3s", opacity: hovered ? 1 : 0.5,
      }} />
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: "20%", right: "20%", height: "1px",
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        transition: "opacity 0.3s", opacity: hovered ? 1 : 0.4,
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--sub)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "600" }}>{label}</div>
          {subtitle && <div style={{ color: "var(--sub)", fontSize: "10px", marginTop: "1px", opacity: 0.6 }}>{subtitle}</div>}
          <div style={{ marginTop: "8px", fontSize: "30px", fontWeight: "900", color: "var(--text)", lineHeight: 1, letterSpacing: "-1px" }}>
            {value}<span style={{ fontSize: "13px", fontWeight: "400", color: "var(--sub)", marginLeft: "4px" }}>{unit}</span>
          </div>
        </div>
        <IconBox icon={icon} color={color} size={42} />
      </div>

      {sparkData && <Sparkline data={sparkData} dataKey={sparkKey} color={color} />}

      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "3px",
            padding: "2px 8px", borderRadius: "20px",
            background: up ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${up ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
          }}>
            <span style={{ color: up ? "#4ade80" : "#f87171", fontSize: "11px", fontWeight: "700" }}>
              {up ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
            </span>
          </div>
          <span style={{ color: "var(--sub)", fontSize: "10px" }}>vs yesterday</span>
        </div>
      )}
    </div>
  )
}

/* ─── Live price ticker ───────────────────────────────────────────────────── */
function PriceTicker() {
  const [price, setPrice] = useState(74.2)
  const [dir, setDir] = useState(1)
  const { t } = useTranslation()
  useEffect(() => {
    const iv = setInterval(() => {
      setPrice(p => { const next = +(p + (Math.random() - 0.48) * 2.5).toFixed(2); setDir(next >= p ? 1 : -1); return Math.max(20, Math.min(200, next)) })
    }, 2000)
    return () => clearInterval(iv)
  }, [])
  const up = dir > 0
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "10px", padding: "7px 14px",
      borderRadius: "22px",
      background: up ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
      border: `1px solid ${up ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
      backdropFilter: "blur(10px)",
    }}>
      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: up ? "#4ade80" : "#f87171", animation: "pulse 1.5s infinite", boxShadow: `0 0 8px ${up ? "#4ade80" : "#f87171"}` }} />
      <span style={{ color: "var(--sub)", fontSize: "11px", fontWeight: "500" }}>{t("topbar_live")}</span>
      <span style={{ color: "var(--text)", fontWeight: "800", fontSize: "16px", letterSpacing: "-0.5px" }}>€{price.toFixed(2)}</span>
      <span style={{ color: "var(--sub)", fontSize: "11px" }}>/MWh</span>
      <span style={{ color: up ? "#4ade80" : "#f87171", fontSize: "14px", fontWeight: "700" }}>{up ? "▲" : "▼"}</span>
    </div>
  )
}

/* ─── AI Panel ────────────────────────────────────────────────────────────── */
function AIPanel({ color }) {
  const [decision, setDecision] = useState(null)
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    axios.get("/ai_decision?price=74&battery=0.5")
      .then(r => { setDecision(r.data.decision || "hold"); setConfidence(rand(72, 95, 0)) })
      .catch(() => { setDecision("hold"); setConfidence(81) })
      .finally(() => setLoading(false))
  }, [])

  const decisionColors = { charge: "#4ade80", discharge: "#f87171", hold: "#f59e0b" }
  const dc = decision ? decisionColors[decision] : "#6b7280"
  const icons = {
    charge: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    discharge: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    hold: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  }

  return (
    <div style={{
      background: "var(--surface)", backdropFilter: "blur(20px)",
      borderRadius: "16px", border: `1px solid ${dc}35`,
      padding: "20px", display: "flex", flexDirection: "column", gap: "14px",
      position: "relative", overflow: "hidden",
      boxShadow: `0 0 40px ${dc}10`,
    }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 80% 10%, ${dc}0d, transparent 60%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: "1px", background: `linear-gradient(90deg, transparent, ${dc}50, transparent)` }} />

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: dc, animation: "pulse 2s infinite", boxShadow: `0 0 8px ${dc}` }} />
        <span style={{ color: "var(--sub)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "600" }}>{t("dash_ai_engine")}</span>
      </div>

      {loading ? (
        <div style={{ color: "var(--sub)", fontSize: "13px" }}>{t("dash_processing")}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <IconBox icon={icons[decision]} color={dc} size={56} />
            <div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: dc, textTransform: "uppercase", letterSpacing: "1px", textShadow: `0 0 20px ${dc}60` }}>
                {t(`ai_${decision}`)}
              </div>
              <div style={{ color: "var(--sub)", fontSize: "11px", marginTop: "4px", maxWidth: "160px", lineHeight: 1.4 }}>
                {t(`ai_reason_${decision}`)}
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "var(--sub)", fontSize: "11px" }}>{t("dash_confidence")}</span>
              <span style={{ color: dc, fontWeight: "700", fontSize: "12px" }}>{confidence}%</span>
            </div>
            <div style={{ height: "6px", background: "var(--surface2)", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${confidence}%`,
                background: `linear-gradient(90deg, ${dc}60, ${dc})`,
                borderRadius: "10px", transition: "width 1s ease",
                boxShadow: `0 0 10px ${dc}60`,
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── Widget Toggle ────────────────────────────────────────────────────────── */
function WidgetToggle({ widgetKey, label, color }) {
  const { dashWidgets, setDashWidget } = useAppStore()
  const active = dashWidgets[widgetKey]
  return (
    <button
      onClick={() => setDashWidget(widgetKey, !active)}
      style={{
        padding: "5px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600",
        background: active ? `${color}18` : "var(--surface2)",
        border: `1px solid ${active ? `${color}45` : "var(--border)"}`,
        color: active ? color : "var(--sub)",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {active ? "✓ " : "+ "}{label}
    </button>
  )
}

/* ─── CO2 Widget ──────────────────────────────────────────────────────────── */
function CO2Widget({ data, color }) {
  const { t } = useTranslation()
  const total = data.slice(0, 24).reduce((s, d) => s + (d.co2 || 0), 0).toFixed(1)
  const equiv = (total / 8.4).toFixed(0)
  return (
    <div style={{
      background: "var(--surface)", backdropFilter: "blur(20px)",
      borderRadius: "16px", padding: "22px",
      border: "1px solid var(--border)", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(74,222,128,0.08)", filter: "blur(30px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)" }} />
      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_co2_saved")}</div>
      <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "14px" }}>{t("dash_today")} · kg CO₂eq</div>
      <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "38px", fontWeight: "900", color: "#4ade80", letterSpacing: "-2px", textShadow: "0 0 30px rgba(74,222,128,0.4)" }}>{total}</div>
          <div style={{ fontSize: "11px", color: "var(--sub)" }}>kg CO₂</div>
        </div>
        <div style={{ padding: "10px 16px", background: "rgba(74,222,128,0.06)", borderRadius: "12px", border: "1px solid rgba(74,222,128,0.15)" }}>
          <div style={{ fontSize: "20px", marginBottom: "2px" }}>🌳</div>
          <div style={{ fontSize: "13px", color: "#4ade80", fontWeight: "700" }}>{equiv}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>trees/day</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data.slice(0, 24)} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="gCo2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 9 }} interval={5} />
          <YAxis stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 9 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="co2" stroke="#4ade80" strokeWidth={2} fill="url(#gCo2)" name="CO₂ kg" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Grid Balance Widget ─────────────────────────────────────────────────── */
function GridBalanceWidget({ data }) {
  const { t } = useTranslation()
  const net = data.slice(0, 24).map(d => ({ ...d, net: +(d.solar - d.load).toFixed(1) }))
  return (
    <div style={{
      background: "var(--surface)", backdropFilter: "blur(20px)",
      borderRadius: "16px", padding: "22px",
      border: "1px solid var(--border)", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent)" }} />
      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_grid_balance")}</div>
      <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "14px" }}>Solar − Load · kW</div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={net} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 9 }} interval={5} />
          <YAxis stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 9 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1} />
          <Bar dataKey="net" name="Net kW" radius={[3, 3, 0, 0]}>
            {net.map((entry, i) => (
              <Cell key={i} fill={entry.net >= 0 ? "#4ade80" : "#f87171"} fillOpacity={0.85} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Alerts Widget ───────────────────────────────────────────────────────── */
function RecentAlertsWidget() {
  const { notifications } = useAppStore()
  const { t } = useTranslation()
  const unread = notifications.filter(n => !n.read).slice(0, 4)
  const typeColors = { alert: "#f87171", trade: "#4ade80", maintenance: "#f59e0b", user: "#60a5fa", carbon: "#34d399" }
  return (
    <div style={{
      background: "var(--surface)", backdropFilter: "blur(20px)",
      borderRadius: "16px", padding: "22px",
      border: "1px solid var(--border)", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(248,113,113,0.4), transparent)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)" }}>{t("dash_recent_alerts")}</div>
          <div style={{ color: "var(--sub)", fontSize: "11px" }}>{unread.length} {t("dash_unread")}</div>
        </div>
        {unread.length > 0 && (
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f87171", boxShadow: "0 0 12px rgba(248,113,113,0.6)", animation: "pulse 1.5s infinite" }} />
        )}
      </div>
      {unread.length === 0 ? (
        <div style={{ color: "var(--sub)", fontSize: "13px", textAlign: "center", padding: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ fontSize: "24px" }}>✓</div>
          {t("dash_no_alerts")}
        </div>
      ) : (
        unread.map(n => {
          const c = typeColors[n.type] || "#6b7280"
          return (
            <div key={n.id} style={{
              padding: "10px 12px", background: "var(--surface2)", borderRadius: "10px",
              border: `1px solid ${c}20`, marginBottom: "8px",
              borderLeft: `3px solid ${c}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>{n.title}</div>
                <div style={{ fontSize: "10px", color: "var(--sub)" }}>{n.time}</div>
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "3px" }}>{n.body}</div>
            </div>
          )
        })
      )}
    </div>
  )
}

/* ─── Weather Forecast ────────────────────────────────────────────────────── */
function WeatherWidget() {
  const { t } = useTranslation()
  const forecast = [
    { day: t("dash_today"), icon: "☀️", temp: "22°", solar: "High", solarPct: 92 },
    { day: "D+1", icon: "⛅", temp: "18°", solar: "Med", solarPct: 55 },
    { day: "D+2", icon: "🌤️", temp: "20°", solar: "High", solarPct: 80 },
    { day: "D+3", icon: "🌧️", temp: "14°", solar: "Low", solarPct: 20 },
    { day: "D+4", icon: "☀️", temp: "24°", solar: "High", solarPct: 95 },
  ]
  const solarColor = { "High": "#f59e0b", "Med": "#60a5fa", "Low": "#6b7280" }
  return (
    <div style={{
      background: "var(--surface)", backdropFilter: "blur(20px)",
      borderRadius: "16px", padding: "22px",
      border: "1px solid var(--border)", position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />
      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_weather_forecast")}</div>
      <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>Solar irradiance forecast</div>
      <div style={{ display: "flex", gap: "8px" }}>
        {forecast.map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", padding: "12px 6px",
            background: i === 0 ? "rgba(245,158,11,0.08)" : "var(--surface2)",
            borderRadius: "12px",
            border: i === 0 ? "1px solid rgba(245,158,11,0.25)" : "1px solid var(--border)",
            transition: "all 0.2s",
          }}>
            <div style={{ fontSize: "10px", color: "var(--sub)", marginBottom: "6px", fontWeight: "600" }}>{d.day}</div>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{d.icon}</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--text)", marginBottom: "6px" }}>{d.temp}</div>
            {/* Solar bar */}
            <div style={{ height: "3px", background: "var(--surface)", borderRadius: "10px", overflow: "hidden", margin: "0 4px 4px" }}>
              <div style={{ height: "100%", width: `${d.solarPct}%`, background: solarColor[d.solar], borderRadius: "10px" }} />
            </div>
            <div style={{ fontSize: "10px", color: solarColor[d.solar], fontWeight: "700" }}>{d.solar}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── MAIN DASHBOARD ──────────────────────────────────────────────────────── */
export default function Dashboard({ user }) {
  const { dashWidgets, setDashWidget, dashTimeRange, setDashTimeRange, accentColor } = useAppStore()
  const { t } = useTranslation()
  const color = user?.color || accentColor || "#4ade80"

  const [liveTS, setLiveTS] = useState(BASE_TS)
  const [showCustomize, setShowCustomize] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      setLiveTS(prev => prev.map((d, i) => {
        if (i !== now_h) return d
        return { ...d, solar: +(d.solar + (Math.random() - 0.5) * 5).toFixed(1), price: +(d.price + (Math.random() - 0.5) * 3).toFixed(1) }
      }))
    }, 4000)
    return () => clearInterval(iv)
  }, [])

  const chartData = dashTimeRange === "24h" ? liveTS.slice(0, 24) : dashTimeRange === "48h" ? liveTS : liveTS.slice(0, 12)

  const todaySolar = liveTS.slice(0, 24).reduce((s, d) => s + d.solar, 0).toFixed(0)
  const todayCO2 = (liveTS.slice(0, 24).reduce((s, d) => s + (d.co2 || 0), 0)).toFixed(1)
  const todayRevenue = (parseFloat(todaySolar) * 0.082).toFixed(0)
  const soc = CURRENT.battery

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  /* ─── Premium SVG icons ──────────────────────────────────────────────────── */
  const SunIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.15"/>
      <circle cx="12" cy="12" r="5"/>
      {[0,45,90,135,180,225,270,315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 12 + 7.5 * Math.cos(rad), y1 = 12 + 7.5 * Math.sin(rad)
        const x2 = 12 + 9.5 * Math.cos(rad), y2 = 12 + 9.5 * Math.sin(rad)
        return <line key={i} x1={x1.toFixed(2)} y1={y1.toFixed(2)} x2={x2.toFixed(2)} y2={y2.toFixed(2)} />
      })}
    </svg>
  )
  const BoltIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fillOpacity="0.9"/>
    </svg>
  )
  const GridIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
  const TrendUpIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  )
  const LeafIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>
  )
  const EuroIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 10h12M4 14h12M15.5 5.5a8 8 0 1 0 0 13"/>
    </svg>
  )

  const KPIS = [
    { key: "solar", label: t("dash_production"), value: CURRENT.solar.toFixed(1), unit: "kW", color: "#f59e0b", trend: 4.2, sparkData: liveTS.slice(0, 24), sparkKey: "solar", icon: <SunIcon /> },
    { key: "load", label: t("dash_consumption"), value: CURRENT.load.toFixed(1), unit: "kW", color: "#a78bfa", trend: -1.8, sparkData: liveTS.slice(0, 24), sparkKey: "load", icon: <BoltIcon /> },
    { key: "grid", label: t("dash_grid_flow"), value: CURRENT.grid.toFixed(1), unit: "kW", color: "#60a5fa", trend: 2.1, sparkData: liveTS.slice(0, 24), sparkKey: "grid", icon: <GridIcon /> },
    { key: "today", label: t("dash_today_prod"), value: todaySolar, unit: "kWh", color, trend: 8.4, sparkData: liveTS.slice(0, 24), sparkKey: "solar", icon: <TrendUpIcon /> },
    { key: "co2", label: t("dash_co2_saved"), value: todayCO2, unit: "kg", color: "#4ade80", trend: 3.5, sparkData: liveTS.slice(0, 24), sparkKey: "co2", icon: <LeafIcon /> },
    { key: "revenue_kpi", label: t("dash_today_revenue"), value: `€${todayRevenue}`, unit: "", color: "#f59e0b", trend: 5.1, sparkData: liveTS.slice(0, 24), sparkKey: "price", icon: <EuroIcon /> },
  ]

  const WIDGET_LABELS = {
    kpis: "KPIs",
    prodVsConsumption: t("dash_prod_vs_cons"),
    marketPrice: t("dash_market_price"),
    battery: t("dash_battery"),
    ai: "AI Engine",
    sites: t("dash_sites_active"),
    soc24h: t("dash_soc_24h"),
    revenue: t("dash_revenue"),
    weatherForecast: t("dash_weather_forecast"),
    recentAlerts: t("dash_recent_alerts"),
    co2saved: t("dash_co2_saved"),
    gridBalance: t("dash_grid_balance"),
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: "1800px" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes shimmer { 0% { opacity: 0.4 } 50% { opacity: 0.8 } 100% { opacity: 0.4 } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "900", margin: 0, letterSpacing: "-0.8px", color: "var(--text)" }}>{t("dash_overview")}</h1>
            <div style={{
              padding: "4px 12px", borderRadius: "20px",
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.25)",
              fontSize: "11px", color: "#4ade80", fontWeight: "700",
              display: "flex", alignItems: "center", gap: "6px",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite", boxShadow: "0 0 6px #4ade80" }} />
              {t("topbar_live")}
            </div>
          </div>
          <p style={{ color: "var(--sub)", fontSize: "13px", marginTop: "5px", textTransform: "capitalize" }}>{dateStr}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <PriceTicker />
          {/* Time range selector */}
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden", backdropFilter: "blur(10px)" }}>
            {["12h", "24h", "48h"].map(r => (
              <button key={r} onClick={() => setDashTimeRange(r)} style={{
                padding: "7px 14px", fontSize: "12px", fontWeight: "600",
                background: dashTimeRange === r ? `${color}18` : "none",
                color: dashTimeRange === r ? color : "var(--sub)",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                borderRight: r !== "48h" ? "1px solid var(--border)" : "none",
              }}>{r}</button>
            ))}
          </div>
          <button onClick={() => setShowCustomize(!showCustomize)} style={{
            padding: "7px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600",
            background: showCustomize ? `${color}18` : "var(--surface)",
            border: `1px solid ${showCustomize ? `${color}45` : "var(--border)"}`,
            color: showCustomize ? color : "var(--sub)", cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: "6px", backdropFilter: "blur(10px)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            {t("dash_customize")}
          </button>
        </div>
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div style={{
          marginBottom: "22px", padding: "18px 22px",
          background: "var(--surface)", backdropFilter: "blur(20px)",
          borderRadius: "14px", border: `1px solid ${color}30`,
          boxShadow: `0 0 30px ${color}10`,
        }}>
          <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em" }}>Widgets</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {Object.entries(WIDGET_LABELS).map(([k, l]) => (
              <WidgetToggle key={k} widgetKey={k} label={l} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* KPI row */}
      {dashWidgets.kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px", marginBottom: "18px" }}>
          {KPIS.map((kpi, i) => <KPICard key={i} {...kpi} />)}
        </div>
      )}

      {/* Main charts row */}
      {(dashWidgets.prodVsConsumption || dashWidgets.marketPrice || dashWidgets.battery || dashWidgets.ai) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: (dashWidgets.prodVsConsumption && dashWidgets.marketPrice)
            ? (dashWidgets.battery || dashWidgets.ai) ? "1fr 1fr 320px" : "1fr 1fr"
            : (dashWidgets.prodVsConsumption || dashWidgets.marketPrice)
              ? (dashWidgets.battery || dashWidgets.ai) ? "1fr 320px" : "1fr"
              : (dashWidgets.battery || dashWidgets.ai) ? "1fr" : "none",
          gap: "16px", marginBottom: "16px",
        }}>

          {/* Production vs Consumption */}
          {dashWidgets.prodVsConsumption && (
            <div style={{
              background: "var(--surface)", backdropFilter: "blur(20px)",
              borderRadius: "16px", padding: "22px",
              border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)" }}>{t("dash_prod_vs_cons")}</div>
                  <div style={{ color: "var(--sub)", fontSize: "11px" }}>{t("dash_24h")}</div>
                </div>
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  {[{ c: "#f59e0b", l: "Solar" }, { c: "#a78bfa", l: "Load" }, { c: "#34d399", l: "Wind" }, { c: "#60a5fa", l: "Grid" }].map(x => (
                    <div key={x.l} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--sub)" }}>
                      <div style={{ width: "20px", height: "3px", background: x.c, borderRadius: "2px", boxShadow: `0 0 6px ${x.c}60` }} />{x.l}
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    {[["gSolar","#f59e0b"],["gLoad","#a78bfa"],["gWind","#34d399"]].map(([id,c]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={String(now_h).padStart(2,"0")+":00"} stroke={color} strokeWidth={1} strokeDasharray="4 2" label={{ value: "Now", fill: color, fontSize: 10 }} />
                  <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={2} fill="url(#gSolar)" name="Solar" />
                  <Area type="monotone" dataKey="load"  stroke="#a78bfa" strokeWidth={2} fill="url(#gLoad)"  name="Load" />
                  <Area type="monotone" dataKey="wind"  stroke="#34d399" strokeWidth={1.5} fill="url(#gWind)" name="Wind" />
                  <Line  type="monotone" dataKey="grid"  stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Grid" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Market Price */}
          {dashWidgets.marketPrice && (
            <div style={{
              background: "var(--surface)", backdropFilter: "blur(20px)",
              borderRadius: "16px", padding: "22px",
              border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)" }}>{t("dash_market_price")}</div>
                  <div style={{ color: "var(--sub)", fontSize: "11px" }}>€/MWh · {t("dash_dayahead")}</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "11px", color: "#4ade80", fontWeight: "700" }}>
                    Min €{Math.min(...chartData.map(d => d.price)).toFixed(0)}
                  </div>
                  <div style={{ padding: "4px 10px", borderRadius: "8px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "11px", color: "#f59e0b", fontWeight: "700" }}>
                    Max €{Math.max(...chartData.map(d => d.price)).toFixed(0)}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} domain={["auto","auto"]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="price" name="€/MWh" fill={color} radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                  <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} dot={false} name="Trend" opacity={0.6} />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{ value: "€80", fill: "#f59e0b", fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Battery + AI — right column */}
          {(dashWidgets.battery || dashWidgets.ai) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {dashWidgets.battery && (
                <div style={{
                  background: "var(--surface)", backdropFilter: "blur(20px)",
                  borderRadius: "16px", padding: "22px",
                  border: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(74,222,128,0.4), transparent)" }} />
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)" }}>{t("dash_battery")}</div>
                      <div style={{ color: "var(--sub)", fontSize: "11px" }}>{t("dash_battery_global")}</div>
                    </div>
                    <div style={{ padding: "3px 10px", borderRadius: "20px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)", fontSize: "11px", color: "#4ade80", fontWeight: "600" }}>{t("operational")}</div>
                  </div>
                  <BatteryRing soc={soc} />
                  <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { l: t("bat_cycles"), v: "1,247", c: "var(--sub)" },
                      { l: t("bat_power"), v: "48 kW", c: "var(--sub)" },
                      { l: t("bat_temp"), v: "28°C", c: "#f59e0b" },
                      { l: t("bat_health"), v: "94%", c: "#4ade80" },
                    ].map(s => (
                      <div key={s.l} style={{ background: "var(--surface2)", borderRadius: "10px", padding: "10px 12px", border: "1px solid var(--border)" }}>
                        <div style={{ color: "var(--sub)", fontSize: "10px" }}>{s.l}</div>
                        <div style={{ color: s.c, fontWeight: "800", fontSize: "14px", marginTop: "3px" }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dashWidgets.ai && <AIPanel color={color} />}
            </div>
          )}
        </div>
      )}

      {/* Second row */}
      {(dashWidgets.sites || dashWidgets.soc24h || dashWidgets.revenue || dashWidgets.weatherForecast || dashWidgets.recentAlerts || dashWidgets.co2saved || dashWidgets.gridBalance) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", marginBottom: "16px" }}>

          {/* Sites status */}
          {dashWidgets.sites && (
            <div style={{
              background: "var(--surface)", backdropFilter: "blur(20px)",
              borderRadius: "16px", padding: "22px",
              border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_sites_active")}</div>
              <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "18px" }}>{t("dash_realtime")}</div>
              {[
                { name: "Rotterdam", country: "🇳🇱", capacity: "2.4 MWh", solar: "156 kW", soc: 78 },
                { name: "Rebordelo", country: "🇵🇹", capacity: "2.4 MWh", solar: "0 kW", soc: 45 },
              ].map(site => (
                <div key={site.name} style={{
                  padding: "14px", background: "var(--surface2)", borderRadius: "12px",
                  border: "1px solid var(--border)", marginBottom: "10px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "18px" }}>{site.country}</span>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text)" }}>{site.name}</div>
                        <div style={{ color: "var(--sub)", fontSize: "10px" }}>{site.capacity} · {site.solar}</div>
                      </div>
                    </div>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.6)" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ color: "var(--sub)", fontSize: "11px" }}>SoC</span>
                    <span style={{ color: site.soc > 50 ? "#4ade80" : "#f59e0b", fontSize: "11px", fontWeight: "700" }}>{site.soc}%</span>
                  </div>
                  <div style={{ height: "5px", background: "var(--surface)", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${site.soc}%`,
                      background: site.soc > 50 ? "linear-gradient(90deg,#14532d,#4ade80)" : "linear-gradient(90deg,#78350f,#f59e0b)",
                      borderRadius: "10px", boxShadow: `0 0 8px ${site.soc > 50 ? "rgba(74,222,128,0.4)" : "rgba(245,158,11,0.4)"}`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SoC 24h */}
          {dashWidgets.soc24h && (
            <div style={{
              background: "var(--surface)", backdropFilter: "blur(20px)",
              borderRadius: "16px", padding: "22px",
              border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(96,165,250,0.4), transparent)" }} />
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_soc_24h")}</div>
              <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "16px" }}>{t("dash_soc_pct")}</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" />
                  <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis domain={[0, 100]} stroke="var(--grid-line)" tick={{ fill: "var(--sub)", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke="rgba(248,113,113,0.5)" strokeDasharray="3 2" strokeWidth={1} />
                  <ReferenceLine y={80} stroke="rgba(74,222,128,0.5)" strokeDasharray="3 2" strokeWidth={1} />
                  <defs>
                    <linearGradient id="gSoc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3}/>
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Line type="monotone" dataKey="battery" stroke="#60a5fa" strokeWidth={2.5} dot={false} name="SoC %" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "14px", height: "1px", borderTop: "1px dashed rgba(74,222,128,0.6)" }} />{t("dash_max_charge")}
                </div>
                <div style={{ fontSize: "11px", color: "var(--sub)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "14px", height: "1px", borderTop: "1px dashed rgba(248,113,113,0.6)" }} />{t("dash_min_charge")}
                </div>
              </div>
            </div>
          )}

          {/* Revenue */}
          {dashWidgets.revenue && (
            <div style={{
              background: "var(--surface)", backdropFilter: "blur(20px)",
              borderRadius: "16px", padding: "22px",
              border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.4), transparent)" }} />
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--text)", marginBottom: "2px" }}>{t("dash_revenue")}</div>
              <div style={{ color: "var(--sub)", fontSize: "11px", marginBottom: "18px" }}>{t("dash_financial")}</div>
              {[
                { label: t("dash_today"), value: `€ ${todayRevenue}`, color, pct: 82 },
                { label: t("dash_week"), value: "€ 2,140", color: "#60a5fa", pct: 60 },
                { label: t("dash_month"), value: "€ 8,920", color: "#a78bfa", pct: 44 },
                { label: t("dash_grid_svc"), value: "€ 1,240", color: "#f59e0b", pct: 32 },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ color: "var(--sub)", fontSize: "12px" }}>{r.label}</span>
                    <span style={{ color: "var(--text)", fontWeight: "700", fontSize: "12px" }}>{r.value}</span>
                  </div>
                  <div style={{ height: "6px", background: "var(--surface2)", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${r.pct}%`,
                      background: `linear-gradient(90deg, ${r.color}50, ${r.color})`,
                      borderRadius: "10px",
                      boxShadow: `0 0 8px ${r.color}40`,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {dashWidgets.weatherForecast && <WeatherWidget />}
          {dashWidgets.recentAlerts && <RecentAlertsWidget />}
          {dashWidgets.co2saved && <CO2Widget data={liveTS} color={color} />}
          {dashWidgets.gridBalance && <GridBalanceWidget data={liveTS} />}
        </div>
      )}
    </div>
  )
}
