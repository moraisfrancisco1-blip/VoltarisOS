import { useEffect, useState, useRef } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

const ALL_PAGES = [
  { id: "dashboard", labelKey: "page_dashboard", groupKey: "nav_core", icon: "⊞" },
  { id: "sites", labelKey: "page_sites", groupKey: "nav_core", icon: "📍" },
  { id: "map", labelKey: "page_map", groupKey: "nav_core", icon: "🗺" },
  { id: "fleet", labelKey: "page_fleet", groupKey: "nav_core", icon: "🏭" },
  { id: "twin", labelKey: "page_twin", groupKey: "nav_core", icon: "🔁" },
  { id: "battery", labelKey: "page_battery", groupKey: "nav_energy", icon: "🔋" },
  { id: "ev", labelKey: "page_ev", groupKey: "nav_energy", icon: "⚡" },
  { id: "grid", labelKey: "page_grid", groupKey: "nav_energy", icon: "⚙" },
  { id: "carbon", labelKey: "page_carbon", groupKey: "nav_energy", icon: "🌱" },
  { id: "trading", labelKey: "page_trading", groupKey: "nav_markets", icon: "📈" },
  { id: "autonomous", labelKey: "page_autonomous", groupKey: "nav_markets", icon: "🤖" },
  { id: "forecasting", labelKey: "page_forecasting", groupKey: "nav_markets", icon: "☀" },
  { id: "alerts", labelKey: "page_alerts", groupKey: "nav_operations", icon: "🔔" },
  { id: "maintenance", labelKey: "page_maintenance", groupKey: "nav_operations", icon: "🔧" },
  { id: "reports", labelKey: "page_reports", groupKey: "nav_operations", icon: "📄" },
  { id: "investor", labelKey: "page_investor", groupKey: "nav_operations", icon: "💰" },
  { id: "users", labelKey: "page_users", groupKey: "nav_admin", icon: "👥" },
  { id: "settings", labelKey: "page_settings", groupKey: "nav_admin", icon: "⚙" },
  { id: "whitelabel", labelKey: "page_whitelabel", groupKey: "nav_admin", icon: "🎨" },
  { id: "audit", labelKey: "page_audit", groupKey: "nav_admin", icon: "📋" },
  { id: "apikeys", labelKey: "page_apikeys", groupKey: "nav_admin", icon: "🔑" },
  { id: "export", labelKey: "page_export", groupKey: "nav_admin", icon: "⬇" },
]

const ACTIONS = [
  { labelKey: "cmd_action_sim_on", action: "sim_on", groupKey: "cmd_group_actions", icon: "🧪" },
  { labelKey: "cmd_action_sim_off", action: "sim_off", groupKey: "cmd_group_actions", icon: "🧪" },
  { labelKey: "cmd_action_theme_light", action: "theme_light", groupKey: "cmd_group_actions", icon: "☀" },
  { labelKey: "cmd_action_theme_dark", action: "theme_dark", groupKey: "cmd_group_actions", icon: "🌙" },
  { labelKey: "cmd_action_logout", action: "logout", groupKey: "cmd_group_actions", icon: "🚪" },
]

export default function CommandPalette({ setPage, onLogout }) {
  const { cmdOpen, setCmdOpen, setSimMode, setTheme, addToast } = useAppStore()
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCmdOpen(true)
      }
      if (e.key === "Escape") setCmdOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [setCmdOpen])

  useEffect(() => {
    if (cmdOpen) {
      setQuery("")
      setIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [cmdOpen])

  const allItems = [
    ...ALL_PAGES.map(p => ({ ...p, type: "page" })),
    ...ACTIONS.map(a => ({ ...a, type: "action" })),
  ]

  const filtered = query
    ? allItems.filter(i => t(i.labelKey).toLowerCase().includes(query.toLowerCase()) || t(i.groupKey)?.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 12)

  useEffect(() => setIdx(0), [query])

  const execute = (item) => {
    setCmdOpen(false)
    if (item.type === "page") {
      setPage(item.id)
    } else {
      if (item.action === "sim_on") { setSimMode(true); addToast(t("topbar_sim_on"), "info") }
      if (item.action === "sim_off") { setSimMode(false); addToast(t("sim_off_toast"), "info") }
      if (item.action === "theme_light") setTheme("light")
      if (item.action === "theme_dark") setTheme("dark")
      if (item.action === "logout") onLogout()
    }
  }

  const handleKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === "Enter" && filtered[idx]) execute(filtered[idx])
  }

  if (!cmdOpen) return null

  // Group items
  const grouped = {}
  filtered.forEach(item => {
    const g = t(item.groupKey)
    if (!grouped[g]) grouped[g] = []
    grouped[g].push(item)
  })

  let globalIdx = 0

  return (
    <div
      onClick={() => setCmdOpen(false)}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 9999, display: "flex", alignItems: "flex-start",
        justifyContent: "center", paddingTop: "15vh",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "560px", maxWidth: "90vw",
          background: "#111827",
          border: "1px solid #1e2d45",
          borderRadius: "16px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "16px 20px", borderBottom: "1px solid #1a2234",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sub)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t("cmd_placeholder")}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "var(--text)", fontSize: "16px", fontFamily: "inherit",
            }}
          />
          <kbd style={{
            padding: "2px 7px", background: "#1f2937", border: "1px solid var(--sub)",
            borderRadius: "5px", fontSize: "11px", color: "var(--sub)", fontFamily: "inherit",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "400px", overflowY: "auto", padding: "8px 0" }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{
                padding: "8px 20px 4px",
                fontSize: "10px", fontWeight: "700",
                color: "var(--sub)", textTransform: "uppercase", letterSpacing: "1px",
              }}>{group}</div>
              {items.map(item => {
                const isActive = globalIdx++ === idx
                return (
                  <button
                    key={item.id || item.action}
                    onClick={() => execute(item)}
                    onMouseEnter={() => {
                      // find global index
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 20px", background: isActive ? "#1e2d45" : "none",
                      border: "none", color: isActive ? "var(--text)" : "var(--sub)",
                      cursor: "pointer", fontSize: "14px", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                  >
                    <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
                    {isActive && (
                      <kbd style={{
                        padding: "2px 7px", background: "#0f1a2e", border: "1px solid #1e2d45",
                        borderRadius: "4px", fontSize: "11px", color: "var(--sub)",
                      }}>↵</kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: "var(--sub)" }}>
              {t("cmd_no_results")} "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid #1a2234",
          display: "flex", gap: "16px", alignItems: "center",
        }}>
          {[["↑↓", t("cmd_navigate")], ["↵", t("cmd_select")], ["ESC", t("cmd_close")]].map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <kbd style={{
                padding: "2px 6px", background: "#1f2937", border: "1px solid var(--sub)",
                borderRadius: "4px", fontSize: "11px", color: "var(--sub)",
              }}>{k}</kbd>
              <span style={{ fontSize: "12px", color: "var(--sub)" }}>{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
