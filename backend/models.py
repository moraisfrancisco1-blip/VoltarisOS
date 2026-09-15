from sqlalchemy import Column, Integer, Float, DateTime, String, JSON, Boolean, ForeignKey, Text, Index, UniqueConstraint, text
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
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    subscription_status = Column(String, nullable=True)
    subscription_end = Column(DateTime, nullable=True)

    # White-label custom domain (Enterprise plan — see permissions.py's
    # "admin_whitelabel"). Provisioned for real via Railway's public API
    # when RAILWAY_API_TOKEN is configured (backend/railway_client.py);
    # otherwise stays "pending_manual_setup" rather than pretending to work.
    # status: requested | pending_manual_setup | pending_dns | active | error
    custom_domain = Column(String, nullable=True, unique=True)
    custom_domain_status = Column(String, nullable=True)
    custom_domain_railway_id = Column(String, nullable=True)
    custom_domain_cname_target = Column(String, nullable=True)
    custom_domain_verification_host = Column(String, nullable=True)
    custom_domain_verification_value = Column(String, nullable=True)
    custom_domain_requested_at = Column(DateTime, nullable=True)
    custom_domain_error = Column(String, nullable=True)

    # Company profile (Settings > Company) — see backend/routers/company.py's
    # PATCH /api/company. TENANT_ADMIN/SUPER_ADMIN only.
    vat_number = Column(String, nullable=True)
    address = Column(String, nullable=True)
    country = Column(String, nullable=True)
    website = Column(String, nullable=True)
    support_email = Column(String, nullable=True)
    billing_email = Column(String, nullable=True)


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
    # Set when an account is created with a temporary password (e.g. the first
    # user of a new tenant) — the account must change it on first login.
    # NULL/False for every account created before this flag existed.
    must_change_password = Column(Boolean, default=False)
    last_login = Column(DateTime, nullable=True)
    # Updated by get_current_user() on any authenticated request (throttled to
    # once per 60s per user) — unlike last_login, this tracks the session
    # actually being used, not just the moment of login.
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)
    terms_accepted_at = Column(DateTime, nullable=True)
    totp_secret = Column(String, nullable=True)
    totp_enabled = Column(Boolean, default=False)
    totp_backup_codes = Column(JSON, nullable=True)
    # Profile picture as a data: URL (base64), not a file path -- avoids
    # needing a provisioned volume/object store for what's typically a
    # small (<=300KB) image. See backend/routers/auth.py's avatar endpoints.
    avatar_data_url = Column(Text, nullable=True)
    phone = Column(String, nullable=True)
    job_title = Column(String, nullable=True)


class BatteryState(Base):
    __tablename__ = "battery_state"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    soc = Column(Float)
    power_kw = Column(Float)
    timestamp = Column(DateTime, default=utcnow_naive)


class Site(Base):
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    timezone = Column(String, nullable=True)
    solar_kw = Column(Float, default=0.0)
    battery_kwh = Column(Float, default=0.0)
    ev_chargers = Column(Integer, default=0)
    owner = Column(String, nullable=True)
    status = Column(String, default="active")
    # Panel orientation, in Open-Meteo's own convention (forecasting/weather_forecast.py
    # passes these straight through to their global_tilted_irradiance API, no conversion):
    #   tilt_deg: 0-90, 0 = flat/horizontal.
    #   azimuth_deg: 0 = South, -90 = East, 90 = West, +-180 = North.
    # NULL means "not configured yet" -- the solar forecast falls back to flat-horizontal
    # (GHI) irradiance for that site until these are set.
    tilt_deg = Column(Float, nullable=True)
    azimuth_deg = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)


class Device(Base):
    __tablename__ = "devices"
    __table_args__ = (
        Index("uq_devices_tenant_external", "tenant_id", "external_id", unique=True,
              sqlite_where=text("external_id IS NOT NULL"),
              postgresql_where=text("external_id IS NOT NULL")),
    )
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="SET NULL"), nullable=True)
    protocol = Column(String, nullable=False)
    device_type = Column(String, default="inverter")
    external_id = Column(String, nullable=True)
    config = Column(JSON, nullable=False, default={})
    enabled = Column(Boolean, default=True)
    status = Column(String, default="unknown")
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow_naive)


class DeviceReading(Base):
    __tablename__ = "device_readings"
    __table_args__ = (
        UniqueConstraint("device_id", "timestamp", name="uq_device_reading_device_timestamp"),
    )
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
    site_id = Column(Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
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
    schedule = Column(JSON, nullable=True)
    solver_status = Column(String, nullable=True)
    committed = Column(Boolean, nullable=False, default=False)


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


# ─── API Keys (user-facing, for external integrations) ───────────────────────

class ApiKey(Base):
    """A tenant-scoped credential a TENANT_ADMIN can generate to let external
    scripts/systems call the VoltarisOS REST API as `Authorization: Bearer
    vos_...`. Only the SHA-256 hash is stored -- the plaintext key is shown to
    the user exactly once (at creation/rotation) and never persisted.
    Deliberately grants TENANT_MEMBER-equivalent access regardless of the
    creator's own role: least privilege for a credential that can leak in a
    script or CI log. See backend/security.py's get_current_user."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)

    key_prefix = Column(String, unique=True, index=True, nullable=False)
    key_hash = Column(String, nullable=False)

    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)


# ─── Webhooks (outbound, user-configured) ─────────────────────────────────────

class Webhook(Base):
    """A tenant-configured HTTP endpoint that receives a signed POST whenever
    one of `event_types` is audit-logged for this tenant (see backend/audit.py's
    log_audit_event, which dispatches delivery -- backend/tasks.py's
    deliver_webhook -- asynchronously via Celery so a slow/unreachable
    receiver can never block the request that triggered the event."""
    __tablename__ = "webhooks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    url = Column(String, nullable=False)
    event_types = Column(JSON, nullable=False)  # list[str] of action values, or ["*"] for all
    # HMAC-SHA256 signing secret, plaintext (unlike ApiKey.key_hash) -- the
    # server needs it every delivery to sign the X-VoltarisOS-Signature header.
    secret = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=utcnow_naive, nullable=False)
    last_triggered_at = Column(DateTime, nullable=True)
    last_status_code = Column(Integer, nullable=True)
    last_error = Column(String, nullable=True)
    failure_count = Column(Integer, default=0, nullable=False)


# ─── Connected Apps (OAuth, tenant-wide) ──────────────────────────────────────

class OAuthConnection(Base):
    """One tenant-wide connection per external provider (Google Workspace,
    Microsoft 365, Slack) -- Settings > Connected Apps. Tokens are stored
    plaintext (same trust boundary as User.totp_secret elsewhere in this
    file); the provider's own client_secret never leaves the backend (see
    backend/routers/oauth_connections.py)."""
    __tablename__ = "oauth_connections"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    provider = Column(String, nullable=False)  # "google" | "microsoft" | "slack"
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    scope = Column(String, nullable=True)
    account_label = Column(String, nullable=True)  # email / workspace name, for display only

    connected_at = Column(DateTime, default=utcnow_naive, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "provider", name="uq_oauth_tenant_provider"),
    )


class StripeEvent(Base):
    __tablename__ = "stripe_events"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, nullable=False, index=True)
    processed_at = Column(DateTime, default=utcnow_naive, nullable=False)


# ─── Marketing leads (public landing page, no tenant/auth) ───────────────────

class Lead(Base):
    """Early-access sign-ups submitted from the public landing page's lead
    capture form (landing/src/components/lead-capture.tsx), via the public
    POST /api/leads endpoint. Not tied to any tenant -- these people don't
    have accounts yet."""
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)
    company = Column(String, nullable=True)
    source = Column(String, nullable=True)  # e.g. "landing_page"
    created_at = Column(DateTime, default=utcnow_naive, nullable=False)


# ─── Tenant-wide operational preferences (Settings > Energy/Trading/Notifications) ─

class TenantSettings(Base):
    """One row per tenant, holding the operational preference blocks from
    Settings.jsx's Energy, Trading, and Notifications tabs. These used to
    live only in each browser's localStorage (via the Zustand store) --
    real for that one browser, invisible to the backend, lost on another
    device. See backend/routers/tenant_settings.py.

    Each block is stored as an opaque JSON object; this router doesn't
    validate its internal shape beyond what the frontend already sends,
    matching the flexibility the previous localStorage-only version had.
    Note the actual trading/optimization engine (backend/tasks.py,
    trading_agent.py) does not yet read `trading`/`energy` here -- this
    migration makes the values real and tenant-wide, not (yet) wired into
    dispatch decisions. See KNOWN_LIMITATIONS in tenant_settings.py.
    """
    __tablename__ = "tenant_settings"

    tenant_id = Column(Integer, ForeignKey("tenants.id"), primary_key=True)
    energy = Column(JSON, nullable=True)
    trading = Column(JSON, nullable=True)
    notifications = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utcnow_naive, onupdate=utcnow_naive, nullable=False)
