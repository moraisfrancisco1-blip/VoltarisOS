"""energy_counter.py — turn a "day's total so far" counter into per-reading energy.

Backend aggregations (carbon, savings, dashboard) SUM `DeviceReading.energy_kwh`,
so that column must hold the energy of THAT reading's interval. Some sources (the
SolarEdge v2 overview) only expose a counter that grows through the day and resets
at midnight; storing it as-is made every sum count the same kWh again and again.
"""

# A real midnight reset drops the counter to ~0. A smaller dip (stale or rounded
# response mid-day) is not a reset and must not re-add the whole day.
RESET_FRACTION = 0.5


def interval_kwh(prev_total, day_total):
    """Energy (kWh) gained between two readings of a growing daily counter.

    - no counter value now -> None (nothing to store)
    - no previous reading   -> the counter itself: it is "energy so far TODAY", so
      what was produced before we started watching still belongs to today (only its
      split across the hours of the day is unknown)
    - counter went up/stayed -> the difference
    - counter dropped a lot  -> it reset: everything since the reset is new
    - counter dipped slightly -> 0.0 (noise, not production)
    """
    if day_total is None:
        return None
    if prev_total is None:
        return day_total
    delta = day_total - prev_total
    if delta >= 0:
        return delta
    return day_total if day_total <= prev_total * RESET_FRACTION else 0.0
