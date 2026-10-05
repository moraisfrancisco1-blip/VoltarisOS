"""run_milp_optimization skips a tenant with nothing to dispatch instead of logging a traceback."""
from __future__ import annotations

import logging

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import backend.database as dbmod
from backend import models
from backend.database import Base


@pytest.fixture()
def Session(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    monkeypatch.setattr(dbmod, "SessionLocal", factory)
    yield factory
    Base.metadata.drop_all(bind=engine)


def test_tenant_without_battery_is_skipped_quietly(Session, caplog):
    db = Session()
    db.add(models.Tenant(id=3, name="T", slug="t", plan="enterprise"))
    db.add(models.Site(tenant_id=3, name="home", solar_kw=4.8, battery_kwh=0, ev_chargers=0, owner="x", status="active"))
    db.commit()
    db.close()

    from backend.tasks import run_milp_optimization
    with caplog.at_level(logging.ERROR):
        out = run_milp_optimization()

    result = next(r for r in out["results"] if r["tenant_id"] == 3)
    assert result == {"tenant_id": 3, "status": "skipped", "reason": "no_dispatchable_assets"}
    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]
