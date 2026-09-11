import { useState } from "react"
import { useAppStore } from "../store/appStore"
import { useTranslation } from "../i18n/useTranslation"
import logoFull from "../logo_full.png"

const buildSteps = (t) => [
  {
    title: t("onb_welcome_title"),
    subtitle: t("onb_welcome_sub"),
    icon: "⚡",
    content: (
      <div style={{ color: "var(--sub)", fontSize: "14px", lineHeight: "1.7" }}>
        {t("onb_welcome_body")}
        <br /><br />
        {t("onb_welcome_body2")}
      </div>
    ),
  },
  {
    title: t("onb_sites_title"),
    subtitle: t("onb_sites_sub"),
    icon: "📍",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[
          { label: t("onb_field_site_name"), placeholder: t("onb_field_site_ph") },
          { label: t("onb_field_location"), placeholder: t("onb_field_location_ph") },
          { label: t("onb_field_capacity"), placeholder: t("onb_field_capacity_ph") },
        ].map(f => (
          <div key={f.label}>
            <div style={{ color: "var(--sub)", fontSize: "12px", marginBottom: "6px" }}>{f.label}</div>
            <input
              placeholder={f.placeholder}
              style={{
                width: "100%", padding: "10px 14px",
                background: "#0d1525", border: "1px solid #1e2d45",
                borderRadius: "8px", color: "var(--text)", fontSize: "14px",
                outline: "none", boxSizing: "border-box", fontFamily: "inherit",
              }}
              onFocus={e => e.target.style.borderColor = "#4ade80"}
              onBlur={e => e.target.style.borderColor = "#1e2d45"}
            />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: t("onb_alerts_title"),
    subtitle: t("onb_alerts_sub"),
    icon: "🔔",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { label: t("onb_alert_soc"), checked: true },
          { label: t("onb_alert_temp"), checked: true },
          { label: t("onb_alert_price"), checked: false },
          { label: t("onb_alert_comm"), checked: true },
          { label: t("onb_alert_co2"), checked: false },
        ].map(item => (
          <label key={item.label} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "10px 14px", background: "#0d1525",
            border: "1px solid #1e2d45", borderRadius: "8px", cursor: "pointer",
          }}>
            <input
              type="checkbox"
              defaultChecked={item.checked}
              style={{ width: "16px", height: "16px", accentColor: "#4ade80", cursor: "pointer" }}
            />
            <span style={{ color: "var(--text)", fontSize: "13px" }}>{item.label}</span>
          </label>
        ))}
      </div>
    ),
  },
]

export default function OnboardingWizard() {
  const { onboarded, setOnboarded, addToast } = useAppStore()
  const { t } = useTranslation()
  const [step, setStep] = useState(0)

  if (onboarded) return null

  const steps = buildSteps(t)
  const isLast = step === steps.length - 1
  const current = steps[step]

  const finish = () => {
    setOnboarded()
    addToast(t("onb_done_toast"), "success")
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "var(--surface)",
      zIndex: 9997, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(6px)",
    }}>
      <div style={{
        width: "520px", maxWidth: "90vw",
        background: "#0d1525",
        border: "1px solid #1e2d45",
        borderRadius: "20px",
        boxShadow: "0 30px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(74,222,128,0.05)",
        overflow: "hidden",
      }}>
        {/* Top bar */}
        <div style={{
          height: "4px", background: "#1a2234",
          position: "relative",
        }}>
          <div style={{
            height: "100%", width: `${((step + 1) / steps.length) * 100}%`,
            background: "linear-gradient(90deg, #4ade80, #22d3ee)",
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Logo */}
        <div style={{ padding: "28px 32px 0", display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoFull} alt="VoltarisOS" style={{ height: "28px", objectFit: "contain" }} />
          <div style={{
            padding: "3px 10px", background: "#4ade8015",
            border: "1px solid #4ade8030", borderRadius: "20px",
            color: "#4ade80", fontSize: "11px", fontWeight: "600",
          }}>{t("onb_setup")} {step + 1}/{steps.length}</div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px 32px 32px" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>{current.icon}</div>
          <h2 style={{ color: "var(--text)", fontSize: "22px", fontWeight: "700", marginBottom: "6px" }}>{current.title}</h2>
          <p style={{ color: "var(--sub)", fontSize: "13px", marginBottom: "24px" }}>{current.subtitle}</p>
          <div>{current.content}</div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 32px 24px", borderTop: "1px solid #1a2234",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button
            onClick={finish}
            style={{ background: "none", border: "none", color: "var(--sub)", cursor: "pointer", fontSize: "13px" }}
          >{t("onb_skip")}</button>
          <div style={{ display: "flex", gap: "10px" }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 20px", background: "#1f2937",
                  border: "1px solid var(--sub)", borderRadius: "8px",
                  color: "var(--sub)", cursor: "pointer", fontSize: "14px",
                }}
              >{t("onb_prev")}</button>
            )}
            <button
              onClick={() => isLast ? finish() : setStep(s => s + 1)}
              style={{
                padding: "10px 24px",
                background: "linear-gradient(135deg, #4ade80, #22d3ee)",
                border: "none", borderRadius: "8px",
                color: "#0a0f1a", cursor: "pointer", fontSize: "14px", fontWeight: "700",
              }}
            >{isLast ? t("onb_start") : t("onb_next")}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
