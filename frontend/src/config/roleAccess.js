// roleAccess.js — single source of truth for which pages each account role can see/use.
// SUPER_ADMIN always has full access (handled in helpers below).
//
// Roles (v2 — aligned with backend RBAC):
// - SUPER_ADMIN: Platform owner / dev team. Full access to everything.
// - TENANT_ADMIN: Organization admin. Manages users, audit, integrations, API keys for their own tenant.
// - TENANT_MEMBER: Standard end user / operator.
//
// Plan-based module access is handled in planFeatureGates.js (mirrors backend/permissions.py).

export const ROLE_PAGE_ACCESS = {
  TENANT_ADMIN: [
    // Core
    "dashboard", "fleet", "map", "sites", "twin", "command_center",
    // Energia
    "battery", "ev", "grid", "carbon_credit", "carbon", "vpp", "resilience",
    // Mercados
    "trading", "marketplace", "dispatch_copilot", "autonomous", "forecasting",
    "revenue_opt", "compliance", "solar_intel", "arbitrage", "degradation_lab",
    // Operações
    "alerts", "anomaly", "maintenance", "reports", "scorecard",
    // Admin (gestão interna)
    "users", "integrations", "settings", "customer_portal",
    "whitelabel", "audit", "apikeys", "export", "investor",
  ],
  TENANT_MEMBER: [
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
}

export function isSuperAdmin(role) {
  return role === "SUPER_ADMIN"
}

export function isTenantAdmin(role) {
  return role === "TENANT_ADMIN" || role === "SUPER_ADMIN"
}

export function isAdminRole(role) {
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN"
}

export function getAllowedPages(role, allPageIds) {
  if (role === "SUPER_ADMIN") return allPageIds
  return ROLE_PAGE_ACCESS[role] || ROLE_PAGE_ACCESS.TENANT_MEMBER
}

export function canAccessPage(role, pageId) {
  if (role === "SUPER_ADMIN") return true
  const allowed = ROLE_PAGE_ACCESS[role] || ROLE_PAGE_ACCESS.TENANT_MEMBER
  return allowed.includes(pageId)
}

// SUPER_ADMIN-exclusive page IDs — only rendered when role === SUPER_ADMIN
export const SUPER_ADMIN_ONLY_PAGES = [
  "super_admin_tenants",
  "super_admin_system_health",
]

// Roles a user can pick for themselves at self-registration — never SUPER_ADMIN/TENANT_ADMIN.
// TENANT_ADMIN is only granted via admin invite or manual assignment.
export const SELF_REGISTER_ROLES = [
  { value: "TENANT_MEMBER", labelKey: "role_tenant_member" },
]