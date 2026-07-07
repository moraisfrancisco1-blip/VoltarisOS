import { Component } from "react"

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error("VoltarisOS crashed:", error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "radial-gradient(ellipse 120% 80% at 50% -10%, #0d2040 0%, #050a14 50%, #0a0f1a 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
        }}>
          <div style={{
            maxWidth: "440px", width: "100%",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: "20px", padding: "36px",
            textAlign: "center",
            boxShadow: "0 40px 120px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize: "42px", marginBottom: "12px" }}>⚠️</div>
            <div style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
              Algo correu mal nesta página
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "24px", lineHeight: 1.5 }}>
              Encontrámos um erro inesperado. O resto do VoltarisOS continua a funcionar — tenta recarregar esta página.
            </div>
            <button
              onClick={this.handleReload}
              style={{
                padding: "12px 28px",
                background: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
                border: "none", borderRadius: "10px",
                color: "#0a0f1a", fontWeight: "700", fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
