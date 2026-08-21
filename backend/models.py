from sqlalchemy import Column, Integer, Float, DateTime, String, JSON, Boolean, ForeignKey, Text, Index
from datetime import datetime, timezone
from backend.database import Base


def utcnow_naive():
    """Return current UTC time as a naive datetime for existing DB columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    plan = Column(String, default="beta")
    max_sites = Column(Integer, default=1)
    max_devices = Column(Integer, default=50)
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, default="#f59e0b")
    created_at = Column(DateTime, default=utcnow_naive)
    active = Column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="TENANT_MEMBER")
    color = Column(String, default="#4ade80")
    active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    terms_accepted_at = Column(DateTime, nullable=True)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_backup_codes = Column(JSON, nullable=True)


class BatteryState(Base):
    __tablename__ = "battery_state"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    soc = Column(Float)
    power_kw = Column(Float)
    timestamp = Column(DateTime, default=utcnow_naive)


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
    created_at = Column(DateTime, default=utcnow_naive)


class DeviceReading(Base):
    __tablename__ = "device_readings"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    device_id = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime, default=utcnow_naive, index=True)
    power_kw = Column(Float, nullable=True)
    energy_kwh = Column(Float, nullable=True)
    soc_pct = Column(Float, nullable=True)
    temp_c = Column(Float, nullable=True)
    voltage_v = Column(Float, nullable=True)
    current_a = Column(Float, nullable=True)
    frequency_hz = Column(Float, nullable=True)
    raw = Column(JSON, nullable=True)


class AlertRule(Base):
    __tablename__ = "alert_rules"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    device_id = Column(Integer, nullable=True)
    metric = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    threshold = Column(Float, nullable=True)
    severity = Column(String, default="warning")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
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
    fired_at = Column(DateTime, default=utcnow_naive, index=True)


class VPPGroup(Base):
    __tablename__ = "vpp_groups"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    market = Column(String, default="MIBEL")
    strategy = Column(String, default="peak_shaving")
    target_kw = Column(Float, nullable=True)
    min_bid_kw = Column(Float, default=100.0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow_naive)


class VPPSiteMembership(Base):
    __tablename__ = "vpp_site_memberships"
    id = Column(Integer, primary_key=True, index=True)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    site_id = Column(Integer, nullable=False)
    weight = Column(Float, default=1.0)


class VPPBid(Base):
    __tablename__ = "vpp_bids"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    market = Column(String, nullable=False)
    delivery_period = Column(String, nullable=True)
    quantity_kw = Column(Float, nullable=False)
    price_eur_mwh = Column(Float, nullable=True)
    direction = Column(String, default="sell")
    status = Column(String, default="pending")
    pnl_eur = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=utcnow_naive)


class ForecastRecord(Base):
    """Persisted canonical forecast snapshot consumed by optimization."""
    __tablename__ = "forecast_records"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    horizon_hours = Column(Integer, nullable=False)
    timestamps = Column(JSON, nullable=False)
    prices_eur_mwh = Column(JSON, nullable=False)
    load_kw = Column(JSON, nullable=False)
    solar_kw = Column(JSON, nullable=False)
    providers = Column(JSON, nullable=False)
    generated_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    status = Column(String, default="valid", nullable=False)

    __table_args__ = (Index("ix_forecast_records_tenant_generated", "tenant_id", "generated_at"),)


class VPPOptimizationRun(Base):
    __tablename__ = "vpp_optimization_runs"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")
    horizon_hours = Column(Integer, nullable=False)
    price_source = Column(String, nullable=True)
    forecast_source = Column(String, nullable=True)
    forecast_generated_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, default=utcnow_naive, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    solver_time_ms = Column(Float, nullable=True)
    total_cost_eur = Column(Float, nullable=True)
    total_import_kwh = Column(Float, nullable=True)
    total_export_kwh = Column(Float, nullable=True)
    error = Column(Text, nullable=True)


class VPPDispatchRecord(Base):
    __tablename__ = "vpp_dispatch_records"
    id = Column(Integer, primary_key=True, index=True)
    optimization_run_id = Column(Integer, ForeignKey("vpp_optimization_runs.id"), nullable=False, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    vpp_id = Column(Integer, ForeignKey("vpp_groups.id"), nullable=False, index=True)
    interval_start = Column(DateTime, nullable=False, index=True)
    dispatch_kw = Column(Float, nullable=False, default=0.0)
    asset_dispatch = Column(JSON, nullable=True)
    site_dispatch = Column(JSON, nullable=True)


# ─── Reports ─────────────────────────────────────────────────────────────────

class ReportJob(Base):
    __tablename__ = "report_jobs"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    report_type = Column(String, nullable=False)
    period = Column(String, nullable=True)
    site_ids = Column(JSON, nullable=True)
    status = Column(String, default="pending")
    file_path = Column(String, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    completed_at = Column(DateTime, nullable=True)
    requested_by = Column(String, nullable=True)


# ─── Audit Logs ──────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    user_email = Column(String, nullable=True)
    
    action = Column(String, nullable=False, index=True)
    target_resource = Column(String, nullable=True)
    target_id = Column(Integer, nullable=True)
    
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime, default=utcnow_naive, nullable=False, index=True)
    
    __table_args__ = (
        Index("ix_audit_logs_tenant_timestamp", "tenant_id", "timestamp"),
        Index("ix_audit_logs_user_timestamp", "user_id", "timestamp"),
    )
