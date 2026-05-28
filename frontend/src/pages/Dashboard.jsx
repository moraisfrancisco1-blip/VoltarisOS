import { useEffect, useState, useRef } from "react"
import axios from "axios"
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts"

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function rand(min, max, dec = 1) {
  return +(Math.random() * (max - min) + min).toFixed(dec)
}
function generateTimeseries(hours = 24) {
  return Array.from({ length: hours }, (_, i) => {
    const h = i
    const solar = h >= 6 && h <= 19
      ? Math.max(0, Math.sin(((h - 6) / 13) * Math.PI) * rand(180, 240))
      : 0
    const load = rand(60, 120) + (h >= 8 && h <= 20 ? rand(30, 70) : 0)
    const grid = Math.max(0, load - solar - rand(10, 30))
    const battery = 40 + 40 * Math.sin(((h) / 24) * Math.PI)
    const price = rand(55, 130)
    return {
      time: `${String(h).padStart(2, "0")}:00`,
      solar: +solar.toFixed(1),
      load: +load.toFixed(1),
      grid: +grid.toFixed(1),
      battery: +battery.toFixed(1),
      price,
    }
  })
}

const TS = generateTimeseries()
const now = new Date().getHours()
const CURRENT = TS[now] || TS[12]

/* ─── sub-components ──────────────────────────────────────────────────────── */
function Sparkline({ data, dataKey, color, height = 40 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5}
          fill={`url(#spark-${dataKey})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function BatteryRing({ soc, color }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(soc, 0), 100)
  const dash = (pct / 100) * circ
  const gap = circ - dash
  const ringColor = pct > 60 ? "#4ade80" : pct > 30 ? "#f59e0b" : "#f87171"

  return (
    <div style={{ position: "relative", width: "120px", height: "120px" }}>
      <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1f2937" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={ringColor}
          strokeWidth="10"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center"
      }}>
        <div style={{ fontSize: "22px", fontWeight: "800", color: ringColor }}>{pct.toFixed(0)}%</div>
        <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "1px" }}>SoC</div>
      </div>
    </div>
  )
}

function KPICard({ label, value, unit, color, trend, sparkData, sparkKey, icon }) {
  const up = trend >= 0
  return (
    <div style={{
      background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
      borderRadius: "14px",
      padding: "18px 20px",
      border: "1px solid #1a2234",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* glow */}
      <div style={{
        position: "absolute", top: "-20px", right: "-20px",
        width: "80px", height: "80px",
        borderRadius: "50%",
        background: color + "18",
        filter: "blur(20px)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#4b5563", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "500" }}>
            {label}
          </div>
          <div style={{ marginTop: "6px", fontSize: "28px", fontWeight: "800", color: "white", lineHeight: 1 }}>
            {value}
            <span style={{ fontSize: "13px", fontWeight: "400", color: "#6b7280", marginLeft: "4px" }}>{unit}</span>
          </div>
        </div>
        <div style={{
          width: "38px", height: "38px",
          borderRadius: "10px",
          background: color + "18",
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
      </div>

      {sparkData && (
        <Sparkline data={sparkData} dataKey={sparkKey} color={color} />
      )}

      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ color: up ? "#4ade80" : "#f87171", fontSize: "12px" }}>
            {up ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}%
          </span>
          <span style={{ color: "#374151", fontSize: "11px" }}>vs. hora anterior</span>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#0d1525", border: "1px solid #1f2937",
      borderRadius: "10px", padding: "10px 14px",
      fontSize: "12px",
    }}>
      <div style={{ color: "#9ca3af", marginBottom: "6px" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, display: "flex", gap: "8px", marginBottom: "2px" }}>
          <span>{p.name}</span>
          <span style={{ color: "white", fontWeight: "600" }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ─── live price ticker ───────────────────────────────────────────────────── */
function PriceTicker({ color }) {
  const [price, setPrice] = useState(74.2)
  const [dir, setDir] = useState(1)
  useEffect(() => {
    const iv = setInterval(() => {
      setPrice(p => {
        const next = +(p + (Math.random() - 0.48) * 2.5).toFixed(2)
        setDir(next >= p ? 1 : -1)
        return Math.max(20, Math.min(200, next))
      })
    }, 2000)
    return () => clearInterval(iv)
  }, [])
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      padding: "5px 12px", borderRadius: "20px",
      background: dir > 0 ? "#0a2a1a" : "#2a0a0a",
      border: `1px solid ${dir > 0 ? "#14532d" : "#450a0a"}`,
    }}>
      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: dir > 0 ? "#4ade80" : "#f87171", animation: "pulse 1.5s infinite" }} />
      <span style={{ color: "#6b7280", fontSize: "11px" }}>LIVE</span>
      <span style={{ color: "white", fontWeight: "700", fontSize: "15px" }}>€{price.toFixed(2)}</span>
      <span style={{ color: "#4b5563", fontSize: "11px" }}>/MWh</span>
      <span style={{ color: dir > 0 ? "#4ade80" : "#f87171", fontSize: "12px" }}>{dir > 0 ? "▲" : "▼"}</span>
    </div>
  )
}

/* ─── AI Decision panel ────────────────────────────────────────────────────── */
function AIPanel({ color }) {
  const [decision, setDecision] = useState(null)
  const [confidence, setConfidence] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState("")

  useEffect(() => {
    const reasons = {
      charge: "Preço abaixo do limiar — ótimo para carregar bateria.",
      discharge: "Preço elevado — venda de energia maximiza receita.",
      hold: "Mercado instável — manter posição atual.",
    }
    axios.get("/ai_decision?price=74&battery=0.5")
      .then(r => {
        const d = r.data.decision || "hold"
        setDecision(d)
        setConfidence(rand(72, 95, 0))
        setReason(reasons[d])
      })
      .catch(() => {
        setDecision("hold")
        setConfidence(81)
        setReason(reasons.hold)
      })
      .finally(() => setLoading(false))
  }, [])

  const colors = { charge: "#4ade80", discharge: "#f87171", hold: "#f59e0b" }
  const icons = {
    charge: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    discharge: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    hold: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  }

  const dc = decision ? colors[decision] : "#6b7280"

  return (
    <div style={{
      background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
      borderRadius: "14px",
      border: `1px solid ${dc}44`,
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 80% 20%, ${dc}0a, transparent 60%)`, pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill={color}>
          <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 14.93V18h-2v-1.07A8 8 0 0 1 4.07 9H6.1a6 6 0 0 0 5.9 5h.06a6 6 0 0 0 5.84-5h2.03A8 8 0 0 1 13 16.93z"/>
        </svg>
        <span style={{ color: "#6b7280", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>AI Engine · Recomendação</span>
      </div>
      {loading ? (
        <div style={{ color: "#4b5563", fontSize: "13px" }}>A processar...</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "14px",
              background: dc + "18", border: `1px solid ${dc}44`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: dc,
            }}>
              {icons[decision]}
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: dc, textTransform: "uppercase", letterSpacing: "1px" }}>
                {decision}
              </div>
              <div style={{ color: "#6b7280", fontSize: "12px", marginTop: "2px" }}>{reason}</div>
            </div>
          </div>

          {/* Confidence bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ color: "#4b5563", fontSize: "11px" }}>Confiança do modelo</span>
              <span style={{ color: dc, fontWeight: "700", fontSize: "12px" }}>{confidence}%</span>
            </div>
            <div style={{ height: "6px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${confidence}%`,
                background: `linear-gradient(90deg, ${dc}88, ${dc})`,
                borderRadius: "10px",
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ─── MAIN DASHBOARD ──────────────────────────────────────────────────────── */
export default function Dashboard({ user }) {
  const color = user?.color || "#4ade80"
  const now_h = new Date().getHours()
  const currentIdx = now_h
  const todaySolar = TS.reduce((s, t) => s + t.solar, 0).toFixed(0)
  const todayLoad = TS.reduce((s, t) => s + t.load, 0).toFixed(0)
  const soc = CURRENT.battery

  const dateStr = new Date().toLocaleDateString("pt-PT", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  })

  /* live updates */
  const [liveTS, setLiveTS] = useState(TS)
  useEffect(() => {
    const iv = setInterval(() => {
      setLiveTS(prev => prev.map((d, i) => {
        if (i !== now_h) return d
        return { ...d, solar: +(d.solar + (Math.random() - 0.5) * 5).toFixed(1) }
      }))
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  const KPIS = [
    {
      label: "Produção Solar",
      value: CURRENT.solar.toFixed(1),
      unit: "kW",
      color: "#f59e0b",
      trend: 4.2,
      sparkData: liveTS,
      sparkKey: "solar",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    },
    {
      label: "Consumo Total",
      value: CURRENT.load.toFixed(1),
      unit: "kW",
      color: "#a78bfa",
      trend: -1.8,
      sparkData: liveTS,
      sparkKey: "load",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    },
    {
      label: "Fluxo Rede",
      value: CURRENT.grid.toFixed(1),
      unit: "kW",
      color: "#60a5fa",
      trend: 2.1,
      sparkData: liveTS,
      sparkKey: "grid",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    },
    {
      label: "Produção Hoje",
      value: todaySolar,
      unit: "kWh",
      color: color,
      trend: 8.4,
      sparkData: liveTS,
      sparkKey: "solar",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    },
  ]

  return (
    <div style={{ padding: "28px", maxWidth: "1600px" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.3 }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h1 style={{ fontSize: "26px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>
              Overview
            </h1>
            <div style={{
              padding: "3px 10px", borderRadius: "20px",
              background: "#0a2a1a", border: "1px solid #14532d",
              fontSize: "11px", color: "#4ade80", fontWeight: "600",
              display: "flex", alignItems: "center", gap: "5px",
            }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
              LIVE
            </div>
          </div>
          <p style={{ color: "#4b5563", fontSize: "13px", marginTop: "4px", textTransform: "capitalize" }}>{dateStr}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <PriceTicker color={color} />
          <div style={{
            padding: "5px 14px", borderRadius: "20px",
            background: "#0d1525", border: "1px solid #1a2234",
            fontSize: "12px", color: "#6b7280",
          }}>
            2 sites · 4.8 MWh cap
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {KPIS.map((kpi, i) => <KPICard key={i} {...kpi} />)}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 340px", gap: "16px", marginBottom: "16px" }}>

        {/* Solar + Load chart */}
        <div style={{
          background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
          borderRadius: "14px", padding: "20px",
          border: "1px solid #1a2234",
          gridColumn: "1 / 2",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>Produção vs Consumo</div>
              <div style={{ color: "#4b5563", fontSize: "11px" }}>kW · 24h</div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              {[{ c: "#f59e0b", l: "Solar" }, { c: "#a78bfa", l: "Consumo" }, { c: "#60a5fa", l: "Rede" }].map(x => (
                <div key={x.l} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#6b7280" }}>
                  <div style={{ width: "8px", height: "2px", background: x.c, borderRadius: "2px" }} />
                  {x.l}
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={liveTS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSolar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLoad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }}
                interval={3} />
              <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine x={String(now_h).padStart(2,"0")+":00"} stroke={color} strokeWidth={1} strokeDasharray="4 2" />
              <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={2}
                fill="url(#gSolar)" name="Solar" />
              <Area type="monotone" dataKey="load" stroke="#a78bfa" strokeWidth={2}
                fill="url(#gLoad)" name="Consumo" />
              <Line type="monotone" dataKey="grid" stroke="#60a5fa" strokeWidth={1.5}
                dot={false} name="Rede" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Price chart */}
        <div style={{
          background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
          borderRadius: "14px", padding: "20px",
          border: "1px solid #1a2234",
        }}>
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontWeight: "700", fontSize: "14px" }}>Preço de Mercado</div>
            <div style={{ color: "#4b5563", fontSize: "11px" }}>€/MWh · day-ahead</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={liveTS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} interval={3} />
              <YAxis stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="price" name="€/MWh"
                fill={color}
                radius={[3, 3, 0, 0]}
                fillOpacity={0.8}
              />
              <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
            <div style={{ fontSize: "11px", color: "#374151", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "20px", height: "1px", background: "#f59e0b", borderTop: "1px dashed #f59e0b" }} />
              limiar €80/MWh
            </div>
          </div>
        </div>

        {/* Battery + AI panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Battery ring */}
          <div style={{
            background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
            borderRadius: "14px", padding: "20px",
            border: "1px solid #1a2234",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "14px",
          }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: "700", fontSize: "14px" }}>Bateria</div>
                <div style={{ color: "#4b5563", fontSize: "11px" }}>Estado global</div>
              </div>
              <div style={{
                padding: "3px 10px", borderRadius: "20px",
                background: "#0a2a1a", border: "1px solid #14532d",
                fontSize: "11px", color: "#4ade80",
              }}>
                Operacional
              </div>
            </div>
            <BatteryRing soc={soc} color={color} />
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { l: "Ciclos", v: "1,247", c: "#6b7280" },
                { l: "Potência", v: "48 kW", c: "#6b7280" },
                { l: "Temp.", v: "28°C", c: "#f59e0b" },
                { l: "Saúde", v: "94%", c: "#4ade80" },
              ].map(s => (
                <div key={s.l} style={{
                  background: "#0d1525", borderRadius: "8px",
                  padding: "8px 10px", border: "1px solid #1a2234",
                }}>
                  <div style={{ color: "#374151", fontSize: "10px" }}>{s.l}</div>
                  <div style={{ color: s.c, fontWeight: "700", fontSize: "13px", marginTop: "2px" }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI */}
          <AIPanel color={color} />
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>

        {/* Sites status */}
        <div style={{
          background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
          borderRadius: "14px", padding: "20px",
          border: "1px solid #1a2234",
        }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Sites Ativos</div>
          <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "16px" }}>Status em tempo real</div>
          {[
            { name: "Rotterdam", country: "🇳🇱", capacity: "2.4 MWh", solar: "156 kW", status: "online", soc: 78 },
            { name: "Rebordelo", country: "🇵🇹", capacity: "2.4 MWh", solar: "0 kW", status: "online", soc: 45 },
          ].map(site => (
            <div key={site.name} style={{
              padding: "12px",
              background: "#0d1525",
              borderRadius: "10px",
              border: "1px solid #1a2234",
              marginBottom: "8px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>{site.country}</span>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "13px" }}>{site.name}</div>
                    <div style={{ color: "#4b5563", fontSize: "10px" }}>{site.capacity}</div>
                  </div>
                </div>
                <div style={{
                  padding: "2px 8px", borderRadius: "20px", fontSize: "10px",
                  background: "#0a2a1a", border: "1px solid #14532d", color: "#4ade80",
                }}>
                  {site.status}
                </div>
              </div>
              <div style={{ marginTop: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ color: "#4b5563", fontSize: "10px" }}>SoC</span>
                  <span style={{ color: site.soc > 50 ? "#4ade80" : "#f59e0b", fontSize: "10px", fontWeight: "700" }}>{site.soc}%</span>
                </div>
                <div style={{ height: "4px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${site.soc}%`,
                    background: site.soc > 50
                      ? `linear-gradient(90deg, #14532d, #4ade80)`
                      : `linear-gradient(90deg, #78350f, #f59e0b)`,
                    borderRadius: "10px",
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* SoC 24h */}
        <div style={{
          background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
          borderRadius: "14px", padding: "20px",
          border: "1px solid #1a2234",
        }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Bateria · 24h</div>
          <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "16px" }}>Estado de Carga (%)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={liveTS} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gSoC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} interval={3} />
              <YAxis domain={[0, 100]} stroke="#1f2937" tick={{ fill: "#374151", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={20} stroke="#f87171" strokeDasharray="3 2" strokeWidth={1} />
              <ReferenceLine y={80} stroke="#4ade80" strokeDasharray="3 2" strokeWidth={1} />
              <Line type="monotone" dataKey="battery" stroke="#60a5fa" strokeWidth={2.5}
                dot={false} name="SoC %" />
            </LineChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
            <div style={{ fontSize: "11px", color: "#374151", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "12px", height: "1px", borderTop: "1px dashed #4ade80" }} /> carga máx
            </div>
            <div style={{ fontSize: "11px", color: "#374151", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "12px", height: "1px", borderTop: "1px dashed #f87171" }} /> mínimo
            </div>
          </div>
        </div>

        {/* Revenue snapshot */}
        <div style={{
          background: "linear-gradient(135deg, #111827 0%, #0f1724 100%)",
          borderRadius: "14px", padding: "20px",
          border: "1px solid #1a2234",
        }}>
          <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>Receita</div>
          <div style={{ color: "#4b5563", fontSize: "11px", marginBottom: "16px" }}>Resumo financeiro</div>
          {[
            { label: "Hoje", value: "€ 382", color: color, pct: 82 },
            { label: "Esta semana", value: "€ 2,140", color: "#60a5fa", pct: 60 },
            { label: "Este mês", value: "€ 8,920", color: "#a78bfa", pct: 44 },
            { label: "Grid Services", value: "€ 1,240", color: "#f59e0b", pct: 32 },
          ].map(r => (
            <div key={r.label} style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ color: "#6b7280", fontSize: "12px" }}>{r.label}</span>
                <span style={{ color: "white", fontWeight: "700", fontSize: "12px" }}>{r.value}</span>
              </div>
              <div style={{ height: "4px", background: "#1f2937", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${r.pct}%`,
                  background: `linear-gradient(90deg, ${r.color}66, ${r.color})`,
                  borderRadius: "10px",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
