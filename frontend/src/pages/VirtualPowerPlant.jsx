import { useState, useEffect } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const API = import.meta.env.VITE_API_URL || ""

function mkKPIs(groups) {
  // Only derive KPIs supported by GET /api/vpp (group metadata).
  return {
    total_capacity_kw: null,
    available_kw: null,
    utilization: null,
    active_groups: groups.filter(g => g.active === true).length,
    revenue_today: null,
    revenue_mtd: null,
    bids_accepted: null,
    bids_total: null,
    co2_avoided: null,
    fcr_score: null,
    response_time_ms: null,
  }
}

const STATUS_COLOR = {
  active:  "#4ade80",
  offline: "#f87171",
}

const BID_COLOR = {
  accepted: "#4ade80",
  pending:  "#f59e0b",
  rejected: "#f87171",
}

// ─── sub-components ─────────────────────────────────────────────────────────
function KPICard({ label, value, unit, sub, color = "#4ade80", icon }) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value
  const displaySub = sub === null || sub === undefined || sub === "" ? "" : sub
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
        <span style={{ fontSize: "26px", fontWeight: 800, color }}>{displayValue}</span>
        {unit && displayValue !== "—" && <span style={{ fontSize: "13px", color: "var(--sub)" }}>{unit}</span>}
      </div>
      {displaySub && <div style={{ fontSize: "11px", color: "var(--sub)" }}>{displaySub}</div>}
    </div>
  )
}

function GroupCard({ group, selected, onSelect }) {
  const active = group.active
  const c = active ? STATUS_COLOR.active : STATUS_COLOR.offline
  const target = group.target_kw

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
          <span style={{ fontSize: "20px" }}>⚡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{group.name}</div>
            <div style={{ fontSize: "11px", color: "var(--sub)" }}>{group.market || "—"} · {group.strategy || "—"}</div>
          </div>
        </div>
        <span style={{
          fontSize: "10px", padding: "2px 8px", borderRadius: "20px",
          background: `${c}18`, color: c, fontWeight: 700, textTransform: "uppercase",
        }}>{active ? "active" : "inactive"}</span>
      </div>
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>{target !== undefined && target !== null ? `${target} kW` : "—"}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>Target</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)" }}>{group.min_bid_kw !== undefined && group.min_bid_kw !== null ? `${group.min_bid_kw} kW` : "—"}</div>
          <div style={{ fontSize: "10px", color: "var(--sub)" }}>Min Bid</div>
        </div>
      </div>
      <div style={{ fontSize: "10px", color: "var(--sub)", marginTop: "4px", textAlign: "right" }}>
        Status: <span style={{ color: c, fontWeight: 600 }}>{active ? "active" : "inactive"}</span>
      </div>
    </div>
  )
}

const BID_DIRECTIONS = ["sell", "buy", "fcr_up", "fcr_down", "afrr_up", "afrr_down"]

function BidForm({ group, onSubmit, submitting, error }) {
  const [direction, setDirection] = useState("sell")
  const [quantityKw, setQuantityKw] = useState(group?.min_bid_kw || 100)
  const [price, setPrice] = useState("")

  const handle = (e) => {
    e.preventDefault()
    const qty = Number(quantityKw)
    if (!qty || qty <= 0) return
    onSubmit({
      direction,
      quantity_kw: qty,
      price_eur_mwh: price === "" ? null : Number(price),
    })
  }

  const inputStyle = {
    width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "8px 12px", color: "var(--text)", fontSize: "13px",
    outline: "none", boxSizing: "border-box",
  }
  const labelStyle = { fontSize: "11px", color: "var(--sub)", marginBottom: "4px", display: "block", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }

  return (
    <form onSubmit={handle} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={labelStyle}>Direction</label>
          <select style={inputStyle} value={direction} onChange={e => setDirection(e.target.value)}>
            {BID_DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Quantity (kW)</label>
          <input type="number" style={inputStyle} value={quantityKw}
            min={group?.min_bid_kw !== undefined && group?.min_bid_kw !== null ? group.min_bid_kw : 0}
            onChange={e => setQuantityKw(Number(e.target.value))} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Price (€/MWh) — optional</label>
          <input type="number" style={inputStyle} value={price} min={0}
            onChange={e => setPrice(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ color: "#f87171", fontSize: "12px" }}>{error}</div>}
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
export default function VirtualPowerPlant() {
  const [groups, setGroups] = useState(null)
  const [kpis, setKPIs] = useState(null)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState("overview")
  const [bidFilter, setBidFilter] = useState("all")

  // Single source of truth for the selected VPP.
  const [selectedVppId, setSelectedVppId] = useState(null)

  // Assets
  const [aggregate, setAggregate] = useState(null)
  const [devices, setDevices] = useState([])
  const [readings, setReadings] = useState({})
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState(null)

  // Economic forecast
  const [optimize, setOptimize] = useState(null)
  const [econLoading, setEconLoading] = useState(false)
  const [econError, setEconError] = useState(null)

  // Dispatch dry-run
  const [dryRun, setDryRun] = useState(null)
  const [dryLoading, setDryLoading] = useState(false)
  const [dryError, setDryError] = useState(null)

  // Bids
  const [bids, setBids] = useState([])
  const [bidsLoading, setBidsLoading] = useState(false)
  const [bidsError, setBidsError] = useState(null)
  const [bidSubmitting, setBidSubmitting] = useState(false)
  const [bidSubmitError, setBidSubmitError] = useState(null)
  const [bidsRefreshKey, setBidsRefreshKey] = useState(0)

  const selectedGroup = groups ? groups.find(g => g.id === selectedVppId) || null : null

  // ── Fetch VPP groups from real API ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const fetchGroups = async () => {
      setError(null)
      try {
        const r = await fetch(`${API}/api/vpp`)
        if (!r.ok) throw new Error(`Failed to load VPP groups (${r.status})`)
        const data = await r.json()
        if (!cancelled) {
          const normalized = (Array.isArray(data) ? data : []).map(g => ({
            ...g,
            active: g.active !== undefined ? g.active : true,
          }))
          setGroups(normalized)
          setKPIs(mkKPIs(normalized))
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    fetchGroups()
    return () => { cancelled = true }
  }, [])

  // ── Shared VPP selection ─────────────────────────────────────────────────
  const handleSelectVpp = (id) => {
    setSelectedVppId(id || null)
    // Clear results that belong to a previous VPP (never groups).
    setAggregate(null)
    setDevices([])
    setReadings({})
    setAssetsError(null)
    setOptimize(null)
    setEconError(null)
    setDryRun(null)
    setDryError(null)
    setBids([])
    setBidsError(null)
    setBidSubmitError(null)
    setBidFilter("all")
  }

  // ── Assets: resolve VPP → sites → devices → latest telemetry ─────────────
  useEffect(() => {
    if (selectedVppId == null) {
      setAggregate(null)
      setDevices([])
      setReadings({})
      setAssetsError(null)
      return
    }
    let cancelled = false
    const loadAssets = async () => {
      setAssetsLoading(true)
      setAssetsError(null)
      setAggregate(null)
      try {
        const aggRes = await fetch(`${API}/api/vpp/${selectedVppId}/aggregate`)
        if (!aggRes.ok) throw new Error(`Failed to load aggregate (${aggRes.status})`)
        const agg = await aggRes.json()
        if (cancelled) return
        const siteIds = new Set((agg.sites || []).map(s => s.site_id))

        const devRes = await fetch(`${API}/api/devices`)
        if (!devRes.ok) throw new Error(`Failed to load devices (${devRes.status})`)
        const allDevices = await devRes.json()
        if (cancelled) return
        const vppDevices = (Array.isArray(allDevices) ? allDevices : [])
          .filter(d => siteIds.has(d.site_id))

        const rdMap = {}
        await Promise.all(vppDevices.map(async (d) => {
          try {
            const rRes = await fetch(`${API}/api/devices/${d.id}/readings?limit=1`)
            if (rRes.ok) {
              const list = await rRes.json()
              if (Array.isArray(list) && list.length > 0) rdMap[d.id] = list[0]
            }
          } catch {
            // leave missing → rendered as "—"
          }
        }))

        if (cancelled) return
        setAggregate(agg)
        setDevices(vppDevices)
        setReadings(rdMap)
      } catch (err) {
        if (!cancelled) setAssetsError(err.message)
      } finally {
        if (!cancelled) setAssetsLoading(false)
      }
    }
    loadAssets()
    return () => { cancelled = true }
  }, [selectedVppId])

  // ── Bids: load real bids for the selected VPP ────────────────────────────
  useEffect(() => {
    if (selectedVppId == null) {
      setBids([])
      setBidsError(null)
      return
    }
    let cancelled = false
    const loadBids = async () => {
      setBidsLoading(true)
      setBidsError(null)
      try {
        const r = await fetch(`${API}/api/vpp/${selectedVppId}/bids?limit=50`)
        if (!r.ok) throw new Error(`Failed to load bids (${r.status})`)
        const data = await r.json()
        if (!cancelled) setBids(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setBidsError(err.message)
      } finally {
        if (!cancelled) setBidsLoading(false)
      }
    }
    loadBids()
    return () => { cancelled = true }
  }, [selectedVppId, bidsRefreshKey])

  // ── Economic Forecast ────────────────────────────────────────────────────
  const mapOptimizeError = (status, detail) => {
    switch (status) {
      case 400: return "Invalid optimization input" + (detail ? `: ${detail}` : "") + "."
      case 404: return "VPP not found."
      case 409: return "VPP is inactive and cannot be optimized."
      case 502: return "Price provider failed" + (detail ? `: ${detail}` : "") + "."
      case 503: return "Real price source is not configured or unavailable. Optimization cannot run without an available server-side price source or an explicitly supplied price series."
      default: return `Optimization failed (HTTP ${status})` + (detail ? `: ${detail}` : "") + "."
    }
  }

  const runOptimization = async () => {
    if (!selectedVppId) return
    setEconLoading(true)
    setEconError(null)
    setOptimize(null)
    try {
      const r = await fetch(`${API}/api/vpp/${selectedVppId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_hours: 24 }),
      })
      if (!r.ok) {
        let detail = ""
        try { const j = await r.json(); detail = j?.detail || "" } catch {}
        setEconError(mapOptimizeError(r.status, detail))
        return
      }
      setOptimize(await r.json())
    } catch {
      setEconError("Connection error — could not reach the optimization endpoint.")
    } finally {
      setEconLoading(false)
    }
  }

  // ── Dispatch dry-run ─────────────────────────────────────────────────────
  const mapDispatchError = (status, detail) => {
    switch (status) {
      case 400: return "Invalid dispatch input. Check the optimization parameters."
      case 404: return "VPP not found."
      case 409: return "VPP is inactive and cannot run a dispatch."
      case 422: return "Optimization did not produce an optimal result, so no dispatch setpoints were generated."
      case 502: return "Price provider failed while retrieving the required price data."
      case 503: return "Real price data is not configured or currently unavailable. Dry-run cannot proceed without a valid server-side price source or an explicitly supplied price series."
      default: return `Dry-run dispatch failed (HTTP ${status})${detail ? `: ${detail}` : ""}.`
    }
  }

  const runDryRun = async () => {
    if (!selectedVppId) return
    setDryLoading(true)
    setDryError(null)
    setDryRun(null)
    try {
      const r = await fetch(`${API}/api/vpp/${selectedVppId}/dispatch/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horizon_hours: 24 }),
      })
      if (!r.ok) {
        let detail = ""
        try { const j = await r.json(); detail = j?.detail || "" } catch {}
        setDryError(mapDispatchError(r.status, detail))
        return
      }
      setDryRun(await r.json())
    } catch {
      setDryError("Connection error — could not reach the dry-run dispatch endpoint.")
    } finally {
      setDryLoading(false)
    }
  }

  // ── Bids submit ──────────────────────────────────────────────────────────
  const handleBidSubmit = async ({ direction, quantity_kw, price_eur_mwh }) => {
    if (!selectedVppId) return
    setBidSubmitting(true)
    setBidSubmitError(null)
    try {
      const r = await fetch(`${API}/api/vpp/${selectedVppId}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity_kw, price_eur_mwh, direction }),
      })
      if (!r.ok) {
        let detail = ""
        try { const j = await r.json(); detail = j?.detail || "" } catch {}
        setBidSubmitError(`Failed to submit bid (${r.status})${detail ? `: ${detail}` : ""}.`)
        return
      }
      setBidsRefreshKey(k => k + 1)
    } catch {
      setBidSubmitError("Connection error — could not reach the bid endpoint.")
    } finally {
      setBidSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (groups === null && !error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--sub)" }}>
      Loading VPP data…
    </div>
  )

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{
      padding: "40px",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "16px", color: "#f87171", textAlign: "center",
    }}>
      <div style={{
        width: "48px", height: "48px", borderRadius: "12px",
        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
      }}>⚡</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "6px" }}>Failed to load VPP data</div>
        <div style={{ fontSize: "13px", color: "var(--sub)" }}>{error}</div>
      </div>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: "8px 20px", background: "#f59e0b", color: "#000", fontWeight: 700,
          border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px",
        }}
      >↻ Retry</button>
    </div>
  )

  // ── Empty state ────────────────────────────────────────────────────────────
  if (groups !== null && groups.length === 0) return (
    <div style={{
      padding: "40px",
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: "16px", color: "var(--sub)", textAlign: "center",
    }}>
      <div style={{
        width: "56px", height: "56px", borderRadius: "16px",
        background: "var(--surface2)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px",
      }}>🏢</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "16px", color: "var(--text)", marginBottom: "4px" }}>No VPP Groups Yet</div>
        <div style={{ fontSize: "13px" }}>Create your first VPP group to start aggregating flexible assets.</div>
      </div>
    </div>
  )

  const filteredBids = bidFilter === "all" ? bids : bids.filter(b => b.status === bidFilter)

  const TABS = ["overview", "dispatch", "bids", "groups", "assets", "econ"]

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpi = kpis || mkKPIs(groups)

  // Economic Forecast derived values (real response fields only)
  const econChartData = (Array.isArray(optimize?.vpp_dispatch) ? optimize.vpp_dispatch : [])
    .map((kw, i) => ({ hour: i, dispatch: kw }))
  const econScheduleRows = Array.isArray(optimize?.schedule) ? optimize.schedule : []

  // Dispatch (dry-run) derived values (real response fields only)
  const dryChartData = (Array.isArray(dryRun?.dispatch?.vpp) ? dryRun.dispatch.vpp : [])
    .map((kw, i) => ({ hour: i, power_kw: kw }))
  const drySetpoints = Array.isArray(dryRun?.execution?.setpoints) ? dryRun.execution.setpoints : []
  const drySites = dryRun?.dispatch?.sites || {}
  const dryAssets = dryRun?.dispatch?.assets || {}
  const dryWarnings = Array.isArray(dryRun?.mapping?.warnings) ? dryRun.mapping.warnings : []
  const drySiteIds = Array.isArray(dryRun?.mapping?.site_ids) ? dryRun.mapping.site_ids : []

  return (
    <div style={{ padding: "24px", maxWidth: "1600px", margin: "0 auto", position: "relative" }}>
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
            <span style={{ fontSize: "11px", color: "var(--sub)", fontWeight: 700, textTransform: "uppercase" }}>VPP Orchestration</span>
          </div>
        </div>
      </div>

      {/* shared VPP selector */}
      {groups && groups.length > 0 && (
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
          padding: "14px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          marginBottom: "24px",
        }}>
          <span style={{ fontSize: "13px", color: "var(--sub)", fontWeight: 600 }}>VPP Group</span>
          <select
            value={selectedVppId ?? ""}
            onChange={e => handleSelectVpp(e.target.value ? +e.target.value : null)}
            style={{
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
              padding: "8px 12px", color: "var(--text)", fontSize: "13px", minWidth: "240px",
            }}
          >
            <option value="">Select a group…</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {selectedGroup && (
            <span style={{ fontSize: "12px", color: "var(--sub)" }}>
              {selectedGroup.market || "—"} · {selectedGroup.strategy || "—"}
              {!selectedGroup.active && <span style={{ color: "#f87171" }}> (inactive)</span>}
            </span>
          )}
        </div>
      )}

      {/* KPI strip (global overview) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px", marginBottom: "24px" }}>
        <KPICard label="Total Capacity" value={kpi.total_capacity_kw ? kpi.total_capacity_kw / 1000 : null} unit="MW" color="#f59e0b" icon="⚡" />
        <KPICard label="Available Now" value={kpi.available_kw ? kpi.available_kw / 1000 : null} unit="MW" color="#4ade80" icon="✅" />
        <KPICard label="Utilization" value={kpi.utilization || null} unit="%" color="#38bdf8" icon="📊" />
        <KPICard label="Active Groups" value={kpi.active_groups} unit="" color="#a78bfa" icon="🏢" />
        <KPICard label="Revenue Today" value={kpi.revenue_today} unit="€" color="#4ade80" icon="💰" sub={kpi.revenue_mtd !== null ? `€${kpi.revenue_mtd} MTD` : null} />
        <KPICard label="Bids Accepted" value={kpi.bids_accepted !== null && kpi.bids_total !== null ? `${kpi.bids_accepted}/${kpi.bids_total}` : null} unit="" color="#f59e0b" icon="📋" />
        <KPICard label="CO₂ Avoided" value={kpi.co2_avoided} unit="t" color="#4ade80" icon="🌱" />
        <KPICard label="FCR Score" value={kpi.fcr_score} unit="%" color="#4ade80" icon="🎯" sub={kpi.response_time_ms !== null ? `${kpi.response_time_ms}ms avg response` : null} />
      </div>

      {/* tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--surface)", padding: "4px", borderRadius: "10px", width: "fit-content", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "7px 18px", borderRadius: "7px", border: "none", cursor: "pointer",
            fontWeight: tab === t ? 700 : 400, fontSize: "13px",
            background: tab === t ? "var(--surface2)" : "transparent",
            color: tab === t ? "var(--text)" : "var(--sub)",
            textTransform: "capitalize", transition: "all 0.12s",
          }}>
            {t === "overview" ? "📊 Overview" : t === "dispatch" ? "⚡ Dispatch" : t === "bids" ? "📋 Bids" : t === "groups" ? "🏢 Groups" : t === "assets" ? "🔧 Assets" : "📈 Economic Forecast"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Capacity Mix by Group</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "var(--sub)", fontSize: "13px" }}>
              No data available
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Available Power Distribution</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 220, color: "var(--sub)", fontSize: "13px" }}>
              No data available
            </div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", gridColumn: "1/-1" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>Market Revenue — Last 12 Bids</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "var(--sub)", fontSize: "13px" }}>
              No data available
            </div>
          </div>
        </div>
      )}

      {/* ── DISPATCH TAB (real dry-run) ── */}
      {tab === "dispatch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
            padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>
            <button
              onClick={runDryRun}
              disabled={!selectedVppId || dryLoading}
              style={{
                padding: "8px 18px", borderRadius: "8px", background: "#f59e0b", color: "#000",
                border: "none", cursor: selectedVppId && !dryLoading ? "pointer" : "default",
                fontWeight: 700, fontSize: "13px", opacity: !selectedVppId || dryLoading ? 0.6 : 1,
              }}
            >
              {dryLoading ? "Running…" : "🛡️ Run Dry-Run"}
            </button>
            {!selectedVppId && <span style={{ fontSize: "12px", color: "var(--sub)" }}>Select a VPP group above.</span>}
          </div>

          {!selectedVppId && !dryError && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
              ⚡ Select a VPP group to run a safe dry-run dispatch simulation.
            </div>
          )}

          {dryError && (
            <div style={{ padding: "24px", background: "var(--surface)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "12px", color: "#f87171", textAlign: "center" }}>
              <div style={{ fontWeight: 700, marginBottom: "6px" }}>Dry-run dispatch failed</div>
              <div style={{ fontSize: "13px", color: "var(--sub)" }}>{dryError}</div>
            </div>
          )}

          {selectedVppId && !dryError && dryLoading && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center" }}>
              Running dry-run dispatch…
            </div>
          )}

          {selectedVppId && !dryError && !dryLoading && dryRun && (
            <>
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: "12px", padding: "16px 20px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#f59e0b", marginBottom: "8px" }}>🛡️ Dry-Run (no physical control)</div>
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", fontSize: "12px", color: "var(--text)" }}>
                  <div><span style={{ color: "var(--sub)" }}>Mode:</span> <strong>{dryRun.execution?.mode || "—"}</strong></div>
                  <div><span style={{ color: "var(--sub)" }}>Executed:</span> <strong>{String(dryRun.execution?.executed)}</strong></div>
                  <div><span style={{ color: "var(--sub)" }}>Physical Control:</span> <strong>{dryRun.execution?.physical_control || "—"}</strong></div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px" }}>
                <KPICard label="Run ID" value={dryRun.optimization_run_id ?? null} unit="" color="var(--sub)" icon="🔢" />
                <KPICard label="Status" value={dryRun.status || "—"} unit="" color={dryRun.status === "optimal" ? "#4ade80" : "#f59e0b"} icon="⚙️" />
                <KPICard label="Price Source" value={dryRun.price_source || "—"} unit="" color="#a78bfa" icon="📡" />
                <KPICard label="Device Count" value={dryRun.mapping?.device_count ?? null} unit="" color="#4ade80" icon="🔌" />
                <KPICard label="Asset Count" value={dryRun.mapping?.asset_count ?? null} unit="" color="#38bdf8" icon="🧩" />
                <KPICard label="Site Count" value={drySiteIds.length} unit="" color="#f59e0b" icon="🏢" />
                <KPICard label="Setpoint Count" value={dryRun.execution?.setpoint_count ?? null} unit="" color="#a78bfa" icon="🎯" />
              </div>

              {dryWarnings.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#f59e0b", marginBottom: "8px" }}>⚠️ Warnings</div>
                  <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--sub)", fontSize: "12px" }}>
                    {dryWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {dryChartData.length > 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>VPP Dispatch Timeline</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={dryChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 11 }} tickFormatter={v => `H${v}`} />
                      <YAxis tick={{ fill: "var(--sub)", fontSize: 11 }} tickFormatter={v => `${v}kW`} />
                      <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }} formatter={v => [`${v} kW`, "Power"]} labelFormatter={v => `Hour ${v}`} />
                      <Area type="monotone" dataKey="power_kw" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Power (kW)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
                  No dispatch timeline available for this result.
                </div>
              )}

              {(Object.keys(drySites).length > 0 || Object.keys(dryAssets).length > 0) && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", padding: "16px 20px", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    Site & Asset Dispatch Series
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ color: "var(--sub)" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Scope</th>
                          <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Key</th>
                          <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Hourly Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(drySites).map(([key, series]) => (
                          <tr key={`site-${key}`} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 16px", color: "var(--sub)" }}>Site</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)" }}>{key}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{Array.isArray(series) ? series.length : "—"}</td>
                          </tr>
                        ))}
                        {Object.entries(dryAssets).map(([key, series]) => (
                          <tr key={`asset-${key}`} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 16px", color: "var(--sub)" }}>Asset</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)" }}>{key}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{Array.isArray(series) ? series.length : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {drySetpoints.length > 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", padding: "16px 20px", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    Device Setpoints
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: "360px", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ color: "var(--sub)" }}>
                          {["Hour", "Device ID", "Site ID", "Device Type", "Power (kW)", "Action", "Mode"].map(h => (
                            <th key={h} style={{ textAlign: ["Hour", "Device ID", "Site ID"].includes(h) ? "left" : "right", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {drySetpoints.map((sp, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "10px 16px", color: "var(--sub)", textAlign: "left" }}>{sp.hour}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "left" }}>{sp.device_id ?? "—"}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "left" }}>{sp.site_id ?? "—"}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{sp.device_type || "—"}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{typeof sp.power_kw === "number" ? sp.power_kw.toFixed(3) : "—"}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{sp.action}</td>
                            <td style={{ padding: "10px 16px", color: "var(--sub)", textAlign: "right" }}>{sp.mode || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
                  No setpoints generated for this result.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BIDS TAB (real bids) ── */}
      {tab === "bids" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "20px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>⚡ Submit Market Bid</div>
            {selectedGroup ? (
              <BidForm group={selectedGroup} onSubmit={handleBidSubmit} submitting={bidSubmitting} error={bidSubmitError} />
            ) : (
              <div style={{ color: "var(--sub)", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                Select a VPP group above to submit a bid.
              </div>
            )}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>Bid History</div>
              <div style={{ display: "flex", gap: "4px" }}>
                {["all", "accepted", "pending", "rejected"].map(f => (
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
              {!selectedVppId ? (
                <div style={{ textAlign: "center", color: "var(--sub)", padding: "40px", fontSize: "13px" }}>
                  Select a VPP group to view its bids.
                </div>
              ) : bidsLoading ? (
                <div style={{ textAlign: "center", color: "var(--sub)", padding: "40px", fontSize: "13px" }}>Loading bids…</div>
              ) : bidsError ? (
                <div style={{ textAlign: "center", color: "#f87171", padding: "40px", fontSize: "13px" }}>Failed to load bids: {bidsError}</div>
              ) : filteredBids.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--sub)", padding: "40px", fontSize: "13px" }}>No bids yet for this VPP.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ color: "var(--sub)" }}>
                      {["Time", "Market", "Direction", "Quantity", "Price", "PnL", "Status"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBids.map(b => (
                      <tr key={b.id} style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "8px", color: "var(--sub)" }}>{b.submitted_at ? new Date(b.submitted_at).toLocaleString() : "—"}</td>
                        <td style={{ padding: "8px", fontWeight: 600, color: "var(--text)" }}>{b.market || "—"}</td>
                        <td style={{ padding: "8px", color: "var(--text)" }}>{b.direction || "—"}</td>
                        <td style={{ padding: "8px", color: "var(--text)" }}>{typeof b.quantity_kw === "number" ? `${b.quantity_kw} kW` : "—"}</td>
                        <td style={{ padding: "8px", color: "var(--text)" }}>{typeof b.price_eur_mwh === "number" ? `€${b.price_eur_mwh}` : "—"}</td>
                        <td style={{ padding: "8px", color: "#4ade80", fontWeight: 600 }}>{typeof b.pnl_eur === "number" ? `€${b.pnl_eur.toFixed(2)}` : "—"}</td>
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
                selected={selectedVppId === g.id}
                onSelect={() => handleSelectVpp(selectedVppId === g.id ? null : g.id)}
              />
            ))}
          </div>

          {selectedGroup && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "16px", color: "var(--text)" }}>
                ⚡ {selectedGroup.name} — Detail
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: "12px", marginBottom: "16px" }}>
                <KPICard label="ID" value={selectedGroup.id} unit="" color="#f59e0b" />
                <KPICard label="Market" value={selectedGroup.market || "—"} unit="" color="#38bdf8" />
                <KPICard label="Strategy" value={selectedGroup.strategy || "—"} unit="" color="#4ade80" />
                <KPICard label="Target" value={selectedGroup.target_kw !== undefined && selectedGroup.target_kw !== null ? `${selectedGroup.target_kw} kW` : "—"} unit="" color="#a78bfa" />
                <KPICard label="Active" value={selectedGroup.active ? "Yes" : "No"} unit="" color={selectedGroup.active ? "#4ade80" : "#f87171"} />
                <KPICard label="Tenant" value={selectedGroup.tenant_id || "—"} unit="" color="var(--sub)" />
              </div>
              <div style={{ fontSize: "11px", color: "var(--sub)", marginTop: "6px" }}>
                Status: <span style={{ color: selectedGroup.active ? "#4ade80" : "#f87171", fontWeight: 600 }}>{selectedGroup.active ? "active" : "inactive"}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ASSETS TAB ── */}
      {tab === "assets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {!selectedVppId && !assetsError && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
              🔧 Select a VPP group above to view its assets.
            </div>
          )}

          {assetsError && (
            <div style={{ padding: "24px", background: "var(--surface)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "12px", color: "#f87171", textAlign: "center" }}>
              Failed to load assets: {assetsError}
            </div>
          )}

          {selectedVppId && !assetsError && assetsLoading && !aggregate && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center" }}>
              Loading assets…
            </div>
          )}

          {selectedVppId && !assetsError && aggregate && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px" }}>
                <KPICard label="Devices" value={devices.length} unit="" color="#4ade80" icon="🔌" />
                <KPICard label="Total Power" value={typeof aggregate.total_power_kw === "number" ? aggregate.total_power_kw.toFixed(1) : null} unit="kW" color="#f59e0b" icon="⚡" />
                <KPICard label="Sites" value={aggregate.site_count !== undefined && aggregate.site_count !== null ? aggregate.site_count : (aggregate.sites || []).length} unit="" color="#38bdf8" icon="🏢" />
              </div>

              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", padding: "16px 20px", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                  Devices in {selectedGroup?.name || "VPP"}
                </div>
                {devices.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--sub)", fontSize: "13px" }}>
                    No devices found for this VPP's sites.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ color: "var(--sub)" }}>
                          {["Device", "Type", "Protocol", "Site", "Status", "Enabled", "Power", "SoC", "Last Seen"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {devices.map((d, i) => {
                          const rd = readings[d.id]
                          const power = rd?.power_kw
                          const soc = rd?.soc_pct
                          const stColor = d.status === "online" ? "#4ade80" : d.status === "offline" ? "#f87171" : "var(--sub)"
                          return (
                            <tr key={d.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 700, color: "var(--text)" }}>{d.name}</div>
                                <div style={{ color: "var(--sub)", fontSize: 11 }}>ID #{d.id}</div>
                              </td>
                              <td style={{ padding: "12px 16px", color: "var(--text)" }}>{d.device_type || "—"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--sub)" }}>{d.protocol || "—"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--sub)" }}>{d.site_id ?? "—"}</td>
                              <td style={{ padding: "12px 16px", color: stColor, fontWeight: 600, textTransform: "capitalize" }}>{d.status || "—"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--text)" }}>{d.enabled ? "Yes" : "No"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--text)" }}>{typeof power === "number" ? `${power.toFixed(1)} kW` : "—"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--text)" }}>{typeof soc === "number" ? `${soc.toFixed(1)}%` : "—"}</td>
                              <td style={{ padding: "12px 16px", color: "var(--sub)" }}>{d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ECONOMIC FORECAST TAB ── */}
      {tab === "econ" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
            padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
          }}>
            <button
              onClick={runOptimization}
              disabled={!selectedVppId || econLoading}
              style={{
                padding: "8px 18px", borderRadius: "8px", background: "#f59e0b", color: "#000",
                border: "none", cursor: selectedVppId && !econLoading ? "pointer" : "default",
                fontWeight: 700, fontSize: "13px", opacity: !selectedVppId || econLoading ? 0.6 : 1,
              }}
            >
              {econLoading ? "Running…" : "⚡ Run Optimization"}
            </button>
            {!selectedVppId && <span style={{ fontSize: "12px", color: "var(--sub)" }}>Select a VPP group above.</span>}
          </div>

          {!selectedVppId && !econError && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
              📈 Select a VPP group to run an economic optimization forecast.
            </div>
          )}

          {econError && (
            <div style={{ padding: "24px", background: "var(--surface)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "12px", color: "#f87171", textAlign: "center" }}>
              <div style={{ fontWeight: 700, marginBottom: "6px" }}>Optimization failed</div>
              <div style={{ fontSize: "13px", color: "var(--sub)" }}>{econError}</div>
            </div>
          )}

          {selectedVppId && !econError && econLoading && (
            <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center" }}>
              Running optimization…
            </div>
          )}

          {selectedVppId && !econError && !econLoading && optimize && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "14px" }}>
                <KPICard label="Optimization Status" value={optimize.status || "—"} unit="" color={optimize.status === "optimal" ? "#4ade80" : "#f59e0b"} icon="⚙️" />
                <KPICard label="Total Cost" value={optimize.status === "optimal" && typeof optimize.total_cost_eur === "number" ? optimize.total_cost_eur.toFixed(2) : null} unit="€" color="#f59e0b" icon="💰" />
                <KPICard label="Total Import" value={optimize.status === "optimal" && typeof optimize.total_import_kwh === "number" ? optimize.total_import_kwh.toFixed(1) : null} unit="kWh" color="#38bdf8" icon="⬇️" />
                <KPICard label="Total Export" value={optimize.status === "optimal" && typeof optimize.total_export_kwh === "number" ? optimize.total_export_kwh.toFixed(1) : null} unit="kWh" color="#4ade80" icon="⬆️" />
                <KPICard label="Price Source" value={optimize.price_source || "—"} unit="" color="#a78bfa" icon="📡" />
                <KPICard label="Solver Time" value={typeof optimize.solver_time_ms === "number" ? `${optimize.solver_time_ms} ms` : null} unit="" color="var(--sub)" icon="⏱️" />
                <KPICard label="Optimization Run ID" value={optimize.optimization_run_id !== undefined && optimize.optimization_run_id !== null ? optimize.optimization_run_id : null} unit="" color="var(--sub)" icon="🔢" />
              </div>

              {econChartData.length > 0 ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px", color: "var(--text)" }}>VPP Dispatch Forecast</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={econChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="hour" tick={{ fill: "var(--sub)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--sub)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)" }} formatter={v => [`${v} kW`, "Dispatch"]} />
                      <Area type="monotone" dataKey="dispatch" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} name="Dispatch (kW)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ padding: "40px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--sub)", textAlign: "center", fontSize: "13px" }}>
                  No dispatch schedule available for this result.
                </div>
              )}

              {econScheduleRows.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", padding: "16px 20px", color: "var(--text)", borderBottom: "1px solid var(--border)" }}>
                    Hourly Schedule
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ color: "var(--sub)" }}>
                          <th style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Hour</th>
                          <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Grid Import (kW)</th>
                          <th style={{ textAlign: "right", padding: "10px 16px", fontWeight: 600, fontSize: "11px", borderBottom: "1px solid var(--border)" }}>Grid Export (kW)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {econScheduleRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                            <td style={{ padding: "10px 16px", color: "var(--sub)" }}>{i}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{typeof row.grid_import_kw === "number" ? row.grid_import_kw.toFixed(2) : "—"}</td>
                            <td style={{ padding: "10px 16px", color: "var(--text)", textAlign: "right" }}>{typeof row.grid_export_kw === "number" ? row.grid_export_kw.toFixed(2) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}