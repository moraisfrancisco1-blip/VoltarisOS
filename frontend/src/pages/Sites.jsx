import { useState } from "react";

const accent = "#6366f1"; const green = "#10b981"; const amber = "#f59e0b";
const red = "#ef4444"; const blue = "#60a5fa"; const purple = "#a78bfa";

const card = { background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 20 };
const label = { fontSize: 11, color: "rgba(148,163,184,0.85)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 };

const INITIAL_SITES = [
  { id: 1, name: "Herdade Solar Norte", lat: 38.72, lng: -8.89, solarKwp: 4200, bessKwh: 8400, bessKw: 2100, inverter: "SMA Sunny Tripower", chemistry: "LFP", status: "online", installed: "2022-03-15", country: "PT" },
  { id: 2, name: "Parque BESS Sul", lat: 37.80, lng: -8.60, solarKwp: 2800, bessKwh: 5600, bessKw: 3400, inverter: "Fronius Symo", chemistry: "NMC", status: "online", installed: "2023-01-20", country: "PT" },
  { id: 3, name: "Complexo Híbrido Évora", lat: 38.57, lng: -7.91, solarKwp: 6100, bessKwh: 12200, bessKw: 4000, inverter: "Huawei SUN2000", chemistry: "LFP", status: "warning", installed: "2023-08-10", country: "PT" },
  { id: 4, name: "Mini-Grid Alentejo", lat: 38.30, lng: -8.10, solarKwp: 1500, bessKwh: 1800, bessKw: 900, inverter: "SolarEdge SE10K", chemistry: "LFP", status: "online", installed: "2024-02-01", country: "PT" },
  { id: 5, name: "Parque Fotovoltaico Algarve", lat: 37.22, lng: -8.45, solarKwp: 5000, bessKwh: 7500, bessKw: 2600, inverter: "ABB PVS-175", chemistry: "VRLA", status: "offline", installed: "2021-11-05", country: "PT" },
];

const BLANK = {
  name: "", lat: "", lng: "", solarKwp: "", bessKwh: "", bessKw: "",
  inverter: "", chemistry: "LFP", status: "online", installed: "", country: "PT",
};

const CHEMISTRIES = ["LFP", "NMC", "NCA", "VRLA", "Flow", "Sodium-Ion"];
const INVERTERS = ["SMA Sunny Tripower", "Fronius Symo", "Huawei SUN2000", "SolarEdge SE10K", "ABB PVS-175", "Sungrow SG125HX", "Other"];
const STATUSES = ["online", "offline", "warning", "maintenance", "commissioning"];
const COUNTRIES = ["PT", "ES", "DE", "FR", "NL", "IT", "UK", "Other"];

const statusColor = (s) => s === "online" ? green : s === "warning" ? amber : s === "maintenance" ? blue : s === "commissioning" ? purple : red;
const statusBg = (s) => `${statusColor(s)}20`;

function InputField({ label: lb, value, onChange, type = "text", options, unit, readOnly = false }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "rgba(148,163,184,0.85)", marginBottom: 4 }}>{lb}{unit && <span style={{ color: "rgba(148,163,184,0.85)", marginLeft: 4 }}>({unit})</span>}</div>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)} disabled={readOnly}
          style={{ width: "100%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "#f1f5f9", fontSize: 13 }}>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
          style={{ width: "100%", background: readOnly ? "rgba(10,12,24,0.98)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 10px", color: "#f1f5f9", fontSize: 13, boxSizing: "border-box" }} />
      )}
    </div>
  );
}

export default function Sites() {
  const [sites, setSites] = useState(INITIAL_SITES);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...BLANK });
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);

  const filtered = sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setForm({ ...BLANK }); setEditId(null); setShowForm(true); };
  const openEdit = (site) => { setForm({ ...site }); setEditId(site.id); setShowForm(true); };

  const saveForm = () => {
    if (!form.name || !form.solarKwp) return;
    if (editId) {
      setSites(s => s.map(site => site.id === editId ? { ...form, id: editId } : site));
    } else {
      setSites(s => [...s, { ...form, id: Date.now() }]);
    }
    setShowForm(false);
  };

  const confirmDelete = () => {
    setSites(s => s.filter(site => site.id !== deleteId));
    setDeleteId(null);
  };

  const f = (k) => v => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f1f5f9" }}>Sites</h1>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: 13, marginTop: 2 }}>Manage solar + BESS park configurations</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 13, width: 200 }} />
          <button onClick={openCreate}
            style={{ padding: "8px 18px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            + Add Site
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Sites", value: sites.length, color: "#f1f5f9" },
          { label: "Total Solar", value: `${(sites.reduce((a, s) => a + Number(s.solarKwp), 0) / 1000).toFixed(1)} MWp`, color: amber },
          { label: "Total BESS", value: `${(sites.reduce((a, s) => a + Number(s.bessKwh), 0) / 1000).toFixed(1)} MWh`, color: purple },
          { label: "Online", value: `${sites.filter(s => s.status === "online").length} / ${sites.length}`, color: green },
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              {["Name", "Country", "Solar (kWp)", "BESS (kWh)", "BESS Power (kW)", "Inverter", "Chemistry", "Status", "Installed", ""].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "4px 10px", fontSize: 10, color: "rgba(148,163,184,0.85)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                <td style={{ padding: "10px 10px", fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{s.name}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: "rgba(148,163,184,0.85)" }}>{s.country}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: amber }}>{Number(s.solarKwp).toLocaleString()}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: purple }}>{Number(s.bessKwh).toLocaleString()}</td>
                <td style={{ padding: "10px 10px", fontSize: 12, color: blue }}>{Number(s.bessKw).toLocaleString()}</td>
                <td style={{ padding: "10px 10px", fontSize: 11, color: "#f1f5f9" }}>{s.inverter}</td>
                <td style={{ padding: "10px 10px" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}>{s.chemistry}</span>
                </td>
                <td style={{ padding: "10px 10px" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: statusBg(s.status), color: statusColor(s.status) }}>{s.status}</span>
                </td>
                <td style={{ padding: "10px 10px", fontSize: 11, color: "rgba(148,163,184,0.85)" }}>{s.installed}</td>
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(s)}
                      style={{ padding: "4px 10px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "rgba(148,163,184,0.85)", fontSize: 11, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => setDeleteId(s.id)}
                      style={{ padding: "4px 10px", background: "#ef444415", border: "1px solid #ef4444", borderRadius: 6, color: red, fontSize: 11, cursor: "pointer" }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: 28, width: 680, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
              {editId ? "Edit Site" : "Add New Site"}
            </h2>

            {/* Basic */}
            <div style={{ fontSize: 11, color: accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Basic Info</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <InputField label="Site Name" value={form.name} onChange={f("name")} />
              <InputField label="Country" value={form.country} onChange={f("country")} options={COUNTRIES} />
              <InputField label="Latitude" value={form.lat} onChange={f("lat")} type="number" />
              <InputField label="Longitude" value={form.lng} onChange={f("lng")} type="number" />
              <InputField label="Installation Date" value={form.installed} onChange={f("installed")} type="date" />
              <InputField label="Status" value={form.status} onChange={f("status")} options={STATUSES} />
            </div>

            {/* Solar */}
            <div style={{ fontSize: 11, color: amber, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Solar Configuration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <InputField label="Solar Capacity" value={form.solarKwp} onChange={f("solarKwp")} type="number" unit="kWp" />
              <InputField label="Inverter" value={form.inverter} onChange={f("inverter")} options={INVERTERS} />
            </div>

            {/* BESS */}
            <div style={{ fontSize: 11, color: purple, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>BESS Configuration</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
              <InputField label="BESS Energy" value={form.bessKwh} onChange={f("bessKwh")} type="number" unit="kWh" />
              <InputField label="BESS Power" value={form.bessKw} onChange={f("bessKw")} type="number" unit="kW" />
              <InputField label="Battery Chemistry" value={form.chemistry} onChange={f("chemistry")} options={CHEMISTRIES} />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)}
                style={{ padding: "8px 20px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(148,163,184,0.85)", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={saveForm}
                style={{ padding: "8px 20px", background: accent, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {editId ? "Save Changes" : "Create Site"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 28, width: 360 }}>
            <h3 style={{ margin: "0 0 10px", color: "#f1f5f9" }}>Delete Site</h3>
            <p style={{ color: "rgba(148,163,184,0.85)", fontSize: 13 }}>Are you sure you want to delete <b>{sites.find(s => s.id === deleteId)?.name}</b>? This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ padding: "7px 16px", background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "rgba(148,163,184,0.85)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmDelete}
                style={{ padding: "7px 16px", background: red, border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
