from sqlalchemy import Column, Integer, Float, DateTime, String, JSON, Boolean, ForeignKey, Text, Index
from datetime import datetime
from backend.database import Base


# ─── Core ─────────────────────────────────────────────────────────────────────

class Tenant(Base):
    """Company / organisation — top-level multi-tenancy unit."""
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)       # url-safe id
    plan = Column(String, default="starter")                  # starter|pro|enterprise
    max_sites = Column(Integer, default=10)
    max_devices = Column(Integer, default=50)
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, default="#f59e0b")
    created_at = Column(DateTime, default=datetime.utcnow)
    active = Column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="operator")   # superadmin|admin|operator|viewer|installer
    color = Column(String, default="#4ade80")
    active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    terms_accepted_at = Column(DateTime, nullable=True)   # digital acceptance of Terms of Use / EULA
    
    # 2FA / TOTP fields
    totp_secret = Column(String, nullable=True)  # Encrypted TOTP secret (base32)
    totp_enabled = Column(Boolean, default=False)  # Whether 2FA is active for this user
    totp_backup_codes = Column(JSON, nullable=True)  # Hashed backup codes for recovery


# ─── Devices / Readings ────────────────────────────────────────────────────────

class BatteryState(Base):
    __tablename__ = "battery_state"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    soc = Column(Float)
    power_kw = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)


class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    site_id = Column(Integer, nullable=True)
    protocol = Column(String, nullable=False)
    device_type = Column(String, default="inverter")
    config = Column(JSON, nullable=False, default={})
    enabled = Column(Boolean, default=True)
    status = Column(String, default="unknown")
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeviceReading(Base):
    __tablename__ = "device_readings"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    device_id = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    power_kw = Column(Float, nullable=True)
    energy_kwh = Column(Float, nullable=True)
    soc_pct = Column(Float, nullable=True)
    temp_c = Column(Float, nullable=True)
    voltage_v = Column(Float, nullable=True)
    current_a = Column(Float, nullable=True)
    frequency_hz = Column(Float, nullable=True)
    raw = Column(JSON, nullable=True)


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertRule(Base):
    """Configurable alert rule per tenant."""
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    device_id = Column(Integer, nullable=True)   # None = all devices
    metric = Column(String, nullable=False)       # power_kw | soc_pct | temp_c | status
    operator = Column(String, nullable=False)     # gt | lt | eq | ne
    threshold = Column(Float, nullable=True)
    severity = Column(String, default="warning")  # info | warning | critical
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alert(Base):
    """Fired alert event."""
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    rule_id = Column(Integer, nullable=True)
    device_id = Column(Integer, nullable=True)
    device_name = Column(String, nullable=True)
    severity = Column(String, default="warning")
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    metric = Column(String, nullable=True)
    value = Column(Float, nullable=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    fired_at = Column(DateTime, default=datetime.utcnow, index=True)


# ─── VPP ─────────────────────────────────────────────────────────────────────

class VPPGroup(Base):
    """Virtual Power Plant — aggregation of sites for market bidding."""
    __tablename__ = "vpp_groups"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    market = Column(String, default="MIBEL")     # MIBEL | EPEX | N2EX | OMIE
    strategy = Column(String, default="peak_shaving")  # peak_shaving | arbitrage | fcr | afrr
    target_kw = Column(Float, nullable=True)
    min_bid_kw = Column(Float, default=100.0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VPPSiteMembership(Base):
    __tablename__ = "vpp_site_memberships"
    id = Column(Integer, primary_key=True, index=True)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    site_id = Column(Integer, nullable=False)
    weight = Column(Float, default=1.0)         # dispatch weight


class VPPBid(Base):
    """Market bid submitted from a VPP group."""
    __tablename__ = "vpp_bids"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    market = Column(String, nullable=False)
    delivery_period = Column(String, nullable=True)   # ISO datetime or "H+1"
    quantity_kw = Column(Float, nullable=False)
    price_eur_mwh = Column(Float, nullable=True)
    direction = Column(String, default="sell")        # sell | buy | fcr_up | fcr_down
    status = Column(String, default="pending")        # pending | submitted | accepted | rejected
    pnl_eur = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)


# ─── Reports ─────────────────────────────────────────────────────────────────

class ReportJob(Base):
    __tablename__ = "report_jobs"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    report_type = Column(String, nullable=False)   # monthly | due_diligence | regulatory | investor
    period = Column(String, nullable=True)         # e.g. "2025-05"
    site_ids = Column(JSON, nullable=True)
    status = Column(String, default="pending")     # pending | running | done | error
    file_path = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    requested_by = Column(String, nullable=True)


# ─── Audit Logs ──────────────────────────────────────────────────────────────

class AuditLog(Base):
    """Immutable audit trail for critical actions (trading, asset changes, admin actions).
    
    This table is APPEND-ONLY — no UPDATE or DELETE operations should ever be performed.
    Used for GDPR compliance, NIS2 audit requirements, and trading traceability.
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String, nullable=True)  # Denormalized for faster queries
    
    # Action details
    action = Column(String, nullable=False, index=True)  # e.g., "trade.create", "asset.modify", "user.login"
    target_resource = Column(String, nullable=True)  # e.g., "vpp_bid:123", "device:456"
    target_id = Column(Integer, nullable=True)  # ID of the affected resource
    
    # Context
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)  # Additional context (before/after values, etc.)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Composite index for common queries
    __table_args__ = (
        Index("ix_audit_logs_tenant_timestamp", "tenant_id", "timestamp"),
        Index("ix_audit_logs_user_timestamp", "user_id", "timestamp"),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action='{self.action}', user_id={self.user_id}, timestamp={self.timestamp})>"
