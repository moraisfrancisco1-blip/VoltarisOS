import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"

const SITES = [
  { id: "rot", name: "Rotterdam",  lat: 51.92, lng: 4.47,  status: "online",  solar: 284, wind: 62, battery: 78, price: 74.2, alert: null,    capacity: "500kW / 1MWh",   revenue: 1284, efficiency: 94 },
  { id: "reb", name: "Rebordelo",  lat: 41.68, lng: -7.11, status: "online",  solar: 198, wind: 14, battery: 52, price: 68.1, alert: null,    capacity: "250kW / 500kWh", revenue: 742,  efficiency: 88 },
  { id: "lis", name: "Lisboa",     lat: 38.72, lng: -9.14, status: "warning", solar: 156, wind: 8,  battery: 31, price: 71.8, alert: "cc_alert_low_batt", capacity: "350kW / 700kWh", revenue: 614,  efficiency: 72 },
  { id: "ams", name: "Amsterdam",  lat: 52.37, lng: 4.90,  status: "online",  solar: 102, wind: 88, battery: 91, price: 76.4, alert: null,    capacity: "400kW / 800kWh", revenue: 1102, efficiency: 96 },
  { id: "por", name: "Porto",      lat: 41.15, lng: -8.61, status: "offline", solar: 0,   wind: 0,  battery: 0,  price: 0,    alert: "cc_alert_offline",  capacity: "200kW / 400kWh", revenue: 0,    efficiency: 0 },
]

const statusColor  = { online: "#10b981", warning: "#f59e0b", offline: "#f87171" }
const statusPulse  = { online: "#10b98140", warning: "#f59e0b40", offline: "#f8717140" }

function Gauge({ value, max = 100, color, size = 56 }) {
  const r = size / 2 - 6
  const circ = 2 * Math.PI * r
  const pct = Math.min(Math.max(value, 0), max) / max
  const dash = pct * circ * 0.75
  const offset = circ * 0.125
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={5}
        strokeDasharray={`${circ * 0.75} ${circ}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform={`rotate(135 ${size/2} ${size/2})`}
      />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform={`rotate(135 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dasharray 0.5s" }}
      />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="var(--text)" fontSize={size * 0.22} fontWeight={700}>
        {value}%
      </text>
    </svg>
  )
}

function MiniBar({ value, max, color }) {
  return (
    <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value / max * 100, 100)}%`, background: color, borderRadius: 2, transition: "width 0.5s" }} />
    </div>
  )
}

export default function CommandCenter() {
  const { t } = useAppStore()
  const [selected, setSelected] = useState("rot")
  const [ticker, setTicker] = useState(0)

  // Simulate live updates
  useEffect(() => {
    const int = setInterval(() => setTicker(n => n + 1), 4000)
    return () => clearInterval(int)
  }, [])

  const site = SITES.find(s => s.id === selected) || SITES[0]
  const totalRevenue = SITES.reduce((sum, s) => sum + s.revenue, 0)
  const totalSolar   = SITES.reduce((sum, s) => sum + s.solar, 0)
  const onlineCount  = SITES.filter(s => s.status === "online").length
  const avgBattery   = Math.round(SITES.filter(s => s.status !== "offline").reduce((sum, s) => sum + s.battery, 0) / SITES.filter(s => s.status !== "offline").length)

  const cardStyle = {
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "20px 24px",
  }

  return (
    <div style={{ padding: "28px 32px", color: "var(--text)", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{t("cc_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: 14 }}>{t("cc_sub")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#10b98120", color: "#10b981", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            {t("cc_live_feed")}
          </div>
          <div style={{ color: "var(--sub)", fontSize: 13, background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 14px", borderRadius: 20 }}>
            {onlineCount}/{SITES.length} {t("cc_sites_online")}
          </div>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: t("cc_fleet_revenue"),  value: `€${totalRevenue.toLocaleString()}`,  color: "#10b981", sub: t("cc_today") },
          { label: t("cc_total_solar"),    value: `${totalSolar} kW`,                   color: "#f59e0b", sub: t("cc_generating") },
          { label: t("cc_avg_battery"),    value: `${avgBattery}%`,                     color: "#6366f1", sub: t("cc_fleet_soc") },
          { label: t("cc_active_alerts"),  value: SITES.filter(s => s.alert).length,    color: "#f87171", sub: t("cc_need_attention") },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ fontSize: 11, color: "var(--sub)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--sub)", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Main: site grid + detail */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>

        {/* Site grid cards */}
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {SITES.map(s => (
              <div key={s.id}
                onClick={() => setSelected(s.id)}
                style={{
                  ...cardStyle,
                  cursor: "pointer",
                  border: `1px solid ${selected === s.id ? statusColor[s.status] : s.alert ? "#f8717130" : "var(--border)"}`,
                  background: selected === s.id ? `${statusColor[s.status]}0a` : "var(--surface)",
                  transition: "all 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}>

                {/* Status indicator */}
                <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 9, height: 9, borderRadius: "50%",
                    background: statusColor[s.status],
                    boxShadow: `0 0 0 3px ${statusPulse[s.status]}`,
                  }} />
                  <span style={{ fontSize: 11, color: statusColor[s.status], fontWeight: 700, textTransform: "uppercase" }}>
                    {t(`cc_status_${s.status}`)}
                  </span>
                </div>

                {/* Site name */}
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{s.name}</h3>
                  <div style={{ fontSize: 12, color: "var(--sub)" }}>{s.capacity}</div>
                </div>

                {s.status !== "offline" ? (
                  <>
                    {/* Mini stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                      {[
                        { label: "☀️", value: `${s.solar}kW`, color: "#f59e0b" },
                        { label: "🌬️", value: `${s.wind}kW`, color: "#60a5fa" },
                        { label: "€", value: `${s.price}`, color: "#10b981" },
                      ].map(stat => (
                        <div key={stat.label} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: "var(--sub)", marginBottom: 2 }}>{stat.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Battery */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Gauge value={s.battery} color={s.battery > 60 ? "#10b981" : s.battery > 30 ? "#f59e0b" : "#f87171"} size={48} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "var(--sub)", marginBottom: 4 }}>{t("cc_battery_soc")}</div>
                        <div style={{ fontSize: 13, color: "var(--sub)", marginBottom: 6 }}>
                          {t("cc_efficiency")}: <span style={{ color: "var(--text)", fontWeight: 700 }}>{s.efficiency}%</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#10b981", fontWeight: 700 }}>€{s.revenue} {t("cc_today")}</div>
                      </div>
                    </div>

                    {s.alert && (
                      <div style={{ marginTop: 12, padding: "8px 12px", background: "#f8717112", borderRadius: 8, border: "1px solid #f8717130", fontSize: 12, color: "#f87171", fontWeight: 600 }}>
                        ⚠️ {t(s.alert)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 32 }}>🔴</div>
                    <div style={{ color: "#f87171", fontWeight: 700, marginTop: 8 }}>{t("cc_alert_offline")}</div>
                    <div style={{ color: "var(--sub)", fontSize: 12, marginTop: 4 }}>{t("cc_offline_since")}: 03:14</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Site detail panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Site detail */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 800, fontSize: 16 }}>{site.name}</h3>
              <span style={{
                background: statusBg(site.status), color: statusColor[site.status],
                padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              }}>{t(`cc_status_${site.status}`)}</span>
            </div>

            {[
              { label: t("cc_solar_output"), value: `${site.solar} kW`, color: "#f59e0b", bar: site.solar, max: 500 },
              { label: t("cc_wind_output"),  value: `${site.wind} kW`,  color: "#60a5fa", bar: site.wind,  max: 100 },
              { label: t("cc_battery_soc"),  value: `${site.battery}%`, color: "#10b981", bar: site.battery, max: 100 },
              { label: t("cc_efficiency"),   value: `${site.efficiency}%`, color: "#6366f1", bar: site.efficiency, max: 100 },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "var(--sub)" }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>{item.value}</span>
                </div>
                <MiniBar value={item.bar} max={item.max} color={item.color} />
              </div>
            ))}

            <div style={{ paddingTop: 14, borderTop: "1px solid var(--border)", marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "var(--sub)" }}>{t("cc_market_price")}</span>
                <span style={{ fontWeight: 700, color: "#10b981" }}>{site.price} €/MWh</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--sub)" }}>{t("cc_today_revenue")}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#10b981" }}>€{site.revenue}</span>
              </div>
            </div>
          </div>

          {/* Quick commands */}
          <div style={cardStyle}>
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t("cc_quick_commands")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: t("cc_cmd_charge"),    color: "#60a5fa", icon: "⚡", cmd: "charge" },
                { label: t("cc_cmd_discharge"), color: "#10b981", icon: "💰", cmd: "discharge" },
                { label: t("cc_cmd_idle"),      color: "#6b7280", icon: "⏸️", cmd: "idle" },
                { label: t("cc_cmd_reboot"),    color: "#f59e0b", icon: "🔄", cmd: "reboot" },
                { label: t("cc_cmd_ticket"),    color: "#f87171", icon: "🎫", cmd: "ticket" },
              ].map(cmd => (
                <button key={cmd.cmd} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  borderRadius: 10, border: `1px solid ${cmd.color}30`,
                  background: `${cmd.color}0a`, cursor: "pointer",
                  color: "var(--text)", fontWeight: 600, fontSize: 13,
                  transition: "all 0.15s", textAlign: "left",
                }}>
                  <span style={{ fontSize: 16 }}>{cmd.icon}</span>
                  {cmd.label}
                  <span style={{ marginLeft: "auto", color: cmd.color, fontSize: 11 }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fleet comparison table */}
      <div style={cardStyle}>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("cc_fleet_comparison")}</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[t("cc_site"), t("cc_status_online"), t("cc_solar_output"), t("cc_battery_soc"), t("cc_efficiency"), t("cc_today_revenue"), t("cc_price")].map(h => (
                <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "var(--sub)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SITES.map(s => (
              <tr key={s.id} onClick={() => setSelected(s.id)} style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", background: selected === s.id ? "var(--bg)" : "transparent" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{s.name}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: `${statusColor[s.status]}18`, color: statusColor[s.status], padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    {t(`cc_status_${s.status}`)}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "#f59e0b", fontWeight: 600 }}>{s.solar} kW</td>
                <td style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${s.battery}%`, background: s.battery > 60 ? "#10b981" : "#f59e0b", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{s.battery}%</span>
                  </div>
                </td>
                <td style={{ padding: "12px 14px", color: s.efficiency > 85 ? "#10b981" : s.efficiency > 70 ? "#f59e0b" : "#f87171", fontWeight: 600 }}>{s.efficiency}%</td>
                <td style={{ padding: "12px 14px", color: "#10b981", fontWeight: 700 }}>€{s.revenue}</td>
                <td style={{ padding: "12px 14px", color: "var(--sub)" }}>{s.price ? `${s.price} €/MWh` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function statusBg(status) {
  return { online: "#10b98118", warning: "#f59e0b18", offline: "#f8717118" }[status]
}
