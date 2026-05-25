"""Pydantic models for payment handling."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PlanType(str, Enum):
    """Available subscription plans."""

    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class CheckoutRequest(BaseModel):
    """Payment checkout initiation request."""

    plan: PlanType
    success_url: Optional[str] = Field(None, description="Optional redirect after success")
    cancel_url: Optional[str] = Field(None, description="Optional redirect after cancellation")


class CheckoutResponse(BaseModel):
    """Payment checkout response with session details."""

    session_id: str
    plan: PlanType
    amount: int = Field(..., description="Amount in cents")
    currency: str = "usd"
    checkout_url: Optional[str] = None


class WebhookEvent(BaseModel):
    """Payment webhook event (Stripe-like payload)."""

    event_id: str
    event_type: str = Field(..., description="payment.success, payment.failed, etc.")
    user_id: str
    plan: PlanType
    amount: int
    timestamp: datetime


class SubscriptionInfo(BaseModel):
    """Current subscription info for a user."""

    user_id: str
    plan: PlanType
    status: str = Field(..., description="active, canceled, past_due")
    current_period_start: str
    current_period_end: str
    amount_per_month: int = Field(..., description="Amount in cents")
