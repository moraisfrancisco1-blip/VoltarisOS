import { create } from "zustand"

// ─── Theme presets ────────────────────────────────────────────────────────────
// Each theme has: bg, surface, surface2 (widget inner), border, sidebar, text, sub,
// glow (ambient glow color), gridLine, tooltipBg
export const THEMES = {
  dark: {
    name: "dark",
    label: "Obsidian",
    bg: "#090e1a",
    surface: "rgba(15,22,40,0.95)",
    surface2: "rgba(10,16,30,0.8)",
    surfaceGlass: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.07)",
    borderStrong: "rgba(255,255,255,0.12)",
    sidebar: "#070c17",
    text: "#f0f4ff",
    sub: "#5a6a8a",
    glow: "rgba(74,222,128,0.15)",
    gridLine: "rgba(255,255,255,0.04)",
    tooltipBg: "rgba(8,14,28,0.96)",
    gradient: "linear-gradient(135deg, rgba(15,22,40,0.95) 0%, rgba(9,14,26,0.98) 100%)",
  },
  light: {
    name: "light",
    label: "Pearl",
    bg: "#f0f4fc",
    surface: "rgba(255,255,255,0.92)",
    surface2: "rgba(245,248,255,0.9)",
    surfaceGlass: "rgba(255,255,255,0.7)",
    border: "rgba(0,0,0,0.07)",
    borderStrong: "rgba(0,0,0,0.13)",
    sidebar: "#1a2540",
    text: "#0d1b3e",
    sub: "#6b7a99",
    glow: "rgba(59,130,246,0.1)",
    gridLine: "rgba(0,0,0,0.05)",
    tooltipBg: "rgba(255,255,255,0.98)",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.92) 0%, rgba(240,244,252,0.95) 100%)",
  },
  midnight: {
    name: "midnight",
    label: "Nebula",
    bg: "#04040f",
    surface: "rgba(10,8,28,0.97)",
    surface2: "rgba(6,5,20,0.9)",
    surfaceGlass: "rgba(100,80,255,0.04)",
    border: "rgba(120,100,255,0.12)",
    borderStrong: "rgba(140,120,255,0.22)",
    sidebar: "#020209",
    text: "#e8e4ff",
    sub: "#6655aa",
    glow: "rgba(120,80,255,0.2)",
    gridLine: "rgba(100,80,255,0.06)",
    tooltipBg: "rgba(6,4,20,0.97)",
    gradient: "linear-gradient(135deg, rgba(12,8,36,0.97) 0%, rgba(6,4,22,0.99) 100%)",
  },
  forest: {
    name: "forest",
    label: "Aurora",
    bg: "#030e07",
    surface: "rgba(5,18,10,0.97)",
    surface2: "rgba(3,12,7,0.9)",
    surfaceGlass: "rgba(40,200,100,0.04)",
    border: "rgba(40,200,80,0.10)",
    borderStrong: "rgba(60,220,100,0.20)",
    sidebar: "#020a04",
    text: "#c8f0d8",
    sub: "#3d7a55",
    glow: "rgba(40,200,80,0.18)",
    gridLine: "rgba(40,200,80,0.05)",
    tooltipBg: "rgba(3,12,7,0.97)",
    gradient: "linear-gradient(135deg, rgba(6,22,12,0.97) 0%, rgba(3,13,7,0.99) 100%)",
  },
  ocean: {
    name: "ocean",
    label: "Abyss",
    bg: "#010b18",
    surface: "rgba(4,16,32,0.97)",
    surface2: "rgba(2,10,22,0.9)",
    surfaceGlass: "rgba(20,120,255,0.04)",
    border: "rgba(20,120,220,0.12)",
    borderStrong: "rgba(30,140,255,0.22)",
    sidebar: "#010710",
    text: "#c8e8ff",
    sub: "#2a6a9a",
    glow: "rgba(20,120,255,0.18)",
    gridLine: "rgba(20,120,255,0.05)",
    tooltipBg: "rgba(2,10,22,0.97)",
    gradient: "linear-gradient(135deg, rgba(4,18,36,0.97) 0%, rgba(2,11,22,0.99) 100%)",
  },
  ember: {
    name: "ember",
    label: "Ember",
    bg: "#0f0500",
    surface: "rgba(24,10,2,0.97)",
    surface2: "rgba(16,6,1,0.9)",
    surfaceGlass: "rgba(255,100,20,0.04)",
    border: "rgba(220,80,20,0.12)",
    borderStrong: "rgba(240,100,30,0.22)",
    sidebar: "#0a0300",
    text: "#fde8d4",
    sub: "#8a4020",
    glow: "rgba(240,100,20,0.2)",
    gridLine: "rgba(220,80,20,0.05)",
    tooltipBg: "rgba(16,5,1,0.97)",
    gradient: "linear-gradient(135deg, rgba(28,10,2,0.97) 0%, rgba(16,6,1,0.99) 100%)",
  },
}

export const useAppStore = create((set, get) => ({
  // ─── Language ────────────────────────────────────────────────────────────────
  language: localStorage.getItem("vos_lang") || "pt",
  setLanguage: (lang) => { localStorage.setItem("vos_lang", lang); set({ language: lang }) },

  // ─── Theme ───────────────────────────────────────────────────────────────────
  theme: localStorage.getItem("vos_theme") || "dark",
  setTheme: (t) => { localStorage.setItem("vos_theme", t); set({ theme: t }) },

  // Accent color
  accentColor: localStorage.getItem("vos_accent") || "#4ade80",
  setAccentColor: (c) => { localStorage.setItem("vos_accent", c); set({ accentColor: c }) },

  // Interface density: compact | comfortable | spacious
  density: localStorage.getItem("vos_density") || "comfortable",
  setDensity: (d) => { localStorage.setItem("vos_density", d); set({ density: d }) },

  // Animations
  animations: localStorage.getItem("vos_animations") !== "false",
  setAnimations: (v) => { localStorage.setItem("vos_animations", String(v)); set({ animations: v }) },

  // Sidebar collapsed by default
  sidebarDefaultCollapsed: localStorage.getItem("vos_sidebar_collapsed") === "true",
  setSidebarDefaultCollapsed: (v) => { localStorage.setItem("vos_sidebar_collapsed", String(v)); set({ sidebarDefaultCollapsed: v }) },

  // ─── Dashboard layout ────────────────────────────────────────────────────────
  // User can toggle visibility of each widget
  dashWidgets: JSON.parse(localStorage.getItem("vos_dash_widgets") || JSON.stringify({
    kpis: true,
    prodVsConsumption: true,
    marketPrice: true,
    battery: true,
    ai: true,
    sites: true,
    soc24h: true,
    revenue: true,
    weatherForecast: true,
    recentAlerts: true,
    co2saved: true,
    gridBalance: true,
  })),
  setDashWidget: (key, val) => {
    const next = { ...get().dashWidgets, [key]: val }
    localStorage.setItem("vos_dash_widgets", JSON.stringify(next))
    set({ dashWidgets: next })
  },

  // Dashboard time range for charts
  dashTimeRange: localStorage.getItem("vos_dash_range") || "24h",
  setDashTimeRange: (r) => { localStorage.setItem("vos_dash_range", r); set({ dashTimeRange: r }) },

  // Dashboard chart type preference
  dashChartStyle: localStorage.getItem("vos_chart_style") || "area",
  setDashChartStyle: (s) => { localStorage.setItem("vos_chart_style", s); set({ dashChartStyle: s }) },

  // ─── Simulation mode ─────────────────────────────────────────────────────────
  simMode: localStorage.getItem("vos_sim") === "true",
  setSimMode: (v) => { localStorage.setItem("vos_sim", String(v)); set({ simMode: v }) },

  // ─── Toasts ──────────────────────────────────────────────────────────────────
  toasts: [],
  addToast: (msg, type = "info") => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4500)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // ─── Notifications ───────────────────────────────────────────────────────────
  notifications: [
    { id: 1, title: "Battery SOC crítico", body: "Site Rotterdam — 8% SOC", time: "2m atrás", read: false, type: "alert" },
    { id: 2, title: "Ordem de trade executada", body: "EPEX venda 45 MWh @ €128/MWh", time: "14m atrás", read: false, type: "trade" },
    { id: 3, title: "Manutenção prevista", body: "Inversor A3 — substituição em 6 dias", time: "1h atrás", read: true, type: "maintenance" },
    { id: 4, title: "Novo utilizador registado", body: "j.silva@greenvolt.pt", time: "3h atrás", read: true, type: "user" },
    { id: 5, title: "Relatório CO₂ gerado", body: "Maio 2026 — 12.4t poupadas", time: "5h atrás", read: true, type: "carbon" },
  ],
  markAllRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),
  markRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  addNotification: (n) => set(s => ({ notifications: [{ ...n, id: Date.now(), read: false }, ...s.notifications] })),

  // ─── Audit log ───────────────────────────────────────────────────────────────
  auditLog: [
    { id: 1, user: "admin@voltaris.com", action: "Login", resource: "Auth", ip: "91.122.45.1", time: new Date(Date.now() - 300000).toISOString() },
    { id: 2, user: "admin@voltaris.com", action: "Criou utilizador", resource: "Users", ip: "91.122.45.1", time: new Date(Date.now() - 600000).toISOString() },
    { id: 3, user: "admin@voltaris.com", action: "Exportou relatório", resource: "Reports", ip: "91.122.45.1", time: new Date(Date.now() - 1200000).toISOString() },
    { id: 4, user: "admin@voltaris.com", action: "Alterou white-label", resource: "Settings", ip: "91.122.45.1", time: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, user: "admin@voltaris.com", action: "Trading agent ativado", resource: "Autonomous", ip: "91.122.45.1", time: new Date(Date.now() - 7200000).toISOString() },
  ],
  addAuditEntry: (entry) => set(s => ({
    auditLog: [{ ...entry, id: Date.now(), time: new Date().toISOString(), ip: "91.122.45.1" }, ...s.auditLog]
  })),

  // ─── Command palette ─────────────────────────────────────────────────────────
  cmdOpen: false,
  setCmdOpen: (v) => set({ cmdOpen: v }),

  // ─── Shortcuts overlay ───────────────────────────────────────────────────────
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),

  // ─── Onboarding ──────────────────────────────────────────────────────────────
  onboarded: localStorage.getItem("vos_onboarded") === "true",
  setOnboarded: () => { localStorage.setItem("vos_onboarded", "true"); set({ onboarded: true }) },

  // ─── Energy settings ─────────────────────────────────────────────────────────
  energySettings: JSON.parse(localStorage.getItem("vos_energy") || JSON.stringify({
    currency: "EUR",
    priceUnit: "MWh", // MWh or kWh
    powerUnit: "kW",  // kW or MW
    timezone: "Europe/Lisbon",
    gridImportTariff: 0.18,
    gridExportTariff: 0.08,
    feedInLimit: 100, // % of inverter capacity
    socMin: 10,
    socMax: 95,
    selfConsumptionTarget: 80,
    peakShavingThreshold: 150,
    gridFrequency: 50, // Hz
    voltageLevel: 400, // V
  })),
  setEnergySettings: (s) => {
    const next = { ...get().energySettings, ...s }
    localStorage.setItem("vos_energy", JSON.stringify(next))
    set({ energySettings: next })
  },

  // ─── Trading settings ────────────────────────────────────────────────────────
  tradingSettings: JSON.parse(localStorage.getItem("vos_trading") || JSON.stringify({
    autoTradingEnabled: false,
    minPriceSell: 80,
    maxPriceBuy: 50,
    maxPositionSize: 500, // kWh
    market: "EPEX",
    tradingMode: "conservative", // conservative | balanced | aggressive
    notifyOnTrade: true,
    slippageTolerance: 2,
    riskScore: 5,
    hedgingEnabled: false,
    dayAheadEnabled: true,
    intraday: true,
    balancingMarket: false,
  })),
  setTradingSettings: (s) => {
    const next = { ...get().tradingSettings, ...s }
    localStorage.setItem("vos_trading", JSON.stringify(next))
    set({ tradingSettings: next })
  },

  // ─── Alert settings ──────────────────────────────────────────────────────────
  alertSettings: JSON.parse(localStorage.getItem("vos_alerts") || JSON.stringify({
    emailAlerts: true,
    smsAlerts: false,
    pushAlerts: true,
    slackWebhook: "",
    socLowThreshold: 15,
    socHighThreshold: 95,
    tempHighThreshold: 45,
    priceSpike: 120,
    priceDip: 30,
    dailyDigest: true,
    weeklyReport: true,
    maintenanceReminder: true,
    tradeAlerts: true,
    offlineAlert: true,
  })),
  setAlertSettings: (s) => {
    const next = { ...get().alertSettings, ...s }
    localStorage.setItem("vos_alerts", JSON.stringify(next))
    set({ alertSettings: next })
  },
}))
