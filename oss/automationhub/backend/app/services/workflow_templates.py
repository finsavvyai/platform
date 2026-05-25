"""
Workflow Templates Service

Provides comprehensive workflow template management including:
- Template creation, versioning, and management
- Component library system with reusable components
- Template marketplace with public and private templates
- Custom component development and deployment
- Template instantiation and deployment automation
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Union
from uuid import UUID, uuid4
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func
from sqlalchemy.orm import selectinload

from app.models.workflow import (
    Workflow, WorkflowTemplate, WorkflowComponent,
    ComponentCategory, TemplateVersion, TemplateRating,
    User, ComponentType, TemplateStatus, ComponentStatus
)
from app.schemas.workflow import (
    WorkflowTemplateCreate, WorkflowTemplateUpdate,
    WorkflowComponentCreate, WorkflowComponentUpdate,
    TemplateVersionCreate, TemplateInstantiateRequest
)
from app.core.exceptions import ValidationError, NotFoundError, ConflictError
from app.services.workflow_executor import WorkflowExecutor
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class TemplateSearchFilters(BaseModel):
    """Filters for template search."""
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    difficulty_level: Optional[str] = None
    component_types: Optional[List[str]] = None
    rating_min: Optional[float] = None
    is_public: Optional[bool] = None
    created_by: Optional[UUID] = None
    featured: Optional[bool] = None


class ComponentSearchFilters(BaseModel):
    """Filters for component search."""
    category: Optional[str] = None
    component_type: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    is_public: Optional[bool] = None


class TemplateValidationResult(BaseModel):
    """Result of template validation."""
    is_valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    suggestions: List[str] = []
    complexity_score: Optional[float] = None
    estimated_runtime: Optional[str] = None


class WorkflowTemplatesService:
    """Service for managing workflow templates and components."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.executor = WorkflowExecutor()

    async def create_template(
        self,
        template_data: WorkflowTemplateCreate,
        user_id: UUID
    ) -> WorkflowTemplate:
        """Create a new workflow template."""
        try:
            # Validate template structure
            validation_result = await self._validate_template_structure(
                template_data.definition
            )
            if not validation_result.is_valid:
                raise ValidationError(
                    f"Template validation failed: {', '.join(validation_result.errors)}"
                )

            # Create template
            template = WorkflowTemplate(
                id=uuid4(),
                name=template_data.name,
                description=template_data.description,
                definition=template_data.definition,
                category=template_data.category,
                tags=template_data.tags or [],
                difficulty_level=template_data.difficulty_level,
                estimated_runtime=template_data.estimated_runtime,
                is_public=template_data.is_public,
                is_featured=False,
                status=TemplateStatus.DRAFT,
                version="1.0.0",
                created_by=user_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

            self.db.add(template)
            await self.db.commit()
            await self.db.refresh(template)

            # Create initial version
            await self._create_template_version(
                template.id,
                template.version,
                template.definition,
                "Initial version",
                user_id
            )

            logger.info(f"Created workflow template: {template.id}")
            return template

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create template: {e}")
            raise

    async def update_template(
        self,
        template_id: UUID,
        template_data: WorkflowTemplateUpdate,
        user_id: UUID
    ) -> WorkflowTemplate:
        """Update an existing workflow template."""
        try:
            # Get template
            result = await self.db.execute(
                select(WorkflowTemplate).where(
                    and_(
                        WorkflowTemplate.id == template_id,
                        WorkflowTemplate.created_by == user_id
                    )
                )
            )
            template = result.scalar_one_or_none()

            if not template:
                raise NotFoundError("Template not found")

            # Validate updated structure
            if template_data.definition:
                validation_result = await self._validate_template_structure(
                    template_data.definition
                )
                if not validation_result.is_valid:
                    raise ValidationError(
                        f"Template validation failed: {', '.join(validation_result.errors)}"
                    )

            # Check if this is a breaking change requiring new version
            should_bump_version = (
                template_data.definition and
                template_data.definition != template.definition
            )

            # Update template
            update_data = template_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                if hasattr(template, field):
                    setattr(template, field, value)

            template.updated_at = datetime.now(timezone.utc)

            if should_bump_version:
                template.version = self._bump_version(template.version, "minor")

            self.db.add(template)
            await self.db.commit()
            await self.db.refresh(template)

            # Create new version if definition changed
            if should_bump_version:
                await self._create_template_version(
                    template.id,
                    template.version,
                    template.definition,
                    f"Updated to version {template.version}",
                    user_id
                )

            logger.info(f"Updated workflow template: {template_id}")
            return template

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update template: {e}")
            raise

    async def get_template(
        self,
        template_id: UUID,
        user_id: Optional[UUID] = None
    ) -> WorkflowTemplate:
        """Get workflow template by ID."""
        query = select(WorkflowTemplate).where(WorkflowTemplate.id == template_id)

        # If not owner, only return public templates
        if user_id:
            query = query.where(
                or_(
                    WorkflowTemplate.created_by == user_id,
                    WorkflowTemplate.is_public == True
                )
            )
        else:
            query = query.where(WorkflowTemplate.is_public == True)

        result = await self.db.execute(query)
        template = result.scalar_one_or_none()

        if not template:
            raise NotFoundError("Template not found")

        return template

    async def list_templates(
        self,
        user_id: Optional[UUID] = None,
        filters: Optional[TemplateSearchFilters] = None,
        skip: int = 0,
        limit: int = 50,
        sort_by: str = "created_at",
        sort_desc: bool = True
    ) -> tuple[List[WorkflowTemplate], int]:
        """List workflow templates with filters and pagination."""
        # Build query
        query = select(WorkflowTemplate).options(
            selectinload(WorkflowTemplate.created_by_user)
        )
        count_query = select(func.count(WorkflowTemplate.id))

        # Apply filters
        where_conditions = []

        if user_id:
            # Show user's templates and public templates
            where_conditions.append(
                or_(
                    WorkflowTemplate.created_by == user_id,
                    WorkflowTemplate.is_public == True
                )
            )
        else:
            # Only show public templates
            where_conditions.append(WorkflowTemplate.is_public == True)

        if filters:
            if filters.category:
                where_conditions.append(WorkflowTemplate.category == filters.category)
            if filters.tags:
                where_conditions.append(
                    WorkflowTemplate.tags.overlap(filters.tags)
                )
            if filters.difficulty_level:
                where_conditions.append(
                    WorkflowTemplate.difficulty_level == filters.difficulty_level
                )
            if filters.is_public is not None:
                where_conditions.append(WorkflowTemplate.is_public == filters.is_public)
            if filters.created_by:
                where_conditions.append(WorkflowTemplate.created_by == filters.created_by)
            if filters.featured is not None:
                where_conditions.append(WorkflowTemplate.is_featured == filters.featured)

        if where_conditions:
            query = query.where(and_(*where_conditions))
            count_query = count_query.where(and_(*where_conditions))

        # Apply sorting
        sort_column = getattr(WorkflowTemplate, sort_by, WorkflowTemplate.created_at)
        if sort_desc:
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Execute queries
        result = await self.db.execute(query)
        templates = result.scalars().all()

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        return list(templates), total

    async def delete_template(self, template_id: UUID, user_id: UUID) -> bool:
        """Delete a workflow template."""
        try:
            # Check ownership
            result = await self.db.execute(
                select(WorkflowTemplate).where(
                    and_(
                        WorkflowTemplate.id == template_id,
                        WorkflowTemplate.created_by == user_id
                    )
                )
            )
            template = result.scalar_one_or_none()

            if not template:
                raise NotFoundError("Template not found")

            # Check if template is in use
            usage_count = await self._check_template_usage(template_id)
            if usage_count > 0:
                raise ConflictError(
                    f"Template cannot be deleted - it is used by {usage_count} workflows"
                )

            # Delete template (cascade will handle related records)
            await self.db.delete(template)
            await self.db.commit()

            logger.info(f"Deleted workflow template: {template_id}")
            return True

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to delete template: {e}")
            raise

    async def create_component(
        self,
        component_data: WorkflowComponentCreate,
        user_id: UUID
    ) -> WorkflowComponent:
        """Create a new reusable workflow component."""
        try:
            # Validate component definition
            validation_result = await self._validate_component_structure(
                component_data.definition
            )
            if not validation_result.is_valid:
                raise ValidationError(
                    f"Component validation failed: {', '.join(validation_result.errors)}"
                )

            # Create component
            component = WorkflowComponent(
                id=uuid4(),
                name=component_data.name,
                description=component_data.description,
                component_type=component_data.component_type,
                category=component_data.category,
                definition=component_data.definition,
                input_schema=component_data.input_schema,
                output_schema=component_data.output_schema,
                tags=component_data.tags or [],
                is_public=component_data.is_public,
                status=ComponentStatus.ACTIVE,
                created_by=user_id,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

            self.db.add(component)
            await self.db.commit()
            await self.db.refresh(component)

            logger.info(f"Created workflow component: {component.id}")
            return component

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create component: {e}")
            raise

    async def list_components(
        self,
        user_id: Optional[UUID] = None,
        filters: Optional[ComponentSearchFilters] = None,
        skip: int = 0,
        limit: int = 50
    ) -> tuple[List[WorkflowComponent], int]:
        """List workflow components."""
        query = select(WorkflowComponent).options(
            selectinload(WorkflowComponent.created_by_user)
        )
        count_query = select(func.count(WorkflowComponent.id))

        # Apply filters
        where_conditions = []

        if user_id:
            where_conditions.append(
                or_(
                    WorkflowComponent.created_by == user_id,
                    WorkflowComponent.is_public == True
                )
            )
        else:
            where_conditions.append(WorkflowComponent.is_public == True)

        if filters:
            if filters.category:
                where_conditions.append(WorkflowComponent.category == filters.category)
            if filters.component_type:
                where_conditions.append(
                    WorkflowComponent.component_type == filters.component_type
                )
            if filters.tags:
                where_conditions.append(
                    WorkflowComponent.tags.overlap(filters.tags)
                )
            if filters.status:
                where_conditions.append(WorkflowComponent.status == filters.status)
            if filters.is_public is not None:
                where_conditions.append(WorkflowComponent.is_public == filters.is_public)

        if where_conditions:
            query = query.where(and_(*where_conditions))
            count_query = count_query.where(and_(*where_conditions))

        # Apply pagination and sorting
        query = query.order_by(WorkflowComponent.name).offset(skip).limit(limit)

        result = await self.db.execute(query)
        components = result.scalars().all()

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        return list(components), total

    async def instantiate_template(
        self,
        template_id: UUID,
        instantiate_request: TemplateInstantiateRequest,
        user_id: UUID
    ) -> Workflow:
        """Create a workflow from a template."""
        try:
            # Get template
            template = await self.get_template(template_id, user_id)

            # Validate template definition
            validation_result = await self._validate_template_structure(
                template.definition
            )
            if not validation_result.is_valid:
                raise ValidationError(
                    f"Template validation failed: {', '.join(validation_result.errors)}"
                )

            # Process template variables with provided values
            processed_definition = await self._process_template_variables(
                template.definition,
                instantiate_request.variable_values or {}
            )

            # Create workflow from processed definition
            workflow = Workflow(
                id=uuid4(),
                name=instantiate_request.name or f"{template.name} - Instance",
                description=instantiate_request.description or template.description,
                definition=processed_definition,
                owner_id=user_id,
                status="draft",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )

            self.db.add(workflow)
            await self.db.commit()
            await self.db.refresh(workflow)

            # Record template usage
            await self._record_template_usage(template_id, user_id)

            logger.info(f"Instantiated template {template_id} as workflow {workflow.id}")
            return workflow

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to instantiate template: {e}")
            raise

    async def rate_template(
        self,
        template_id: UUID,
        rating: int,
        review: Optional[str] = None,
        user_id: UUID
    ) -> TemplateRating:
        """Rate a workflow template."""
        try:
            # Check if user has access to template
            await self.get_template(template_id, user_id)

            # Check if user already rated
            result = await self.db.execute(
                select(TemplateRating).where(
                    and_(
                        TemplateRating.template_id == template_id,
                        TemplateRating.user_id == user_id
                    )
                )
            )
            existing_rating = result.scalar_one_or_none()

            if existing_rating:
                # Update existing rating
                existing_rating.rating = rating
                existing_rating.review = review
                existing_rating.updated_at = datetime.now(timezone.utc)
                template_rating = existing_rating
            else:
                # Create new rating
                template_rating = TemplateRating(
                    id=uuid4(),
                    template_id=template_id,
                    user_id=user_id,
                    rating=rating,
                    review=review,
                    created_at=datetime.now(timezone.utc)
                )
                self.db.add(template_rating)

            await self.db.commit()
            await self.db.refresh(template_rating)

            # Update template's average rating
            await self._update_template_rating(template_id)

            logger.info(f"Rated template {template_id} with {rating} stars by user {user_id}")
            return template_rating

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to rate template: {e}")
            raise

    async def get_template_categories(self) -> List[ComponentCategory]:
        """Get all template categories."""
        result = await self.db.execute(
            select(ComponentCategory).where(
                ComponentCategory.is_active == True
            ).order_by(ComponentCategory.name)
        )
        return list(result.scalars().all())

    async def get_component_categories(self) -> List[ComponentCategory]:
        """Get all component categories."""
        result = await self.db.execute(
            select(ComponentCategory).where(
                and_(
                    ComponentCategory.is_active == True,
                    ComponentCategory.applies_to_components == True
                )
            ).order_by(ComponentCategory.name)
        )
        return list(result.scalars().all())

    async def get_featured_templates(self, limit: int = 10) -> List[WorkflowTemplate]:
        """Get featured workflow templates."""
        result = await self.db.execute(
            select(WorkflowTemplate)
            .options(selectinload(WorkflowTemplate.created_by_user))
            .where(
                and_(
                    WorkflowTemplate.is_featured == True,
                    WorkflowTemplate.is_public == True,
                    WorkflowTemplate.status == TemplateStatus.PUBLISHED
                )
            )
            .order_by(WorkflowTemplate.rating.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_template_versions(self, template_id: UUID) -> List[TemplateVersion]:
        """Get all versions of a template."""
        result = await self.db.execute(
            select(TemplateVersion)
            .where(TemplateVersion.template_id == template_id)
            .order_by(TemplateVersion.version.desc())
        )
        return list(result.scalars().all())

    async def search_templates(
        self,
        query: str,
        user_id: Optional[UUID] = None,
        limit: int = 20
    ) -> List[WorkflowTemplate]:
        """Search templates by text query."""
        # Simple text search - in production, consider using full-text search
        search_pattern = f"%{query.lower()}%"

        db_query = select(WorkflowTemplate).options(
            selectinload(WorkflowTemplate.created_by_user)
        ).where(
            and_(
                WorkflowTemplate.is_public == True,
                or_(
                    func.lower(WorkflowTemplate.name).ilike(search_pattern),
                    func.lower(WorkflowTemplate.description).ilike(search_pattern),
                    WorkflowTemplate.tags.any(func.lower(WorkflowTemplate.tags).contains(query.lower()))
                )
            )
        ).order_by(WorkflowTemplate.rating.desc()).limit(limit)

        result = await self.db.execute(db_query)
        return list(result.scalars().all())

    async def _validate_template_structure(
        self,
        definition: Dict[str, Any]
    ) -> TemplateValidationResult:
        """Validate workflow template structure."""
        errors = []
        warnings = []
        suggestions = []

        try:
            # Basic structure validation
            if not isinstance(definition, dict):
                return TemplateValidationResult(
                    is_valid=False,
                    errors=["Template definition must be a dictionary"]
                )

            # Check required fields
            if "nodes" not in definition:
                errors.append("Template must contain 'nodes' field")
            elif not isinstance(definition["nodes"], list):
                errors.append("Template 'nodes' must be a list")
            elif len(definition["nodes"]) == 0:
                errors.append("Template must contain at least one node")

            # Check for required node fields
            if "nodes" in definition:
                for i, node in enumerate(definition["nodes"]):
                    if not isinstance(node, dict):
                        errors.append(f"Node {i} must be a dictionary")
                        continue

                    if "id" not in node:
                        errors.append(f"Node {i} must have an 'id'")
                    if "type" not in node:
                        errors.append(f"Node {i} must have a 'type'")
                    if "position" not in node:
                        warnings.append(f"Node {i} is missing position data")

            # Check edges if present
            if "edges" in definition:
                if not isinstance(definition["edges"], list):
                    errors.append("Template 'edges' must be a list")
                else:
                    for i, edge in enumerate(definition["edges"]):
                        if not isinstance(edge, dict):
                            errors.append(f"Edge {i} must be a dictionary")
                            continue

                        if "source" not in edge or "target" not in edge:
                            errors.append(f"Edge {i} must have 'source' and 'target'")

            # Calculate complexity score
            complexity_score = self._calculate_complexity_score(definition)

            # Generate suggestions
            if complexity_score > 0.8:
                suggestions.append("Consider breaking this into smaller templates")
            if len(definition.get("nodes", [])) < 3:
                suggestions.append("Add more nodes to create a meaningful workflow")
            if not definition.get("edges") and len(definition.get("nodes", [])) > 1:
                warnings.append("Multiple nodes without connections - consider adding edges")

            return TemplateValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings,
                suggestions=suggestions,
                complexity_score=complexity_score,
                estimated_runtime=self._estimate_runtime(definition)
            )

        except Exception as e:
            return TemplateValidationResult(
                is_valid=False,
                errors=[f"Validation error: {str(e)}"]
            )

    async def _validate_component_structure(
        self,
        definition: Dict[str, Any]
    ) -> TemplateValidationResult:
        """Validate workflow component structure."""
        errors = []
        warnings = []

        try:
            if not isinstance(definition, dict):
                return TemplateValidationResult(
                    is_valid=False,
                    errors=["Component definition must be a dictionary"]
                )

            # Check required component fields
            required_fields = ["component_type", "configuration"]
            for field in required_fields:
                if field not in definition:
                    errors.append(f"Component must contain '{field}' field")

            # Validate configuration
            if "configuration" in definition:
                if not isinstance(definition["configuration"], dict):
                    errors.append("Component configuration must be a dictionary")

            return TemplateValidationResult(
                is_valid=len(errors) == 0,
                errors=errors,
                warnings=warnings
            )

        except Exception as e:
            return TemplateValidationResult(
                is_valid=False,
                errors=[f"Component validation error: {str(e)}"]
            )

    def _calculate_complexity_score(self, definition: Dict[str, Any]) -> float:
        """Calculate workflow complexity score (0-1)."""
        try:
            nodes = definition.get("nodes", [])
            edges = definition.get("edges", [])

            node_count = len(nodes)
            edge_count = len(edges)

            # Factor in different node types
            node_types = set(node.get("type", "") for node in nodes)
            type_diversity = len(node_types) / 10  # Normalize by expected max types

            # Calculate base complexity
            base_complexity = min(node_count / 20, 1.0)  # Normalize by expected max nodes

            # Factor in connection complexity
            connection_density = edge_count / (node_count * (node_count - 1) / 2) if node_count > 1 else 0

            # Combine factors
            complexity = (base_complexity * 0.4 +
                         connection_density * 0.3 +
                         type_diversity * 0.3)

            return min(complexity, 1.0)

        except Exception:
            return 0.5  # Default to medium complexity on error

    def _estimate_runtime(self, definition: Dict[str, Any]) -> str:
        """Estimate workflow runtime based on complexity."""
        try:
            nodes = definition.get("nodes", [])
            node_count = len(nodes)

            # Simple estimation based on node count
            if node_count <= 5:
                return "< 5 minutes"
            elif node_count <= 10:
                return "5-15 minutes"
            elif node_count <= 20:
                return "15-30 minutes"
            else:
                return "> 30 minutes"

        except Exception:
            return "Unknown"

    async def _create_template_version(
        self,
        template_id: UUID,
        version: str,
        definition: Dict[str, Any],
        changelog: str,
        user_id: UUID
    ):
        """Create a new template version."""
        version_record = TemplateVersion(
            id=uuid4(),
            template_id=template_id,
            version=version,
            definition=definition,
            changelog=changelog,
            created_by=user_id,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(version_record)
        await self.db.commit()

    def _bump_version(self, current_version: str, bump_type: str = "patch") -> str:
        """Bump semantic version."""
        try:
            parts = current_version.split(".")
            if len(parts) != 3:
                return "1.0.0"  # Reset if malformed

            major, minor, patch = map(int, parts)

            if bump_type == "major":
                major += 1
                minor = 0
                patch = 0
            elif bump_type == "minor":
                minor += 1
                patch = 0
            else:  # patch
                patch += 1

            return f"{major}.{minor}.{patch}"

        except Exception:
            return "1.0.0"

    async def _process_template_variables(
        self,
        definition: Dict[str, Any],
        variable_values: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Process template variables with provided values."""
        try:
            # Deep copy definition
            processed = json.loads(json.dumps(definition))

            # Find and replace variables in definition
            await self._replace_variables_recursive(processed, variable_values)

            return processed

        except Exception as e:
            logger.error(f"Failed to process template variables: {e}")
            raise ValidationError("Failed to process template variables")

    async def _replace_variables_recursive(
        self,
        obj: Any,
        variable_values: Dict[str, Any]
    ):
        """Recursively replace template variables."""
        if isinstance(obj, dict):
            for key, value in obj.items():
                if isinstance(value, str) and value.startswith("{{") and value.endswith("}}"):
                    var_name = value[2:-2].strip()
                    if var_name in variable_values:
                        obj[key] = variable_values[var_name]
                else:
                    await self._replace_variables_recursive(value, variable_values)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, str) and item.startswith("{{") and item.endswith("}}"):
                    var_name = item[2:-2].strip()
                    if var_name in variable_values:
                        obj[i] = variable_values[var_name]
                else:
                    await self._replace_variables_recursive(item, variable_values)

    async def _check_template_usage(self, template_id: UUID) -> int:
        """Check how many workflows are using this template."""
        result = await self.db.execute(
            select(func.count(Workflow.id)).where(
                Workflow.template_id == template_id
            )
        )
        return result.scalar() or 0

    async def _record_template_usage(self, template_id: UUID, user_id: UUID):
        """Record template usage for analytics."""
        # This would typically update usage statistics
        # Implementation depends on specific analytics requirements
        pass

    async def _update_template_rating(self, template_id: UUID):
        """Update template's average rating."""
        try:
            result = await self.db.execute(
                select(func.avg(TemplateRating.rating)).where(
                    TemplateRating.template_id == template_id
                )
            )
            avg_rating = result.scalar()

            if avg_rating:
                await self.db.execute(
                    update(WorkflowTemplate)
                    .where(WorkflowTemplate.id == template_id)
                    .values(rating=float(avg_rating))
                )
                await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to update template rating: {e}")


# Factory function
def get_workflow_templates_service(db: AsyncSession) -> WorkflowTemplatesService:
    """Get workflow templates service instance."""
    return WorkflowTemplatesService(db)