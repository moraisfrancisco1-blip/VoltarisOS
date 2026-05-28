import { useState, useEffect } from "react"
import Login from "./pages/Login"
import Sidebar from "./components/Sidebar"
import TopBar from "./components/TopBar"
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
import AuditLog from "./pages/AuditLog"
import ApiKeys from "./pages/ApiKeys"
import ExportCenter from "./pages/ExportCenter"
import AICopilot from "./components/AICopilot"
import CommandPalette from "./components/CommandPalette"
import ToastContainer from "./components/ToastContainer"
import ShortcutsOverlay from "./components/ShortcutsOverlay"
import SimBanner from "./components/SimBanner"
import OnboardingWizard from "./components/OnboardingWizard"
import { useAppStore, THEMES } from "./store/appStore"
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
  audit: AuditLog,
  apikeys: ApiKeys,
  export: ExportCenter,
}

function AppShell({ user, onLogout }) {
  const [page, setPage] = useState("dashboard")
  const { theme, simMode } = useAppStore()

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd/Ctrl+Shift+D = sim mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "D") {
        e.preventDefault()
        useAppStore.getState().setSimMode(!useAppStore.getState().simMode)
      }
      // Cmd/Ctrl+Shift+L = theme toggle
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "L") {
        e.preventDefault()
        const t = useAppStore.getState().theme
        useAppStore.getState().setTheme(t === "dark" ? "light" : "dark")
      }
      // G + key navigation
      if (e.key === "g" && !e.ctrlKey && !e.metaKey) {
        // handled by sequence — simple single letters
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const PageComponent = PAGES[page] || Dashboard
  const themeVars = THEMES[theme] || THEMES.dark

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: themeVars.bg,
      color: themeVars.text,
    }}>
      <SimBanner />
      <Sidebar page={page} setPage={setPage} user={user} onLogout={onLogout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", marginTop: simMode ? "38px" : 0 }}>
        <TopBar page={page} user={user} />
        <main style={{ flex: 1, overflow: "auto" }}>
          <PageComponent user={user} setPage={setPage} />
        </main>
      </div>
      <AICopilot user={user} />
      <CommandPalette setPage={setPage} onLogout={onLogout} />
      <ShortcutsOverlay />
      <ToastContainer />
      <OnboardingWizard />
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token")
    const company = localStorage.getItem("company")
    const color = localStorage.getItem("color")
    const role = localStorage.getItem("role") || "admin"
    return token ? { token, company, color, role } : null
  })

  const handleLogout = () => { localStorage.clear(); setUser(null) }

  if (!user) return <Login onLogin={(u) => {
    localStorage.setItem("role", u.role || "admin")
    setUser({ ...u, role: u.role || "admin" })
  }} />

  return <AppShell user={user} onLogout={handleLogout} />
}
