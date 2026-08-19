from forecasting.probabilistic_load import forecast_load_quantiles


def test_probabilistic_load_returns_ordered_nonnegative_quantiles():
    history = [100.0 + ((hour % 24) * 2.0) for hour in range(24 * 14)]
    result = forecast_load_quantiles(history, horizon=24)

    assert set(result) == {"p10", "p50", "p90"}
    assert all(len(result[key]) == 24 for key in result)
    for p10, p50, p90 in zip(result["p10"], result["p50"], result["p90"]):
        assert p10 >= 0
        assert p10 <= p50 <= p90


def test_probabilistic_load_is_deterministic_for_same_history():
    history = [80.0 + (i % 24) for i in range(24 * 14)]
    first = forecast_load_quantiles(history, horizon=24)
    second = forecast_load_quantiles(history, horizon=24)
    assert first == second


def test_probabilistic_load_rejects_insufficient_history():
    try:
        forecast_load_quantiles([1.0] * 23)
    except ValueError as exc:
        assert "24" in str(exc)
    else:
        raise AssertionError("expected insufficient-history validation")
