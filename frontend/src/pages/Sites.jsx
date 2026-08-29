import { useState, useEffect } from "react";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const API = import.meta.env.VITE_API_URL || "";

const card = { background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const BLANK = {
  name: "", location: "", lat: "", lng: "",
  solar_kw: "", battery_kwh: "", ev_chargers: 0, owner: "", status: "active",
};

const STATUSES = ["active", "online", "offline", "warning", "maintenance", "commissioning"];

const statusColor = (s) => (s === "online" || s === "active") ? green : s === "warning" ? amber : s === "maintenance" ? blue : s === "commissioning" ? purple : red;
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

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState(null);

  const loadSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sites`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSites(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Não foi possível carregar os sites.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSites(); }, []);

  const filtered = sites.filter(s => (s.name || "").toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setForm({ ...BLANK }); setShowForm(true); setFormError(null); };

  const saveForm = async () => {
    if (!form.name) { setFormError("O nome é obrigatório."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        location: form.location || null,
        lat: form.lat !== "" ? Number(form.lat) : null,
        lng: form.lng !== "" ? Number(form.lng) : null,
        solar_kw: form.solar_kw !== "" ? Number(form.solar_kw) : 0,
        battery_kwh: form.battery_kwh !== "" ? Number(form.battery_kwh) : 0,
        ev_chargers: form.ev_chargers !== "" ? Number(form.ev_chargers) : 0,
        owner: form.owner || null,
        status: form.status || "active",
      };
      const res = await fetch(`${API}/api/sites`, {
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
      await loadSites();
    } catch (e) {
      setFormError(e.message || "Erro ao criar o site.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sites/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteId(null);
      await loadSites();
    } catch (e) {
      setError("Não foi possível apagar o site.");
    } finally {
      setDeleting(false);
    }
  };

  const f = (k) => v => setForm(prev => ({ ...prev, [k]: v }));

  const totalSolarKw = sites.reduce((a, s) => a + (Number(s.solar_kw) || 0), 0);
  const totalBessKwh = sites.reduce((a, s) => a + (Number(s.battery_kwh) || 0), 0);
  const onlineCount = sites.filter(s => s.status === "online" || s.status === "active").length;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--text)" }}>Sites</h1>
          <div style={{ color: "var(--sub)", fontSize: 13, marginTop: 2 }}>Manage solar + BESS park configurations</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
            style={{ background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "var(--text)", fontSize: 13, width: 200 }} />
          <button onClick={openCreate}
            style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add Site
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: 12, borderRadius: 10, background: "#ef444418", border: "1px solid #ef4444", color: red, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Sites", value: sites.length, color: "var(--text)" },
          { label: "Total Solar", value: `${(totalSolarKw / 1000).toFixed(1)} MWp`, color: amber },
          { label: "Total BESS", value: `${(totalBessKwh / 1000).toFixed(1)} MWh`, color: purple },
          { label: "Online", value: `${onlineCount} / ${sites.length}`, color: green },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={label}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sites list */}
      <div style={card}>
        <div style={{ ...label, marginBottom: 14 }}>All Sites ({filtered.length})</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Carregando sites…</div>
        ) : error && sites.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>Não foi possível carregar os sites.</div>
        ) : sites.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--sub)", fontSize: 13 }}>
            Ainda não tens sites. Clica em "+ Add Site" para criar o primeiro.
          </div>
        ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Name", "Location", "Lat", "Lng", "Solar (kW)", "BESS (kWh)", "EV", "Owner", "Status", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "4px 10px", fontSize: 10, color: "var(--sub)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{s.name}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: "var(--sub)" }}>{s.location || "—"}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: "var(--sub)" }}>{s.lat != null ? s.lat : "—"}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: "var(--sub)" }}>{s.lng != null ? s.lng : "—"}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: amber }}>{Number(s.solar_kw || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: purple }}>{Number(s.battery_kwh || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: blue }}>{s.ev_chargers ?? 0}</td>
                <td style={{ padding: "10px 10px", fontSize: 11, color: "var(--text)" }}>{s.owner || "—"}</td>
                <td style={{ padding: "10px 10px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: statusBg(s.status), color: statusColor(s.status) }}>{s.status}</span>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <button onClick={() => setDeleteId(s.id)}
                    style={{ padding: "4px 10px", background: "#ef444415", border: "1px solid #ef4444", borderRadius: 6, color: red, fontSize: 11, cursor: "pointer" }}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
              Add New Site
            </h2>

            {/* Basic */}
            <div style={{ fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Basic Info</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <InputField label="Site Name" value={form.name} onChange={f("name")} />
              <InputField label="Location" value={form.location} onChange={f("location")} />
              <InputField label="Owner" value={form.owner} onChange={f("owner")} />
              <InputField label="Status" value={form.status} onChange={f("status")} options={STATUSES} />
              <InputField label="Latitude" value={form.lat} onChange={f("lat")} type="number" />
              <InputField label="Longitude" value={form.lng} onChange={f("lng")} type="number" />
            </div>

            {/* Solar & BESS */}
            <div style={{ fontSize: 11, color: amber, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Solar & BESS Configuration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
              <InputField label="Solar Capacity" value={form.solar_kw} onChange={f("solar_kw")} type="number" unit="kW" />
              <InputField label="BESS Energy" value={form.battery_kwh} onChange={f("battery_kwh")} type="number" unit="kWh" />
              <InputField label="EV Chargers" value={form.ev_chargers} onChange={f("ev_chargers")} type="number" />
            </div>

            {formError && (
              <div style={{ padding: 10, borderRadius: 8, background: "#ef444418", border: "1px solid #ef4444", color: red, fontSize: 12, marginBottom: 12 }}>
                {formError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: "8px 20px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "var(--sub)", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveForm} disabled={saving}
                style={{ padding: "8px 20px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "A criar…" : "Create Site"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 28, width: 360 }}>
            <h3 style={{ margin: "0 0 10px", color: "var(--text)" }}>Delete Site</h3>
            <p style={{ color: "var(--sub)", fontSize: 13 }}>Are you sure you want to delete <b>{sites.find(s => s.id === deleteId)?.name}</b>? This action cannot be undone.</p>
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
