// roleAccess.js — single source of truth for which pages each account role can see/use.
// SUPER_ADMIN always has full access (handled in helpers below).
//
// Roles (v2 — aligned with backend RBAC):
// - SUPER_ADMIN: Platform owner / dev team. Full access to everything.
// - TENANT_ADMIN: Organization admin. Manages users, audit, integrations, API keys for their own tenant.
// - TENANT_MEMBER: Standard end user / operator.
//
// Plan-based module access is handled in planFeatureGates.js (mirrors backend/permissions.py).

// Canonical RBAC v2 roles + normalization of legacy/variant spellings.
// Mirrors backend/security.py normalize_role() so the frontend always works
// with the same canonical values the backend issues.
export const CANONICAL_ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "TENANT_MEMBER"]

const ROLE_ALIASES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SUPERADMIN: "SUPER_ADMIN",
  ADMIN: "SUPER_ADMIN",
  OWNER: "SUPER_ADMIN",
  PLATFORM_ADMIN: "SUPER_ADMIN",
  TENANT_ADMIN: "TENANT_ADMIN",
  TENANTADMIN: "TENANT_ADMIN",
  ORG_ADMIN: "TENANT_ADMIN",
  ORGANIZATION_ADMIN: "TENANT_ADMIN",
  TENANT_MEMBER: "TENANT_MEMBER",
  TENANTMEMBER: "TENANT_MEMBER",
  MEMBER: "TENANT_MEMBER",
  USER: "TENANT_MEMBER",
  OPERATOR: "TENANT_MEMBER",
  VIEWER: "TENANT_MEMBER",
  INSTALLER: "TENANT_MEMBER",
}

export function normalizeRole(role) {
  if (role == null) return "TENANT_MEMBER"
  const key = String(role).trim().toUpperCase().replace(/-/g, "_").replace(/ /g, "_")
  if (!key) return "TENANT_MEMBER"
  return ROLE_ALIASES[key] || String(role).trim()
}

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
  return normalizeRole(role) === "SUPER_ADMIN"
}

export function isTenantAdmin(role) {
  const r = normalizeRole(role)
  return r === "TENANT_ADMIN" || r === "SUPER_ADMIN"
}

export function isAdminRole(role) {
  const r = normalizeRole(role)
  return r === "SUPER_ADMIN" || r === "TENANT_ADMIN"
}

export function getAllowedPages(role, allPageIds) {
  const r = normalizeRole(role)
  if (r === "SUPER_ADMIN") return allPageIds
  return ROLE_PAGE_ACCESS[r] || ROLE_PAGE_ACCESS.TENANT_MEMBER
}

export function canAccessPage(role, pageId) {
  const r = normalizeRole(role)
  if (r === "SUPER_ADMIN") return true
  const allowed = ROLE_PAGE_ACCESS[r] || ROLE_PAGE_ACCESS.TENANT_MEMBER
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