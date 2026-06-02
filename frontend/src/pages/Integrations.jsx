import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "../i18n/useTranslation"

const API = import.meta.env.VITE_API_URL || ""

// ── Protocol metadata ─────────────────────────────────────────────────────────
const PROTOCOLS = [
  {
    id: "solaredge", label: "SolarEdge", category: "cloud",
    icon: "☀️", color: "#f59e0b",
    fields: [
      { key: "api_key", label: "API Key", type: "password", required: true, placeholder: "Your SolarEdge API key" },
      { key: "site_id", label: "Site ID", type: "text", required: true, placeholder: "e.g. 123456" },
    ],
    hint: "Found in SolarEdge monitoring portal → Admin → Site Access → API Access",
  },
  {
    id: "fronius", label: "Fronius", category: "local",
    icon: "🔆", color: "#3b82f6",
    fields: [
      { key: "host", label: "Inverter IP", type: "text", required: true, placeholder: "192.168.1.100" },
    ],
    hint: "Fronius Symo/Primo with Solar API v1. Must be on same LAN.",
  },
  {
    id: "huawei", label: "Huawei FusionSolar", category: "local",
    icon: "🌐", color: "#ef4444",
    fields: [
      { key: "host", label: "NetEco / FusionSolar IP", type: "text", required: true, placeholder: "192.168.1.10" },
      { key: "plant_id", label: "Plant DN", type: "text", required: true, placeholder: "NE=123" },
      { key: "token", label: "XSRF Token", type: "password", required: false, placeholder: "From login session" },
    ],
    hint: "FusionSolar local API. Token obtained from browser session after login.",
  },
  {
    id: "sma", label: "SMA Inverter", category: "local",
    icon: "⚡", color: "#8b5cf6",
    fields: [
      { key: "host", label: "Inverter IP", type: "text", required: true, placeholder: "192.168.1.101" },
      { key: "password", label: "User Password", type: "password", required: false, placeholder: "SMA user password" },
    ],
    hint: "SMA Sunny Boy / Tripower with Speedwire. LAN access required.",
  },
  {
    id: "modbus_tcp", label: "Modbus TCP", category: "fieldbus",
    icon: "🔌", color: "#10b981",
    fields: [
      { key: "host", label: "Device IP", type: "text", required: true, placeholder: "192.168.1.50" },
      { key: "port", label: "Port", type: "number", required: false, placeholder: "502" },
      { key: "unit_id", label: "Unit ID (Slave)", type: "number", required: false, placeholder: "1" },
    ],
    hint: "SunSpec-compatible inverter or smart meter over Ethernet/LAN.",
  },
  {
    id: "modbus_rtu", label: "Modbus RTU (RS-485)", category: "fieldbus",
    icon: "🔗", color: "#f97316",
    fields: [
      { key: "port", label: "Serial Port", type: "text", required: true, placeholder: "/dev/ttyUSB0 or COM3" },
      { key: "baudrate", label: "Baud Rate", type: "select", options: ["1200","2400","4800","9600","19200","38400","57600","115200"], required: false },
      { key: "unit_id", label: "Unit ID (Slave)", type: "number", required: false, placeholder: "1" },
      { key: "parity", label: "Parity", type: "select", options: ["N","E","O"], required: false },
    ],
    hint: "RS-485 serial bus. Requires USB-RS485 adapter on edge device.",
  },
  {
    id: "opcua", label: "OPC-UA (SCADA)", category: "scada",
    icon: "🏭", color: "#06b6d4",
    fields: [
      { key: "url", label: "OPC-UA Endpoint URL", type: "text", required: true, placeholder: "opc.tcp://scada.site:4840" },
      { key: "username", label: "Username", type: "text", required: false, placeholder: "optional" },
      { key: "password", label: "Password", type: "password", required: false, placeholder: "optional" },
      { key: "node_power", label: "Power Node ID", type: "text", required: false, placeholder: "ns=2;i=1001" },
      { key: "node_energy", label: "Energy Node ID", type: "text", required: false, placeholder: "ns=2;i=1002" },
      { key: "node_temp", label: "Temp Node ID", type: "text", required: false, placeholder: "ns=2;i=1003" },
      { key: "node_setpoint", label: "Setpoint Node ID", type: "text", required: false, placeholder: "ns=2;i=2001 (control)" },
    ],
    hint: "OPC-UA server on wind turbine controller or SCADA system.",
  },
]

const DEVICE_TYPES = ["inverter","bess","meter","wind","ev_charger","other"]
const CATEGORY_LABELS = { cloud: "Cloud APIs", local: "Local LAN", fieldbus: "Fieldbus (RS-485/TCP)", scada: "SCADA / Industrial" }

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    online:  { bg: "rgba(16,185,129,0.15)", color: "#10b981", dot: "#10b981", label: "Online" },
    offline: { bg: "rgba(239,68,68,0.12)",  color: "#ef4444", dot: "#ef4444", label: "Offline" },
    error:   { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", dot: "#f59e0b", label: "Error" },
    unknown: { bg: "rgba(148,163,184,0.1)", color: "#94a3b8", dot: "#94a3b8", label: "Unknown" },
  }
  const s = map[status] || map.unknown
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.color,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot,
        boxShadow: status === "online" ? `0 0 6px ${s.dot}` : "none",
        animation: status === "online" ? "pulse 2s infinite" : "none",
      }}/>
      {s.label}
    </span>
  )
}

// ── Protocol icon card ────────────────────────────────────────────────────────
function ProtocolCard({ proto, selected, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: "14px 10px", borderRadius: 10, cursor: "pointer",
      background: selected ? `${proto.color}22` : "var(--surface2)",
      border: `1.5px solid ${selected ? proto.color : "var(--border)"}`,
      color: selected ? proto.color : "var(--text)",
      transition: "all 0.15s", minWidth: 90,
    }}>
      <span style={{ fontSize: 22 }}>{proto.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: 1.3 }}>{proto.label}</span>
    </button>
  )
}

// ── Add Device Modal ──────────────────────────────────────────────────────────
function AddDeviceModal({ onClose, onSaved }) {
  const [step, setStep] = useState(1)          // 1=choose protocol, 2=fill config
  const [selectedProto, setSelectedProto] = useState(null)
  const [form, setForm] = useState({ name: "", device_type: "inverter", site_id: "" })
  const [config, setConfig] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const proto = PROTOCOLS.find(p => p.id === selectedProto)

  async function handleSave() {
    if (!form.name.trim()) { setError("Device name required"); return }
    setSaving(true); setError("")
    try {
      const body = {
        name: form.name,
        protocol: selectedProto,
        device_type: form.device_type,
        site_id: form.site_id ? parseInt(form.site_id) : null,
        config,
      }
      const r = await fetch(`${API}/api/devices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(await r.text())
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const grouped = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    cat, label, protos: PROTOCOLS.filter(p => p.category === cat)
  }))

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 640,
        maxHeight: "90vh", overflow: "auto", border: "1px solid var(--border)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
      }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: "var(--text)" }}>Add Device</div>
            <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 2 }}>
              Step {step} of 2 — {step === 1 ? "Choose protocol" : `Configure ${proto?.label}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {step === 1 && (
            <>
              {grouped.map(g => (
                <div key={g.cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                    {g.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {g.protos.map(p => (
                      <ProtocolCard key={p.id} proto={p} selected={selectedProto === p.id}
                        onClick={() => setSelectedProto(p.id)} />
                    ))}
                  </div>
                </div>
              ))}
              <button
                disabled={!selectedProto}
                onClick={() => setStep(2)}
                style={{
                  marginTop: 8, width: "100%", padding: "12px 0", borderRadius: 10,
                  background: selectedProto ? "var(--accent, #f59e0b)" : "var(--surface2)",
                  color: selectedProto ? "#000" : "var(--sub)", fontWeight: 700, fontSize: 14,
                  border: "none", cursor: selectedProto ? "pointer" : "default",
                }}>
                Continue →
              </button>
            </>
          )}

          {step === 2 && proto && (
            <>
              {/* Device hint */}
              <div style={{
                background: `${proto.color}18`, border: `1px solid ${proto.color}44`,
                borderRadius: 8, padding: "10px 14px", marginBottom: 20,
                fontSize: 12, color: proto.color,
              }}>
                <strong>{proto.icon} {proto.label}</strong><br/>
                <span style={{ opacity: 0.85 }}>{proto.hint}</span>
              </div>

              {/* Base fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Device Name *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    placeholder="e.g. Roof Inverter 1"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}/>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>Device Type</label>
                  <select value={form.device_type} onChange={e => setForm({...form, device_type: e.target.value})}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13 }}>
                    {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Protocol-specific fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {proto.fields.map(f => (
                  <div key={f.key} style={{ gridColumn: f.type === "text" && f.key === "url" ? "1 / -1" : undefined }}>
                    <label style={{ fontSize: 12, color: "var(--sub)", display: "block", marginBottom: 4 }}>
                      {f.label}{f.required ? " *" : ""}
                    </label>
                    {f.type === "select" ? (
                      <select value={config[f.key] || f.options[0]}
                        onChange={e => setConfig({...config, [f.key]: e.target.value})}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13 }}>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type || "text"}
                        placeholder={f.placeholder}
                        value={config[f.key] || ""}
                        onChange={e => setConfig({...config, [f.key]: e.target.value})}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {error && <div style={{ marginTop: 14, color: "#ef4444", fontSize: 12 }}>{error}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "var(--surface2)", color: "var(--sub)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600 }}>
                  ← Back
                </button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px 0", borderRadius: 10, background: "#f59e0b", color: "#000", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
                  {saving ? "Saving…" : "Save Device"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Test Connection Modal ─────────────────────────────────────────────────────
function TestModal({ device, onClose }) {
  const [state, setState] = useState("idle") // idle | testing | success | error
  const [result, setResult] = useState(null)

  useEffect(() => {
    runTest()
  }, [])

  async function runTest() {
    setState("testing")
    try {
      const r = await fetch(`${API}/api/devices/${device.id}/test`, { method: "POST" })
      const data = await r.json()
      setResult(data)
      setState(data.ok ? "success" : "error")
    } catch (e) {
      setResult({ ok: false, message: e.message })
      setState("error")
    }
  }

  const proto = PROTOCOLS.find(p => p.id === device.protocol)

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 440,
        border: "1px solid var(--border)", boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
        padding: 28, textAlign: "center",
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{proto?.icon || "🔌"}</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>{device.name}</div>
        <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 2, marginBottom: 24 }}>{proto?.label} — Connection Test</div>

        {state === "testing" && (
          <div style={{ color: "var(--sub)", fontSize: 14 }}>
            <div style={{ width: 40, height: 40, border: "3px solid var(--border)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }}/>
            Testing connection…
          </div>
        )}

        {state === "success" && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
            <div style={{ color: "#10b981", fontWeight: 700, fontSize: 15 }}>Connected successfully</div>
            {result?.message && <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 6 }}>{result.message}</div>}
            {result?.data && (
              <pre style={{ marginTop: 14, background: "var(--surface2)", borderRadius: 8, padding: 12, fontSize: 11, color: "var(--sub)", textAlign: "left", overflow: "auto", maxHeight: 120 }}>
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {state === "error" && (
          <div>
            <div style={{ fontSize: 48, marginBottom: 10 }}>❌</div>
            <div style={{ color: "#ef4444", fontWeight: 700, fontSize: 15 }}>Connection failed</div>
            {result?.message && <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 6 }}>{result.message}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {state !== "testing" && (
            <button onClick={runTest} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600 }}>
              Retry
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#f59e0b", color: "#000", border: "none", cursor: "pointer", fontWeight: 700 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Readings Panel ─────────────────────────────────────────────────────────────
function ReadingsPanel({ device, onClose }) {
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/devices/${device.id}/readings?limit=20`)
      .then(r => r.json()).then(setReadings).finally(() => setLoading(false))
  }, [device.id])

  const proto = PROTOCOLS.find(p => p.id === device.protocol)

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", borderRadius: 16, width: "100%", maxWidth: 680,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        border: "1px solid var(--border)", boxShadow: "0 25px 80px rgba(0,0,0,0.6)",
      }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, color: "var(--text)" }}>{proto?.icon} {device.name} — Last Readings</div>
            <div style={{ color: "var(--sub)", fontSize: 12 }}>{device.protocol.toUpperCase()}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: 20 }}>✕</button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {loading && <div style={{ color: "var(--sub)", textAlign: "center", padding: 40 }}>Loading…</div>}
          {!loading && readings.length === 0 && (
            <div style={{ color: "var(--sub)", textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📡</div>
              No readings yet. Start the gateway and readings will appear here.
            </div>
          )}
          {!loading && readings.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--sub)" }}>
                  {["Timestamp","Power (kW)","Energy (kWh)","SoC %","Temp °C","Voltage V","Freq Hz"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--sub)" }}>{new Date(r.timestamp).toLocaleString()}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)", fontWeight: 600 }}>{r.power_kw?.toFixed(2) ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)" }}>{r.energy_kwh?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)" }}>{r.soc_pct?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)" }}>{r.temp_c?.toFixed(1) ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)" }}>{r.voltage_v?.toFixed(0) ?? "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text)" }}>{r.frequency_hz?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Integrations() {
  const { t } = useTranslation()
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [testDevice, setTestDevice] = useState(null)
  const [readingsDevice, setReadingsDevice] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [filter, setFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/devices`)
      setDevices(await r.json())
    } catch {
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleEnabled(dev) {
    await fetch(`${API}/api/devices/${dev.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !dev.enabled }),
    })
    load()
  }

  async function deleteDevice(id) {
    await fetch(`${API}/api/devices/${id}`, { method: "DELETE" })
    setDeleteConfirm(null)
    load()
  }

  const filtered = filter === "all" ? devices : devices.filter(d => d.protocol === filter || d.device_type === filter || d.status === filter)
  const counts = { online: devices.filter(d => d.status === "online").length, offline: devices.filter(d => d.status === "offline").length, total: devices.length }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Device Integrations</h1>
        <p style={{ color: "var(--sub)", fontSize: 13, margin: "4px 0 0" }}>
          Connect inverters, BESS, smart meters and SCADA systems to VoltarisOS
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total Devices", value: counts.total, color: "var(--text)" },
          { label: "Online", value: counts.online, color: "#10b981" },
          { label: "Offline / Error", value: counts.offline + devices.filter(d => d.status === "error").length, color: "#ef4444" },
          { label: "Protocols", value: [...new Set(devices.map(d => d.protocol))].length, color: "#f59e0b" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 20px", minWidth: 120 }}>
            <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4, fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Protocol coverage */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
          Supported Protocols
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PROTOCOLS.map(p => (
            <div key={p.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: `${p.color}15`, border: `1px solid ${p.color}40`,
              color: p.color, fontSize: 12, fontWeight: 600,
            }}>
              <span>{p.icon}</span> {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["all","online","offline","error"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: filter === f ? "var(--accent, #f59e0b)" : "var(--surface2)",
              color: filter === f ? "#000" : "var(--sub)",
              border: `1px solid ${filter === f ? "transparent" : "var(--border)"}`,
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface2)", color: "var(--sub)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12 }}>
            ↺ Refresh
          </button>
          <button onClick={() => setShowAdd(true)} style={{
            padding: "8px 18px", borderRadius: 8, background: "#f59e0b", color: "#000",
            border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
          }}>
            + Add Device
          </button>
        </div>
      </div>

      {/* Device table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "var(--sub)" }}>Loading devices…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔌</div>
            <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 15 }}>No devices yet</div>
            <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 6, marginBottom: 20 }}>
              Add your first inverter, BESS, or SCADA system to start monitoring
            </div>
            <button onClick={() => setShowAdd(true)} style={{ padding: "10px 24px", borderRadius: 10, background: "#f59e0b", color: "#000", border: "none", cursor: "pointer", fontWeight: 700 }}>
              + Add First Device
            </button>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Device","Protocol","Type","Status","Last Seen","Enabled","Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((dev, i) => {
                const proto = PROTOCOLS.find(p => p.id === dev.protocol)
                return (
                  <tr key={dev.id} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 13 }}>{dev.name}</div>
                      <div style={{ color: "var(--sub)", fontSize: 11 }}>ID #{dev.id}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                        background: `${proto?.color || "#888"}18`, color: proto?.color || "#888",
                        border: `1px solid ${proto?.color || "#888"}33`,
                      }}>
                        {proto?.icon} {proto?.label || dev.protocol}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--sub)", fontSize: 12 }}>{dev.device_type}</td>
                    <td style={{ padding: "14px 16px" }}><StatusBadge status={dev.status} /></td>
                    <td style={{ padding: "14px 16px", color: "var(--sub)", fontSize: 11 }}>
                      {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : "Never"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button onClick={() => toggleEnabled(dev)} style={{
                        width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
                        background: dev.enabled ? "#10b981" : "var(--surface2)",
                        transition: "background 0.2s", position: "relative",
                      }}>
                        <span style={{
                          position: "absolute", top: 2, width: 18, height: 18, borderRadius: "50%",
                          background: "#fff", transition: "left 0.2s",
                          left: dev.enabled ? 18 : 2,
                        }}/>
                      </button>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setTestDevice(dev)} title="Test connection" style={{ padding: "6px 10px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                          ⚡ Test
                        </button>
                        <button onClick={() => setReadingsDevice(dev)} title="View readings" style={{ padding: "6px 10px", borderRadius: 6, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer", fontSize: 12 }}>
                          📊
                        </button>
                        <button onClick={() => setDeleteConfirm(dev)} title="Delete" style={{ padding: "6px 10px", borderRadius: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Gateway instructions */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 22, marginTop: 22 }}>
        <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>🖥️ Edge Gateway Setup</div>
        <div style={{ color: "var(--sub)", fontSize: 13, marginBottom: 14 }}>
          For Modbus and OPC-UA devices, the gateway must run on a machine with physical access to the device network (local LAN or serial port).
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 8 }}>INSTALL</div>
            <pre style={{ fontSize: 11, color: "var(--text)", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
{`pip install pymodbus asyncua httpx
python -m gateway.gateway \\
  --api https://your-backend.up.railway.app \\
  --interval 30`}
            </pre>
          </div>
          <div style={{ background: "var(--surface2)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", marginBottom: 8 }}>DOCKER (RASPBERRY PI)</div>
            <pre style={{ fontSize: 11, color: "var(--text)", margin: 0, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
{`docker run voltarisos/gateway \\
  -e VOLTARIS_API_URL=https://... \\
  -e GATEWAY_INTERVAL=30 \\
  --device /dev/ttyUSB0`}
            </pre>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAdd && <AddDeviceModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {testDevice && <TestModal device={testDevice} onClose={() => { setTestDevice(null); load() }} />}
      {readingsDevice && <ReadingsPanel device={readingsDevice} onClose={() => setReadingsDevice(null)} />}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 14, padding: 28, maxWidth: 360, width: "100%", border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Delete "{deleteConfirm.name}"?</div>
            <div style={{ color: "var(--sub)", fontSize: 13, marginBottom: 22 }}>This will remove the device and all its readings permanently.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => deleteDevice(deleteConfirm.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
