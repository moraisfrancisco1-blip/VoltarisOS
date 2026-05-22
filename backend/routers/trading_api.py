from fastapi import APIRouter
import random

router = APIRouter()

total_profit = 0

@router.get("/trade")
def trade():

    global total_profit

    price = random.uniform(20,100)
    battery = random.uniform(20,100)

    if price > 70:
        action = "SELL"
        profit = price * 0.2
    elif price < 40:
        action = "BUY"
        profit = -price * 0.1
    else:
        action = "HOLD"
        profit = 0

    total_profit += profit

    return {
        "price": round(price,2),
        "battery": round(battery,2),
        "action": action,
        "profit": round(profit,2),
        "total_profit": round(total_profit,2)
    }