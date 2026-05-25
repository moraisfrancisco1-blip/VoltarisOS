from optimization.ai_optimizer import optimize_energy
# from forecasting.price_forecast import get_price_forecast
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine
from backend import models
from backend.routers.trading_api import router as trading_router
from backend.routers import prices
from backend.routers.optimization_api import router as optimization_router
from simulation.building_simulation import run_simulation
from backend.routers import sites
from backend.routers import auth

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(optimization_router)
app.include_router(trading_router)
# app.include_router(forecast_router) # pyright: ignore[reportUndefinedVariable]
app.include_router(prices.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(auth.router, prefix="/api")

@app.get("/ai_decision")
def ai_decision(price: float, battery: float):

    decision = optimize_energy(price, battery)

    return {"decision": decision}

# @app.get("/price_forecast")
# def price_forecast():
    return {"prices": get_price_forecast()}

@app.get("/")
def home():
    return {"message": "Energy VPP Platform Running"}


@app.get("/simulation")
def simulation():

    result = run_simulation()

    return {
        "solar": result["solar"],
        "load": result["load"],
        "grid": result["grid"],
        "battery": result["battery_soc"],
        "timeseries": result["timeseries"]
    }