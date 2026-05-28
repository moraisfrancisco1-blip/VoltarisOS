import { useState, useRef, useEffect } from "react"
import { useAppStore } from "../store/appStore"

const TYPE_ICONS = {
  alert: { icon: "🔋", color: "#f87171" },
  trade: { icon: "📈", color: "#4ade80" },
  maintenance: { icon: "🔧", color: "#f59e0b" },
  user: { icon: "👤", color: "#818cf8" },
  carbon: { icon: "🌱", color: "#34d399" },
}

export default function NotificationBell({ color = "#4ade80" }) {
  const { notifications, markAllRead, markRead } = useAppStore()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "relative",
          background: "none", border: "none", cursor: "pointer",
          color: "#6b7280", padding: "8px", borderRadius: "8px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#ffffff0a"; e.currentTarget.style.color = "#d1d5db" }}
        onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#6b7280" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: "4px", right: "4px",
            width: "16px", height: "16px", borderRadius: "50%",
            background: "#ef4444", color: "white",
            fontSize: "9px", fontWeight: "700",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #0a0f1a",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: "360px", background: "#111827",
          border: "1px solid #1e2d45", borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          zIndex: 1000, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px", borderBottom: "1px solid #1a2234",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "white", fontWeight: "600", fontSize: "14px" }}>Notificações</span>
              {unread > 0 && (
                <span style={{
                  padding: "1px 7px", background: "#ef444420", color: "#f87171",
                  borderRadius: "20px", fontSize: "11px", fontWeight: "600",
                }}>{unread} novas</span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: "none", border: "none", color: color, cursor: "pointer", fontSize: "12px" }}
              >Marcar todas lidas</button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: "380px", overflowY: "auto" }}>
            {notifications.map(n => {
              const ti = TYPE_ICONS[n.type] || TYPE_ICONS.alert
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: "12px",
                    padding: "14px 16px", background: n.read ? "none" : "#0f1e35",
                    border: "none", borderBottom: "1px solid #1a223440",
                    cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff06"}
                  onMouseLeave={e => e.currentTarget.style.background = n.read ? "none" : "#0f1e35"}
                >
                  <div style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: `${ti.color}15`, border: `1px solid ${ti.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", flexShrink: 0,
                  }}>{ti.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: n.read ? "#9ca3af" : "white", fontSize: "13px", fontWeight: n.read ? "400" : "600", marginBottom: "2px" }}>
                      {n.title}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "12px", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {n.body}
                    </div>
                    <div style={{ color: "#374151", fontSize: "11px" }}>{n.time}</div>
                  </div>
                  {!n.read && (
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, flexShrink: 0, marginTop: "6px" }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: "10px 16px", borderTop: "1px solid #1a2234" }}>
            <button style={{
              width: "100%", padding: "8px", background: "#0d1525",
              border: "1px solid #1a2234", borderRadius: "8px",
              color: "#6b7280", cursor: "pointer", fontSize: "12px",
              transition: "all 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1a2234"; e.currentTarget.style.color = "#9ca3af" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#0d1525"; e.currentTarget.style.color = "#6b7280" }}
            >Ver todas as notificações</button>
          </div>
        </div>
      )}
    </div>
  )
}
