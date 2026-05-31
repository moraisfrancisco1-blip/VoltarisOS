import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

function rand(min, max, d = 1) { return +(Math.random() * (max - min) + min).toFixed(d) }

function generateTwinData() {
  return Array.from({ length: 48 }, (_, i) => {
    const h = i * 0.5
    const solar = h >= 6 && h <= 19 ? Math.max(0, Math.sin(((h - 6) / 13) * Math.PI) * rand(140, 210)) : 0
    const load = rand(50, 100) + (h >= 8 && h <= 20 ? rand(20, 60) : 0)
    const soc = 40 + 40 * Math.sin((h / 24) * Math.PI)
    return { time: `${String(Math.floor(h)).padStart(2,"0")}:${h % 1 === 0 ? "00" : "30"}`, solar: +solar.toFixed(1), load: +load.toFixed(1), soc: +soc.toFixed(1) }
  })
}

// Animated flow arrow
function FlowArrow({ x1, y1, x2, y2, active, color, label, value }) {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!active) return
    const iv = setInterval(() => setPhase(p => (p + 1) % 100), 50)
    return () => clearInterval(iv)
  }, [active])

  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const ux = dx / len, uy = dy / len

  // Dashes
  const dots = active ? [0, 25, 50, 75].map(offset => {
    const t = ((phase + offset) % 100) / 100
    return { x: x1 + ux * t * len, y: y1 + uy * t * len }
  }) : []

  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? color + "33" : "#1f2937"} strokeWidth={2} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={4} fill={color} opacity={1 - i * 0.2} />
      ))}
      {label && (
        <text x={mx} y={my - 8} textAnchor="middle" fill={active ? color : "#374151"} fontSize="10" fontWeight={active ? "600" : "400"}>
          {label}
        </text>
      )}
      {value && (
        <text x={mx} y={my + 18} textAnchor="middle" fill={active ? "#9ca3af" : "#374151"} fontSize="9">
          {value}
        </text>
      )}
    </g>
  )
}

function Component({ x, y, w, h, label, value, unit, color, icon, status }) {
  const statusColors = { ok: "#4ade80", warning: "#f59e0b", offline: "#f87171" }
  const sc = statusColors[status] || "#4ade80"
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="10" fill={color + "15"} stroke={color + "55"} strokeWidth="1.5" />
      <text x={x + w / 2} y={y + 18} textAnchor="middle" fill={color} fontSize="18">{icon}</text>
      <text x={x + w / 2} y={y + 36} textAnchor="middle" fill="#9ca3af" fontSize="10">{label}</text>
      <text x={x + w / 2} y={y + 54} textAnchor="middle" fill="white" fontSize="14" fontWeight="700">{value}</text>
      <text x={x + w / 2} y={y + 68} textAnchor="middle" fill="#6b7280" fontSize="9">{unit}</text>
      <circle cx={x + w - 10} cy={y + 10} r={4} fill={sc} />
    </g>
  )
}

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px" }}>
      <div style={{ color: "var(--sub)", marginBottom: "4px" }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>{p.name}: <span style={{ color: "white", fontWeight: "600" }}>{p.value}</span></div>
      ))}
    </div>
  )
}

export default function DigitalTwin({ user }) {
  const [site, setSite] = useState("rotterdam")
  const [data, setData] = useState({ solar: 156, load: 89, grid: 12, soc: 78, temp: 28, voltage: 48.2, current: 142 })
  const [ts, setTs] = useState(generateTwinData())
  const [tick, setTick] = useState(0)
  const color = user?.color || "#4ade80"

  const SITES = {
    rotterdam: { name: "Rotterdam 🇳🇱", capacity: "2.4 MWh", panels: 320 },
    rebordelo: { name: "Rebordelo 🇵🇹", capacity: "2.4 MWh", panels: 280 },
  }

  useEffect(() => {
    const iv = setInterval(() => {
      setData(d => ({
        solar: Math.max(0, +(d.solar + rand(-3, 3)).toFixed(1)),
        load: Math.max(20, +(d.load + rand(-2, 2)).toFixed(1)),
        grid: Math.max(0, +(d.grid + rand(-1, 1)).toFixed(1)),
        soc: Math.min(100, Math.max(10, +(d.soc + rand(-0.3, 0.3)).toFixed(1))),
        temp: +(d.temp + rand(-0.1, 0.1, 2)).toFixed(1),
        voltage: +(d.voltage + rand(-0.05, 0.05, 2)).toFixed(1),
        current: Math.max(0, +(d.current + rand(-2, 2)).toFixed(0)),
      }))
      setTick(t => t + 1)
    }, 1500)
    return () => clearInterval(iv)
  }, [])

  const solarActive = data.solar > 10
  const gridImport = data.grid > 0
  const battCharging = data.soc < 85 && solarActive
  const battDischarging = data.soc > 25 && !solarActive

  const svgW = 560, svgH = 280
  // Component positions
  const solar = { x: 30, y: 80, w: 110, h: 90 }
  const grid = { x: 200, y: 10, w: 110, h: 90 }
  const battery = { x: 200, y: 180, w: 110, h: 90 }
  const load_ = { x: 390, y: 80, w: 110, h: 90 }

  // Centers
  const sc = [solar.x + solar.w / 2, solar.y + solar.h / 2]
  const gc = [grid.x + grid.w / 2, grid.y + grid.h / 2]
  const bc = [battery.x + battery.w / 2, battery.y + battery.h / 2]
  const lc = [load_.x + load_.w / 2, load_.y + load_.h / 2]

  return (
    <div style={{ padding: "28px", maxWidth: "1400px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#312e8133", border: "1px solid #312e81", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Digital Twin</h1>
            <p style={{ color: "var(--sub)", fontSize: "13px", marginTop: "2px" }}>Espelho digital em tempo real · Simulação física do site</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {Object.entries(SITES).map(([k, v]) => (
            <button key={k} onClick={() => setSite(k)} style={{
              padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
              border: "none", cursor: "pointer",
              background: site === k ? color + "22" : "var(--surface)",
              color: site === k ? color : "#6b7280",
              border: `1px solid ${site === k ? color + "44" : "#1a2234"}`,
            }}>{v.name}</button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "16px", marginBottom: "16px" }}>
        {/* SVG twin */}
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px" }}>Diagrama de Energia</div>
              <div style={{ color: "var(--sub)", fontSize: "11px" }}>{SITES[site].name} · {SITES[site].capacity} · {SITES[site].panels} painéis</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#4ade80" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
              LIVE
            </div>
          </div>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto" }}>
            {/* Flow arrows */}
            <FlowArrow x1={sc[0]} y1={sc[1]} x2={lc[0]} y2={lc[1]} active={solarActive} color="#f59e0b" label="Solar → Load" value={`${data.solar} kW`} />
            <FlowArrow x1={gc[0]} y1={gc[1]} x2={lc[0]} y2={lc[1]} active={gridImport} color="#60a5fa" label="Grid → Load" value={`${data.grid} kW`} />
            <FlowArrow x1={sc[0]} y1={sc[1]} x2={bc[0]} y2={bc[1]} active={battCharging} color="#4ade80" label={battCharging ? "Solar → Bat" : ""} value={battCharging ? "Charging" : ""} />
            <FlowArrow x1={bc[0]} y1={bc[1]} x2={lc[0]} y2={lc[1]} active={battDischarging} color="#a78bfa" label={battDischarging ? "Bat → Load" : ""} value={battDischarging ? "Discharging" : ""} />

            {/* Components */}
            <Component x={solar.x} y={solar.y} w={solar.w} h={solar.h} label="Solar PV" value={`${data.solar}`} unit="kW" color="#f59e0b" icon="☀" status="ok" />
            <Component x={grid.x} y={grid.y} w={grid.w} h={grid.h} label="Rede Elétrica" value={`${data.grid}`} unit="kW" color="#60a5fa" icon="⚡" status="ok" />
            <Component x={battery.x} y={battery.y} w={battery.w} h={battery.h} label="Bateria BESS" value={`${data.soc}%`} unit="SoC" color="#4ade80" icon="🔋" status={data.soc < 20 ? "warning" : "ok"} />
            <Component x={load_.x} y={load_.y} w={load_.w} h={load_.h} label="Consumo" value={`${data.load}`} unit="kW" color="#a78bfa" icon="🏭" status="ok" />
          </svg>
        </div>

        {/* Live metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "12px" }}>Métricas Físicas</div>
            {[
              { l: "Tensão DC", v: `${data.voltage} V`, c: "#f59e0b" },
              { l: "Corrente", v: `${data.current} A`, c: "#60a5fa" },
              { l: "Temperatura", v: `${data.temp}°C`, c: data.temp > 35 ? "#f87171" : "#4ade80" },
              { l: "Frequência Rede", v: "50.02 Hz", c: "#a78bfa" },
              { l: "Power Factor", v: "0.98", c: "#34d399" },
              { l: "Eficiência", v: "94.2%", c: color },
            ].map(m => (
              <div key={m.l} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                <span style={{ color: "var(--sub)", fontSize: "12px" }}>{m.l}</span>
                <span style={{ color: m.c, fontWeight: "700", fontSize: "13px" }}>{m.v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--border)", flex: 1 }}>
            <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>Previsão SoC</div>
            <div style={{ color: "var(--sub)", fontSize: "10px", marginBottom: "10px" }}>próximas 24h</div>
            {[15, 30, 60].map(min => {
              const projected = Math.min(100, Math.max(0, data.soc + (battCharging ? min * 0.08 : -min * 0.05)))
              return (
                <div key={min} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                    <span style={{ color: "var(--sub)", fontSize: "10px" }}>+{min} min</span>
                    <span style={{ color: projected > 60 ? "#4ade80" : "#f59e0b", fontWeight: "700", fontSize: "11px" }}>{projected.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: "3px", background: "#1f2937", borderRadius: "4px" }}>
                    <div style={{ height: "100%", width: `${projected}%`, background: projected > 60 ? "#4ade80" : "#f59e0b", borderRadius: "4px" }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* SoC time series */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        {[
          { key: "solar", label: "Solar (kW)", color: "#f59e0b" },
          { key: "load", label: "Consumo (kW)", color: "#a78bfa" },
          { key: "soc", label: "SoC (%)", color: "#4ade80" },
        ].map(c => (
          <div key={c.key} style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "12px" }}>{c.label}</div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={ts} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                <XAxis dataKey="time" stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 8 }} interval={11} />
                <YAxis stroke="var(--grid-line)" tick={{ fill: "#374151", fontSize: 8 }} />
                <Tooltip content={<CT />} />
                <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={2} dot={false} name={c.label} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  )
}
