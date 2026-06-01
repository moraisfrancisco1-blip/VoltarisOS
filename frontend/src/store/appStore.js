import { create } from "zustand"

// ─── Theme presets ────────────────────────────────────────────────────────────
// Each theme has: bg, surface, surface2 (widget inner), border, sidebar, text, sub,
// glow (ambient glow color), gridLine, tooltipBg
export const THEMES = {
  dark: {
    name: "dark",
    label: "Obsidian",
    bg: "#0f172a",
    surface: "#1e293b",
    surface2: "#172033",
    surfaceGlass: "rgba(30,41,59,0.85)",
    border: "rgba(255,255,255,0.10)",
    borderStrong: "rgba(255,255,255,0.18)",
    sidebar: "#0c1322",
    text: "#f1f5f9",
    sub: "#94a3b8",
    glow: "rgba(74,222,128,0.15)",
    gridLine: "rgba(255,255,255,0.06)",
    tooltipBg: "#1e293b",
    gradient: "linear-gradient(135deg, #1e293b 0%, #172033 100%)",
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
    bg: "#080816",
    surface: "rgba(18,14,44,0.90)",
    surface2: "rgba(14,10,36,0.88)",
    surfaceGlass: "rgba(120,100,255,0.06)",
    border: "rgba(140,120,255,0.16)",
    borderStrong: "rgba(160,140,255,0.28)",
    sidebar: "#050510",
    text: "#e8e4ff",
    sub: "#8877cc",
    glow: "rgba(120,80,255,0.2)",
    gridLine: "rgba(120,100,255,0.08)",
    tooltipBg: "rgba(10,8,28,0.97)",
    gradient: "linear-gradient(135deg, rgba(20,16,48,0.92) 0%, rgba(10,8,30,0.96) 100%)",
  },
  forest: {
    name: "forest",
    label: "Aurora",
    bg: "#071410",
    surface: "rgba(12,32,20,0.90)",
    surface2: "rgba(8,24,15,0.88)",
    surfaceGlass: "rgba(40,200,100,0.06)",
    border: "rgba(40,200,80,0.14)",
    borderStrong: "rgba(60,220,100,0.24)",
    sidebar: "#050e08",
    text: "#c8f0d8",
    sub: "#5aaa70",
    glow: "rgba(40,200,80,0.18)",
    gridLine: "rgba(40,200,80,0.07)",
    tooltipBg: "rgba(6,16,10,0.97)",
    gradient: "linear-gradient(135deg, rgba(14,36,22,0.92) 0%, rgba(7,16,11,0.96) 100%)",
  },
  ocean: {
    name: "ocean",
    label: "Abyss",
    bg: "#050f1e",
    surface: "rgba(10,28,52,0.90)",
    surface2: "rgba(7,20,40,0.88)",
    surfaceGlass: "rgba(20,120,255,0.06)",
    border: "rgba(30,130,220,0.16)",
    borderStrong: "rgba(40,150,255,0.26)",
    sidebar: "#030a14",
    text: "#c8e8ff",
    sub: "#4a90c0",
    glow: "rgba(20,120,255,0.18)",
    gridLine: "rgba(20,120,255,0.07)",
    tooltipBg: "rgba(5,14,28,0.97)",
    gradient: "linear-gradient(135deg, rgba(10,28,52,0.92) 0%, rgba(5,14,28,0.96) 100%)",
  },
  ember: {
    name: "ember",
    label: "Ember",
    bg: "#180800",
    surface: "rgba(40,18,5,0.90)",
    surface2: "rgba(30,12,3,0.88)",
    surfaceGlass: "rgba(255,100,20,0.06)",
    border: "rgba(220,80,20,0.16)",
    borderStrong: "rgba(240,110,30,0.26)",
    sidebar: "#0f0500",
    text: "#fde8d4",
    sub: "#c06030",
    glow: "rgba(240,100,20,0.2)",
    gridLine: "rgba(220,80,20,0.07)",
    tooltipBg: "rgba(22,8,2,0.97)",
    gradient: "linear-gradient(135deg, rgba(44,18,4,0.92) 0%, rgba(22,8,2,0.96) 100%)",
  },
  // ── Light theme 2: Ivory ─────────────────────────────────────────────────────
  ivory: {
    name: "ivory",
    label: "Ivory",
    bg: "#faf8f4",
    surface: "rgba(255,253,248,0.97)",
    surface2: "rgba(245,242,234,0.92)",
    surfaceGlass: "rgba(255,255,255,0.75)",
    border: "rgba(180,160,120,0.18)",
    borderStrong: "rgba(160,130,80,0.28)",
    sidebar: "#2c2318",
    text: "#1a150a",
    sub: "#7a6a50",
    glow: "rgba(200,160,60,0.12)",
    gridLine: "rgba(160,130,80,0.08)",
    tooltipBg: "rgba(255,253,248,0.98)",
    gradient: "linear-gradient(135deg, rgba(255,253,248,0.97) 0%, rgba(245,242,234,0.95) 100%)",
  },
  // ── Light theme 3: Arctic ────────────────────────────────────────────────────
  arctic: {
    name: "arctic",
    label: "Arctic",
    bg: "#eef4fb",
    surface: "rgba(255,255,255,0.96)",
    surface2: "rgba(232,242,255,0.92)",
    surfaceGlass: "rgba(255,255,255,0.78)",
    border: "rgba(100,160,220,0.16)",
    borderStrong: "rgba(80,140,210,0.28)",
    sidebar: "#0f2244",
    text: "#0a1e3a",
    sub: "#5580aa",
    glow: "rgba(80,160,240,0.12)",
    gridLine: "rgba(80,140,210,0.07)",
    tooltipBg: "rgba(255,255,255,0.98)",
    gradient: "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(232,242,255,0.94) 100%)",
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
