from forecasting.backtest import backtest_load_quantiles


def test_synthetic_backtest_produces_finite_metrics():
    # Controlled daily profile with a small deterministic disturbance.
    history = []
    for day in range(45):
        for hour in range(24):
            history.append(100.0 + 10.0 * (hour / 23.0) + (day % 5) * 0.5)

    result = backtest_load_quantiles(history, horizon=24, min_history=24 * 14, step=24)

    assert result["observations"] == 24 * (45 - 14)
    assert 0.0 <= result["coverage_p10_p90"] <= 1.0
    assert result["mae_p50"] >= 0.0
    assert result["coverage_p10_p90"] > 0.0


def test_synthetic_backtest_is_reproducible():
    history = [100.0 + (i % 24) * 2.0 + ((i // 24) % 3) for i in range(24 * 40)]
    assert backtest_load_quantiles(history) == backtest_load_quantiles(history)
