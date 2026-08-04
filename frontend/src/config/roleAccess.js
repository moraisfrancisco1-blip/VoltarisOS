// roleAccess.js — single source of truth for which pages each account role can see/use.
// superadmin/admin always have full access (not listed explicitly, handled in helpers below).
//
// Roles:
// - operator: day-to-day energy ops staff — everything except account/tenant administration.
// - viewer: read-only monitoring — dashboards, maps, reports, alerts. No trading/dispatch actions,
//           no admin.
// - investor: financial/ESG focused — portfolio dashboard, revenue, compliance, reports. No
//             device-level or trading controls, no admin.

export const ROLE_PAGE_ACCESS = {
  operator: [
    // Core
    "dashboard", "fleet", "map", "sites", "twin", "command_center",
    // Energia
    "battery", "ev", "grid", "carbon_credit", "carbon", "vpp", "resilience",
    // Mercados
    "trading", "marketplace", "dispatch_copilot", "autonomous", "forecasting",
    "revenue_opt", "compliance", "solar_intel", "arbitrage", "degradation_lab",
    // Operações
    "alerts", "anomaly", "maintenance", "reports", "scorecard",
  ],
  viewer: [
    "dashboard", "map", "sites", "fleet", "twin", "command_center",
    "battery", "ev", "grid", "carbon", "carbon_credit", "vpp", "resilience",
    "alerts", "anomaly", "maintenance", "reports",
  ],
  investor: [
    "dashboard", "sites",
    "investor", "scorecard", "reports",
    "revenue_opt", "solar_intel", "carbon_credit", "compliance",
  ],
}

const ADMIN_ROLES = ["admin", "superadmin"]

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

export function getAllowedPages(role, allPageIds) {
  if (isAdminRole(role)) return allPageIds
  return ROLE_PAGE_ACCESS[role] || ROLE_PAGE_ACCESS.operator
}

export function canAccessPage(role, pageId, allPageIds) {
  if (isAdminRole(role)) return true
  const allowed = ROLE_PAGE_ACCESS[role] || ROLE_PAGE_ACCESS.operator
  return allowed.includes(pageId)
}

// Roles a user can pick for themselves at self-registration — never admin/superadmin.
export const SELF_REGISTER_ROLES = [
  { value: "operator", labelKey: "role_operator" },
  { value: "viewer", labelKey: "role_viewer" },
  { value: "investor", labelKey: "role_investor" },
]
