from optimization.milp_optimizer import BatteryMILPOptimizer

optimizer = BatteryMILPOptimizer()

prices = [30, 40, 50, 120, 110, 60]

result = optimizer.optimize(prices)

print(result)