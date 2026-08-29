"""
Stripe Payments Router
Handles checkout sessions, webhooks, and subscription management
"""
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user
from backend.permissions import PLAN_MAX_SITES

router = APIRouter(prefix="/api/payments", tags=["payments"])

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

DEFAULT_PLAN = "beta"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ts(unix):
    if not unix:
        return None
    return datetime.fromtimestamp(int(unix), tz=timezone.utc).replace(tzinfo=None)


def _resolve_tenant(db: Session, obj: dict):
    """Resolve the tenant for a Stripe event, using the safest available link."""
    ref = obj.get("client_reference_id")
    if ref:
        try:
            tenant = db.query(models.Tenant).filter(models.Tenant.id == int(ref)).first()
            if tenant:
                return tenant
        except (TypeError, ValueError):
            pass
    meta = obj.get("metadata") or {}
    tid = meta.get("tenant_id")
    if tid:
        try:
            tenant = db.query(models.Tenant).filter(models.Tenant.id == int(tid)).first()
            if tenant:
                return tenant
        except (TypeError, ValueError):
            pass
    customer_id = obj.get("customer")
    if customer_id:
        return db.query(models.Tenant).filter(models.Tenant.stripe_customer_id == customer_id).first()
    return None


def _grant_plan(tenant, plan_id):
    if plan_id in settings.STRIPE_PLANS:
        tenant.plan = plan_id
        tenant.max_sites = PLAN_MAX_SITES.get(plan_id, 1)


def _revoke_plan(tenant):
    tenant.plan = DEFAULT_PLAN
    tenant.max_sites = PLAN_MAX_SITES.get(DEFAULT_PLAN, 1)


class CheckoutRequest(BaseModel):
    plan_id: str  # home, starter, pro, enterprise
    billing_cycle: str = "monthly"  # monthly or yearly


class SubscriptionUpdate(BaseModel):
    subscription_id: str
    new_plan_id: str


@router.post("/create-checkout-session")
async def create_checkout_session(
    body: CheckoutRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout Session for the authenticated tenant."""
    if body.plan_id not in settings.STRIPE_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID")

    tenant_id = user.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(status_code=400, detail="tenant_id could not be resolved")

    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    plan = settings.STRIPE_PLANS[body.plan_id]
    if body.billing_cycle == "yearly":
        price_cents = plan["price_yearly"]
        interval = "year"
    else:
        price_cents = plan["price_monthly"]
        interval = "month"

    user_email = user.get("email") or user.get("sub")

    try:
        # Reuse or create the tenant's Stripe customer.
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            customers = stripe.Customer.list(email=user_email, limit=1)
            if customers.data:
                customer_id = customers.data[0].id
            else:
                customer = stripe.Customer.create(
                    email=user_email,
                    metadata={"tenant_id": str(tenant_id)},
                )
                customer_id = customer.id
            tenant.stripe_customer_id = customer_id
            db.commit()

        base = str(request.base_url).rstrip("/")
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"VoltarisOS {plan['name']} Plan",
                        "description": plan["description"],
                    },
                    "unit_amount": price_cents,
                    "recurring": {"interval": interval},
                },
                "quantity": 1,
            }],
            mode="subscription",
            client_reference_id=str(tenant_id),
            success_url=f"{base}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base}/payment/cancel",
            customer=customer_id,
            metadata={
                "tenant_id": str(tenant_id),
                "plan_id": body.plan_id,
                "billing_cycle": body.billing_cycle,
            },
            subscription_data={
                "metadata": {"tenant_id": str(tenant_id), "plan_id": body.plan_id},
            },
        )

        return {
            "session_id": session.id,
            "url": session.url,
            "plan": plan["name"],
            "amount": price_cents / 100,
            "currency": "EUR",
            "billing_cycle": body.billing_cycle,
        }

    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get checkout session details"""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        return {
            "id": session.id,
            "status": session.status,
            "payment_status": session.payment_status,
            "customer_email": session.customer_email,
            "metadata": session.metadata
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhooks with signature validation, persistence and idempotency."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Idempotency: process each event exactly once.
    event_id = event["id"]
    if db.query(models.StripeEvent).filter(models.StripeEvent.event_id == event_id).first():
        return JSONResponse(content={"received": True, "duplicate": True}, status_code=200)

    event_type = event["type"]
    obj = event["data"]["object"]
    tenant = _resolve_tenant(db, obj)

    if event_type == "checkout.session.completed":
        if tenant:
            if obj.get("customer"):
                tenant.stripe_customer_id = obj.get("customer")
            if obj.get("subscription"):
                tenant.stripe_subscription_id = obj.get("subscription")
            if obj.get("payment_status") == "paid":
                _grant_plan(tenant, (obj.get("metadata") or {}).get("plan_id"))

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        if tenant:
            tenant.stripe_subscription_id = obj.get("id")
            tenant.subscription_status = obj.get("status")
            tenant.subscription_end = _ts(obj.get("current_period_end"))
            if obj.get("customer"):
                tenant.stripe_customer_id = obj.get("customer")
            status = obj.get("status")
            plan_id = (obj.get("metadata") or {}).get("plan_id")
            if status in ("active", "trialing"):
                _grant_plan(tenant, plan_id)
            elif status in ("canceled", "unpaid", "past_due", "incomplete", "incomplete_expired"):
                _revoke_plan(tenant)

    elif event_type == "customer.subscription.deleted":
        if tenant:
            tenant.subscription_status = "canceled"
            tenant.subscription_end = None
            _revoke_plan(tenant)

    elif event_type == "invoice.payment_succeeded":
        if tenant:
            if obj.get("customer"):
                tenant.stripe_customer_id = obj.get("customer")
            if obj.get("subscription"):
                tenant.stripe_subscription_id = obj.get("subscription")

    elif event_type == "invoice.payment_failed":
        if tenant:
            tenant.subscription_status = "past_due"
            _revoke_plan(tenant)

    db.add(models.StripeEvent(event_id=event_id))
    db.commit()
    return JSONResponse(content={"received": True}, status_code=200)


@router.get("/plans")
async def get_plans():
    """Get all available plans"""
    plans = []
    for plan_id, plan_data in settings.STRIPE_PLANS.items():
        plans.append({
            "id": plan_id,
            "name": plan_data["name"],
            "description": plan_data["description"],
            "price_monthly": plan_data["price_monthly"] / 100,
            "price_yearly": plan_data["price_yearly"] / 100,
            "currency": "EUR"
        })
    return {"plans": plans}


@router.get("/publishable-key")
async def get_publishable_key():
    """Get Stripe publishable key for frontend"""
    return {"publishable_key": settings.STRIPE_PUBLISHABLE_KEY}