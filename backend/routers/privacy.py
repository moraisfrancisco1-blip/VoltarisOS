"""RGPD data-subject rights: export (arts. 15/20) and erasure (art. 17).

Self-service for every user, plus tenant-scoped admin variants so a tenant admin
can answer a request from a colleague who has no access any more. The logic
lives in backend/gdpr.py; this module only does authorisation and auditing.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import gdpr, models
from backend.audit import audit_request
from backend.database import SessionLocal
from backend.security import get_current_user, require_admin, require_password_changed, verify_pw

router = APIRouter(prefix="/api/privacy", tags=["privacy"])

CONFIRM_WORD = "ERASE"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class EraseSelfRequest(BaseModel):
    password: str
    confirm: str


class EraseUserRequest(BaseModel):
    confirm: str


def _require_confirm(word: str) -> None:
    if word != CONFIRM_WORD:
        raise HTTPException(400, f'Confirmação em falta: envie "{CONFIRM_WORD}"')


def _me(db: Session, current: dict) -> models.User:
    user = db.query(models.User).filter(models.User.email == current.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    return user


def _target(db: Session, admin: dict, user_id: int) -> models.User:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if admin.get("role") != "SUPER_ADMIN":
        # Fail closed: an admin whose own row is gone cannot be tenant-checked.
        me = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
        if me is None or user.tenant_id != me.tenant_id:
            raise HTTPException(403, "Acesso negado — utilizador fora do teu tenant")
    return user


def _guard_erasable(db: Session, user: models.User) -> None:
    if user.role == "SUPER_ADMIN":
        raise HTTPException(403, "Contas SUPER_ADMIN não podem ser anonimizadas por esta via")
    if user.email.endswith("@" + gdpr.ERASED_DOMAIN):
        raise HTTPException(409, "Dados já anonimizados")
    if user.role == "TENANT_ADMIN":
        other_admins = (
            db.query(models.User)
            .filter(models.User.tenant_id == user.tenant_id, models.User.role == "TENANT_ADMIN",
                    models.User.active.is_(True), models.User.id != user.id)
            .count()
        )
        if other_admins == 0:
            raise HTTPException(409, "É o único administrador do tenant — nomeie outro administrador primeiro")


@router.get("/me/export")
def export_my_data(request: Request, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    """Download everything we hold about the caller."""
    user = _me(db, current)
    data = gdpr.export_user_data(db, user)
    audit_request(db, request, current, "privacy.data_exported", target_resource="user", target_id=user.id)
    return data


@router.post("/me/erase")
def erase_my_data(req: EraseSelfRequest, request: Request, db: Session = Depends(get_db),
                  current: dict = Depends(get_current_user), _pw: dict = Depends(require_password_changed)):
    """Anonymise the caller's own account. Needs the password and the word ERASE."""
    _require_confirm(req.confirm)
    user = _me(db, current)
    if not verify_pw(req.password, user.password_hash):
        raise HTTPException(403, "Palavra-passe incorreta")
    _guard_erasable(db, user)
    uid, tenant_id = user.id, user.tenant_id
    counts = gdpr.erase_user(db, user)
    audit_request(db, request, current, "privacy.user_erased", target_resource="user", target_id=uid,
                  tenant_id=tenant_id, user_email=gdpr.pseudonym_for(uid), details=counts)
    return {"message": "Dados pessoais anonimizados", **counts}


@router.get("/users/{user_id}/export")
def export_user_data(user_id: int, request: Request, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Admin: export one user's data (same tenant)."""
    user = _target(db, admin, user_id)
    data = gdpr.export_user_data(db, user)
    audit_request(db, request, admin, "privacy.data_exported", target_resource="user", target_id=user.id,
                  tenant_id=user.tenant_id)
    return data


@router.post("/users/{user_id}/erase")
def erase_user_data(user_id: int, req: EraseUserRequest, request: Request, db: Session = Depends(get_db),
                    admin: dict = Depends(require_admin), _pw: dict = Depends(require_password_changed)):
    """Admin: anonymise one user (same tenant)."""
    _require_confirm(req.confirm)
    user = _target(db, admin, user_id)
    _guard_erasable(db, user)
    uid, tenant_id = user.id, user.tenant_id
    counts = gdpr.erase_user(db, user)
    audit_request(db, request, admin, "privacy.user_erased", target_resource="user", target_id=uid,
                  tenant_id=tenant_id, details=counts)
    return {"message": "Dados pessoais anonimizados", **counts}


# ─── Sites (a site can be a household: its telemetry is personal data) ────────

def _site_for(db: Session, admin: dict, site_id: int) -> models.Site:
    q = db.query(models.Site).filter(models.Site.id == site_id)
    if admin.get("role") != "SUPER_ADMIN":
        # Fail closed on the caller's own tenant: 404 without revealing existence.
        q = q.filter(models.Site.tenant_id == admin.get("tenant_id"))
    site = q.first()
    if not site:
        raise HTTPException(404, "Site não encontrado")
    return site


@router.get("/sites/{site_id}/export")
def export_site(site_id: int, request: Request, raw_days: int = 0, db: Session = Depends(get_db),
                admin: dict = Depends(require_admin)):
    """Admin: export a site's data. `raw_days` (0-90) adds raw readings of the last N days;
    hourly summaries are always included. Device credentials are never exported."""
    if raw_days < 0 or raw_days > 90:
        raise HTTPException(400, "raw_days tem de estar entre 0 e 90")
    site = _site_for(db, admin, site_id)
    data = gdpr.export_site_data(db, site, raw_days=raw_days)
    audit_request(db, request, admin, "privacy.data_exported", target_resource="site", target_id=site.id,
                  tenant_id=site.tenant_id, details={"raw_days": raw_days, "truncated": data["truncated"]})
    return data


@router.post("/sites/{site_id}/erase")
def erase_site_data(site_id: int, req: EraseUserRequest, request: Request, db: Session = Depends(get_db),
                    admin: dict = Depends(require_admin), _pw: dict = Depends(require_password_changed)):
    """Admin: delete a site with all its devices (and their credentials), readings, hourly
    summaries, alerts and rules. Irreversible. Needs the word ERASE."""
    _require_confirm(req.confirm)
    site = _site_for(db, admin, site_id)
    sid, tenant_id = site.id, site.tenant_id
    counts = gdpr.erase_site(db, site)
    audit_request(db, request, admin, "privacy.site_erased", target_resource="site", target_id=sid,
                  tenant_id=tenant_id, details=counts)  # ids and counts only: a site name can identify a person
    return {"message": "Site e telemetria eliminados", **counts}
