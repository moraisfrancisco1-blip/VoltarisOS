import { useState, useEffect } from "react"
import { useTranslation } from "../i18n/useTranslation"
import { useAppStore } from "../store/appStore"
import axios from "axios"

export default function Sites({ user }) {
  const { t } = useTranslation()
  const accentColor = useAppStore(s => s.accentColor)
  const color = user?.color || accentColor || "#4ade80"

  const [sites, setSites] = useState([])
  const [form, setForm] = useState({
    name: "", location: "", lat: "", lng: "",
    solar_kw: "", battery_kwh: "", ev_chargers: "",
    owner: "Francisco Morais", status: "active"
  })

  const loadSites = () => {
    axios.get("/api/sites").then(res => setSites(res.data)).catch(() => {})
  }

  useEffect(() => { loadSites() }, [])

  const handleSubmit = () => {
    axios.post("/api/sites", {
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      solar_kw: parseFloat(form.solar_kw),
      battery_kwh: parseFloat(form.battery_kwh),
      ev_chargers: parseInt(form.ev_chargers),
    }).then(() => { loadSites() })
  }

  const deleteSite = (id) => {
    axios.delete(`/api/sites/${id}`).then(() => loadSites())
  }

  const FIELDS = [
    ["name",        t("fleet_col_name")     || "Installation name"],
    ["location",    t("fleet_col_location") || "Location (city)"],
    ["lat",         "Latitude"],
    ["lng",         "Longitude"],
    ["solar_kw",    "Solar (kW)"],
    ["battery_kwh", "Battery (kWh)"],
    ["ev_chargers", t("fleet_ev_chargers")  || "EV Chargers"],
    ["owner",       t("fleet_owner")        || "Owner"],
  ]

  return (
    <div style={{ padding: "32px", background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "6px" }}>🗺️ {t("nav_sites")}</h1>
      <p style={{ color: "var(--sub)", fontSize: "13px", marginBottom: "28px" }}>{t("nav_sites")} · {t("fleet_installations") || "Installations"}</p>

      {/* Form */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "15px", fontWeight: "600", marginBottom: "16px" }}>➕ {t("add")} Site</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {FIELDS.map(([field, label]) => (
            <input
              key={field}
              placeholder={label}
              value={form[field]}
              onChange={e => setForm({ ...form, [field]: e.target.value })}
              style={{
                background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
                padding: "10px 14px", color: "var(--text)", fontSize: "13px",
              }}
            />
          ))}
          <button
            onClick={handleSubmit}
            style={{
              gridColumn: "1 / -1", background: color, color: "#000", border: "none",
              borderRadius: "8px", padding: "11px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
            }}
          >
            {t("save")} Site
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sites.length === 0 && (
          <p style={{ color: "var(--sub)", fontSize: "13px" }}>No sites added yet.</p>
        )}
        {sites.map(site => (
          <div key={site.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: "700", fontSize: "15px" }}>{site.name}</div>
              <div style={{ color: "var(--sub)", fontSize: "12px", marginTop: "3px" }}>
                {site.location} · {site.solar_kw} kW solar · {site.battery_kwh} kWh battery · {site.ev_chargers} EV
              </div>
            </div>
            <button
              onClick={() => deleteSite(site.id)}
              style={{ background: "#450a0a", color: "#ef4444", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "6px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
            >
              {t("delete")}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
