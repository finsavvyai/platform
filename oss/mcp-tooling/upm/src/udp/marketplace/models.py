"""
Marketplace Models.

Pydantic models for workflow marketplace functionality.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TemplateCategory(str, Enum):
    """Categories for workflow templates."""
    SECURITY_COMPLIANCE = "security_compliance"
    FINTECH_REGULATIONS = "fintech_regulations"
    HEALTHCARE_HIPAA = "healthcare_hipaa"
    MANUFACTURING_QUALITY = "manufacturing_quality"
    ECOMMERCE_SCALING = "ecommerce_scaling"
    STARTUP_AGILE = "startup_agile"
    ENTERPRISE_GOVERNANCE = "enterprise_governance"
    DEVOPS_AUTOMATION = "devops_automation"
    CUSTOM = "custom"


class PricingModel(str, Enum):
    """Pricing models for workflow templates."""
    ONE_TIME_PURCHASE = "one_time_purchase"
    SUBSCRIPTION_MONTHLY = "subscription_monthly"
    USAGE_BASED = "usage_based"
    ENTERPRISE_LICENSE = "enterprise_license"
    FREE = "free"


class QualityTier(str, Enum):
    """Quality tiers for workflow templates."""
    COMMUNITY_CONTRIBUTED = "community_contributed"
    PARTNER_CERTIFIED = "partner_certified"
    ENTERPRISE_VALIDATED = "enterprise_validated"
    PLATFORM_OFFICIAL = "platform_official"


class CustomizationPoint(BaseModel):
    """Defines a point where organizations can customize a workflow template."""
    name: str
    description: str
    type: str  # "enum", "string", "boolean", "number", "multi_select"
    options: Optional[list[str]] = None
    default_value: Any = None
    required: bool = False
    validation_rules: Optional[dict[str, Any]] = None


class WorkflowTemplate(BaseModel):
    """Represents a workflow template in the marketplace."""
    id: str = Field(default_factory=lambda: str(UUID()))
    name: str
    description: str
    category: TemplateCategory
    creator_id: UUID
    creator_name: str
    version: str = "1.0.0"

    # Template content
    workflow_definition: dict[str, Any]  # LangGraph workflow definition
    customization_points: list[CustomizationPoint] = Field(default_factory=list)

    # Pricing and licensing
    pricing_model: PricingModel
    base_price: Optional[float] = None
    monthly_fee: Optional[float] = None
    per_execution_fee: Optional[float] = None
    setup_fee: Optional[float] = None

    # Quality and validation
    quality_tier: QualityTier = QualityTier.COMMUNITY_CONTRIBUTED
    validation_status: str = "pending"  # "pending", "validated", "rejected"
    validation_results: Optional[dict[str, Any]] = None

    # Metadata
    tags: list[str] = Field(default_factory=list)
    documentation_url: Optional[str] = None
    support_contact: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Usage statistics
    download_count: int = 0
    purchase_count: int = 0
    rating: float = 0.0
    review_count: int = 0

    # Compliance and security
    security_review_passed: bool = False
    compliance_frameworks: list[str] = Field(default_factory=list)

    class Config:
        use_enum_values = True


class TemplatePurchase(BaseModel):
    """Represents a template purchase transaction."""
    id: str = Field(default_factory=lambda: str(UUID()))
    template_id: str
    organization_id: UUID
    purchaser_id: UUID

    # Purchase details
    pricing_model: PricingModel
    total_amount: float
    currency: str = "USD"

    # Customization
    customizations: dict[str, Any] = Field(default_factory=dict)
    installed_workflow_id: Optional[str] = None

    # Transaction details
    purchase_date: datetime = Field(default_factory=datetime.utcnow)
    payment_status: str = "pending"  # "pending", "completed", "failed", "refunded"
    payment_reference: Optional[str] = None

    # Revenue sharing
    platform_fee: float = 0.0
    creator_revenue: float = 0.0
