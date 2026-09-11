// planFeatureGates.js — mirrors backend/permissions.py module access matrix.
//
// Maps each frontend page ID to backend module key and minimum required plan.
// Used by Sidebar to show lock icons (🔒) and trigger Paywall modal.
//
// Plan tier order: beta < home < smart < starter < pro < enterprise

// Plan → max_sites
export const PLAN_MAX_SITES = {
  beta: 1,
  home: 1,
  smart: 2,
  starter: 5,
  pro: 20,
  enterprise: 999,
}

// Plan tier ordering for comparison
export const PLAN_TIER_ORDER = {
  beta: 0,
  home: 1,
  smart: 2,
  starter: 3,
  pro: 4,
  enterprise: 5,
}

// Page ID → Backend module key
export const PAGE_TO_MODULE = {
  dashboard: "core_dashboard",
  fleet: "core_fleet",
  sites: "core_sites",
  map: "core_map",
  carbon: "core_carbon",
  carbon_credit: "core_carbon_credit",
  scorecard: "core_scorecard",
  settings: "core_settings",
  command_center: "core_command_center",
  twin: "core_twin",
  battery: "energy_battery",
  ev: "energy_ev",
  grid: "energy_grid",
  vpp: "energy_vpp",
  resilience: "energy_resilience",
  trading: "markets_trading",
  marketplace: "markets_marketplace",
  forecasting: "markets_forecasting",
  arbitrage: "markets_arbitrage",
  autonomous: "ai_autonomous",
  dispatch_copilot: "ai_dispatch_copilot",
  degradation_lab: "ai_degradation_lab",
  solar_intel: "ai_solar_intel",
  revenue_opt: "ai_revenue_opt",
  alerts: "ops_alerts",
  anomaly: "ops_anomaly",
  reports: "ops_reports",
  maintenance: "ops_maintenance",
  users: "admin_users",
  integrations: "admin_integrations",
  whitelabel: "admin_whitelabel",
  audit: "admin_audit",
  apikeys: "admin_apikeys",
  export: "admin_export",
  customer_portal: "admin_customer_portal",
  compliance: "admin_compliance",
  investor: "admin_investor",
}

// Module → Minimum plan required to unlock (for Paywall modal)
export const MODULE_MINIMUM_PLAN = {
  // Core — Home+
  core_dashboard: "home",
  core_fleet: "home",
  core_sites: "home",
  core_map: "home",
  core_carbon: "home",
  core_carbon_credit: "home",
  core_scorecard: "home",
  core_settings: "home",
  core_command_center: "home",
  core_twin: "home",

  // Energy — Home+
  energy_battery: "home",
  energy_ev: "home",
  energy_grid: "home",
  energy_vpp: "starter",
  energy_resilience: "starter",

  // Basic AI — Smart+
  ai_trading_basic: "smart",
  ai_forecasting_basic: "smart",
  markets_arbitrage: "smart",

  // Markets — Starter+
  markets_trading: "starter",
  markets_marketplace: "starter",
  markets_forecasting: "starter",

  // Basic Ops — Starter+
  ops_alerts: "starter",
  ops_anomaly: "starter",
  ops_reports: "starter",
  ops_maintenance: "starter",

  // Advanced AI — Pro+
  ai_dispatch_copilot: "pro",
  ai_autonomous: "pro",
  ai_degradation_lab: "pro",
  ai_solar_intel: "pro",
  ai_revenue_opt: "pro",

  // Admin — Enterprise
  admin_users: "enterprise",
  admin_integrations: "enterprise",
  admin_whitelabel: "enterprise",
  admin_audit: "enterprise",
  admin_apikeys: "enterprise",
  admin_export: "enterprise",
  admin_customer_portal: "enterprise",
  admin_compliance: "enterprise",
  admin_investor: "enterprise",
}

// Plan display names
export const PLAN_NAMES = {
  beta: "Beta",
  home: "Home",
  smart: "Smart",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

// Plan prices (for Paywall modal)
// Values are i18n keys resolved at render time via t().
export const PLAN_PRICES = {
  home: "plan_price_home",
  smart: "plan_price_smart",
  starter: "plan_price_starter",
  pro: "plan_price_pro",
  enterprise: "plan_price_enterprise",
}

// Plan descriptions
// Values are i18n keys resolved at render time via t().
export const PLAN_DESCRIPTIONS = {
  beta: "plan_desc_cfg_beta",
  home: "plan_desc_cfg_home",
  smart: "plan_desc_cfg_smart",
  starter: "plan_desc_cfg_starter",
  pro: "plan_desc_cfg_pro",
  enterprise: "plan_desc_cfg_enterprise",
}

/**
 * Check if a plan tier has access to a specific frontend page.
 * @param {string} plan - The user's plan (beta|home|smart|starter|pro|enterprise)
 * @param {string} pageId - The frontend page identifier
 * @returns {boolean}
 */
export function canAccessPlanFeature(plan, pageId) {
  if (!plan) return false

  // Beta and Enterprise have "*" (all access)
  if (plan === "beta" || plan === "enterprise") return true

  const moduleKey = PAGE_TO_MODULE[pageId]
  if (!moduleKey) return false

  const requiredPlan = MODULE_MINIMUM_PLAN[moduleKey]
  if (!requiredPlan) return false

  const userTier = PLAN_TIER_ORDER[plan] ?? 0
  const requiredTier = PLAN_TIER_ORDER[requiredPlan] ?? 5

  return userTier >= requiredTier
}

/**
 * Get the minimum plan needed to unlock a page.
 * Returns null if the page is accessible to all plans.
 * @param {string} pageId
 * @returns {string|null} plan ID or null
 */
export function getMinimumPlanForPage(pageId) {
  const moduleKey = PAGE_TO_MODULE[pageId]
  if (!moduleKey) return null
  return MODULE_MINIMUM_PLAN[moduleKey] || null
}

/**
 * Get all plan info needed for the Paywall modal.
 * @param {string} pageId - The locked page the user clicked
 * @returns {{requiredPlan: string, requiredPlanName: string, requiredPlanPrice: string, requiredPlanDescription: string, moduleKey: string}}
 */
export function getPaywallInfo(pageId) {
  const moduleKey = PAGE_TO_MODULE[pageId] || pageId
  const requiredPlan = MODULE_MINIMUM_PLAN[moduleKey] || "enterprise"

  return {
    requiredPlan,
    requiredPlanName: PLAN_NAMES[requiredPlan] || requiredPlan,
    requiredPlanPrice: PLAN_PRICES[requiredPlan] || "plan_price_on_request",
    requiredPlanDescription: PLAN_DESCRIPTIONS[requiredPlan] || "",
    moduleKey,
  }
}