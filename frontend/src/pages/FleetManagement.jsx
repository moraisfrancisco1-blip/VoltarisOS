import { useEffect, useState } from "react"
import axios from "axios"

const statusColor = { active: "#4ade80", inactive: "#f87171", maintenance: "#f59e0b" }

export default function FleetManagement({ user }) {
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
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>Todos os assets da frota VPP</p>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Sites Ativos", value: sites.filter(s => s.status === "active").length, icon: "📍", color },
          { label: "Solar Total", value: `${totalSolar.toFixed(1)} kW`, icon: "☀️", color: "#f59e0b" },
          { label: "Bateria Total", value: `${totalBattery.toFixed(0)} kWh`, icon: "🔋", color: "#60a5fa" },
          { label: "Carregadores EV", value: totalEV, icon: "🚗", color: "#a78bfa" },
        ].map(k => (
          <div key={k.label} style={{ background: "#111827", borderRadius: "12px", padding: "20px", border: "1px solid #1f2937" }}>
            <div style={{ color: "#6b7280", fontSize: "12px" }}>{k.icon} {k.label}</div>
            <div style={{ fontSize: "26px", fontWeight: "bold", color: k.color, marginTop: "8px" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sites Table */}
      <div style={{ background: "#111827", borderRadius: "12px", border: "1px solid #1f2937", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between" }}>
          <h3>Instalações</h3>
          <span style={{ color: "#6b7280", fontSize: "13px" }}>{sites.length} sites</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1f2937" }}>
              {["Nome", "Localização", "Solar kW", "Bateria kWh", "EV", "Status", ""].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: "#6b7280", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sites.map(site => (
              <tr key={site.id} style={{ borderBottom: "1px solid #1f2937", cursor: "pointer" }}
                onClick={() => setSelected(selected?.id === site.id ? null : site)}>
                <td style={{ padding: "14px 16px", fontWeight: "600" }}>{site.name}</td>
                <td style={{ padding: "14px 16px", color: "#9ca3af" }}>{site.location}</td>
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
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ marginTop: "16px", background: "#111827", borderRadius: "12px", padding: "20px", border: `1px solid ${color}44` }}>
          <h3 style={{ color, marginBottom: "12px" }}>📍 {selected.name}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {[
              ["Localização", selected.location],
              ["Lat/Lon", `${selected.lat}, ${selected.lng}`],
              ["Solar Instalado", `${selected.solar_kw} kW`],
              ["Capacidade Bateria", `${selected.battery_kwh} kWh`],
              ["Carregadores EV", selected.ev_chargers],
              ["Proprietário", selected.owner],
            ].map(([k, v]) => (
              <div key={k}>
                <div style={{ color: "#6b7280", fontSize: "11px", textTransform: "uppercase" }}>{k}</div>
                <div style={{ color: "white", fontWeight: "600", marginTop: "4px" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
