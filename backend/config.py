import os
import sys
from dotenv import load_dotenv

load_dotenv()


def _require_env(key: str, hint: str = "") -> str:
    """Return env var or exit with a clear message — no silent fallbacks for secrets."""
    value = os.getenv(key)
    if not value:
        msg = f"ERROR: Required environment variable '{key}' is not set."
        if hint:
            msg += f" {hint}"
        print(msg, file=sys.stderr)
        sys.exit(1)
    return value


class Settings:
    # Database
    # SQLite fallback is acceptable for local dev; production MUST set DATABASE_URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./voltaris.db")
    
    # Security — NO fallbacks; these MUST come from environment
    SECRET_KEY: str = _require_env(
        "SECRET_KEY",
        "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    
    # API
    API_V1_STR: str = "/api/v1"
    
    # CORS
    BACKEND_CORS_ORIGINS: list = [
        o.strip() for o in os.getenv(
            "BACKEND_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:4200,https://voltarisos.com,https://www.voltarisos.com"
        ).split(",") if o.strip()
    ]
    
    # Stripe — optional; billing endpoints will return 503 if keys are missing
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_PUBLISHABLE_KEY: str = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    
    # Redis (optional — for sessions/cache; falls back to in-memory if not set)
    REDIS_URL: str = os.getenv("REDIS_URL", "")  # e.g., redis://localhost:6379/0
    
    # 2FA / TOTP
    TOTP_ISSUER: str = os.getenv("TOTP_ISSUER", "VoltarisOS")
    TOTP_ENABLED: bool = os.getenv("TOTP_ENABLED", "false").lower() == "true"
    
    # Energy Market APIs (ENTSO-E, EEX)
    ENTSOE_API_KEY: str = os.getenv("ENTSOE_API_KEY", "")
    ENTSOE_BASE_URL: str = os.getenv("ENTSOE_BASE_URL", "https://web-api.tp.entsoe.eu/api")
    EEX_API_KEY: str = os.getenv("EEX_API_KEY", "")
    EEX_BASE_URL: str = os.getenv("EEX_BASE_URL", "https://www.eex.com/data")
    
    # Market configuration
    DEFAULT_MARKET: str = os.getenv("DEFAULT_MARKET", "MIBEL")
    PRICE_UPDATE_INTERVAL_MINUTES: int = int(os.getenv("PRICE_UPDATE_INTERVAL_MINUTES", "15"))
    
    # Stripe Metered Billing
    STRIPE_METERED_PRICE_ID: str = os.getenv("STRIPE_METERED_PRICE_ID", "")
    BILLING_ENABLED: bool = os.getenv("BILLING_ENABLED", "true").lower() == "true"
    
    # Sentry (error tracking)
    SENTRY_DSN: str = os.getenv("SENTRY_DSN", "")
    SENTRY_ENABLED: bool = bool(os.getenv("SENTRY_DSN", "")) and os.getenv("ENVIRONMENT", "development") == "production"
    SENTRY_TRACES_SAMPLE_RATE: float = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    
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