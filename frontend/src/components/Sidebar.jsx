import { useState } from "react"

const NAV = [
  { id: "dashboard", icon: "⚡", label: "Dashboard" },
  { id: "fleet", icon: "🏭", label: "Fleet" },
  { id: "trading", icon: "📈", label: "Trading" },
  { id: "battery", icon: "🔋", label: "Battery BMS" },
  { id: "ev", icon: "🚗", label: "EV Charging" },
  { id: "grid", icon: "🔌", label: "Grid Services" },
  { id: "forecasting", icon: "🌤️", label: "Forecasting" },
  { id: "map", icon: "🗺️", label: "Map View" },
  { id: "alerts", icon: "🔔", label: "Alerts" },
  { id: "reports", icon: "📊", label: "Reports" },
  { id: "investor", icon: "💰", label: "Investor View" },
  { id: "users", icon: "👥", label: "Users" },
  { id: "sites", icon: "📍", label: "Sites" },
  { id: "settings", icon: "⚙️", label: "Settings" },
]

export default function Sidebar({ page, setPage, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const color = user?.color || "#4ade80"

  return (
    <aside style={{
      width: collapsed ? "64px" : "220px",
      background: "#0d1424",
      borderRight: `1px solid #1f2937`,
      display: "flex", flexDirection: "column",
      transition: "width 0.2s",
      minHeight: "100vh",
      position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 16px", borderBottom: "1px solid #1f2937", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "22px" }}>⚡</span>
        {!collapsed && <span style={{ color, fontWeight: "bold", fontSize: "16px", whiteSpace: "nowrap" }}>VoltarisOS</span>}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          marginLeft: "auto", background: "none", border: "none",
          color: "#6b7280", cursor: "pointer", fontSize: "18px"
        }}>{collapsed ? "→" : "←"}</button>
      </div>

      {/* Company badge */}
      {!collapsed && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase", letterSpacing: "1px" }}>Company</div>
          <div style={{ color: "white", fontSize: "13px", fontWeight: "600", marginTop: "2px" }}>{user?.company}</div>
          <div style={{
            display: "inline-block", marginTop: "4px", fontSize: "10px",
            padding: "2px 8px", borderRadius: "20px", background: color + "22", color
          }}>{user?.role}</div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => setPage(item.id)} style={{
            width: "100%", display: "flex", alignItems: "center",
            gap: "12px", padding: collapsed ? "12px 20px" : "10px 16px",
            background: page === item.id ? color + "18" : "none",
            border: "none", borderLeft: page === item.id ? `3px solid ${color}` : "3px solid transparent",
            color: page === item.id ? color : "#9ca3af",
            cursor: "pointer", fontSize: "14px", textAlign: "left",
            transition: "all 0.15s",
          }}>
            <span style={{ fontSize: "18px", minWidth: "20px" }}>{item.icon}</span>
            {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "12px 8px", borderTop: "1px solid #1f2937" }}>
        <button onClick={onLogout} style={{
          width: "100%", padding: "10px", background: "#1f2937",
          border: "none", borderRadius: "8px", color: "#f87171",
          cursor: "pointer", fontSize: "13px", display: "flex",
          alignItems: "center", gap: "8px", justifyContent: collapsed ? "center" : "flex-start"
        }}>
          <span>🚪</span>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
