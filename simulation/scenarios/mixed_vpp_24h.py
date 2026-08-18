"""24-hour mixed VPP laboratory scenario.

Runs the optimizer against solar, battery, EV, industrial load and heat pump.
This is simulation-only and never sends physical commands.
"""
from optimization.assets import BatteryAsset, EVAsset, HeatPumpAsset, IndustrialLoadAsset, SolarAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def build_mixed_vpp() -> VPPPortfolio:
    prices = [45, 42, 40, 38, 40, 48, 65, 90, 120, 110, 95, 80,
              70, 68, 72, 85, 105, 145, 170, 155, 120, 90, 65, 50]
    solar = [0, 0, 0, 0, 0, 10, 40, 120, 220, 300, 360, 400,
             420, 390, 330, 250, 150, 60, 10, 0, 0, 0, 0, 0]
    base_load = [300] * 24

    portfolio = VPPPortfolio(base_load_kw=base_load, prices_eur_mwh=prices,
                             max_import_kw=1000, max_export_kw=1000,
                             peak_demand_cost_eur_per_kw=1.0)
    portfolio.add(SolarAsset("solar-1", "PV Site 1", site_id=101, forecast_kw=solar))
    portfolio.add(BatteryAsset("battery-1", "Battery Site 1", site_id=101,
                               capacity_kwh=800, max_charge_kw=300, max_discharge_kw=300,
                               initial_soc=0.55))
    portfolio.add(EVAsset("ev-1", "Fleet EV", site_id=101,
                          capacity_kwh=80, max_charge_kw=22, initial_soc=0.35,
                          target_soc=0.80, arrival_hour=7, departure_hour=19))
    portfolio.add(IndustrialLoadAsset(
        "factory-1", "Factory", site_id=102,
        baseline_kw=450, min_power_kw=300, max_power_kw=450,
        energy_required_kwh=7200, recovery_kwh=2400, max_recovery_kw=150,
        start_hour=6, end_hour=22, curtailment_cost_eur_kwh=0.08,
    ))
    portfolio.add(HeatPumpAsset("hp-1", "Heat Pump", site_id=103,
                                baseline_power_kw=8.0, nominal_power_kw=80,
                                min_power_kw=0, initial_thermal_kwh=50,
                                min_thermal_kwh=20, max_thermal_kwh=120,
                                thermal_gain_per_kwh=1.0, thermal_loss_kwh=8,
                                target_thermal_kwh=50, start_hour=0, end_hour=24))
    return portfolio


def run() -> dict:
    result = MultiAssetOptimizer().optimize(build_mixed_vpp())
    return {
        "status": result.status,
        "total_cost_eur": result.total_cost_eur,
        "total_import_kwh": result.total_import_kwh,
        "total_export_kwh": result.total_export_kwh,
        "vpp_dispatch": result.vpp_dispatch,
        "site_dispatch": result.site_dispatch,
        "asset_dispatch": result.asset_dispatch,
    }


if __name__ == "__main__":
    print(run())