import { useState } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"
import { LANGUAGES } from "../i18n/translations"
import NotificationBell from "./NotificationBell"

const PAGE_TITLE_KEYS = {
  dashboard: "page_dashboard", sites: "page_sites", fleet: "page_fleet",
  trading: "page_trading", battery: "page_battery", ev: "page_ev",
  grid: "page_grid", forecasting: "page_forecasting", map: "page_map",
  alerts: "page_alerts", reports: "page_reports",
  users: "page_users", investor: "page_investor", settings: "page_settings",
  carbon: "page_carbon", autonomous: "page_autonomous",
  twin: "page_twin", maintenance: "page_maintenance",
  whitelabel: "page_whitelabel", audit: "page_audit", apikeys: "page_apikeys", export: "page_export",
}

const BILLING_URL = "https://se303bch6c5bf4hrjpjkj-preview-4200.runable.site"

const PLANS = [
  { id: "home",       name: "Home",       price: "€69",    period: "/mo",  desc: "1 site · up to 50 kWh",  color: "#10b981", badge: null },
  { id: "starter",    name: "Starter",    price: "€279",   period: "/mo",  desc: "5 sites · up to 500 kWh", color: "#6366f1", badge: "Most Popular" },
  { id: "pro",        name: "Pro",        price: "€1 099", period: "/mo",  desc: "20 sites · advanced AI",  color: "#f59e0b", badge: "Best Value" },
  { id: "enterprise", name: "Enterprise", price: "€3 999", period: "/mo",  desc: "Unlimited · white-label", color: "#ec4899", badge: null },
]

export default function TopBar({ page, user, isMobile, onMenuToggle }) {
  const { theme, setTheme, simMode, setSimMode, setCmdOpen, addToast, language, setLanguage, accentColor } = useAppStore()
  const { t } = useTranslation()
  const color = user?.color || accentColor || "#4ade80"
  const [langOpen, setLangOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  return (
    <>
    <div style={{
      height: "56px",
      background: "var(--topbar, var(--sidebar))",
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: isMobile ? "0 12px" : "0 24px",
      gap: isMobile ? "6px" : "10px",
      position: "sticky", top: 0, zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Hamburger — mobile only */}
      {isMobile && (
        <button
          onClick={onMenuToggle}
          style={{
            background: "none", border: "none", color: "var(--text)",
            cursor: "pointer", padding: "6px", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          color: "var(--text)", fontWeight: "600",
          fontSize: isMobile ? "14px" : "15px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
        }}>
          {t(PAGE_TITLE_KEYS[page] || "page_dashboard")}
        </span>
      </div>

      {/* Search trigger — hide label on mobile */}
      <button
        onClick={() => setCmdOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: isMobile ? "7px 10px" : "7px 14px",
          background: "var(--surface2)",
          border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--sub)", cursor: "pointer", fontSize: "13px",
          transition: "all 0.15s", flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-strong)"; e.currentTarget.style.color = "var(--text)" }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--sub)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        {!isMobile && (
          <>
            <span>{t("topbar_search")}</span>
            <kbd style={{ padding: "1px 6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "4px", fontSize: "10px", color: "var(--sub)" }}>⌘K</kbd>
          </>
        )}
      </button>

      {/* Sim mode — hide on small mobile */}
      {!isMobile && (
        <button
          onClick={() => { setSimMode(!simMode); addToast(simMode ? t("topbar_sim_off") : t("topbar_sim_on"), "info") }}
          title={simMode ? "Desativar simulação" : "Ativar simulação"}
          style={{
            padding: "7px 12px",
            background: simMode ? "#78350f30" : "var(--surface2)",
            border: simMode ? "1px solid #f59e0b44" : "1px solid var(--border)",
            borderRadius: "8px", color: simMode ? "#f59e0b" : "var(--sub)",
            cursor: "pointer", fontSize: "12px", fontWeight: "600",
            transition: "all 0.15s", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
          }}
        >
          <span>🧪</span>
          <span>SIM</span>
        </button>
      )}

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title={t("app_theme")}
        style={{
          background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
          color: "var(--sub)", cursor: "pointer", width: "36px", height: "36px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s", fontSize: "16px", flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text)" }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--sub)" }}
      >
        {theme === "dark" ? "☀" : "🌙"}
      </button>

      {/* Language selector — hide on small screens */}
      {!isMobile && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            style={{
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px",
              color: "var(--sub)", cursor: "pointer", padding: "6px 10px", height: "36px",
              display: "flex", alignItems: "center", gap: "6px", fontSize: "13px",
              transition: "all 0.15s", flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--border-strong)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)" }}
          >
            <span style={{ fontSize: "15px" }}>{LANGUAGES[language]?.flag}</span>
            <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>{language}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {langOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setLangOpen(false)} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "var(--tooltip-bg)", border: "1px solid var(--border)", borderRadius: "10px",
                minWidth: "160px", zIndex: 999, overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                backdropFilter: "blur(12px)",
              }}>
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => { setLanguage(code); setLangOpen(false); addToast(`${lang.flag} ${lang.label}`, "info") }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 14px", background: language === code ? `${color}14` : "none",
                      border: "none", color: language === code ? color : "var(--sub)",
                      cursor: "pointer", fontSize: "13px", fontWeight: language === code ? "600" : "400",
                      textAlign: "left", transition: "background 0.1s",
                      borderLeft: language === code ? `2px solid ${color}` : "2px solid transparent",
                    }}
                    onMouseEnter={e => { if (language !== code) { e.currentTarget.style.background = "var(--surface)" } }}
                    onMouseLeave={e => { if (language !== code) { e.currentTarget.style.background = "none" } }}
                  >
                    <span style={{ fontSize: "16px" }}>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Change Plan */}
      {!isMobile && (
        <button
          onClick={() => setPlanOpen(true)}
          style={{
            padding: "7px 13px",
            background: `${color}18`,
            border: `1px solid ${color}55`,
            borderRadius: "8px",
            color: color,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: "600",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.borderColor = color }}
          onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.borderColor = `${color}55` }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          Change Plan
        </button>
      )}

      {/* Notifications */}
      <NotificationBell color={color} />

      {/* User pill — compact on mobile */}
      <div style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: isMobile ? "5px 8px" : "5px 10px",
        background: "var(--surface2)",
        border: "1px solid var(--border)", borderRadius: "8px", flexShrink: 0,
      }}>
        <div style={{
          width: "24px", height: "24px", borderRadius: "50%",
          background: `${color}25`, border: `1px solid ${color}50`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", fontWeight: "700", color: color, flexShrink: 0,
        }}>
          {(user?.company || "V").charAt(0).toUpperCase()}
        </div>
        {!isMobile && (
          <span style={{ color: "var(--sub)", fontSize: "12px", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.company || "Admin"}
          </span>
        )}
      </div>
    </div>

    {/* ── Plan Modal ─────────────────────────────────────────────────── */}
    {planOpen && (
      <>
        <div
          onClick={() => setPlanOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, backdropFilter: "blur(4px)" }}
        />
        <div style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "16px", padding: "32px", zIndex: 1001,
          width: "min(96vw, 680px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div>
              <h2 style={{ color: "var(--text)", margin: 0, fontSize: "20px", fontWeight: 700 }}>Choose your plan</h2>
              <p style={{ color: "var(--sub)", margin: "4px 0 0", fontSize: "13px" }}>Upgrade or downgrade at any time. Billed monthly.</p>
            </div>
            <button
              onClick={() => setPlanOpen(false)}
              style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "4px" }}
            >✕</button>
          </div>

          {/* Plans grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginBottom: "20px" }}>
            {PLANS.map(plan => (
              <a
                key={plan.id}
                href={BILLING_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", textDecoration: "none",
                  background: "var(--surface2)", border: `1px solid ${plan.color}44`,
                  borderRadius: "12px", padding: "18px",
                  transition: "all 0.15s", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = plan.color; e.currentTarget.style.background = `${plan.color}12` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${plan.color}44`; e.currentTarget.style.background = "var(--surface2)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: plan.color }}>{plan.name}</span>
                  {plan.badge ? (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                      color: "#fff", background: plan.color, padding: "2px 8px", borderRadius: "20px",
                    }}>{plan.badge}</span>
                  ) : (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                      color: plan.color, background: `${plan.color}20`, padding: "2px 8px", borderRadius: "20px",
                    }}>Select</span>
                  )}
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>{plan.price}</span>
                  <span style={{ fontSize: "12px", color: "var(--sub)", marginLeft: "2px" }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--sub)" }}>{plan.desc}</div>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center" }}>
            <a
              href={BILLING_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--sub)", fontSize: "12px", textDecoration: "underline" }}
            >
              Manage billing &amp; invoices →
            </a>
          </div>
        </div>
      </>
    )}
    </>
  )
}
