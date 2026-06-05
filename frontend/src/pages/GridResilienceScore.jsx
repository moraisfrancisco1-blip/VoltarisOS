import { useState, useEffect, useRef } from "react"
import { useAppStore } from "../store/appStore"

const API = import.meta.env.VITE_API_URL || ""

const FACTORS = [
  { key: "soc", label: "Battery SOC", weight: 0.25, icon: "🔋" },
  { key: "frequency", label: "Grid Frequency", weight: 0.20, icon: "〜" },
  { key: "forecast", label: "Forecast Accuracy", weight: 0.20, icon: "📡" },
  { key: "weather", label: "Weather Risk", weight: 0.15, icon: "⛅" },
  { key: "redundancy", label: "Redundancy", weight: 0.10, icon: "🔗" },
  { key: "ramp", label: "Ramp Capacity", weight: 0.10, icon: "⚡" },
]

function scoreColor(v) {
  if (v >= 80) return "#10b981"
  if (v >= 60) return "#f59e0b"
  if (v >= 40) return "#f97316"
  return "#ef4444"
}

function scoreLabel(v) {
  if (v >= 80) return "RESILIENT"
  if (v >= 60) return "STABLE"
  if (v >= 40) return "DEGRADED"
  return "CRITICAL"
}

function GaugeArc({ value, size = 180, stroke = 14 }) {
  const r = (size - stroke) / 2
  const cx = size / 2, cy = size / 2
  const total = Math.PI * r  // half circle
  const dashOffset = total - (value / 100) * total
  const color = scoreColor(value)

  return (
    <svg width={size} height={size / 2 + stroke} viewBox={`0 0 ${size} ${size / 2 + stroke}`}>
      <path
        d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none" stroke="var(--border)" strokeWidth={stroke} strokeLinecap="round"
      />
      <path
        d={`M ${stroke / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${size / 2}`}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${total} ${total}`}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s" }}
      />
      <text x={cx} y={size / 2 - 4} textAnchor="middle" fill={color} fontSize="32" fontWeight="700" fontFamily="inherit">
        {value}
      </text>
      <text x={cx} y={size / 2 + 16} textAnchor="middle" fill={color} fontSize="11" fontWeight="700" fontFamily="inherit" letterSpacing="2">
        {scoreLabel(value)}
      </text>
    </svg>
  )
}

function FactorBar({ factor, value }) {
  const color = scoreColor(value)
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "var(--sub)", display: "flex", gap: "6px", alignItems: "center" }}>
          <span>{factor.icon}</span> {factor.label}
        </span>
        <span style={{ fontSize: "12px", fontWeight: "600", color }}>{value}</span>
      </div>
      <div style={{ height: "6px", borderRadius: "3px", background: "var(--border)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: "3px", background: color,
          width: `${value}%`, transition: "width 1s ease"
        }} />
      </div>
    </div>
  )
}

function SiteTile({ site, onClick, selected }) {
  const { color } = useAppStore()
  const s = site.score
  const c = scoreColor(s)
  return (
    <div onClick={() => onClick(site)} style={{
      padding: "14px", borderRadius: "10px", cursor: "pointer",
      border: selected ? `1.5px solid ${color}` : "1px solid var(--border)",
      background: selected ? `${color}09` : "var(--surface2)",
      transition: "all 0.15s"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", marginBottom: "2px" }}>{site.name}</div>
          <div style={{ fontSize: "11px", color: "var(--sub)" }}>{site.location}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "22px", fontWeight: "700", color: c, lineHeight: 1 }}>{s}</div>
          <div style={{ fontSize: "9px", color: c, fontWeight: "700", letterSpacing: "1px" }}>{scoreLabel(s)}</div>
        </div>
      </div>
      <div style={{ marginTop: "10px", height: "4px", borderRadius: "2px", background: "var(--border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${s}%`, background: c, borderRadius: "2px", transition: "width 1s ease" }} />
      </div>
    </div>
  )
}

function generateSiteData(seed) {
  const rng = (min, max) => Math.floor(min + ((seed * 9301 + 49297) % 233280) / 233280 * (max - min))
  const factors = {}
  let total = 0
  FACTORS.forEach(f => {
    const v = Math.min(100, Math.max(10, 40 + rng(0, 55) + Math.floor(Math.random() * 20)))
    factors[f.key] = v
    total += v * f.weight
  })
  return { factors, score: Math.round(total) }
}

const MOCK_SITES = [
  { id: 1, name: "Lisboa Norte BESS", location: "Lisbon, PT", mw: 12, mwh: 48, ...generateSiteData(42) },
  { id: 2, name: "Porto Industrial", location: "Porto, PT", mw: 8, mwh: 32, ...generateSiteData(77) },
  { id: 3, name: "Madrid Sur Grid", location: "Madrid, ES", mw: 20, mwh: 80, ...generateSiteData(13) },
  { id: 4, name: "Amsterdam AMS-1", location: "Amsterdam, NL", mw: 15, mwh: 60, ...generateSiteData(91) },
  { id: 5, name: "Berlin Mitte", location: "Berlin, DE", mw: 10, mwh: 40, ...generateSiteData(55) },
  { id: 6, name: "Lyon Renewables", location: "Lyon, FR", mw: 6, mwh: 24, ...generateSiteData(29) },
]

const HISTORY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  score: 45 + Math.round(Math.sin(i / 3) * 20 + Math.random() * 15),
}))

export default function GridResilienceScore() {
  const { color } = useAppStore()
  const [sites, setSites] = useState(MOCK_SITES)
  const [selected, setSelected] = useState(MOCK_SITES[0])
  const [tick, setTick] = useState(0)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setSites(prev => prev.map(s => ({
        ...s,
        score: Math.max(20, Math.min(99, s.score + Math.round((Math.random() - 0.48) * 4))),
        factors: Object.fromEntries(
          Object.entries(s.factors).map(([k, v]) => [k, Math.max(10, Math.min(100, v + Math.round((Math.random() - 0.48) * 5)))])
        )
      })))
      setTick(t => t + 1)
    }, 3000)
    return () => clearInterval(id)
  }, [])

  // Keep selected in sync with live updates
  useEffect(() => {
    const live = sites.find(s => s.id === selected.id)
    if (live) setSelected(live)
  }, [sites])

  const avgScore = Math.round(sites.reduce((a, s) => a + s.score, 0) / sites.length)
  const critical = sites.filter(s => s.score < 40).length
  const degraded = sites.filter(s => s.score >= 40 && s.score < 60).length

  const fleetColor = scoreColor(avgScore)

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: "700", color: "var(--text)", margin: 0 }}>Grid Resilience Score</h1>
          <span style={{
            fontSize: "10px", padding: "2px 8px", borderRadius: "12px",
            background: "#10b98118", color: "#10b981", fontWeight: "700", letterSpacing: "1px"
          }}>LIVE</span>
          <span style={{ fontSize: "11px", color: "var(--sub)" }}>Updates every 3s · Multi-factor index</span>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--sub)" }}>
          Real-time per-site resilience index combining SOC, grid frequency, forecast accuracy, weather risk, redundancy &amp; ramp capacity.
        </p>
      </div>

      {/* Fleet summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Fleet Score", value: avgScore, unit: "/100", color: fleetColor },
          { label: "Resilient Sites", value: sites.filter(s => s.score >= 80).length, unit: `/${sites.length}`, color: "#10b981" },
          { label: "Degraded Sites", value: degraded, unit: "", color: "#f59e0b" },
          { label: "Critical Sites", value: critical, unit: "", color: "#ef4444" },
          { label: "Total Capacity", value: sites.reduce((a, s) => a + s.mw, 0), unit: " MW", color: color },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: "16px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface2)"
          }}>
            <div style={{ fontSize: "11px", color: "var(--sub)", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: stat.color }}>{stat.value}<span style={{ fontSize: "13px", fontWeight: "400", color: "var(--sub)" }}>{stat.unit}</span></div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "20px" }}>
        {/* Site list */}
        <div>
          <div style={{ fontSize: "11px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>All Sites</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sites.sort((a, b) => a.score - b.score).map(site => (
              <SiteTile key={site.id} site={site} onClick={setSelected} selected={selected?.id === site.id} />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selected && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)" }}>{selected.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--sub)" }}>{selected.location} · {selected.mw} MW / {selected.mwh} MWh</div>
                </div>
                <button onClick={() => setShowHistory(!showHistory)} style={{
                  padding: "6px 14px", borderRadius: "7px", border: `1px solid ${color}40`,
                  background: showHistory ? `${color}18` : "transparent", color: showHistory ? color : "var(--sub)",
                  cursor: "pointer", fontSize: "12px", fontWeight: "500"
                }}>
                  {showHistory ? "Live View" : "24h History"}
                </button>
              </div>

              {showHistory ? (
                <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
                  <div style={{ fontSize: "12px", color: "var(--sub)", marginBottom: "12px", fontWeight: "600" }}>24-Hour Resilience History</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px" }}>
                    {HISTORY.map((h, i) => (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <div style={{
                          width: "100%", borderRadius: "3px 3px 0 0",
                          height: `${(h.score / 100) * 110}px`,
                          background: scoreColor(h.score), opacity: 0.8, transition: "height 0.5s ease"
                        }} />
                        {i % 4 === 0 && <div style={{ fontSize: "9px", color: "var(--sub)", whiteSpace: "nowrap" }}>{h.hour}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "20px" }}>
                  {/* Gauge */}
                  <div style={{
                    padding: "24px 28px", borderRadius: "12px", border: "1px solid var(--border)",
                    background: "var(--surface2)", display: "flex", flexDirection: "column", alignItems: "center"
                  }}>
                    <GaugeArc value={selected.score} size={200} />
                    <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "100%" }}>
                      {[
                        { label: "0–40", color: "#ef4444", text: "Critical" },
                        { label: "40–60", color: "#f97316", text: "Degraded" },
                        { label: "60–80", color: "#f59e0b", text: "Stable" },
                        { label: "80–100", color: "#10b981", text: "Resilient" },
                      ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: l.color, flexShrink: 0 }} />
                          <span style={{ fontSize: "10px", color: "var(--sub)" }}>{l.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Factor breakdown */}
                  <div style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
                    <div style={{ fontSize: "12px", color: "var(--sub)", marginBottom: "16px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Factor Breakdown
                    </div>
                    {FACTORS.map(f => (
                      <FactorBar key={f.key} factor={f} value={selected.factors?.[f.key] ?? 50} />
                    ))}
                    <div style={{ marginTop: "16px", padding: "10px 14px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "11px", color: "var(--sub)" }}>
                        Weighted composite → <span style={{ color: scoreColor(selected.score), fontWeight: "700" }}>{selected.score}/100</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div style={{ marginTop: "16px", padding: "16px 20px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface2)" }}>
                <div style={{ fontSize: "11px", color: "var(--sub)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>
                  AI Recommendations
                </div>
                {FACTORS.filter(f => (selected.factors?.[f.key] ?? 50) < 60).length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#10b981" }}>✓ All factors within healthy range. No action needed.</div>
                ) : (
                  FACTORS.filter(f => (selected.factors?.[f.key] ?? 50) < 60).map(f => (
                    <div key={f.key} style={{ fontSize: "12px", color: "var(--text)", marginBottom: "6px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <span style={{ color: "#f59e0b", flexShrink: 0 }}>▲</span>
                      <span>
                        <strong>{f.label}</strong> is at {selected.factors?.[f.key] ?? 50}/100.{" "}
                        {f.key === "soc" && "Charge to ≥70% before peak demand window."}
                        {f.key === "frequency" && "Grid frequency deviation detected — consider FCR activation."}
                        {f.key === "forecast" && "Forecast confidence low — increase weather data polling."}
                        {f.key === "weather" && "Adverse weather forecast — pre-charge and reduce export commitments."}
                        {f.key === "redundancy" && "Single point of failure detected — enable backup inverter."}
                        {f.key === "ramp" && "Ramp capacity constrained — check thermal limits on inverters."}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
