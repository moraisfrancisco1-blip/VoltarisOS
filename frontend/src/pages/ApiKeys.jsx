import { useState } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  return "vos_" + Array.from({ length: 48 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export default function ApiKeys({ user }) {
  const { t } = useTranslation()
  const { addToast, addAuditEntry } = useAppStore()
  const color = user?.color || "#4ade80"

  const [keys, setKeys] = useState([
    { id: 1, name: "Integração SCADA", key: "vos_4aK9mPxQnBrLwTzYcEfHjVsGiUdOy3", scope: "read", created: "2026-01-15", lastUsed: "Hoje", active: true },
    { id: 2, name: "Dashboard Externo", key: "vos_7dRqNpWlKoAvBcXsSfTeGhIjUmZyE1", scope: "read,write", created: "2026-03-02", lastUsed: "Há 3 dias", active: true },
    { id: 3, name: "Webhook Alertas", key: "vos_1xCvBnMqWerTyUiOpAsD2fGhJkLzX", scope: "alerts", created: "2026-04-10", lastUsed: "Nunca", active: false },
  ])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newScope, setNewScope] = useState("read")
  const [revealed, setRevealed] = useState({})
  const [newKey, setNewKey] = useState(null)

  const createKey = () => {
    if (!newName.trim()) return
    const k = { id: Date.now(), name: newName, key: generateKey(), scope: newScope, created: new Date().toISOString().split("T")[0], lastUsed: "Nunca", active: true }
    setKeys(prev => [...prev, k])
    setNewKey(k.key)
    setShowCreate(false)
    setNewName("")
    addToast(`API Key "${newName}" ${t("created_success") || "created successfully"}`, "success")
    addAuditEntry({ user: user?.email || "admin@voltaris.com", action: "API Key created", resource: "API Keys" })
  }

  const revokeKey = (id) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, active: false } : k))
    addToast(t("api_key_revoked") || "API Key revoked", "warning")
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    addToast(t("copied_clipboard") || "Copied to clipboard", "success")
  }

  return (
    <div style={{ padding: "32px", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ color: "white", fontSize: "24px", fontWeight: "700", marginBottom: "6px" }}>API Keys</h1>
          <p style={{ color: "rgba(148,163,184,0.85)", fontSize: "14px" }}>{t("apikeys_sub") || "Access tokens to integrate external systems with VoltarisOS"}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "10px 20px",
            background: `linear-gradient(135deg, ${color}, #22d3ee)`,
            border: "none", borderRadius: "10px",
            color: "#0a0f1a", cursor: "pointer",
            fontWeight: "700", fontSize: "13px",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>+</span> Nova API Key
        </button>
      </div>

      {/* New key revealed */}
      {newKey && (
        <div style={{
          background: "#0d2818", border: "1px solid #14532d",
          borderRadius: "12px", padding: "18px 20px", marginBottom: "24px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "20px" }}>🔑</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#4ade80", fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>
              Nova key criada! Copia agora — não voltará a ser mostrada.
            </div>
            <code style={{ color: "#d1d5db", fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all" }}>{newKey}</code>
          </div>
          <button onClick={() => copyKey(newKey)} style={{
            padding: "8px 14px", background: "#4ade8020", border: "1px solid #4ade8040",
            borderRadius: "8px", color: "#4ade80", cursor: "pointer", fontSize: "12px", fontWeight: "600",
          }}>Copiar</button>
          <button onClick={() => setNewKey(null)} style={{
            background: "none", border: "none", color: "rgba(148,163,184,0.85)", cursor: "pointer", fontSize: "20px",
          }}>×</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "14px", padding: "24px", marginBottom: "24px",
        }}>
          <h3 style={{ color: "white", fontSize: "16px", fontWeight: "700", marginBottom: "20px" }}>{t("apikeys_create_new") || "Create new API Key"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={{ color: "rgba(148,163,184,0.85)", fontSize: "12px", display: "block", marginBottom: "6px" }}>{t("name") || "Name"} / {t("description") || "Description"}</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Integração InfluxDB"
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "white", fontSize: "14px",
                  outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = color}
                onBlur={e => e.target.style.borderColor = "#1e2d45"}
              />
            </div>
            <div>
              <label style={{ color: "rgba(148,163,184,0.85)", fontSize: "12px", display: "block", marginBottom: "6px" }}>{t("permissions") || "Permissions"}</label>
              <select
                value={newScope}
                onChange={e => setNewScope(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "white", fontSize: "14px",
                  outline: "none", boxSizing: "border-box",
                }}
              >
                <option value="read">Leitura</option>
                <option value="read,write">Leitura + Escrita</option>
                <option value="alerts">{t("perm_alerts_only") || "Alerts Only"}</option>
                <option value="trading">{t("perm_trading_only") || "Trading Only"}</option>
                <option value="full">{t("perm_full_access") || "Full Access"}</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowCreate(false)} style={{
              padding: "9px 18px", background: "#1f2937", border: "1px solid #374151",
              borderRadius: "8px", color: "rgba(148,163,184,0.85)", cursor: "pointer",
            }}>{t("cancel") || "Cancel"}</button>
            <button onClick={createKey} style={{
              padding: "9px 18px", background: color, border: "none",
              borderRadius: "8px", color: "#0a0f1a", cursor: "pointer", fontWeight: "700",
            }}>{t("apikeys_create_btn") || "Create Key"}</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {keys.map(k => (
          <div key={k.id} style={{
            background: "#1e293b", border: `1px solid ${k.active ? "#1a2234" : "#2d1515"}`,
            borderRadius: "14px", padding: "20px 24px",
            opacity: k.active ? 1 : 0.6,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: k.active ? `${color}15` : "#2d151520",
                  border: `1px solid ${k.active ? color + "30" : "#2d1515"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px",
                }}>🔑</div>
                <div>
                  <div style={{ color: "white", fontWeight: "600", fontSize: "14px" }}>{k.name}</div>
                  <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "12px", marginTop: "2px" }}>
                    Criado em {k.created} · Último uso: {k.lastUsed}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  padding: "3px 10px",
                  background: k.active ? `${color}15` : "#2d151520",
                  border: `1px solid ${k.active ? color + "30" : "#2d1515"}`,
                  borderRadius: "20px",
                  color: k.active ? color : "#f87171",
                  fontSize: "11px", fontWeight: "600",
                }}>{k.active ? "Ativa" : "Revogada"}</span>
                <span style={{
                  padding: "3px 10px", background: "#1e2d4520",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: "20px",
                  color: "#60a5fa", fontSize: "11px",
                }}>{k.scope}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <code style={{
                flex: 1, padding: "8px 14px", background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
                color: "rgba(148,163,184,0.85)", fontSize: "12px", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {revealed[k.id] ? k.key : k.key.slice(0, 12) + "•".repeat(20)}
              </code>
              <button
                onClick={() => setRevealed(r => ({ ...r, [k.id]: !r[k.id] }))}
                style={{
                  padding: "8px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "rgba(148,163,184,0.85)", cursor: "pointer", fontSize: "12px",
                }}
              >{revealed[k.id] ? "Ocultar" : "Revelar"}</button>
              <button
                onClick={() => copyKey(k.key)}
                style={{
                  padding: "8px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "rgba(148,163,184,0.85)", cursor: "pointer", fontSize: "12px",
                }}
              >Copiar</button>
              {k.active && (
                <button
                  onClick={() => revokeKey(k.id)}
                  style={{
                    padding: "8px 12px", background: "#2d0a0a", border: "1px solid #7f1d1d",
                    borderRadius: "8px", color: "#f87171", cursor: "pointer", fontSize: "12px",
                  }}
                >Revogar</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Docs note */}
      <div style={{
        marginTop: "24px", padding: "16px 20px",
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px",
      }}>
        <span style={{ fontSize: "20px" }}>📖</span>
        <div>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "13px", fontWeight: "600", marginBottom: "2px" }}>API Documentation</div>
          <div style={{ color: "rgba(148,163,184,0.85)", fontSize: "12px" }}>
            Usa o header <code style={{ color: "#60a5fa" }}>Authorization: Bearer vos_...</code> em todos os pedidos à API REST do VoltarisOS.
          </div>
        </div>
      </div>
    </div>
  )
}
