"""
auth.py — VoltarisOS authentication
Users stored in SQLite (energy.db) via SQLAlchemy — persistent across deploys.
Refactored with RBAC v2: SUPER_ADMIN / TENANT_ADMIN / TENANT_MEMBER roles,
plus Subscription Plan matrix (beta/home/smart/starter/pro/enterprise).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.security import hash_pw, verify_pw, SECRET_KEY, ALGORITHM, get_current_user, require_admin, require_super_admin, limiter
from fastapi import Request
import os
import sys
from backend.audit import log_user_login
from backend.twofa import verify_totp_code
from backend.permissions import (
    PlanTier, TIER_ORDER, PLAN_MAX_SITES, PLAN_ROLE_CEILING,
    get_tenant_plan, get_allowed_modules_for_plan, get_max_sites_for_plan,
    get_module_for_page, is_role_allowed_for_plan, can_access_module,
    PAGE_TO_MODULE,
)

router = APIRouter()

# ─── DB dependency ────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─── Schemas ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: str | None = None  # Optional TOTP code for 2FA

class RegisterRequest(BaseModel):
    email: str
    password: str
    company: str
    color: str = "#4ade80"
    beta_code: str = ""           # optional promotional beta invite code
    terms_accepted: bool = False  # digital acceptance of Terms of Use / no-reverse-engineering clause
    plan: str = ""                # selected subscription plan during onboarding (required if no promo code)
    role: str = "TENANT_MEMBER"   # self-selected role — validated against ALLOWED_REGISTER_ROLES below

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

# Self-registration roles — NEVER include SUPER_ADMIN or TENANT_ADMIN here.
# TENANT_ADMIN is only granted via admin invite or during organization creation.
ALLOWED_REGISTER_ROLES = ("TENANT_MEMBER",)
ALLOWED_INVITE_ROLES = ("TENANT_MEMBER", "TENANT_ADMIN")

class InviteUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "TENANT_MEMBER"
    color: str = "#4ade80"

# ─── Invite Codes Configuration ──────────────────────────────────────────────
# Each invite code maps to a plan tier and allowed roles.
# The environment variable BETA_CODE remains the default single-code fallback.
# For multi-tier invites, add entries to this dictionary or set them via env vars.
# Format: INVITE_CODE_TIER_<CODE> = plan_tier (e.g., INVITE_CODE_TIER_KIKO2026=pro)
BETA_CODE = os.environ.get("BETA_CODE", "")
if not BETA_CODE:
    import warnings
    warnings.warn(
        "BETA_CODE is not set. Registration will require a valid invite code but none is configured. "
        "Set BETA_CODE in your .env file.",
        stacklevel=2,
    )

def _build_invite_codes() -> dict:
    """Build invite code → tier mapping from environment and defaults.
    
    Each entry: { code_upper: { "tier": str, "label": str, "roles": list[str], "max_sites": int } }
    Roles control which account types the user can select during registration.
    """
    codes = {}
    
    # Default single beta code (from BETA_CODE env var)
    if BETA_CODE:
        codes[BETA_CODE.upper()] = {
            "tier": "beta",
            "label": "Beta Access (All Modules)",
            "roles": ["TENANT_MEMBER"],
            "max_sites": PLAN_MAX_SITES.get("beta", 1),
        }
    
    # Multi-tier invite codes from environment
    # Pattern: INVITE_<CODE> = tier:label:role1,role2
    for key, value in os.environ.items():
        if key.startswith("INVITE_") and not key.startswith("INVITE_CODE_TIER_"):
            code = key.replace("INVITE_", "").upper()
            parts = value.split(":")
            tier = parts[0] if len(parts) > 0 else "beta"
            label = parts[1] if len(parts) > 1 else tier.capitalize()
            roles = parts[2].split(",") if len(parts) > 2 else ["TENANT_MEMBER"]
            codes[code] = {
                "tier": tier,
                "label": label,
                "roles": roles,
                "max_sites": PLAN_MAX_SITES.get(tier, 1),
            }
    
    # Tier-specific codes via INVITE_CODE_TIER_ prefix
    for key, value in os.environ.items():
        if key.startswith("INVITE_CODE_TIER_"):
            code = key.replace("INVITE_CODE_TIER_", "").upper()
            if code not in codes:
                tier = value.lower()
                tier_roles = {
                    "beta": ["TENANT_MEMBER"],
                    "home": ["TENANT_MEMBER"],
                    "smart": ["TENANT_MEMBER"],
                    "starter": ["TENANT_MEMBER"],
                    "pro": ["TENANT_MEMBER"],
                    "enterprise": ["TENANT_MEMBER", "TENANT_ADMIN"],
                }
                codes[code] = {
                    "tier": tier,
                    "label": tier.capitalize(),
                    "roles": tier_roles.get(tier, ["TENANT_MEMBER"]),
                    "max_sites": PLAN_MAX_SITES.get(tier, 1),
                }
    
    return codes

INVITE_CODES = _build_invite_codes()

# ─── Available plans for onboarding (when no promo beta code) ──────────────────
AVAILABLE_PLANS = [
    {"id": "home", "name": "Home", "price": "€69/mês", "max_sites": 1, "description": "Monitorização essencial para uma instalação"},
    {"id": "smart", "name": "Smart", "price": "€149/mês", "max_sites": 2, "description": "Otimização IA e arbitragem para 2 instalações"},
    {"id": "starter", "name": "Starter", "price": "€279/mês", "max_sites": 5, "description": "Trading, previsões e operações para até 5 sites"},
    {"id": "pro", "name": "Pro", "price": "€1.099/mês", "max_sites": 20, "description": "IA avançada, copiloto e autonomia para portfolios"},
    {"id": "enterprise", "name": "Enterprise", "price": "€3.999/mês", "max_sites": 999, "description": "Whitelabel, API, auditoria e gestão de organização"},
]

# ─── Helpers ──────────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = models.utcnow_naive() + timedelta(hours=72)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_or_create_tenant(db: Session, name: str, plan: str = "beta") -> models.Tenant:
    slug = name.lower().replace(" ", "-").replace(".", "")[:50] or "default"
    tenant = db.query(models.Tenant).filter(models.Tenant.slug == slug).first()
    if not tenant:
        max_sites = PLAN_MAX_SITES.get(plan, 1)
        tenant = models.Tenant(name=name, slug=slug, plan=plan, max_sites=max_sites, max_devices=50)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant

def seed_admin(db: Session):
    """Ensure default SUPER_ADMIN exists on first boot.
    
    The initial admin password MUST be set via ADMIN_INITIAL_PASSWORD env var.
    If not set, a random password is generated and printed to stderr (first boot only).
    The SUPER_ADMIN should change this password immediately after first login.
    
    SUPER_ADMIN is NEVER granted via registration, onboarding, or subscription —
    only via this seed script or manual DB intervention.
    """
    if not db.query(models.User).filter(models.User.email == "admin@voltaris.com").first():
        tenant = get_or_create_tenant(db, "VoltarisOS Admin", plan="enterprise")
        
        # Get initial password from env, or generate a random one
        initial_password = os.environ.get("ADMIN_INITIAL_PASSWORD")
        if not initial_password:
            import secrets
            initial_password = secrets.token_urlsafe(16)
            print(
                f"\n{'='*60}\n"
                f"  FIRST BOOT: SUPER_ADMIN account created with random password\n"
                f"  Email: admin@voltaris.com\n"
                f"  Password: {initial_password}\n"
                f"  Role: SUPER_ADMIN\n"
                f"  CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGIN!\n"
                f"{'='*60}\n",
                file=sys.stderr,
            )
        
        admin = models.User(
            tenant_id=tenant.id,
            email="admin@voltaris.com",
            password_hash=hash_pw(initial_password),
            name="Francisco Morais",
            role="SUPER_ADMIN",
            color="#f59e0b",
            active=True,
        )
        db.add(admin)
        db.commit()

# ─── Routes ───────────────────────────────────────────────────────────────────
@router.get("/auth/validate-invite-code")
def validate_invite_code(code: str = "", db: Session = Depends(get_db)):
    """Validate an invite/beta code and return the associated plan tier + allowed roles.
    
    This endpoint is called by the frontend during registration to:
    1. Verify the code is valid before the user submits the form
    2. Determine which plan tier this code grants
    3. Restrict the account type dropdown to only roles allowed for this code
    4. Return max_sites and module list for the plan
    
    Returns 200 with tier info if valid, 400 if invalid.
    """
    if not code:
        raise HTTPException(400, "Código de convite é obrigatório")
    
    code_upper = code.strip().upper()
    
    # Check against INVITE_CODES dictionary (multi-tier)
    if code_upper in INVITE_CODES:
        invite = INVITE_CODES[code_upper]
        tier = invite["tier"]
        modules_list = sorted(list(get_allowed_modules_for_plan(tier)))
        return {
            "valid": True,
            "code": code_upper,
            "tier": tier,
            "label": invite["label"],
            "roles": invite["roles"],
            "max_sites": invite.get("max_sites", PLAN_MAX_SITES.get(tier, 1)),
            "modules": modules_list,
        }
    
    # Fallback: check against single BETA_CODE
    if BETA_CODE and code_upper == BETA_CODE.upper():
        modules_list = sorted(list(get_allowed_modules_for_plan("beta")))
        return {
            "valid": True,
            "code": code_upper,
            "tier": "beta",
            "label": "Beta Access (All Modules)",
            "roles": list(ALLOWED_REGISTER_ROLES),
            "max_sites": PLAN_MAX_SITES.get("beta", 1),
            "modules": modules_list,
        }
    
    raise HTTPException(400, "Código de convite inválido")


@router.get("/auth/available-plans")
def list_available_plans():
    """List all subscription plans available for onboarding checkout.
    Beta plan is excluded — it's only available via invite code."""
    return AVAILABLE_PLANS


@router.post("/auth/register")
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user account.
    
    Flow:
    1. If beta_code is provided and valid → auto-assign the plan tied to that code
    2. If beta_code is NOT provided → plan field is REQUIRED (onboarding plan selection)
    3. terms_accepted must be True (legal consent)
    4. Role is restricted: TENANT_MEMBER for self-registration (TENANT_ADMIN only via invite/admin)
    5. Plan determines max_sites, module access
    """
    code_upper = req.beta_code.strip().upper() if req.beta_code else ""
    
    # Determine plan and whether we need explicit plan selection
    plan_tier = ""
    allowed_roles_for_code = list(ALLOWED_REGISTER_ROLES)
    invite_label = ""
    
    if code_upper:
        # Promo code provided — validate and assign plan
        if code_upper in INVITE_CODES:
            invite = INVITE_CODES[code_upper]
            plan_tier = invite["tier"]
            allowed_roles_for_code = invite["roles"]
            invite_label = invite["label"]
        elif BETA_CODE and code_upper == BETA_CODE.upper():
            plan_tier = "beta"
            invite_label = "Beta Access"
        else:
            raise HTTPException(400, "Código de convite inválido. Pede o código ao administrador.")
    else:
        # No promo code — plan selection is mandatory
        if not req.plan or req.plan not in [p["id"] for p in AVAILABLE_PLANS]:
            raise HTTPException(400, "Seleção de plano obrigatória. Escolhe um plano de subscrição para continuar.")
        plan_tier = req.plan

    # Enforce terms acceptance
    if not req.terms_accepted:
        raise HTTPException(400, "É necessário aceitar os Termos de Uso e Política de Privacidade para criar conta.")

    # Check for duplicate email
    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email já registado")

    # Validate role against what this code/plan allows
    role = req.role if req.role in allowed_roles_for_code else allowed_roles_for_code[0]
    
    # Ensure role is within plan ceiling
    if not is_role_allowed_for_plan(role, plan_tier):
        role = "TENANT_MEMBER"  # fallback to safe default

    # Create tenant with the selected plan
    tenant = get_or_create_tenant(db, req.company, plan=plan_tier)
    
    # Update tenant's max_sites to match the plan
    tenant.max_sites = PLAN_MAX_SITES.get(plan_tier, 1)
    
    # Create user
    user = models.User(
        tenant_id=tenant.id,
        email=req.email,
        password_hash=hash_pw(req.password),
        name=req.company,
        role=role,
        color=req.color,
        active=True,
        terms_accepted_at=models.utcnow_naive(),
    )
    db.add(user)
    db.commit()
    
    return {"message": "Conta criada com sucesso", "plan": plan_tier, "role": role}


@router.post("/auth/login")
@limiter.limit("10/minute")
def login(request: Request, req: LoginRequest, db: Session = Depends(get_db)):
    seed_admin(db)
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_pw(req.password, user.password_hash):
        raise HTTPException(401, "Credenciais inválidas")
    if not user.active:
        raise HTTPException(403, "Conta desativada")

    # Transparently upgrade legacy sha256 hashes to bcrypt on successful login
    if not (user.password_hash.startswith("$2b$") or user.password_hash.startswith("$2a$")):
        user.password_hash = hash_pw(req.password)

    # Update last_login
    user.last_login = models.utcnow_naive()
    db.commit()

    # Check if 2FA is enabled
    if user.totp_enabled:
        if not req.totp_code:
            # 2FA is enabled but no code provided — require 2FA verification
            return {
                "requires_2fa": True,
                "message": "Código TOTP necessário. Forneça o código da sua aplicação autenticadora.",
            }
        
        # Verify TOTP code
        if not verify_totp_code(user.totp_secret, req.totp_code):
            raise HTTPException(401, "Código TOTP inválido")
    
    tenant = db.query(models.Tenant).filter(models.Tenant.id == user.tenant_id).first()
    plan = str(tenant.plan) if tenant and tenant.plan else "beta"
    
    # Compute allowed modules for this plan
    allowed_modules = get_allowed_modules_for_plan(plan)
    # If SUPER_ADMIN, grant ALL modules including super_admin_*
    if user.role == "SUPER_ADMIN":
        from backend.permissions import ALL_MODULES
        allowed_modules = set(ALL_MODULES)
    
    token = create_token({
        "sub": user.email,
        "company": tenant.name if tenant else user.name,
        "color": user.color,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "plan": plan,
    })
    
    # Log successful login
    log_user_login(
        db=db,
        user_id=user.id,
        tenant_id=user.tenant_id,
        user_email=user.email,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=True,
    )
    
    return {
        "token": token,
        "company": tenant.name if tenant else user.name,
        "color": user.color,
        "role": user.role,
        "email": user.email,
        "2fa_enabled": user.totp_enabled,
        "plan": plan,
        "tenant_id": user.tenant_id,
        "allowed_modules": sorted(list(allowed_modules)),
    }


@router.get("/auth/me")
def get_me(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    """Return the current user's profile with plan info and allowed modules.
    Used by the frontend to inject user context (role, plan, allowed_modules)."""
    user = db.query(models.User).filter(models.User.email == current.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    
    tenant = db.query(models.Tenant).filter(models.Tenant.id == user.tenant_id).first()
    plan = str(tenant.plan) if tenant and tenant.plan else "beta"
    
    allowed_modules = get_allowed_modules_for_plan(plan)
    if user.role == "SUPER_ADMIN":
        from backend.permissions import ALL_MODULES
        allowed_modules = set(ALL_MODULES)
    
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "color": user.color,
        "company": tenant.name if tenant else user.name,
        "plan": plan,
        "tenant_id": user.tenant_id,
        "max_sites": tenant.max_sites if tenant else PLAN_MAX_SITES.get(plan, 1),
        "allowed_modules": sorted(list(allowed_modules)),
        "twofa_enabled": user.totp_enabled,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/auth/change-password")
def change_password(req: ChangePasswordRequest, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    """Any logged-in user can change their own password."""
    user = db.query(models.User).filter(models.User.email == current.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if not verify_pw(req.current_password, user.password_hash):
        raise HTTPException(401, "Password atual incorreta")
    if len(req.new_password) < 8:
        raise HTTPException(400, "A nova password deve ter pelo menos 8 caracteres")
    user.password_hash = hash_pw(req.new_password)
    db.commit()
    return {"message": "Password alterada com sucesso"}


@router.post("/auth/invite")
def invite_user(req: InviteUserRequest, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Admin-only: create a teammate account directly (no beta code needed).
    Role is restricted to TENANT_MEMBER/TENANT_ADMIN — SUPER_ADMIN can NEVER be
    granted through this endpoint, only via seed_admin() on first boot or manual DB."""
    role = req.role if req.role in ALLOWED_INVITE_ROLES else "TENANT_MEMBER"

    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email já registado")
    if len(req.password) < 8:
        raise HTTPException(400, "A password deve ter pelo menos 8 caracteres")

    inviting_admin = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
    tenant_id = inviting_admin.tenant_id if inviting_admin else 1

    # Validate role against plan ceiling
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    plan = str(tenant.plan) if tenant and tenant.plan else "beta"
    if not is_role_allowed_for_plan(role, plan):
        role = "TENANT_MEMBER"

    user = models.User(
        tenant_id=tenant_id,
        email=req.email,
        password_hash=hash_pw(req.password),
        name=req.name,
        role=role,
        color=req.color,
        active=True,
    )
    db.add(user)
    db.commit()
    return {"message": "Utilizador convidado com sucesso", "role": role}


@router.get("/auth/users")
def list_users(db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    """Admin endpoint — list all users within the same tenant (multi-tenant isolation)."""
    admin_user = db.query(models.User).filter(models.User.email == _admin.get("sub")).first()
    tenant_id = admin_user.tenant_id if admin_user else None
    
    query = db.query(models.User)
    # SUPER_ADMIN sees all users; TENANT_ADMIN sees only their tenant
    if _admin.get("role") != "SUPER_ADMIN" and tenant_id:
        query = query.filter(models.User.tenant_id == tenant_id)
    
    users = query.all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "color": u.color,
            "active": u.active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.patch("/auth/users/{user_id}/toggle-active")
def toggle_active(user_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Admin-only: enable/disable a user account. Cannot deactivate SUPER_ADMIN accounts."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if user.role == "SUPER_ADMIN":
        raise HTTPException(403, "Não é possível desativar a conta SUPER_ADMIN")
    
    # TENANT_ADMIN can only toggle users in their own tenant
    admin_user = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
    if admin.get("role") != "SUPER_ADMIN" and admin_user and user.tenant_id != admin_user.tenant_id:
        raise HTTPException(403, "Acesso negado — utilizador fora do teu tenant")
    
    user.active = not user.active
    db.commit()
    return {"id": user.id, "active": user.active}


@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Admin-only: remove a user. Cannot remove SUPER_ADMIN accounts."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if user.role == "SUPER_ADMIN":
        raise HTTPException(403, "Não é possível remover a conta SUPER_ADMIN")
    
    # TENANT_ADMIN can only delete users in their own tenant
    admin_user = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
    if admin.get("role") != "SUPER_ADMIN" and admin_user and user.tenant_id != admin_user.tenant_id:
        raise HTTPException(403, "Acesso negado — utilizador fora do teu tenant")
    
    db.delete(user)
    db.commit()
    return {"message": "Utilizador removido"}


# ─── SUPER_ADMIN exclusive routes ──────────────────────────────────────────────

@router.get("/admin/tenants")
def list_all_tenants(db: Session = Depends(get_db), _sa: dict = Depends(require_super_admin)):
    """SUPER_ADMIN only — list all tenants in the platform."""
    tenants = db.query(models.Tenant).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "slug": t.slug,
            "plan": t.plan,
            "max_sites": t.max_sites,
            "active": t.active,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tenants
    ]


@router.get("/admin/system-health")
def system_health(_sa: dict = Depends(require_super_admin)):
    """SUPER_ADMIN only — basic system health check."""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "timestamp": models.utcnow_naive().isoformat(),
    }