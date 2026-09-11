import { useEffect } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

const SHORTCUTS = [
  { sectionKey: "shortcuts_sec_nav" },
  { key: "⌘K", descKey: "shortcuts_open_cmd" },
  { key: "?", descKey: "shortcuts_show" },
  { key: "ESC", descKey: "shortcuts_close_modal" },
  { sectionKey: "shortcuts_sec_system" },
  { key: "⌘S", descKey: "shortcuts_save" },
  { key: "⌘⇧D", descKey: "shortcuts_demo" },
  { key: "⌘⇧L", descKey: "shortcuts_toggle_theme" },
  { sectionKey: "shortcuts_sec_page" },
  { key: "G D", descKey: "shortcuts_go_dashboard" },
  { key: "G T", descKey: "shortcuts_go_trading" },
  { key: "G B", descKey: "shortcuts_go_battery" },
  { key: "G A", descKey: "shortcuts_go_alerts" },
  { key: "G M", descKey: "shortcuts_go_map" },
]

export default function ShortcutsOverlay() {
  const { shortcutsOpen, setShortcutsOpen } = useAppStore()
  const { t } = useTranslation()

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
      if (e.key === "Escape") setShortcutsOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [setShortcutsOpen])

  if (!shortcutsOpen) return null

  return (
    <div
      onClick={() => setShortcutsOpen(false)}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
        zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "500px", maxWidth: "90vw",
          background: "#111827", border: "1px solid #1e2d45",
          borderRadius: "16px",
          boxShadow: "0 25px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        <div style={{
          padding: "20px 24px 16px", borderBottom: "1px solid #1a2234",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ color: "var(--text)", fontWeight: "700", fontSize: "16px" }}>{t("shortcuts_title")}</div>
            <div style={{ color: "var(--sub)", fontSize: "12px", marginTop: "2px" }}>{t("shortcuts_sub")}</div>
          </div>
          <button onClick={() => setShortcutsOpen(false)} style={{
            background: "#1f2937", border: "1px solid var(--sub)",
            borderRadius: "8px", color: "var(--sub)", cursor: "pointer",
            width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>×</button>
        </div>
        <div style={{ padding: "16px 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          {SHORTCUTS.map((s, i) => {
            if (s.sectionKey) return (
              <div key={i} style={{
                gridColumn: "1 / -1",
                color: "var(--sub)", fontSize: "10px", fontWeight: "700",
                textTransform: "uppercase", letterSpacing: "1px",
                padding: "12px 0 6px",
                borderBottom: "1px solid #1a2234", marginBottom: "8px",
              }}>{t(s.sectionKey)}</div>
            )
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 0",
              }}>
                <span style={{ color: "var(--sub)", fontSize: "13px" }}>{t(s.descKey)}</span>
                <kbd style={{
                  padding: "3px 8px", background: "#1f2937", border: "1px solid var(--sub)",
                  borderRadius: "6px", fontSize: "11px", color: "var(--text)",
                  fontFamily: "monospace", whiteSpace: "nowrap",
                }}>{s.key}</kbd>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
