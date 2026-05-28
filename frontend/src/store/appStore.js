import { create } from "zustand"

// ─── Theme presets ────────────────────────────────────────────────────────────
export const THEMES = {
  dark:     { name: "dark",     bg: "#0a0f1a", surface: "#111827", border: "#1a2234", sidebar: "#080d18", text: "#e5e7eb", sub: "#6b7280" },
  light:    { name: "light",    bg: "#f1f5f9", surface: "#ffffff", border: "#e2e8f0", sidebar: "#1e293b", text: "#0f172a", sub: "#64748b" },
  midnight: { name: "midnight", bg: "#050510", surface: "#0d0d1e", border: "#1a1a3a", sidebar: "#03030d", text: "#e0e0ff", sub: "#6060a0" },
  forest:   { name: "forest",   bg: "#071a0e", surface: "#0d1f12", border: "#1a3024", sidebar: "#040f08", text: "#d4f0dc", sub: "#5a8a6a" },
  ocean:    { name: "ocean",    bg: "#020f1a", surface: "#071828", border: "#0e2a3d", sidebar: "#010810", text: "#d0eaf8", sub: "#4a80a0" },
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
