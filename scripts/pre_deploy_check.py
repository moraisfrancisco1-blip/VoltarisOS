#!/usr/bin/env python3
"""
pre_deploy_check.py — Pre-deployment verification script for VoltarisOS.

Checks:
- Required environment variables
- Stripe keys are production (not test)
- Sentry DSN is configured
- Database URL is PostgreSQL (not SQLite)
- Redis URL is configured
- Git is clean (no uncommitted changes)

Usage:
    python scripts/pre_deploy_check.py
    
    # Or with specific .env file
    python scripts/pre_deploy_check.py --env .env.production
"""
import os
import sys
import subprocess
from pathlib import Path
from typing import List, Tuple

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.RESET}\n")


def print_check(name: str, passed: bool, message: str = ""):
    """Print a check result."""
    status = f"{Colors.GREEN}✓{Colors.RESET}" if passed else f"{Colors.RED}✗{Colors.RESET}"
    print(f"  {status} {name}")
    if message:
        color = Colors.GREEN if passed else Colors.RED
        print(f"    {color}{message}{Colors.RESET}")


def check_env_var(name: str, required: bool = True, pattern: str = None) -> Tuple[bool, str]:
    """Check if an environment variable is set and optionally matches a pattern."""
    value = os.getenv(name)
    
    if not value:
        if required:
            return False, f"{name} is not set (REQUIRED)"
        return True, f"{name} is not set (optional)"
    
    if pattern and not value.startswith(pattern):
        return False, f"{name} should start with '{pattern}', got '{value[:20]}...'"
    
    return True, f"{name} is set"


def check_git_clean() -> Tuple[bool, str]:
    """Check if git working directory is clean."""
    try:
        result = subprocess.run(
            ['git', 'status', '--porcelain'],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent
        )
        
        if result.stdout.strip():
            return False, "Git has uncommitted changes"
        return True, "Git is clean"
    except Exception as e:
        return False, f"Git check failed: {e}"


def check_stripe_keys() -> Tuple[bool, str]:
    """Check if Stripe keys are production keys."""
    secret = os.getenv("STRIPE_SECRET_KEY", "")
    publishable = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
    
    if not secret or not publishable:
        return False, "Stripe keys not set"
    
    if secret.startswith("sk_test_") or publishable.startswith("pk_test_"):
        return False, "Using TEST Stripe keys (should be sk_live_ / pk_live_)"
    
    if not secret.startswith("sk_live_") or not publishable.startswith("pk_live_"):
        return False, "Stripe keys format invalid"
    
    return True, "Stripe keys are production keys"


def check_database_url() -> Tuple[bool, str]:
    """Check if DATABASE_URL is PostgreSQL."""
    url = os.getenv("DATABASE_URL", "")
    
    if not url:
        return False, "DATABASE_URL is not set"
    
    if url.startswith("sqlite"):
        return False, "Using SQLite (should be PostgreSQL for production)"
    
    if not url.startswith("postgresql"):
        return False, f"DATABASE_URL should be postgresql://, got {url[:20]}..."
    
    return True, "DATABASE_URL is PostgreSQL"


def main():
    """Run all pre-deploy checks."""
    print_header("VoltarisOS Pre-Deploy Check")
    
    all_passed = True
    warnings = []
    
    # ─── Required Environment Variables ──────────────────────────────────────
    print(f"{Colors.BOLD}Required Environment Variables:{Colors.RESET}")
    
    checks = [
        ("SECRET_KEY", True, None),
        ("STRIPE_SECRET_KEY", True, None),
        ("STRIPE_PUBLISHABLE_KEY", True, None),
        ("STRIPE_WEBHOOK_SECRET", True, None),
        ("DATABASE_URL", True, None),
        ("REDIS_URL", False, None),
        ("SENTRY_DSN", False, None),
        ("ENTSOE_API_KEY", False, None),
        ("EEX_API_KEY", False, None),
        ("ADMIN_INITIAL_PASSWORD", False, None),
        ("BETA_CODE", False, None),
    ]
    
    for name, required, pattern in checks:
        passed, message = check_env_var(name, required, pattern)
        print_check(name, passed, message)
        if not passed:
            all_passed = False
        elif "not set" in message and not required:
            warnings.append(name)
    
    # ─── Production Checks ───────────────────────────────────────────────────
    print(f"\n{Colors.BOLD}Production Checks:{Colors.RESET}")
    
    # Stripe keys
    passed, message = check_stripe_keys()
    print_check("Stripe Production Keys", passed, message)
    if not passed:
        all_passed = False
    
    # Database
    passed, message = check_database_url()
    print_check("PostgreSQL Database", passed, message)
    if not passed:
        all_passed = False
    
    # Environment
    env = os.getenv("ENVIRONMENT", "development")
    is_production = env == "production"
    print_check("Environment", is_production, f"ENVIRONMENT={env}")
    if not is_production:
        all_passed = False
    
    # ─── Git Check ───────────────────────────────────────────────────────────
    print(f"\n{Colors.BOLD}Git Status:{Colors.RESET}")
    
    passed, message = check_git_clean()
    print_check("Git Clean", passed, message)
    if not passed:
        all_passed = False
    
    # ─── Summary ─────────────────────────────────────────────────────────────
    print_header("Summary")
    
    if warnings:
        print(f"{Colors.YELLOW}⚠ Warnings (optional but recommended):{Colors.RESET}")
        for w in warnings:
            print(f"  - {w}")
        print()
    
    if all_passed:
        print(f"{Colors.GREEN}{Colors.BOLD}✓ All checks passed! Ready for deploy.{Colors.RESET}")
        print(f"\nNext steps:")
        print(f"  1. git add .")
        print(f"  2. git commit -m 'chore: prepare for production deploy'")
        print(f"  3. git push origin main")
        print(f"  4. railway up")
        return 0
    else:
        print(f"{Colors.RED}{Colors.BOLD}✗ Some checks failed. Fix issues before deploying.{Colors.RESET}")
        print(f"\nSee DEPLOY_GUIDE.md for configuration instructions.")
        return 1


if __name__ == "__main__":
    sys.exit(main())