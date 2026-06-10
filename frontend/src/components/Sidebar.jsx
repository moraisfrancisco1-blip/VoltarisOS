import { useState, useEffect } from "react"
import { useTranslation } from "../i18n/useTranslation"
import { useAppStore } from "../store/appStore"

// Premium inline SVG logo — hex + lightning + gradient wordmark
function VoltarisLogo({ collapsed }) {
  return collapsed ? (
    // Collapsed: just the hex icon
    <svg width="34" height="34" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sl_grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#f97316"/>
        </linearGradient>
        <filter id="sl_glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <polygon points="22,3 37,12 37,30 22,39 7,30 7,12"
        fill="none" stroke="url(#sl_grad)" strokeWidth="2.2"/>
      <polygon points="22,8 33,14.5 33,27.5 22,34 11,27.5 11,14.5"
        fill="url(#sl_grad)" opacity="0.13"/>
      <path d="M26 10 L18 22 L23 22 L18 34 L30 19 L24 19 Z"
        fill="url(#sl_grad)" filter="url(#sl_glow)"/>
    </svg>
  ) : (
    // Expanded: hex + "Voltaris OS" wordmark
    <svg height="38" viewBox="0 0 190 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flex: 1, minWidth: 0 }}>
      <defs>
        <linearGradient id="sl_grad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b"/>
          <stop offset="100%" stopColor="#f97316"/>
        </linearGradient>
        <filter id="sl_glow2">
          <feGaussianBlur stdDeviation="1.2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="sl_pulse">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Hex */}
      <polygon points="19,2 31,9 31,23 19,30 7,23 7,9"
        fill="none" stroke="url(#sl_grad2)" strokeWidth="1.8"/>
      <polygon points="19,6 28,11.5 28,20.5 19,26 10,20.5 10,11.5"
        fill="url(#sl_grad2)" opacity="0.11"/>
      {/* Bolt */}
      <path d="M22 5 L16 17 L20.5 17 L16 30 L27 15 L21.5 15 Z"
        fill="url(#sl_grad2)" filter="url(#sl_glow2)"/>
      {/* "Voltaris" */}
      <text x="42" y="23" fontFamily="system-ui,-apple-system,sans-serif"
        fontSize="16" fontWeight="800" fill="var(--text)" letterSpacing="-0.4">
        Voltaris
      </text>
      {/* "OS" accent */}
      <text x="136" y="23" fontFamily="system-ui,-apple-system,sans-serif"
        fontSize="16" fontWeight="800" fill="url(#sl_grad2)" letterSpacing="-0.4">
        OS
      </text>
    </svg>
  )
}

export default function Sidebar({ page, setPage, user, onLogout, isMobile, mobileOpen, setMobileOpen }) {
  const { t } = useTranslation()
  const { sidebarDefaultCollapsed } = useAppStore()
  const [collapsed, setCollapsed] = useState(sidebarDefaultCollapsed)
  const accentStore = useAppStore(s => s.accentColor)
  const color = user?.color || accentStore || "#4ade80"

  // On mobile: sidebar is always full width (240px) when open, hidden when closed
  const w = isMobile ? 240 : (collapsed ? 64 : 240)

  const NAV_GROUPS = [
    {
      labelKey: "nav_core",
      items: [
        { id: "dashboard", labelKey: "nav_dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
        { id: "fleet",     labelKey: "nav_fleet",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
        { id: "map",       labelKey: "nav_map",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
        { id: "sites",     labelKey: "nav_sites",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
        { id: "twin",         labelKey: "nav_twin",         icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="9" height="10" rx="1"/><rect x="13" y="7" width="9" height="10" rx="1"/><path d="M11 12h2"/><path d="M5 4v3m0 10v3m14-16v3m0 10v3"/></svg> },
        { id: "command_center",labelKey: "nav_command_center",icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/><path d="M12 7v1m0 4v1m-3-3h1m4 0h1"/></svg> },
      ]
    },
    {
      labelKey: "nav_energy",
      items: [
        { id: "battery",   labelKey: "nav_battery",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/></svg> },
        { id: "ev",        labelKey: "nav_ev",        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><polygon points="9 11 4 16 9 21 4 26"/><line x1="22" y1="10" x2="14" y2="10"/><line x1="18" y1="6" x2="18" y2="14"/></svg> },
        { id: "grid",      labelKey: "nav_grid",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
        { id: "carbon_credit", labelKey: "nav_carbon_credit", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M7 13s.5 3 5 3 5-3 5-3"/><path d="M9 9h.01M15 9h.01"/></svg> },
        { id: "carbon",    labelKey: "nav_carbon",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4"/><line x1="12" y1="8" x2="12" y2="4"/></svg> },
        { id: "vpp",       labelKey: "nav_vpp",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
        { id: "resilience", labelKey: "nav_resilience", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> },
      ]
    },
    {
      labelKey: "nav_markets",
      items: [
        { id: "trading",     labelKey: "nav_trading",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
        { id: "marketplace", labelKey: "nav_marketplace",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
        { id: "dispatch_copilot", labelKey: "nav_dispatch_copilot", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg> },
        { id: "autonomous",  labelKey: "nav_autonomous",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> },
        { id: "forecasting", labelKey: "nav_forecasting",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h2m16 0h2M12 2v2m0 16v2M5 5l1.5 1.5M17.5 5 16 6.5M5 19l1.5-1.5m11 1.5L16 17.5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg> },
        { id: "revenue_opt", labelKey: "nav_revenue_opt",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/><circle cx="19" cy="5" r="2"/></svg> },
        { id: "compliance",  labelKey: "nav_compliance",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
        { id: "solar_intel",  labelKey: "nav_solar_intel",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> },
        { id: "arbitrage",    labelKey: "nav_arbitrage",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/><line x1="1" y1="6" x2="8" y2="6"/><line x1="4" y1="3" x2="4" y2="9"/></svg> },
        { id: "degradation_lab", labelKey: "nav_degradation_lab", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 7H8L9 3z"/><path d="M8 10l-3 9a1 1 0 0 0 .95 1.35h12.1A1 1 0 0 0 19 19l-3-9"/><line x1="12" y1="3" x2="12" y2="10"/></svg> },
      ]
    },
    {
      labelKey: "nav_operations",
      items: [
        { id: "alerts",      labelKey: "nav_alerts",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
        { id: "anomaly",     labelKey: "nav_anomaly",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
        { id: "maintenance", labelKey: "nav_maintenance", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> },
        { id: "reports",     labelKey: "nav_reports",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
        { id: "investor",    labelKey: "nav_investor",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
        { id: "scorecard",   labelKey: "nav_scorecard",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/><path d="M15 15l-2 2 2 2"/></svg> },
      ]
    },
    {
      labelKey: "nav_admin",
      items: [
        { id: "users",     labelKey: "nav_users",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
        { id: "integrations", labelKey: "nav_integrations", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg> },
        { id: "settings",  labelKey: "nav_settings",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
        { id: "customer_portal", labelKey: "nav_customer_portal", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg> },
        { id: "whitelabel",labelKey: "nav_whitelabel",icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
        { id: "audit",     labelKey: "nav_audit",     icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg> },
        { id: "apikeys",   labelKey: "nav_apikeys",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> },
        { id: "export",    labelKey: "nav_export",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
      ]
    }
  ]

  // Collapsed is irrelevant on mobile (always show full sidebar)
  const showCollapsed = isMobile ? false : collapsed

  const sidebarStyle = isMobile ? {
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    width: "240px",
    zIndex: 300,
    transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
    transition: "transform 0.25s cubic-bezier(.4,0,.2,1)",
    background: "var(--sidebar)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  } : {
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
  }

  return (
    <aside style={sidebarStyle}>
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
        <VoltarisLogo collapsed={showCollapsed} />
        {!isMobile && (
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
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              background: "none", border: "none", color: "var(--sub)",
              cursor: "pointer", padding: "4px", borderRadius: "6px",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Company + role strip */}
      {!showCollapsed && (
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
            {!showCollapsed && (
              <div style={{
                padding: "8px 16px 4px", fontSize: "10px", fontWeight: "600",
                color: "var(--sub)", opacity: 0.6, textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap",
              }}>
                {t(group.labelKey)}
              </div>
            )}
            {showCollapsed && gi > 0 && (
              <div style={{ margin: "4px 12px", height: "1px", background: "var(--border)" }} />
            )}
            {group.items.map(item => {
              const active = page === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  title={showCollapsed ? t(item.labelKey) : ""}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: showCollapsed ? "10px 0" : "9px 12px",
                    justifyContent: showCollapsed ? "center" : "flex-start",
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
                  {!showCollapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t(item.labelKey)}</span>}
                  {active && !showCollapsed && (
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
          title={showCollapsed ? t("logout") : ""}
          style={{
            width: "100%", padding: "9px 12px",
            background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: "8px", color: "#f87171", cursor: "pointer", fontSize: "13px",
            display: "flex", alignItems: "center", gap: "8px",
            justifyContent: showCollapsed ? "center" : "flex-start", transition: "background 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.12)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.06)"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {!showCollapsed && <span>{t("logout")}</span>}
        </button>
      </div>
    </aside>
  )
}
