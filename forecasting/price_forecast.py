import numpy as np

def forecast_prices():

    base_price = 60

    forecast = []

    for i in range(24):
        variation = np.sin(i/24 * 2 * np.pi) * 20
        noise = np.random.normal(0, 5)

        price = base_price + variation + noise

        forecast.append(round(price,2))

    return forecast