import { useState, useEffect } from "react";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const API = import.meta.env.VITE_API_URL || "";

const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const DEVICE_TYPES = ["inverter", "battery", "ev_charger", "solar", "meter", "heat_pump", "flexible_load", "industrial_load", "other"];
const PROTOCOLS = ["solaredge", "fronius", "huawei", "sma", "modbus_tcp", "modbus_rtu", "opcua", "simulated"];

const BLANK = { name: "", device_type: "inverter", protocol: "simulated", site_id: "", enabled: true };

const statusColor = (s) => s === "online" ? green : s === "warning" ? amber : s === "error" ? red : "rgba(148,163,184,0.85)";
const statusBg = (s) => `${statusColor(s)}20`;

function InputField({ label: lb, value, onChange, type = "text", options, unit, readOnly = false }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{lb}{unit && <span style={{ color: "var(--sub)", marginLeft: 4 }}>({unit})</span>}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
          style={{ width: "100%", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13 }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
          style={{ width: "100%", background: readOnly ? "var(--surface)" : "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
      )}
    </div>
  );
}

export default function FleetManagement({ setPage }) {
  const [devices, setDevices] = useState([]);
  const [readings, setReadings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/devices`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setDevices(list);
      // Latest telemetry per device (real DeviceReading).
      const entries = await Promise.all(list.map(async (d) => {
        try {
          const r = await fetch(`${API}/api/devices/${d.id}/readings?limit=1`);
          if (!r.ok) return [d.id, null];
          const rows = await r.json();
          return [d.id, Array.isArray(rows) && rows.length ? rows[0] : null];
        } catch (e) { return [d.id, null]; }
      }));
      setReadings(Object.fromEntries(entries));
    } catch (e) {
      setError("Não foi possível carregar os dispositivos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDevices(); }, []);

  const filtered = devices
    .filter(d => filter === "all" || d.status === filter)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const totalDevices = devices.length;
  const enabledCount = devices.filter(d => d.enabled).length;
  const onlineCount = devices.filter(d => d.status === "online").length;
  const withTelemetry = Object.values(readings).filter(r => r && r.power_kw != null).length;

  const openCreate = () => { setForm({ ...BLANK }); setShowForm(true); setFormError(null); };

  const saveForm = async () => {
    if (!form.name) { setFormError("O nome é obrigatório."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        protocol: form.protocol,
        device_type: form.device_type,
        enabled: form.enabled,
        ...(form.site_id !== "" ? { site_id: Number(form.site_id) } : {}),
      };
      const res = await fetch(`${API}/api/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).detail || ""; } catch (e) { /* ignore */ }
        throw new Error(detail || `HTTP ${res.status}`);
      }
      setShowForm(false);
      await loadDevices();
    } catch (e) {
      setFormError(e.message || "Erro ao criar o dispositivo.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/devices/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteId(null);
      await loadDevices();
    } catch (e) {
      setError("Não foi possível apagar o dispositivo.");
    } finally {
      setDeleting(false);
    }
  };

  const f = (k) => v => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Fleet Management</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Connected devices and live telemetry</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {["all", "online", "offline", "error"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
              background: filter === f ? accent : "var(--surface2)",
              color: filter === f ? "#fff" : "rgba(148,163,184,0.85)",
              border: `1px solid ${filter === f ? accent : "var(--surface2)"}`,
            }}>{f === "all" ? "All Devices" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
          <button onClick={openCreate}
            style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add Device
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* KPIs (derived from real data) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Devices", value: totalDevices, color: "var(--text)" },
          { label: "Enabled", value: enabledCount, color: green },
          { label: "Online", value: onlineCount, color: green },
          { label: "With Telemetry", value: withTelemetry, color: purple },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Device cards grid */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={label}>Device Details ({filtered.length})</div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando dispositivos…</div>
        ) : error && devices.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Não foi possível carregar os dispositivos.</div>
        ) : devices.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
            Ainda não tens dispositivos. Clica em "+ Add Device" para criar o primeiro.
          </div>
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {filtered.map(device => {
            const rd = readings[device.id];
            const soc = rd && rd.soc_pct != null ? rd.soc_pct : null;
            return (
              <div key={device.id} style={{ ...card, position: "relative" }}>
                {/* Status */}
                <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, background: statusBg(device.status), color: statusColor(device.status), padding: "2px 7px", borderRadius: 10 }}>{device.status}</span>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(device.status) }} />
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2, paddingRight: 70 }}>{device.name}</div>
                <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 12 }}>
                  {device.device_type} · {device.protocol} · {device.last_seen ? new Date(device.last_seen).toLocaleString() : "no signal"}
                </div>

                {/* SoC bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: "var(--sub)" }}>SoC</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: soc == null ? "var(--sub)" : soc > 70 ? green : soc > 40 ? amber : red }}>{soc == null ? "—" : `${soc}%`}</span>
                  </div>
                  <div style={{ height: 5, background: "var(--surface2)", borderRadius: 3 }}>
                    {soc != null && <div style={{ width: `${Math.max(0, Math.min(100, soc))}%`, height: "100%", borderRadius: 3, transition: "width 0.4s", background: soc > 70 ? green : soc > 40 ? amber : red }} />}
                  </div>
                </div>

                {/* Metrics grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { l: "Power", v: rd && rd.power_kw != null ? `${rd.power_kw} kW` : "—", c: amber },
                    { l: "Temp", v: rd && rd.temp_c != null ? `${rd.temp_c}°C` : "—", c: rd && rd.temp_c != null && rd.temp_c > 40 ? red : "var(--text)" },
                    { l: "Energy", v: rd && rd.energy_kwh != null ? `${rd.energy_kwh} kWh` : "—", c: purple },
                    { l: "Enabled", v: device.enabled ? "Yes" : "No", c: device.enabled ? green : red },
                    { l: "Site", v: device.site_id != null ? device.site_id : "—", c: "rgba(148,163,184,0.85)" },
                    { l: "Actions", v: "", c: "var(--text)" },
                  ].map(m => (
                    <div key={m.l} style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 9, color: "var(--sub)", marginBottom: 2 }}>{m.l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: m.c }}>{m.v}</div>
                      {m.l === "Actions" && (
                        <button onClick={() => setDeleteId(device.id)}
                          style={{ marginTop: 6, padding: "3px 10px", background: "#ef444415", border: "1px solid #ef4444", borderRadius: 6, color: red, fontSize: 11, cursor: "pointer" }}>Delete</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Summary table */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 12 }}>Fleet Summary Table</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Device", "Type", "Protocol", "Status", "Enabled", "Power kW", "SoC %", "Temp °C", "Last Seen", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "5px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(device => {
              const rd = readings[device.id];
              return (
                <tr key={device.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{device.name}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{device.device_type}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{device.protocol}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: statusBg(device.status), color: statusColor(device.status) }}>{device.status}</span>
                  </td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: device.enabled ? green : red }}>{device.enabled ? "Yes" : "No"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: amber }}>{rd && rd.power_kw != null ? rd.power_kw : "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: rd && rd.soc_pct != null ? (rd.soc_pct > 70 ? green : rd.soc_pct > 40 ? amber : red) : "var(--sub)" }}>{rd && rd.soc_pct != null ? rd.soc_pct : "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: rd && rd.temp_c != null && rd.temp_c > 40 ? red : "var(--text)" }}>{rd && rd.temp_c != null ? rd.temp_c : "—"}</td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: "var(--sub)" }}>{device.last_seen ? new Date(device.last_seen).toLocaleString() : "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <button onClick={() => setDeleteId(device.id)}
                      style={{ padding: "3px 10px", background: "#ef444415", border: "1px solid #ef4444", borderRadius: 6, color: red, fontSize: 11, cursor: "pointer" }}>Del</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create device form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Add New Device</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <InputField label="Device Name" value={form.name} onChange={f("name")} />
              <InputField label="Protocol" value={form.protocol} onChange={f("protocol")} options={PROTOCOLS} />
              <InputField label="Device Type" value={form.device_type} onChange={f("device_type")} options={DEVICE_TYPES} />
              <InputField label="Site ID" value={form.site_id} onChange={f("site_id")} type="number" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input type="checkbox" checked={form.enabled} onChange={e => f("enabled")(e.target.checked)}
                style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: "var(--text)" }}>Enabled</span>
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#ef444418", border: "1px solid #ef4444", color: red, fontSize: 12, marginBottom: 12 }}>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: "8px 20px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--sub)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveForm} disabled={saving}
                style={{ padding: "8px 20px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "A criar…" : "Create Device"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 28, width: 380 }}>
            <h3 style={{ margin: "0 0 10px", color: "var(--text)" }}>Delete Device</h3>
            <p style={{ color: "var(--sub)", fontSize: 13 }}>Are you sure you want to delete <b>{devices.find(d => d.id === deleteId)?.name}</b>? This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ padding: "7px 16px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--sub)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                style={{ padding: "7px 16px", background: red, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>{deleting ? "A apagar…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

