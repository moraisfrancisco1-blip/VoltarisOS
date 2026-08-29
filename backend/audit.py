"""
audit.py — Audit logging helper for critical actions.

This module provides a simple interface to log audit events to the audit_logs table.
All critical actions (trading, asset changes, admin actions) should be logged here.

Usage:
    from backend.audit import log_audit_event
    
    # In a FastAPI endpoint:
    log_audit_event(
        db=db,
        tenant_id=user["tenant_id"],
        user_id=user_id,
        user_email=user["sub"],
        action="trade.create",
        target_resource="vpp_bid",
        target_id=bid_id,
        ip_address=request.client.host,
        details={"quantity_kw": 100, "price": 45.5}
    )

The audit_logs table is APPEND-ONLY — no UPDATE or DELETE operations.
"""
from typing import Optional, Any
from datetime import datetime
from sqlalchemy.orm import Session
from backend.models import AuditLog, utcnow_naive


def log_audit_event(
    db: Session,
    action: str,
    tenant_id: Optional[int] = None,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    target_resource: Optional[str] = None,
    target_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    timestamp: Optional[datetime] = None,
) -> AuditLog:
    """
    Log an audit event to the audit_logs table.
    
    Args:
        db: SQLAlchemy database session
        action: Action identifier (e.g., "trade.create", "asset.modify", "user.login")
        tenant_id: ID of the tenant (for multi-tenancy isolation)
        user_id: ID of the user performing the action
        user_email: Email of the user (denormalized for faster queries)
        target_resource: Type of resource affected (e.g., "vpp_bid", "device", "user")
        target_id: ID of the specific resource affected
        ip_address: IP address of the request
        user_agent: User agent string from the request
        details: Additional context (before/after values, parameters, etc.)
        timestamp: Custom timestamp (defaults to utcnow())
    
    Returns:
        The created AuditLog entry
    
    Example actions:
        - "user.login" / "user.logout"
        - "user.create" / "user.modify" / "user.delete"
        - "trade.create" / "trade.submit" / "trade.cancel"
        - "asset.create" / "asset.modify" / "asset.delete"
        - "vpp.bid.create" / "vpp.bid.submit"
        - "alert.acknowledge"
        - "settings.change"
    """
    audit_log = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        user_email=user_email,
        action=action,
        target_resource=target_resource,
        target_id=target_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
        timestamp=timestamp or utcnow_naive(),
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def log_user_login(
    db: Session,
    user_id: int,
    tenant_id: int,
    user_email: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    success: bool = True,
) -> AuditLog:
    """Convenience function to log user login attempts."""
    return log_audit_event(
        db=db,
        action="user.login.success" if success else "user.login.failed",
        tenant_id=tenant_id,
        user_id=user_id if success else None,
        user_email=user_email,
        ip_address=ip_address,
        user_agent=user_agent,
        details={"success": success},
    )


def log_trade_action(
    db: Session,
    action: str,
    tenant_id: int,
    user_id: int,
    user_email: str,
    bid_id: Optional[int] = None,
    vpp_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None,
) -> AuditLog:
    """Convenience function to log trading actions."""
    return log_audit_event(
        db=db,
        action=f"trade.{action}",
        tenant_id=tenant_id,
        user_id=user_id,
        user_email=user_email,
        target_resource="vpp_bid",
        target_id=bid_id,
        ip_address=ip_address,
        details={**(details or {}), "vpp_id": vpp_id} if vpp_id else details,
    )


def log_asset_action(
    db: Session,
    action: str,
    tenant_id: int,
    user_id: int,
    user_email: str,
    device_id: Optional[int] = None,
    site_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    details: Optional[dict] = None,
) -> AuditLog:
    """Convenience function to log asset management actions."""
    target = "device" if device_id else "site"
    target_id = device_id or site_id
    return log_audit_event(
        db=db,
        action=f"asset.{action}",
        tenant_id=tenant_id,
        user_id=user_id,
        user_email=user_email,
        target_resource=target,
        target_id=target_id,
        ip_address=ip_address,
        details=details,
    )