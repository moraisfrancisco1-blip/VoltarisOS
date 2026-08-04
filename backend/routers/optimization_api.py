from fastapi import APIRouter
import random

router = APIRouter()

@router.get("/optimize")
def optimize():
    return {
        "solar": random.randint(20,100),
        "battery": random.randint(30,90),
        "grid": random.randint(10,50)
    }