"""
auth.py — VoltarisOS authentication
Users stored in SQLite (energy.db) via SQLAlchemy — persistent across deploys.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from jose import jwt, JWTError
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models
import hashlib, os

router = APIRouter()

SECRET_KEY = os.environ.get("SECRET_KEY", "voltarisos-secret-2026-production")
ALGORITHM  = "HS256"

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

BETA_CODE = os.environ.get("BETA_CODE", "VOLTARIS2026")

# ─── Helpers ──────────────────────────────────────────────────────────────────
def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

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
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Beta gate — require code unless admin
    code_ok = (req.beta_code.upper() == BETA_CODE)
    if not code_ok:
        raise HTTPException(400, f"Código beta inválido. Pede o código ao Francisco.")

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
    )
    db.add(user)
    db.commit()
    return {"message": "Conta beta criada com sucesso"}


@router.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    seed_admin(db)
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or user.password_hash != hash_pw(req.password):
        raise HTTPException(401, "Credenciais inválidas")
    if not user.active:
        raise HTTPException(403, "Conta desativada")

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


@router.get("/auth/users")
def list_users(db: Session = Depends(get_db)):
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


@router.delete("/auth/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    db.delete(user)
    db.commit()
    return {"message": "Utilizador removido"}
