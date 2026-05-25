import { useState } from "react"
import EnergyDashboard from "./modules/energy-dashboard/EnergyDashboard"
import "./modules/energy-dashboard/energy-dashboard.css"
import Sites from "./pages/Sites.jsx"
import Login from "./pages/Login"

function App() {
  const [page, setPage] = useState("dashboard")
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token")
    const company = localStorage.getItem("company")
    const color = localStorage.getItem("color")
    return token ? { token, company, color } : null
  })

  if (!user) return <Login onLogin={setUser} />

  return (
    <div>
      <nav style={{
        background: "#0a0f1a", padding: "10px 20px",
        display: "flex", gap: "16px", alignItems: "center",
        borderBottom: `2px solid ${user.color}`
      }}>
        <span style={{ color: user.color, fontWeight: "bold", marginRight: "16px" }}>
          ⚡ {user.company}
        </span>
        <button onClick={() => setPage("dashboard")}
          style={{ color: page === "dashboard" ? user.color : "white", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>
          Dashboard
        </button>
        <button onClick={() => setPage("sites")}
          style={{ color: page === "sites" ? user.color : "white", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>
          🗺️ Sites
        </button>
        <button onClick={() => { localStorage.clear(); setUser(null) }}
          style={{ marginLeft: "auto", color: "#f87171", background: "none", border: "none", cursor: "pointer" }}>
          Sair
        </button>
      </nav>
      {page === "dashboard" ? <EnergyDashboard /> : <Sites />}
    </div>
  )
}

export default App