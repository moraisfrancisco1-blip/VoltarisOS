import { useAppStore } from "../store/appStore"

export default function SimBanner() {
  const { simMode, setSimMode, addToast } = useAppStore()
  if (!simMode) return null
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
      background: "linear-gradient(90deg, #78350f, #92400e)",
      borderBottom: "1px solid #f59e0b44",
      padding: "7px 24px",
      display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
    }}>
      <span style={{ fontSize: "13px" }}>🧪</span>
      <span style={{ color: "#fcd34d", fontSize: "13px", fontWeight: "600" }}>
        MODO SIMULAÇÃO ATIVO — Os dados apresentados são fictícios
      </span>
      <button
        onClick={() => { setSimMode(false); addToast("Modo Simulação desativado", "success") }}
        style={{
          marginLeft: "12px", padding: "3px 12px",
          background: "#f59e0b22", border: "1px solid #f59e0b66",
          borderRadius: "6px", color: "#fcd34d", cursor: "pointer", fontSize: "12px",
        }}
      >Desativar</button>
    </div>
  )
}
