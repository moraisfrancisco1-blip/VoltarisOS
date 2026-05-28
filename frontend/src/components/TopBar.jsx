import { useAppStore } from "../store/appStore"
import NotificationBell from "./NotificationBell"

const PAGE_TITLES = {
  dashboard: "Dashboard", sites: "Sites", fleet: "Fleet Management",
  trading: "Trading", battery: "Battery BMS", ev: "EV Charging",
  grid: "Grid Services", forecasting: "Forecasting", map: "Map View",
  alerts: "Alerts & Notifications", reports: "Reports & Analytics",
  users: "User Management", investor: "Investor View", settings: "Settings",
  carbon: "Carbon Dashboard", autonomous: "AI Trading Agent",
  twin: "Digital Twin", maintenance: "Predictive Maintenance",
  whitelabel: "White-label", audit: "Audit Log", apikeys: "API Keys", export: "Export Center",
}

export default function TopBar({ page, user }) {
  const { theme, setTheme, simMode, setSimMode, setCmdOpen, addToast } = useAppStore()
  const color = user?.color || "#4ade80"

  return (
    <div style={{
      height: "56px", background: "#080d18",
      borderBottom: "1px solid #1a2234",
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: "12px",
      position: "sticky", top: 0, zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Page title */}
      <div style={{ flex: 1 }}>
        <span style={{ color: "white", fontWeight: "600", fontSize: "15px" }}>
          {PAGE_TITLES[page] || "VoltarisOS"}
        </span>
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setCmdOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "7px 14px", background: "#0d1525",
          border: "1px solid #1e2d45", borderRadius: "8px",
          color: "#4b5563", cursor: "pointer", fontSize: "13px",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#374151"; e.currentTarget.style.color = "#9ca3af" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2d45"; e.currentTarget.style.color = "#4b5563" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span>Pesquisar</span>
        <kbd style={{
          padding: "1px 6px", background: "#1a2234", border: "1px solid #1e2d45",
          borderRadius: "4px", fontSize: "10px", color: "#374151",
        }}>⌘K</kbd>
      </button>

      {/* Sim mode toggle */}
      <button
        onClick={() => { setSimMode(!simMode); addToast(simMode ? "Modo Simulação desativado" : "Modo Simulação ativado", "info") }}
        title={simMode ? "Desativar simulação" : "Ativar simulação"}
        style={{
          padding: "7px 12px",
          background: simMode ? "#78350f30" : "#0d1525",
          border: simMode ? "1px solid #f59e0b44" : "1px solid #1e2d45",
          borderRadius: "8px", color: simMode ? "#f59e0b" : "#4b5563",
          cursor: "pointer", fontSize: "12px", fontWeight: "600",
          transition: "all 0.15s",
          display: "flex", alignItems: "center", gap: "6px",
        }}
      >
        <span>🧪</span>
        {simMode ? "SIM" : "SIM"}
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title="Toggle tema"
        style={{
          background: "#0d1525", border: "1px solid #1e2d45",
          borderRadius: "8px", color: "#6b7280", cursor: "pointer",
          width: "36px", height: "36px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", fontSize: "16px",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#1a2234"; e.currentTarget.style.color = "#d1d5db" }}
        onMouseLeave={e => { e.currentTarget.style.background = "#0d1525"; e.currentTarget.style.color = "#6b7280" }}
      >
        {theme === "dark" ? "☀" : "🌙"}
      </button>

      {/* Notifications */}
      <NotificationBell color={color} />

      {/* User pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "5px 10px", background: "#0d1525",
        border: "1px solid #1e2d45", borderRadius: "8px",
      }}>
        <div style={{
          width: "24px", height: "24px", borderRadius: "50%",
          background: `${color}25`, border: `1px solid ${color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: "700", color: color,
        }}>
          {(user?.company || "V").charAt(0).toUpperCase()}
        </div>
        <span style={{ color: "#9ca3af", fontSize: "12px", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.company || "Admin"}
        </span>
      </div>
    </div>
  )
}
