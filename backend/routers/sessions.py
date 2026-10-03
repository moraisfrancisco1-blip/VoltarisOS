"""Active logins ("sessões"): list them, end one, end all the others.

Ending a session deletes its server-side row (backend/sessions.py), so the token
that carried it is refused on its next request. A tenant admin can end every
session of a user of their own tenant (lost laptop, leaver).
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend import models
from backend.audit import audit_request
from backend.database import SessionLocal
from backend.security import get_current_user, require_admin
from backend.sessions import revoke_session, revoke_user_sessions

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _me(db: Session, current: dict) -> models.User:
    user = db.query(models.User).filter(models.User.email == current.get("sub")).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    return user


def _view(row: models.UserSession, current_sid) -> dict:
    return {
        "id": row.id, "current": row.id == current_sid,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "ip_address": row.ip_address, "user_agent": row.user_agent,
    }


@router.get("")
def list_my_sessions(db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    user = _me(db, current)
    now = models.utcnow_naive()
    rows = (db.query(models.UserSession)
            .filter(models.UserSession.user_id == user.id, models.UserSession.expires_at > now)
            .order_by(models.UserSession.last_seen_at.desc()).all())
    return [_view(r, current.get("sid")) for r in rows]


@router.post("/revoke-others")
def revoke_other_sessions(request: Request, db: Session = Depends(get_db), current: dict = Depends(get_current_user)):
    """Sign out everywhere except here."""
    user = _me(db, current)
    sid = current.get("sid")
    if not sid:
        raise HTTPException(409, "Esta sessão ainda não é revogável — volte a iniciar sessão")
    ended = revoke_user_sessions(db, user.id, except_sid=sid)
    audit_request(db, request, current, "session.revoked_all", target_resource="user", target_id=user.id,
                  details={"ended": ended})
    return {"ended": ended}


@router.delete("/{session_id}")
def revoke_my_session(session_id: str, request: Request, db: Session = Depends(get_db),
                      current: dict = Depends(get_current_user)):
    """End one of the caller's own sessions (ending the current one signs out)."""
    user = _me(db, current)
    row = db.get(models.UserSession, session_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(404, "Sessão não encontrada")
    revoke_session(db, session_id)
    audit_request(db, request, current, "session.revoked", target_resource="user", target_id=user.id)
    return {"ended": 1}


@router.post("/users/{user_id}/revoke")
def revoke_user_sessions_admin(user_id: int, request: Request, db: Session = Depends(get_db),
                               admin: dict = Depends(require_admin)):
    """Admin: end every session of a user (same tenant; SUPER_ADMIN any)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Utilizador não encontrado")
    if admin.get("role") != "SUPER_ADMIN":
        me = db.query(models.User).filter(models.User.email == admin.get("sub")).first()
        if me is None or user.tenant_id != me.tenant_id:
            raise HTTPException(403, "Acesso negado — utilizador fora do teu tenant")
    ended = revoke_user_sessions(db, user.id)
    audit_request(db, request, admin, "session.revoked_all", target_resource="user", target_id=user.id,
                  tenant_id=user.tenant_id, details={"ended": ended})
    return {"ended": ended}
