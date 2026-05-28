import { create } from "zustand"

export const useAppStore = create((set, get) => ({
  // Theme
  theme: localStorage.getItem("vos_theme") || "dark",
  setTheme: (t) => { localStorage.setItem("vos_theme", t); set({ theme: t }) },

  // Simulation mode
  simMode: localStorage.getItem("vos_sim") === "true",
  setSimMode: (v) => { localStorage.setItem("vos_sim", String(v)); set({ simMode: v }) },

  // Toasts
  toasts: [],
  addToast: (msg, type = "info") => {
    const id = Date.now()
    set(s => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 4500)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // Notifications
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

  // Audit log
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

  // Command palette
  cmdOpen: false,
  setCmdOpen: (v) => set({ cmdOpen: v }),

  // Shortcuts overlay
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),

  // Onboarding
  onboarded: localStorage.getItem("vos_onboarded") === "true",
  setOnboarded: () => { localStorage.setItem("vos_onboarded", "true"); set({ onboarded: true }) },
}))
