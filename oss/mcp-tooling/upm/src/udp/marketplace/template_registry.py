"""
Workflow Template Registry.

Manages storage, retrieval, and organization of workflow templates
in the marketplace database.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

from .models import (
    PricingModel,
    QualityTier,
    TemplateCategory,
    TemplatePurchase,
    WorkflowTemplate,
)

logger = logging.getLogger(__name__)

Base = declarative_base()


class TemplateModel(Base):
    """Database model for workflow templates."""
    __tablename__ = "workflow_templates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    creator_id = Column(String, nullable=False)
    creator_name = Column(String, nullable=False)
    version = Column(String, default="1.0.0")

    # Template content
    workflow_definition = Column(JSON, nullable=False)
    customization_points = Column(JSON, default=list)

    # Pricing and licensing
    pricing_model = Column(String, nullable=False)
    base_price = Column(Float, default=0.0)
    monthly_fee = Column(Float, default=0.0)
    per_execution_fee = Column(Float, default=0.0)
    setup_fee = Column(Float, default=0.0)

    # Quality and validation
    quality_tier = Column(String, default="community_contributed")
    validation_status = Column(String, default="pending")
    validation_results = Column(JSON)

    # Metadata
    tags = Column(JSON, default=list)
    documentation_url = Column(String)
    support_contact = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    # Usage statistics
    download_count = Column(Integer, default=0)
    purchase_count = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)

    # Compliance and security
    security_review_passed = Column(Boolean, default=False)
    compliance_frameworks = Column(JSON, default=list)


class PurchaseModel(Base):
    """Database model for template purchases."""
    __tablename__ = "template_purchases"

    id = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    organization_id = Column(String, nullable=False)
    purchaser_id = Column(String, nullable=False)

    # Purchase details
    pricing_model = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")

    # Customization
    customizations = Column(JSON, default=dict)
    installed_workflow_id = Column(String)

    # Transaction details
    purchase_date = Column(DateTime, default=datetime.utcnow)
    payment_status = Column(String, default="pending")
    payment_reference = Column(String)

    # Revenue sharing
    platform_fee = Column(Float, default=0.0)
    creator_revenue = Column(Float, default=0.0)


class ReviewModel(Base):
    """Database model for template reviews."""
    __tablename__ = "template_reviews"

    id = Column(String, primary_key=True)
    template_id = Column(String, nullable=False)
    organization_id = Column(String, nullable=False)
    reviewer_id = Column(String, nullable=False)
    reviewer_name = Column(String, nullable=False)

    rating = Column(Integer, nullable=False)  # 1-5 stars
    title = Column(String, nullable=False)
    review_text = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class WorkflowTemplateRegistry:
    """Registry for managing workflow templates and purchases."""

    def __init__(self, database_url: str = "sqlite:///marketplace.db"):
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self._create_tables()

    def _create_tables(self):
        """Create database tables if they don't exist."""
        Base.metadata.create_all(bind=self.engine)

    def _get_session(self) -> Session:
        """Get database session."""
        return self.SessionLocal()

    async def store_template(self, template: WorkflowTemplate, creator) -> str:
        """Store a workflow template in the registry."""
        try:
            session = self._get_session()

            # Convert template to database model
            template_model = TemplateModel(
                id=template.id,
                name=template.name,
                description=template.description,
                category=template.category.value,
                creator_id=str(template.creator_id),
                creator_name=template.creator_name,
                version=template.version,
                workflow_definition=template.workflow_definition,
                customization_points=[cp.dict() for cp in template.customization_points],
                pricing_model=template.pricing_model.value,
                base_price=template.base_price,
                monthly_fee=template.monthly_fee,
                per_execution_fee=template.per_execution_fee,
                setup_fee=template.setup_fee,
                quality_tier=template.quality_tier.value,
                validation_status=template.validation_status,
                validation_results=template.validation_results,
                tags=template.tags,
                documentation_url=template.documentation_url,
                support_contact=template.support_contact,
                created_at=template.created_at,
                updated_at=template.updated_at,
                download_count=template.download_count,
                purchase_count=template.purchase_count,
                rating=template.rating,
                review_count=template.review_count,
                security_review_passed=template.security_review_passed,
                compliance_frameworks=template.compliance_frameworks
            )

            session.add(template_model)
            session.commit()
            session.close()

            logger.info(f"Stored template: {template.id}")
            return template.id

        except Exception as e:
            logger.error(f"Failed to store template: {e}", exc_info=True)
            raise

    async def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        """Get a workflow template by ID."""
        try:
            session = self._get_session()

            template_model = session.query(TemplateModel).filter(
                TemplateModel.id == template_id
            ).first()

            if not template_model:
                return None

            # Convert to WorkflowTemplate
            template = WorkflowTemplate(
                id=template_model.id,
                name=template_model.name,
                description=template_model.description,
                category=TemplateCategory(template_model.category),
                creator_id=UUID(template_model.creator_id),
                creator_name=template_model.creator_name,
                version=template_model.version,
                workflow_definition=template_model.workflow_definition,
                customization_points=[
                    CustomizationPoint(**cp) for cp in template_model.customization_points
                ],
                pricing_model=PricingModel(template_model.pricing_model),
                base_price=template_model.base_price,
                monthly_fee=template_model.monthly_fee,
                per_execution_fee=template_model.per_execution_fee,
                setup_fee=template_model.setup_fee,
                quality_tier=QualityTier(template_model.quality_tier),
                validation_status=template_model.validation_status,
                validation_results=template_model.validation_results,
                tags=template_model.tags,
                documentation_url=template_model.documentation_url,
                support_contact=template_model.support_contact,
                created_at=template_model.created_at,
                updated_at=template_model.updated_at,
                download_count=template_model.download_count,
                purchase_count=template_model.purchase_count,
                rating=template_model.rating,
                review_count=template_model.review_count,
                security_review_passed=template_model.security_review_passed,
                compliance_frameworks=template_model.compliance_frameworks
            )

            session.close()
            return template

        except Exception as e:
            logger.error(f"Failed to get template {template_id}: {e}", exc_info=True)
            return None

    async def browse_templates(
        self,
        category: Optional[TemplateCategory] = None,
        quality_tier: Optional[QualityTier] = None,
        pricing_model: Optional[PricingModel] = None,
        search_query: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> list[WorkflowTemplate]:
        """Browse templates with filtering and pagination."""
        try:
            session = self._get_session()

            query = session.query(TemplateModel).filter(
                TemplateModel.validation_status == "validated"
            )

            # Apply filters
            if category:
                query = query.filter(TemplateModel.category == category.value)

            if quality_tier:
                query = query.filter(TemplateModel.quality_tier == quality_tier.value)

            if pricing_model:
                query = query.filter(TemplateModel.pricing_model == pricing_model.value)

            if search_query:
                query = query.filter(
                    TemplateModel.name.ilike(f"%{search_query}%") |
                    TemplateModel.description.ilike(f"%{search_query}%")
                )

            # Apply pagination and ordering
            templates = query.order_by(
                TemplateModel.rating.desc(),
                TemplateModel.purchase_count.desc()
            ).offset(offset).limit(limit).all()

            # Convert to WorkflowTemplate objects
            result = []
            for template_model in templates:
                template = await self._model_to_template(template_model)
                if template:
                    result.append(template)

            session.close()
            return result

        except Exception as e:
            logger.error(f"Failed to browse templates: {e}", exc_info=True)
            return []

    async def store_purchase(self, purchase: TemplatePurchase):
        """Store a template purchase record."""
        try:
            session = self._get_session()

            purchase_model = PurchaseModel(
                id=purchase.id,
                template_id=purchase.template_id,
                organization_id=str(purchase.organization_id),
                purchaser_id=str(purchase.purchaser_id),
                pricing_model=purchase.pricing_model.value,
                total_amount=purchase.total_amount,
                currency=purchase.currency,
                customizations=purchase.customizations,
                installed_workflow_id=purchase.installed_workflow_id,
                purchase_date=purchase.purchase_date,
                payment_status=purchase.payment_status,
                payment_reference=purchase.payment_reference,
                platform_fee=purchase.platform_fee,
                creator_revenue=purchase.creator_revenue
            )

            session.add(purchase_model)
            session.commit()
            session.close()

            logger.info(f"Stored purchase: {purchase.id}")

        except Exception as e:
            logger.error(f"Failed to store purchase: {e}", exc_info=True)
            raise

    async def get_organization_purchase(
        self,
        template_id: str,
        organization_id: UUID
    ) -> Optional[TemplatePurchase]:
        """Get purchase record for organization and template."""
        try:
            session = self._get_session()

            purchase_model = session.query(PurchaseModel).filter(
                PurchaseModel.template_id == template_id,
                PurchaseModel.organization_id == str(organization_id),
                PurchaseModel.payment_status == "completed"
            ).first()

            if not purchase_model:
                return None

            purchase = TemplatePurchase(
                id=purchase_model.id,
                template_id=purchase_model.template_id,
                organization_id=UUID(purchase_model.organization_id),
                purchaser_id=UUID(purchase_model.purchaser_id),
                pricing_model=PricingModel(purchase_model.pricing_model),
                total_amount=purchase_model.total_amount,
                currency=purchase_model.currency,
                customizations=purchase_model.customizations,
                installed_workflow_id=purchase_model.installed_workflow_id,
                purchase_date=purchase_model.purchase_date,
                payment_status=purchase_model.payment_status,
                payment_reference=purchase_model.payment_reference,
                platform_fee=purchase_model.platform_fee,
                creator_revenue=purchase_model.creator_revenue
            )

            session.close()
            return purchase

        except Exception as e:
            logger.error(f"Failed to get organization purchase: {e}", exc_info=True)
            return None

    async def update_template_stats(self, template_id: str, stat_type: str):
        """Update template statistics."""
        try:
            session = self._get_session()

            template = session.query(TemplateModel).filter(
                TemplateModel.id == template_id
            ).first()

            if template:
                if stat_type == "download":
                    template.download_count += 1
                elif stat_type == "purchase":
                    template.purchase_count += 1

                template.updated_at = datetime.utcnow()
                session.commit()

            session.close()

        except Exception as e:
            logger.error(f"Failed to update template stats: {e}", exc_info=True)

    async def get_template_reviews(self, template_id: str) -> list[dict[str, Any]]:
        """Get reviews for a template."""
        try:
            session = self._get_session()

            reviews = session.query(ReviewModel).filter(
                ReviewModel.template_id == template_id
            ).order_by(ReviewModel.created_at.desc()).all()

            result = []
            for review in reviews:
                result.append({
                    "id": review.id,
                    "reviewer_name": review.reviewer_name,
                    "rating": review.rating,
                    "title": review.title,
                    "review_text": review.review_text,
                    "created_at": review.created_at.isoformat()
                })

            session.close()
            return result

        except Exception as e:
            logger.error(f"Failed to get template reviews: {e}", exc_info=True)
            return []

    async def get_template_statistics(self, template_id: str) -> dict[str, Any]:
        """Get usage statistics for a template."""
        try:
            session = self._get_session()

            template = session.query(TemplateModel).filter(
                TemplateModel.id == template_id
            ).first()

            if not template:
                return {}

            # Get purchase statistics
            purchases = session.query(PurchaseModel).filter(
                PurchaseModel.template_id == template_id,
                PurchaseModel.payment_status == "completed"
            ).all()

            total_revenue = sum(p.total_amount for p in purchases)
            monthly_revenue = sum(
                p.total_amount for p in purchases
                if p.purchase_date >= datetime.utcnow() - timedelta(days=30)
            )

            session.close()

            return {
                "download_count": template.download_count,
                "purchase_count": template.purchase_count,
                "rating": template.rating,
                "review_count": template.review_count,
                "total_revenue": total_revenue,
                "monthly_revenue": monthly_revenue,
                "created_at": template.created_at.isoformat(),
                "updated_at": template.updated_at.isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to get template statistics: {e}", exc_info=True)
            return {}

    async def _model_to_template(self, template_model: TemplateModel) -> Optional[WorkflowTemplate]:
        """Convert database model to WorkflowTemplate."""
        try:
            return WorkflowTemplate(
                id=template_model.id,
                name=template_model.name,
                description=template_model.description,
                category=TemplateCategory(template_model.category),
                creator_id=UUID(template_model.creator_id),
                creator_name=template_model.creator_name,
                version=template_model.version,
                workflow_definition=template_model.workflow_definition,
                customization_points=[
                    CustomizationPoint(**cp) for cp in template_model.customization_points
                ],
                pricing_model=PricingModel(template_model.pricing_model),
                base_price=template_model.base_price,
                monthly_fee=template_model.monthly_fee,
                per_execution_fee=template_model.per_execution_fee,
                setup_fee=template_model.setup_fee,
                quality_tier=QualityTier(template_model.quality_tier),
                validation_status=template_model.validation_status,
                validation_results=template_model.validation_results,
                tags=template_model.tags,
                documentation_url=template_model.documentation_url,
                support_contact=template_model.support_contact,
                created_at=template_model.created_at,
                updated_at=template_model.updated_at,
                download_count=template_model.download_count,
                purchase_count=template_model.purchase_count,
                rating=template_model.rating,
                review_count=template_model.review_count,
                security_review_passed=template_model.security_review_passed,
                compliance_frameworks=template_model.compliance_frameworks
            )
        except Exception as e:
            logger.error(f"Failed to convert model to template: {e}", exc_info=True)
            return None


# Singleton instance
template_registry = WorkflowTemplateRegistry()
