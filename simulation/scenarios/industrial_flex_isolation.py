"""Isolated industrial-load flexibility experiment for the VPP lab."""
from optimization.assets import IndustrialLoadAsset, SolarAsset, VPPPortfolio
from optimization.multi_asset_optimizer import MultiAssetOptimizer


def build_portfolio(industrial_flexible: bool) -> VPPPortfolio:
    prices = [45, 42, 40, 38, 40, 48, 65, 90, 120, 110, 95, 80,
              70, 68, 72, 85, 105, 145, 170, 155, 120, 90, 65, 50]
    solar = [0, 0, 0, 0, 0, 10, 40, 120, 220, 300, 360, 400,
             420, 390, 330, 250, 150, 60, 10, 0, 0, 0, 0, 0]
    portfolio = VPPPortfolio(base_load_kw=[300] * 24, prices_eur_mwh=prices,
                             max_import_kw=1000, max_export_kw=1000)
    portfolio.add(SolarAsset("solar-1", "PV Site 1", site_id=101, forecast_kw=solar))
    factory = IndustrialLoadAsset(
        "factory-1", "Factory", site_id=102,
        baseline_kw=450, min_power_kw=300, max_power_kw=450,
        energy_required_kwh=0, start_hour=6, end_hour=22,
        curtailment_cost_eur_kwh=0.08,
    )
    factory.enabled = industrial_flexible
    if industrial_flexible:
        portfolio.add(factory)
    else:
        for t in range(6, 22):
            portfolio.base_load_kw[t] += 450
    return portfolio


def run() -> dict:
    optimizer = MultiAssetOptimizer()
    rigid = optimizer.optimize(build_portfolio(False))
    flexible = optimizer.optimize(build_portfolio(True))
    return {
        "rigid_cost_eur": rigid.total_cost_eur,
        "flexible_cost_eur": flexible.total_cost_eur,
        "industrial_value_eur": rigid.total_cost_eur - flexible.total_cost_eur,
        "rigid_import_kwh": rigid.total_import_kwh,
        "flexible_import_kwh": flexible.total_import_kwh,
        "flexible_dispatch": flexible.asset_dispatch.get("factory-1", []),
    }


if __name__ == "__main__":
    print(run())
