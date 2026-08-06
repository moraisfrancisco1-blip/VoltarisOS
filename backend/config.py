import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./voltaris.db")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # API
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:4200", "https://voltarisos.com", "https://www.voltarisos.com"]
    
    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "sk_test_51U1QprGTJxRviM77czI1TfGvyJG0xveS8qNiReztKuWVPh58k2E7Fu7o95LDpCHzULm7t7xBlj10M5ietMzlISNO002brh2mjU")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "pk_test_51U1QprGTJxRviM77GmAVgjr36f36d8Be1INJX83zXW9szonCGaQ7Ni74Cy1FCFTfLS4UcJg1BJqiijeJuhjujljT00GgraBUGJ")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "whsec_test_placeholder")
    
    # Stripe Plans (prices in cents)
    STRIPE_PLANS = {
        "home": {
            "name": "Home",
            "price_monthly": 6900,  # €69
            "price_yearly": 6624,   # €66.24 (20% off)
            "description": "1 site · até 50 kWh"
        },
        "starter": {
            "name": "Starter",
            "price_monthly": 27900,  # €279
            "price_yearly": 26784,   # €267.84 (20% off)
            "description": "5 sites · até 500 kWh"
        },
        "pro": {
            "name": "Pro",
            "price_monthly": 109900,  # €1,099
            "price_yearly": 105504,   # €1,055.04 (20% off)
            "description": "20 sites · AI avançada"
        },
        "enterprise": {
            "name": "Enterprise",
            "price_monthly": 399900,  # €3,999
            "price_yearly": 383904,   # €3,839.04 (20% off)
            "description": "Ilimitado · white-label"
        }
    }

settings = Settings()