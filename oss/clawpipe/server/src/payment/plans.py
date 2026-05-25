"""Payment plan definitions."""

from src.payment.models import PlanType

# Plan pricing in cents USD
PLANS = {
    PlanType.FREE: {
        "name": "Free",
        "price": 0,
        "currency": "usd",
        "billing_period": "month",
        "features": [
            "5 financial analyses per month",
            "Basic portfolio tracking",
            "Email support",
        ],
    },
    PlanType.PRO: {
        "name": "Pro",
        "price": 9999,  # $99.99/month
        "currency": "usd",
        "billing_period": "month",
        "features": [
            "Unlimited financial analyses",
            "Advanced portfolio optimization",
            "Real-time market alerts",
            "Priority email support",
            "API access",
        ],
    },
    PlanType.ENTERPRISE: {
        "name": "Enterprise",
        "price": 29999,  # $299.99/month
        "currency": "usd",
        "billing_period": "month",
        "features": [
            "Unlimited everything",
            "Custom integrations",
            "Dedicated account manager",
            "24/7 phone support",
            "Custom AI models",
            "SLA guarantee",
        ],
    },
}


def get_plan(plan_type: PlanType) -> dict:
    """Get plan details by type."""
    return PLANS.get(plan_type, {})


def get_plan_price(plan_type: PlanType) -> int:
    """Get price in cents for a plan."""
    return get_plan(plan_type).get("price", 0)
