"""FinSavvyAI Landing Page Module

Public APIs for landing page: features, testimonials, pricing.
"""

from src.landing.data import FEATURES, PRICING_TIERS, TESTIMONIALS
from src.landing.routes import router

__all__ = ["router", "FEATURES", "TESTIMONIALS", "PRICING_TIERS"]
