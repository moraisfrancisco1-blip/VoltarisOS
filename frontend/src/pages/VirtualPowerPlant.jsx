import { useState, useEffect, useRef } from "react"
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

const API = import.meta.env.VITE_API_URL || ""

// ─── mock data generators ───────────────────────────────────────────────────
function mkGroups() {
  return [
    { id: 1, name: "Solar Cluster Alpha", assets: 12, capacity_kw: 4800, available_kw: 3240, status: "active", type: "solar", location: "Lisbon North", soc: null },
    { id: 2, name: "BESS Array Delta",    assets: 6,  capacity_kw: 2400, available_kw: 1980, status: "active", type: "bess",  location: "Porto Hub",    soc: 74 },
    { id: 3, name: "Wind Park Omega",     assets: 4,  capacity_kw: 6000, available_kw: 4200, status: "active", type: "wind",  location: "Alentejo",     soc: null },
    { id: 4, name: "EV Fleet Beta",       assets: 24, capacity_kw: 1200, available_kw: 480,  status: "partial",type: "ev",    location: "Faro District",soc: 62 },
    { id: 5, name: "Industrial DR Gamma", assets: 8,  capacity_kw: 3200, available_kw: 3200, status: "standby",type: "dr",   location: "Setúbal",      soc: null },
  ]
}

function mkBids() {
  const types = ["FCR-N","FCR-D","aFRR","mFRR","DA-Energy","ID-Energy"]
  const statuses = ["accepted","accepted","accepted","pending","rejected","pending"]
  const now = Date.now()
  return Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    type:    types[i % types.length],
    volume:  Math.round(50 + Math.random() * 950),
    price:   +(40 + Math.random() * 60).toFixed(2),
    revenue: +(Math.random() * 2800).toFixed(2),
    status:  statuses[i % statuses.length],
    time:    new Date(now - i * 3_600_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  }))
}

function mkDispatch() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2,"0")}:00`,
    solar:    h >= 6 && h <= 19 ? Math.round(800 + Math.sin((h-6)/13*Math.PI)*3200) : 0,
    bess:     Math.round((h >= 17 && h <= 21) ? 1200 + Math.random()*600 : (h >= 2 && h <= 6 ? -800 : Math.random()*200-100)),
    wind:     Math.round(1200 + Math.sin(h/3)*800 + Math.random()*400),
    ev:       Math.round(h >= 22 || h <= 6 ? 400 + Math.random()*200 : 100),
    demand:   Math.round(2800 + Math.sin(h/12*Math.PI)*1600 + Math.random()*300),
    price:    +(30 + (h >= 17 && h <= 21 ? 65 : h >= 7 && h <= 9 ? 45 : 10) + Math.random()*15).toFixed(1),
  }))
}

function mkKPIs(groups) {
  const totalCap   = groups.reduce((a,g) => a + g.capacity_kw, 0)
  const totalAvail = groups.reduce((a,g) => a + g.available_kw, 0)
  return {
    total_capacity_kw: totalCap,
    available_kw: totalAvail,
    utilization: Math.round((totalAvail / totalCap) * 100),
    active_groups: groups.filter(g => g.status === "active").length,
    revenue_today: 4_280,
    revenue_mtd: 89_540,
    bids_accepted: 8,
    bids_total: 12,
    co2_avoided: 18.4,
    fcr_score: 98.2,
    response_time_ms: 142,
  }
}

const STATUS_COLOR = {
  active:  "#4ade80",
  partial: "#f59e0b",
  standby: "#6b7280",
  offline: "#f87171",
}

const TYPE_ICON = {
  solar: "☀️",
  bess:  "🔋",
  wind:  "💨",
  ev:    "⚡",
  dr:    "🏭",
}

const BID_COLOR = {
  accepted: "#4ade80",
  pending:  "#f59e0b",
  rejected: "#f87171",
}

const PIE_COLORS = ["#f59e0b","#4ade80","#38bdf8","#a78bfa","#f87171"]

// ─── sub-components ─────────────────────────────────────────────────────────
function KPICard({ label, value, unit, sub, color="#4ade80", icon }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "12px", padding: "18px 20px",
      display: "flex", flexDirection: "column", gap: "6px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "var(--sub)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
        {icon && <span style={{ fontSize: "18px" }}>{icon}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span style={{ fontSize: "26px", fontWeight: 800, color }}>{value}</span>
        {unit && <span style={{ fontSize: "13px", color: "var(--sub)" }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: "11px", color: "var(--sub)" }}>{sub}</div>}
    </div>
  )
}

function GroupCard({ group, selected, onSelect }) {
  const c = STATUS_COLOR[group.status] || "#6b7280"
  const pct = Math.round((group.available_kw / group.capacity_kw) * 100)
  return (
    <div
      onClick={onSelect}
      style={{
        background: selected ? `${c}10` : "var(--surface)",
        border: `1px solid ${selected ? c : "var(--border)"}`,
        borderRadius: "12px", padding: "16px", cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px" }}>{TYPE_ICON[group.type]}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{group.name}</div>
            <div style={{ fontSize: "11px", color: "var(--sub)" }}>{group.location}</div>
          </div>
        </div>
        <span style={{
          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
          background: `${c}18`, color: c, fontWeight: 700, textTransform: "uppercase",
        }}>{group.status}</span>
      </div>
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>{group.assets}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>Assets</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>{(group.capacity_kw/1000).toFixed(1)}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>MW cap</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: c }}>{(group.available_kw/1000).toFixed(1)}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>MW avail</div>
        </div>
        {group.soc !== null && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#38bdf8" }}>{group.soc}%</div>
            <div style={{ fontSize: "10px", color: "var(--sub)" }}>SOC</div>
          </div>
        )}
      </div>
      {/* availability bar */}
      <div style={{ height: "4px", background: "var(--surface2)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: c, borderRadius: "2px", transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: "10px", color: "var(--sub)", marginTop: "4px", textAlign: "right" }}>{pct}% available</div>
    </div>
  )
}

function BidForm({ groups, onSubmit }) {
  const [form, setForm] = useState({
    market: "FCR-N",
    group_id: groups[0]?.id || 1,
    volume: 500,
    price: 55.0,
    duration: 1,
  })
  const [submitting, setSubmitting] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(form)
    setSubmitting(false)
  }

  const inputStyle = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "8px 12px", color: "var(--text)", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  }
  const labelStyle = { fontSize: "11px", color: "var(--sub)", marginBottom: "4px", display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }

  const revenue_est = (form.volume * form.price * form.duration / 1000).toFixed(0)

  return (
    <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Market</label>
          <select style={inputStyle} value={form.market} onChange={e => setForm(f => ({...f, market: e.target.value}))}>
            {["FCR-N","FCR-D","aFRR","mFRR","DA-Energy","ID-Energy"].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Asset Group</label>
          <select style={inputStyle} value={form.group_id} onChange={e => setForm(f => ({...f, group_id: +e.target.value}))}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Volume (kW)</label>
          <input type="number" style={inputStyle} value={form.volume} min={50} max={10000}
            onChange={e => setForm(f => ({...f, volume: +e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Price (€/MWh)</label>
          <input type="number" style={inputStyle} value={form.price} min={1} max={500} step={0.5}
            onChange={e => setForm(f => ({...f, price: +e.target.value}))} />
        </div>
        <div>
          <label style={labelStyle}>Duration (h)</label>
          <select style={inputStyle} value={form.duration} onChange={e => setForm(f => ({...f, duration: +e.target.value}))}>
            {[1,2,4,6,12,24].map(d => <option key={d} value={d}>{d}h</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Est. Revenue</label>
          <div style={{ ...inputStyle, color: "#4ade80", fontWeight: 700 }}>€{revenue_est}</div>
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "10px 0", background: "#f59e0b", color: "#000", fontWeight: 700,
          border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
          opacity: submitting ? 0.6 : 1, transition: "opacity 0.15s",
        }}
      >
        {submitting ? "Submitting…" : "⚡ Submit VPP Bid"}
      </button>
    </form>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────
export default function VirtualPowerPlant({ user }) {
  const [groups,   setGroups]   = useState([])
  const [bids,     setBids]     = useState([])
  const [dispatch, setDispatch] = useState([])
  const [kpis,     setKPIs]     = useState(null)
  const [selGroup, setSelGroup] = useState(null)
  const [tab,      setTab]      = useState("overview")
  const [toast,    setToast]    = useState(null)
  const [bidFilter,setBidFilter]= useState("all")
  const intervalRef = useRef(null)

  // hydrate with mock/api data
  useEffect(() => {
    const g = mkGroups()
    setGroups(g)
    setBids(mkBids())
    setDispatch(mkDispatch())
    setKPIs(mkKPIs(g))

    // try real API
    ;(async () => {
      try {
        const r = await fetch(`${API}/api/vpp/groups`, { headers: { Authorization: `Bearer ${user?.token || "demo"}` } })
        if (r.ok) {
          const data = await r.json()
          if (data?.length) setGroups(data)
        }
      } catch {}
      try {
        const r = await fetch(`${API}/api/vpp/bids`, { headers: { Authorization: `Bearer ${user?.token || "demo"}` } })
        if (r.ok) {
          const data = await r.json()
          if (data?.length) setBids(data)
        }
      } catch {}
    })()

    // live updates for dispatch
    intervalRef.current = setInterval(() => setDispatch(mkDispatch()), 30_000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const showToast = (msg, color="#4ade80") => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const handleBidSubmit = async (form) => {
    try {
      const r = await fetch(`${API}/api/vpp/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user?.token || "demo"}` },
        body: JSON.stringify(form),
      })
      const data = r.ok ? await r.json() : null
      const accepted = data?.accepted ?? Math.random() > 0.25
      const newBid = {
        id: bids.length + 1,
        type:    form.market,
        volume:  form.volume,
        price:   form.price,
        revenue: +(form.volume * form.price * form.duration / 1000).toFixed(2),
        status:  accepted ? "accepted" : "rejected",
        time:    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      }
      setBids(prev => [newBid, ...prev])
      showToast(accepted ? `✅ Bid accepted — ${form.market} ${form.volume}kW @ €${form.price}` : `❌ Bid rejected — ${form.market}`, accepted ? "#4ade80" : "#f87171")
    } catch {
      showToast("⚠️ API offline — bid simulated (75% accept rate)")
      const accepted = Math.random() > 0.25
      const newBid = {
        id: bids.length + 1, type: form.market, volume: form.volume, price: form.price,
        revenue: +(form.volume * form.price * form.duration / 1000).toFixed(2),
        status:  accepted ? "accepted" : "rejected",
        time:    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      }
      setBids(prev => [newBid, ...prev])
    }
  }

  if (!kpis) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--sub)" }}>
      Loading VPP data…
    </div>
  )

  const filteredBids = bidFilter === "all" ? bids : bids.filter(b => b.status === bidFilter)

  // pie data
  const pieData = groups.map(g => ({ name: g.name.split(" ")[0], value: g.available_kw }))

  // capacity mix bar
  const mixData = groups.map(g => ({
    name: g.name.split(" ").slice(-1)[0],
    capacity: g.capacity_kw,
    available: g.available_kw,
  }))

  const TABS = ["overview","dispatch","bids","groups"]

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", position: "relative" }}>
      {/* toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "80px", right: "24px", zIndex: 9999,
          background: "var(--surface)", border: `1px solid ${toast.color}`,
          borderRadius: "10px", padding: "12px 20px",
          color: toast.color, fontSize: "13px", fontWeight: 600,
          boxShadow: `0 4px 24px ${toast.color}30`,
          animation: "fadeIn 0.2s ease",
        }}>
          {toast.msg}
        </div>
      )}

      {/* header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg,#f59e0b,#f97316)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>⚡</div>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>Virtual Power Plant</h1>
            <div style={{ fontSize: "13px", color: "var(--sub)", marginTop: "2px" }}>Aggregate dispatch · Market bidding · Fleet coordination</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: 700, textTransform: "uppercase" }}>Live Aggregator</span>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px", marginBottom: "24px" }}>
        <KPICard label="Total Capacity"   value={(kpis.total_capacity_kw/1000).toFixed(1)} unit="MW"    color="#f59e0b" icon="⚡" />
        <KPICard label="Available Now"    value={(kpis.available_kw/1000).toFixed(1)}       unit="MW"    color="#4ade80" icon="✅" />
        <KPICard label="Utilization"      value={kpis.utilization}                           unit="%"     color="#38bdf8" icon="📊" />
        <KPICard label="Active Groups"    value={kpis.active_groups}                         unit=""      color="#a78bfa" icon="🏢" />
        <KPICard label="Revenue Today"    value={`€${kpis.revenue_today.toLocaleString()}`}  unit=""      color="#4ade80" icon="💰" sub={`€${kpis.revenue_mtd.toLocaleString()} MTD`} />
        <KPICard label="Bids Accepted"    value={`${kpis.bids_accepted}/${kpis.bids_total}`} unit=""      color="#f59e0b" icon="📋" />
        <KPICard label="CO₂ Avoided"      value={kpis.co2_avoided}                           unit="t"     color="#4ade80" icon="🌱" />
        <KPICard label="FCR Score"        value={kpis.fcr_score}                             unit="%"     color="#4ade80" icon="🎯" sub={`${kpis.response_time_ms}ms avg response`} />
      </div>

      {/* tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--surface)", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: "7px", border: "none", cursor: "pointer",
            fontWeight: tab === t ? 700 : 400, fontSize: "13px",
            background: tab === t ? "var(--surface2)" : "transparent",
            color: tab === t ? "var(--text)" : "var(--sub)",
            textTransform: "capitalize", transition: "all 0.12s",
          }}>
            {t === "overview" ? "📊 Overview" : t === "dispatch" ? "⚡ Dispatch" : t === "bids" ? "📋 Bids" : "🏢 Groups"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* capacity mix */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Capacity Mix by Group</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mixData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: "var(--sub)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--sub)", fontSize: 11 }} tickFormatter={v => `${v/1000}MW`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
                  formatter={v => [`${v}kW`]}
                />
                <Bar dataKey="capacity"  fill="#f59e0b" opacity={0.4} radius={[4,4,0,0]} />
                <Bar dataKey="available" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: "16px", marginTop: "10px", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--sub)" }}>
                <span style={{ width: "12px", height: "12px", background: "#f59e0b", opacity: 0.4, borderRadius: "2px" }} />Capacity
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--sub)" }}>
                <span style={{ width: "12px", height: "12px", background: "#f59e0b", borderRadius: "2px" }} />Available
              </div>
            </div>
          </div>

          {/* availability pie */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Available Power Distribution</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
                  formatter={v => [`${v}kW`]}
                />
                <Legend wrapperStyle={{ fontSize: "11px", color: "var(--sub)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* recent bids summary */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", gridColumn: "1/-1" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Market Revenue — Last 12 Bids</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={bids.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="type" tick={{ fill: "var(--sub)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--sub)", fontSize: 11 }} tickFormatter={v => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
                  formatter={v => [`€${v}`, "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── DISPATCH TAB ── */}
      {tab === "dispatch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* 24h aggregate generation */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>24h Aggregate Dispatch Plan</div>
                <div style={{ fontSize: "12px", color: "var(--sub)" }}>Generation by source vs demand curve</div>
              </div>
              <button onClick={() => setDispatch(mkDispatch())} style={{
                padding: "6px 14px", background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: "8px", color: "var(--sub)", cursor: "pointer", fontSize: "12px",
              }}>↻ Refresh</button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dispatch}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickFormatter={v => `${v}kW`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
                  formatter={(v, n) => [`${v}kW`, n.charAt(0).toUpperCase()+n.slice(1)]}
                />
                <Area type="monotone" dataKey="solar"  stackId="gen" stroke="#f59e0b" fill="#f59e0b40" strokeWidth={1.5} />
                <Area type="monotone" dataKey="wind"   stackId="gen" stroke="#38bdf8" fill="#38bdf820" strokeWidth={1.5} />
                <Area type="monotone" dataKey="bess"   stackId="gen" stroke="#4ade80" fill="#4ade8020" strokeWidth={1.5} />
                <Area type="monotone" dataKey="ev"     stackId="gen" stroke="#a78bfa" fill="#a78bfa20" strokeWidth={1.5} />
                <Line  type="monotone" dataKey="demand" stroke="#f87171" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: "11px", color: "var(--sub)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* price overlay */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Spot Price & Dispatch Window</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dispatch}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 10 }} interval={2} />
                <YAxis tick={{ fill: "var(--sub)", fontSize: 10 }} tickFormatter={v => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }}
                  formatter={v => [`€${v}/MWh`, "Spot Price"]}
                />
                <Area type="monotone" dataKey="price" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── BIDS TAB ── */}
      {tab === "bids" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "20px" }}>
          {/* bid form */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>⚡ Submit Market Bid</div>
            <BidForm groups={groups} onSubmit={handleBidSubmit} />
          </div>

          {/* bid history */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>Bid History</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["all","accepted","pending","rejected"].map(f => (
                  <button key={f} onClick={() => setBidFilter(f)} style={{
                    padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                    fontSize: "11px", fontWeight: bidFilter === f ? 700 : 400,
                    background: bidFilter === f ? "var(--surface2)" : "transparent",
                    color: bidFilter === f ? "var(--text)" : "var(--sub)",
                    textTransform: "capitalize",
                  }}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ overflowY: "auto", maxHeight: "420px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ color: "var(--sub)" }}>
                    {["Time","Market","Volume","Price","Revenue","Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBids.map(b => (
                    <tr key={b.id} style={{ borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "8px", color: "var(--sub)" }}>{b.time}</td>
                      <td style={{ padding: "8px", fontWeight: 600, color: "var(--text)" }}>{b.type}</td>
                      <td style={{ padding: "8px", color: "var(--text)" }}>{b.volume}kW</td>
                      <td style={{ padding: "8px", color: "var(--text)" }}>€{b.price}</td>
                      <td style={{ padding: "8px", color: "#4ade80", fontWeight: 600 }}>€{b.revenue}</td>
                      <td style={{ padding: "8px" }}>
                        <span style={{
                          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
                          background: `${BID_COLOR[b.status]}18`, color: BID_COLOR[b.status],
                          fontWeight: 700, textTransform: "uppercase",
                        }}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBids.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--sub)", padding: "40px", fontSize: "13px" }}>No bids matching filter</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GROUPS TAB ── */}
      {tab === "groups" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px", marginBottom: "20px" }}>
            {groups.map(g => (
              <GroupCard
                key={g.id}
                group={g}
                selected={selGroup?.id === g.id}
                onSelect={() => setSelGroup(selGroup?.id === g.id ? null : g)}
              />
            ))}
          </div>

          {selGroup && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", color: "var(--text)" }}>
                {TYPE_ICON[selGroup.type]} {selGroup.name} — Detail
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "12px", marginBottom: "16px" }}>
                <KPICard label="Assets"      value={selGroup.assets}                            unit=""      color="#f59e0b" />
                <KPICard label="Capacity"    value={(selGroup.capacity_kw/1000).toFixed(1)}     unit="MW"    color="#38bdf8" />
                <KPICard label="Available"   value={(selGroup.available_kw/1000).toFixed(1)}    unit="MW"    color="#4ade80" />
                <KPICard label="Location"    value={selGroup.location}                          unit=""      color="var(--sub)" />
                {selGroup.soc !== null && <KPICard label="SOC" value={selGroup.soc} unit="%" color="#38bdf8" />}
              </div>
              <div style={{ height: "6px", background: "var(--surface2)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.round((selGroup.available_kw/selGroup.capacity_kw)*100)}%`,
                  background: STATUS_COLOR[selGroup.status],
                  borderRadius: "3px", transition: "width 0.5s",
                }} />
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "6px" }}>
                {Math.round((selGroup.available_kw/selGroup.capacity_kw)*100)}% availability
                · Status: <span style={{ color: STATUS_COLOR[selGroup.status], fontWeight: 600 }}>{selGroup.status}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
