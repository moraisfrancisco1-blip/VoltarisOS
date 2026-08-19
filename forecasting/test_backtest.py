from forecasting.backtest import backtest_load_quantiles


def test_backtest_metrics_are_computed_on_future_only_observations():
    history = [100.0 + (i % 24) for i in range(24 * 35)]
    result = backtest_load_quantiles(history, horizon=24, min_history=24 * 14, step=24)

    assert result["observations"] > 0
    assert 0.0 <= result["coverage_p10_p90"] <= 1.0
    assert result["mae_p50"] >= 0.0


def test_backtest_rejects_too_short_history():
    history = [100.0] * (24 * 14 + 23)
    try:
        backtest_load_quantiles(history)
    except ValueError as exc:
        assert "insufficient" in str(exc)
    else:
        raise AssertionError("expected insufficient-history validation")
