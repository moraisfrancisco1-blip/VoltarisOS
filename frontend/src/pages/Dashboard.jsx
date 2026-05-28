import { useEffect, useState, useRef } from "react"
import axios from "axios"
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, CartesianGrid
} from "recharts"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

/* ─── helpers ─────────────────────────────────────────────────────────────── */
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

/* ─── Shared Tooltip ──────────────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "#0d1525", border: "1px solid #1f2937", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", zIndex: 100 }}>
      <div style={{ color: "#9ca3af", marginBottom: "6px", fontWeight: "600" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "12px", marginBottom: "2px", justifyContent: "space-between" }}>
          <span>{p.name}</span>
          <span style={{ color: "white", fontWeight: "700" }}>{p.value}</span>
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
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${dataKey})`} dot={false} />
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
  return (
    <div style={{ position: "relative", width: "120px", height: "120px" }}>
      <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={ringColor} strokeWidth="10"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "22px", fontWeight: "800", color: ringColor }}>{pct.toFixed(0)}%</div>
        <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "1px" }}>SoC</div>
      </div>
    </div>
  )
}

/* ─── KPI Card ────────────────────────────────────────────────────────────── */
function KPICard({ label, value, unit, color, trend, sparkData, sparkKey, icon, subtitle }) {
  const up = trend >= 0
  return (
    <div style={{
      background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
      borderRadius: "14px", padding: "18px 20px",
      border: "1px solid #1a2234",
      display: "flex", flexDirection: "column", gap: "8px",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: color + "18", filter: "blur(20px)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#4b5563", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "500" }}>{label}</div>
          {subtitle && <div style={{ color: "#374151", fontSize: "10px", marginTop: "1px" }}>{subtitle}</div>}
          <div style={{ marginTop: "6px", fontSize: "28px", fontWeight: "800", color: "white", lineHeight: 1 }}>
            {value}<span style={{ fontSize: "13px", fontWeight: "400", color: "#6b7280", marginLeft: "4px" }}>{unit}</span>
          </div>
        </div>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: color + "18", border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      {sparkData && <Sparkline data={sparkData} dataKey={sparkKey} color={color} />}
      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ color: up ? "#4ade80" : "#f87171", fontSize: "12px" }}>{up ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%</span>
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
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderRadius: "20px", background: dir > 0 ? "#0a2a1a" : "#2a0a0a", border: `1px solid ${dir > 0 ? "#14532d" : "#450a0a"}` }}>
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: dir > 0 ? "#4ade80" : "#f87171", animation: "pulse 1.5s infinite" }} />
      <span style={{ color: "#6b7280", fontSize: "11px" }}>{t("topbar_live")}</span>
      <span style={{ color: "white", fontWeight: "700", fontSize: "15px" }}>€{price.toFixed(2)}</span>
      <span style={{ color: "#4b5563", fontSize: "11px" }}>/MWh</span>
      <span style={{ color: dir > 0 ? "#4ade80" : "#f87171", fontSize: "12px" }}>{dir > 0 ? "▲" : "▼"}</span>
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
    charge: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    discharge: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    hold: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  }

  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", border: `1px solid ${dc}44`, padding: "20px", display: "flex", flexDirection: "column", gap: "12px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 80% 20%, ${dc}0a, transparent 60%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}><path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.93V18h-2v-1.07A8 8 0 0 1 4.07 9H6.1a6 6 0 0 0 5.9 5h.06a6 6 0 0 0 5.84-5h2.03A8 8 0 0 1 13 16.93z"/></svg>
        <span style={{ color: "#6b7280", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>{t("dash_ai_engine")}</span>
      </div>
      {loading ? (
        <div style={{ color: "#4b5563", fontSize: "13px" }}>{t("dash_processing")}</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: dc + "18", border: `1px solid ${dc}44`, display: "flex", alignItems: "center", justifyContent: "center", color: dc }}>
              {icons[decision]}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: dc, textTransform: "uppercase", letterSpacing: "1px" }}>
                {t(`ai_${decision}`)}
              </div>
              <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "2px", maxWidth: "160px" }}>
                {t(`ai_reason_${decision}`)}
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "#4b5563", fontSize: "11px" }}>{t("dash_confidence")}</span>
              <span style={{ color: dc, fontWeight: "700", fontSize: "12px" }}>{confidence}%</span>
            </div>
            <div style={{ height: "6px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${confidence}%`, background: `linear-gradient(90deg, ${dc}88, ${dc})`, borderRadius: "10px", transition: "width 0.8s ease" }} />
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
        padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "500",
        background: active ? `${color}20` : "#0d1525",
        border: `1px solid ${active ? color + "50" : "#1e2d45"}`,
        color: active ? color : "#4b5563",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {active ? "✓ " : "+ "}{label}
    </button>
  )
}

/* ─── CO2 Widget ──────────────────────────────────────────────────────────── */
function CO2Widget({ data, color }) {
  const total = data.slice(0, 24).reduce((s, d) => s + (d.co2 || 0), 0).toFixed(1)
  const equiv = (total / 8.4).toFixed(0)
  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
      <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>CO₂ Evitado</div>
      <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "12px" }}>Hoje · kg CO₂eq</div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "14px" }}>
        <div>
          <div style={{ fontSize: "32px", fontWeight: "800", color: "#4ade80" }}>{total}</div>
          <div style={{ fontSize: "11px", color: "#6b7280" }}>kg CO₂ hoje</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "2px" }}>≈ {equiv} árvores/dia</div>
          <div style={{ fontSize: "11px", color: "#374151" }}>Equivalente em sequestro</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data.slice(0, 24)} margin={{ top: 2, right: 0, left: -30, bottom: 0 }}>
          <defs>
            <linearGradient id="gCo2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} interval={5} />
          <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="co2" stroke="#4ade80" strokeWidth={1.5} fill="url(#gCo2)" name="CO₂ kg" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Grid Balance Widget ─────────────────────────────────────────────────── */
function GridBalanceWidget({ data }) {
  const net = data.slice(0, 24).map(d => ({ ...d, net: +(d.solar - d.load).toFixed(1) }))
  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
      <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Balanço Rede</div>
      <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "12px" }}>Solar − Consumo · kW</div>
      <ResponsiveContainer width="100%" height={110}>
        <ComposedChart data={net} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} interval={5} />
          <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 9 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
          <Bar dataKey="net" name="Net kW" radius={[2, 2, 0, 0]}
            fill="#60a5fa"
            label={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Alerts Widget ───────────────────────────────────────────────────────── */
function RecentAlertsWidget() {
  const { notifications } = useAppStore()
  const unread = notifications.filter(n => !n.read).slice(0, 4)
  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div>
          <div style={{ fontWeight: "700", fontSize: "14px" }}>Alertas Recentes</div>
          <div style={{ color: "#4b5563", fontSize: "11px" }}>{unread.length} não lidos</div>
        </div>
        {unread.length > 0 && <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f87171", animation: "pulse 1.5s infinite" }} />}
      </div>
      {unread.length === 0 ? (
        <div style={{ color: "#374151", fontSize: "13px", textAlign: "center", padding: "12px 0" }}>✓ Nenhum alerta ativo</div>
      ) : (
        unread.map(n => (
          <div key={n.id} style={{ padding: "9px 10px", background: "#0d1525", borderRadius: "8px", border: "1px solid #1a2234", marginBottom: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#e5e7eb" }}>{n.title}</div>
              <div style={{ fontSize: "10px", color: "#374151" }}>{n.time}</div>
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>{n.body}</div>
          </div>
        ))
      )}
    </div>
  )
}

/* ─── Weather Forecast ────────────────────────────────────────────────────── */
function WeatherWidget() {
  const forecast = [
    { day: "Hoje", icon: "☀", temp: "22°", solar: "Alta" },
    { day: "Amanhã", icon: "⛅", temp: "18°", solar: "Média" },
    { day: "Sáb", icon: "🌤", temp: "20°", solar: "Alta" },
    { day: "Dom", icon: "🌧", temp: "14°", solar: "Baixa" },
    { day: "Seg", icon: "☀", temp: "24°", solar: "Alta" },
  ]
  const solarColor = { "Alta": "#f59e0b", "Média": "#60a5fa", "Baixa": "#6b7280" }
  return (
    <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
      <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Previsão Meteorológica</div>
      <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "14px" }}>Irradiância solar prevista</div>
      <div style={{ display: "flex", gap: "8px" }}>
        {forecast.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 4px", background: "#0d1525", borderRadius: "10px", border: "1px solid #1a2234" }}>
            <div style={{ fontSize: "10px", color: "#4b5563", marginBottom: "4px" }}>{d.day}</div>
            <div style={{ fontSize: "20px", marginBottom: "4px" }}>{d.icon}</div>
            <div style={{ fontSize: "12px", fontWeight: "700", color: "white", marginBottom: "4px" }}>{d.temp}</div>
            <div style={{ fontSize: "10px", color: solarColor[d.solar], fontWeight: "600" }}>{d.solar}</div>
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

  // Filter data based on time range
  const chartData = dashTimeRange === "24h" ? liveTS.slice(0, 24) : dashTimeRange === "48h" ? liveTS : liveTS.slice(0, 12)

  const todaySolar = liveTS.slice(0, 24).reduce((s, d) => s + d.solar, 0).toFixed(0)
  const todayLoad = liveTS.slice(0, 24).reduce((s, d) => s + d.load, 0).toFixed(0)
  const soc = CURRENT.battery
  const todayRevenue = (parseFloat(todaySolar) * 0.082).toFixed(0)
  const todayCO2 = (liveTS.slice(0, 24).reduce((s, d) => s + (d.co2 || 0), 0)).toFixed(1)

  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const KPIS = [
    { key: "solar", label: t("dash_production"), value: CURRENT.solar.toFixed(1), unit: "kW", color: "#f59e0b", trend: 4.2, sparkData: liveTS.slice(0, 24), sparkKey: "solar", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg> },
    { key: "load", label: t("dash_consumption"), value: CURRENT.load.toFixed(1), unit: "kW", color: "#a78bfa", trend: -1.8, sparkData: liveTS.slice(0, 24), sparkKey: "load", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
    { key: "grid", label: t("dash_grid_flow"), value: CURRENT.grid.toFixed(1), unit: "kW", color: "#60a5fa", trend: 2.1, sparkData: liveTS.slice(0, 24), sparkKey: "grid", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
    { key: "today", label: t("dash_today_prod"), value: todaySolar, unit: "kWh", color, trend: 8.4, sparkData: liveTS.slice(0, 24), sparkKey: "solar", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
    { key: "co2", label: "CO₂ Evitado", value: todayCO2, unit: "kg", color: "#4ade80", trend: 3.5, sparkData: liveTS.slice(0, 24), sparkKey: "co2", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { key: "revenue_kpi", label: "Receita Hoje", value: `€${todayRevenue}`, unit: "", color: "#f59e0b", trend: 5.1, sparkData: liveTS.slice(0, 24), sparkKey: "price", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  ]

  const WIDGET_LABELS = {
    kpis: "KPIs", prodVsConsumption: "Prod vs Consumo", marketPrice: "Preço Mercado",
    battery: "Bateria", ai: "AI Engine", sites: "Sites", soc24h: "SoC 24h",
    revenue: "Receita", weatherForecast: "Meteorologia", recentAlerts: "Alertas",
    co2saved: "CO₂ Evitado", gridBalance: "Balanço Rede",
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: "1800px" }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>{t("dash_overview")}</h1>
            <div style={{ padding: "3px 10px", borderRadius: "20px", background: "#0a2a1a", border: "1px solid #14532d", fontSize: "11px", color: "#4ade80", fontWeight: "600", display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
              {t("topbar_live")}
            </div>
          </div>
          <p style={{ color: "#4b5563", fontSize: "13px", marginTop: "4px", textTransform: "capitalize" }}>{dateStr}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <PriceTicker />

          {/* Time range selector */}
          <div style={{ display: "flex", background: "#0d1525", border: "1px solid #1e2d45", borderRadius: "8px", overflow: "hidden" }}>
            {["12h", "24h", "48h"].map(r => (
              <button key={r} onClick={() => setDashTimeRange(r)}
                style={{
                  padding: "6px 12px", fontSize: "12px", fontWeight: "500",
                  background: dashTimeRange === r ? `${color}20` : "none",
                  color: dashTimeRange === r ? color : "#4b5563",
                  border: "none", cursor: "pointer", transition: "all 0.15s",
                  borderRight: r !== "48h" ? "1px solid #1e2d45" : "none",
                }}
              >{r}</button>
            ))}
          </div>

          {/* Customize */}
          <button
            onClick={() => setShowCustomize(!showCustomize)}
            style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "500",
              background: showCustomize ? `${color}20` : "#0d1525",
              border: `1px solid ${showCustomize ? color + "50" : "#1e2d45"}`,
              color: showCustomize ? color : "#6b7280", cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Personalizar
          </button>
        </div>
      </div>

      {/* Customize panel */}
      {showCustomize && (
        <div style={{ marginBottom: "20px", padding: "16px 20px", background: "#0d1525", borderRadius: "12px", border: `1px solid ${color}30` }}>
          <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px", fontWeight: "500" }}>WIDGETS VISÍVEIS</div>
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

      {/* Main charts row — fills full width, no empty space */}
      {(dashWidgets.prodVsConsumption || dashWidgets.marketPrice || dashWidgets.battery || dashWidgets.ai) && (
        <div style={{
          display: "grid",
          gridTemplateColumns: (dashWidgets.prodVsConsumption && dashWidgets.marketPrice)
            ? (dashWidgets.battery || dashWidgets.ai) ? "1fr 1fr 320px" : "1fr 1fr"
            : (dashWidgets.prodVsConsumption || dashWidgets.marketPrice)
              ? (dashWidgets.battery || dashWidgets.ai) ? "1fr 320px" : "1fr"
              : (dashWidgets.battery || dashWidgets.ai) ? "1fr" : "none",
          gap: "16px",
          marginBottom: "16px",
        }}>

          {/* Production vs Consumption */}
          {dashWidgets.prodVsConsumption && (
            <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px" }}>{t("dash_prod_vs_cons")}</div>
                  <div style={{ color: "#4b5563", fontSize: "11px" }}>{t("dash_24h")}</div>
                </div>
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                  {[{ c: "#f59e0b", l: "Solar" }, { c: "#a78bfa", l: "Consumo" }, { c: "#60a5fa", l: "Rede" }, { c: "#34d399", l: "Eólica" }].map(x => (
                    <div key={x.l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#6b7280" }}>
                      <div style={{ width: "8px", height: "2px", background: x.c, borderRadius: "2px" }} />{x.l}
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2234" />
                  <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={String(now_h).padStart(2,"0")+":00"} stroke={color} strokeWidth={1} strokeDasharray="4 2" label={{ value: "Agora", fill: color, fontSize: 10 }} />
                  <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={2} fill="url(#gSolar)" name="Solar" />
                  <Area type="monotone" dataKey="load"  stroke="#a78bfa" strokeWidth={2} fill="url(#gLoad)"  name="Consumo" />
                  <Area type="monotone" dataKey="wind"  stroke="#34d399" strokeWidth={1.5} fill="url(#gWind)" name="Eólica" />
                  <Line  type="monotone" dataKey="grid"  stroke="#60a5fa" strokeWidth={1.5} dot={false} name="Rede" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Market Price */}
          {dashWidgets.marketPrice && (
            <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px" }}>{t("dash_market_price")}</div>
                  <div style={{ color: "#4b5563", fontSize: "11px" }}>€/MWh · {t("dash_dayahead")}</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ padding: "3px 8px", borderRadius: "6px", background: "#0a2a1a", fontSize: "11px", color: "#4ade80", fontWeight: "600" }}>
                    Min: €{Math.min(...chartData.map(d => d.price)).toFixed(0)}
                  </div>
                  <div style={{ padding: "3px 8px", borderRadius: "6px", background: "#2a1a0a", fontSize: "11px", color: "#f59e0b", fontWeight: "600" }}>
                    Max: €{Math.max(...chartData.map(d => d.price)).toFixed(0)}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2234" />
                  <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} interval={Math.floor(chartData.length / 8)} />
                  <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} domain={["auto","auto"]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="price" name="€/MWh" fill={color} radius={[3, 3, 0, 0]} fillOpacity={0.75} />
                  <Line type="monotone" dataKey="price" stroke={color} strokeWidth={1} dot={false} name="Tendência" opacity={0.5} />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{ value: "€80 limiar", fill: "#f59e0b", fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Battery + AI — right column */}
          {(dashWidgets.battery || dashWidgets.ai) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {dashWidgets.battery && (
                <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234", display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>{t("dash_battery")}</div>
                      <div style={{ color: "#4b5563", fontSize: "11px" }}>{t("dash_battery_global")}</div>
                    </div>
                    <div style={{ padding: "3px 10px", borderRadius: "20px", background: "#0a2a1a", border: "1px solid #14532d", fontSize: "11px", color: "#4ade80" }}>{t("operational")}</div>
                  </div>
                  <BatteryRing soc={soc} />
                  <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {[
                      { l: t("bat_cycles"), v: "1,247", c: "#6b7280" },
                      { l: t("bat_power"), v: "48 kW", c: "#6b7280" },
                      { l: t("bat_temp"), v: "28°C", c: "#f59e0b" },
                      { l: t("bat_health"), v: "94%", c: "#4ade80" },
                    ].map(s => (
                      <div key={s.l} style={{ background: "#0d1525", borderRadius: "8px", padding: "8px 10px", border: "1px solid #1a2234" }}>
                        <div style={{ color: "#374151", fontSize: "10px" }}>{s.l}</div>
                        <div style={{ color: s.c, fontWeight: "700", fontSize: "13px", marginTop: "2px" }}>{s.v}</div>
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
            <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{t("dash_sites_active")}</div>
              <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "16px" }}>{t("dash_realtime")}</div>
              {[
                { name: "Rotterdam", country: "🇳🇱", capacity: "2.4 MWh", solar: "156 kW", status: "online", soc: 78 },
                { name: "Rebordelo", country: "🇵🇹", capacity: "2.4 MWh", solar: "0 kW", status: "online", soc: 45 },
              ].map(site => (
                <div key={site.name} style={{ padding: "12px", background: "#0d1525", borderRadius: "10px", border: "1px solid #1a2234", marginBottom: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "16px" }}>{site.country}</span>
                      <div>
                        <div style={{ fontWeight: "600", fontSize: "13px" }}>{site.name}</div>
                        <div style={{ color: "#4b5563", fontSize: "10px" }}>{site.capacity} · {site.solar}</div>
                      </div>
                    </div>
                    <div style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "10px", background: "#0a2a1a", border: "1px solid #14532d", color: "#4ade80" }}>{t("online")}</div>
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span style={{ color: "#4b5563", fontSize: "10px" }}>SoC</span>
                      <span style={{ color: site.soc > 50 ? "#4ade80" : "#f59e0b", fontSize: "10px", fontWeight: "700" }}>{site.soc}%</span>
                    </div>
                    <div style={{ height: "4px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${site.soc}%`, background: site.soc > 50 ? "linear-gradient(90deg,#14532d,#4ade80)" : "linear-gradient(90deg,#78350f,#f59e0b)", borderRadius: "10px" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SoC 24h */}
          {dashWidgets.soc24h && (
            <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{t("dash_soc_24h")}</div>
              <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "14px" }}>{t("dash_soc_pct")}</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a2234" />
                  <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} interval={Math.floor(chartData.length / 6)} />
                  <YAxis domain={[0, 100]} stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={20} stroke="#f87171" strokeDasharray="3 2" strokeWidth={1} />
                  <ReferenceLine y={80} stroke="#4ade80" strokeDasharray="3 2" strokeWidth={1} />
                  <Line type="monotone" dataKey="battery" stroke="#60a5fa" strokeWidth={2.5} dot={false} name="SoC %" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                <div style={{ fontSize: "11px", color: "#374151", display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "12px", height: "1px", borderTop: "1px dashed #4ade80" }} />{t("dash_max_charge")}
                </div>
                <div style={{ fontSize: "11px", color: "#374151", display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "12px", height: "1px", borderTop: "1px dashed #f87171" }} />{t("dash_min_charge")}
                </div>
              </div>
            </div>
          )}

          {/* Revenue */}
          {dashWidgets.revenue && (
            <div style={{ background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)", borderRadius: "14px", padding: "20px", border: "1px solid #1a2234" }}>
              <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{t("dash_revenue")}</div>
              <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "16px" }}>{t("dash_financial")}</div>
              {[
                { label: t("dash_today"), value: `€ ${todayRevenue}`, color, pct: 82 },
                { label: t("dash_week"), value: "€ 2,140", color: "#60a5fa", pct: 60 },
                { label: t("dash_month"), value: "€ 8,920", color: "#a78bfa", pct: 44 },
                { label: t("dash_grid_svc"), value: "€ 1,240", color: "#f59e0b", pct: 32 },
              ].map(r => (
                <div key={r.label} style={{ marginBottom: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "#6b7280", fontSize: "12px" }}>{r.label}</span>
                    <span style={{ color: "white", fontWeight: "700", fontSize: "12px" }}>{r.value}</span>
                  </div>
                  <div style={{ height: "5px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.pct}%`, background: `linear-gradient(90deg, ${r.color}66, ${r.color})`, borderRadius: "10px" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Weather */}
          {dashWidgets.weatherForecast && <WeatherWidget />}

          {/* Recent Alerts */}
          {dashWidgets.recentAlerts && <RecentAlertsWidget />}

          {/* CO2 */}
          {dashWidgets.co2saved && <CO2Widget data={liveTS} color={color} />}

          {/* Grid Balance */}
          {dashWidgets.gridBalance && <GridBalanceWidget data={liveTS} />}
        </div>
      )}
    </div>
  )
}
