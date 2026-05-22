from pyomo.environ import *

def optimize_milp(solar, load, prices):

    T = range(len(solar))

    model = ConcreteModel()

    # Variáveis
    model.charge = Var(T, domain=NonNegativeReals)
    model.discharge = Var(T, domain=NonNegativeReals)
    model.grid_import = Var(T, domain=NonNegativeReals)
    model.grid_export = Var(T, domain=NonNegativeReals)
    model.soc = Var(T, bounds=(0,100))

    # Parâmetros
    max_charge = 20
    max_discharge = 20
    efficiency = 0.9

    # 🔋 Estado inicial
    def soc_rule(model, t):
        if t == 0:
            return model.soc[t] == 50
        return model.soc[t] == model.soc[t-1] + \
               efficiency * model.charge[t] - \
               model.discharge[t] / efficiency

    model.soc_constraint = Constraint(T, rule=soc_rule)

    # ⚡ balanço energético
    def balance_rule(model, t):
        return solar[t] + model.discharge[t] + model.grid_import[t] == \
               load[t] + model.charge[t] + model.grid_export[t]

    model.balance = Constraint(T, rule=balance_rule)

    # limites
    model.charge_limit = Constraint(T, rule=lambda m,t: m.charge[t] <= max_charge)
    model.discharge_limit = Constraint(T, rule=lambda m,t: m.discharge[t] <= max_discharge)

    # 💰 objetivo (minimizar custo)
    def objective_rule(model):
        return sum(
            prices[t] * model.grid_import[t]
            - prices[t] * model.grid_export[t]
            for t in T
        )

    model.obj = Objective(rule=objective_rule, sense=minimize)

    # Solver
    solver = SolverFactory('highs')
    solver.solve(model)

    # Resultados
    grid = []
    soc = []
    charge = []
    discharge = []

    for t in T:
        grid_val = value(model.grid_import[t]) - value(model.grid_export[t])
        grid.append(grid_val)

        soc.append(value(model.soc[t]))
        charge.append(value(model.charge[t]))
        discharge.append(value(model.discharge[t]))

    return grid, soc, charge, discharge