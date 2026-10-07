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


# ─── Site-level data (households are personal data) ───────────────────────────
# A site can be someone's home: its location, owner and above all the energy
# telemetry (consumption patterns) identify the household. The Customer (tenant)
# is the controller; these helpers let a tenant admin answer an access/erasure
# request about a site. Plain site/device DELETE keeps its historical behaviour
# (telemetry rows only point at devices by a bare integer, so they are orphaned,
# not removed); erase_site is the deliberate, complete path.

EXPORT_ROW_CAP = 200_000
_CHUNK = 10_000


def _site_devices(db: Session, site: models.Site) -> list:
    return db.query(models.Device).filter(models.Device.site_id == site.id,
                                          models.Device.tenant_id == site.tenant_id).all()


def export_site_data(db: Session, site: models.Site, raw_days: int = 0) -> dict:
    """Everything held about a site. Device credentials (`config`) are omitted.
    Hourly summaries are always included; raw readings only for the last
    `raw_days` days (0 = counts only). One shared row cap keeps the response bounded."""
    from datetime import timedelta
    devices = _site_devices(db, site)
    ids = [d.id for d in devices]
    budget = EXPORT_ROW_CAP
    truncated = False

    hourly = []
    if ids:
        q = (db.query(models.DeviceReadingHourly).filter(models.DeviceReadingHourly.device_id.in_(ids))
             .order_by(models.DeviceReadingHourly.hour_start))
        for r in q.limit(budget + 1):
            if len(hourly) >= budget:
                truncated = True
                break
            hourly.append({"device_id": r.device_id, "hour_start": _iso(r.hour_start), "samples": r.sample_count,
                           "power_kw_avg": r.power_kw_avg, "power_kw_min": r.power_kw_min, "power_kw_max": r.power_kw_max,
                           "energy_kwh": r.energy_kwh_sum, "soc_pct_avg": r.soc_pct_avg, "temp_c_avg": r.temp_c_avg})
        budget -= len(hourly)

    raw, raw_count = [], 0
    if ids:
        raw_q = db.query(models.DeviceReading).filter(models.DeviceReading.device_id.in_(ids))
        raw_count = raw_q.count()
        if raw_days > 0 and budget > 0:
            since = utcnow_naive() - timedelta(days=min(raw_days, 90))
            for r in raw_q.filter(models.DeviceReading.timestamp >= since).order_by(models.DeviceReading.timestamp).limit(budget + 1):
                if len(raw) >= budget:
                    truncated = True
                    break
                raw.append({"device_id": r.device_id, "timestamp": _iso(r.timestamp), "power_kw": r.power_kw,
                            "energy_kwh": r.energy_kwh, "soc_pct": r.soc_pct, "temp_c": r.temp_c})
    alerts = [
        {"fired_at": _iso(a.fired_at), "device_id": a.device_id, "severity": a.severity, "title": a.title,
         "message": a.message, "metric": a.metric, "value": a.value}
        for a in (db.query(models.Alert).filter(models.Alert.tenant_id == site.tenant_id, models.Alert.device_id.in_(ids)).all() if ids else [])
    ]
    return {
        "generated_at": _iso(utcnow_naive()),
        "site": {"id": site.id, "name": site.name, "owner": site.owner, "location": site.location, "lat": site.lat,
                 "lng": site.lng, "timezone": site.timezone, "solar_kw": site.solar_kw, "battery_kwh": site.battery_kwh,
                 "ev_chargers": site.ev_chargers, "created_at": _iso(site.created_at)},
        "devices": [{"id": d.id, "name": d.name, "protocol": d.protocol, "device_type": d.device_type,
                     "external_id": d.external_id, "enabled": d.enabled, "status": d.status,
                     "last_seen": _iso(d.last_seen), "created_at": _iso(d.created_at)} for d in devices],
        "raw_readings": {"stored_count": raw_count, "included_days": min(raw_days, 90) if raw_days > 0 else 0, "rows": raw},
        "hourly_summaries": hourly,
        "alerts": alerts,
        "truncated": truncated,
    }


def _delete_in_chunks(db: Session, model, column, ids: list) -> int:
    total = 0
    while ids:
        batch = [r[0] for r in db.query(model.id).filter(column.in_(ids)).limit(_CHUNK).all()]
        if not batch:
            break
        db.query(model).filter(model.id.in_(batch)).delete(synchronize_session=False)
        db.commit()
        total += len(batch)
    return total


def erase_site(db: Session, site: models.Site) -> dict:
    """Delete a site and every trace of its telemetry. Commits. Returns counts."""
    ids = [d.id for d in _site_devices(db, site)]
    counts = {
        "raw_readings": _delete_in_chunks(db, models.DeviceReading, models.DeviceReading.device_id, ids),
        "hourly_summaries": _delete_in_chunks(db, models.DeviceReadingHourly, models.DeviceReadingHourly.device_id, ids),
        "alerts": _delete_in_chunks(db, models.Alert, models.Alert.device_id, ids),
    }
    if ids:
        counts["alert_rules"] = db.query(models.AlertRule).filter(
            models.AlertRule.tenant_id == site.tenant_id, models.AlertRule.device_id.in_(ids)).delete(synchronize_session=False)
        counts["devices"] = db.query(models.Device).filter(models.Device.id.in_(ids)).delete(synchronize_session=False)
    else:
        counts["alert_rules"] = counts["devices"] = 0
    db.query(models.VPPSiteMembership).filter(models.VPPSiteMembership.site_id == site.id).delete(synchronize_session=False)
    db.delete(site)
    db.commit()
    return counts
