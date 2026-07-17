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

class RegisterRequest(BaseModel):
    email: str
    password: str
    company: str
    color: str = "#4ade80"
    beta_code: str = ""        # optional beta invite code
    terms_accepted: bool = False   # digital acceptance of Terms of Use / no-reverse-engineering clause

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

ALLOWED_INVITE_ROLES = ("operator", "viewer", "investor")  # "admin"/"superadmin" can never be granted via this endpoint

class InviteUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "operator"
    color: str = "#4ade80"

BETA_CODE = os.environ.get("BETA_CODE", "VOLTARIS2026")

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
    """Ensure default admin exists on first boot."""
    if not db.query(models.User).filter(models.User.email == "admin@voltaris.com").first():
        tenant = get_or_create_tenant(db, "VoltarisOS Admin", plan="enterprise")
        admin = models.User(
            tenant_id=tenant.id,
            email="admin@voltaris.com",
            password_hash=hash_pw("admin123"),
            name="Francisco Morais",
            role="superadmin",
            color="#f59e0b",
            active=True,
        )
        db.add(admin)
        db.commit()

# ─── Routes ───────────────────────────────────────────────────────────────────
@router.post("/auth/register")
@limiter.limit("5/minute")
def register(request: Request, req: RegisterRequest, db: Session = Depends(get_db)):
    # Beta gate — require code unless admin
    code_ok = (req.beta_code.upper() == BETA_CODE)
    if not code_ok:
        raise HTTPException(400, f"Código beta inválido. Pede o código ao Francisco.")

    if not req.terms_accepted:
        raise HTTPException(400, "É necessário aceitar os Termos de Uso para criar conta.")

    if db.query(models.User).filter(models.User.email == req.email).first():
        raise HTTPException(400, "Email já registado")

    tenant = get_or_create_tenant(db, req.company, plan="beta")
    user = models.User(
        tenant_id=tenant.id,
        email=req.email,
        password_hash=hash_pw(req.password),
        name=req.company,
        role="operator",
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

    tenant = db.query(models.Tenant).filter(models.Tenant.id == user.tenant_id).first()
    token = create_token({
        "sub": user.email,
        "company": tenant.name if tenant else user.name,
        "color": user.color,
        "role": user.role,
        "tenant_id": user.tenant_id,
    })
    return {
        "token": token,
        "company": tenant.name if tenant else user.name,
        "color": user.color,
        "role": user.role,
        "email": user.email,
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
