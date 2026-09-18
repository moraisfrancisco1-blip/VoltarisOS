import { create } from "zustand"
import { getInitialLanguage, isSupportedLanguage, LANG_STORAGE_KEY, FALLBACK_LANGUAGE } from "../i18n/translations"

// ─── Theme presets ────────────────────────────────────────────────────────────
// Each theme has: bg, surface, surface2 (widget inner), border, sidebar, text, sub,
// glow (ambient glow color), gridLine, tooltipBg
export const THEMES = {
  // ── Dark themes ── near-black canvases, one neon accent each. Sidebar/topbar
  // sit slightly DEEPER than the canvas so the chrome frames the content instead
  // of competing with it. Keys are stable (stored in localStorage as vos_theme).
  dark: {
    name: "dark", mode: "dark", label: "Volt",
    accent: "#f59e0b", accent2: "#f97316",
    bg: "#04060d", surface: "#0b1020", surface2: "#080c18", surfaceGlass: "#0b1020",
    border: "rgba(148,163,184,0.11)", borderStrong: "rgba(245,158,11,0.38)",
    sidebar: "#060912", sidebarText: "#f1f5f9", sidebarSub: "#8f9bb3",
    text: "#f8fafc", sub: "#9aa7bd",
    glow: "rgba(245,158,11,0.16)", gridLine: "rgba(148,163,184,0.07)", tooltipBg: "#0d1424",
    gradient: "linear-gradient(135deg, #0d1424 0%, #080c18 100%)",
  },
  midnight: {
    name: "midnight", mode: "dark", label: "Nebula",
    accent: "#a78bfa", accent2: "#22d3ee",
    bg: "#05030f", surface: "#0e0a24", surface2: "#0a071b", surfaceGlass: "#0e0a24",
    border: "rgba(167,139,250,0.15)", borderStrong: "rgba(167,139,250,0.42)",
    sidebar: "#07041a", sidebarText: "#f5f3ff", sidebarSub: "#9b93c4",
    text: "#f8fafc", sub: "#a5a0c8",
    glow: "rgba(139,92,246,0.22)", gridLine: "rgba(167,139,250,0.08)", tooltipBg: "#120d2e",
    gradient: "linear-gradient(135deg, #120d2e 0%, #0a071b 100%)",
  },
  forest: {
    name: "forest", mode: "dark", label: "Aurora",
    accent: "#34d399", accent2: "#22d3ee",
    bg: "#030a08", surface: "#081611", surface2: "#06110d", surfaceGlass: "#081611",
    border: "rgba(52,211,153,0.15)", borderStrong: "rgba(52,211,153,0.40)",
    sidebar: "#040d0a", sidebarText: "#ecfdf5", sidebarSub: "#84b5a2",
    text: "#f8fafc", sub: "#8fb8a8",
    glow: "rgba(52,211,153,0.18)", gridLine: "rgba(52,211,153,0.07)", tooltipBg: "#0a1c15",
    gradient: "linear-gradient(135deg, #0a1c15 0%, #06110d 100%)",
  },
  ocean: {
    name: "ocean", mode: "dark", label: "Abyss",
    accent: "#38bdf8", accent2: "#6366f1",
    bg: "#030811", surface: "#08152a", surface2: "#061020", surfaceGlass: "#08152a",
    border: "rgba(56,189,248,0.15)", borderStrong: "rgba(56,189,248,0.40)",
    sidebar: "#040a16", sidebarText: "#f0f9ff", sidebarSub: "#84a7c4",
    text: "#f8fafc", sub: "#8fb0cc",
    glow: "rgba(56,189,248,0.18)", gridLine: "rgba(56,189,248,0.07)", tooltipBg: "#0a1a33",
    gradient: "linear-gradient(135deg, #0a1a33 0%, #061020 100%)",
  },
  ember: {
    name: "ember", mode: "dark", label: "Ember",
    accent: "#fb923c", accent2: "#ef4444",
    bg: "#0a0403", surface: "#170b08", surface2: "#110806", surfaceGlass: "#170b08",
    border: "rgba(251,146,60,0.15)", borderStrong: "rgba(251,146,60,0.42)",
    sidebar: "#0c0504", sidebarText: "#fff7ed", sidebarSub: "#c49a84",
    text: "#fff7ed", sub: "#c9a18c",
    glow: "rgba(251,146,60,0.20)", gridLine: "rgba(251,146,60,0.07)", tooltipBg: "#1d0d09",
    gradient: "linear-gradient(135deg, #1d0d09 0%, #110806 100%)",
  },
  // ── Light themes ── crisp white surfaces, deep ink sidebar for contrast.
  light: {
    name: "light", mode: "light", label: "Pearl",
    accent: "#2563eb", accent2: "#7c3aed",
    bg: "#eef2f9", surface: "#ffffff", surface2: "#f4f7fd",
    surfaceGlass: "#ffffff",
    border: "rgba(15,23,42,0.09)", borderStrong: "rgba(15,23,42,0.18)",
    sidebar: "#0b1220", sidebarText: "#e2e8f0", sidebarSub: "#94a3b8",
    text: "#0b1220", sub: "#475569",
    glow: "rgba(37,99,235,0.10)", gridLine: "rgba(15,23,42,0.06)", tooltipBg: "#ffffff",
    gradient: "linear-gradient(135deg, #ffffff 0%, #f4f7fd 100%)",
  },
  ivory: {
    name: "ivory", mode: "light", label: "Ivory",
    accent: "#b45309", accent2: "#d97706",
    bg: "#f8f5ee", surface: "#fffdf8", surface2: "#f3efe4",
    surfaceGlass: "#fffdf8",
    border: "rgba(120,90,40,0.16)", borderStrong: "rgba(120,90,40,0.30)",
    sidebar: "#14100a", sidebarText: "#f5efe3", sidebarSub: "#a8997d",
    text: "#1c1917", sub: "#57534e",
    glow: "rgba(180,83,9,0.10)", gridLine: "rgba(120,90,40,0.08)", tooltipBg: "#fffdf8",
    gradient: "linear-gradient(135deg, #fffdf8 0%, #f3efe4 100%)",
  },
  arctic: {
    name: "arctic", mode: "light", label: "Arctic",
    accent: "#0284c7", accent2: "#0ea5e9",
    bg: "#eaf3fb", surface: "#ffffff", surface2: "#e6f1fd",
    surfaceGlass: "#ffffff",
    border: "rgba(2,90,150,0.13)", borderStrong: "rgba(2,90,150,0.26)",
    sidebar: "#061423", sidebarText: "#e0f2fe", sidebarSub: "#8fb0c9",
    text: "#0c1929", sub: "#475569",
    glow: "rgba(2,132,199,0.10)", gridLine: "rgba(2,90,150,0.07)", tooltipBg: "#ffffff",
    gradient: "linear-gradient(135deg, #ffffff 0%, #e6f1fd 100%)",
  },
}

// Every account is created with the backend default tenant colour (green). That is
// not a deliberate brand choice, so it must not override the active theme's accent.
// Priority: custom tenant colour (white-label) > accent picked in Settings > theme accent.
const LEGACY_DEFAULT_TENANT_COLOR = "#4ade80"
export function resolveAccent(userColor, theme) {
  if (userColor && userColor.toLowerCase() !== LEGACY_DEFAULT_TENANT_COLOR) return userColor
  return localStorage.getItem("vos_accent") || THEMES[theme]?.accent || "#f59e0b"
}

export const useAppStore = create((set, get) => ({
  // ─── Language ────────────────────────────────────────────────────────────────
  // Resolution: explicit saved choice → browser preference → English fallback.
  // An explicit user selection is persisted and never overridden by detection.
  language: getInitialLanguage(),
  setLanguage: (lang) => {
    const next = isSupportedLanguage(lang) ? lang : FALLBACK_LANGUAGE
    localStorage.setItem(LANG_STORAGE_KEY, next)
    set({ language: next })
  },

  // ─── Theme ───────────────────────────────────────────────────────────────────
  theme: localStorage.getItem("vos_theme") || "dark",
  setTheme: (t) => { localStorage.setItem("vos_theme", t); set({ theme: t }) },

  // Accent color
  accentColor: localStorage.getItem("vos_accent") || "#f59e0b",
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

  // Simplified nav: only the core testing workflow, rest hidden (not removed) behind "Ver tudo".
  // Defaults ON so real beta testers aren't dropped into ~38 nav items on day one.
  navSimplified: localStorage.getItem("vos_nav_simplified") !== "false",
  setNavSimplified: (v) => { localStorage.setItem("vos_nav_simplified", String(v)); set({ navSimplified: v }) },

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
    { id: 1, titleKey: "notif_n1_title", bodyKey: "notif_n1_body", minutesAgo: 2, read: false, type: "alert" },
    { id: 2, titleKey: "notif_n2_title", bodyKey: "notif_n2_body", minutesAgo: 14, read: false, type: "trade" },
    { id: 3, titleKey: "notif_n3_title", bodyKey: "notif_n3_body", minutesAgo: 60, read: true, type: "maintenance" },
    { id: 4, titleKey: "notif_n4_title", bodyKey: "notif_n4_body", minutesAgo: 180, read: true, type: "user" },
    { id: 5, titleKey: "notif_n5_title", bodyKey: "notif_n5_body", minutesAgo: 300, read: true, type: "carbon" },
  ],
  markAllRead: () => set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })) })),
  markRead: (id) => set(s => ({ notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })),
  addNotification: (n) => set(s => ({ notifications: [{ ...n, id: Date.now(), read: false }, ...s.notifications] })),

  // ─── Audit log ───────────────────────────────────────────────────────────────
  auditLog: [
    { id: 1, user: "admin@voltaris.com", actionKey: "audit_action_login", resource: "Auth", ip: "91.122.45.1", time: new Date(Date.now() - 300000).toISOString() },
    { id: 2, user: "admin@voltaris.com", actionKey: "audit_action_create_user", resource: "Users", ip: "91.122.45.1", time: new Date(Date.now() - 600000).toISOString() },
    { id: 3, user: "admin@voltaris.com", actionKey: "audit_action_export_report", resource: "Reports", ip: "91.122.45.1", time: new Date(Date.now() - 1200000).toISOString() },
    { id: 4, user: "admin@voltaris.com", actionKey: "audit_action_whitelabel", resource: "Settings", ip: "91.122.45.1", time: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, user: "admin@voltaris.com", actionKey: "audit_action_trading_agent", resource: "Autonomous", ip: "91.122.45.1", time: new Date(Date.now() - 7200000).toISOString() },
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
