"""Landing page API routes."""

from fastapi import APIRouter, HTTPException, status

from src.landing.data import FEATURES, PRICING_TIERS, TESTIMONIALS

router = APIRouter(prefix="/api", tags=["landing"])


@router.get("/features")
async def get_features():
    """Get list of product features for landing page.

    GET /api/features
    """
    return {"features": FEATURES, "total": len(FEATURES)}


@router.get("/features/{feature_id}")
async def get_feature(feature_id: str):
    """Get details of a specific feature.

    GET /api/features/{feature_id}
    """
    for feature in FEATURES:
        if feature["id"] == feature_id:
            return feature
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feature not found")


@router.get("/testimonials")
async def get_testimonials():
    """Get customer testimonials for landing page.

    GET /api/testimonials
    """
    return {"testimonials": TESTIMONIALS, "total": len(TESTIMONIALS)}


@router.get("/testimonials/{testimonial_id}")
async def get_testimonial(testimonial_id: str):
    """Get a specific testimonial.

    GET /api/testimonials/{testimonial_id}
    """
    for testimonial in TESTIMONIALS:
        if testimonial["id"] == testimonial_id:
            return testimonial
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Testimonial not found")


@router.get("/pricing")
async def get_pricing():
    """Get pricing tiers for landing page.

    GET /api/pricing
    """
    return {"tiers": PRICING_TIERS, "total": len(PRICING_TIERS)}


@router.get("/pricing/{tier_id}")
async def get_pricing_tier(tier_id: str):
    """Get details of a specific pricing tier.

    GET /api/pricing/{tier_id}
    """
    for tier in PRICING_TIERS:
        if tier["id"] == tier_id:
            return tier
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Pricing tier not found"
    )
