import { useState } from "react"

const NAV_GROUPS = [
  {
    label: "Core",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
      { id: "fleet", label: "Fleet", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
      { id: "map", label: "Map View", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
      { id: "sites", label: "Sites", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
    ]
  },
  {
    label: "Energy",
    items: [
      { id: "battery", label: "Battery BMS", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg> },
      { id: "ev", label: "EV Charging", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><polygon points="9 11 4 16 9 21 4 26"/><line x1="22" y1="10" x2="14" y2="10"/><line x1="18" y1="6" x2="18" y2="14"/></svg> },
      { id: "grid", label: "Grid Services", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
    ]
  },
  {
    label: "Markets",
    items: [
      { id: "trading", label: "Trading", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
      { id: "forecasting", label: "Forecasting", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h2m16 0h2M12 2v2m0 16v2M5 5l1.5 1.5M17.5 5 16 6.5M5 19l1.5-1.5m11 1.5L16 17.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg> },
    ]
  },
  {
    label: "Operations",
    items: [
      { id: "alerts", label: "Alerts", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
      { id: "reports", label: "Reports", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
      { id: "investor", label: "Investor View", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
    ]
  },
  {
    label: "Admin",
    items: [
      { id: "users", label: "Users", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
      { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    ]
  }
]

export default function Sidebar({ page, setPage, user, onLogout }) {
  const [collapsed, setCollapsed] = useState(false)
  const color = user?.color || "#4ade80"
  const w = collapsed ? 64 : 240

  return (
    <>
      {/* Overlay on mobile when expanded */}
      <aside style={{
        width: `${w}px`,
        minWidth: `${w}px`,
        background: "linear-gradient(180deg, #080d18 0%, #0a1020 100%)",
        borderRight: "1px solid #1a2234",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(.4,0,.2,1), min-width 0.25s cubic-bezier(.4,0,.2,1)",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
        zIndex: 100,
      }}>

        {/* Header */}
        <div style={{
          padding: "0 16px",
          height: "60px",
          borderBottom: "1px solid #1a2234",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: `linear-gradient(135deg, ${color}33, ${color}66)`,
            border: `1px solid ${color}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>

          {!collapsed && (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ color: "white", fontWeight: "700", fontSize: "15px", letterSpacing: "-0.3px", whiteSpace: "nowrap" }}>
                Voltaris<span style={{ color }}>OS</span>
              </div>
              <div style={{ color: "#4b5563", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", whiteSpace: "nowrap" }}>VPP Platform</div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
            style={{
              marginLeft: collapsed ? "auto" : 0,
              background: "none",
              border: "none",
              color: "#4b5563",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#9ca3af"}
            onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}
          >
            {collapsed ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            )}
          </button>
        </div>

        {/* User badge */}
        {!collapsed && (
          <div style={{
            margin: "12px 12px 4px",
            padding: "10px 12px",
            background: "#0d1525",
            borderRadius: "10px",
            border: "1px solid #1a2234",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${color}44, ${color}88)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "700",
                color: color,
                flexShrink: 0,
              }}>
                {(user?.company || "V")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                <div style={{ color: "white", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.company || "Voltaris"}
                </div>
                <div style={{
                  display: "inline-block",
                  fontSize: "9px",
                  padding: "1px 6px",
                  borderRadius: "20px",
                  background: color + "22",
                  color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginTop: "2px",
                  fontWeight: "600",
                }}>
                  {user?.role || "admin"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} style={{ marginBottom: "4px" }}>
              {!collapsed && (
                <div style={{
                  padding: "8px 16px 4px",
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "#374151",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  whiteSpace: "nowrap",
                }}>
                  {group.label}
                </div>
              )}
              {collapsed && gi > 0 && (
                <div style={{ margin: "4px 12px", height: "1px", background: "#1a2234" }} />
              )}
              {group.items.map(item => {
                const active = page === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setPage(item.id)}
                    title={collapsed ? item.label : ""}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: collapsed ? "10px 0" : "9px 12px",
                      justifyContent: collapsed ? "center" : "flex-start",
                      background: active ? `${color}14` : "none",
                      border: "none",
                      borderRadius: collapsed ? "0" : "0",
                      borderLeft: active ? `2px solid ${color}` : "2px solid transparent",
                      color: active ? color : "#6b7280",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: active ? "600" : "400",
                      textAlign: "left",
                      transition: "all 0.12s",
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseEnter={e => {
                      if (!active) {
                        e.currentTarget.style.background = "#ffffff08"
                        e.currentTarget.style.color = "#d1d5db"
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        e.currentTarget.style.background = "none"
                        e.currentTarget.style.color = "#6b7280"
                      }
                    }}
                  >
                    <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
                    {active && !collapsed && (
                      <span style={{
                        marginLeft: "auto",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: "10px 10px 16px", borderTop: "1px solid #1a2234", flexShrink: 0 }}>
          <button
            onClick={onLogout}
            title={collapsed ? "Sair" : ""}
            style={{
              width: "100%",
              padding: "9px 12px",
              background: "#1a0a0a",
              border: "1px solid #2d1515",
              borderRadius: "8px",
              color: "#f87171",
              cursor: "pointer",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: collapsed ? "center" : "flex-start",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#2d1515"}
            onMouseLeave={e => e.currentTarget.style.background = "#1a0a0a"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
