import { useEffect } from "react"
import { useAppStore } from "../store/appStore"

const SHORTCUTS = [
  { section: "Navegação" },
  { key: "⌘K", desc: "Abrir Command Palette" },
  { key: "?", desc: "Mostrar atalhos de teclado" },
  { key: "ESC", desc: "Fechar modal / overlay" },
  { section: "Sistema" },
  { key: "⌘S", desc: "Guardar / exportar página atual" },
  { key: "⌘⇧D", desc: "Ativar Modo Demo" },
  { key: "⌘⇧L", desc: "Toggle tema claro/escuro" },
  { section: "Página" },
  { key: "G D", desc: "Ir para Dashboard" },
  { key: "G T", desc: "Ir para Trading" },
  { key: "G B", desc: "Ir para Battery BMS" },
  { key: "G A", desc: "Ir para Alerts" },
  { key: "G M", desc: "Ir para Map View" },
]

export default function ShortcutsOverlay() {
  const { shortcutsOpen, setShortcutsOpen } = useAppStore()

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
<<<<<<< HEAD
            <div style={{ color: "var(--text)", fontWeight: "700", fontSize: "16px" }}>Keyboard Shortcuts</div>
            <div style={{ color: "var(--sub)", fontSize: "12px", marginTop: "2px" }}>Atalhos disponíveis no VoltarisOS</div>
          </div>
          <button onClick={() => setShortcutsOpen(false)} style={{
            background: "#1f2937", border: "1px solid var(--sub)",
            borderRadius: "8px", color: "var(--sub)", cursor: "pointer",
=======
            <div style={{ color: "white", fontWeight: "700", fontSize: "16px" }}>Keyboard Shortcuts</div>
            <div style={{ color: "#4b5563", fontSize: "12px", marginTop: "2px" }}>Atalhos disponíveis no VoltarisOS</div>
          </div>
          <button onClick={() => setShortcutsOpen(false)} style={{
            background: "#1f2937", border: "1px solid #374151",
            borderRadius: "8px", color: "#9ca3af", cursor: "pointer",
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
            width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px",
          }}>×</button>
        </div>
        <div style={{ padding: "16px 24px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
          {SHORTCUTS.map((s, i) => {
            if (s.section) return (
              <div key={i} style={{
                gridColumn: "1 / -1",
<<<<<<< HEAD
                color: "var(--sub)", fontSize: "10px", fontWeight: "700",
=======
                color: "#374151", fontSize: "10px", fontWeight: "700",
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
                textTransform: "uppercase", letterSpacing: "1px",
                padding: "12px 0 6px",
                borderBottom: "1px solid #1a2234", marginBottom: "8px",
              }}>{s.section}</div>
            )
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "6px 0",
              }}>
<<<<<<< HEAD
                <span style={{ color: "var(--sub)", fontSize: "13px" }}>{s.desc}</span>
                <kbd style={{
                  padding: "3px 8px", background: "#1f2937", border: "1px solid var(--sub)",
                  borderRadius: "6px", fontSize: "11px", color: "var(--text)",
                  fontFamily: "monospace", WhiteSpace: "nowrap",
=======
                <span style={{ color: "#9ca3af", fontSize: "13px" }}>{s.desc}</span>
                <kbd style={{
                  padding: "3px 8px", background: "#1f2937", border: "1px solid #374151",
                  borderRadius: "6px", fontSize: "11px", color: "#d1d5db",
                  fontFamily: "monospace", whiteSpace: "nowrap",
>>>>>>> c5bb0cb20e7e6cd505ffff3dd17ecd3b896b1fa6
                }}>{s.key}</kbd>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
