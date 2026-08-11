"""
permissions.py — Combined plan + role RBAC for VoltarisOS.

Every endpoint protection flows through two layers:
1. Role-based: SUPER_ADMIN / TENANT_ADMIN / TENANT_MEMBER (see security.py)
2. Plan-based: beta / home / smart / starter / pro / enterprise — each tier unlocks modules

Plan → allowed roles mapping (hard ceiling):
  beta       → TENANT_MEMBER, TENANT_ADMIN
  home       → TENANT_MEMBER, TENANT_ADMIN
  smart      → TENANT_MEMBER, TENANT_ADMIN
  starter    → TENANT_MEMBER, TENANT_ADMIN
  pro        → TENANT_MEMBER, TENANT_ADMIN
  enterprise → TENANT_MEMBER, TENANT_ADMIN

Plan → module access matrix (see SUBSCRIPTION_PLAN_MODULES below):
  beta       → all modules (["*"])
  home       → core + energy modules (no trading, ai, ops, admin)
  smart      → core + energy + basic AI/trading (2 sites max)
  starter    → core + energy + markets + basic ops (no advanced AI, no admin)
  pro        → core + energy + markets + ops + advanced AI (no admin)
  enterprise → all product modules + organization management (no SUPER_ADMIN routes)

Plan → max_sites:
  beta       → 1
  home       → 1
  smart      → 2
  starter    → 5
  pro        → 20
  enterprise → 999

Usage:
    from backend.permissions import require_plan, PlanTier, check_module_access
    from fastapi import Depends

    @router.post("/trading/execute")
    async def execute_trade(..., _: dict = Depends(check_module_access("markets_trading"))):
        ...
"""

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from enum import StrEnum
from typing import Set, List, Dict
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user


class PlanTier(StrEnum):
    BETA = "beta"
    HOME = "home"
    SMART = "smart"
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


# ─── Plan → max allowed role ───────────────────────────────────────────────
# A tenant on plan X can NEVER have a user with a role beyond this ceiling.
# SUPER_ADMIN is NEVER granted via plan — only via seed script.
PLAN_ROLE_CEILING: dict[str, set[str]] = {
    PlanTier.BETA:       {"TENANT_MEMBER", "TENANT_ADMIN"},
    PlanTier.HOME:       {"TENANT_MEMBER", "TENANT_ADMIN"},
    PlanTier.SMART:      {"TENANT_MEMBER", "TENANT_ADMIN"},
    PlanTier.STARTER:    {"TENANT_MEMBER", "TENANT_ADMIN"},
    PlanTier.PRO:        {"TENANT_MEMBER", "TENANT_ADMIN"},
    PlanTier.ENTERPRISE: {"TENANT_MEMBER", "TENANT_ADMIN"},
}

# ─── Plan → max_sites limit ─────────────────────────────────────────────────
PLAN_MAX_SITES: dict[str, int] = {
    PlanTier.BETA: 1,
    PlanTier.HOME: 1,
    PlanTier.SMART: 2,
    PlanTier.STARTER: 5,
    PlanTier.PRO: 20,
    PlanTier.ENTERPRISE: 999,
}

# ─── Subscription Plan → Module Access Matrix ───────────────────────────────
# Each plan key maps to a list of allowed module identifiers.
# "*" means all modules are accessible.
# These module keys correspond to feature areas in the frontend sidebar.

ALL_MODULES: List[str] = [
    # Core Modules (all plans)
    "core_dashboard",
    "core_fleet",
    "core_sites",
    "core_map",
    "core_carbon",
    "core_carbon_credit",
    "core_scorecard",
    "core_settings",
    "core_command_center",
    "core_twin",

    # Energy Modules
    "energy_battery",
    "energy_ev",
    "energy_grid",
    "energy_vpp",
    "energy_resilience",

    # Market / Trading Modules
    "markets_trading",
    "markets_marketplace",
    "markets_forecasting",
    "markets_arbitrage",

    # AI Modules
    "ai_trading_basic",
    "ai_forecasting_basic",
    "ai_dispatch_copilot",
    "ai_autonomous",
    "ai_degradation_lab",
    "ai_solar_intel",
    "ai_revenue_opt",

    # Operations Modules
    "ops_alerts",
    "ops_anomaly",
    "ops_reports",
    "ops_maintenance",

    # Admin / Organization Modules (Enterprise + SUPER_ADMIN)
    "admin_users",
    "admin_integrations",
    "admin_whitelabel",
    "admin_audit",
    "admin_apikeys",
    "admin_export",
    "admin_customer_portal",
    "admin_compliance",
    "admin_investor",

    # SUPER_ADMIN Exclusive (not tied to any plan — role-gated)
    "super_admin_tenants",
    "super_admin_system_health",
]

# ─── Plan → Allowed Modules ─────────────────────────────────────────────────
SUBSCRIPTION_PLAN_MODULES: dict[str, set[str]] = {
    PlanTier.BETA: {"*"},  # All modules unlocked during beta

    PlanTier.HOME: {
        "core_dashboard", "core_fleet", "core_sites", "core_map",
        "energy_battery", "energy_ev", "energy_grid",
        "core_carbon", "core_carbon_credit", "core_scorecard", "core_settings",
        "core_command_center", "core_twin",
    },

    PlanTier.SMART: {
        "core_dashboard", "core_fleet", "core_sites", "core_map",
        "energy_battery", "energy_ev", "energy_grid",
        "core_carbon", "core_carbon_credit", "core_scorecard", "core_settings",
        "core_command_center", "core_twin",
        "ai_trading_basic", "ai_forecasting_basic",
        "markets_arbitrage",
    },

    PlanTier.STARTER: {
        "core_dashboard", "core_fleet", "core_sites", "core_map",
        "energy_battery", "energy_ev", "energy_grid",
        "core_carbon", "core_carbon_credit", "core_scorecard", "core_settings",
        "core_command_center", "core_twin",
        "ai_trading_basic", "ai_forecasting_basic",
        "markets_trading", "markets_marketplace", "markets_forecasting", "markets_arbitrage",
        "ops_alerts", "ops_anomaly", "ops_reports", "ops_maintenance",
        "energy_vpp", "energy_resilience",
    },

    PlanTier.PRO: {
        "core_dashboard", "core_fleet", "core_sites", "core_map",
        "energy_battery", "energy_ev", "energy_grid", "energy_vpp", "energy_resilience",
        "core_carbon", "core_carbon_credit", "core_scorecard", "core_settings",
        "core_command_center", "core_twin",
        "ai_trading_basic", "ai_forecasting_basic",
        "ai_dispatch_copilot", "ai_autonomous", "ai_degradation_lab",
        "ai_solar_intel", "ai_revenue_opt",
        "markets_trading", "markets_marketplace", "markets_forecasting", "markets_arbitrage",
        "ops_alerts", "ops_anomaly", "ops_reports", "ops_maintenance",
    },

    PlanTier.ENTERPRISE: {"*"},  # All product modules + organization management
}

# ─── Tier ordering for comparison ──────────────────────────────────────────
TIER_ORDER: dict[str, int] = {
    PlanTier.BETA: 0,
    PlanTier.HOME: 1,
    PlanTier.SMART: 2,
    PlanTier.STARTER: 3,
    PlanTier.PRO: 4,
    PlanTier.ENTERPRISE: 5,
}

# ─── Module → Minimum Plan Required ─────────────────────────────────────────
# Maps each module identifier to the minimum plan tier that unlocks it.
# Used for the Paywall modal in the frontend (which plan the user needs to upgrade to).
MODULE_MINIMUM_PLAN: dict[str, PlanTier] = {
    # Core — available to all plans
    "core_dashboard": PlanTier.HOME,
    "core_fleet": PlanTier.HOME,
    "core_sites": PlanTier.HOME,
    "core_map": PlanTier.HOME,
    "core_carbon": PlanTier.HOME,
    "core_carbon_credit": PlanTier.HOME,
    "core_scorecard": PlanTier.HOME,
    "core_settings": PlanTier.HOME,
    "core_command_center": PlanTier.HOME,
    "core_twin": PlanTier.HOME,

    # Energy — Home+
    "energy_battery": PlanTier.HOME,
    "energy_ev": PlanTier.HOME,
    "energy_grid": PlanTier.HOME,
    "energy_vpp": PlanTier.STARTER,
    "energy_resilience": PlanTier.STARTER,

    # Basic AI — Smart+
    "ai_trading_basic": PlanTier.SMART,
    "ai_forecasting_basic": PlanTier.SMART,
    "markets_arbitrage": PlanTier.SMART,

    # Markets — Starter+
    "markets_trading": PlanTier.STARTER,
    "markets_marketplace": PlanTier.STARTER,
    "markets_forecasting": PlanTier.STARTER,

    # Basic Ops — Starter+
    "ops_alerts": PlanTier.STARTER,
    "ops_anomaly": PlanTier.STARTER,
    "ops_reports": PlanTier.STARTER,
    "ops_maintenance": PlanTier.STARTER,

    # Advanced AI — Pro+
    "ai_dispatch_copilot": PlanTier.PRO,
    "ai_autonomous": PlanTier.PRO,
    "ai_degradation_lab": PlanTier.PRO,
    "ai_solar_intel": PlanTier.PRO,
    "ai_revenue_opt": PlanTier.PRO,

    # Admin — Enterprise
    "admin_users": PlanTier.ENTERPRISE,
    "admin_integrations": PlanTier.ENTERPRISE,
    "admin_whitelabel": PlanTier.ENTERPRISE,
    "admin_audit": PlanTier.ENTERPRISE,
    "admin_apikeys": PlanTier.ENTERPRISE,
    "admin_export": PlanTier.ENTERPRISE,
    "admin_customer_portal": PlanTier.ENTERPRISE,
    "admin_compliance": PlanTier.ENTERPRISE,
    "admin_investor": PlanTier.ENTERPRISE,

    # SUPER_ADMIN only — not tied to any plan
    "super_admin_tenants": PlanTier.ENTERPRISE,
    "super_admin_system_health": PlanTier.ENTERPRISE,
}

# ─── Frontend page ID → Backend module mapping ─────────────────────────────
# Maps the frontend page identifiers (used in Sidebar) to backend module keys.
PAGE_TO_MODULE: dict[str, str] = {
    "dashboard": "core_dashboard",
    "fleet": "core_fleet",
    "sites": "core_sites",
    "map": "core_map",
    "carbon": "core_carbon",
    "carbon_credit": "core_carbon_credit",
    "scorecard": "core_scorecard",
    "settings": "core_settings",
    "command_center": "core_command_center",
    "twin": "core_twin",
    "battery": "energy_battery",
    "ev": "energy_ev",
    "grid": "energy_grid",
    "vpp": "energy_vpp",
    "resilience": "energy_resilience",
    "trading": "markets_trading",
    "marketplace": "markets_marketplace",
    "forecasting": "markets_forecasting",
    "arbitrage": "markets_arbitrage",
    "autonomous": "ai_autonomous",
    "dispatch_copilot": "ai_dispatch_copilot",
    "degradation_lab": "ai_degradation_lab",
    "solar_intel": "ai_solar_intel",
    "revenue_opt": "ai_revenue_opt",
    "alerts": "ops_alerts",
    "anomaly": "ops_anomaly",
    "reports": "ops_reports",
    "maintenance": "ops_maintenance",
    "users": "admin_users",
    "integrations": "admin_integrations",
    "whitelabel": "admin_whitelabel",
    "audit": "admin_audit",
    "apikeys": "admin_apikeys",
    "export": "admin_export",
    "customer_portal": "admin_customer_portal",
    "compliance": "admin_compliance",
    "investor": "admin_investor",
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_tenant_plan(user: dict, db: Session) -> str:
    """Resolve the active plan for a user's tenant.
    
    Returns the plan string (beta|home|smart|starter|pro|enterprise).
    Falls back to 'beta' if tenant not found.
    """
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        return PlanTier.BETA
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        return PlanTier.BETA
    return str(tenant.plan) if tenant.plan else PlanTier.BETA.value


def is_role_allowed_for_plan(role: str, plan: str) -> bool:
    """Check if a role is within the plan's ceiling."""
    if role == "SUPER_ADMIN":
        return True  # SUPER_ADMIN bypasses all plan restrictions
    allowed = PLAN_ROLE_CEILING.get(plan, PLAN_ROLE_CEILING[PlanTier.BETA])
    return role in allowed


def can_access_module(plan: str, module_name: str) -> bool:
    """Check if a plan tier grants access to a specific module.
    
    SUPER_ADMIN always passes (handled at the auth level, not here).
    Plans with "*" have access to all modules.
    """
    if plan not in SUBSCRIPTION_PLAN_MODULES:
        return False
    allowed = SUBSCRIPTION_PLAN_MODULES[plan]
    if "*" in allowed:
        return True
    return module_name in allowed


def get_allowed_modules_for_plan(plan: str) -> Set[str]:
    """Return all module keys available for a given plan tier.
    
    If plan has "*" (beta, enterprise), returns all modules.
    SUPER_ADMIN-exclusive modules (super_admin_*) are never included
    in plan-based access — they require SUPER_ADMIN role.
    """
    allowed = SUBSCRIPTION_PLAN_MODULES.get(plan, set())
    if "*" in allowed:
        return {m for m in ALL_MODULES if not m.startswith("super_admin_")}
    return allowed


def get_max_sites_for_plan(plan: str) -> int:
    """Return max_sites limit for a given plan."""
    return PLAN_MAX_SITES.get(plan, 1)


def get_minimum_plan_for_module(module_name: str) -> str:
    """Return the minimum plan tier that unlocks a given module.
    
    Used for the Paywall modal to tell the user which plan they need.
    """
    return MODULE_MINIMUM_PLAN.get(module_name, PlanTier.ENTERPRISE).value


def get_module_for_page(page_id: str) -> str:
    """Map a frontend page ID to its backend module key."""
    return PAGE_TO_MODULE.get(page_id, page_id)


# ─── FastAPI Dependencies ───────────────────────────────────────────────────

def require_plan(minimum_plan: PlanTier):
    """FastAPI dependency — reject if tenant's plan is below minimum_plan.
    
    Usage:
        @router.post("/vpp/bids")
        async def submit_bid(..., _: dict = Depends(require_plan(PlanTier.PRO))):
            ...
    """
    async def _check(
        user: dict = Depends(get_current_user),
    ) -> dict:
        # SUPER_ADMIN always passes plan checks
        role = user.get("role", "")
        if role == "SUPER_ADMIN":
            return user
        
        db = SessionLocal()
        try:
            plan = get_tenant_plan(user, db)
            user_tier = TIER_ORDER.get(plan, 0)
            required_tier = TIER_ORDER.get(minimum_plan, 0)
            
            if user_tier < required_tier:
                raise HTTPException(
                    status_code=403,
                    detail=f"Este recurso requer o plano {minimum_plan.value} ou superior. O teu plano atual é {plan}.",
                )
            return user
        finally:
            db.close()
    
    return _check


def check_module_access(module_name: str):
    """FastAPI dependency — reject if tenant's plan doesn't include a specific module.
    
    Usage:
        @router.post("/trading/execute")
        async def execute_trade(..., _: dict = Depends(check_module_access("markets_trading"))):
            ...
    """
    async def _check(
        user: dict = Depends(get_current_user),
    ) -> dict:
        role = user.get("role", "")
        if role == "SUPER_ADMIN":
            return user
        
        db = SessionLocal()
        try:
            plan = get_tenant_plan(user, db)
            if not can_access_module(plan, module_name):
                raise HTTPException(
                    status_code=403,
                    detail=f"A funcionalidade '{module_name}' não está disponível no teu plano ({plan}). Faz upgrade para desbloquear.",
                )
            return user
        finally:
            db.close()
    
    return _check