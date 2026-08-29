"""Cross-tenant isolation tests for VPP and device resources."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from backend.routers.vpp import (
    VPPOptimizeBody,
    _get_owned_vpp,
    _optimize_persisted_vpp,
    list_groups,
    BidBody,
    submit_bid,
)
from backend.routers.devices import get_readings, test_connection as _device_test_connection


def _make_db():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()


class _FakeRequest:
    def __init__(self):
        self.client = None
        self.headers = {}


def test_list_groups_is_tenant_scoped():
    db = _make_db()
    db.add_all([
        models.VPPGroup(id=1, tenant_id=1, name="A", active=True),
        models.VPPGroup(id=2, tenant_id=2, name="B", active=True),
    ])
    db.commit()

    user_a = {"role": "TENANT_MEMBER", "tenant_id": 1}
    ids = [g.id for g in list_groups(db=db, user=user_a)]
    assert ids == [1]

    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}
    ids = [g.id for g in list_groups(db=db, user=user_b)]
    assert ids == [2]


def test_get_owned_vpp_blocks_cross_tenant():
    db = _make_db()
    db.add_all([
        models.VPPGroup(id=1, tenant_id=1, name="A", active=True),
        models.VPPGroup(id=2, tenant_id=2, name="B", active=True),
    ])
    db.commit()

    user_a = {"role": "TENANT_MEMBER", "tenant_id": 1}
    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}

    # Same-tenant works.
    assert _get_owned_vpp(db, 1, user_a).id == 1

    # Cross-tenant returns 404 (no existence leak).
    with pytest.raises(HTTPException) as exc:
        _get_owned_vpp(db, 1, user_b)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_optimize_blocks_cross_tenant():
    db = _make_db()
    db.add(models.VPPGroup(id=1, tenant_id=1, name="A", active=True))
    db.commit()

    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}
    body = VPPOptimizeBody(horizon_hours=1, prices_eur_mwh=[30])

    with pytest.raises(HTTPException) as exc:
        await _optimize_persisted_vpp(1, body, db, user_b)
    assert exc.value.status_code == 404


def test_submit_bid_blocks_cross_tenant():
    db = _make_db()
    db.add(models.VPPGroup(id=1, tenant_id=1, name="A", active=True, min_bid_kw=100))
    db.commit()

    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}
    body = BidBody(quantity_kw=200, direction="sell")

    with pytest.raises(HTTPException) as exc:
        submit_bid(1, body, _FakeRequest(), db=db, user=user_b)
    assert exc.value.status_code == 404


def test_device_readings_blocks_cross_tenant():
    db = _make_db()
    db.add(models.Device(id=1, tenant_id=1, name="D", site_id=None, protocol="simulated", enabled=True))
    db.commit()

    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}

    with pytest.raises(HTTPException) as exc:
        get_readings(1, limit=10, db=db, user=user_b)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_device_test_connection_blocks_cross_tenant():
    db = _make_db()
    db.add(models.Device(id=1, tenant_id=1, name="D", site_id=None, protocol="simulated", enabled=True))
    db.commit()

    user_b = {"role": "TENANT_MEMBER", "tenant_id": 2}

    with pytest.raises(HTTPException) as exc:
        await _device_test_connection(1, db=db, user=user_b)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_device_test_connection_same_tenant_passes_ownership():
    db = _make_db()
    db.add(models.Device(id=1, tenant_id=1, name="D", site_id=None, protocol="simulated", enabled=True))
    db.commit()

    user_a = {"role": "TENANT_MEMBER", "tenant_id": 1}
    # Not 404: ownership passes and _run_test executes (simulated → no network).
    result = await _device_test_connection(1, db=db, user=user_a)
    assert result.get("ok") is False  # unknown protocol branch, but ownership passed


@pytest.mark.asyncio
async def test_device_test_connection_super_admin_bypass():
    db = _make_db()
    db.add(models.Device(id=1, tenant_id=1, name="D", site_id=None, protocol="simulated", enabled=True))
    db.commit()

    admin = {"role": "SUPER_ADMIN", "tenant_id": None}
    # SUPER_ADMIN bypass: no 404, _run_test executes.
    result = await _device_test_connection(1, db=db, user=admin)
    assert result.get("ok") is False  # unknown protocol branch
