"""gdpr.py — export and erase the personal data of ONE user (RGPD arts. 15, 17, 20).

Erasure is anonymisation, not a row delete: other tables reference users.id, and
audit logs / billing must survive (legitimate interest + legal duty). What makes
a person identifiable is removed or replaced by a pseudonym; the row stays as an
inert, deactivated shell that can no longer log in.
"""
import json
import secrets
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from backend import models
from backend.models import utcnow_naive
from backend.security import hash_pw

ERASED_DOMAIN = "erased.invalid"


def pseudonym_for(user_id: int) -> str:
    return f"erased-{user_id}@{ERASED_DOMAIN}"


def _iso(value: Any):
    return value.isoformat() if isinstance(value, datetime) else value


def export_user_data(db: Session, user: models.User) -> dict:
    """Everything we hold about `user`, in a portable JSON-friendly dict.
    Secrets (password hash, TOTP secret/backup codes, OAuth tokens, API-key
    hashes, webhook secrets) are deliberately omitted: they are credentials, not
    the person's data, and exporting them would only widen a leak."""
    audit_rows = (
        db.query(models.AuditLog)
        .filter((models.AuditLog.user_id == user.id) | (models.AuditLog.user_email == user.email))
        .order_by(models.AuditLog.timestamp.desc())
        .all()
    )
    return {
        "generated_at": _iso(utcnow_naive()),
        "profile": {
            "id": user.id, "email": user.email, "name": user.name, "role": user.role,
            "phone": user.phone, "job_title": user.job_title, "color": user.color,
            "has_avatar": bool(user.avatar_data_url), "avatar_data_url": user.avatar_data_url,
            "two_factor_enabled": bool(user.totp_enabled), "active": user.active,
            "created_at": _iso(user.created_at), "last_login": _iso(user.last_login),
            "last_seen_at": _iso(user.last_seen_at), "terms_accepted_at": _iso(user.terms_accepted_at),
            "tenant_id": user.tenant_id,
        },
        "api_keys": [
            {"id": k.id, "name": k.name, "prefix": k.key_prefix, "created_at": _iso(k.created_at),
             "last_used_at": _iso(k.last_used_at), "revoked_at": _iso(k.revoked_at)}
            for k in db.query(models.ApiKey).filter(models.ApiKey.user_id == user.id)
        ],
        "webhooks": [
            {"id": w.id, "url": w.url, "event_types": w.event_types, "active": w.active,
             "created_at": _iso(w.created_at)}
            for w in db.query(models.Webhook).filter(models.Webhook.user_id == user.id)
        ],
        "oauth_connections": [
            {"id": c.id, "provider": c.provider, "account_label": c.account_label,
             "scope": c.scope, "connected_at": _iso(c.connected_at)}
            for c in db.query(models.OAuthConnection).filter(models.OAuthConnection.user_id == user.id)
        ],
        "sessions": [
            {"created_at": _iso(x.created_at), "last_seen_at": _iso(x.last_seen_at), "expires_at": _iso(x.expires_at),
             "ip_address": x.ip_address, "user_agent": x.user_agent}
            for x in db.query(models.UserSession).filter(models.UserSession.user_id == user.id)
        ],
        "report_requests": [
            {"id": r.id, "report_type": r.report_type, "period": r.period, "created_at": _iso(r.created_at)}
            for r in db.query(models.ReportJob).filter(models.ReportJob.requested_by == user.email)
        ],
        "leads": [
            {"id": l.id, "name": l.name, "email": l.email, "company": l.company}
            for l in db.query(models.Lead).filter(models.Lead.email == user.email)
        ],
        "activity_log": [
            {"timestamp": _iso(a.timestamp), "action": a.action, "target_resource": a.target_resource,
             "target_id": a.target_id, "ip_address": a.ip_address, "user_agent": a.user_agent}
            for a in audit_rows
        ],
    }


def _scrub(value: Any, old: str, new: str) -> Any:
    if isinstance(value, str):
        return value.replace(old, new)
    if isinstance(value, dict):
        return {k: _scrub(v, old, new) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v, old, new) for v in value]
    return value


def erase_user(db: Session, user: models.User) -> dict:
    """Anonymise `user` in place and purge the personal data hanging off them.
    Commits. Returns counts for the audit trail (never the identifiers)."""
    old_email, uid = user.email, user.id
    alias = pseudonym_for(uid)

    # Logs: every entry authored by, or about, this person loses the identifiers.
    logs = (
        db.query(models.AuditLog)
        .filter(
            (models.AuditLog.user_id == uid)
            | (models.AuditLog.user_email == old_email)
            | ((models.AuditLog.target_resource == "user") & (models.AuditLog.target_id == uid))
        )
        .all()
    )
    for row in logs:
        row.user_email = alias if row.user_email == old_email else row.user_email
        row.ip_address = None
        row.user_agent = None
        if row.details and old_email in json.dumps(row.details, default=str):
            row.details = _scrub(row.details, old_email, alias)

    reports = db.query(models.ReportJob).filter(models.ReportJob.requested_by == old_email).all()
    for r in reports:
        r.requested_by = alias

    sessions = db.query(models.UserSession).filter(models.UserSession.user_id == uid).delete(synchronize_session=False)
    leads = db.query(models.Lead).filter(models.Lead.email == old_email).delete(synchronize_session=False)
    oauth = db.query(models.OAuthConnection).filter(models.OAuthConnection.user_id == uid).delete(synchronize_session=False)
    now = utcnow_naive()
    keys = 0
    for k in db.query(models.ApiKey).filter(models.ApiKey.user_id == uid, models.ApiKey.revoked_at.is_(None)):
        k.revoked_at = now
        keys += 1

    user.email = alias
    user.name = None
    user.phone = None
    user.job_title = None
    user.avatar_data_url = None
    user.totp_secret = None
    user.totp_enabled = False
    user.totp_backup_codes = None
    user.active = False
    user.password_hash = hash_pw(secrets.token_urlsafe(32))  # unknown to everyone: no login possible
    db.commit()
    return {"audit_rows": len(logs), "reports": len(reports), "leads": leads,
            "oauth_connections": oauth, "api_keys_revoked": keys, "sessions_ended": sessions}
