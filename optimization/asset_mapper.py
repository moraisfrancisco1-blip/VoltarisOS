"""Map VoltarisOS database/site records into optimizer-native energy assets."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from backend import models
from optimization.assets import BatteryAsset, EVAsset, FlexibleLoadAsset, SolarAsset, VPPPortfolio
from forecasting.solar_forecast import forecast_solar_production


DEVICE_TYPE_ALIASES = {
    "battery": "battery",
    "bess": "battery",
    "storage": "battery",
    "inverter": "solar",
    "pv": "solar",
    "solar": "solar",
    "ev": "ev",
    "ev_charger": "ev",
    "ev_charger_fleet": "ev",
    "flexible_load": "flexible_load",
    "load": "flexible_load",
    "industrial_load": "flexible_load",
}


def _site_records() -> Dict[int, dict]:
    path = "sites.json"
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        return {int(item["id"]): item for item in json.load(handle)}


def _latest_reading(db: Session, device_id: int):
    return (
        db.query(models.DeviceReading)
        .filter(models.DeviceReading.device_id == device_id)
        .order_by(models.DeviceReading.timestamp.desc())
        .first()
    )


def _cfg_number(config: dict, *keys: str, default: float = 0.0) -> float:
    for key in keys:
        value = config.get(key)
        if value is not None:
            try:
                return float(value)
            except (TypeError, ValueError):
                pass
    return default


def build_portfolio_from_vpp(
    db: Session,
    vpp: models.VPPGroup,
    prices_eur_mwh: List[float],
    base_load_kw: List[float] | None = None,
    horizon: int = 24,
) -> Tuple[VPPPortfolio, dict]:
    """Build an optimizer portfolio from a persisted VPP and its site devices.

    Missing optional asset configuration is handled conservatively. Solar uses the
    existing weather-based forecast when site coordinates/capacity are available;
    otherwise it is omitted rather than inventing generation.
    """
    memberships = (
        db.query(models.VPPSiteMembership)
        .filter(models.VPPSiteMembership.vpp_id == vpp.id)
        .all()
    )
    site_ids = [m.site_id for m in memberships]
    devices = (
        db.query(models.Device)
        .filter(models.Device.site_id.in_(site_ids), models.Device.enabled.is_(True))
        .all()
        if site_ids else []
    )
    sites = _site_records()
    devices_by_site: Dict[int, List[models.Device]] = {}
    for device in devices:
        devices_by_site.setdefault(device.site_id, []).append(device)

    portfolio = VPPPortfolio(
        prices_eur_mwh=list(prices_eur_mwh[:horizon]),
        base_load_kw=list((base_load_kw or [])[:horizon]),
        max_import_kw=float(vpp.target_kw or 10000.0),
        max_export_kw=float(vpp.target_kw or 10000.0),
    )
    warnings: List[str] = []

    for membership in memberships:
        site = sites.get(membership.site_id, {})
        site_devices = devices_by_site.get(membership.site_id, [])

        solar_capacity = float(site.get("solar_kw") or 0.0)
        for device in site_devices:
            kind = DEVICE_TYPE_ALIASES.get((device.device_type or "").lower())
            config = device.config or {}
            if kind == "solar":
                solar_capacity = max(solar_capacity, _cfg_number(config, "capacity_kw", "power_kw", default=solar_capacity))
        if solar_capacity > 0 and site.get("lat") is not None and site.get("lng") is not None:
            try:
                forecast = forecast_solar_production(
                    float(site["lat"]), float(site["lng"]), solar_capacity, hours=horizon
                )
                portfolio.add(SolarAsset(
                    asset_id=f"site-{membership.site_id}-solar",
                    name=f"{site.get('name', 'Site')} Solar",
                    site_id=membership.site_id,
                    forecast_kw=[float(x["estimated_kwh"]) for x in forecast[:horizon]],
                ))
            except Exception as exc:
                warnings.append(f"Solar forecast failed for site {membership.site_id}: {exc}")
        elif solar_capacity > 0:
            warnings.append(f"Site {membership.site_id} has solar capacity but no coordinates; solar asset omitted")

        for device in site_devices:
            kind = DEVICE_TYPE_ALIASES.get((device.device_type or "").lower())
            config = device.config or {}
            reading = _latest_reading(db, device.id)

            if kind == "battery":
                capacity = _cfg_number(config, "capacity_kwh", default=float(site.get("battery_kwh") or 500.0))
                soc_pct = reading.soc_pct if reading and reading.soc_pct is not None else _cfg_number(config, "initial_soc_pct", default=50.0)
                portfolio.add(BatteryAsset(
                    asset_id=f"device-{device.id}",
                    name=device.name,
                    site_id=device.site_id,
                    capacity_kwh=capacity,
                    max_charge_kw=_cfg_number(config, "max_charge_kw", "charge_kw", default=max(capacity / 2, 1.0)),
                    max_discharge_kw=_cfg_number(config, "max_discharge_kw", "discharge_kw", default=max(capacity / 2, 1.0)),
                    initial_soc=max(0.0, min(1.0, soc_pct / 100.0)),
                    min_soc=_cfg_number(config, "min_soc", default=0.10),
                    max_soc=_cfg_number(config, "max_soc", default=0.95),
                ))

            elif kind == "ev":
                portfolio.add(EVAsset(
                    asset_id=f"device-{device.id}",
                    name=device.name,
                    site_id=device.site_id,
                    capacity_kwh=_cfg_number(config, "capacity_kwh", default=60.0),
                    max_charge_kw=_cfg_number(config, "max_charge_kw", "power_kw", default=11.0),
                    initial_soc=_cfg_number(config, "initial_soc", default=(reading.soc_pct / 100.0 if reading and reading.soc_pct is not None else 0.30)),
                    target_soc=_cfg_number(config, "target_soc", default=0.80),
                    arrival_hour=int(_cfg_number(config, "arrival_hour", default=0)),
                    departure_hour=int(_cfg_number(config, "departure_hour", default=24)),
                ))

            elif kind == "flexible_load":
                portfolio.add(FlexibleLoadAsset(
                    asset_id=f"device-{device.id}",
                    name=device.name,
                    site_id=device.site_id,
                    min_power_kw=_cfg_number(config, "min_power_kw", default=0.0),
                    max_power_kw=_cfg_number(config, "max_power_kw", "power_kw", default=100.0),
                    energy_required_kwh=_cfg_number(config, "energy_required_kwh", default=0.0),
                    start_hour=int(_cfg_number(config, "start_hour", default=0)),
                    end_hour=int(_cfg_number(config, "end_hour", default=horizon)),
                    curtailment_cost_eur_kwh=_cfg_number(config, "curtailment_cost_eur_kwh", default=0.0),
                ))

    if not portfolio.base_load_kw:
        current_load = 0.0
        for device in devices:
            kind = DEVICE_TYPE_ALIASES.get((device.device_type or "").lower())
            if kind in {"solar", "battery", "ev", "flexible_load"}:
                continue
            reading = _latest_reading(db, device.id)
            if reading and reading.power_kw is not None:
                current_load += max(0.0, float(reading.power_kw))
        portfolio.base_load_kw = [current_load] * horizon
        if current_load:
            warnings.append("Base load uses latest telemetry as a flat baseline; replace with load forecasting for production dispatch")

    if len(portfolio.prices_eur_mwh) < horizon:
        portfolio.prices_eur_mwh.extend([0.0] * (horizon - len(portfolio.prices_eur_mwh)))

    return portfolio, {
        "vpp_id": vpp.id,
        "site_ids": site_ids,
        "device_count": len(devices),
        "asset_count": len(portfolio.assets),
        "warnings": warnings,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
