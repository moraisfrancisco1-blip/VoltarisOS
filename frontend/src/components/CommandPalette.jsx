import { useEffect, useState, useRef } from "react"
import { useAppStore } from "../store/appStore"

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", group: "Core", icon: "⊞" },
  { id: "sites", label: "Sites", group: "Core", icon: "📍" },
  { id: "map", label: "Map View", group: "Core", icon: "🗺" },
  { id: "fleet", label: "Fleet Management", group: "Core", icon: "🏭" },
  { id: "twin", label: "Digital Twin", group: "Core", icon: "🔁" },
  { id: "battery", label: "Battery BMS", group: "Energy", icon: "🔋" },
  { id: "ev", label: "EV Charging", group: "Energy", icon: "⚡" },
  { id: "grid", label: "Grid Services", group: "Energy", icon: "⚙" },
  { id: "carbon", label: "Carbon Dashboard", group: "Energy", icon: "🌱" },
  { id: "trading", label: "Trading", group: "Markets", icon: "📈" },
  { id: "autonomous", label: "AI Trading Agent", group: "Markets", icon: "🤖" },
  { id: "forecasting", label: "Forecasting", group: "Markets", icon: "☀" },
  { id: "alerts", label: "Alerts", group: "Operations", icon: "🔔" },
  { id: "maintenance", label: "Predictive Maintenance", group: "Operations", icon: "🔧" },
  { id: "reports", label: "Reports", group: "Operations", icon: "📄" },
  { id: "investor", label: "Investor View", group: "Operations", icon: "💰" },
  { id: "users", label: "User Management", group: "Admin", icon: "👥" },
  { id: "settings", label: "Settings", group: "Admin", icon: "⚙" },
  { id: "whitelabel", label: "White-label", group: "Admin", icon: "🎨" },
  { id: "audit", label: "Audit Log", group: "Admin", icon: "📋" },
  { id: "apikeys", label: "API Keys", group: "Admin", icon: "🔑" },
  { id: "export", label: "Export Center", group: "Admin", icon: "⬇" },
]

const ACTIONS = [
  { label: "Modo Simulação ON", action: "sim_on", group: "Ações", icon: "🧪" },
  { label: "Modo Simulação OFF", action: "sim_off", group: "Ações", icon: "🧪" },
  { label: "Tema Claro", action: "theme_light", group: "Ações", icon: "☀" },
  { label: "Tema Escuro", action: "theme_dark", group: "Ações", icon: "🌙" },
  { label: "Sair da conta", action: "logout", group: "Ações", icon: "🚪" },
]

export default function CommandPalette({ setPage, onLogout }) {
  const { cmdOpen, setCmdOpen, setSimMode, setTheme, addToast } = useAppStore()
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
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.group?.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 12)

  useEffect(() => setIdx(0), [query])

  const execute = (item) => {
    setCmdOpen(false)
    if (item.type === "page") {
      setPage(item.id)
    } else {
      if (item.action === "sim_on") { setSimMode(true); addToast("Modo Simulação ativado", "info") }
      if (item.action === "sim_off") { setSimMode(false); addToast("Modo Simulação desativado", "info") }
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
    if (!grouped[item.group]) grouped[item.group] = []
    grouped[item.group].push(item)
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pesquisar páginas e ações..."
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "white", fontSize: "16px", fontFamily: "inherit",
            }}
          />
          <kbd style={{
            padding: "2px 7px", background: "#1f2937", border: "1px solid #374151",
            borderRadius: "5px", fontSize: "11px", color: "#6b7280", fontFamily: "inherit",
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "400px", overflowY: "auto", padding: "8px 0" }}>
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div style={{
                padding: "8px 20px 4px",
                fontSize: "10px", fontWeight: "700",
                color: "#374151", textTransform: "uppercase", letterSpacing: "1px",
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
                      border: "none", color: isActive ? "white" : "#9ca3af",
                      cursor: "pointer", fontSize: "14px", textAlign: "left",
                      transition: "background 0.1s",
                    }}
                  >
                    <span style={{ fontSize: "16px", width: "20px", textAlign: "center" }}>{item.icon}</span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {isActive && (
                      <kbd style={{
                        padding: "2px 7px", background: "#0f1a2e", border: "1px solid #1e2d45",
                        borderRadius: "4px", fontSize: "11px", color: "#6b7280",
                      }}>↵</kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "32px", textAlign: "center", color: "#4b5563" }}>
              Nenhum resultado para "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid #1a2234",
          display: "flex", gap: "16px", alignItems: "center",
        }}>
          {[["↑↓", "navegar"], ["↵", "selecionar"], ["ESC", "fechar"]].map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <kbd style={{
                padding: "2px 6px", background: "#1f2937", border: "1px solid #374151",
                borderRadius: "4px", fontSize: "11px", color: "#9ca3af",
              }}>{k}</kbd>
              <span style={{ fontSize: "12px", color: "#4b5563" }}>{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
