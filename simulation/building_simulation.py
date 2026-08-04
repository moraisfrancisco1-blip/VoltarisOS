import numpy as np
import pandas as pd
from optimization.milp import optimize_milp

class BuildingSimulation:

    def __init__(self):

        self.solar_capacity_kw = 100
        self.battery_capacity_kwh = 500
        self.ev_chargers = 10

    import numpy as np

def generate_solar(hours=24):
    solar = []

    for h in range(hours):
        if 6 <= h <= 18:
            peak = np.sin((h-6)/12 * np.pi)
            noise = np.random.normal(0, 0.05)
            value = max(0, peak + noise) * 80  # 80kW peak
        else:
            value = 0

        solar.append(round(value,2))

    return solar

def optimize_energy(solar, load, prices):
    battery = 50  # estado inicial (%)
    
    grid = []
    battery_flow = []

    for s, l, p in zip(solar, load, prices):

        net = s - l  # positivo = excesso solar

        # 🔋 regra 1: usar solar primeiro
        if net > 0:
            charge = min(net, 20)  # limite de carga
            battery += charge * 0.2
            grid.append(net - charge)
            battery_flow.append(charge)

        else:
            deficit = abs(net)

            # 🔥 regra 2: usar bateria se preço alto
            if p > 0.25 and battery > 10:
                discharge = min(deficit, 20)
                battery -= discharge * 0.2
                grid.append(deficit - discharge)
                battery_flow.append(-discharge)

            else:
                # comprar da rede
                grid.append(deficit)
                battery_flow.append(0)

        battery = max(0, min(100, battery))

    return grid, battery_flow, battery

    def generate_demand(self, hours=24):

        base = 50

        demand = []

        for h in range(hours):

            if 8 <= h <= 18:

                value = base + np.random.normal(20,5)

            else:

                value = base + np.random.normal(5,3)

            demand.append(max(value,0))

        return demand

    def generate_prices(hours=24):

     prices = []

    for h in range(hours):

        if 8 <= h <= 20:
        
            price = np.random.uniform(0.20, 0.35)
        
        else:
        
            price = np.random.uniform(0.05, 0.15)

        prices.append(round(price,3))

    return prices

def ev_charging(prices):
    ev = []

    for p in prices:
        if p < 0.15:
            ev.append(25)  # carregar quando barato
        else:
            ev.append(5)

    return ev

def calculate_profit(grid, prices):
    profit = []

    for g, p in zip(grid, prices):
        if g > 0:
            cost = g * p
        else:
            cost = g * p  # venda (negativo = lucro)

        profit.append(round(-cost, 2))

    return profit

    def run_simulation(self):

        solar = self.generate_solar()
        demand = self.generate_demand()
        prices = self.generate_prices()

        df = pd.DataFrame({
            "hour": range(24),
            "solar_kw": solar,
            "demand_kw": demand,
            "price": prices
        })

        return df

def run_simulation():

    hours = list(range(24))

    solar = np.random.uniform(0, 50, 24).tolist()
    load = np.random.uniform(30, 80, 24).tolist()
    load = generate_demand() # pyright: ignore[reportUndefinedVariable]
    prices = generate_prices() # pyright: ignore[reportUndefinedVariable]
    ev_load = ev_charging()
    ev_load = ev_charging(prices)
    load = [base + ev for base, ev in zip(load, ev_load)]
    profit = calculate_profit(grid, prices)

    grid, battery_flow, battery = optimize_energy(solar, load, prices)
    grid, soc, charge, discharge = optimize_milp(solar, load, prices)
    battery_soc = []

    soc = 50

    for s,l in zip(solar,load):

        balance = s - l

        soc = max(0,min(100,soc + balance*0.1))

        grid.append(-balance)
        battery_soc.append(soc)

    return {
    "profit": profit,
    "hours": hours,
    "solar": solar,
    "load": load,
    "soc": soc,
    "charge": charge,
    "discharge": discharge,
    "grid": grid,
    "prices": prices,
    "battery": battery,
    "battery_flow": battery_flow,
    "timeseries": [
        {
            "hour": i,
            "solar": solar[i],
            "load": load[i],
            "soc": soc[i]
        }
        for i in range(len(solar))
    ]
}