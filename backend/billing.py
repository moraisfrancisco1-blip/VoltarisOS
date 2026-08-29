"""
billing.py — Stripe metered billing integration.

Handles:
- Usage tracking for metered billing (energy managed, optimized)
- Subscription management
- Invoice generation
- Usage reporting to Stripe

Usage:
    from backend.billing import BillingManager
    
    billing = BillingManager()
    await billing.report_usage(
        customer_id="cus_123",
        quantity_kwh=1500.5,
        metric_type="energy_optimized",
    )
"""
import stripe
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from backend.config import settings
from backend.models import utcnow_naive

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@dataclass
class UsageRecord:
    """Usage record for metered billing."""
    customer_id: str
    quantity: float
    metric_type: str  # "energy_optimized", "energy_managed", "vpp_bids"
    timestamp: datetime
    subscription_item_id: Optional[str] = None


@dataclass
class BillingSummary:
    """Billing summary for a customer."""
    customer_id: str
    period_start: datetime
    period_end: datetime
    total_energy_optimized_kwh: float
    total_energy_managed_kwh: float
    total_vpp_bids: int
    estimated_cost_eur: float


class BillingManager:
    """
    Stripe metered billing manager.
    
    Tracks usage and reports to Stripe for metered billing.
    Supports:
    - Energy optimized (kWh)
    - Energy managed (kWh)
    - VPP bids submitted (count)
    """
    
    # Metric names (must match Stripe product metadata)
    METRIC_ENERGY_OPTIMIZED = "energy_optimized_kwh"
    METRIC_ENERGY_MANAGED = "energy_managed_kwh"
    METRIC_VPP_BIDS = "vpp_bids_count"
    
    def __init__(self):
        self._usage_cache: Dict[str, List[UsageRecord]] = {}
    
    async def report_usage(
        self,
        customer_id: str,
        quantity_kwh: float,
        metric_type: str = "energy_optimized",
        subscription_item_id: Optional[str] = None,
    ) -> bool:
        """
        Report usage to Stripe for metered billing.
        
        Args:
            customer_id: Stripe customer ID
            quantity_kwh: Quantity to report (kWh or count)
            metric_type: Type of metric (energy_optimized, energy_managed, vpp_bids)
            subscription_item_id: Stripe subscription item ID (if known)
        
        Returns:
            True if reported successfully
        """
        if not settings.BILLING_ENABLED:
            logger.debug("Billing disabled, skipping usage report")
            return True
        
        try:
            # Get subscription item if not provided
            if not subscription_item_id:
                subscription_item_id = await self._get_subscription_item(customer_id, metric_type)
            
            if not subscription_item_id:
                logger.warning(f"No subscription item found for customer {customer_id}")
                return False
            
            # Create usage record
            usage_record = stripe.SubscriptionItem.create_usage_record(
                subscription_item_id,
                quantity=int(quantity_kwh),  # Stripe expects integer
                timestamp=int(utcnow_naive().timestamp()),
                action="increment",
            )
            
            logger.info(f"Usage reported: customer={customer_id}, quantity={quantity_kwh}, metric={metric_type}")
            return True
        
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error reporting usage: {e}")
            return False
        
        except Exception as e:
            logger.error(f"Error reporting usage: {e}")
            return False
    
    async def _get_subscription_item(
        self,
        customer_id: str,
        metric_type: str,
    ) -> Optional[str]:
        """Get the subscription item ID for a customer and metric."""
        try:
            # Get customer's subscriptions
            subscriptions = stripe.Subscription.list(
                customer=customer_id,
                status="active",
                limit=1,
            )
            
            if not subscriptions.data:
                return None
            
            subscription = subscriptions.data[0]
            
            # Find the subscription item for this metric
            for item in subscription.items.data:
                price = item.price
                if price.recurring and price.recurring.usage_type == "metered":
                    # Check if this is the right metric
                    # In production, match by price ID or metadata
                    return item.id
            
            return None
        
        except Exception as e:
            logger.error(f"Error getting subscription item: {e}")
            return None
    
    async def get_usage_summary(
        self,
        customer_id: str,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
    ) -> BillingSummary:
        """
        Get usage summary for a customer.
        
        Args:
            customer_id: Stripe customer ID
            period_start: Start of billing period
            period_end: End of billing period
        
        Returns:
            BillingSummary with usage details
        """
        if period_start is None:
            # Default to current month
            now = utcnow_naive()
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        if period_end is None:
            period_end = utcnow_naive()
        
        # Get usage from database (audit logs or dedicated usage table)
        from backend.database import SessionLocal
        from backend import models
        from sqlalchemy import func
        
        db = SessionLocal()
        try:
            # Count energy optimized (from audit logs)
            energy_optimized = db.query(
                func.sum(models.AuditLog.details["energy_kwh"].astext.cast(float))
            ).filter(
                models.AuditLog.action == "optimization.milp.run",
                models.AuditLog.timestamp >= period_start,
                models.AuditLog.timestamp <= period_end,
            ).scalar() or 0
            
            # Count VPP bids
            vpp_bids = db.query(models.VPPBid).filter(
                models.VPPBid.tenant_id == self._get_tenant_id_from_customer(customer_id),
                models.VPPBid.submitted_at >= period_start,
                models.VPPBid.submitted_at <= period_end,
            ).count()
            
            # Calculate estimated cost (simplified)
            # In production, fetch from Stripe invoices
            estimated_cost = (energy_optimized * 0.05) + (vpp_bids * 0.10)  # €0.05/kWh + €0.10/bid
            
            return BillingSummary(
                customer_id=customer_id,
                period_start=period_start,
                period_end=period_end,
                total_energy_optimized_kwh=round(energy_optimized, 2),
                total_energy_managed_kwh=0,  # TODO: Track separately
                total_vpp_bids=vpp_bids,
                estimated_cost_eur=round(estimated_cost, 2),
            )
        
        finally:
            db.close()
    
    def _get_tenant_id_from_customer(self, customer_id: str) -> int:
        """Get tenant ID from Stripe customer ID."""
        # In production, store mapping in database
        # For now, return default tenant
        return 1
    
    async def create_customer(
        self,
        email: str,
        name: str,
        tenant_id: int,
    ) -> Optional[str]:
        """
        Create a Stripe customer for a tenant.
        
        Args:
            email: Customer email
            name: Customer name
            tenant_id: Tenant ID
        
        Returns:
            Stripe customer ID or None
        """
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"tenant_id": str(tenant_id)},
            )
            
            logger.info(f"Stripe customer created: {customer.id} for tenant {tenant_id}")
            return customer.id
        
        except stripe.error.StripeError as e:
            logger.error(f"Error creating Stripe customer: {e}")
            return None
    
    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
    ) -> Optional[str]:
        """
        Create a Stripe subscription for a customer.
        
        Args:
            customer_id: Stripe customer ID
            price_id: Stripe price ID
        
        Returns:
            Stripe subscription ID or None
        """
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                payment_behavior="default_incomplete",
                expand=["latest_invoice.payment_intent"],
            )
            
            logger.info(f"Stripe subscription created: {subscription.id} for customer {customer_id}")
            return subscription.id
        
        except stripe.error.StripeError as e:
            logger.error(f"Error creating Stripe subscription: {e}")
            return None
    
    async def cancel_subscription(
        self,
        subscription_id: str,
    ) -> bool:
        """Cancel a Stripe subscription."""
        try:
            stripe.Subscription.delete(subscription_id)
            logger.info(f"Stripe subscription cancelled: {subscription_id}")
            return True
        
        except stripe.error.StripeError as e:
            logger.error(f"Error cancelling subscription: {e}")
            return False
    
    async def get_invoices(
        self,
        customer_id: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Get recent invoices for a customer."""
        try:
            invoices = stripe.Invoice.list(
                customer=customer_id,
                limit=limit,
            )
            
            return [
                {
                    "id": inv.id,
                    "amount_due": inv.amount_due / 100,  # Convert cents to EUR
                    "status": inv.status,
                    "created": datetime.fromtimestamp(inv.created).isoformat(),
                    "pdf_url": inv.invoice_pdf,
                }
                for inv in invoices.data
            ]
        
        except Exception as e:
            logger.error(f"Error getting invoices: {e}")
            return []


# Global billing manager instance
_billing_manager: Optional[BillingManager] = None


def get_billing_manager() -> BillingManager:
    """Get or create the global billing manager."""
    global _billing_manager
    
    if _billing_manager is None:
        _billing_manager = BillingManager()
    
    return _billing_manager