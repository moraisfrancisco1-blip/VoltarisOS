from forecasting.device_backtest import backtest_tenant_load


class _Col:
    """Minimal SQLAlchemy-column lookalike for the fake model."""

    def isnot(self, *args, **kwargs):
        return self

    def asc(self, *args, **kwargs):
        return self


class DeviceReading:
    tenant_id = object()
    power_kw = _Col()
    timestamp = _Col()


class Query:
    def filter(self, *args, **kwargs):
        return self
    def order_by(self, *args, **kwargs):
        return self
    def limit(self, *args, **kwargs):
        return self
    def all(self):
        return [(100.0,)] * 10


def test_backtest_endpoint_supports_insufficient_data_contract():
    class Models:
        DeviceReading = DeviceReading

    class DB:
        def query(self, *args):
            return Query()

    result = backtest_tenant_load(DB(), Models, 1)
    assert result["status"] == "insufficient_data"
    assert result["tenant_id"] == 1
    assert result["readings_count"] == 10
