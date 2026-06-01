import { useState } from "react"
import { useAppStore } from "../store/appStore"
import logoDark from "../logo_sidebar.png"

const STEPS = [
  {
    title: "Bem-vindo ao VoltarisOS",
    subtitle: "A plataforma de gestão de energia mais avançada do mercado.",
    icon: "⚡",
    content: (
      <div style={{ color: "#9ca3af", fontSize: "14px", lineHeight: "1.7" }}>
        O VoltarisOS permite-te gerir baterias BESS, negociar energia em tempo real,
        monitorizar frotas industriais, e muito mais — tudo numa única plataforma.
        <br /><br />
        Vamos configurar a tua conta em 2 passos rápidos.
      </div>
    ),
  },
  {
    title: "Configura os teus sites",
    subtitle: "Adiciona os teus locais de produção e armazenamento.",
    icon: "📍",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[
          { label: "Nome do site", placeholder: "Ex: Rotterdam BESS" },
          { label: "Localização", placeholder: "Ex: Rotterdam, NL" },
          { label: "Capacidade (MWh)", placeholder: "Ex: 8.5" },
        ].map(f => (
          <div key={f.label}>
            <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "6px" }}>{f.label}</div>
            <input
              placeholder={f.placeholder}
              style={{
                width: "100%", padding: "10px 14px",
                background: "#0d1525", border: "1px solid #1e2d45",
                borderRadius: "8px", color: "white", fontSize: "14px",
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
    title: "Define os teus alertas",
    subtitle: "Recebe notificações quando algo exige atenção.",
    icon: "🔔",
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { label: "SOC crítico abaixo de 10%", checked: true },
          { label: "Temperatura > 45°C", checked: true },
          { label: "Preço spot acima de €150/MWh", checked: false },
          { label: "Falha de comunicação com inversor", checked: true },
          { label: "Relatório CO₂ mensal gerado", checked: false },
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
            <span style={{ color: "#d1d5db", fontSize: "13px" }}>{item.label}</span>
          </label>
        ))}
      </div>
    ),
  },
]

export default function OnboardingWizard() {
  const { onboarded, setOnboarded, addToast } = useAppStore()
  const [step, setStep] = useState(0)

  if (onboarded) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const finish = () => {
    setOnboarded()
    addToast("Configuração concluída! Bem-vindo ao VoltarisOS.", "success")
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
            height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`,
            background: "linear-gradient(90deg, #4ade80, #22d3ee)",
            transition: "width 0.4s ease",
          }} />
        </div>

        {/* Logo */}
        <div style={{ padding: "28px 32px 0", display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={logoDark} alt="VoltarisOS" style={{ height: "28px", objectFit: "contain" }} />
          <div style={{
            padding: "3px 10px", background: "#4ade8015",
            border: "1px solid #4ade8030", borderRadius: "20px",
            color: "#4ade80", fontSize: "11px", fontWeight: "600",
          }}>Setup {step + 1}/{STEPS.length}</div>
        </div>

        {/* Content */}
        <div style={{ padding: "24px 32px 32px" }}>
          <div style={{ fontSize: "28px", marginBottom: "12px" }}>{current.icon}</div>
          <h2 style={{ color: "white", fontSize: "22px", fontWeight: "700", marginBottom: "6px" }}>{current.title}</h2>
          <p style={{ color: "#4b5563", fontSize: "13px", marginBottom: "24px" }}>{current.subtitle}</p>
          <div>{current.content}</div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 32px 24px", borderTop: "1px solid #1a2234",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button
            onClick={finish}
            style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "13px" }}
          >Saltar configuração</button>
          <div style={{ display: "flex", gap: "10px" }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  padding: "10px 20px", background: "#1f2937",
                  border: "1px solid #374151", borderRadius: "8px",
                  color: "#9ca3af", cursor: "pointer", fontSize: "14px",
                }}
              >Anterior</button>
            )}
            <button
              onClick={() => isLast ? finish() : setStep(s => s + 1)}
              style={{
                padding: "10px 24px",
                background: "linear-gradient(135deg, #4ade80, #22d3ee)",
                border: "none", borderRadius: "8px",
                color: "#0a0f1a", cursor: "pointer", fontSize: "14px", fontWeight: "700",
              }}
            >{isLast ? "Começar ⚡" : "Próximo →"}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
