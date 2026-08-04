import numpy as np

class EnergyTrader:

    def __init__(self):
        self.min_soc = 0.2
        self.max_soc = 0.9

    def decide(self, prices, soc):

        low = np.percentile(prices, 20)
        high = np.percentile(prices, 80)

        current_price = prices[-1]

        if current_price <= low and soc < self.max_soc:
            return {
                "action": "buy_and_charge",
                "reason": "cheap energy"
            }

        if current_price >= high and soc > self.min_soc:
            return {
                "action": "sell_and_discharge",
                "reason": "expensive energy"
            }

        return {
            "action": "hold",
            "reason": "neutral price"
        }