import { useEffect, useState } from "react"
import axios from "axios"
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend
} from "recharts"

const accent = "#6366f1"
const green = "#10b981"
const amber = "#f59e0b"
const red = "#ef4444"
const blue = "#60a5fa"
const purple = "#a78bfa"
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }

function rand(min, max, dec = 1) { return +(Math.random() * (max - min) + min).toFixed(dec) }

const MOCK_SITES = [
  { id: 1, name: "Rotterdam North", location: "Netherlands", lat: 51.92, lng: 4.47, status: "active", solar_kw: 2400, battery_kwh: 4000, battery_kw: 1000, ev_chargers: 12, wind_kw: 800, soc: 74, solar_now: 1820, load_kw: 620, grid_export: 1200, revenue_today: 4280, co2_today: 1.48, health: 96, alerts: 0, type: "Large Park", commissioned: "2022-03" },
  { id: 2, name: "Rebordelo I", location: "Portugal", lat: 41.5, lng: -7.1, status: "active", solar_kw: 800, battery_kwh: 1000, battery_kw: 250, ev_chargers: 4, wind_kw: 0, soc: 41, solar_now: 520, load_kw: 180, grid_export: 340, revenue_today: 1120, co2_today: 0.43, health: 88, alerts: 2, type: "Medium Park", commissioned: "2021-07" },
  { id: 3, name: "Rotterdam South", location: "Netherlands", lat: 51.89, lng: 4.51, status: "active", solar_kw: 2400, battery_kwh: 4000, battery_kw: 1000, ev_chargers: 8, wind_kw: 0, soc: 88, solar_now: 2100, load_kw: 480, grid_export: 1620, revenue_today: 5140, co2_today: 1.72, health: 98, alerts: 0, type: "Large Park", commissioned: "2023-01" },
  { id: 4, name: "Lisbon Park", location: "Portugal", lat: 38.71, lng: -9.14, status: "maintenance", solar_kw: 500, battery_kwh: 500, battery_kw: 125, ev_chargers: 6, wind_kw: 0, soc: 22, solar_now: 0, load_kw: 60, grid_export: 0, revenue_today: 0, co2_today: 0, health: 82, alerts: 3, type: "Small Park", commissioned: "2020-05" },
  { id: 5, name: "Madrid Grid", location: "Spain", lat: 40.42, lng: -3.70, status: "active", solar_kw: 5000, battery_kwh: 8000, battery_kw: 2000, ev_chargers: 24, wind_kw: 1500, soc: 61, solar_now: 3800, load_kw: 980, grid_export: 2820, revenue_today: 8960, co2_today: 3.12, health: 99, alerts: 0, type: "Utility Scale", commissioned: "2024-02" },
  { id: 6, name: "Hamburg Port", location: "Germany", lat: 53.55, lng: 10.0, status: "active", solar_kw: 1200, battery_kwh: 1500, battery_kw: 300, ev_chargers: 16, wind_kw: 600, soc: 55, solar_now: 780, load_kw: 420, grid_export: 360, revenue_today: 2340, co2_today: 0.64, health: 91, alerts: 1, type: "Industrial", commissioned: "2022-09" },
]

const STATUS_COLOR = { active: green, maintenance: amber, inactive: red, offline: red }
const STATUS_BG = { active: "#064e3b", maintenance: "#451a03", inactive: "#7f1d1d", offline: "#7f1d1d" }
const TYPE_COLOR = { "Utility Scale": purple, "Large Park": accent, "Medium Park": blue, "Small Park": green, "Industrial": amber }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: "var(--tooltip-bg,#1a1f2e)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "var(--sub)", marginBottom: 6, fontWeight: 700 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: "flex", gap: 12, justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: "var(--text)", fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function FleetManagement({ user }) {
  const [sites, setSites] = useState(MOCK_SITES)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState("Grid View")
  const [filter, setFilter] = useState("All")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("revenue_today")
  const color = user?.color || accent

  useEffect(() => {
    axios.get("/api/sites").then(r => {
      if (r.data?.length > 0) setSites(r.data)
    }).catch(() => {})
  }, [])

  // Live simulation
  useEffect(() => {
    const iv = setInterval(() => {
      setSites(prev => prev.map(s => ({
        ...s,
        solar_now: s.status === "active" ? Math.max(0, s.solar_now + rand(-50, 50)) : 0,
        soc: Math.min(98, Math.max(5, s.soc + rand(-0.5, 0.5))),
        revenue_today: s.status === "active" ? +(s.revenue_today + rand(0, 2)).toFixed(0) : s.revenue_today,
      })))
    }, 3000)
    return () => clearInterval(iv)
  }, [])

  const filtered = sites
    .filter(s => filter === "All" || s.status === filter)
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b[sortBy] - a[sortBy])

  const site = selected !== null ? sites.find(s => s.id === selected) : null

  const totalSolar = sites.reduce((a, s) => a + s.solar_kw, 0)
  const totalBattery = sites.reduce((a, s) => a + s.battery_kwh, 0)
  const totalBatteryPower = sites.reduce((a, s) => a + s.battery_kw, 0)
  const totalWind = sites.reduce((a, s) => a + s.wind_kw, 0)
  const totalEV = sites.reduce((a, s) => a + s.ev_chargers, 0)
  const totalRevenue = sites.reduce((a, s) => a + s.revenue_today, 0)
  const totalCO2 = sites.reduce((a, s) => a + s.co2_today, 0).toFixed(2)
  const totalSolarNow = sites.filter(s => s.status === "active").reduce((a, s) => a + s.solar_now, 0)
  const activeSites = sites.filter(s => s.status === "active").length

  const revenueData = sites.map(s => ({ name: s.name.split(" ")[0], revenue: s.revenue_today, solar: s.solar_kw }))

  const perfData = Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    total_solar: Math.max(0, Math.sin(((i - 6) / 12) * Math.PI) * totalSolarNow * rand(0.8, 1.2)),
    revenue: i >= 8 && i <= 20 ? rand(200, 900) : rand(0, 100),
    soc_avg: 40 + Math.sin((i / 24) * Math.PI * 2) * 25,
  }))

  const siteDetail = site ? Array.from({ length: 24 }, (_, i) => ({
    h: `${i}:00`,
    solar: Math.max(0, Math.sin(((i - 6) / 12) * Math.PI) * site.solar_kw * rand(0.7, 1.0)),
    bess: i >= 17 && i <= 21 ? rand(100, site.battery_kw) : i >= 1 && i <= 6 ? -rand(80, site.battery_kw * 0.6) : 0,
    soc: Math.max(10, Math.min(95, site.soc + Math.sin((i / 24) * Math.PI * 2) * 30)),
    price: rand(25, 120),
  })) : []

  return (
    <div style={{ padding: 32, color: "var(--text)", minHeight: "100vh", background: "var(--bg)" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Solar + BESS Fleet Management</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>Unified control center for all solar parks and battery storage assets</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px" }}>
            <div style={{ fontSize: 10, color: "var(--sub)" }}>Today's Revenue</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: green }}>€{totalRevenue.toLocaleString()}</div>
          </div>
          <button style={{ background: accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
            + Add Site
          </button>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { l: "Active Sites", v: `${activeSites}/${sites.length}`, c: color },
          { l: "Solar Installed", v: `${(totalSolar / 1000).toFixed(1)} MWp`, c: amber },
          { l: "Solar Now", v: `${(totalSolarNow / 1000).toFixed(1)} MW`, c: amber },
          { l: "BESS Capacity", v: `${(totalBattery / 1000).toFixed(1)} MWh`, c: blue },
          { l: "BESS Power", v: `${(totalBatteryPower / 1000).toFixed(1)} MW`, c: blue },
          { l: "Wind Installed", v: `${(totalWind / 1000).toFixed(1)} MW`, c: green },
          { l: "EV Chargers", v: totalEV, c: purple },
          { l: "CO₂ Avoided", v: `${totalCO2} t`, c: green },
        ].map(k => (
          <div key={k.l} style={{ ...card, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--sub)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.l}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["Grid View", "Table View", "Performance", "Map"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? accent : "var(--surface)", color: tab === t ? "#fff" : "var(--sub)",
            border: `1px solid ${tab === t ? accent : "var(--border)"}`, borderRadius: 8,
            padding: "7px 16px", fontSize: 13, cursor: "pointer", fontWeight: tab === t ? 600 : 400
          }}>{t}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
          style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", color: "var(--text)", fontSize: 13, flex: 1, maxWidth: 240 }} />
        {["All", "active", "maintenance", "inactive"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? accent : "var(--surface2)", color: filter === f ? "#fff" : "var(--sub)",
            border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", textTransform: "capitalize"
          }}>{f === "All" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <span style={{ fontSize: 12, color: "var(--sub)" }}>Sort:</span>
          {["revenue_today", "solar_kw", "battery_kwh", "soc"].map(s => (
            <button key={s} onClick={() => setSortBy(s)} style={{
              background: sortBy === s ? "var(--surface2)" : "transparent", color: sortBy === s ? "var(--text)" : "var(--sub)",
              border: `1px solid ${sortBy === s ? accent : "transparent"}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer"
            }}>{s === "revenue_today" ? "Revenue" : s === "solar_kw" ? "Solar" : s === "battery_kwh" ? "Battery" : "SoC"}</button>
          ))}
        </div>
      </div>

      {tab === "Grid View" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {filtered.map(s => (
            <div key={s.id} onClick={() => setSelected(selected === s.id ? null : s.id)} style={{
              ...card, cursor: "pointer",
              border: `1px solid ${selected === s.id ? accent : "var(--border)"}`,
              background: selected === s.id ? "var(--surface2)" : "var(--surface)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--sub)" }}>📍 {s.location} · <span style={{ color: TYPE_COLOR[s.type] }}>{s.type}</span></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: STATUS_BG[s.status], color: STATUS_COLOR[s.status], fontWeight: 600 }}>{s.status.toUpperCase()}</span>
                  {s.alerts > 0 && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "#7f1d1d", color: red }}>⚠ {s.alerts}</span>}
                </div>
              </div>

              {/* Mini SoC bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "var(--sub)", width: 66 }}>🔋 SoC {s.soc.toFixed(0)}%</span>
                <div style={{ flex: 1, background: "#1f2937", borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${s.soc}%`, height: "100%", background: s.soc > 60 ? green : s.soc > 25 ? amber : red, borderRadius: 4, transition: "width 0.6s" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {[
                  { l: "Solar", v: `${(s.solar_kw / 1000).toFixed(1)} MWp`, icon: "☀" },
                  { l: "BESS", v: `${(s.battery_kwh / 1000).toFixed(1)} MWh`, icon: "🔋" },
                  { l: "Now", v: `${(s.solar_now / 1000).toFixed(1)} MW`, icon: "⚡" },
                  { l: "Revenue", v: `€${s.revenue_today.toLocaleString()}`, icon: "💰" },
                  { l: "Export", v: `${(s.grid_export / 1000).toFixed(1)} MW`, icon: "📤" },
                  { l: "CO₂", v: `${s.co2_today}t`, icon: "🌱" },
                ].map(m => (
                  <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                    <div style={{ fontSize: 12 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{m.v}</div>
                    <div style={{ fontSize: 9, color: "var(--sub)" }}>{m.l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "Table View" && (
        <div style={card}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Site", "Location", "Type", "Status", "Solar kWp", "BESS MWh", "BESS kW", "Wind kW", "SoC %", "Now kW", "Export kW", "Revenue €", "Health %", "Alerts"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--sub)", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => setSelected(s.id)}>
                  <td style={{ padding: "10px", fontWeight: 700 }}>{s.name}</td>
                  <td style={{ padding: "10px", color: "var(--sub)" }}>{s.location}</td>
                  <td style={{ padding: "10px" }}><span style={{ color: TYPE_COLOR[s.type], fontSize: 11 }}>{s.type}</span></td>
                  <td style={{ padding: "10px" }}><span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: STATUS_BG[s.status], color: STATUS_COLOR[s.status] }}>{s.status}</span></td>
                  <td style={{ padding: "10px" }}>{s.solar_kw}</td>
                  <td style={{ padding: "10px", color: blue }}>{(s.battery_kwh / 1000).toFixed(1)}</td>
                  <td style={{ padding: "10px" }}>{s.battery_kw}</td>
                  <td style={{ padding: "10px" }}>{s.wind_kw || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, background: "#1f2937", borderRadius: 3, height: 5 }}>
                        <div style={{ width: `${s.soc}%`, height: "100%", background: s.soc > 50 ? green : amber, borderRadius: 3 }} />
                      </div>
                      <span>{s.soc.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px", color: amber }}>{s.solar_now}</td>
                  <td style={{ padding: "10px", color: green }}>{s.grid_export}</td>
                  <td style={{ padding: "10px", color: green, fontWeight: 600 }}>€{s.revenue_today.toLocaleString()}</td>
                  <td style={{ padding: "10px" }}><span style={{ color: STATUS_COLOR[s.status] }}>{s.health}%</span></td>
                  <td style={{ padding: "10px" }}>{s.alerts > 0 ? <span style={{ color: red, fontWeight: 700 }}>⚠ {s.alerts}</span> : <span style={{ color: green }}>✓</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Performance" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Today's Revenue by Site</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" name="Revenue €" radius={[4, 4, 0, 0]}>
                    {revenueData.map((_, i) => <Cell key={i} fill={[accent, green, blue, amber, purple, red][i % 6]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Fleet Solar + BESS SoC (24h)</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                  <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={4} />
                  <YAxis yAxisId="sol" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area yAxisId="sol" type="monotone" dataKey="total_solar" stroke={amber} fill={`${amber}20`} strokeWidth={2} name="Solar MW" />
                  <Line yAxisId="soc" type="monotone" dataKey="soc_avg" stroke={green} strokeWidth={2} dot={false} name="Avg SoC %" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Site detail when selected */}
          {site && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                {site.name} — Detailed 24h Profile
                <span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 10 }}>Solar · BESS Dispatch · SoC · Price</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={siteDetail}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line,#1f2937)" />
                  <XAxis dataKey="h" tick={{ fontSize: 10, fill: "var(--sub)" }} interval={3} />
                  <YAxis yAxisId="kw" tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <YAxis yAxisId="soc" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--sub)" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area yAxisId="kw" type="monotone" dataKey="solar" stroke={amber} fill={`${amber}25`} strokeWidth={2} name="Solar kW" />
                  <Bar yAxisId="kw" dataKey="bess" name="BESS kW" radius={[2, 2, 0, 0]}>
                    {siteDetail.map((d, i) => <Cell key={i} fill={d.bess >= 0 ? `${green}CC` : `${accent}CC`} />)}
                  </Bar>
                  <Line yAxisId="soc" type="monotone" dataKey="soc" stroke={blue} strokeWidth={2} dot={false} name="SoC %" />
                  <Line yAxisId="kw" type="monotone" dataKey="price" stroke={purple} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="€/MWh" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {tab === "Map" && (
        <div style={{ ...card, minHeight: 400, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Fleet Map — Site Locations</div>
          {/* Simplified SVG map */}
          <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 10, position: "relative", minHeight: 360, overflow: "hidden" }}>
            <svg width="100%" height="360" viewBox="0 0 800 360">
              {/* Europe background */}
              <rect x="0" y="0" width="800" height="360" fill="var(--surface2)" />
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line key={`h${i}`} x1="0" y1={i * 90} x2="800" y2={i * 90} stroke="var(--border)" strokeWidth="0.5" />
              ))}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <line key={`v${i}`} x1={i * 160} y1="0" x2={i * 160} y2="360" stroke="var(--border)" strokeWidth="0.5" />
              ))}
              {/* Site markers */}
              {sites.map(s => {
                // Map lat/lng to SVG coords (rough Europe mapping)
                const x = ((s.lng + 10) / 30) * 700 + 50
                const y = ((60 - s.lat) / 25) * 300 + 30
                const r = Math.sqrt(s.solar_kw / 500) * 10
                const col = STATUS_COLOR[s.status]
                return (
                  <g key={s.id} onClick={() => setSelected(selected === s.id ? null : s.id)} style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r={r + 6} fill={`${col}20`} />
                    <circle cx={x} cy={y} r={r} fill={col} opacity={0.9}
                      stroke={selected === s.id ? "#fff" : "transparent"} strokeWidth={2} />
                    <text x={x} y={y + r + 14} textAnchor="middle" fill="var(--text)" fontSize={11} fontWeight="600">{s.name.split(" ")[0]}</text>
                    <text x={x} y={y + r + 26} textAnchor="middle" fill={green} fontSize={10}>€{s.revenue_today.toLocaleString()}</text>
                  </g>
                )
              })}
            </svg>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {sites.map(s => (
              <div key={s.id} onClick={() => setSelected(selected === s.id ? null : s.id)}
                style={{ ...card, padding: "8px 14px", cursor: "pointer", flex: 1, minWidth: 160, border: `1px solid ${selected === s.id ? accent : "var(--border)"}` }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[s.status] }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--sub)" }}>{s.location} · {(s.solar_kw / 1000).toFixed(1)} MWp</div>
                <div style={{ fontSize: 12, color: green, fontWeight: 600, marginTop: 2 }}>€{s.revenue_today.toLocaleString()}/day</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Site detail drawer */}
      {selected !== null && site && tab !== "Map" && (
        <div style={{ ...card, marginTop: 20, borderLeft: `3px solid ${accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{site.name}</span>
              <span style={{ color: "var(--sub)", fontSize: 13, marginLeft: 12 }}>{site.location} · Commissioned {site.commissioned}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: "var(--sub)", fontSize: 12 }}>✕ Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
            {[
              { l: "Solar Installed", v: `${site.solar_kw} kWp`, c: amber },
              { l: "BESS", v: `${site.battery_kwh} kWh / ${site.battery_kw} kW`, c: blue },
              { l: "SoC", v: `${site.soc.toFixed(0)}%`, c: site.soc > 50 ? green : amber },
              { l: "Solar Now", v: `${site.solar_now} kW`, c: amber },
              { l: "Grid Export", v: `${site.grid_export} kW`, c: green },
              { l: "Revenue Today", v: `€${site.revenue_today.toLocaleString()}`, c: green },
            ].map(m => (
              <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 4 }}>{m.l}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
