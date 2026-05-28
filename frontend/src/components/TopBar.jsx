import { useState } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"
import { LANGUAGES } from "../i18n/translations"
import NotificationBell from "./NotificationBell"

const PAGE_TITLE_KEYS = {
  dashboard: "page_dashboard", sites: "page_sites", fleet: "page_fleet",
  trading: "page_trading", battery: "page_battery", ev: "page_ev",
  grid: "page_grid", forecasting: "page_forecasting", map: "page_map",
  alerts: "page_alerts", reports: "page_reports",
  users: "page_users", investor: "page_investor", settings: "page_settings",
  carbon: "page_carbon", autonomous: "page_autonomous",
  twin: "page_twin", maintenance: "page_maintenance",
  whitelabel: "page_whitelabel", audit: "page_audit", apikeys: "page_apikeys", export: "page_export",
}

export default function TopBar({ page, user }) {
  const { theme, setTheme, simMode, setSimMode, setCmdOpen, addToast, language, setLanguage, accentColor } = useAppStore()
  const { t } = useTranslation()
  const color = user?.color || accentColor || "#4ade80"
  const [langOpen, setLangOpen] = useState(false)

  return (
    <div style={{
      height: "56px",
      background: "var(--topbar, var(--sidebar))",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: "10px",
      position: "sticky", top: 0, zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Page title */}
      <div style={{ flex: 1 }}>
        <span style={{ color: "var(--text)", fontWeight: "600", fontSize: "15px" }}>
          {t(PAGE_TITLE_KEYS[page] || "page_dashboard")}
        </span>
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setCmdOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "7px 14px", background: "var(--surface2)",
          border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--sub)", cursor: "pointer", fontSize: "13px",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--sub)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span>{t("topbar_search")}</span>
        <kbd style={{ padding: "1px 6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", fontSize: "10px", color: "var(--sub)" }}>⌘K</kbd>
      </button>

      {/* Sim mode toggle */}
      <button
        onClick={() => { setSimMode(!simMode); addToast(simMode ? t("topbar_sim_off") : t("topbar_sim_on"), "info") }}
        title={simMode ? "Desativar simulação" : "Ativar simulação"}
        style={{
          padding: "7px 12px",
          background: simMode ? "#78350f30" : "var(--surface2)",
          border: simMode ? "1px solid #f59e0b44" : "1px solid var(--border)",
          borderRadius: "8px", color: simMode ? "#f59e0b" : "var(--sub)",
          cursor: "pointer", fontSize: "12px", fontWeight: "600",
          transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px",
        }}
      >
        <span>🧪</span>
        <span>SIM</span>
      </button>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={t("app_theme")}
        style={{
          background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--sub)", cursor: "pointer", width: "36px", height: "36px",
          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", fontSize: "16px",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)" }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--sub)" }}
      >
        {theme === "dark" ? "☀" : "🌙"}
      </button>

      {/* Language selector */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setLangOpen(!langOpen)}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
            color: "var(--sub)", cursor: "pointer", padding: "6px 10px", height: "36px",
            display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border-strong)" }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)" }}
        >
          <span style={{ fontSize: "15px" }}>{LANGUAGES[language]?.flag}</span>
          <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{language}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {langOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setLangOpen(false)} />
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)",
              background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: "10px",
              minWidth: "160px", zIndex: 999, overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              backdropFilter: "blur(12px)",
            }}>
              {Object.entries(LANGUAGES).map(([code, lang]) => (
                <button
                  key={code}
                  onClick={() => { setLanguage(code); setLangOpen(false); addToast(`${lang.flag} ${lang.label}`, "info") }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", background: language === code ? `${color}14` : "none",
                    border: "none", color: language === code ? color : "var(--sub)",
                    cursor: "pointer", fontSize: "13px", fontWeight: language === code ? "600" : "400",
                    textAlign: "left", transition: "background 0.1s",
                    borderLeft: language === code ? `2px solid ${color}` : "2px solid transparent",
                  }}
                  onMouseEnter={e => { if (language !== code) { e.currentTarget.style.background = "var(--surface)" } }}
                  onMouseLeave={e => { if (language !== code) { e.currentTarget.style.background = "none" } }}
                >
                  <span style={{ fontSize: "16px" }}>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Notifications */}
      <NotificationBell color={color} />

      {/* User pill */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "5px 10px", background: "var(--surface2)",
        border: "1px solid var(--border)", borderRadius: "8px",
      }}>
        <div style={{
          width: "24px", height: "24px", borderRadius: "50%",
          background: `${color}25`, border: `1px solid ${color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: "700", color: color,
        }}>
          {(user?.company || "V").charAt(0).toUpperCase()}
        </div>
        <span style={{ color: "var(--sub)", fontSize: "12px", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.company || "Admin"}
        </span>
      </div>
    </div>
  )
}
