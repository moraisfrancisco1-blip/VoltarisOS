from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend import models
from optimization.persistence import persist_optimization_result


def test_persist_optimization_run_and_first_dispatch():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    result = SimpleNamespace(
        status="optimal",
        solver_time_ms=12.5,
        total_cost_eur=42.0,
        total_import_kwh=100.0,
        total_export_kwh=5.0,
        vpp_dispatch=[12.0, 10.0],
        asset_dispatch={"battery-1": [12.0, 10.0]},
        site_dispatch={"site-1": [12.0, 10.0]},
        schedule=[{"timestamp": "2026-08-19T07:00:00+00:00", "import_kw": 20.0}],
    )

    run = persist_optimization_result(
        db,
        tenant_id=1,
        vpp_id=7,
        horizon_hours=24,
        price_source="ENTSO-E day-ahead",
        result=result,
    )

    assert run.id is not None
    assert run.status == "optimal"
    assert run.price_source == "ENTSO-E day-ahead"

    dispatch = db.query(models.VPPDispatchRecord).one()
    assert dispatch.optimization_run_id == run.id
    assert dispatch.dispatch_kw == 12.0
    assert dispatch.asset_dispatch == {"battery-1": 12.0}
    assert dispatch.committed is True


def test_non_optimal_run_is_persisted_without_dispatch():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(engine)
    db = sessionmaker(bind=engine)()

    result = SimpleNamespace(
        status="infeasible",
        solver_time_ms=3.0,
        total_cost_eur=0.0,
        total_import_kwh=0.0,
        total_export_kwh=0.0,
        vpp_dispatch=[],
        asset_dispatch={},
        site_dispatch={},
        schedule=[],
    )

    run = persist_optimization_result(
        db, tenant_id=1, vpp_id=7, horizon_hours=24,
        price_source="request", result=result,
    )

    assert run.status == "infeasible"
    assert db.query(models.VPPDispatchRecord).count() == 0
