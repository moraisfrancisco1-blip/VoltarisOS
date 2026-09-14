import { useState, useEffect } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"

export default function ApiKeys({ user }) {
  const { t } = useTranslation()
  const { addToast } = useAppStore()
  const color = user?.color || "#4ade80"

  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [revealedKey, setRevealedKey] = useState(null) // { name, key } — shown once after create/rotate

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/api-keys")
      const data = await res.json()
      if (!res.ok) {
        setError(res.status === 403 ? t("apikeys_forbidden") : (data.detail || t("apikeys_load_error")))
        setKeys([])
        return
      }
      setKeys(data)
    } catch (e) {
      console.error(e)
      setError(t("apikeys_load_error"))
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only (see AuditLog.jsx for why t() must not be a dep)
  useEffect(() => { load() }, [])

  const createKey = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.detail || t("apikeys_load_error"), "error")
        return
      }
      setRevealedKey({ name: data.name, key: data.key })
      setShowCreate(false)
      setNewName("")
      addToast(`${t("apikeys_title")} "${data.name}" ${t("created_success") || "created successfully"}`, "success")
      load()
    } catch (e) {
      console.error(e)
      addToast(t("apikeys_load_error"), "error")
    } finally {
      setCreating(false)
    }
  }

  const revokeKey = async (k) => {
    setBusyId(k.id)
    try {
      const res = await fetch(`/api/api-keys/${k.id}`, { method: "DELETE" })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        addToast(data.detail || t("apikeys_load_error"), "error")
        return
      }
      addToast(t("api_key_revoked") || "API Key revoked", "warning")
      load()
    } catch (e) {
      console.error(e)
      addToast(t("apikeys_load_error"), "error")
    } finally {
      setBusyId(null)
    }
  }

  const rotateKey = async (k) => {
    setBusyId(k.id)
    try {
      const res = await fetch(`/api/api-keys/${k.id}/rotate`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        addToast(data.detail || t("apikeys_load_error"), "error")
        return
      }
      setRevealedKey({ name: data.name, key: data.key })
      addToast(t("apikeys_rotated") || "API Key rotated", "success")
      load()
    } catch (e) {
      console.error(e)
      addToast(t("apikeys_load_error"), "error")
    } finally {
      setBusyId(null)
    }
  }

  const copyKey = (key) => {
    navigator.clipboard.writeText(key)
    addToast(t("copied_clipboard") || "Copied to clipboard", "success")
  }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString() : t("apikeys_never")

  return (
    <div style={{ padding: "32px", maxWidth: "900px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <h1 style={{ color: "var(--text)", fontSize: "24px", fontWeight: "700", marginBottom: "6px" }}>{t("apikeys_title")}</h1>
          <p style={{ color: "var(--sub)", fontSize: "14px" }}>{t("apikeys_sub")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "10px 20px",
            background: `linear-gradient(135deg, ${color}, #22d3ee)`,
            border: "none", borderRadius: "10px",
            color: "var(--text)", cursor: "pointer",
            fontWeight: "700", fontSize: "13px",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          <span style={{ fontSize: "16px" }}>+</span> {t("apikeys_new")}
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", marginBottom: 20, background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: 10, color: "#f87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Newly created/rotated key revealed — plaintext is never retrievable again after this */}
      {revealedKey && (
        <div style={{
          background: "#0d2818", border: "1px solid #14532d",
          borderRadius: "12px", padding: "18px 20px", marginBottom: "24px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "20px" }}>🔑</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#4ade80", fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>
              {t("apikeys_new_created")}
            </div>
            <code style={{ color: "var(--text)", fontSize: "12px", fontFamily: "monospace", wordBreak: "break-all" }}>{revealedKey.key}</code>
          </div>
          <button onClick={() => copyKey(revealedKey.key)} style={{
            padding: "8px 14px", background: "#4ade8020", border: "1px solid #4ade8040",
            borderRadius: "8px", color: "#4ade80", cursor: "pointer", fontSize: "12px", fontWeight: "600",
          }}>{t("apikeys_copy")}</button>
          <button onClick={() => setRevealedKey(null)} style={{
            background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "20px",
          }}>×</button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div style={{
          background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "14px", padding: "24px", marginBottom: "24px",
        }}>
          <h3 style={{ color: "var(--text)", fontSize: "16px", fontWeight: "700", marginBottom: "20px" }}>{t("apikeys_create_new")}</h3>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ color: "var(--sub)", fontSize: "12px", display: "block", marginBottom: "6px" }}>{t("name") || "Name"}</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t("apikeys_placeholder")}
              style={{
                width: "100%", padding: "10px 14px",
                background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px", color: "var(--text)", fontSize: "14px",
                outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = color}
              onBlur={e => e.target.style.borderColor = "#1e2d45"}
            />
            <div style={{ color: "var(--sub)", fontSize: "11px", marginTop: "6px" }}>{t("apikeys_scope_note")}</div>
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button onClick={() => setShowCreate(false)} style={{
              padding: "9px 18px", background: "#1f2937", border: "1px solid var(--sub)",
              borderRadius: "8px", color: "var(--sub)", cursor: "pointer",
            }}>{t("cancel") || "Cancel"}</button>
            <button onClick={createKey} disabled={creating || !newName.trim()} style={{
              padding: "9px 18px", background: color, border: "none",
              borderRadius: "8px", color: "var(--text)", cursor: creating ? "not-allowed" : "pointer",
              fontWeight: "700", opacity: creating || !newName.trim() ? 0.6 : 1,
            }}>{creating ? t("loading") : t("apikeys_create_btn")}</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {loading && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--sub)" }}>{t("loading")}</div>
        )}
        {!loading && keys.length === 0 && !error && (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--sub)", background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
            {t("apikeys_empty") || "No API keys yet."}
          </div>
        )}
        {keys.map(k => (
          <div key={k.id} style={{
            background: "var(--surface)", border: "1px solid #1a2234",
            borderRadius: "14px", padding: "20px 24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: `${color}15`, border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px",
                }}>🔑</div>
                <div>
                  <div style={{ color: "var(--text)", fontWeight: "600", fontSize: "14px" }}>{k.name}</div>
                  <div style={{ color: "var(--sub)", fontSize: "12px", marginTop: "2px" }}>
                    {t("apikeys_created_on")} {fmtDate(k.created_at)} · {t("apikeys_last_used")}: {fmtDate(k.last_used_at)}
                  </div>
                </div>
              </div>
              <span style={{
                padding: "3px 10px", background: `${color}15`, border: `1px solid ${color}30`,
                borderRadius: "20px", color: color, fontSize: "11px", fontWeight: "600",
              }}>{t("apikeys_active")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <code style={{
                flex: 1, padding: "8px 14px", background: "var(--surface2)",
                border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px",
                color: "var(--sub)", fontSize: "12px", fontFamily: "monospace",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {k.key_prefix}{"•".repeat(20)}
              </code>
              <button
                onClick={() => rotateKey(k)}
                disabled={busyId === k.id}
                style={{
                  padding: "8px 12px", background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px", color: "var(--sub)", cursor: busyId === k.id ? "not-allowed" : "pointer", fontSize: "12px",
                  opacity: busyId === k.id ? 0.6 : 1,
                }}
              >{t("apikeys_rotate") || "Rotate"}</button>
              <button
                onClick={() => revokeKey(k)}
                disabled={busyId === k.id}
                style={{
                  padding: "8px 12px", background: "#2d0a0a", border: "1px solid #7f1d1d",
                  borderRadius: "8px", color: "#f87171", cursor: busyId === k.id ? "not-allowed" : "pointer", fontSize: "12px",
                  opacity: busyId === k.id ? 0.6 : 1,
                }}
              >{t("apikeys_revoke")}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Docs note */}
      <div style={{
        marginTop: "24px", padding: "16px 20px",
        background: "var(--surface2)", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px",
      }}>
        <span style={{ fontSize: "20px" }}>📖</span>
        <div>
          <div style={{ color: "var(--sub)", fontSize: "13px", fontWeight: "600", marginBottom: "2px" }}>{t("apikeys_docs")}</div>
          <div style={{ color: "var(--sub)", fontSize: "12px" }}>
            {t("apikeys_docs_pre")} <code style={{ color: "#60a5fa" }}>Authorization: Bearer vos_...</code> {t("apikeys_docs_post")}
          </div>
        </div>
      </div>
    </div>
  )
}
