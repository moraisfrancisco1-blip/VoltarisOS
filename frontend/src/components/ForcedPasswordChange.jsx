// Forced password change — first login with a temporary password.
//
// Rendered by the login page right after authenticating with a temporary
// password, and by App.jsx for a session that still carries the flag (e.g.
// after a refresh). It is not dismissible: the backend blocks every platform
// route while `must_change_password` is set, so the only ways forward are
// changing the password or signing out.
import { useState } from "react"
import axios from "axios"
import { useTranslation } from "../i18n/useTranslation"

const inputStyle = {
  width: "100%", padding: "12px 14px", background: "var(--surface2)",
  border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10,
  color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
}

export default function ForcedPasswordChange({ onDone, onCancel }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError("")
    if (next.length < 8) { setError(t("pw_gate_short")); return }
    if (next !== confirm) { setError(t("pw_gate_mismatch")); return }
    setLoading(true)
    try {
      const res = await axios.post("/api/auth/change-password", {
        current_password: current,
        new_password: next,
      })
      // The backend returns a token without the must_change_password claim.
      if (res.data && res.data.token) localStorage.setItem("token", res.data.token)
      localStorage.removeItem("must_change_password")
      if (onDone) onDone()
    } catch (e) {
      setError(e.response?.data?.detail || t("pw_gate_error"))
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e) => { if (e.key === "Enter" && !loading) submit() }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(5,10,20,0.92)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div
        data-testid="forced-password-change"
        style={{
          width: 460, maxWidth: "94vw",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 16, padding: 28,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
          {t("pw_gate_title")}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.5, color: "var(--sub)" }}>
          {t("pw_gate_intro")}
        </p>

        <div style={{ fontSize: 12, color: "var(--sub)", marginBottom: 6 }}>{t("pw_gate_current")} *</div>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} onKeyDown={onKey} style={inputStyle} autoFocus />

        <div style={{ fontSize: 12, color: "var(--sub)", margin: "14px 0 6px" }}>{t("pw_gate_new")} *</div>
        <input type="password" value={next} onChange={e => setNext(e.target.value)} onKeyDown={onKey} style={inputStyle} />

        <div style={{ fontSize: 12, color: "var(--sub)", margin: "14px 0 6px" }}>{t("pw_gate_confirm")} *</div>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={onKey} style={inputStyle} />

        {error && (
          <div style={{
            marginTop: 14, padding: 10, borderRadius: 8, fontSize: 12,
            background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#f87171",
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: "10px 18px", background: "none", border: "1px solid var(--border)",
                borderRadius: 10, color: "var(--sub)", cursor: "pointer", fontSize: 13,
              }}
            >
              {t("pw_gate_cancel")}
            </button>
          )}
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: "10px 22px", border: "none", borderRadius: 10,
              background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              color: "#0a0f1a", fontSize: 13, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            {t("pw_gate_submit")}
          </button>
        </div>
      </div>
    </div>
  )
}
