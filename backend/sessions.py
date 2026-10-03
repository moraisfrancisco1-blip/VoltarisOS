"""sessions.py — server-side record of logins, so they can be revoked.

A JWT on its own cannot be cancelled before it expires. Each login therefore also
creates a UserSession row whose id travels in the token as `sid`; the per-request
check lives in security.decode_token. Tokens issued before this existed carry no
`sid` and keep working until their 72h expiry (see SESSIONS_REQUIRE_SID).
"""
import secrets
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend import models
from backend.models import utcnow_naive

SESSION_TTL = timedelta(hours=72)  # same as the JWT exp in auth.create_token


def _client_info(request) -> tuple:
    client = getattr(request, "client", None)
    headers = getattr(request, "headers", None)
    ua = headers.get("user-agent") if headers else None
    return (client.host if client else None), (ua[:300] if ua else None)


def create_session(db: Session, user: models.User, request=None) -> str:
    ip, ua = _client_info(request)
    row = models.UserSession(
        id=secrets.token_urlsafe(32), user_id=user.id, tenant_id=user.tenant_id,
        expires_at=utcnow_naive() + SESSION_TTL, ip_address=ip, user_agent=ua,
    )
    db.add(row)
    db.commit()
    return row.id


def ensure_session(db: Session, user: models.User, request=None, current_sid: Optional[str] = None) -> str:
    """Keep the caller's live session (extending its rolling 72h) or, for a token
    issued before sessions existed / whose row is gone, open a new one."""
    if current_sid:
        row = db.get(models.UserSession, current_sid)
        if row is not None and row.user_id == user.id and row.expires_at > utcnow_naive():
            row.expires_at = utcnow_naive() + SESSION_TTL
            db.commit()
            return row.id
    return create_session(db, user, request)


def revoke_session(db: Session, session_id: str) -> int:
    n = db.query(models.UserSession).filter(models.UserSession.id == session_id).delete(synchronize_session=False)
    db.commit()
    return n


def revoke_user_sessions(db: Session, user_id: int, except_sid: Optional[str] = None) -> int:
    q = db.query(models.UserSession).filter(models.UserSession.user_id == user_id)
    if except_sid:
        q = q.filter(models.UserSession.id != except_sid)
    n = q.delete(synchronize_session=False)
    db.commit()
    return n
