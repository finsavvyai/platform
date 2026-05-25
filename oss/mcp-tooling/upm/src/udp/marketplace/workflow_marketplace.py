"""
Workflow Marketplace Infrastructure.

Implements the core marketplace functionality for workflow templates,
including publishing, purchasing, customization, and revenue sharing.
"""

import asyncio
import logging
from typing import Any, Optional
from uuid import uuid4

from udp.domain.models import Organization, User

from .models import (
    CustomizationPoint,
    PricingModel,
    QualityTier,
    TemplateCategory,
    TemplatePurchase,
    WorkflowTemplate,
)
from .revenue_manager import RevenueManager
from .template_registry import WorkflowTemplateRegistry
from .template_validation import TemplateValidator

logger = logging.getLogger(__name__)


class WorkflowMarketplace:
    """Core marketplace for workflow templates and customizations."""

    def __init__(self):
        self.template_registry = WorkflowTemplateRegistry()
        self.revenue_manager = RevenueManager()
        self.validator = TemplateValidator()
        self.platform_commission = 0.30  # 30% platform fee

    async def publish_template(
        self,
        template: WorkflowTemplate,
        creator: User
    ) -> dict[str, Any]:
        """
        Publish a new workflow template to the marketplace.

        Args:
            template: The workflow template to publish
            creator: The user creating the template

        Returns:
            Publication result with template ID and status
        """
        try:
            logger.info(f"Publishing template: {template.name} by {creator.email}")

            # Validate template
            validation_result = await self.validator.validate_template(template)
            if not validation_result.is_valid:
                return {
                    "status": "failed",
                    "error": "Template validation failed",
                    "validation_errors": validation_result.errors
                }

            # Security review
            security_review = await self.validator.conduct_security_review(template)
            if security_review.risk_level == "high":
                return {
                    "status": "failed",
                    "error": "Template failed security review",
                    "security_issues": security_review.issues
                }

            # Store template
            template_id = await self.template_registry.store_template(template, creator)

            # Update template with validation results
            template.id = template_id
            template.validation_status = "validated"
            template.validation_results = validation_result.details
            template.security_review_passed = security_review.risk_level != "high"

            logger.info(f"Template published successfully: {template_id}")

            return {
                "status": "success",
                "template_id": template_id,
                "validation_results": validation_result.details,
                "security_review": security_review.details
            }

        except Exception as e:
            logger.error(f"Template publication failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": f"Publication failed: {str(e)}"
            }

    async def purchase_template(
        self,
        template_id: str,
        organization: Organization,
        purchaser: User,
        customizations: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        """
        Purchase and install a workflow template for an organization.

        Args:
            template_id: ID of the template to purchase
            organization: Organization making the purchase
            purchaser: User making the purchase
            customizations: Optional customizations to apply

        Returns:
            Purchase result with installation details
        """
        try:
            logger.info(f"Purchasing template {template_id} for organization {organization.id}")

            # Get template
            template = await self.template_registry.get_template(template_id)
            if not template:
                return {
                    "status": "failed",
                    "error": "Template not found"
                }

            # Check if organization already has this template
            existing_purchase = await self.template_registry.get_organization_purchase(
                template_id, organization.id
            )
            if existing_purchase:
                return {
                    "status": "failed",
                    "error": "Organization already owns this template"
                }

            # Calculate pricing
            pricing = self._calculate_pricing(template, organization)

            # Process payment (mock implementation)
            payment_result = await self._process_payment(pricing, organization, purchaser)
            if not payment_result.success:
                return {
                    "status": "failed",
                    "error": f"Payment failed: {payment_result.error}"
                }

            # Create purchase record
            purchase = TemplatePurchase(
                template_id=template_id,
                organization_id=organization.id,
                purchaser_id=purchaser.id,
                pricing_model=template.pricing_model,
                total_amount=pricing["total_amount"],
                customizations=customizations or {},
                payment_status="completed",
                payment_reference=payment_result.reference
            )

            # Calculate revenue sharing
            platform_fee = pricing["total_amount"] * self.platform_commission
            creator_revenue = pricing["total_amount"] - platform_fee
            purchase.platform_fee = platform_fee
            purchase.creator_revenue = creator_revenue

            # Install template for organization
            installation_result = await self._install_template_for_organization(
                template, organization, customizations
            )

            if installation_result.success:
                purchase.installed_workflow_id = installation_result.workflow_id

                # Store purchase record
                await self.template_registry.store_purchase(purchase)

                # Update template statistics
                await self.template_registry.update_template_stats(template_id, "purchase")

                # Record revenue
                await self.revenue_manager.record_transaction(purchase)

                logger.info(f"Template purchase completed: {template_id}")

                return {
                    "status": "success",
                    "purchase_id": purchase.id,
                    "workflow_id": installation_result.workflow_id,
                    "total_amount": pricing["total_amount"],
                    "customization_options": template.customization_points
                }
            else:
                return {
                    "status": "failed",
                    "error": f"Installation failed: {installation_result.error}"
                }

        except Exception as e:
            logger.error(f"Template purchase failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": f"Purchase failed: {str(e)}"
            }

    async def browse_templates(
        self,
        category: Optional[TemplateCategory] = None,
        quality_tier: Optional[QualityTier] = None,
        pricing_model: Optional[PricingModel] = None,
        search_query: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> dict[str, Any]:
        """
        Browse available workflow templates with filtering.

        Args:
            category: Filter by template category
            quality_tier: Filter by quality tier
            pricing_model: Filter by pricing model
            search_query: Search in name and description
            limit: Maximum number of results
            offset: Number of results to skip

        Returns:
            List of matching templates with metadata
        """
        try:
            templates = await self.template_registry.browse_templates(
                category=category,
                quality_tier=quality_tier,
                pricing_model=pricing_model,
                search_query=search_query,
                limit=limit,
                offset=offset
            )

            return {
                "status": "success",
                "templates": [template.dict() for template in templates],
                "total_count": len(templates),
                "has_more": len(templates) == limit
            }

        except Exception as e:
            logger.error(f"Template browsing failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": f"Browsing failed: {str(e)}"
            }

    async def get_template_details(self, template_id: str) -> dict[str, Any]:
        """Get detailed information about a specific template."""
        try:
            template = await self.template_registry.get_template(template_id)
            if not template:
                return {
                    "status": "failed",
                    "error": "Template not found"
                }

            # Get reviews and ratings
            reviews = await self.template_registry.get_template_reviews(template_id)

            # Get usage statistics
            stats = await self.template_registry.get_template_statistics(template_id)

            return {
                "status": "success",
                "template": template.dict(),
                "reviews": reviews,
                "statistics": stats
            }

        except Exception as e:
            logger.error(f"Failed to get template details: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": f"Failed to get template details: {str(e)}"
            }

    def _calculate_pricing(
        self,
        template: WorkflowTemplate,
        organization: Organization
    ) -> dict[str, Any]:
        """Calculate pricing for a template purchase."""

        base_price = template.base_price or 0.0
        monthly_fee = template.monthly_fee or 0.0
        per_execution_fee = template.per_execution_fee or 0.0
        setup_fee = template.setup_fee or 0.0

        # Apply organization-specific discounts
        discount_multiplier = 1.0
        if organization.tier == "enterprise":
            discount_multiplier = 0.8  # 20% discount for enterprise
        elif organization.tier == "premium":
            discount_multiplier = 0.9  # 10% discount for premium

        total_amount = (base_price + setup_fee) * discount_multiplier

        return {
            "base_price": base_price,
            "monthly_fee": monthly_fee,
            "per_execution_fee": per_execution_fee,
            "setup_fee": setup_fee,
            "discount_multiplier": discount_multiplier,
            "total_amount": total_amount
        }

    async def _process_payment(
        self,
        pricing: dict[str, Any],
        organization: Organization,
        purchaser: User
    ) -> dict[str, Any]:
        """Process payment for template purchase (mock implementation)."""

        # In production, this would integrate with payment processors like Stripe
        # For now, we'll simulate successful payment

        if pricing["total_amount"] == 0:
            return {
                "success": True,
                "reference": f"FREE_{uuid4().hex[:8]}"
            }

        # Mock payment processing
        await asyncio.sleep(0.1)  # Simulate payment processing time

        return {
            "success": True,
            "reference": f"PAY_{uuid4().hex[:8]}",
            "amount": pricing["total_amount"]
        }

    async def _install_template_for_organization(
        self,
        template: WorkflowTemplate,
        organization: Organization,
        customizations: Optional[dict[str, Any]]
    ) -> dict[str, Any]:
        """Install a template for an organization with customizations."""

        try:
            # Apply customizations to workflow definition
            customized_workflow = self._apply_customizations(
                template.workflow_definition,
                template.customization_points,
                customizations or {}
            )

            # Create workflow instance for organization
            workflow_id = str(uuid4())

            # In production, this would:
            # 1. Deploy the customized workflow to the organization's environment
            # 2. Set up monitoring and logging
            # 3. Configure access controls
            # 4. Set up billing for usage-based pricing

            logger.info(f"Installed template {template.id} as workflow {workflow_id}")

            return {
                "success": True,
                "workflow_id": workflow_id,
                "customizations_applied": customizations or {}
            }

        except Exception as e:
            logger.error(f"Template installation failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e)
            }

    def _apply_customizations(
        self,
        workflow_definition: dict[str, Any],
        customization_points: list[CustomizationPoint],
        customizations: dict[str, Any]
    ) -> dict[str, Any]:
        """Apply customizations to a workflow definition."""

        customized_workflow = workflow_definition.copy()

        for point in customization_points:
            if point.name in customizations:
                value = customizations[point.name]

                # Apply customization based on type
                if point.type == "enum":
                    if value in (point.options or []):
                        customized_workflow[point.name] = value
                elif point.type == "boolean":
                    customized_workflow[point.name] = bool(value)
                elif point.type == "number":
                    customized_workflow[point.name] = float(value)
                elif point.type == "string":
                    customized_workflow[point.name] = str(value)
                elif point.type == "multi_select":
                    if isinstance(value, list):
                        customized_workflow[point.name] = value

        return customized_workflow


# Singleton instance
workflow_marketplace = WorkflowMarketplace()
