import { useState, useEffect, useRef } from "react"
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell
} from "recharts"

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b"
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa"
const orange = "#f97316"

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

// ── Cell heatmap grid ────────────────────────────────────────────────────────
function CellHeatmap({ rows = 6, cols = 16, anomalyCells }) {
  const cellSize = 22
  const gap = 3
  const w = cols * (cellSize + gap)
  const h = rows * (cellSize + gap)
  return (
    <svg width={w} height={h} style={{ display: "block", maxWidth: "100%" }}>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const idx = r * cols + c
          const a = anomalyCells.find(x => x.idx === idx)
          const base = a ? (a.sev === "critical" ? red : a.sev === "high" ? orange : amber) : green
          const opacity = a ? 1 : 0.35 + Math.random() * 0.3
          return (
            <rect
              key={idx}
              x={c * (cellSize + gap)}
              y={r * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={4}
              fill={base}
              opacity={opacity}
            >
              <title>{a ? `Cell ${idx}: ${a.type} (${a.sev})` : `Cell ${idx}: OK`}</title>
            </rect>
          )
        })
      )}
    </svg>
  )
}

// ── Radial severity gauge ────────────────────────────────────────────────────
function SeverityGauge({ score, size = 110 }) {
  const r = 40
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const arc = (score / 100) * circ * 0.75
  const color = score > 70 ? red : score > 40 ? amber : green
  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${arc} ${circ}`} strokeDashoffset={circ * 0.125} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={18} fontWeight={800}>{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(148,163,184,0.85)" fontSize={9}>RISK SCORE</text>
    </svg>
  )
}

// ── Live anomaly feed items ──────────────────────────────────────────────────
const SEV_COLORS = { critical: red, high: orange, medium: amber, low: blue }
const ANOMALY_TYPES = [
  "Thermal Runaway Risk", "Cell Voltage Deviation", "Overcurrent Detected",
  "Comms Timeout", "SoC Mismatch", "BMS Fault", "Impedance Spike", "Charge Rate Exceeded"
]
const PACKS = ["Pack A", "Pack B", "Pack C", "Pack D"]
const SITES_LIST = ["Rotterdam", "Porto Solar", "Évora Híbrido", "Alentejo Grid", "Algarve PV"]

function genFeed(n = 12) {
  const sevs = ["critical", "high", "medium", "low"]
  return Array.from({ length: n }, (_, i) => ({
    id: Date.now() + i,
    site: SITES_LIST[Math.floor(Math.random() * SITES_LIST.length)],
    pack: PACKS[Math.floor(Math.random() * PACKS.length)],
    type: ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)],
    sev: sevs[Math.floor(Math.random() * sevs.length)],
    delta: rand(-35, -5),
    ts: new Date(Date.now() - i * 180000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    ack: false,
  }))
}

function genHeatmapAnomalies(n = 8) {
  const sevs = ["critical", "high", "medium"]
  const types = ["Thermal", "Voltage", "Current", "Comms"]
  return Array.from({ length: n }, () => ({
    idx: Math.floor(Math.random() * 96),
    sev: sevs[Math.floor(Math.random() * sevs.length)],
    type: types[Math.floor(Math.random() * types.length)],
  }))
}

function genTrendData() {
  return Array.from({ length: 24 }, (_, i) => ({
    h: `${i}h`,
    thermal: rand(0, 4, 0),
    voltage: rand(0, 6, 0),
    current: rand(0, 3, 0),
    comms: rand(0, 2, 0),
    total: rand(2, 12, 0),
  }))
}

const TYPE_BREAKDOWN = [
  { name: "Voltage Deviation", count: 34, color: amber },
  { name: "Thermal Anomaly", count: 18, color: red },
  { name: "Overcurrent", count: 12, color: orange },
  { name: "Comms Fault", count: 9, color: blue },
  { name: "SoC Mismatch", count: 7, color: purple },
  { name: "BMS Fault", count: 5, color: green },
]

// ─────────────────────────────────────────────────────────────────────────────
export default function AnomalyDetection() {
  const [feed, setFeed] = useState(genFeed)
  const [heatAnoms, setHeatAnoms] = useState(genHeatmapAnomalies)
  const [trend] = useState(genTrendData)
  const [riskScore, setRiskScore] = useState(62)
  const [thermalAlert, setThermalAlert] = useState(true)
  const [selectedSev, setSelectedSev] = useState("all")
  const [ticker, setTicker] = useState(0)
  const feedRef = useRef(feed)
  feedRef.current = feed

  useEffect(() => {
    const t = setInterval(() => {
      setTicker(x => x + 1)
      setRiskScore(s => Math.min(99, Math.max(10, s + rand(-3, 3, 0))))
      // occasionally inject a new anomaly
      if (Math.random() < 0.4) {
        const sevs = ["critical", "high", "medium", "low"]
        const sev = sevs[Math.floor(Math.random() * sevs.length)]
        const newItem = {
          id: Date.now(),
          site: SITES_LIST[Math.floor(Math.random() * SITES_LIST.length)],
          pack: PACKS[Math.floor(Math.random() * PACKS.length)],
          type: ANOMALY_TYPES[Math.floor(Math.random() * ANOMALY_TYPES.length)],
          sev,
          delta: rand(-35, -5),
          ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          ack: false,
        }
        setFeed(f => [newItem, ...f.slice(0, 19)])
      }
      setHeatAnoms(genHeatmapAnomalies)
    }, 2500)
    return () => clearInterval(t)
  }, [])

  const filteredFeed = selectedSev === "all" ? feed : feed.filter(x => x.sev === selectedSev)
  const sevCounts = { critical: 0, high: 0, medium: 0, low: 0 }
  feed.forEach(x => { if (sevCounts[x.sev] !== undefined) sevCounts[x.sev]++ })

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, maxWidth: 1400 }}>

      {/* Thermal Runaway Alert Banner */}
      {thermalAlert && (
        <div style={{
          background: "linear-gradient(135deg, #ef444415, #f9731610)",
          border: `1px solid ${red}50`,
          borderLeft: `4px solid ${red}`,
          borderRadius: 12,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%", background: red,
              boxShadow: `0 0 0 4px ${red}30`,
              animation: "pulse 1.2s infinite",
            }} />
            <div>
              <span style={{ fontWeight: 700, color: red, fontSize: 13 }}>THERMAL RUNAWAY RISK — Rotterdam Pack C · Cell 47 </span>
              <span style={{ color: "rgba(148,163,184,0.85)", fontSize: 12 }}> · Temp +18°C above baseline · Auto-throttle engaged · 14:23</span>
            </div>
          </div>
          <button onClick={() => setThermalAlert(false)} style={{
            background: `${red}20`, border: `1px solid ${red}40`, borderRadius: 8,
            padding: "4px 14px", fontSize: 12, color: red, cursor: "pointer", fontWeight: 600
          }}>Acknowledge</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9" }}>Anomaly Detection</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 12, marginTop: 2 }}>
            BESS cell-level fault isolation · Real-time · Updated {ticker > 0 ? "just now" : "loading…"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20,
            padding: "5px 14px", fontSize: 12
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: green, animation: "pulse 2s infinite" }} />
            <span style={{ color: "rgba(148,163,184,0.85)" }}>Live Monitoring</span>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { label: "Active Anomalies", value: feed.filter(x => !x.ack).length, color: red, sub: "unacknowledged" },
          { label: "Critical", value: sevCounts.critical, color: red, sub: "immediate action" },
          { label: "High", value: sevCounts.high, color: orange, sub: "monitor closely" },
          { label: "Affected Packs", value: 4, color: amber, sub: "across 3 sites" },
          { label: "Cells Flagged", value: heatAnoms.length, color: purple, sub: `of 96 monitored` },
        ].map(k => (
          <div key={k.label} style={{
            ...card,
            borderTop: `3px solid ${k.color}40`,
          }}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginTop: 6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Middle row: Risk Gauge + Cell Heatmap */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 14 }}>
        {/* Risk gauge */}
        <div style={{ ...card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ ...label, textAlign: "center" }}>Fleet Risk Score</div>
          <SeverityGauge score={riskScore} size={120} />
          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", textAlign: "center" }}>
            {riskScore > 70 ? "🔴 High Risk" : riskScore > 40 ? "🟡 Elevated" : "🟢 Normal"}
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {Object.entries(sevCounts).map(([sev, cnt]) => (
              <div key={sev} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: SEV_COLORS[sev], textTransform: "uppercase", fontWeight: 600 }}>{sev}</span>
                <span style={{ fontSize: 12, color: "#f1f5f9", fontWeight: 700 }}>{cnt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cell Heatmap */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={label}>Cell-Level Heatmap — Rotterdam Pack C (96 cells)</div>
            <div style={{ display: "flex", gap: 10 }}>
              {[["green", "OK"], [amber, "Warn"], [orange, "High"], [red, "Critical"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c === "green" ? green : c }} />
                  <span style={{ fontSize: 10, color: "rgba(148,163,184,0.85)" }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <CellHeatmap rows={6} cols={16} anomalyCells={heatAnoms} />
          <div style={{ marginTop: 10, fontSize: 11, color: "rgba(148,163,184,0.85)" }}>
            {heatAnoms.filter(x => x.sev === "critical").length} critical · {heatAnoms.filter(x => x.sev === "high").length} high · {heatAnoms.filter(x => x.sev === "medium").length} medium
            &nbsp;· Refreshes every 2.5s
          </div>
        </div>
      </div>

      {/* Trend + Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        {/* 24h anomaly trend */}
        <div style={card}>
          <div style={label}>24h Anomaly Trend by Type</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="h" tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
              <YAxis tick={{ fontSize: 9, fill: "rgba(148,163,184,0.85)" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="thermal" stackId="1" stroke={red} fill={red} fillOpacity={0.3} name="Thermal" />
              <Area type="monotone" dataKey="voltage" stackId="1" stroke={amber} fill={amber} fillOpacity={0.3} name="Voltage" />
              <Area type="monotone" dataKey="current" stackId="1" stroke={orange} fill={orange} fillOpacity={0.25} name="Current" />
              <Area type="monotone" dataKey="comms" stackId="1" stroke={blue} fill={blue} fillOpacity={0.2} name="Comms" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Anomaly type breakdown */}
        <div style={card}>
          <div style={label}>Anomaly Type Breakdown (7d)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {TYPE_BREAKDOWN.map(t => {
              const max = TYPE_BREAKDOWN[0].count
              return (
                <div key={t.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "#f1f5f9" }}>{t.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.color }}>{t.count}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: t.color, width: `${(t.count / max) * 100}%`, transition: "width 0.5s" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Live anomaly feed */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={label}>Live Anomaly Feed</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "critical", "high", "medium", "low"].map(s => (
              <button key={s} onClick={() => setSelectedSev(s)} style={{
                padding: "3px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                border: selectedSev === s ? `1px solid ${SEV_COLORS[s] || accent}` : "1px solid rgba(255,255,255,0.12)",
                background: selectedSev === s ? `${SEV_COLORS[s] || accent}20` : "rgba(255,255,255,0.08)",
                color: selectedSev === s ? (SEV_COLORS[s] || accent) : "rgba(148,163,184,0.85)",
                fontWeight: selectedSev === s ? 700 : 400,
              }}>{s === "all" ? "All" : s}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, maxHeight: 340, overflowY: "auto" }}>
          {filteredFeed.slice(0, 15).map((a, i) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "10px 0",
              borderBottom: "1px solid rgba(255,255,255,0.12)",
              opacity: a.ack ? 0.45 : 1,
              background: i === 0 && !a.ack ? `${SEV_COLORS[a.sev]}08` : "transparent",
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                background: SEV_COLORS[a.sev],
                boxShadow: a.sev === "critical" ? `0 0 0 3px ${red}30` : "none",
              }} />
              <div style={{ width: 65, fontSize: 11, fontWeight: 700, color: SEV_COLORS[a.sev], textTransform: "uppercase" }}>{a.sev}</div>
              <div style={{ width: 110, fontSize: 12, color: "rgba(148,163,184,0.85)", fontWeight: 600 }}>{a.site}</div>
              <div style={{ width: 60, fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{a.pack}</div>
              <div style={{ flex: 1, fontSize: 12, color: "#f1f5f9", fontWeight: 500 }}>{a.type}</div>
              <div style={{ width: 70, fontSize: 11, color: a.delta < -20 ? red : amber, textAlign: "right" }}>{a.delta}%</div>
              <div style={{ width: 50, fontSize: 11, color: "rgba(148,163,184,0.85)", textAlign: "right" }}>{a.ts}</div>
              <button
                onClick={() => setFeed(f => f.map(x => x.id === a.id ? { ...x, ack: true } : x))}
                style={{
                  padding: "2px 10px", borderRadius: 8, fontSize: 10, cursor: "pointer",
                  border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.85)"
                }}
              >{a.ack ? "ACK" : "Ack"}</button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
