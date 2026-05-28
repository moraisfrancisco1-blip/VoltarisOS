import { useEffect, useState } from "react"
import axios from "axios"
import { useTranslation } from "../i18n/useTranslation"

const statusColor = { active: "#4ade80", inactive: "#f87171", maintenance: "#f59e0b" }

export default function FleetManagement({ user }) {
  const { t } = useTranslation()
  const [sites, setSites] = useState([])
  const [selected, setSelected] = useState(null)
  const color = user?.color || "#4ade80"

  useEffect(() => { axios.get("/api/sites").then(r => setSites(r.data)).catch(() => {}) }, [])

  const totalSolar = sites.reduce((s, x) => s + (x.solar_kw || 0), 0)
  const totalBattery = sites.reduce((s, x) => s + (x.battery_kwh || 0), 0)
  const totalEV = sites.reduce((s, x) => s + (x.ev_chargers || 0), 0)

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "6px" }}>🏭 Fleet Management</h1>
      <p style={{ color: "var(--sub)", fontSize: "14px", marginBottom: "24px" }}>{t("fleet_sub") || "All VPP fleet assets"}</p>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: t("fleet_active_sites") || "Active Sites", value: sites.filter(s => s.status === "active").length, icon: "📍", color },
          { label: t("fleet_solar_total") || "Total Solar", value: `${totalSolar.toFixed(1)} kW`, icon: "☀️", color: "#f59e0b" },
          { label: t("fleet_battery_total") || "Total Battery", value: `${totalBattery.toFixed(0)} kWh`, icon: "🔋", color: "#60a5fa" },
          { label: t("fleet_ev_chargers") || "EV Chargers", value: totalEV, icon: "🚗", color: "#a78bfa" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--surface)", borderRadius: "12px", padding: "20px", border: "1px solid var(--border)" }}>
            <div style={{ color: "var(--sub)", fontSize: "12px" }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: "26px", fontWeight: "bold", color: k.color, marginTop: "8px" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sites Table */}
      <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
          <h3>{t("fleet_installations") || "Installations"}</h3>
          <span style={{ color: "var(--sub)", fontSize: "13px" }}>{sites.length} sites</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {[
                t("fleet_col_name") || "Name",
                t("fleet_col_location") || "Location",
                "Solar kW", "Battery kWh", "EV", "Status", ""
              ].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "var(--sub)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map(site => (
              <tr key={site.id} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => setSelected(selected?.id === site.id ? null : site)}>
                <td style={{ padding: "14px 16px", fontWeight: "600" }}>{site.name}</td>
                <td style={{ padding: "14px 16px", color: "var(--sub)" }}>{site.location}</td>
                <td style={{ padding: "14px 16px", color: "#f59e0b" }}>{site.solar_kw}</td>
                <td style={{ padding: "14px 16px", color: "#60a5fa" }}>{site.battery_kwh}</td>
                <td style={{ padding: "14px 16px", color: "#a78bfa" }}>{site.ev_chargers}</td>
                <td style={{ padding: "14px 16px" }}>
                  <span style={{ background: (statusColor[site.status] || "#6b7280") + "22", color: statusColor[site.status] || "#6b7280", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" }}>
                    {site.status}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <button style={{ background: color + "22", color, border: "none", borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontSize: "12px" }}>
                    {t("details") || "Details"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ marginTop: "16px", background: "var(--surface)", borderRadius: "12px", padding: "20px", border: `1px solid ${color}44` }}>
          <h3 style={{ color, marginBottom: "12px" }}>📍 {selected.name}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {[
              [t("fleet_col_location") || "Location", selected.location],
              ["Lat/Lon", `${selected.lat}, ${selected.lng}`],
              [t("fleet_solar_installed") || "Solar Installed", `${selected.solar_kw} kW`],
              [t("fleet_battery_cap") || "Battery Capacity", `${selected.battery_kwh} kWh`],
              [t("fleet_ev_chargers") || "EV Chargers", selected.ev_chargers],
              [t("fleet_owner") || "Owner", selected.owner],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: "var(--sub)", fontSize: "11px", textTransform: "uppercase" }}>{k}</div>
                <div style={{ color: "white", fontWeight: "600", marginTop: "4px" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
