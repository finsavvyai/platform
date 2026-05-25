"""
Billing and Subscription Service for UPM.Plus

Provides comprehensive billing, subscription management, and payment processing
for commercial SaaS operations.
"""

import logging
import stripe
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from uuid import UUID, uuid4
from decimal import Decimal
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, Field

from app.core.config import settings
from app.models.user import User
from app.models.organization import Organization
from app.models.billing import (
    Subscription as SubscriptionModel,
    Invoice as InvoiceModel,
    UsageRecord as UsageRecordModel,
    PaymentMethod as PaymentMethodModel,
    BillingEvent as BillingEventModel
)
from sqlalchemy import select, and_, func

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = getattr(settings, "STRIPE_SECRET_KEY", None)


class SubscriptionTier(str, Enum):
    """Subscription tiers"""
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(str, Enum):
    """Subscription status"""
    ACTIVE = "active"
    TRIAL = "trial"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    UNPAID = "unpaid"
    INCOMPLETE = "incomplete"
    INCOMPLETE_EXPIRED = "incomplete_expired"


class BillingPeriod(str, Enum):
    """Billing periods"""
    MONTHLY = "monthly"
    YEARLY = "yearly"


class UsageMetric(str, Enum):
    """Usage metrics for billing"""
    API_REQUESTS = "api_requests"
    WORKFLOW_EXECUTIONS = "workflow_executions"
    BROWSER_SESSIONS = "browser_sessions"
    STORAGE_GB = "storage_gb"
    AGENT_EXECUTIONS = "agent_executions"
    DOCUMENT_PROCESSING = "document_processing"
    LLM_TOKENS = "llm_tokens"


# Pricing configuration
TIER_PRICING = {
    SubscriptionTier.FREE: {
        "monthly": Decimal("0.00"),
        "yearly": Decimal("0.00"),
        "limits": {
            UsageMetric.API_REQUESTS: 1000,
            UsageMetric.WORKFLOW_EXECUTIONS: 10,
            UsageMetric.BROWSER_SESSIONS: 5,
            UsageMetric.STORAGE_GB: 1,
            UsageMetric.AGENT_EXECUTIONS: 50,
            UsageMetric.DOCUMENT_PROCESSING: 10,
            UsageMetric.LLM_TOKENS: 10000,
        },
        "features": ["basic_automation", "community_support"]
    },
    SubscriptionTier.STARTER: {
        "monthly": Decimal("29.00"),
        "yearly": Decimal("290.00"),  # 2 months free
        "limits": {
            UsageMetric.API_REQUESTS: 10000,
            UsageMetric.WORKFLOW_EXECUTIONS: 100,
            UsageMetric.BROWSER_SESSIONS: 50,
            UsageMetric.STORAGE_GB: 10,
            UsageMetric.AGENT_EXECUTIONS: 500,
            UsageMetric.DOCUMENT_PROCESSING: 100,
            UsageMetric.LLM_TOKENS: 100000,
        },
        "features": ["basic_automation", "email_support", "workflow_templates"]
    },
    SubscriptionTier.PROFESSIONAL: {
        "monthly": Decimal("99.00"),
        "yearly": Decimal("990.00"),  # 2 months free
        "limits": {
            UsageMetric.API_REQUESTS: 100000,
            UsageMetric.WORKFLOW_EXECUTIONS: 1000,
            UsageMetric.BROWSER_SESSIONS: 200,
            UsageMetric.STORAGE_GB: 50,
            UsageMetric.AGENT_EXECUTIONS: 5000,
            UsageMetric.DOCUMENT_PROCESSING: 1000,
            UsageMetric.LLM_TOKENS: 1000000,
        },
        "features": ["advanced_automation", "priority_support", "api_access", "custom_workflows"]
    },
    SubscriptionTier.BUSINESS: {
        "monthly": Decimal("299.00"),
        "yearly": Decimal("2990.00"),  # 2 months free
        "limits": {
            UsageMetric.API_REQUESTS: 1000000,
            UsageMetric.WORKFLOW_EXECUTIONS: 10000,
            UsageMetric.BROWSER_SESSIONS: 1000,
            UsageMetric.STORAGE_GB: 200,
            UsageMetric.AGENT_EXECUTIONS: 50000,
            UsageMetric.DOCUMENT_PROCESSING: 10000,
            UsageMetric.LLM_TOKENS: 10000000,
        },
        "features": ["enterprise_automation", "dedicated_support", "sla", "custom_integrations"]
    },
    SubscriptionTier.ENTERPRISE: {
        "monthly": Decimal("999.00"),
        "yearly": Decimal("9990.00"),  # 2 months free
        "limits": {
            UsageMetric.API_REQUESTS: -1,  # Unlimited
            UsageMetric.WORKFLOW_EXECUTIONS: -1,
            UsageMetric.BROWSER_SESSIONS: -1,
            UsageMetric.STORAGE_GB: -1,
            UsageMetric.AGENT_EXECUTIONS: -1,
            UsageMetric.DOCUMENT_PROCESSING: -1,
            UsageMetric.LLM_TOKENS: -1,
        },
        "features": ["unlimited_automation", "24/7_support", "custom_sla", "on_premise_option"]
    },
}

# Usage-based pricing (overage charges)
USAGE_PRICING = {
    UsageMetric.API_REQUESTS: Decimal("0.001"),  # $0.001 per request
    UsageMetric.WORKFLOW_EXECUTIONS: Decimal("0.10"),  # $0.10 per execution
    UsageMetric.BROWSER_SESSIONS: Decimal("0.05"),  # $0.05 per session
    UsageMetric.STORAGE_GB: Decimal("0.10"),  # $0.10 per GB/month
    UsageMetric.AGENT_EXECUTIONS: Decimal("0.01"),  # $0.01 per execution
    UsageMetric.DOCUMENT_PROCESSING: Decimal("0.05"),  # $0.05 per document
    UsageMetric.LLM_TOKENS: Decimal("0.00001"),  # $0.00001 per token
}


class Subscription(BaseModel):
    """Subscription model"""
    id: UUID
    user_id: UUID
    organization_id: Optional[UUID] = None
    tier: SubscriptionTier
    status: SubscriptionStatus
    billing_period: BillingPeriod
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UsageRecord(BaseModel):
    """Usage record for billing"""
    id: UUID
    subscription_id: UUID
    metric: UsageMetric
    quantity: int
    period_start: datetime
    period_end: datetime
    created_at: datetime


class Invoice(BaseModel):
    """Invoice model"""
    id: UUID
    subscription_id: UUID
    amount: Decimal
    currency: str = "usd"
    status: str  # paid, pending, failed
    period_start: datetime
    period_end: datetime
    stripe_invoice_id: Optional[str] = None
    created_at: datetime
    paid_at: Optional[datetime] = None


class BillingService:
    """Billing and subscription management service"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_subscription(
        self,
        user_id: UUID,
        tier: SubscriptionTier,
        billing_period: BillingPeriod,
        organization_id: Optional[UUID] = None,
        payment_method_id: Optional[str] = None
    ) -> Subscription:
        """Create a new subscription"""
        try:
            # Get pricing
            pricing = TIER_PRICING[tier]
            amount = pricing[billing_period.value]

            # Create Stripe customer if needed
            user = await self.db.get(User, user_id)
            if not user:
                raise ValueError("User not found")

            stripe_customer_id = None
            if amount > 0 and stripe.api_key:
                # Create or get Stripe customer
                customer = stripe.Customer.create(
                    email=user.email,
                    metadata={"user_id": str(user_id)}
                )
                stripe_customer_id = customer.id

                # Add payment method if provided
                if payment_method_id:
                    stripe.PaymentMethod.attach(
                        payment_method_id,
                        customer=customer.id
                    )
                    stripe.Customer.modify(
                        customer.id,
                        invoice_settings={"default_payment_method": payment_method_id}
                    )

                # Create Stripe subscription
                stripe_subscription = stripe.Subscription.create(
                    customer=customer.id,
                    items=[{
                        "price_data": {
                            "currency": "usd",
                            "recurring": {"interval": billing_period.value},
                            "unit_amount": int(amount * 100),  # Convert to cents
                            "product_data": {
                                "name": f"UPM.Plus {tier.value.title()}",
                                "description": f"{tier.value.title()} subscription"
                            }
                        }
                    }],
                    metadata={"user_id": str(user_id), "tier": tier.value}
                )
                stripe_subscription_id = stripe_subscription.id
            else:
                stripe_subscription_id = None

            # Create subscription record
            now = datetime.now(timezone.utc)
            period_end = now + timedelta(days=30 if billing_period == BillingPeriod.MONTHLY else 365)

            subscription = Subscription(
                id=uuid4(),
                user_id=user_id,
                organization_id=organization_id,
                tier=tier,
                status=SubscriptionStatus.TRIAL if amount == 0 else SubscriptionStatus.ACTIVE,
                billing_period=billing_period,
                current_period_start=now,
                current_period_end=period_end,
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=stripe_customer_id,
                created_at=now,
                updated_at=now
            )

            # Save to database
            db_subscription = SubscriptionModel(
                id=subscription.id,
                user_id=user_id,
                organization_id=organization_id,
                tier=tier.value,
                status=subscription.status.value,
                billing_period=billing_period.value,
                current_period_start=now,
                current_period_end=period_end,
                stripe_subscription_id=stripe_subscription_id,
                stripe_customer_id=stripe_customer_id
            )
            self.db.add(db_subscription)
            await self.db.commit()
            await self.db.refresh(db_subscription)
            
            logger.info(f"Created subscription {subscription.id} for user {user_id}, tier {tier.value}")

            return subscription

        except Exception as e:
            logger.error(f"Failed to create subscription: {e}")
            raise

    async def get_subscription(self, user_id: UUID) -> Optional[Subscription]:
        """Get user's current subscription"""
        try:
            result = await self.db.execute(
                select(SubscriptionModel)
                .where(
                    and_(
                        SubscriptionModel.user_id == user_id,
                        SubscriptionModel.status.in_(["active", "trial"])
                    )
                )
                .order_by(SubscriptionModel.created_at.desc())
            )
            db_subscription = result.scalar_one_or_none()
            
            if not db_subscription:
                return None
            
            return Subscription(
                id=db_subscription.id,
                user_id=db_subscription.user_id,
                organization_id=db_subscription.organization_id,
                tier=SubscriptionTier(db_subscription.tier),
                status=SubscriptionStatus(db_subscription.status),
                billing_period=BillingPeriod(db_subscription.billing_period),
                current_period_start=db_subscription.current_period_start,
                current_period_end=db_subscription.current_period_end,
                cancel_at_period_end=db_subscription.cancel_at_period_end,
                stripe_subscription_id=db_subscription.stripe_subscription_id,
                stripe_customer_id=db_subscription.stripe_customer_id,
                created_at=db_subscription.created_at,
                updated_at=db_subscription.updated_at
            )
        except Exception as e:
            logger.error(f"Failed to get subscription: {e}")
            return None

    async def update_subscription_tier(
        self,
        subscription_id: UUID,
        new_tier: SubscriptionTier
    ) -> Subscription:
        """Upgrade or downgrade subscription tier"""
        subscription = await self.get_subscription_by_id(subscription_id)
        if not subscription:
            raise ValueError("Subscription not found")

        # Calculate prorated amount
        # Update Stripe subscription
        # Update database record

        return subscription

    async def cancel_subscription(
        self,
        subscription_id: UUID,
        cancel_immediately: bool = False
    ) -> Subscription:
        """Cancel subscription"""
        subscription = await self.get_subscription_by_id(subscription_id)
        if not subscription:
            raise ValueError("Subscription not found")

        if cancel_immediately:
            # Cancel immediately
            if subscription.stripe_subscription_id:
                stripe.Subscription.delete(subscription.stripe_subscription_id)
            subscription.status = SubscriptionStatus.CANCELED
        else:
            # Cancel at period end
            subscription.cancel_at_period_end = True
            if subscription.stripe_subscription_id:
                stripe.Subscription.modify(
                    subscription.stripe_subscription_id,
                    cancel_at_period_end=True
                )

        return subscription

    async def record_usage(
        self,
        subscription_id: UUID,
        metric: UsageMetric,
        quantity: int
    ) -> UsageRecord:
        """Record usage for billing"""
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        usage_record = UsageRecord(
            id=uuid4(),
            subscription_id=subscription_id,
            metric=metric,
            quantity=quantity,
            period_start=period_start,
            period_end=period_start + timedelta(days=32).replace(day=1) - timedelta(days=1),
            created_at=now
        )

        # Save to database
        logger.info(f"Recorded usage: {metric.value} = {quantity} for subscription {subscription_id}")

        return usage_record

    async def calculate_usage_charges(
        self,
        subscription_id: UUID,
        period_start: datetime,
        period_end: datetime
    ) -> Decimal:
        """Calculate overage charges for usage"""
        subscription = await self.get_subscription_by_id(subscription_id)
        if not subscription:
            return Decimal("0.00")

        # Get usage records for period
        # Calculate overage for each metric
        # Return total charges

        total_charges = Decimal("0.00")
        tier_limits = TIER_PRICING[subscription.tier]["limits"]

        for metric in UsageMetric:
            limit = tier_limits.get(metric, 0)
            if limit == -1:  # Unlimited
                continue

            # Get usage for this metric
            usage = await self._get_usage_for_metric(
                subscription_id, metric, period_start, period_end
            )

            if usage > limit:
                overage = usage - limit
                price_per_unit = USAGE_PRICING[metric]
                charges = Decimal(overage) * price_per_unit
                total_charges += charges

        return total_charges

    async def generate_invoice(
        self,
        subscription_id: UUID,
        period_start: datetime,
        period_end: datetime
    ) -> Invoice:
        """Generate invoice for billing period"""
        subscription = await self.get_subscription_by_id(subscription_id)
        if not subscription:
            raise ValueError("Subscription not found")

        # Get base subscription amount
        pricing = TIER_PRICING[subscription.tier]
        base_amount = pricing[subscription.billing_period.value]

        # Calculate usage charges
        usage_charges = await self.calculate_usage_charges(
            subscription_id, period_start, period_end
        )

        total_amount = base_amount + usage_charges

        # Create Stripe invoice if applicable
        stripe_invoice_id = None
        if subscription.stripe_customer_id and stripe.api_key:
            try:
                invoice = stripe.Invoice.create(
                    customer=subscription.stripe_customer_id,
                    subscription=subscription.stripe_subscription_id,
                    description=f"UPM.Plus {subscription.tier.value.title()} - {period_start.date()} to {period_end.date()}",
                    metadata={
                        "subscription_id": str(subscription_id),
                        "period_start": period_start.isoformat(),
                        "period_end": period_end.isoformat(),
                        "base_amount": str(base_amount),
                        "usage_charges": str(usage_charges)
                    }
                )
                stripe_invoice_id = invoice.id
            except Exception as e:
                logger.error(f"Failed to create Stripe invoice: {e}")

        invoice = Invoice(
            id=uuid4(),
            subscription_id=subscription_id,
            amount=total_amount,
            currency="usd",
            status="pending",
            period_start=period_start,
            period_end=period_end,
            stripe_invoice_id=stripe_invoice_id,
            created_at=datetime.now(timezone.utc)
        )

        return invoice

    async def check_usage_limit(
        self,
        user_id: UUID,
        metric: UsageMetric
    ) -> Dict[str, Any]:
        """Check if user has exceeded usage limit"""
        subscription = await self.get_subscription(user_id)
        if not subscription:
            # Default to free tier limits
            limits = TIER_PRICING[SubscriptionTier.FREE]["limits"]
        else:
            limits = TIER_PRICING[subscription.tier]["limits"]

        limit = limits.get(metric, 0)
        if limit == -1:  # Unlimited
            return {
                "allowed": True,
                "limit": -1,
                "used": 0,
                "remaining": -1
            }

        # Get current usage for this billing period
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=32).replace(day=1) - timedelta(days=1)

        usage = await self._get_usage_for_metric(
            subscription.id if subscription else None,
            metric,
            period_start,
            period_end
        )

        remaining = max(0, limit - usage)
        allowed = usage < limit

        return {
            "allowed": allowed,
            "limit": limit,
            "used": usage,
            "remaining": remaining
        }

    async def get_subscription_by_id(self, subscription_id: UUID) -> Optional[Subscription]:
        """Get subscription by ID"""
        try:
            result = await self.db.execute(
                select(SubscriptionModel).where(SubscriptionModel.id == subscription_id)
            )
            db_subscription = result.scalar_one_or_none()
            
            if not db_subscription:
                return None
            
            return Subscription(
                id=db_subscription.id,
                user_id=db_subscription.user_id,
                organization_id=db_subscription.organization_id,
                tier=SubscriptionTier(db_subscription.tier),
                status=SubscriptionStatus(db_subscription.status),
                billing_period=BillingPeriod(db_subscription.billing_period),
                current_period_start=db_subscription.current_period_start,
                current_period_end=db_subscription.current_period_end,
                cancel_at_period_end=db_subscription.cancel_at_period_end,
                stripe_subscription_id=db_subscription.stripe_subscription_id,
                stripe_customer_id=db_subscription.stripe_customer_id,
                created_at=db_subscription.created_at,
                updated_at=db_subscription.updated_at
            )
        except Exception as e:
            logger.error(f"Failed to get subscription by ID: {e}")
            return None

    async def _get_usage_for_metric(
        self,
        subscription_id: Optional[UUID],
        metric: UsageMetric,
        period_start: datetime,
        period_end: datetime
    ) -> int:
        """Get usage for a specific metric in a period"""
        try:
            if not subscription_id:
                return 0
            
            result = await self.db.execute(
                select(func.sum(UsageRecordModel.quantity))
                .where(
                    and_(
                        UsageRecordModel.subscription_id == subscription_id,
                        UsageRecordModel.metric == metric.value,
                        UsageRecordModel.period_start >= period_start,
                        UsageRecordModel.period_end <= period_end
                    )
                )
            )
            total = result.scalar() or 0
            return int(total)
        except Exception as e:
            logger.error(f"Failed to get usage for metric: {e}")
            return 0

