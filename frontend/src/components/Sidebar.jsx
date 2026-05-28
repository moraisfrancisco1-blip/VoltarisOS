import { useState } from "react"
import logoDark from "../logo_sidebar.png"
import { useTranslation } from "../i18n/useTranslation"
import { useAppStore } from "../store/appStore"

export default function Sidebar({ page, setPage, user, onLogout }) {
  const { t } = useTranslation()
  const { sidebarDefaultCollapsed } = useAppStore()
  const [collapsed, setCollapsed] = useState(sidebarDefaultCollapsed)
  const accentStore = useAppStore(s => s.accentColor)
  const color = user?.color || accentStore || "#4ade80"
  const w = collapsed ? 64 : 240

  const NAV_GROUPS = [
    {
      labelKey: "nav_core",
      items: [
        { id: "dashboard", labelKey: "nav_dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
        { id: "fleet",     labelKey: "nav_fleet",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
        { id: "map",       labelKey: "nav_map",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
        { id: "sites",     labelKey: "nav_sites",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
        { id: "twin",      labelKey: "nav_twin",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="9" height="10" rx="1"/><rect x="13" y="7" width="9" height="10" rx="1"/><path d="M11 12h2"/><path d="M5 4v3m0 10v3m14-16v3m0 10v3"/></svg> },
      ]
    },
    {
      labelKey: "nav_energy",
      items: [
        { id: "battery",   labelKey: "nav_battery",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg> },
        { id: "ev",        labelKey: "nav_ev",        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><polygon points="9 11 4 16 9 21 4 26"/><line x1="22" y1="10" x2="14" y2="10"/><line x1="18" y1="6" x2="18" y2="14"/></svg> },
        { id: "grid",      labelKey: "nav_grid",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
        { id: "carbon",    labelKey: "nav_carbon",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"/><line x1="12" y1="8" x2="12" y2="4"/></svg> },
      ]
    },
    {
      labelKey: "nav_markets",
      items: [
        { id: "trading",   labelKey: "nav_trading",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
        { id: "autonomous",labelKey: "nav_autonomous", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> },
        { id: "forecasting",labelKey: "nav_forecasting",icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h2m16 0h2M12 2v2m0 16v2M5 5l1.5 1.5M17.5 5 16 6.5M5 19l1.5-1.5m11 1.5L16 17.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg> },
      ]
    },
    {
      labelKey: "nav_operations",
      items: [
        { id: "alerts",    labelKey: "nav_alerts",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
        { id: "maintenance",labelKey: "nav_maintenance",icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
        { id: "reports",   labelKey: "nav_reports",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
        { id: "investor",  labelKey: "nav_investor",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
      ]
    },
    {
      labelKey: "nav_admin",
      items: [
        { id: "users",     labelKey: "nav_users",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
        { id: "settings",  labelKey: "nav_settings",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
        { id: "whitelabel",labelKey: "nav_whitelabel",icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
        { id: "audit",     labelKey: "nav_audit",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> },
        { id: "apikeys",   labelKey: "nav_apikeys",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> },
        { id: "export",    labelKey: "nav_export",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
      ]
    }
  ]

  return (
    <aside style={{
      width: `${w}px`,
      minWidth: `${w}px`,
      background: "var(--sidebar)",
      borderRight: "1px solid var(--border)",
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
        padding: "0 12px",
        height: "68px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
      }}>
        {collapsed ? (
          <div style={{
            width: "36px", height: "36px", borderRadius: "9px",
            background: "linear-gradient(135deg, #f59e0b33, #f97316aa)",
            border: "1px solid #f59e0b55",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
        ) : (
          <img src={logoDark} alt="VoltarisOS" style={{ height: "44px", width: "auto", objectFit: "contain", flex: 1, minWidth: 0 }} />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            marginLeft: collapsed ? "auto" : 0, background: "none", border: "none",
            color: "var(--sub)", cursor: "pointer", padding: "4px", borderRadius: "6px",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--sub)"}
        >
          {collapsed
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          }
        </button>
      </div>

      {/* Company + role strip */}
      {!collapsed && (
        <div style={{
          margin: "10px 12px 2px", padding: "8px 12px",
          background: "var(--surface2)", borderRadius: "8px", border: "1px solid var(--border)",
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ color: "var(--sub)", fontSize: "12px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {user?.company || "Voltaris"}
          </div>
          <div style={{
            fontSize: "9px", padding: "2px 7px", borderRadius: "20px",
            background: "#f59e0b18", color: "#f59e0b",
            textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", flexShrink: 0, marginLeft: "8px",
          }}>
            {user?.role || "admin"}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto", overflowX: "hidden" }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: "4px" }}>
            {!collapsed && (
              <div style={{
                padding: "8px 16px 4px", fontSize: "10px", fontWeight: "600",
                color: "var(--sub)", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap",
              }}>
                {t(group.labelKey)}
              </div>
            )}
            {collapsed && gi > 0 && (
              <div style={{ margin: "4px 12px", height: "1px", background: "var(--border)" }} />
            )}
            {group.items.map(item => {
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={collapsed ? t(item.labelKey) : ""}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: collapsed ? "10px 0" : "9px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    background: active ? `${color}14` : "none", border: "none",
                    borderLeft: active ? `2px solid ${color}` : "2px solid transparent",
                    color: active ? color : "var(--sub)",
                    cursor: "pointer", fontSize: "13px", fontWeight: active ? "600" : "400",
                    textAlign: "left", transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)" } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--sub)" } }}
                >
                  <span style={{ flexShrink: 0, display: "flex" }}>{item.icon}</span>
                  {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(item.labelKey)}</span>}
                  {active && !collapsed && (
                    <span style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "10px 10px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <button
          onClick={onLogout}
          title={collapsed ? t("logout") : ""}
          style={{
            width: "100%", padding: "9px 12px",
            background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "8px", color: "#f87171", cursor: "pointer", fontSize: "13px",
            display: "flex", alignItems: "center", gap: "8px",
            justifyContent: collapsed ? "center" : "flex-start", transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.06)"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!collapsed && <span>{t("logout")}</span>}
        </button>
      </div>
    </aside>
  )
}
