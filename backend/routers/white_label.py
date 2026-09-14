"""
white_label.py — Real, single-tenant custom domain provisioning for
White-label (Enterprise plan -- see permissions.py's "admin_whitelabel").

Provisions for real via Railway's public API (backend/railway_client.py)
when RAILWAY_API_TOKEN is configured on this instance; otherwise a request
is stored as "pending_manual_setup" rather than pretending to work.

    POST   /api/white-label/domain     — Request/replace this tenant's custom domain
    GET    /api/white-label/domain     — Current status (lazily provisions/refreshes)
    DELETE /api/white-label/domain     — Remove it
    GET    /api/white-label/branding   — PUBLIC: branding for a hostname (pre-login)

NOTE: this is deliberately scoped to "this tenant's own domain" only. The
rest of WhiteLabel.jsx (a mocked-up console for managing OTHER tenants —
Tenants list, Brand Config, Feature Flags) is a different, much larger
reseller-admin feature that was not part of what was asked for here and
is left untouched/still fake.
"""
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator

from backend.database import SessionLocal
from backend.security import require_admin, check_module_access, require_password_changed
from backend.models import utcnow_naive
from backend import models
from backend.audit import log_audit_event
from backend import railway_client

router = APIRouter(prefix="/api/white-label", tags=["white-label"])

_HOSTNAME_RE = re.compile(
    r"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
)
# Platform's own domains -- a tenant can never "white-label" onto these.
_RESERVED_SUFFIXES = ("voltarisos.com", "railway.app")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DomainRequest(BaseModel):
    domain: str

    @field_validator("domain")
    @classmethod
    def validate_domain(cls, v):
        v = v.strip().lower()
        if v.startswith("http://") or v.startswith("https://") or "/" in v:
            raise ValueError("Usa apenas o hostname (ex: app.empresa.com), sem https:// ou caminho")
        if not _HOSTNAME_RE.match(v):
            raise ValueError("Domínio inválido")
        if any(v == s or v.endswith("." + s) for s in _RESERVED_SUFFIXES):
            raise ValueError("Este domínio está reservado à plataforma")
        return v


class DomainOut(BaseModel):
    domain: str | None = None
    status: str | None = None
    cname_target: str | None = None
    verification_host: str | None = None
    verification_value: str | None = None
    error: str | None = None
    requested_at: datetime | None = None
    railway_configured: bool


class BrandingOut(BaseModel):
    company_name: str
    logo_url: str | None = None
    primary_color: str


def _tenant_for(db, user: dict) -> models.Tenant:
    tenant = db.query(models.Tenant).filter(models.Tenant.id == user.get("tenant_id")).first()
    if not tenant:
        raise HTTPException(404, "Tenant não encontrado")
    return tenant


def _map_railway_status(status_payload: dict) -> tuple[str, str | None]:
    """Reduce Railway's dnsRecords + certificateStatus into our simple
    status string. Returns (status, error)."""
    cert = status_payload.get("certificateStatus")
    if cert == "ISSUED":
        return "active", None
    if cert == "FAILED":
        return "error", "Emissão do certificado SSL falhou"
    records = status_payload.get("dnsRecords") or []
    if any(r.get("status") == "INVALID" for r in records):
        return "error", "Um ou mais registos DNS estão incorretos"
    return "pending_dns", None


def _out(tenant: models.Tenant) -> DomainOut:
    return DomainOut(
        domain=tenant.custom_domain,
        status=tenant.custom_domain_status,
        cname_target=tenant.custom_domain_cname_target,
        verification_host=tenant.custom_domain_verification_host,
        verification_value=tenant.custom_domain_verification_value,
        error=tenant.custom_domain_error,
        requested_at=tenant.custom_domain_requested_at,
        railway_configured=railway_client.is_configured(),
    )


@router.post("/domain", response_model=DomainOut)
def request_domain(
    req: DomainRequest,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_whitelabel")),
    _pwd: dict = Depends(require_password_changed),
):
    tenant = _tenant_for(db, user)

    taken = db.query(models.Tenant).filter(
        models.Tenant.custom_domain == req.domain, models.Tenant.id != tenant.id
    ).first()
    if taken:
        raise HTTPException(409, "Este domínio já está em uso por outro tenant")

    # Replacing an existing domain: best-effort remove the old Railway
    # registration first so it doesn't linger orphaned.
    if tenant.custom_domain_railway_id and railway_client.is_configured():
        try:
            railway_client.delete_custom_domain(tenant.custom_domain_railway_id)
        except Exception:
            pass

    tenant.custom_domain = req.domain
    tenant.custom_domain_requested_at = utcnow_naive()
    tenant.custom_domain_railway_id = None
    tenant.custom_domain_cname_target = None
    tenant.custom_domain_verification_host = None
    tenant.custom_domain_verification_value = None
    tenant.custom_domain_error = None

    if railway_client.is_configured():
        try:
            result = railway_client.create_custom_domain(req.domain)
            tenant.custom_domain_railway_id = result["id"]
            records = result.get("status", {}).get("dnsRecords") or []
            cname = next((r for r in records if r.get("hostlabel")), None)
            tenant.custom_domain_cname_target = cname["requiredValue"] if cname else None
            tenant.custom_domain_verification_host = f"_railway-verify.{req.domain}"
            tenant.custom_domain_verification_value = result.get("status", {}).get("verificationToken")
            tenant.custom_domain_status = "pending_dns"
        except railway_client.RailwayApiError as exc:
            tenant.custom_domain_status = "error"
            tenant.custom_domain_error = str(exc)
    else:
        tenant.custom_domain_status = "pending_manual_setup"

    db.commit()
    db.refresh(tenant)

    log_audit_event(
        db=db, action="white_label.domain_requested", tenant_id=tenant.id, user_id=None,
        user_email=user.get("sub"), target_resource="tenant_domain", target_id=tenant.id,
        ip_address=request.client.host if request.client else None,
        details={"domain": req.domain, "status": tenant.custom_domain_status},
    )
    return _out(tenant)


@router.get("/domain", response_model=DomainOut)
def get_domain(
    db=Depends(get_db),
    user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_whitelabel")),
    _pwd: dict = Depends(require_password_changed),
):
    tenant = _tenant_for(db, user)

    if tenant.custom_domain and railway_client.is_configured():
        try:
            # Lazily provision a domain that was requested before Railway
            # was configured (or whose create attempt previously failed).
            if not tenant.custom_domain_railway_id:
                result = railway_client.create_custom_domain(tenant.custom_domain)
                tenant.custom_domain_railway_id = result["id"]
                records = result.get("status", {}).get("dnsRecords") or []
                cname = next((r for r in records if r.get("hostlabel")), None)
                tenant.custom_domain_cname_target = cname["requiredValue"] if cname else None
                tenant.custom_domain_verification_host = f"_railway-verify.{tenant.custom_domain}"
                tenant.custom_domain_verification_value = result.get("status", {}).get("verificationToken")
                tenant.custom_domain_status = "pending_dns"
                tenant.custom_domain_error = None
            else:
                live = railway_client.get_custom_domain_status(tenant.custom_domain_railway_id)
                status_str, error = _map_railway_status(live.get("status", {}))
                tenant.custom_domain_status = status_str
                tenant.custom_domain_error = error
            db.commit()
            db.refresh(tenant)
        except railway_client.RailwayApiError as exc:
            tenant.custom_domain_status = "error"
            tenant.custom_domain_error = str(exc)
            db.commit()
            db.refresh(tenant)

    return _out(tenant)


@router.delete("/domain", status_code=204)
def delete_domain(
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(require_admin),
    _plan: dict = Depends(check_module_access("admin_whitelabel")),
    _pwd: dict = Depends(require_password_changed),
):
    tenant = _tenant_for(db, user)
    if not tenant.custom_domain:
        return

    removed_domain = tenant.custom_domain
    if tenant.custom_domain_railway_id and railway_client.is_configured():
        try:
            railway_client.delete_custom_domain(tenant.custom_domain_railway_id)
        except Exception:
            pass

    tenant.custom_domain = None
    tenant.custom_domain_status = None
    tenant.custom_domain_railway_id = None
    tenant.custom_domain_cname_target = None
    tenant.custom_domain_verification_host = None
    tenant.custom_domain_verification_value = None
    tenant.custom_domain_requested_at = None
    tenant.custom_domain_error = None
    db.commit()

    log_audit_event(
        db=db, action="white_label.domain_removed", tenant_id=tenant.id, user_id=None,
        user_email=user.get("sub"), target_resource="tenant_domain", target_id=tenant.id,
        ip_address=request.client.host if request.client else None,
        details={"domain": removed_domain},
    )


@router.get("/branding", response_model=BrandingOut)
def get_branding(request: Request, host: str | None = None, db=Depends(get_db)):
    """PUBLIC — no auth. The login page calls this with its own hostname
    before any JWT exists, to show the right tenant's logo/colors."""
    lookup_host = (host or request.headers.get("host") or "").split(":")[0].lower()
    tenant = db.query(models.Tenant).filter(
        models.Tenant.custom_domain == lookup_host,
        models.Tenant.custom_domain_status == "active",
    ).first()
    if not tenant:
        raise HTTPException(404, "Sem branding configurado para este domínio")
    return BrandingOut(company_name=tenant.name, logo_url=tenant.logo_url, primary_color=tenant.primary_color)
