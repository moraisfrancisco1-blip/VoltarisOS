import { useState, useEffect } from "react"
import axios from "axios"
import logoDark from "../logo_sidebar.png"

function FloatingParticle({ style }) {
  return <div style={{ position: "absolute", borderRadius: "50%", pointerEvents: "none", ...style }} />
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState({ email: "", password: "", company: "", color: "#4ade80" })
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
        await axios.post("/api/auth/register", form)
        setMode("login")
        setError("Conta criada! Faz login.")
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Credenciais inválidas")
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
        background: "rgba(10, 18, 32, 0.9)",
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
          background: "linear-gradient(90deg, transparent, #4ade80, #22d3ee, transparent)",
        }} />

        {/* Logo section */}
        <div style={{
          padding: "32px 36px 28px",
          display: "flex", flexDirection: "column", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{
            padding: "14px 28px",
            background: "rgba(74,222,128,0.04)",
            border: "1px solid rgba(74,222,128,0.12)",
            borderRadius: "16px",
            marginBottom: "20px",
          }}>
            <img
              src={logoDark}
              alt="VoltarisOS"
              style={{ height: "42px", objectFit: "contain", display: "block" }}
            />
          </div>
          <div style={{
            color: "rgba(255,255,255,0.85)", fontSize: "20px",
            fontWeight: "700", marginBottom: "6px", letterSpacing: "-0.3px",
          }}>
            {mode === "login" ? "Bem-vindo de volta" : "Criar conta"}
          </div>
          <div style={{ color: "#4b5563", fontSize: "13px" }}>
            {mode === "login" ? "Entra na tua plataforma de energia" : "Configura o teu workspace VoltarisOS"}
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: "28px 36px 32px" }}>

          {mode === "register" && (
            <>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#6b7280", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px" }}>
                  NOME DA EMPRESA
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    placeholder="Ex: GreenVolt Energy"
                    value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })}
                    onFocus={() => setFocused("company")}
                    onBlur={() => setFocused(null)}
                    style={inputStyle(focused === "company")}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ color: "#6b7280", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px" }}>COR DA MARCA</label>
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
            <label style={{ color: "#6b7280", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px" }}>
              EMAIL
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused === "email" ? "#4ade80" : "#374151"} strokeWidth="1.8">
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
            <label style={{ color: "#6b7280", fontSize: "12px", fontWeight: "600", display: "block", marginBottom: "8px", letterSpacing: "0.3px" }}>
              PASSWORD
            </label>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focused === "password" ? "#4ade80" : "#374151"} strokeWidth="1.8">
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
              {/* Eye toggle */}
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                tabIndex={-1}
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: showPass ? "#4ade80" : "#374151",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "4px", borderRadius: "6px",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => { if (!showPass) e.currentTarget.style.color = "#6b7280" }}
                onMouseLeave={e => { if (!showPass) e.currentTarget.style.color = "#374151" }}
                title={showPass ? "Ocultar password" : "Ver password"}
              >
                {showPass ? (
                  // Eye-off
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  // Eye
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
              background: error.includes("criada") ? "#0d2818" : "#2d0a0a",
              border: `1px solid ${error.includes("criada") ? "#14532d" : "#7f1d1d"}`,
              borderRadius: "8px",
              color: error.includes("criada") ? "#4ade80" : "#f87171",
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
                : "linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)",
              border: "none", borderRadius: "12px",
              color: loading ? "#4b5563" : "#0a0f1a",
              fontWeight: "800", fontSize: "15px",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "20px",
              boxShadow: loading ? "none" : "0 4px 24px rgba(74,222,128,0.25)",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              letterSpacing: "0.3px",
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 6px 32px rgba(74,222,128,0.4)" }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 24px rgba(74,222,128,0.25)" }}
          >
            {loading ? (
              <>
                <span style={{
                  width: "16px", height: "16px",
                  border: "2px solid #374151",
                  borderTopColor: "#4ade80",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                  display: "inline-block",
                }} />
                A autenticar...
              </>
            ) : (
              mode === "login" ? "Entrar na plataforma →" : "Criar conta →"
            )}
          </button>

          {/* Mode switch */}
          <div style={{ textAlign: "center" }}>
            <span style={{ color: "#374151", fontSize: "13px" }}>
              {mode === "login" ? "Não tens conta? " : "Já tens conta? "}
            </span>
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }}
              style={{
                background: "none", border: "none", color: "#4ade80",
                cursor: "pointer", fontSize: "13px", fontWeight: "600",
                textDecoration: "underline",
              }}
            >
              {mode === "login" ? "Regista-te aqui" : "Fazer login"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 36px 20px",
          borderTop: "1px solid rgba(255,255,255,0.03)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#4ade80",
            boxShadow: "0 0 6px #4ade80",
            animation: "pulse 2s ease-in-out infinite",
          }} />
          <span style={{ color: "#374151", fontSize: "11px" }}>VoltarisOS v2.0 · Sistema operacional</span>
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
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #4ade80 }
          50% { opacity: 0.5; box-shadow: 0 0 12px #4ade80 }
        }
      `}</style>
    </div>
  )
}

function inputStyle(active) {
  return {
    width: "100%",
    padding: "12px 14px",
    background: active ? "rgba(74,222,128,0.04)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.07)"}`,
    borderRadius: "10px",
    color: "white",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s",
    fontFamily: "inherit",
    boxShadow: active ? "0 0 0 3px rgba(74,222,128,0.08)" : "none",
  }
}
