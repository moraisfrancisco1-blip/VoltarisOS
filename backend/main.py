from dotenv import load_dotenv
load_dotenv()  # Load .env file (OPENAI_API_KEY etc.)

from optimization.ai_optimizer import optimize_energy
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import engine
from backend import models
from backend.routers.trading_api import router as trading_router
from backend.routers import prices
from backend.routers.optimization_api import router as optimization_router
from simulation.building_simulation import run_simulation
from backend.routers import sites
from backend.routers import auth
from backend.routers.forecast import router as forecast_router
from backend.routers.copilot import router as copilot_router
from backend.routers.trading_agent import router as trading_agent_router
from backend.routers.carbon import router as carbon_router
from backend.routers.maintenance import router as maintenance_router
import os

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
# app.include_router(forecast_router)
app.include_router(copilot_router)
app.include_router(trading_agent_router)
app.include_router(carbon_router)
app.include_router(maintenance_router) # pyright: ignore[reportUndefinedVariable]
app.include_router(prices.router, prefix="/api")
app.include_router(sites.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(forecast_router)
app.include_router(copilot_router)
app.include_router(trading_agent_router)
app.include_router(carbon_router)
app.include_router(maintenance_router)

@app.get("/ai_decision")
def ai_decision(price: float, battery: float):

    decision = optimize_energy(price, battery)

    return {"decision": decision}

# @app.get("/price_forecast")
# def price_forecast():
    return {"prices": get_price_forecast()}

@app.get("/health")
def health():
    return {"status": "ok", "message": "VoltarisOS backend running"}

# Serve React frontend — must be LAST
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/")
    def serve_frontend():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}")
    def catch_all(full_path: str):
        index = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index)
else:
    @app.get("/")
    def home():
        return {"message": "VoltarisOS backend running (no frontend build found)"}


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