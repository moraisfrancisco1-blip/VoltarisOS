import { useState, useEffect, useRef } from "react"
import { useTranslation } from "../i18n/useTranslation"
import { useAppStore } from "../store/appStore"
import { LANGUAGES } from "../i18n/translations"
import { PLAN_NAMES, PLAN_PRICES, PLAN_DESCRIPTIONS, PLAN_MAX_SITES, PLAN_TIER_ORDER } from "../config/planFeatureGates"
import axios from "axios"
import logoFull from "../logo_full.png"

// ─── Preset brand color swatches ──────────────────────────────────────────
const BRAND_SWATCHES = [
  "#4ade80", // Green
  "#22d3ee", // Cyan
  "#818cf8", // Indigo
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#a855f7", // Purple
  "#f472b6", // Pink
  "#34d399", // Emerald
  "#14b8a6", // Teal
]

// ─── Simple lock icon SVG ─────────────────────────────────────────────────
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  )
}

// ─── Terms of Use modal ───────────────────────────────────────────────────
function TermsModal({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(5,10,20,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "560px", maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto",
          background: "#0a0f1a", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px", padding: "28px 30px", color: "rgba(255,255,255,0.85)",
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontSize: "16px", color: "#f59e0b" }}>Termos de Uso — VoltarisOS</h3>
        <div style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>
          <p>Ao criar conta e utilizar o VoltarisOS ("Software") aceita, de forma vinculativa, que:</p>
          <ul style={{ paddingLeft: "18px" }}>
            <li>O Software, incluindo código-fonte, algoritmos, interfaces e documentação, é propriedade exclusiva de VoltarisOS e protegido por direitos de autor (Diretiva 2009/24/CE, Convenção de Berna, TRIPS).</li>
            <li>É <strong>expressamente proibido</strong>: copiar, distribuir, modificar, fazer engenharia reversa, descompilar, desmontar ou tentar extrair a lógica/algoritmos do Software.</li>
            <li>O Software contém segredos comerciais confidenciais — não pode divulgar, partilhar ou reutilizar essa informação para fins não autorizados, mesmo tendo acesso legítimo em fase de teste (beta).</li>
            <li>O acesso concedido durante o período beta é revogável a qualquer momento e não confere qualquer direito de propriedade ou licença permanente.</li>
            <li>Qualquer violação destes termos pode resultar em revogação imediata de acesso e responsabilização civil.</li>
          </ul>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px" }}>Texto integral: Licença de Software Proprietário VoltarisOS (documento legal completo disponível mediante pedido).</p>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: "18px", width: "100%", padding: "11px",
            background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
            border: "none", borderRadius: "10px", color: "#0a0f1a",
            fontWeight: "700", fontSize: "13px", cursor: "pointer",
          }}
        >Fechar</button>
      </div>
    </div>
  )
}

// ─── Language Switcher (positioned absolutely on right panel) ─────────────
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
          background: "rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: "8px", padding: "6px 12px",
          cursor: "pointer", color: "rgba(0,0,0,0.55)",
          fontSize: "13px", fontWeight: "600",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.07)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
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
          background: "#fff", border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: "10px", overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 100, minWidth: "150px",
        }}>
          {Object.values(LANGUAGES).map(l => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpen(false) }}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                width: "100%", padding: "10px 14px",
                background: l.code === lang ? "rgba(245,158,11,0.08)" : "transparent",
                border: "none", cursor: "pointer",
                color: l.code === lang ? "#d97706" : "rgba(0,0,0,0.65)",
                fontSize: "13px", fontWeight: l.code === lang ? "700" : "400",
                textAlign: "left", transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (l.code !== lang) e.currentTarget.style.background = "rgba(0,0,0,0.04)" }}
              onMouseLeave={e => { if (l.code !== lang) e.currentTarget.style.background = "transparent" }}
            >
              <span style={{ fontSize: "18px" }}>{l.flag}</span>
              <span>{l.label}</span>
              {l.code === lang && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="3" style={{ marginLeft: "auto" }}>
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

// ─── Login mode wrapper (split is only for register) ──────────────────────
function LoginForm({ form, setForm, focused, setFocused, showPass, setShowPass, error, loading, handleSubmit, handleKey, mode, setMode, setError, t }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 120% 80% at 50% -10%, #0d2040 0%, #050a14 50%, #0a0f1a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div style={{
        width: "420px", maxWidth: "90vw",
        background: "var(--surface)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "24px",
        boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(74,222,128,0.04)",
        backdropFilter: "blur(20px)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg, transparent, #f59e0b, #f97316, transparent)" }} />

        <div style={{ padding: "32px 34px 24px", display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ marginBottom: "16px" }}>
            <img src={logoFull} alt="VoltarisOS" style={{ height: "48px", objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "2px" }}>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: "18px", fontWeight: "700", letterSpacing: "-0.3px" }}>
              {t("auth_welcome_back")}
            </div>
            <LangSwitcher />
          </div>
          <div style={{ color: "var(--sub)", fontSize: "12.5px" }}>{t("auth_subtitle_login")}</div>
        </div>

        <div style={{ padding: "24px 34px 28px" }}>
          <div style={{ marginBottom: "18px" }}>
            <label style={{ color: "var(--sub)", fontSize: "11px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{t("auth_email")}</label>
            <input type="email" placeholder="admin@voltaris.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onFocus={() => setFocused("email")} onBlur={() => setFocused(null)} onKeyDown={handleKey}
              style={{ ...inputDarkStyle(focused === "email"), paddingLeft: "14px" }} />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ color: "var(--sub)", fontSize: "11px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.5px", textTransform: "uppercase" }}>{t("auth_password")}</label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} placeholder="••••••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} onKeyDown={handleKey}
                style={{ ...inputDarkStyle(focused === "password"), paddingRight: "44px" }} />
              <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: showPass ? "#f59e0b" : "var(--sub)", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px" }}>
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "10px 14px", marginBottom: "16px", background: "#2d0a0a", border: "1px solid #7f1d1d", borderRadius: "8px", color: "#f87171", fontSize: "13px" }}>{error}</div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#1f2937" : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              border: "none", borderRadius: "12px", color: loading ? "var(--sub)" : "#0a0f1a",
              fontWeight: "800", fontSize: "14px", cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "18px", boxShadow: loading ? "none" : "0 4px 24px rgba(245,158,11,0.3)",
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              letterSpacing: "0.3px",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 6px 32px rgba(245,158,11,0.5)" }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 24px rgba(245,158,11,0.3)" }}
          >
            {loading ? <><span style={{ width: "15px", height: "15px", border: "2px solid var(--sub)", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />{t("auth_authenticating")}</> : t("auth_enter")}
          </button>

          <div style={{ textAlign: "center" }}>
            <span style={{ color: "var(--sub)", fontSize: "12.5px" }}>{t("auth_no_account")} </span>
            <button onClick={() => { setMode("register"); setError("") }} style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", fontSize: "12.5px", fontWeight: "600", textDecoration: "underline" }}>{t("auth_register_link")}</button>
          </div>
        </div>

        <div style={{ padding: "12px 34px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f59e0b", boxShadow: "0 0 6px #f59e0b", animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ color: "var(--sub)", fontSize: "11px" }}>VoltarisOS v2.0 · {t("auth_system_label")}</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 6px #f59e0b } 50% { opacity: 0.5; box-shadow: 0 0 12px #f59e0b } }
      `}</style>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────
export default function Login({ onLogin }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState({ email: "", password: "", company: "", color: "#f59e0b", beta_code: "", role: "TENANT_MEMBER", plan: "" })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [inviteValidating, setInviteValidating] = useState(false)
  const [inviteResult, setInviteResult] = useState(null) // { valid, tier, label, roles, max_sites, modules }
  const [inviteError, setInviteError] = useState("")

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
        if (res.data.allowed_modules) {
          localStorage.setItem("allowed_modules", JSON.stringify(res.data.allowed_modules))
        }
        onLogin(res.data)
      } else {
        if (!termsAccepted) {
          setError("Tens de aceitar os Termos de Uso para criar conta.")
          setLoading(false)
          return
        }
        // If no valid beta code, plan is mandatory
        if (!inviteResult && !form.plan) {
          setError("Seleciona um plano de subscrição para continuar.")
          setLoading(false)
          return
        }
        await axios.post("/api/auth/register", {
          email: form.email,
          password: form.password,
          company: form.company,
          color: form.color,
          beta_code: form.beta_code,
          terms_accepted: termsAccepted,
          role: form.role,
          plan: inviteResult ? "" : form.plan,
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

  // ── Validate invite code asynchronously ──────────────────────────────────
  const validateInviteCode = async (code) => {
    if (!code || code.length < 3) {
      setInviteResult(null)
      setInviteError("")
      return
    }
    setInviteValidating(true)
    setInviteError("")
    setInviteResult(null)
    try {
      const res = await axios.get(`/api/auth/validate-invite-code`, { params: { code } })
      setInviteResult(res.data)
      if (res.data.roles && res.data.roles.length > 0) {
        setForm(f => ({ ...f, role: res.data.roles[0] }))
      }
    } catch (e) {
      setInviteError(e.response?.data?.detail || "Código inválido")
      setInviteResult(null)
    } finally {
      setInviteValidating(false)
    }
  }

  const handleBetaCodeChange = (value) => {
    const upper = value.toUpperCase()
    setForm({ ...form, beta_code: upper })
    if (window._betaTimer) clearTimeout(window._betaTimer)
    window._betaTimer = setTimeout(() => validateInviteCode(upper), 500)
  }

  // Login mode — unchanged dark card layout
  if (mode === "login") {
    return (
      <LoginForm
        form={form} setForm={setForm} focused={focused} setFocused={setFocused}
        showPass={showPass} setShowPass={setShowPass} error={error} loading={loading}
        handleSubmit={handleSubmit} handleKey={handleKey} mode={mode} setMode={setMode}
        setError={setError} t={t}
      />
    )
  }

  // ─── Register mode — split screen ────────────────────────────────────────
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setTimeout(() => setMounted(true), 50) }, [])

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* ═══════════════════ LEFT PANEL — Dark Brand ═══════════════════ */}
      <div style={{
        width: "50%", minHeight: "100vh",
        background: "radial-gradient(ellipse 100% 80% at 30% 50%, #0d2040 0%, #050a14 60%, #0a0f1a 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
        padding: "60px 40px",
      }}>
        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.03,
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        {/* Glow orb */}
        <div style={{
          position: "absolute", width: "500px", height: "500px", borderRadius: "50%",
          top: "20%", left: "-10%",
          background: "radial-gradient(circle, #f59e0b0a 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s",
        }}>
          {/* Logo */}
          <img src={logoFull} alt="VoltarisOS" style={{
            height: "72px", objectFit: "contain", marginBottom: "32px",
            filter: "drop-shadow(0 0 20px rgba(245,158,11,0.15))",
          }} />

          {/* Value proposition */}
          <h1 style={{
            fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px",
            color: "#fff", textAlign: "center", margin: "0 0 12px",
            lineHeight: 1.25, maxWidth: "420px",
          }}>
            A Plataforma Inteligente para Ativos de Energia
          </h1>
          <p style={{
            fontSize: "15px", color: "rgba(255,255,255,0.5)", textAlign: "center",
            margin: "0 0 40px", maxWidth: "380px", lineHeight: 1.5,
          }}>
            Monitorização em tempo real, otimização por IA e trading autónomo para centrais elétricas virtuais.
          </p>

          {/* Security badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 20px",
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.15)",
            borderRadius: "12px",
          }}>
            <span style={{ color: "#10b981", display: "flex" }}><ShieldIcon /></span>
            <div>
              <div style={{ color: "#10b981", fontSize: "13px", fontWeight: "700", letterSpacing: "0.2px" }}>Segurança de Nível Empresarial</div>
              <div style={{ color: "rgba(16,185,129,0.5)", fontSize: "11px", marginTop: "1px" }}>Encriptação AES-256 · RBAC · 2FA</div>
            </div>
          </div>
        </div>

        {/* Subtle bottom gradient bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "3px",
          background: "linear-gradient(90deg, transparent 5%, #f59e0b 50%, transparent 95%)",
          zIndex: 3,
        }} />
      </div>

      {/* ═══════════════════ RIGHT PANEL — White Form ═══════════════════ */}
      <div style={{
        width: "50%", minHeight: "100vh",
        background: "#f8fafc",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative",
        padding: "48px 40px",
        overflowY: "auto",
      }}>
        {/* Lang switcher positioned top-right */}
        <div style={{ position: "absolute", top: "24px", right: "28px", zIndex: 10 }}>
          <LangSwitcher />
        </div>

        <div style={{
          width: "100%", maxWidth: "440px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s",
        }}>
          {/* Title */}
          <div style={{ marginBottom: "36px" }}>
            <h2 style={{
              fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px",
              color: "#0f172a", margin: "0 0 6px",
            }}>
              Configura o teu workspace
            </h2>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Preenche os dados para começar a usar o VoltarisOS.
            </p>
          </div>

          {/* ── Access Code (FIRST) ────────────────────────────────────────── */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px",
              letterSpacing: "0.5px", textTransform: "uppercase",
              color: inviteResult ? "#10b981" : inviteError ? "#ef4444" : "#334155",
            }}>
              <LockIcon /> Código de Acesso
            </label>
            <div style={{ position: "relative" }}>
              <input
                placeholder="Introduz o teu código de convite"
                value={form.beta_code}
                onChange={e => handleBetaCodeChange(e.target.value)}
                onFocus={() => setFocused("beta_code")}
                onBlur={() => setFocused(null)}
                style={{
                  ...lightInputStyle(focused === "beta_code"),
                  fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase",
                  borderColor: inviteResult ? "#10b981" : inviteError ? "#ef4444" : focused === "beta_code" ? "#f59e0b" : "#e2e8f0",
                }}
              />
              {inviteValidating && (
                <div style={{
                  position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                  width: "16px", height: "16px",
                  border: "2px solid rgba(0,0,0,0.1)", borderTopColor: "#f59e0b",
                  borderRadius: "50%", animation: "spin 0.6s linear infinite",
                }} />
              )}
              {inviteResult && !inviteValidating && (
                <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#10b981", fontSize: "16px" }}>✓</div>
              )}
            </div>
            {/* Validation feedback */}
            {inviteResult && (
              <div style={{
                marginTop: "10px", padding: "10px 14px",
                background: "#ecfdf5", border: "1px solid #a7f3d0",
                borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px",
              }}>
                <span style={{ fontSize: "16px" }}>🎯</span>
                <div>
                  <div style={{ color: "#059669", fontSize: "12px", fontWeight: "700" }}>Plano {inviteResult.label}</div>
                  <div style={{ color: "#10b981", fontSize: "11px", marginTop: "2px" }}>Tier: {inviteResult.tier} · {inviteResult.roles?.length || 0} {inviteResult.roles?.length === 1 ? "tipo disponível" : "tipos disponíveis"}</div>
                </div>
              </div>
            )}
            {inviteError && (
              <div style={{
                marginTop: "10px", padding: "10px 14px",
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ fontSize: "14px" }}>⚠️</span>
                <span style={{ color: "#dc2626", fontSize: "12px" }}>{inviteError}</span>
              </div>
            )}
            {!inviteResult && !inviteError && !inviteValidating && (
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                Insere o código recebido para validar o teu plano.
              </div>
            )}
          </div>

          {/* ── Plan Selection (commercial — user-friendly) ─────────────────── */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px",
              letterSpacing: "0.5px", textTransform: "uppercase", color: "#334155",
            }}>
              Plano Pretendido
            </label>
            {inviteResult ? (
              <div style={{
                ...lightInputStyle(false),
                display: "flex", alignItems: "center", gap: "8px",
                background: "#ecfdf5", borderColor: "#a7f3d0",
              }}>
                <span style={{ fontSize: "14px" }}>🎯</span>
                <span style={{ color: "#059669", fontSize: "14px", fontWeight: "600" }}>
                  Plano {inviteResult.label} — atribuído automaticamente
                </span>
              </div>
            ) : (
              <div>
                <select
                  value={form.plan}
                  onChange={e => setForm({ ...form, plan: e.target.value })}
                  onFocus={() => setFocused("plan")}
                  onBlur={() => setFocused(null)}
                  style={{ ...lightInputStyle(focused === "plan"), cursor: "pointer" }}
                >
                  <option value="">Seleciona um plano...</option>
                  <option value="home">Home — €69/mês (1 instalação)</option>
                  <option value="smart">Smart — €149/mês (até 2 instalações + IA)</option>
                  <option value="starter">Starter — €279/mês (até 5 instalações)</option>
                  <option value="pro">Pro — €1.099/mês (até 20 instalações + IA Avançada)</option>
                  <option value="enterprise">Enterprise — €3.999/mês (Instalações Ilimitadas)</option>
                </select>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                  Escolhe o plano que melhor se adapta às tuas necessidades.
                </div>
              </div>
            )}
          </div>

          {/* ── Company ─────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px",
              letterSpacing: "0.5px", textTransform: "uppercase", color: "#334155",
            }}>
              {t("auth_company_name")}
            </label>
            <input
              placeholder="Ex: GreenVolt Energy"
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              onFocus={() => setFocused("company")}
              onBlur={() => setFocused(null)}
              style={lightInputStyle(focused === "company")}
            />
          </div>

          {/* ── Email ───────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px",
              letterSpacing: "0.5px", textTransform: "uppercase", color: "#334155",
            }}>
              {t("auth_email")}
            </label>
            <input
              type="email"
              placeholder="admin@voltaris.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              onKeyDown={handleKey}
              style={lightInputStyle(focused === "email")}
            />
          </div>

          {/* ── Password ────────────────────────────────────────────────────── */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "8px",
              letterSpacing: "0.5px", textTransform: "uppercase", color: "#334155",
            }}>
              {t("auth_password")}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
                onKeyDown={handleKey}
                style={{ ...lightInputStyle(focused === "password"), paddingRight: "44px" }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} tabIndex={-1}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: showPass ? "#f59e0b" : "#94a3b8", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px" }}>
                {showPass ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>

          {/* ── Brand Color Swatches ────────────────────────────────────────── */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{
              fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "12px",
              letterSpacing: "0.5px", textTransform: "uppercase", color: "#334155",
            }}>
              {t("auth_brand_color")}
            </label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {BRAND_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  title={c}
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    background: c,
                    border: form.color === c ? "3px solid #1e293b" : "3px solid transparent",
                    boxShadow: form.color === c ? `0 0 0 3px ${c}40` : "0 1px 3px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    transform: form.color === c ? "scale(1.15)" : "scale(1)",
                  }}
                  onMouseEnter={e => { if (form.color !== c) e.currentTarget.style.transform = "scale(1.1)" }}
                  onMouseLeave={e => { if (form.color !== c) e.currentTarget.style.transform = "scale(1)" }}
                />
              ))}
            </div>
          </div>

          {/* ── Error ────────────────────────────────────────────────────────── */}
          {error && (
            <div style={{
              padding: "12px 16px", marginBottom: "20px",
              background: error.includes("criada") || error.includes("created") ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${error.includes("criada") || error.includes("created") ? "#a7f3d0" : "#fecaca"}`,
              borderRadius: "10px",
              color: error.includes("criada") || error.includes("created") ? "#059669" : "#dc2626",
              fontSize: "13px", fontWeight: "500",
            }}>{error}</div>
          )}

          {/* ── Terms checkbox ───────────────────────────────────────────────── */}
          <label style={{
            display: "flex", alignItems: "flex-start", gap: "10px",
            marginBottom: "22px", cursor: "pointer", fontSize: "12.5px",
            color: "#64748b", lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={e => setTermsAccepted(e.target.checked)}
              style={{ marginTop: "2px", accentColor: "#f59e0b", width: "16px", height: "16px", flexShrink: 0, cursor: "pointer" }}
            />
            <span>
              Li e aceito os{" "}
              <button type="button" onClick={(e) => { e.preventDefault(); setShowTerms(true) }}
                style={{ background: "none", border: "none", padding: 0, color: "#d97706", textDecoration: "underline", cursor: "pointer", fontSize: "inherit", fontWeight: "600" }}
              >Termos de Uso</button>
              {" "}e reconheço que é proibida a engenharia reversa ou cópia do Software.
            </span>
          </label>

          {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}

          {/* ── Submit Button ────────────────────────────────────────────────── */}
          <button
            onClick={handleSubmit}
            disabled={loading || !termsAccepted}
            style={{
              width: "100%", padding: "15px",
              background: (loading || !termsAccepted)
                ? "#cbd5e1"
                : "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
              border: "none", borderRadius: "12px",
              color: (loading || !termsAccepted) ? "#94a3b8" : "#fff",
              fontWeight: "800", fontSize: "15px",
              cursor: (loading || !termsAccepted) ? "not-allowed" : "pointer",
              marginBottom: "24px",
              boxShadow: (loading || !termsAccepted) ? "none" : "0 4px 24px rgba(245,158,11,0.35)",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              letterSpacing: "0.3px",
            }}
            onMouseEnter={e => { if (!loading && termsAccepted) e.currentTarget.style.boxShadow = "0 6px 36px rgba(245,158,11,0.5)" }}
            onMouseLeave={e => { if (!loading && termsAccepted) e.currentTarget.style.boxShadow = "0 4px 24px rgba(245,158,11,0.35)" }}
          >
            {loading ? (
              <>
                <span style={{
                  width: "16px", height: "16px",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                  display: "inline-block",
                }} />
                {t("auth_authenticating")}
              </>
            ) : (
              t("auth_register")
            )}
          </button>

          {/* ── Bottom link ──────────────────────────────────────────────────── */}
          <div style={{ textAlign: "center" }}>
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>
              {t("auth_have_account") + " "}
            </span>
            <button
              onClick={() => { setMode("login"); setError("") }}
              style={{
                background: "none", border: "none", color: "#d97706",
                cursor: "pointer", fontSize: "13px", fontWeight: "700",
                textDecoration: "none",
              }}
              onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
              onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
            >
              {t("auth_login_link")}
            </button>
          </div>

          {/* ── Subtle version ───────────────────────────────────────────────── */}
          <div style={{
            marginTop: "36px", textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
          }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%",
              background: "#f59e0b", opacity: 0.5,
            }} />
            <span style={{ color: "#cbd5e1", fontSize: "11px" }}>VoltarisOS v2.0 · {t("auth_system_label")}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ─── Input styles ─────────────────────────────────────────────────────────
function inputDarkStyle(active) {
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

function lightInputStyle(active) {
  return {
    width: "100%",
    padding: "14px 16px",
    background: active ? "#fff" : "#fff",
    border: `1.5px solid ${active ? "#f59e0b" : "#e2e8f0"}`,
    borderRadius: "12px",
    color: "#0f172a",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s",
    fontFamily: "inherit",
    fontWeight: "500",
    boxShadow: active ? "0 0 0 3px rgba(245,158,11,0.1)" : "none",
    "::placeholder": { color: "#94a3b8", fontWeight: "400" },
  }
}