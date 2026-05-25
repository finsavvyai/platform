"""Payment routes for checkout and webhook handling."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import ValidationError

from src.api.settings import get_settings
from src.auth.dependencies import get_current_user
from src.auth.models import User
from src.payment.models import (
    CheckoutRequest,
    CheckoutResponse,
    PlanType,
    SubscriptionInfo,
    WebhookEvent,
)
from src.payment.service import (
    cancel_subscription,
    create_checkout_session,
    get_subscription,
    handle_webhook,
)
from src.payment.webhooks import verify_webhook_signature

logger = logging.getLogger("finsavvyai.payment")

router = APIRouter(prefix="/api", tags=["payment"])


def _create_checkout_response(plan: PlanType, current_user: User) -> CheckoutResponse:
    """Create a checkout session for the authenticated user."""
    try:
        session_data = create_checkout_session(current_user.id, plan)
        return CheckoutResponse(**session_data)
    except Exception as exc:  # pragma: no cover - exercised via API tests
        logger.exception("Checkout failed for user %s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Checkout creation failed",
        ) from exc


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    request: CheckoutRequest,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CheckoutResponse:
    """Initiate payment checkout from a validated request body."""
    return _create_checkout_response(request.plan, current_user)


@router.post("/checkout/{plan}", response_model=CheckoutResponse)
async def checkout_by_path(
    plan: PlanType,
    current_user: Annotated[User, Depends(get_current_user)],
) -> CheckoutResponse:
    """Initiate payment checkout for a subscription plan.

    POST /api/checkout/{plan}
    Requires valid Bearer token.
    """
    return _create_checkout_response(plan, current_user)


@router.post("/webhooks/payment")
async def handle_payment_webhook(request: Request):
    """Handle payment provider webhook events.

    POST /api/webhooks/payment
    Webhook events: payment.success, payment.failed, etc.
    """
    payload = await request.body()
    settings = get_settings()
    signature = request.headers.get("X-Webhook-Signature") or request.headers.get(
        "Stripe-Signature"
    )
    signature_required = settings.is_production or bool(settings.payment_webhook_secret)
    if not verify_webhook_signature(
        payload,
        signature,
        settings.payment_webhook_secret,
        required=signature_required,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid payment webhook signature",
        )

    try:
        event = WebhookEvent.model_validate_json(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors())

    try:
        result = handle_webhook(event)
        return {"status": result, "event_id": event.event_id}
    except Exception as exc:
        logger.exception("Webhook processing error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed",
        ) from exc


@router.get("/subscription", response_model=SubscriptionInfo)
async def get_user_subscription(
    current_user: Annotated[User, Depends(get_current_user)],
) -> SubscriptionInfo:
    """Get current subscription info for authenticated user.

    GET /api/subscription
    """
    return get_subscription(current_user.id)


@router.post("/subscription/cancel")
async def cancel_user_subscription(current_user: Annotated[User, Depends(get_current_user)]):
    """Cancel user's subscription.

    POST /api/subscription/cancel
    """
    success = cancel_subscription(current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )
    return {"status": "canceled", "user_id": current_user.id}
