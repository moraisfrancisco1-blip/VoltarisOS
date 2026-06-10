import { useState, useEffect, useRef } from "react"
import { useTranslation } from "../i18n/useTranslation"
import { useAppStore } from "../store/appStore"
import { LANGUAGES } from "../i18n/translations"
import axios from "axios"
import logoFull from "../logo_full.png"

function FloatingParticle({ style }) {
  return <div style={{ position: "absolute", borderRadius: "50%", pointerEvents: "none", ...style }} />
}


function LangSwitcher() {
  const { lang } = useTranslation()
  const setLanguage = useAppStore(s => s.setLanguage)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const current = LANGUAGES[lang] || LANGUAGES["pt"]

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px", padding: "6px 10px",
          cursor: "pointer", color: "rgba(255,255,255,0.7)",
          fontSize: "13px", fontWeight: "600",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.1)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
      >
        <span style={{ fontSize: "16px" }}>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#0f1a2e", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          zIndex: 100, minWidth: "150px",
        }}>
          {Object.values(LANGUAGES).map(l => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpen(false) }}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "10px 14px",
                background: l.code === lang ? "rgba(245,158,11,0.1)" : "transparent",
                border: "none", cursor: "pointer",
                color: l.code === lang ? "#f59e0b" : "rgba(255,255,255,0.7)",
                fontSize: "13px", fontWeight: l.code === lang ? "700" : "400",
                textAlign: "left", transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (l.code !== lang) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
              onMouseLeave={e => { if (l.code !== lang) e.currentTarget.style.background = "transparent" }}
            >
              <span style={{ fontSize: "18px" }}>{l.flag}</span>
              <span>{l.label}</span>
              {l.code === lang && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="3" style={{ marginLeft: "auto" }}>
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Login({ onLogin }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState({ email: "", password: "", company: "", color: "#4ade80", beta_code: "" })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  const handleSubmit = async () => {
    setLoading(true)
    setError("")
    try {
      if (mode === "login") {
        const res = await axios.post("/api/auth/login", { email: form.email, password: form.password })
        localStorage.setItem("token", res.data.token)
        localStorage.setItem("company", res.data.company)
        localStorage.setItem("color", res.data.color)
        onLogin(res.data)
      } else {
        await axios.post("/api/auth/register", {
          email: form.email,
          password: form.password,
          company: form.company,
          color: form.color,
          beta_code: form.beta_code,
        })
        setMode("login")
        setError(t("auth_account_created"))
      }
    } catch (e) {
      setError(e.response?.data?.detail || t("auth_invalid_creds"))
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === "Enter") handleSubmit() }

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 120% 80% at 50% -10%, #0d2040 0%, #050a14 50%, #0a0f1a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Ambient glow orbs */}
      <div style={{
        position: "absolute", width: "600px", height: "600px",
        borderRadius: "50%", top: "-200px", left: "-100px",
        background: "radial-gradient(circle, #4ade8008 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: "500px", height: "500px",
        borderRadius: "50%", bottom: "-150px", right: "-80px",
        background: "radial-gradient(circle, #22d3ee06 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Grid lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Floating particles */}
      {[
        { top: "15%", left: "8%", width: "4px", height: "4px", background: "#4ade8040", animation: "float1 6s ease-in-out infinite" },
        { top: "70%", left: "5%", width: "6px", height: "6px", background: "#22d3ee30", animation: "float2 8s ease-in-out infinite" },
        { top: "25%", right: "10%", width: "3px", height: "3px", background: "#818cf840", animation: "float1 7s ease-in-out infinite 1s" },
        { bottom: "20%", right: "8%", width: "5px", height: "5px", background: "#4ade8030", animation: "float2 5s ease-in-out infinite 2s" },
        { top: "45%", left: "15%", width: "2px", height: "2px", background: "#f59e0b50", animation: "float1 9s ease-in-out infinite 0.5s" },
      ].map((p, i) => <FloatingParticle key={i} style={p} />)}

      {/* Card */}
      <div style={{
        width: "440px", maxWidth: "90vw",
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "24px",
        boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(74,222,128,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>

        {/* Top gradient line */}
        <div style={{
          height: "3px",
          background: "linear-gradient(90deg, transparent, #f59e0b, #f97316, transparent)",
        }} />

        {/* Logo section */}
        <div style={{
          padding: "32px 36px 28px",
          display: "flex", flexDirection: "column", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ marginBottom: "20px" }}>
            <img src={logoFull} alt="VoltarisOS" style={{ height: "56px", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "4px" }}>
            <div style={{
              color: "rgba(255,255,255,0.85)", fontSize: "20px",
              fontWeight: "700", letterSpacing: "-0.3px",
            }}>
              {mode === "login" ? t("auth_welcome_back") : t("auth_create_account")}
            </div>
            <LangSwitcher />
          </div>
          <div style={{ color: "var(--sub)", fontSize: "13px" }}>
            {mode === "login" ? t("auth_subtitle_login") : t("auth_setup_ws")}
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 36px 32px" }}>

          {mode === "register" && (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "var(--sub)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
                  {t("auth_company_name")}
                </label>
                <input
                  placeholder="Ex: GreenVolt Energy"
                  value={form.company}
                  onChange={e => setForm({ ...form, company: e.target.value })}
                  onFocus={() => setFocused("company")}
                  onBlur={() => setFocused(null)}
                  style={inputStyle(focused === "company")}
                />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#4ade80", fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
                  🔑 Código Beta
                </label>
                <input
                  placeholder="Código de acesso"
                  value={form.beta_code}
                  onChange={e => setForm({ ...form, beta_code: e.target.value.toUpperCase() })}
                  onFocus={() => setFocused("beta_code")}
                  onBlur={() => setFocused(null)}
                  style={{ ...inputStyle(focused === "beta_code"), fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase" }}
                />
                <div style={{ fontSize: "11px", color: "#4ade8080", marginTop: "5px" }}>Acesso apenas por convite.</div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "var(--sub)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", textTransform: "uppercase" }}>
                  {t("auth_brand_color")}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    style={{ width: "48px", height: "40px", cursor: "pointer", border: "none", background: "none", borderRadius: "8px" }}
                  />
                  <div style={{
                    padding: "8px 14px", background: `${form.color}15`,
                    border: `1px solid ${form.color}40`, borderRadius: "8px",
                    color: form.color, fontSize: "13px", fontFamily: "monospace",
                  }}>{form.color}</div>
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ color: "var(--sub)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
              {t("auth_email")}
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused === "email" ? "#f59e0b" : "#374151"} strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <input
                type="email"
                placeholder="admin@voltaris.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
                style={{ ...inputStyle(focused === "email"), paddingLeft: "42px" }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{ color: "var(--sub)", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px", textTransform: "uppercase" }}>
              {t("auth_password")}
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused === "password" ? "#f59e0b" : "#374151"} strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
                style={{ ...inputStyle(focused === "password"), paddingLeft: "42px", paddingRight: "48px" }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: showPass ? "#f59e0b" : "#374151",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "4px", borderRadius: "6px", transition: "color 0.15s",
                }}
                title={showPass ? t("auth_hide_pass") : t("auth_show_pass")}
              >
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px", marginBottom: "16px",
              background: error.includes("created") || error.includes("criada") ? "#0d2818" : "#2d0a0a",
              border: `1px solid ${error.includes("created") || error.includes("criada") ? "#14532d" : "#7f1d1d"}`,
              borderRadius: "8px",
              color: error.includes("created") || error.includes("criada") ? "#4ade80" : "#f87171",
              fontSize: "13px",
            }}>{error}</div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading
                ? "#1f2937"
                : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              border: "none", borderRadius: "12px",
              color: loading ? "#4b5563" : "#0a0f1a",
              fontWeight: "800", fontSize: "15px",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "20px",
              boxShadow: loading ? "none" : "0 4px 24px rgba(245,158,11,0.3)",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              letterSpacing: "0.3px",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 6px 32px rgba(245,158,11,0.5)" }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 24px rgba(245,158,11,0.3)" }}
          >
            {loading ? (
              <>
                <span style={{
                  width: "16px", height: "16px",
                  border: "2px solid #374151",
                  borderTopColor: "#f59e0b",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                  display: "inline-block",
                }} />
                {t("auth_authenticating")}
              </>
            ) : (
              mode === "login" ? t("auth_enter") : t("auth_register")
            )}
          </button>

          {/* Mode switch */}
          <div style={{ textAlign: "center" }}>
            <span style={{ color: "var(--sub)", fontSize: "13px" }}>
              {mode === "login" ? t("auth_no_account") + " " : t("auth_have_account") + " "}
            </span>
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
              style={{
                background: "none", border: "none", color: "#f59e0b",
                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                textDecoration: "underline",
              }}
            >
              {mode === "login" ? t("auth_register_link") : t("auth_login_link")}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 36px 20px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#f59e0b",
            boxShadow: "0 0 6px #f59e0b",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <span style={{ color: "var(--sub)", fontSize: "11px" }}>VoltarisOS v2.0 · {t("auth_system_label")}</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) }
          50% { transform: translateY(-12px) }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) }
          50% { transform: translateY(10px) }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #f59e0b }
          50% { opacity: 0.5; box-shadow: 0 0 12px #f59e0b }
        }
      `}</style>
    </div>
  )
}

function inputStyle(active) {
  return {
    width: "100%",
    padding: "12px 14px",
    background: active ? "rgba(245,158,11,0.04)" : "var(--surface2)",
    border: `1px solid ${active ? "rgba(245,158,11,0.4)" : "var(--surface2)"}`,
    borderRadius: "10px",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s",
    fontFamily: "inherit",
    boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.08)" : "none",
  }
}
