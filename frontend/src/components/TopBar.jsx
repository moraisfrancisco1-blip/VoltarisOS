import { useState } from "react"
import { useAppStore, THEMES, resolveAccent } from "../store/appStore"
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
  revenue_opt: "page_revenue_opt", compliance: "page_compliance", command_center: "page_command_center",
  scorecard: "page_scorecard", anomaly: "page_anomaly",
  integrations: "nav_integrations", vpp: "nav_vpp", resilience: "nav_resilience",
  dispatch_copilot: "nav_dispatch_copilot", marketplace: "nav_marketplace",
  carbon_credit: "nav_carbon_credit", customer_portal: "nav_customer_portal",
  solar_intel: "nav_solar_intel", arbitrage: "nav_arbitrage", degradation_lab: "nav_degradation_lab",
  super_admin_tenants: "page_super_tenants", super_admin_system_health: "page_system_health",
}

const BILLING_URL = "mailto:francisco@voltarisos.com?subject=VoltarisOS%20Plan%20Upgrade"

const PLANS = [
  { id: "beta",       name: "Beta",       priceKey: "plan_price_free", period: "",      descKey: "plan_desc_beta",       color: "#4ade80", badgeKey: "plan_badge_beta" },
  { id: "home",       name: "Home",       price: "€69",    period: "/mo",   descKey: "plan_desc_home",       color: "#10b981", badgeKey: null },
  { id: "starter",    name: "Starter",    price: "€279",   period: "/mo",   descKey: "plan_desc_starter",    color: "#6366f1", badgeKey: "plan_badge_popular" },
  { id: "pro",        name: "Pro",        price: "€1 099", period: "/mo",   descKey: "plan_desc_pro",        color: "#f59e0b", badgeKey: "plan_badge_best" },
  { id: "enterprise", name: "Enterprise", price: "€3 999", period: "/mo",   descKey: "plan_desc_enterprise", color: "#ec4899", badgeKey: null },
]

export default function TopBar({ page, user, isMobile, onMenuToggle, setPage }) {
  const { theme, setTheme, simMode, setSimMode, setCmdOpen, addToast, language, setLanguage } = useAppStore()
  useAppStore(s => s.accentColor) // re-render when the accent changes in Settings
  const { t } = useTranslation()
  const color = resolveAccent(user?.color, theme)
  const [langOpen, setLangOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  return (
    <>
    <div className="vos-topbar" style={{ padding: isMobile ? "0 12px" : "0 28px", gap: isMobile ? "6px" : "10px" }}>
      {/* Hamburger — mobile only */}
      {isMobile && (
        <button
          onClick={onMenuToggle}
          className="vos-chip"
          style={{ width: "36px", padding: 0, justifyContent: "center" }}
          aria-label="Menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      )}

      {/* Breadcrumb: product / page */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", alignItems: "center", gap: "10px" }}>
        {!isMobile && (
          <>
            <span className="vos-hide-md" style={{
              fontSize: "10px", fontWeight: 800, letterSpacing: "2.4px", textTransform: "uppercase",
              background: "linear-gradient(90deg, var(--accent), var(--accent2))",
              WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "var(--accent)",
              flexShrink: 0,
            }}>VoltarisOS</span>
            <span className="vos-hide-md" style={{ color: "var(--sidebar-sub)", opacity: 0.4, fontSize: "16px", fontWeight: 300, flexShrink: 0 }}>/</span>
          </>
        )}
        <span style={{
          color: "var(--sidebar-text)", fontWeight: 650,
          fontSize: isMobile ? "14px" : "16px", letterSpacing: "-0.2px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block",
        }}>
          {t(PAGE_TITLE_KEYS[page] || "page_dashboard")}
        </span>
      </div>

      {/* Search */}
      <button onClick={() => setCmdOpen(true)} className="vos-chip"
        style={{ justifyContent: isMobile ? "center" : "flex-start", padding: isMobile ? "0 10px" : "0 12px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        {!isMobile && (
          <>
            <span className="vos-hide-lg" style={{ minWidth: "110px", textAlign: "left" }}>{t("topbar_search")}</span>
            <kbd className="vos-hide-lg" style={{ padding: "1px 6px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", borderRadius: "5px", fontSize: "10px", color: "var(--sidebar-sub)", fontFamily: "inherit" }}>⌘K</kbd>
          </>
        )}
      </button>

      {/* Sim mode — hide on small mobile */}
      {!isMobile && (
        <button
          onClick={() => { setSimMode(!simMode); addToast(simMode ? t("topbar_sim_off") : t("topbar_sim_on"), "info") }}
          title={simMode ? t("topbar_sim_disable_title") : t("topbar_sim_enable_title")}
          className="vos-chip"
          style={simMode ? { background: "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.45)", color: "#fbbf24", fontWeight: 700 } : { fontWeight: 600 }}
        >
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: simMode ? "#fbbf24" : "var(--sidebar-sub)", opacity: simMode ? 1 : 0.5, boxShadow: simMode ? "0 0 8px #fbbf24" : "none" }} />
          <span>{t("topbar_sim_short")}</span>
        </button>
      )}

      {/* Theme picker */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setThemeOpen(!themeOpen)} title={t("app_theme")} className="vos-chip" style={{ width: "36px", padding: 0, justifyContent: "center" }}>
          <span style={{
            width: "16px", height: "16px", borderRadius: "50%",
            background: `conic-gradient(from 210deg, ${THEMES[theme]?.accent || "var(--accent)"}, ${THEMES[theme]?.accent2 || "var(--accent2)"}, ${THEMES[theme]?.accent || "var(--accent)"})`,
            boxShadow: "0 0 0 2px rgba(255,255,255,0.14)",
          }} />
        </button>
        {themeOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setThemeOpen(false)} />
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 8px)", width: "220px",
              background: "var(--tooltip-bg)", border: "1px solid var(--border-strong)", borderRadius: "14px",
              zIndex: 999, padding: "8px", boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
            }}>
              {["dark", "light"].map(mode => (
                <div key={mode}>
                  <div style={{ padding: "8px 10px 4px", fontSize: "9.5px", fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--sub)", opacity: 0.7 }}>
                    {mode === "dark" ? "Dark" : "Light"}
                  </div>
                  {Object.values(THEMES).filter(th => th.mode === mode).map(th => (
                    <button
                      key={th.name}
                      onClick={() => { setTheme(th.name); setThemeOpen(false) }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
                        background: theme === th.name ? "rgba(255,255,255,0.07)" : "none", border: "none", borderRadius: "9px",
                        color: theme === th.name ? "var(--text)" : "var(--sub)", cursor: "pointer", fontSize: "13px",
                        fontWeight: theme === th.name ? 650 : 450, textAlign: "left",
                      }}
                      onMouseEnter={e => { if (theme !== th.name) e.currentTarget.style.background = "rgba(255,255,255,0.05)" }}
                      onMouseLeave={e => { if (theme !== th.name) e.currentTarget.style.background = "none" }}
                    >
                      <span style={{
                        width: "26px", height: "18px", borderRadius: "5px", flexShrink: 0, position: "relative", overflow: "hidden",
                        background: th.bg, border: "1px solid rgba(128,128,128,0.35)",
                      }}>
                        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "7px", background: th.sidebar }} />
                        <span style={{ position: "absolute", right: "3px", bottom: "3px", width: "9px", height: "4px", borderRadius: "2px", background: `linear-gradient(90deg, ${th.accent}, ${th.accent2})` }} />
                      </span>
                      <span style={{ flex: 1 }}>{th.label}</span>
                      {theme === th.name && <span style={{ color: th.accent, fontSize: "12px" }}>✓</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Language selector — hide on small screens */}
      {!isMobile && (
        <div className="vos-hide-md" style={{ position: "relative" }}>
          <button onClick={() => setLangOpen(!langOpen)} className="vos-chip" style={{ padding: "0 10px", gap: "6px" }}>
            <span style={{ fontSize: "15px" }}>{LANGUAGES[language]?.flag}</span>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.6px" }}>{language}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {langOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setLangOpen(false)} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)",
                background: "var(--tooltip-bg)", border: "1px solid var(--border-strong)", borderRadius: "12px",
                minWidth: "170px", zIndex: 999, overflow: "hidden",
                boxShadow: "0 18px 48px rgba(0,0,0,0.55)",
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
            height: "36px", padding: "0 15px", borderRadius: "10px", cursor: "pointer",
            border: "none", color: "#0a0f1a", fontSize: "12.5px", fontWeight: 800, letterSpacing: "0.2px",
            background: "linear-gradient(135deg, var(--accent), var(--accent2))",
            boxShadow: "0 4px 18px color-mix(in srgb, var(--accent) 35%, transparent)",
            display: "flex", alignItems: "center", gap: "7px", flexShrink: 0, transition: "transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 24px color-mix(in srgb, var(--accent) 55%, transparent)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 18px color-mix(in srgb, var(--accent) 35%, transparent)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
          <span className="vos-hide-lg">{t("topbar_change_plan")}</span>
        </button>
      )}

      {/* Notifications */}
      <NotificationBell color={color} />

      {/* User pill — compact on mobile */}
      <div className="vos-chip" style={{ cursor: "default", gap: "9px", padding: isMobile ? "0 6px" : "0 12px 0 6px" }}>
        <div style={{
          width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
          background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 45%, #000))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "12px", fontWeight: "800", color: "#0a0f1a",
          boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 30%, transparent)`,
        }}>
          {(user?.company || "V").charAt(0).toUpperCase()}
        </div>
        {!isMobile && (
          <span style={{ color: "var(--sidebar-text)", fontSize: "12.5px", fontWeight: 600, maxWidth: "110px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          width: "min(96vw, 760px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
            <div>
              <h2 style={{ color: "var(--text)", margin: 0, fontSize: "20px", fontWeight: 700 }}>{t("plan_choose_title")}</h2>
              <p style={{ color: "var(--sub)", margin: "4px 0 0", fontSize: "13px" }}>{t("plan_beta_note")}</p>
            </div>
            <button
              onClick={() => setPlanOpen(false)}
              style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "4px" }}
            >✕</button>
          </div>

          {/* Plans grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
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
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{plan.name}</span>
                  {plan.badgeKey ? (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                      color: "#fff", background: plan.color, padding: "2px 8px", borderRadius: "20px",
                    }}>{t(plan.badgeKey)}</span>
                  ) : (
                    <span style={{
                      fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
                      color: "var(--text)", background: `${plan.color}25`, padding: "2px 8px", borderRadius: "20px",
                      border: `1px solid ${plan.color}40`,
                    }}>{t("plan_select")}</span>
                  )}
                </div>
                <div style={{ marginBottom: "6px" }}>
                  <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)" }}>{plan.priceKey ? t(plan.priceKey) : plan.price}</span>
                  <span style={{ fontSize: "12px", color: "var(--sub)", marginLeft: "2px" }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--sub)" }}>{t(plan.descKey)}</div>
              </a>
            ))}
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: "16px" }}>
            <button
              onClick={() => {
                setPlanOpen(false);
                if (setPage) {
                  setPage("settings");
                  // Scroll to billing section after a short delay
                  setTimeout(() => {
                    const billingTab = document.querySelector('[data-billing-tab]');
                    if (billingTab) billingTab.click();
                  }, 100);
                }
              }}
              style={{
                background: "none", border: "none", color: color, fontSize: "12px",
                textDecoration: "underline", cursor: "pointer", padding: 0,
                fontWeight: "600",
              }}
            >
              {t("plan_manage_billing")}
            </button>
            <a
              href={BILLING_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--sub)", fontSize: "12px", textDecoration: "underline" }}
            >
              {t("plan_contact_support")}
            </a>
          </div>
        </div>
      </>
    )}
    </>
  )
}
