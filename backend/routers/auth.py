"""
auth.py — VoltarisOS authentication
Users stored in SQLite (energy.db) via SQLAlchemy — persistent across deploys.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
from backend.security import hash_pw, verify_pw, SECRET_KEY, ALGORITHM, get_current_user, require_admin, limiter
from fastapi import Request
import os
import sys
from backend.audit import log_user_login
from backend.twofa import verify_totp_code

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
    beta_code: str = ""        # optional beta invite code
    terms_accepted: bool = False   # digital acceptance of Terms of Use / no-reverse-engineering clause
    role: str = "operator"     # self-selected account type — validated against ALLOWED_REGISTER_ROLES below

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

ALLOWED_INVITE_ROLES = ("operator", "viewer", "investor")  # "admin"/"superadmin" can never be granted via this endpoint
ALLOWED_REGISTER_ROLES = ("operator", "viewer", "investor")  # self-registration — same restriction as invite

class InviteUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "operator"
    color: str = "#4ade80"

# ─── Invite Codes Configuration ─────────────────────────────────────────────────
# Each invite code maps to a plan tier and allowed roles.
# The environment variable BETA_CODE remains the default single-code fallback.
# For multi-tier invites, add entries to this dictionary or set them via env vars.
# Format: INVITE_CODE_TIER_<CODE> = plan_tier (e.g., INVITE_CODE_TIER_KIKO2026=investor)
BETA_CODE = os.environ.get("BETA_CODE", "")
if not BETA_CODE:
    import warnings
    warnings.warn(
        "BETA_CODE is not set. Registration will require a beta code but none is configured. "
        "Set BETA_CODE in your .env file.",
        stacklevel=2,
    )

def _build_invite_codes() -> dict:
    """Build invite code → tier mapping from environment and defaults.
    
    Each entry: { code_upper: { "tier": str, "label": str, "roles": list[str] } }
    Roles control which account types the user can select during registration.
    """
    codes = {}
    
    # Default single beta code (from BETA_CODE env var)
    if BETA_CODE:
        codes[BETA_CODE.upper()] = {
            "tier": "beta",
            "label": "Beta Access",
            "roles": ["operator", "viewer", "investor"],
        }
    
    # Multi-tier invite codes from environment
    # Pattern: INVITE_<CODE> = tier:label:role1,role2
    for key, value in os.environ.items():
        if key.startswith("INVITE_") and not key.startswith("INVITE_CODE_TIER_"):
            code = key.replace("INVITE_", "").upper()
            parts = value.split(":")
            tier = parts[0] if len(parts) > 0 else "beta"
            label = parts[1] if len(parts) > 1 else tier.capitalize()
            roles = parts[2].split(",") if len(parts) > 2 else ["operator"]
            codes[code] = {"tier": tier, "label": label, "roles": roles}
    
    # Tier-specific codes via INVITE_CODE_TIER_ prefix
    for key, value in os.environ.items():
        if key.startswith("INVITE_CODE_TIER_"):
            code = key.replace("INVITE_CODE_TIER_", "").upper()
            if code not in codes:
                # Map tier to default roles
                tier_roles = {
                    "starter": ["operator", "viewer"],
                    "pro": ["operator", "viewer", "investor"],
                    "enterprise": ["operator", "viewer", "investor"],
                    "investor": ["investor"],
                    "operator": ["operator"],
                    "viewer": ["viewer"],
                }
                codes[code] = {
                    "tier": value.lower(),
                    "label": value.capitalize(),
                    "roles": tier_roles.get(value.lower(), ["operator"]),
                }
    
    return codes

INVITE_CODES = _build_invite_codes()

# ─── Helpers ──────────────────────────────────────────────────────────────────
def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(hours=72)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_or_create_tenant(db: Session, name: str, plan: str = "beta") -> models.Tenant:
    slug = name.lower().replace(" ", "-").replace(".", "")[:50] or "default"
    tenant = db.query(models.Tenant).filter(models.Tenant.slug == slug).first()
    if not tenant:
        tenant = models.Tenant(name=name, slug=slug, plan=plan, max_sites=10, max_devices=50)
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant

def seed_admin(db: Session):
    """Ensure default admin exists on first boot.
    
    The initial admin password MUST be set via ADMIN_INITIAL_PASSWORD env var.
    If not set, a random password is generated and printed to stderr (first boot only).
    The admin should change this password immediately after first login.
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
                f"  FIRST BOOT: Admin account created with random password\n"
                f"  Email: admin@voltaris.com\n"
                f"  Password: {initial_password}\n"
                f"  CHANGE THIS PASSWORD IMMEDIATELY AFTER LOGIN!\n"
                f"{'='*60}\n",
                file=sys.stderr,
            )
        
        admin = models.User(
            tenant_id=tenant.id,
            email="admin@voltaris.com",
            password_hash=hash_pw(initial_password),
            name="Francisco Morais",
            role="superadmin",
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
    
    Returns 200 with tier info if valid, 400 if invalid.
    """
    if not code:
        raise HTTPException(400, "Código de convite é obrigatório")
    
    code_upper = code.strip().upper()
    
    # Check against INVITE_CODES dictionary (multi-tier)
    if code_upper in INVITE_CODES:
        invite = INVITE_CODES[code_upper]
        return {
            "valid": True,
            "code": code_upper,
            "tier": invite["tier"],
            "label": invite["label"],
            "roles": invite["roles"],
        }
    
    # Fallback: check against single BETA_CODE
    if BETA_CODE and code_upper == BETA_CODE.upper():
        return {
            "valid": True,
            "code": code_upper,
            "tier": "beta",
            "label": "Beta Access",
            "roles": list(ALLOWED_REGISTER_ROLES),
        }
    
    raise HTTPException(400, "Código de convite inválido")


@router.post("/auth/register")
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    # Validate invite code using the multi-tier system
    code_upper = req.beta_code.strip().upper() if req.beta_code else ""
    
    if not code_upper:
        raise HTTPException(400, "Código de convite é obrigatório. Pede o código ao administrador.")
    
    # Determine tier and allowed roles from invite code
    plan_tier = "beta"
    allowed_roles_for_code = list(ALLOWED_REGISTER_ROLES)
    invite_label = "Beta Access"
    
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

    if not req.terms_accepted:
        raise HTTPException(400, "É necessário aceitar os Termos de Uso para criar conta.")

    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email já registado")

    # Validate role against what this invite code allows
    role = req.role if req.role in allowed_roles_for_code else allowed_roles_for_code[0]

    tenant = get_or_create_tenant(db, req.company, plan=plan_tier)
    user = models.User(
        tenant_id=tenant.id,
        email=req.email,
        password_hash=hash_pw(req.password),
        name=req.company,
        role=role,
        color=req.color,
        active=True,
        terms_accepted_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    return {"message": "Conta beta criada com sucesso"}


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
    user.last_login = datetime.utcnow()
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
    token = create_token({
        "sub": user.email,
        "company": tenant.name if tenant else user.name,
        "color": user.color,
        "role": user.role,
        "tenant_id": user.tenant_id,
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
    Role is restricted to operator/viewer/investor — admin/superadmin can NEVER be
    granted through this endpoint, only via seed_admin() on first boot."""
    role = req.role if req.role in ALLOWED_INVITE_ROLES else "operator"

    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email já registado")
    if len(req.password) < 8:
        raise HTTPException(400, "A password deve ter pelo menos 8 caracteres")

    inviting_admin = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
    tenant_id = inviting_admin.tenant_id if inviting_admin else 1

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
    """Admin endpoint — list all users (no sensitive data)."""
    users = db.query(models.User).all()
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
    """Admin-only: enable/disable a user account. Cannot deactivate the superadmin account."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if user.role == "superadmin":
        raise HTTPException(403, "Não é possível desativar a conta superadmin")
    user.active = not user.active
    db.commit()
    return {"id": user.id, "active": user.active}


@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if user.role == "superadmin":
        raise HTTPException(403, "Não é possível remover a conta superadmin")
    db.delete(user)
    db.commit()
    return {"message": "Utilizador removido"}
