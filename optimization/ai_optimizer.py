def optimize_energy(price, battery_soc):

    if price < 50 and battery_soc < 0.9:
        return "charge"

    if price > 90 and battery_soc > 0.2:
        return "discharge"

    return "hold"