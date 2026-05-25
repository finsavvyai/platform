"""
Billing and Subscription API Endpoints

Provides endpoints for subscription management, billing, and usage tracking.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.services.billing_service import (
    BillingService,
    SubscriptionTier,
    BillingPeriod,
    UsageMetric
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


class SubscriptionCreate(BaseModel):
    """Create subscription request"""
    tier: SubscriptionTier
    billing_period: BillingPeriod
    payment_method_id: Optional[str] = None
    organization_id: Optional[UUID] = None


class SubscriptionUpdate(BaseModel):
    """Update subscription request"""
    tier: Optional[SubscriptionTier] = None
    billing_period: Optional[BillingPeriod] = None


class UsageCheckRequest(BaseModel):
    """Check usage limit request"""
    metric: UsageMetric


@router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
async def create_subscription(
    subscription_data: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create a new subscription"""
    try:
        billing_service = BillingService(db)
        subscription = await billing_service.create_subscription(
            user_id=current_user.id,
            tier=subscription_data.tier,
            billing_period=subscription_data.billing_period,
            organization_id=subscription_data.organization_id,
            payment_method_id=subscription_data.payment_method_id
        )

        return {
            "id": str(subscription.id),
            "tier": subscription.tier.value,
            "status": subscription.status.value,
            "billing_period": subscription.billing_period.value,
            "current_period_end": subscription.current_period_end.isoformat(),
            "message": "Subscription created successfully"
        }

    except Exception as e:
        logger.error(f"Failed to create subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create subscription: {str(e)}"
        )


@router.get("/subscriptions/current")
async def get_current_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get current user's subscription"""
    try:
        billing_service = BillingService(db)
        subscription = await billing_service.get_subscription(current_user.id)

        if not subscription:
            return {
                "subscription": None,
                "message": "No active subscription"
            }

        return {
            "id": str(subscription.id),
            "tier": subscription.tier.value,
            "status": subscription.status.value,
            "billing_period": subscription.billing_period.value,
            "current_period_start": subscription.current_period_start.isoformat(),
            "current_period_end": subscription.current_period_end.isoformat(),
            "cancel_at_period_end": subscription.cancel_at_period_end
        }

    except Exception as e:
        logger.error(f"Failed to get subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve subscription"
        )


@router.put("/subscriptions/{subscription_id}")
async def update_subscription(
    subscription_id: UUID,
    subscription_data: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update subscription tier or billing period"""
    try:
        billing_service = BillingService(db)
        
        if subscription_data.tier:
            subscription = await billing_service.update_subscription_tier(
                subscription_id, subscription_data.tier
            )
        else:
            subscription = await billing_service.get_subscription_by_id(subscription_id)

        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subscription not found"
            )

        return {
            "id": str(subscription.id),
            "tier": subscription.tier.value,
            "status": subscription.status.value,
            "message": "Subscription updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to update subscription: {str(e)}"
        )


@router.post("/subscriptions/{subscription_id}/cancel")
async def cancel_subscription(
    subscription_id: UUID,
    cancel_immediately: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Cancel subscription"""
    try:
        billing_service = BillingService(db)
        subscription = await billing_service.cancel_subscription(
            subscription_id, cancel_immediately
        )

        return {
            "id": str(subscription.id),
            "status": subscription.status.value,
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "message": "Subscription canceled successfully"
        }

    except Exception as e:
        logger.error(f"Failed to cancel subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to cancel subscription: {str(e)}"
        )


@router.post("/usage/check")
async def check_usage_limit(
    request: UsageCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Check usage limit for a specific metric"""
    try:
        billing_service = BillingService(db)
        usage_info = await billing_service.check_usage_limit(
            current_user.id, request.metric
        )

        return {
            "metric": request.metric.value,
            "allowed": usage_info["allowed"],
            "limit": usage_info["limit"],
            "used": usage_info["used"],
            "remaining": usage_info["remaining"]
        }

    except Exception as e:
        logger.error(f"Failed to check usage limit: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check usage limit"
        )


@router.get("/usage/summary")
async def get_usage_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get usage summary for all metrics"""
    try:
        billing_service = BillingService(db)
        
        summary = {}
        for metric in UsageMetric:
            usage_info = await billing_service.check_usage_limit(
                current_user.id, metric
            )
            summary[metric.value] = usage_info

        return {
            "usage": summary,
            "period": datetime.now(timezone.utc).replace(day=1).isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get usage summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage summary"
        )


@router.get("/invoices")
async def list_invoices(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """List invoices for current user"""
    # This would query invoices from database
    return {
        "invoices": [],
        "total": 0
    }


@router.get("/pricing")
async def get_pricing() -> Dict[str, Any]:
    """Get pricing information for all tiers"""
    from app.services.billing_service import TIER_PRICING

    pricing = {}
    for tier, config in TIER_PRICING.items():
        pricing[tier.value] = {
            "monthly": str(config["monthly"]),
            "yearly": str(config["yearly"]),
            "limits": {k.value: v for k, v in config["limits"].items()},
            "features": config["features"]
        }

    return {
        "pricing": pricing,
        "currency": "USD"
    }


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Handle Stripe webhook events for subscription management"""
    import stripe
    from app.core.config import settings

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Stripe webhook secret not configured"
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )

    # Handle the event
    event_type = event["type"]
    data = event["data"]["object"]

    billing_service = BillingService(db)

    try:
        if event_type == "customer.subscription.created":
            logger.info(f"Subscription created: {data['id']}")
            # Update subscription status in database

        elif event_type == "customer.subscription.updated":
            logger.info(f"Subscription updated: {data['id']}")
            # Update subscription in database

        elif event_type == "customer.subscription.deleted":
            logger.info(f"Subscription deleted: {data['id']}")
            # Mark subscription as canceled

        elif event_type == "invoice.payment_succeeded":
            logger.info(f"Invoice paid: {data['id']}")
            # Mark invoice as paid

        elif event_type == "invoice.payment_failed":
            logger.warning(f"Invoice payment failed: {data['id']}")
            # Handle failed payment notification

        return {"received": True, "event_type": event_type}

    except Exception as e:
        logger.error(f"Error handling Stripe webhook: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing webhook"
        )

