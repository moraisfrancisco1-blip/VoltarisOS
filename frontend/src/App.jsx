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
import RevenueOptimization from "./pages/RevenueOptimization"
import RegulatoryCompliance from "./pages/RegulatoryCompliance"
import CommandCenter from "./pages/CommandCenter"
import ExecutiveScorecard from "./pages/ExecutiveScorecard"
import AnomalyDetection from "./pages/AnomalyDetection"
import Integrations from "./pages/Integrations"
import VirtualPowerPlant from "./pages/VirtualPowerPlant"
import GridResilienceScore from "./pages/GridResilienceScore"
import AIDispatchCopilot from "./pages/AIDispatchCopilot"
import EnergyMarketplace from "./pages/EnergyMarketplace"
import CarbonCredit from "./pages/CarbonCredit"
import CustomerPortal from "./pages/CustomerPortal"
import SolarMarketIntelligence from "./pages/SolarMarketIntelligence"
import EnergyArbitrage from "./pages/EnergyArbitrage"
import SolarDegradationLab from "./pages/SolarDegradationLab"
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
  revenue_opt: RevenueOptimization,
  compliance: RegulatoryCompliance,
  command_center: CommandCenter,
  scorecard: ExecutiveScorecard,
  anomaly: AnomalyDetection,
  integrations: Integrations,
  vpp: VirtualPowerPlant,
  resilience: GridResilienceScore,
  dispatch_copilot: AIDispatchCopilot,
  marketplace: EnergyMarketplace,
  carbon_credit: CarbonCredit,
  customer_portal: CustomerPortal,
  solar_intel: SolarMarketIntelligence,
  arbitrage: EnergyArbitrage,
  degradation_lab: SolarDegradationLab,
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])
  return isMobile
}

function AppShell({ user, onLogout }) {
  const [page, setPage] = useState("dashboard")
  const [mobileOpen, setMobileOpen] = useState(false)
  const isMobile = useIsMobile()
  const { theme, simMode, addToast } = useAppStore()

  // ── WebSocket live alerts ──────────────────────────────────────────────────
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:"
    const host  = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.hostname}:8000`
      : window.location.host
    const url = `${proto}//${host}/ws/alerts?token=demo`
    let ws, reconnectTimer
    const connect = () => {
      try {
        ws = new WebSocket(url)
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data)
            if (msg.type === "alert") {
              const severity = msg.severity || "info"
              const color = severity === "critical" ? "#f87171" : severity === "warning" ? "#f59e0b" : "#4ade80"
              addToast(`🔔 ${msg.message || msg.title || "New alert"}`, severity === "critical" ? "error" : "info")
            } else if (msg.type === "ping") {
              ws.send(JSON.stringify({ type: "pong" }))
            }
          } catch {}
        }
        ws.onerror = () => {}
        ws.onclose = () => { reconnectTimer = setTimeout(connect, 8000) }
      } catch {}
    }
    connect()
    return () => {
      clearTimeout(reconnectTimer)
      if (ws) { ws.onclose = null; ws.close() }
    }
  }, [addToast])

  const handleSetPage = (p) => {
    setPage(p)
    if (isMobile) setMobileOpen(false)
  }

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "D") {
        e.preventDefault()
        useAppStore.getState().setSimMode(!useAppStore.getState().simMode)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "L") {
        e.preventDefault()
        const t = useAppStore.getState().theme
        useAppStore.getState().setTheme(t === "dark" ? "light" : "dark")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const PageComponent = PAGES[page] || Dashboard
  const themeVars = THEMES[theme] || THEMES.dark

  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty("--bg", themeVars.bg)
    r.setProperty("--surface", themeVars.surface)
    r.setProperty("--surface2", themeVars.surface2)
    r.setProperty("--surface-glass", themeVars.surfaceGlass)
    r.setProperty("--border", themeVars.border)
    r.setProperty("--border-strong", themeVars.borderStrong)
    r.setProperty("--sidebar", themeVars.sidebar)
    r.setProperty("--text", themeVars.text)
    r.setProperty("--sub", themeVars.sub)
    r.setProperty("--glow", themeVars.glow)
    r.setProperty("--grid-line", themeVars.gridLine)
    r.setProperty("--tooltip-bg", themeVars.tooltipBg)
    r.setProperty("--gradient", themeVars.gradient)
    document.body.style.background = themeVars.bg
  }, [themeVars])

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: themeVars.bg,
      color: themeVars.text,
      position: "relative",
    }}>
      <SimBanner />

      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      <Sidebar
        page={page}
        setPage={handleSetPage}
        user={user}
        onLogout={onLogout}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        marginTop: simMode ? "38px" : 0,
        marginLeft: isMobile ? 0 : undefined,
      }}>
        <TopBar
          page={page}
          user={user}
          isMobile={isMobile}
          onMenuToggle={() => setMobileOpen(o => !o)}
        />
        <main style={{ flex: 1, overflow: "auto" }}>
          <PageComponent user={user} setPage={handleSetPage} />
        </main>
      </div>

      <AICopilot user={user} />
      <CommandPalette setPage={handleSetPage} onLogout={onLogout} />
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
