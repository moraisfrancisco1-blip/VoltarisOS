"""
Stripe Payments Router
Handles checkout sessions, webhooks, and subscription management
"""
import logging
from datetime import datetime, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import settings
from backend.audit import audit_request
from backend.database import SessionLocal
from backend import models
from backend.security import get_current_user
from backend.permissions import PLAN_MAX_SITES

router = APIRouter(prefix="/api/payments", tags=["payments"])

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

logger = logging.getLogger(__name__)

# Plan a tenant falls back to when its subscription ends or is not paid.
# Must be a *paid* tier with restricted modules: "beta" unlocks every module
# (see SUBSCRIPTION_PLAN_MODULES), so reverting to it would hand out the whole
# product for free after a cancellation.
DEFAULT_PLAN = "home"

# Stripe subscription statuses.
_LIVE_STATUSES = ("active", "trialing")
# Statuses after which the plan is taken away. "past_due" is intentionally NOT
# here: Stripe is still retrying the charge (Smart Retries), and revoking on the
# first failed attempt would downgrade a paying customer over a transient card
# problem. If the retries are exhausted Stripe moves the subscription to
# "unpaid"/"canceled", which does revoke.
_REVOKING_STATUSES = ("canceled", "unpaid", "incomplete_expired")


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


def _cancel_replaced_subscription(tenant, new_subscription_id):
    """Cancel the tenant's previous live subscription when a new one replaces it.

    Plan changes go through a fresh Checkout Session (a new subscription), so
    without this the customer would keep paying for the old plan too. Must be
    called BEFORE tenant.stripe_subscription_id is overwritten. Whichever of
    checkout.session.completed / customer.subscription.created arrives first
    performs the cancellation; the second one finds the ids already equal.
    """
    old_id = tenant.stripe_subscription_id
    if not old_id or not new_subscription_id or old_id == new_subscription_id:
        return
    if tenant.subscription_status not in (*_LIVE_STATUSES, "past_due"):
        return
    try:
        stripe.Subscription.cancel(old_id)
    except stripe.error.StripeError:
        # Do not fail the webhook (the new plan is paid and must be granted),
        # but make the double-billing risk visible.
        logger.exception(
            "Could not cancel replaced subscription %s for tenant %s (new: %s)",
            old_id, tenant.id, new_subscription_id,
        )


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

    if body.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="Invalid billing cycle")

    plan = settings.STRIPE_PLANS[body.plan_id]
    if body.billing_cycle == "yearly":
        # STRIPE_PLANS["price_yearly"] is the discounted price PER MONTH when
        # paying annually (always 96% of price_monthly), not the yearly total.
        # Stripe's `unit_amount` for an interval=year price is the amount
        # charged once per year, so it must be 12x that monthly-equivalent.
        price_cents = plan["price_yearly"] * 12
        interval = "year"
    else:
        price_cents = plan["price_monthly"]
        interval = "month"

    user_email = user.get("email") or user.get("sub")

    try:
        # Reuse or create the tenant's Stripe customer.
        customer_id = tenant.stripe_customer_id
        if not customer_id:
            # Always create a customer owned by THIS tenant. Looking one up by
            # email would bind the tenant to a customer that may belong to
            # another tenant sharing that email, and the billing portal would
            # then expose that other tenant's invoices and payment methods.
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

        audit_request(db, request, user, "billing.checkout_started", target_resource="tenant", target_id=tenant_id,
                      details={"plan": body.plan_id, "billing_cycle": body.billing_cycle,
                               "amount_eur": price_cents / 100, "session_id": session.id})
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


@router.post("/create-portal-session")
async def create_portal_session(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Billing Portal session -- the tenant manages their
    payment methods, invoices, and subscription on Stripe's own hosted page.
    Settings > Billing's "Update Card"/"Add Method"/"Change Plan" all link
    here instead of collecting card data in our own UI (no PCI scope)."""
    tenant_id = user.get("tenant_id")
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first() if tenant_id is not None else None
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Ainda não tens uma subscrição paga associada — escolhe um plano primeiro.",
        )

    base = str(request.base_url).rstrip("/")
    try:
        session = stripe.billing_portal.Session.create(
            customer=tenant.stripe_customer_id,
            return_url=f"{base}/",
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit_request(db, request, user, "billing.portal_opened", target_resource="tenant", target_id=tenant.id)
    return {"url": session.url}


@router.get("/session/{session_id}")
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    """Get checkout session details (only for the tenant that created it)."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if user.get("role") != "SUPER_ADMIN":
        metadata = getattr(session, "metadata", None) or {}
        owner = getattr(session, "client_reference_id", None) or metadata.get("tenant_id")
        if owner is None or str(owner) != str(user.get("tenant_id")):
            # 404, not 403: do not reveal that the session exists.
            raise HTTPException(status_code=404, detail="Session not found")

    return {
        "id": session.id,
        "status": session.status,
        "payment_status": session.payment_status,
        "customer_email": session.customer_email,
        "metadata": session.metadata
    }


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
    before = (tenant.plan, tenant.subscription_status) if tenant else None

    if event_type == "checkout.session.completed":
        if tenant:
            if obj.get("customer"):
                tenant.stripe_customer_id = obj.get("customer")
            if obj.get("subscription"):
                if obj.get("payment_status") == "paid":
                    _cancel_replaced_subscription(tenant, obj.get("subscription"))
                tenant.stripe_subscription_id = obj.get("subscription")
            if obj.get("payment_status") == "paid":
                _grant_plan(tenant, (obj.get("metadata") or {}).get("plan_id"))
                if tenant.subscription_status in (None, "pending_payment"):
                    tenant.subscription_status = "active"

    elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
        if tenant:
            status = obj.get("status")
            sub_id = obj.get("id")
            current_sub = tenant.stripe_subscription_id
            if current_sub and sub_id and current_sub != sub_id and status not in _LIVE_STATUSES:
                # Stale event for a subscription that is no longer the tenant's
                # current one (e.g. the old plan after an upgrade): it must not
                # overwrite the current subscription nor revoke its plan.
                pass
            else:
                if status in _LIVE_STATUSES:
                    _cancel_replaced_subscription(tenant, sub_id)
                tenant.stripe_subscription_id = sub_id
                tenant.subscription_status = status
                tenant.subscription_end = _ts(obj.get("current_period_end"))
                if obj.get("customer"):
                    tenant.stripe_customer_id = obj.get("customer")
                plan_id = (obj.get("metadata") or {}).get("plan_id")
                if status in _LIVE_STATUSES:
                    _grant_plan(tenant, plan_id)
                elif status in _REVOKING_STATUSES:
                    _revoke_plan(tenant)

    elif event_type == "customer.subscription.deleted":
        # Ignore the deletion of a subscription that is not the tenant's
        # current one (the old plan cancelled after an upgrade).
        if tenant and (not tenant.stripe_subscription_id or tenant.stripe_subscription_id == obj.get("id")):
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
        # Only flag the account. Stripe retries the charge; the plan is
        # revoked by customer.subscription.updated/deleted if the retries are
        # exhausted (see _REVOKING_STATUSES).
        if tenant:
            tenant.subscription_status = "past_due"

    db.add(models.StripeEvent(event_id=event_id))
    try:
        db.commit()
    except IntegrityError:
        # Two deliveries of the same event raced past the check above; the
        # other one won. Discard this attempt's changes: it is a duplicate.
        db.rollback()
        return JSONResponse(content={"received": True, "duplicate": True}, status_code=200)
    # Who changed the plan? Stripe did. Record every change to a tenant's plan or
    # subscription status (the actor is the system, not a user).
    if tenant is not None and before is not None:
        after = (tenant.plan, tenant.subscription_status)
        if after != before:
            audit_request(db, request, None, "billing.subscription_changed", target_resource="tenant",
                          target_id=tenant.id, tenant_id=tenant.id, user_email="stripe",
                          details={"event_type": event_type, "event_id": event_id,
                                   "plan_from": before[0], "plan_to": after[0],
                                   "status_from": before[1], "status_to": after[1]})
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
            # Discounted price per month when billed annually...
            "price_yearly": plan_data["price_yearly"] / 100,
            # ...and what is actually charged once a year.
            "price_yearly_total": plan_data["price_yearly"] * 12 / 100,
            "currency": "EUR"
        })
    return {"plans": plans}


@router.get("/publishable-key")
async def get_publishable_key():
    """Get Stripe publishable key for frontend"""
    return {"publishable_key": settings.STRIPE_PUBLISHABLE_KEY}