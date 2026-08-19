from datetime import datetime

import pytest

from backend import models
from backend.routers.vpp import VPPOptimizeBody, _optimize_persisted_vpp


class FakeResult:
    status = "optimal"
    solver_time_ms = 12.5
    total_cost_eur = 10.0
    total_import_kwh = 20.0
    total_export_kwh = 3.0
    vpp_dispatch = [15.0, 10.0]
    asset_dispatch = {"battery-1": [15.0, 10.0]}
    site_dispatch = {"site-1": [15.0, 10.0]}
    schedule = [{"battery-1": 15.0}, {"battery-1": 10.0}]


class FakeQuery:
    def __init__(self, obj):
        self.obj = obj
    def filter(self, *args, **kwargs):
        return self
    def first(self):
        return self.obj
    def all(self):
        return []


class FakeDB:
    def __init__(self, vpp):
        self.vpp = vpp
        self.added = []
        self.commits = 0
    def query(self, model):
        if model is models.VPPGroup:
            return FakeQuery(self.vpp)
        return FakeQuery(None)
    def add(self, obj):
        self.added.append(obj)
        if isinstance(obj, models.VPPOptimizationRun):
            obj.id = 42
    def commit(self):
        self.commits += 1
    def refresh(self, obj):
        return None
    def rollback(self):
        return None


@pytest.mark.asyncio
async def test_optimize_persists_run_and_dispatch(monkeypatch):
    vpp = models.VPPGroup(id=7, tenant_id=3, name="Test", active=True)
    db = FakeDB(vpp)

    monkeypatch.setattr(
        "backend.routers.vpp.build_portfolio_from_vpp",
        lambda **kwargs: (object(), {"battery-1": "site-1"}),
    )
    monkeypatch.setattr("backend.routers.vpp.MultiAssetOptimizer", lambda: type("O", (), {"optimize": lambda self, p: FakeResult()})())

    result = await _optimize_persisted_vpp(7, VPPOptimizeBody(horizon_hours=2, prices_eur_mwh=[10, 20]), db)

    _, _, _, optimization, run = result
    assert optimization.status == "optimal"
    assert run.id == 42
    assert run.status == "optimal"
    records = [x for x in db.added if isinstance(x, models.VPPDispatchRecord)]
    assert len(records) == 1
    assert records[0].optimization_run_id == 42
    assert records[0].committed is True
    assert records[0].dispatch_kw == 15.0


@pytest.mark.asyncio
async def test_infeasible_result_persists_run_without_dispatch(monkeypatch):
    vpp = models.VPPGroup(id=7, tenant_id=3, name="Test", active=True)
    db = FakeDB(vpp)
    result_obj = type("R", (), {"status": "infeasible", "solver_time_ms": 4.0, "total_cost_eur": 0.0, "total_import_kwh": 0.0, "total_export_kwh": 0.0})()

    monkeypatch.setattr("backend.routers.vpp.build_portfolio_from_vpp", lambda **kwargs: (object(), {}))
    monkeypatch.setattr("backend.routers.vpp.MultiAssetOptimizer", lambda: type("O", (), {"optimize": lambda self, p: result_obj})())

    _, _, _, optimization, run = await _optimize_persisted_vpp(7, VPPOptimizeBody(horizon_hours=2, prices_eur_mwh=[10, 20]), db)

    assert optimization.status == "infeasible"
    assert run.status == "infeasible"
    assert not any(isinstance(x, models.VPPDispatchRecord) for x in db.added)
