import { useAppStore } from "../store/appStore"

const TYPE_COLORS = {
  info: { bg: "#1e2d45", border: "#2a4a7f", icon: "ℹ", iconColor: "#60a5fa" },
  success: { bg: "#0d2818", border: "#14532d", icon: "✓", iconColor: "#4ade80" },
  warning: { bg: "#2a1d00", border: "#78350f", icon: "⚠", iconColor: "#f59e0b" },
  error: { bg: "#2d0a0a", border: "#7f1d1d", icon: "✕", iconColor: "#f87171" },
}

export default function ToastContainer() {
  const { toasts, removeToast } = useAppStore()

  return (
    <div style={{
      position: "fixed", bottom: "90px", right: "24px",
      zIndex: 9990, display: "flex", flexDirection: "column", gap: "10px",
      pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const c = TYPE_COLORS[t.type] || TYPE_COLORS.info
        return (
          <div
            key={t.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex", alignItems: "center", gap: "10px",
              minWidth: "280px", maxWidth: "360px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              pointerEvents: "all",
              animation: "slideInRight 0.25s ease",
            }}
          >
            <span style={{ fontSize: "16px", color: c.iconColor, fontWeight: "bold", flexShrink: 0 }}>{c.icon}</span>
            <span style={{ flex: 1, color: "#e5e7eb", fontSize: "13px", lineHeight: "1.4" }}>{t.msg}</span>
            <button
              onClick={() => removeToast(t.id)}
              style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "16px", padding: "0 2px" }}
            >×</button>
          </div>
        )
      })}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
