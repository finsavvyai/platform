"""Payment service for handling checkout and webhooks."""

import logging
import secrets
from datetime import datetime, timedelta

from src.api.settings import get_settings
from src.payment.models import PlanType, SubscriptionInfo, WebhookEvent
from src.payment.plans import get_plan_price

logger = logging.getLogger("finsavvyai.payment")

# In-memory subscription store (Wave 1 - would be database in production)
_subscriptions = {}
_checkout_sessions = {}
_webhook_logs = []
_processed_webhooks = set()


def create_checkout_session(user_id: str, plan: PlanType) -> dict:
    """Create a payment checkout session.

    Args:
        user_id: User requesting checkout
        plan: Subscription plan type

    Returns:
        Dict with session_id, plan, amount, currency, checkout_url
    """
    session_id = f"session_{secrets.token_hex(8)}"
    amount = get_plan_price(plan)
    settings = get_settings()

    checkout_data = {
        "session_id": session_id,
        "user_id": user_id,
        "plan": plan,
        "amount": amount,
        "currency": "usd",
        "status": "pending",
        "created_at": datetime.now().isoformat(),
    }
    _checkout_sessions[session_id] = checkout_data

    logger.info("Created checkout session %s for user %s, plan %s", session_id, user_id, plan)
    return {
        "session_id": session_id,
        "plan": plan,
        "amount": amount,
        "currency": "usd",
        "checkout_url": f"{settings.checkout_base_url}/{session_id}",
    }


def handle_webhook(event: WebhookEvent) -> str:
    """Process payment webhook event.

    Args:
        event: Webhook event from payment provider

    Returns:
        Processing result: processed, duplicate, or skipped
    """
    if event.event_id in _processed_webhooks:
        logger.info("Duplicate webhook ignored: %s", event.event_id)
        return "duplicate"

    _webhook_logs.append(
        {
            "event_id": event.event_id,
            "event_type": event.event_type,
            "timestamp": datetime.now().isoformat(),
        }
    )
    expected_amount = get_plan_price(event.plan)

    if event.event_type == "payment.success":
        if event.amount != expected_amount:
            raise ValueError(
                f"Webhook amount mismatch for {event.plan}: got {event.amount}, "
                f"expected {expected_amount}"
            )
        period_start = datetime.now().isoformat()
        period_end = (datetime.now() + timedelta(days=30)).isoformat()

        _subscriptions[event.user_id] = {
            "user_id": event.user_id,
            "plan": event.plan,
            "status": "active",
            "current_period_start": period_start,
            "current_period_end": period_end,
            "amount_per_month": event.amount,
            "updated_at": datetime.now().isoformat(),
        }
        _processed_webhooks.add(event.event_id)
        logger.info("Payment success for user %s, activated %s", event.user_id, event.plan)
        return "processed"

    if event.event_type == "payment.failed":
        if event.user_id in _subscriptions:
            _subscriptions[event.user_id]["status"] = "past_due"
        _processed_webhooks.add(event.event_id)
        logger.warning("Payment failed for user %s", event.user_id)
        return "processed"

    if event.event_type == "subscription.canceled":
        if event.user_id in _subscriptions:
            _subscriptions[event.user_id]["status"] = "canceled"
        _processed_webhooks.add(event.event_id)
        logger.info("Subscription canceled for user %s", event.user_id)
        return "processed"

    logger.warning("Unknown webhook event type: %s", event.event_type)
    return "skipped"


def get_subscription(user_id: str) -> SubscriptionInfo:
    """Get current subscription for user.

    Args:
        user_id: User ID to look up

    Returns:
        SubscriptionInfo with current subscription details
    """
    if user_id not in _subscriptions:
        return SubscriptionInfo(
            user_id=user_id,
            plan=PlanType.FREE,
            status="active",
            current_period_start=datetime.now().isoformat(),
            current_period_end=(datetime.now() + timedelta(days=30)).isoformat(),
            amount_per_month=0,
        )

    sub = _subscriptions[user_id]
    return SubscriptionInfo(**sub)


def cancel_subscription(user_id: str) -> bool:
    """Cancel user subscription.

    Args:
        user_id: User ID to cancel

    Returns:
        True if cancellation was successful
    """
    if user_id in _subscriptions:
        _subscriptions[user_id]["status"] = "canceled"
        logger.info("Subscription canceled for user %s", user_id)
        return True
    logger.warning("No active subscription found for user %s", user_id)
    return False
