"""
permissions.py — Combined plan + role RBAC for VoltarisOS.

Every endpoint protection flows through two layers:
1. Role-based: superadmin/admin/operator/viewer/investor (existing in security.py)
2. Plan-based: starter/pro/enterprise/beta — each tier unlocks features

Plan → allowed roles mapping (hard ceiling):
  starter    → viewer
  pro        → viewer, operator
  enterprise → viewer, operator, investor
  beta       → viewer, operator, investor (legacy)

Plan → feature gates:
  starter    → dashboard, sites, carbon (read-only)
  pro        → + battery, ev, grid, vpp, trading, forecasting, alerts
  enterprise → + autonomous, marketplace, dispatch_copilot, revenue_opt, compliance, investor

Usage:
    from backend.permissions import require_plan, PlanTier, get_plan_feature_gates
    from fastapi import Depends

    @router.post("/vpp/bids")
    async def submit_bid(..., _plan: dict = Depends(require_plan(PlanTier.PRO))):
        ...
"""

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from enum import StrEnum
from typing import Set
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user


class PlanTier(StrEnum):
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"
    BETA = "beta"


# ─── Plan → max allowed role ───────────────────────────────────────────────
# A tenant on plan X can NEVER have a user with a role beyond this ceiling.
PLAN_ROLE_CEILING: dict[str, set[str]] = {
    PlanTier.STARTER:    {"viewer"},
    PlanTier.PRO:        {"viewer", "operator"},
    PlanTier.ENTERPRISE: {"viewer", "operator", "investor"},
    PlanTier.BETA:       {"viewer", "operator", "investor"},  # legacy — same as enterprise
}

# ─── Feature gates by plan ─────────────────────────────────────────────────
# Each feature key maps to the minimum plan tier required.
# These keys correspond to page IDs / feature areas in the frontend.
PLAN_FEATURE_GATES: dict[str, PlanTier] = {
    # Core — all tiers
    "dashboard":        PlanTier.STARTER,
    "sites":            PlanTier.STARTER,
    "carbon":           PlanTier.STARTER,
    "carbon_credit":    PlanTier.STARTER,
    "alerts":           PlanTier.STARTER,
    "reports":          PlanTier.STARTER,
    "settings":         PlanTier.STARTER,
    "scorecard":        PlanTier.STARTER,

    # Pro features
    "battery":          PlanTier.PRO,
    "ev":               PlanTier.PRO,
    "grid":             PlanTier.PRO,
    "vpp":              PlanTier.PRO,
    "resilience":       PlanTier.PRO,
    "trading":          PlanTier.PRO,
    "forecasting":      PlanTier.PRO,
    "anomaly":          PlanTier.PRO,
    "maintenance":      PlanTier.PRO,
    "arbitrage":        PlanTier.PRO,
    "degradation_lab":  PlanTier.PRO,
    "solar_intel":      PlanTier.PRO,

    # Enterprise-exclusive
    "autonomous":       PlanTier.ENTERPRISE,
    "marketplace":      PlanTier.ENTERPRISE,
    "dispatch_copilot":  PlanTier.ENTERPRISE,
    "revenue_opt":      PlanTier.ENTERPRISE,
    "compliance":       PlanTier.ENTERPRISE,
    "investor":         PlanTier.ENTERPRISE,

    # Admin-only (handled by role check, not plan)
    "users":            PlanTier.ENTERPRISE,
    "integrations":     PlanTier.ENTERPRISE,
    "whitelabel":       PlanTier.ENTERPRISE,
    "audit":            PlanTier.ENTERPRISE,
    "apikeys":          PlanTier.ENTERPRISE,
    "export":           PlanTier.ENTERPRISE,
}

# ─── Tier ordering for comparison ──────────────────────────────────────────
TIER_ORDER: dict[str, int] = {
    PlanTier.STARTER: 0,
    PlanTier.PRO: 1,
    PlanTier.ENTERPRISE: 2,
    PlanTier.BETA: 2,  # beta = enterprise-equivalent
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_tenant_plan(user: dict, db: Session) -> str:
    """Resolve the active plan for a user's tenant.
    
    Returns the plan string (starter|pro|enterprise|beta).
    Falls back to 'starter' if tenant not found.
    """
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        return PlanTier.STARTER
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        return PlanTier.STARTER
    return tenant.plan or PlanTier.STARTER


def is_role_allowed_for_plan(role: str, plan: str) -> bool:
    """Check if a role is within the plan's ceiling."""
    allowed = PLAN_ROLE_CEILING.get(plan, PLAN_ROLE_CEILING[PlanTier.STARTER])
    return role in allowed or role in ("superadmin", "admin")  # admin roles always pass


def can_access_feature(plan: str, feature: str) -> bool:
    """Check if a plan tier grants access to a feature/page.
    
    superadmin/admin always pass (handled at the role level).
    """
    required_tier = PLAN_FEATURE_GATES.get(feature, PlanTier.ENTERPRISE)
    user_tier_order = TIER_ORDER.get(plan, 0)
    required_tier_order = TIER_ORDER.get(required_tier, 0)
    return user_tier_order >= required_tier_order


def get_allowed_features_for_plan(plan: str) -> Set[str]:
    """Return all feature keys available for a given plan tier."""
    user_tier_order = TIER_ORDER.get(plan, 0)
    return {
        feature
        for feature, required in PLAN_FEATURE_GATES.items()
        if TIER_ORDER.get(required, 0) <= user_tier_order
    }


# ─── FastAPI Dependency ─────────────────────────────────────────────────────
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
        # superadmin/admin always pass plan checks
        role = user.get("role", "")
        if role in ("superadmin", "admin"):
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


def require_feature(feature_key: str):
    """FastAPI dependency — reject if tenant's plan doesn't include a specific feature.
    
    Usage:
        @router.post("/trading/execute")
        async def execute_trade(..., _: dict = Depends(require_feature("trading"))):
            ...
    """
    async def _check(
        user: dict = Depends(get_current_user),
    ) -> dict:
        role = user.get("role", "")
        if role in ("superadmin", "admin"):
            return user
        
        db = SessionLocal()
        try:
            plan = get_tenant_plan(user, db)
            if not can_access_feature(plan, feature_key):
                raise HTTPException(
                    status_code=403,
                    detail=f"A funcionalidade '{feature_key}' não está disponível no teu plano ({plan}). Faz upgrade para desbloquear.",
                )
            return user
        finally:
            db.close()
    
    return _check