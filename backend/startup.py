"""Startup configuration validation and environment guards.

Blocks a production start on clearly unsafe configurations (e.g. SQLite in
production, RUN_CELERY=1 without REDIS_URL) and warns on degraded-but-non-fatal
states (e.g. missing gateway keys) instead of starting silently. No secrets are
printed or returned.
"""
import os
import sys


def startup_config_errors(environment: str = None):
    """Return (fatal_errors, warnings) for the given (or current) environment.

    Empty in development. Production returns blocking errors and non-blocking
    warnings. Values are read from the environment at call time (testable).
    """
    env = environment or os.getenv("ENVIRONMENT", "development")
    fatal = []
    warnings = []

    if env == "production":
        db_url = os.getenv("DATABASE_URL", "sqlite:///./voltaris.db")
        if db_url.startswith("sqlite"):
            fatal.append("DATABASE_URL must be a PostgreSQL URL in production (SQLite is not supported)")

        run_celery = os.getenv("RUN_CELERY", "0") == "1"
        if run_celery and not os.getenv("REDIS_URL", ""):
            fatal.append("RUN_CELERY=1 requires REDIS_URL in production")

        if not os.getenv("GATEWAY_API_KEYS", ""):
            warnings.append("GATEWAY_API_KEYS is not set; gateway ingest will fail (readiness=not_configured)")

    return fatal, warnings


def validate_startup_config():
    """Log warnings and exit(1) on blocking production misconfigurations."""
    env = os.getenv("ENVIRONMENT", "development")
    fatal, warnings = startup_config_errors(env)
    if env == "production":
        for w in warnings:
            print(f"WARN: {w}", file=sys.stderr)
    if fatal:
        for e in fatal:
            print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)
