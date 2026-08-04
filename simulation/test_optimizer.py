from optimization.battery_optimizer import BatteryOptimizer

optimizer = BatteryOptimizer()

prices = [40, 50, 60, 70, 120]

decision = optimizer.optimize(prices, soc=0.5)

print(decision)