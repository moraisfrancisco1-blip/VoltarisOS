"""SolarEdge (OAuth "Connected Apps") -> device readings.

The OAuth connection only stores tokens (backend/routers/oauth_connections.py);
this module is what turns it into data: it reads the site overview with the
tenant's (auto-refreshed) bearer token and stores one DeviceReading on a
dedicated device, so the dashboard, offline detection and reports see it like
any other inverter.

Deliberately separate from the manual `protocol="solaredge"` device (API-key v1
connector polled by the edge gateway): this one has its own device
(`protocol="solaredge_oauth"`, external_id "solaredge-site-<site_id>") so the
two never write to the same row.
"""
import logging

import httpx

from backend import models
from backend.config import settings
from backend.models import utcnow_naive
from backend.routers.oauth_connections import get_valid_access_token, solaredge_site_id

logger = logging.getLogger(__name__)

PROTOCOL = "solaredge_oauth"


def _num(value, key):
    """SolarEdge returns either a bare number or {key: number}; accept both."""
    if isinstance(value, dict):
        value = value.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def parse_overview(body: dict) -> dict:
    """Extract power (kW) and last-day energy (kWh) from an overview response.

    SolarEdge reports W and Wh. The v1 API wraps everything in {"overview": ...};
    accept the unwrapped shape too. Missing values come back as None.
    """
    data = body.get("overview") if isinstance(body.get("overview"), dict) else body
    power_w = _num(data.get("currentPower"), "power")
    energy_wh = _num(data.get("lastDayData"), "energy")
    power_kw = power_w / 1000.0 if power_w is not None else None
    energy_kwh = energy_wh / 1000.0 if energy_wh is not None else None

    # SolarEdge v2 overview: {"production": {"total": 2433, "unit": "WH", ...},
    # "consumption": {...}} -- energy only, no instantaneous power.
    if energy_kwh is None:
        energy_kwh = _energy_kwh(data.get("production"))
    return {"power_kw": power_kw, "energy_kwh": energy_kwh}


_UNIT_TO_KWH = {"WH": 0.001, "KWH": 1.0, "MWH": 1000.0}


def _energy_kwh(block):
    """{"total": n, "unit": "WH"|"KWH"|"MWH"} -> kWh; None when absent or the
    unit is unknown (never guess a unit)."""
    if not isinstance(block, dict):
        return None
    total = _num(block.get("total"), "total")
    factor = _UNIT_TO_KWH.get(str(block.get("unit", "")).upper())
    if total is None or factor is None:
        return None
    return total * factor


def _get_or_create_device(db, tenant_id: int, site_id: str) -> models.Device:
    external_id = f"solaredge-site-{site_id}"
    dev = db.query(models.Device).filter(
        models.Device.tenant_id == tenant_id,
        models.Device.external_id == external_id,
    ).first()
    if dev:
        return dev
    dev = models.Device(
        tenant_id=tenant_id,
        name=f"SolarEdge site {site_id}",
        protocol=PROTOCOL,
        device_type="inverter",
        external_id=external_id,
        config={"site_id": site_id, "source": "oauth"},
        enabled=True,
    )
    db.add(dev)
    db.flush()
    return dev


def _link_to_only_site(db, dev: models.Device) -> None:
    """Dashboards group devices by site. If the device has none yet and its tenant
    has exactly one site, attach it there. With several sites it is ambiguous, so
    leave it for the user; never move a device that already has a site."""
    if dev.site_id is not None:
        return
    sites = db.query(models.Site.id).filter(models.Site.tenant_id == dev.tenant_id).limit(2).all()
    if len(sites) == 1:
        dev.site_id = sites[0][0]


def sync_tenant(db, tenant_id: int) -> dict:
    """Pull the overview once and store a reading. Raises HTTPException (409/502,
    from the OAuth helpers) when the connection is missing/expired or SolarEdge is
    unreachable -- callers decide whether that is fatal."""
    token = get_valid_access_token(db, tenant_id, "solaredge")
    site_id = solaredge_site_id(db, tenant_id)
    if not site_id:
        return {"tenant_id": tenant_id, "stored": False, "reason": "site_id desconhecido — voltar a ligar"}

    resp = httpx.get(
        f"{settings.SOLAREDGE_API_BASE.rstrip('/')}/v2/sites/{site_id}/overview",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
        timeout=20.0,
    )
    resp.raise_for_status()
    body = resp.json()
    values = parse_overview(body if isinstance(body, dict) else {})

    if values["power_kw"] is None and values["energy_kwh"] is None:
        # Unknown response shape: do not invent data. Keep the keys in the log so
        # the mapping can be fixed against what SolarEdge really returns.
        logger.warning("SolarEdge overview for tenant %s has no recognised fields: %s",
                       tenant_id, sorted(body) if isinstance(body, dict) else type(body).__name__)
        return {"tenant_id": tenant_id, "site_id": site_id, "stored": False,
                "reason": "resposta sem currentPower/lastDayData",
                "keys": sorted(body) if isinstance(body, dict) else None}

    dev = _get_or_create_device(db, tenant_id, site_id)
    _link_to_only_site(db, dev)
    now = utcnow_naive()
    db.add(models.DeviceReading(
        device_id=dev.id, tenant_id=tenant_id, timestamp=now,
        power_kw=values["power_kw"], energy_kwh=values["energy_kwh"], raw=body,
    ))
    dev.last_seen = now
    dev.status = "online"
    db.commit()
    return {"tenant_id": tenant_id, "site_id": site_id, "device_id": dev.id, "stored": True, **values}


def sync_all(db) -> dict:
    """Run sync_tenant for every tenant with a SolarEdge connection; one tenant's
    failure never stops the others."""
    tenant_ids = [r[0] for r in db.query(models.OAuthConnection.tenant_id).filter(
        models.OAuthConnection.provider == "solaredge").all()]
    results = {"synced": 0, "failed": 0, "skipped": 0}
    for tenant_id in tenant_ids:
        try:
            out = sync_tenant(db, tenant_id)
            results["synced" if out.get("stored") else "skipped"] += 1
        except Exception:
            db.rollback()
            results["failed"] += 1
            logger.exception("SolarEdge sync failed for tenant %s", tenant_id)
    return results
