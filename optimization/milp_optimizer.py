from pyomo.environ import *

class BatteryMILPOptimizer:

    def optimize(self, prices):

        T = len(prices)

        model = ConcreteModel()

        model.T = RangeSet(0, T-1)

        model.charge = Var(model.T, domain=NonNegativeReals)
        model.discharge = Var(model.T, domain=NonNegativeReals)
        model.soc = Var(model.T, domain=NonNegativeReals)

        capacity = 500
        max_power = 100

        model.obj = Objective(
            expr=sum(
                prices[t] * model.discharge[t] -
                prices[t] * model.charge[t]
                for t in model.T
            ),
            sense=maximize
        )

        model.constraints = ConstraintList()

        for t in model.T:

            model.constraints.add(
                model.charge[t] <= max_power
            )

            model.constraints.add(
                model.discharge[t] <= max_power
            )

        solver = SolverFactory("highs")

        solver.solve(model)

        schedule = []

        for t in model.T:

            schedule.append({
                "time": t,
                "charge": model.charge[t].value,
                "discharge": model.discharge[t].value
            })

        return schedule