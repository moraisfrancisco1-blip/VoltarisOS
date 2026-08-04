import numpy as np


class BatteryOptimizer:

    def __init__(self, capacity_kwh=500):
        self.capacity = capacity_kwh

    def optimize(self, prices, soc):

        min_price = np.percentile(prices, 20)
        max_price = np.percentile(prices, 80)

        current_price = prices[-1]

        if current_price <= min_price and soc < 0.9:
            return "charge"

        if current_price >= max_price and soc > 0.2:
            return "discharge"

        return "hold"