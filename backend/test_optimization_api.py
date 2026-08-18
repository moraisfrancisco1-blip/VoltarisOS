"""API integration tests for the multi-asset optimization contract."""
from fastapi.testclient import TestClient

from backend.main import app
from backend.security import get_current_user


app.dependency_overrides[get_current_user] = lambda: {"id": 1, "tenant_id": 1}
client = TestClient(app)


def test_multi_asset_api_accepts_full_domain_and_returns_economic_breakdown():
    response = client.post(
        "/optimize/multi-asset",
        json={
            "base_load_kw": [450.0] * 24,
            "prices_eur_mwh": [30.0] * 8 + [150.0] * 8 + [60.0] * 8,
            "max_import_kw": 1000.0,
            "max_export_kw": 1000.0,
            "peak_demand_cost_eur_per_kw": 1.0,
            "solar": [{
                "asset_id": "solar-1",
                "name": "PV",
                "forecast_kw": [0.0] * 24,
            }],
            "batteries": [{
                "asset_id": "battery-1",
                "name": "BESS",
                "capacity_kwh": 500.0,
                "max_charge_kw": 250.0,
                "max_discharge_kw": 250.0,
                "initial_soc": 0.5,
            }],
            "industrial_loads": [{
                "asset_id": "factory-1",
                "name": "Factory",
                "min_power_kw": 300.0,
                "max_power_kw": 450.0,
                "energy_required_kwh": 7200.0,
                "start_hour": 6,
                "end_hour": 22,
                "baseline_kw": 450.0,
                "recovery_kwh": 2400.0,
                "max_recovery_kw": 150.0,
            }],
            "heat_pumps": [{
                "asset_id": "hp-1",
                "name": "Heat pump",
                "min_power_kw": 0.0,
                "max_power_kw": 20.0,
                "energy_required_kwh": 0.0,
                "start_hour": 0,
                "end_hour": 24,
                "baseline_power_kw": 8.0,
                "nominal_power_kw": 20.0,
                "initial_thermal_kwh": 50.0,
                "min_thermal_kwh": 0.0,
                "max_thermal_kwh": 100.0,
            }],
        },
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "optimal"
    assert body["economic_breakdown"]["peak_demand_cost_eur_per_kw"] == 1.0
    assert "energy_market_cost_eur" in body["economic_breakdown"]
    assert "peak_demand_cost_eur" in body["economic_breakdown"]
    assert "non_energy_flex_cost_eur" in body["economic_breakdown"]
    assert set(body["dispatch"]["assets"]) >= {"battery-1", "factory-1", "hp-1"}
    assert len(body["schedule"]) == 24


def test_multi_asset_api_rejects_short_price_series():
    response = client.post(
        "/optimize/multi-asset",
        json={
            "base_load_kw": [100.0] * 24,
            "prices_eur_mwh": [50.0] * 12,
        },
    )

    # The optimizer validates the horizon/series contract instead of silently padding it.
    assert response.status_code in (400, 422)


app.dependency_overrides.clear()
