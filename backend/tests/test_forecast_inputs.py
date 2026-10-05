"""run_forecasting inputs: naive-vs-aware datetimes in the load forecast (the crash seen in
production once a tenant had enough readings) and the solar forecast built from the tenant's sites."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend import forecast_inputs, models
from backend.database import Base
from forecasting.load_forecast import forecast_load_from_readings


def _readings(naive: bool):
    """Three days of readings: 5 kW at 10:00 UTC and 7 kW at 11:00 UTC."""
    out = []
    base = datetime(2026, 10, 1, 0, 0)
    for day in range(3):
        for hour, kw in ((10, 5.0), (11, 7.0)):
            ts = base + timedelta(days=day, hours=hour)
            out.append(SimpleNamespace(timestamp=ts if naive else ts.replace(tzinfo=timezone.utc), power_kw=kw))
    return out


START_AWARE = datetime(2026, 10, 5, 0, 0, tzinfo=timezone.utc)


def test_naive_database_timestamps_with_an_aware_start_no_longer_crash():
    # The database stores naive UTC; run_forecasting passes an aware start. This raised
    # "can't compare offset-naive and offset-aware datetimes".
    out = forecast_load_from_readings(_readings(naive=True), START_AWARE, hours=24)
    assert out[10] == 5.0 and out[11] == 7.0
    assert out[3] == 6.0  # hours with no history fall back to the overall median


def test_aware_readings_with_a_naive_start_also_work():
    out = forecast_load_from_readings(_readings(naive=False), START_AWARE.replace(tzinfo=None), hours=24)
    assert out[10] == 5.0 and out[11] == 7.0


def test_naive_and_aware_inputs_give_the_same_forecast():
    a = forecast_load_from_readings(_readings(naive=True), START_AWARE, hours=24)
    b = forecast_load_from_readings(_readings(naive=False), START_AWARE.replace(tzinfo=None), hours=24)
    assert a == b


def test_an_aware_non_utc_start_is_converted_not_shifted():
    plus_two = timezone(timedelta(hours=2))
    start = datetime(2026, 10, 5, 2, 0, tzinfo=plus_two)  # = 00:00 UTC
    assert forecast_load_from_readings(_readings(naive=True), start, hours=24) == \
        forecast_load_from_readings(_readings(naive=True), START_AWARE, hours=24)


# ── solar forecast from sites ───────────────────────────────────────────────

@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _site(db, tenant, name, kw, lat=52.0, lng=4.3, tilt=None, az=None):
    db.add(models.Site(tenant_id=tenant, name=name, solar_kw=kw, battery_kwh=0, ev_chargers=0, owner="x",
                       status="active", lat=lat, lng=lng, tilt_deg=tilt, azimuth_deg=az))
    db.commit()


class FakeSolar:
    def __init__(self, hours_returned=None):
        self.calls = []
        self.hours_returned = hours_returned

    def __call__(self, lat, lon, kw, hours=24, tilt_deg=None, azimuth_deg=None, include_metadata=False):
        self.calls.append({"lat": lat, "lon": lon, "kw": kw, "tilt": tilt_deg, "az": azimuth_deg})
        n = self.hours_returned if self.hours_returned is not None else hours
        gen = f"2026-10-05T10:0{len(self.calls)}:00+00:00"
        return {"forecast": [{"estimated_kwh": kw / 10.0} for _ in range(n)], "generated_at": gen,
                "max_age_minutes": 60 - len(self.calls)}


def test_solar_forecast_sums_the_tenants_qualifying_sites_with_their_own_orientation(db):
    _site(db, 1, "roof", 4.8, tilt=10.0, az=90.0)
    _site(db, 1, "garage", 2.0)                       # no orientation: still counts
    _site(db, 1, "no-location", 3.0, lat=None)        # excluded: nowhere to forecast
    _site(db, 1, "no-capacity", 0.0)                  # excluded
    _site(db, 2, "other-tenant", 9.0)                 # excluded: another tenant
    fake = FakeSolar()

    values, meta = forecast_inputs.solar_forecast_from_sites(db, 1, hours=24, solar_provider=fake)

    assert [c["kw"] for c in fake.calls] == [4.8, 2.0]
    assert fake.calls[0]["tilt"] == 10.0 and fake.calls[0]["az"] == 90.0   # each site's own orientation
    assert fake.calls[1]["tilt"] is None
    assert len(values) == 24 and all(v == pytest.approx(0.68) for v in values)  # 0.48 + 0.20
    assert meta.name == "Open-Meteo"
    assert meta.generated_at == "2026-10-05T10:01:00+00:00"  # the oldest retrieval limits freshness


def test_solar_forecast_without_a_usable_site_says_what_is_missing(db):
    _site(db, 1, "no-location", 3.0, lat=None)
    with pytest.raises(RuntimeError, match="needs a site with a location and a solar capacity"):
        forecast_inputs.solar_forecast_from_sites(db, 1, solar_provider=FakeSolar())


def test_solar_forecast_rejects_a_series_that_is_too_short(db):
    _site(db, 1, "roof", 4.8)
    with pytest.raises(RuntimeError, match="returned 12 of 24 hours"):
        forecast_inputs.solar_forecast_from_sites(db, 1, solar_provider=FakeSolar(hours_returned=12))
