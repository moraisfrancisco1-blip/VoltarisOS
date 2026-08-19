"""Canonical forecast container shared by forecasting and optimization."""
from __future__ import annotations

from forecasting.contracts import ForecastBundle, build_forecast_bundle

__all__ = ["ForecastBundle", "build_forecast_bundle"]
