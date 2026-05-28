import { useState } from "react"
import Login from "./pages/Login"
import Sidebar from "./components/Sidebar"
import Dashboard from "./pages/Dashboard"
import Sites from "./pages/Sites"
import FleetManagement from "./pages/FleetManagement"
import TradingDashboard from "./pages/TradingDashboard"
import BatteryManagement from "./pages/BatteryManagement"
import EVCharging from "./pages/EVCharging"
import GridServices from "./pages/GridServices"
import ForecastingDashboard from "./pages/ForecastingDashboard"
import MapView from "./pages/MapView"
import AlertsNotifications from "./pages/AlertsNotifications"
import ReportsAnalytics from "./pages/ReportsAnalytics"
import UserManagement from "./pages/UserManagement"
import InvestorView from "./pages/InvestorView"
import Settings from "./pages/Settings"
import CarbonDashboard from "./pages/CarbonDashboard"
import AutonomousTrading from "./pages/AutonomousTrading"
import DigitalTwin from "./pages/DigitalTwin"
import PredictiveMaintenance from "./pages/PredictiveMaintenance"
import WhiteLabel from "./pages/WhiteLabel"
import AICopilot from "./components/AICopilot"
import "./index.css"

const PAGES = {
  dashboard: Dashboard,
  fleet: FleetManagement,
  trading: TradingDashboard,
  battery: BatteryManagement,
  ev: EVCharging,
  grid: GridServices,
  forecasting: ForecastingDashboard,
  map: MapView,
  alerts: AlertsNotifications,
  reports: ReportsAnalytics,
  users: UserManagement,
  investor: InvestorView,
  settings: Settings,
  sites: Sites,
  carbon: CarbonDashboard,
  autonomous: AutonomousTrading,
  twin: DigitalTwin,
  maintenance: PredictiveMaintenance,
  whitelabel: WhiteLabel,
}

export default function App() {
  const [page, setPage] = useState("dashboard")
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token")
    const company = localStorage.getItem("company")
    const color = localStorage.getItem("color")
    const role = localStorage.getItem("role") || "admin"
    return token ? { token, company, color, role } : null
  })

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem("role", u.role || "admin")
    setUser({ ...u, role: u.role || "admin" })
  }} />

  const PageComponent = PAGES[page] || Dashboard

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0a0f1a", color: "white" }}>
      <Sidebar page={page} setPage={setPage} user={user} onLogout={() => {
        localStorage.clear(); setUser(null)
      }} />
      <main style={{ flex: 1, overflow: "auto" }}>
        <PageComponent user={user} />
      </main>
      <AICopilot user={user} />
    </div>
  )
}
