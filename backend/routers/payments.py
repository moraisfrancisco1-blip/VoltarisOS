"""
Stripe Payments Router
Handles checkout sessions, webhooks, and subscription management
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
import stripe
from config import settings

router = APIRouter(prefix="/api/payments", tags=["payments"])

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class CheckoutRequest(BaseModel):
    plan_id: str  # home, starter, pro, enterprise
    billing_cycle: str = "monthly"  # monthly or yearly
    user_email: Optional[str] = None
    success_url: str = "http://localhost:4200/payment/success?session_id={CHECKOUT_SESSION_ID}"
    cancel_url: str = "http://localhost:4200/payment/cancel"


class SubscriptionUpdate(BaseModel):
    subscription_id: str
    new_plan_id: str


@router.post("/create-checkout-session")
async def create_checkout_session(request: CheckoutRequest):
    """Create a Stripe Checkout Session for subscription"""
    
    # Validate plan
    if request.plan_id not in settings.STRIPE_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan ID")
    
    plan = settings.STRIPE_PLANS[request.plan_id]
    
    # Determine price based on billing cycle
    if request.billing_cycle == "yearly":
        price_cents = plan["price_yearly"]
        interval = "year"
    else:
        price_cents = plan["price_monthly"]
        interval = "month"
    
    try:
        # Create or retrieve customer
        customer = None
        if request.user_email:
            customers = stripe.Customer.list(email=request.user_email, limit=1)
            if customers.data:
                customer = customers.data[0]
            else:
                customer = stripe.Customer.create(email=request.user_email)
        
        # Create checkout session
        session_params = {
            "payment_method_types": ["card"],
            "line_items": [{
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"VoltarisOS {plan['name']} Plan",
                        "description": plan["description"],
                    },
                    "unit_amount": price_cents,
                    "recurring": {
                        "interval": interval,
                    },
                },
                "quantity": 1,
            }],
            "mode": "subscription",
            "success_url": request.success_url,
            "cancel_url": request.cancel_url,
            "metadata": {
                "plan_id": request.plan_id,
                "billing_cycle": request.billing_cycle,
            }
        }
        
        if customer:
            session_params["customer"] = customer.id
        elif request.user_email:
            session_params["customer_email"] = request.user_email
        
        session = stripe.checkout.Session.create(**session_params)
        
        return {
            "session_id": session.id,
            "url": session.url,
            "plan": plan["name"],
            "amount": price_cents / 100,
            "currency": "EUR",
            "billing_cycle": request.billing_cycle
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
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    
    try:
        # Verify webhook signature
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle events
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # Handle successful checkout
        print(f"Checkout completed: {session['id']}")
        # TODO: Update user subscription in database
        
    elif event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        print(f"Subscription created: {subscription['id']}")
        # TODO: Save subscription to database
        
    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        print(f"Subscription updated: {subscription['id']}")
        # TODO: Update subscription in database
        
    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        print(f"Subscription cancelled: {subscription['id']}")
        # TODO: Mark subscription as cancelled in database
        
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        print(f"Payment succeeded: {invoice['id']}")
        # TODO: Record payment in database
        
    elif event["type"] == "invoice.payment_failed":
        invoice = event["data"]["object"]
        print(f"Payment failed: {invoice['id']}")
        # TODO: Handle failed payment
    
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