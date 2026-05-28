import { useState } from "react"
import { useAppStore } from "../store/appStore"

const ACTION_COLORS = {
  "Login": "#4ade80",
  "Logout": "#f87171",
  "Criou utilizador": "#818cf8",
  "Exportou relatório": "#22d3ee",
  "Alterou white-label": "#f59e0b",
  "Trading agent ativado": "#a78bfa",
  "Alterou settings": "#6b7280",
  "Apagou site": "#f87171",
  "Criou site": "#4ade80",
  "API Key gerada": "#f59e0b",
}

function fmt(iso) {
  const d = new Date(iso)
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function AuditLog({ user }) {
  const { auditLog, addAuditEntry } = useAppStore()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")

  const filtered = auditLog.filter(e => {
    const q = search.toLowerCase()
    const match = !q || e.user.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) || e.resource.toLowerCase().includes(q)
    return match
  })

  const color = user?.color || "#4ade80"

  return (
    <div style={{ padding: "32px", maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ color: "white", fontSize: "24px", fontWeight: "700", marginBottom: "6px" }}>Audit Log</h1>
        <p style={{ color: "#4b5563", fontSize: "14px" }}>Registo completo de todas as ações realizadas no sistema</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Total de eventos", value: auditLog.length, color: "#818cf8" },
          { label: "Hoje", value: auditLog.filter(e => new Date(e.time).toDateString() === new Date().toDateString()).length, color: color },
          { label: "Utilizadores ativos", value: [...new Set(auditLog.map(e => e.user))].length, color: "#22d3ee" },
          { label: "IPs únicos", value: [...new Set(auditLog.map(e => e.ip))].length, color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} style={{
            background: "#111827", border: "1px solid #1a2234",
            borderRadius: "12px", padding: "18px 20px",
          }}>
            <div style={{ color: s.color, fontSize: "24px", fontWeight: "700" }}>{s.value}</div>
            <div style={{ color: "#4b5563", fontSize: "12px", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "20px", display: "flex", gap: "12px", alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"
            style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            placeholder="Pesquisar por utilizador, ação, recurso..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px 10px 38px",
              background: "#111827", border: "1px solid #1a2234",
              borderRadius: "10px", color: "white", fontSize: "14px",
              outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e => e.target.style.borderColor = "#1a2234"}
          />
        </div>
        <button
          onClick={() => addAuditEntry({ user: user?.email || "admin@voltaris.com", action: "Exportou audit log", resource: "Audit" })}
          style={{
            padding: "10px 18px", background: `${color}15`,
            border: `1px solid ${color}30`, borderRadius: "10px",
            color: color, cursor: "pointer", fontSize: "13px", fontWeight: "600",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#111827", border: "1px solid #1a2234", borderRadius: "14px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a2234" }}>
              {["Timestamp", "Utilizador", "Ação", "Recurso", "IP"].map(h => (
                <th key={h} style={{
                  padding: "12px 16px", textAlign: "left",
                  color: "#374151", fontSize: "11px", fontWeight: "700",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry, i) => {
              const ac = ACTION_COLORS[entry.action] || "#6b7280"
              return (
                <tr
                  key={entry.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid #1a223430" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff04"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: "12px", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {fmt(entry.time)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "24px", height: "24px", borderRadius: "50%",
                        background: `${color}20`, border: `1px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: "700", color: color, flexShrink: 0,
                      }}>{entry.user.charAt(0).toUpperCase()}</div>
                      <span style={{ color: "#9ca3af", fontSize: "13px" }}>{entry.user}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "3px 10px",
                      background: `${ac}18`, border: `1px solid ${ac}30`,
                      borderRadius: "20px", color: ac, fontSize: "12px", fontWeight: "600",
                    }}>{entry.action}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: "13px" }}>{entry.resource}</td>
                  <td style={{ padding: "12px 16px", color: "#374151", fontSize: "12px", fontFamily: "monospace" }}>{entry.ip}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#374151" }}>
            Nenhum evento encontrado
          </div>
        )}
      </div>
    </div>
  )
}
