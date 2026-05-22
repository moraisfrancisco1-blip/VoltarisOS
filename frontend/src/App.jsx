import { useState } from "react"
import EnergyDashboard from "./modules/energy-dashboard/EnergyDashboard"
import "./modules/energy-dashboard/energy-dashboard.css"
import Sites from "./pages/Sites"

function App() {
  const [page, setPage] = useState("dashboard")

  return (
    <div>
      <nav style={{
        background: "#0a0f1a",
        padding: "10px 20px",
        display: "flex",
        gap: "16px",
        borderBottom: "1px solid #1e3a2f"
      }}>
        <button
          onClick={() => setPage("dashboard")}
          style={{ color: page === "dashboard" ? "#4ade80" : "white", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
        >
          ⚡ Dashboard
        </button>
        <button
          onClick={() => setPage("sites")}
          style={{ color: page === "sites" ? "#4ade80" : "white", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
        >
          🗺️ Sites
        </button>
      </nav>
      {page === "dashboard" ? <EnergyDashboard /> : <Sites />}
    </div>
  )
}

export default App