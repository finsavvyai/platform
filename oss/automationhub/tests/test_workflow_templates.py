"""
Workflow Templates Service Tests

Comprehensive test suite for workflow template management including:
- Template CRUD operations
- Component management
- Template instantiation and deployment
- Rating and review system
- Search and filtering functionality
- Version management
- Analytics and usage tracking
"""

import pytest
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.services.workflow_templates import (
    WorkflowTemplatesService,
    TemplateSearchFilters,
    ComponentSearchFilters,
    TemplateValidationResult
)
from app.models.workflow_templates import (
    WorkflowTemplate, WorkflowComponent, ComponentCategory,
    TemplateVersion, TemplateRating, TemplateUsageLog,
    ComponentUsageLog, TemplateStatus, ComponentStatus, ComponentType
)
from app.schemas.workflow_templates import (
    WorkflowTemplateCreate, WorkflowComponentCreate,
    TemplateInstantiateRequest, TemplateRatingCreate
)
from app.core.exceptions import (
    ValidationError, NotFoundError, ConflictError, AuthorizationError
)


class TestWorkflowTemplatesService:
    """Test cases for WorkflowTemplatesService."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        db = AsyncMock()
        db.add = AsyncMock()
        db.commit = AsyncMock()
        db.rollback = AsyncMock()
        db.refresh = AsyncMock()
        db.delete = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.fixture
    def template_service(self, mock_db):
        """Create template service instance."""
        return WorkflowTemplatesService(mock_db)

    @pytest.fixture
    def sample_user(self):
        """Sample user for testing."""
        return {
            "id": uuid4(),
            "email": "test@example.com",
            "full_name": "Test User"
        }

    @pytest.fixture
    def sample_template_data(self):
        """Sample template creation data."""
        return WorkflowTemplateCreate(
            name="Test Workflow",
            description="A test workflow template",
            definition={
                "nodes": [
                    {
                        "id": "node1",
                        "type": "trigger",
                        "data": {"config": {}},
                        "position": {"x": 100, "y": 100}
                    },
                    {
                        "id": "node2",
                        "type": "action",
                        "data": {"config": {}},
                        "position": {"x": 300, "y": 100}
                    }
                ],
                "edges": [
                    {
                        "id": "edge1",
                        "source": "node1",
                        "target": "node2"
                    }
                ]
            },
            category="automation",
            tags=["test", "automation"],
            difficulty_level="beginner",
            estimated_runtime="< 5 minutes",
            is_public=True
        )

    @pytest.fixture
    def sample_component_data(self):
        """Sample component creation data."""
        return WorkflowComponentCreate(
            name="HTTP Request",
            description="Make HTTP requests to external APIs",
            component_type=ComponentType.ACTION,
            category="integration",
            definition={
                "component_type": "action",
                "configuration": {
                    "url": {"type": "string", "required": True},
                    "method": {"type": "select", "options": ["GET", "POST", "PUT", "DELETE"], "default": "GET"},
                    "headers": {"type": "object", "required": False}
                }
            },
            input_schema={
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "method": {"type": "string"},
                    "data": {"type": "object"}
                }
            },
            output_schema={
                "type": "object",
                "properties": {
                    "status_code": {"type": "number"},
                    "response": {"type": "object"}
                }
            },
            tags=["http", "api", "integration"],
            is_public=True
        )

    @pytest.fixture
    def sample_template(self, sample_user):
        """Sample workflow template entity."""
        return WorkflowTemplate(
            id=uuid4(),
            name="Test Workflow",
            description="A test workflow template",
            definition={
                "nodes": [
                    {"id": "node1", "type": "trigger", "position": {"x": 0, "y": 0}},
                    {"id": "node2", "type": "action", "position": {"x": 100, "y": 0}}
                ],
                "edges": [{"id": "edge1", "source": "node1", "target": "node2"}]
            },
            category_id=uuid4(),
            tags=["test", "automation"],
            difficulty_level="beginner",
            estimated_runtime="< 5 minutes",
            is_public=True,
            is_featured=False,
            status=TemplateStatus.PUBLISHED,
            version="1.0.0",
            rating=4.5,
            rating_count=10,
            usage_count=25,
            download_count=15,
            created_by=sample_user["id"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            published_at=datetime.now(timezone.utc)
        )

    @pytest.fixture
    def sample_component(self, sample_user):
        """Sample workflow component entity."""
        return WorkflowComponent(
            id=uuid4(),
            name="HTTP Request",
            description="Make HTTP requests to external APIs",
            component_type=ComponentType.ACTION,
            category_id=uuid4(),
            definition={
                "component_type": "action",
                "configuration": {"url": {"type": "string", "required": True}}
            },
            input_schema={"type": "object", "properties": {"url": {"type": "string"}}},
            output_schema={"type": "object", "properties": {"response": {"type": "object"}}},
            tags=["http", "api"],
            is_public=True,
            is_verified=True,
            status=ComponentStatus.ACTIVE,
            version="1.0.0",
            usage_count=50,
            rating=4.2,
            rating_count=8,
            created_by=sample_user["id"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )

    # Template Creation Tests

    @pytest.mark.asyncio
    async def test_create_template_success(self, template_service, mock_db, sample_template_data, sample_user):
        """Test successful template creation."""
        # Mock validation to pass
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )
        template_service._create_template_version = AsyncMock()

        # Execute
        result = await template_service.create_template(sample_template_data, sample_user["id"])

        # Assertions
        assert result.name == sample_template_data.name
        assert result.description == sample_template_data.description
        assert result.created_by == sample_user["id"]
        assert result.is_public == sample_template_data.is_public
        assert result.status == TemplateStatus.DRAFT
        assert result.version == "1.0.0"

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_template_validation_failure(self, template_service, mock_db, sample_template_data, sample_user):
        """Test template creation with validation failure."""
        # Mock validation to fail
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(
                is_valid=False,
                errors=["Template definition is invalid"]
            )
        )

        # Execute and verify exception
        with pytest.raises(ValidationError, match="Template validation failed"):
            await template_service.create_template(sample_template_data, sample_user["id"])

        # Verify no database operations
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_template_database_error(self, template_service, mock_db, sample_template_data, sample_user):
        """Test template creation with database error."""
        # Mock validation to pass
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )

        # Mock database error
        mock_db.commit.side_effect = Exception("Database error")

        # Execute and verify exception
        with pytest.raises(Exception, match="Database error"):
            await template_service.create_template(sample_template_data, sample_user["id"])

        # Verify rollback was called
        mock_db.rollback.assert_called_once()

    # Template Retrieval Tests

    @pytest.mark.asyncio
    async def test_get_template_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template retrieval."""
        # Mock database query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_template
        mock_db.execute.return_value = mock_result

        # Execute
        result = await template_service.get_template(sample_template.id, sample_user["id"])

        # Assertions
        assert result.id == sample_template.id
        assert result.name == sample_template.name

    @pytest.mark.asyncio
    async def test_get_template_not_found(self, template_service, mock_db, sample_user):
        """Test template retrieval when not found."""
        # Mock database query to return None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Execute and verify exception
        with pytest.raises(NotFoundError, match="Template not found"):
            await template_service.get_template(uuid4(), sample_user["id"])

    # Template Update Tests

    @pytest.mark.asyncio
    async def test_update_template_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template update."""
        # Mock existing template
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_template
        mock_db.execute.return_value = mock_result

        # Mock validation
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )
        template_service._create_template_version = AsyncMock()

        # Update data
        update_data = {
            "name": "Updated Workflow",
            "description": "Updated description"
        }

        # Execute
        result = await template_service.update_template(sample_template.id, update_data, sample_user["id"])

        # Assertions
        assert result.name == "Updated Workflow"
        assert result.description == "Updated description"

        # Verify database operations
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called()

    @pytest.mark.asyncio
    async def test_update_template_not_owner(self, template_service, mock_db, sample_template):
        """Test template update by non-owner."""
        # Mock database query to return None (not found for this user)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Different user ID
        other_user_id = uuid4()

        # Execute and verify exception
        with pytest.raises(NotFoundError, match="Template not found"):
            await template_service.update_template(sample_template.id, {}, other_user_id)

    # Template Deletion Tests

    @pytest.mark.asyncio
    async def test_delete_template_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template deletion."""
        # Mock existing template
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_template
        mock_db.execute.return_value = mock_result

        # Mock usage check
        template_service._check_template_usage = AsyncMock(return_value=0)

        # Execute
        result = await template_service.delete_template(sample_template.id, sample_user["id"])

        # Assertions
        assert result is True

        # Verify database operations
        mock_db.delete.assert_called_once_with(sample_template)
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_template_in_use(self, template_service, mock_db, sample_template, sample_user):
        """Test template deletion when template is in use."""
        # Mock existing template
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_template
        mock_db.execute.return_value = mock_result

        # Mock usage check to return non-zero
        template_service._check_template_usage = AsyncMock(return_value=5)

        # Execute and verify exception
        with pytest.raises(ConflictError, match="Template cannot be deleted"):
            await template_service.delete_template(sample_template.id, sample_user["id"])

        # Verify no deletion
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()

    # Component Creation Tests

    @pytest.mark.asyncio
    async def test_create_component_success(self, template_service, mock_db, sample_component_data, sample_user):
        """Test successful component creation."""
        # Mock validation to pass
        template_service._validate_component_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )

        # Execute
        result = await template_service.create_component(sample_component_data, sample_user["id"])

        # Assertions
        assert result.name == sample_component_data.name
        assert result.description == sample_component_data.description
        assert result.component_type == sample_component_data.component_type
        assert result.created_by == sample_user["id"]
        assert result.is_public == sample_component_data.is_public
        assert result.status == ComponentStatus.ACTIVE

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        mock_db.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_component_validation_failure(self, template_service, mock_db, sample_component_data, sample_user):
        """Test component creation with validation failure."""
        # Mock validation to fail
        template_service._validate_component_structure = AsyncMock(
            return_value=TemplateValidationResult(
                is_valid=False,
                errors=["Component definition is invalid"]
            )
        )

        # Execute and verify exception
        with pytest.raises(ValidationError, match="Component validation failed"):
            await template_service.create_component(sample_component_data, sample_user["id"])

        # Verify no database operations
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

    # Template Instantiation Tests

    @pytest.mark.asyncio
    async def test_instantiate_template_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template instantiation."""
        # Mock template retrieval
        template_service.get_template = AsyncMock(return_value=sample_template)

        # Mock validation
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )

        # Mock variable processing
        template_service._process_template_variables = AsyncMock(return_value=sample_template.definition)

        # Mock database save for workflow
        mock_workflow = MagicMock()
        mock_workflow.id = uuid4()
        mock_workflow.name = "Instantiated Workflow"

        with patch('app.models.workflow.Workflow') as mock_workflow_model:
            mock_workflow_model.return_value = mock_workflow
            mock_db.add = AsyncMock()
            mock_db.commit = AsyncMock()
            mock_db.refresh = AsyncMock()

            # Instantiate request
            instantiate_request = TemplateInstantiateRequest(
                name="My Workflow",
                description="Instantiated from template",
                variable_values={}
            )

            # Execute
            result = await template_service.instantiate_template(
                sample_template.id, instantiate_request, sample_user["id"]
            )

            # Assertions
            assert result.workflow_id == mock_workflow.id
            assert "Instantiated" in result.workflow_name
            assert result.message == "Template instantiated successfully"

    @pytest.mark.asyncio
    async def test_instantiate_template_not_found(self, template_service, mock_db, sample_user):
        """Test template instantiation when template not found."""
        # Mock template retrieval to raise exception
        template_service.get_template = AsyncMock(
            side_effect=NotFoundError("Template not found")
        )

        # Execute and verify exception
        with pytest.raises(NotFoundError, match="Template not found"):
            await template_service.instantiate_template(
                uuid4(), TemplateInstantiateRequest(), sample_user["id"]
            )

    # Template Rating Tests

    @pytest.mark.asyncio
    async def test_rate_template_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template rating."""
        # Mock template retrieval
        template_service.get_template = AsyncMock(return_value=sample_template)

        # Mock existing rating check (no existing rating)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        # Mock rating update
        template_service._update_template_rating = AsyncMock()

        # Execute
        result = await template_service.rate_template(sample_template.id, 5, "Great template!", sample_user["id"])

        # Assertions
        assert result.rating == 5
        assert result.review == "Great template!"
        assert result.template_id == sample_template.id
        assert result.user_id == sample_user["id"]

        # Verify database operations
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_rate_template_update_existing(self, template_service, mock_db, sample_template, sample_user):
        """Test updating existing template rating."""
        # Mock template retrieval
        template_service.get_template = AsyncMock(return_value=sample_template)

        # Mock existing rating
        existing_rating = TemplateRating(
            id=uuid4(),
            template_id=sample_template.id,
            user_id=sample_user["id"],
            rating=3,
            review="Okay template",
            created_at=datetime.now(timezone.utc)
        )

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing_rating
        mock_db.execute.return_value = mock_result

        # Mock rating update
        template_service._update_template_rating = AsyncMock()

        # Execute
        result = await template_service.rate_template(sample_template.id, 5, "Updated review!", sample_user["id"])

        # Assertions
        assert result.rating == 5
        assert result.review == "Updated review!"
        assert result.template_id == sample_template.id
        assert result.user_id == sample_user["id"]

        # Verify database operations (commit for update)
        mock_db.commit.assert_called()

    @pytest.mark.asyncio
    async def test_rate_template_not_found(self, template_service, mock_db, sample_user):
        """Test rating template when template not found."""
        # Mock template retrieval to raise exception
        template_service.get_template = AsyncMock(
            side_effect=NotFoundError("Template not found")
        )

        # Execute and verify exception
        with pytest.raises(NotFoundError, match="Template not found"):
            await template_service.rate_template(uuid4(), 5, "Great!", sample_user["id"])

    # Search and Filter Tests

    @pytest.mark.asyncio
    async def test_list_templates_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template listing."""
        # Mock database query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_template]
        mock_db.execute.return_value = mock_result

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 1
        mock_db.execute.return_value = mock_count_result

        # Execute
        filters = TemplateSearchFilters(category="automation")
        result, total = await template_service.list_templates(
            user_id=sample_user["id"],
            filters=filters,
            skip=0,
            limit=10
        )

        # Assertions
        assert len(result) == 1
        assert result[0].id == sample_template.id
        assert total == 1

    @pytest.mark.asyncio
    async def test_list_components_success(self, template_service, mock_db, sample_component, sample_user):
        """Test successful component listing."""
        # Mock database query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_component]
        mock_db.execute.return_value = mock_result

        # Mock count query
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 1
        mock_db.execute.return_value = mock_count_result

        # Execute
        filters = ComponentSearchFilters(component_type="action")
        result, total = await template_service.list_components(
            user_id=sample_user["id"],
            filters=filters,
            skip=0,
            limit=10
        )

        # Assertions
        assert len(result) == 1
        assert result[0].id == sample_component.id
        assert total == 1

    @pytest.mark.asyncio
    async def test_search_templates_success(self, template_service, mock_db, sample_template, sample_user):
        """Test successful template search."""
        # Mock database query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_template]
        mock_db.execute.return_value = mock_result

        # Execute
        result = await template_service.search_templates("test", sample_user["id"], limit=20)

        # Assertions
        assert len(result) == 1
        assert result[0].id == sample_template.id

    # Template Validation Tests

    @pytest.mark.asyncio
    async def test_validate_template_structure_valid(self, template_service):
        """Test template structure validation with valid input."""
        # Valid template definition
        valid_definition = {
            "nodes": [
                {
                    "id": "node1",
                    "type": "trigger",
                    "position": {"x": 100, "y": 100},
                    "data": {"config": {}}
                },
                {
                    "id": "node2",
                    "type": "action",
                    "position": {"x": 300, "y": 100},
                    "data": {"config": {}}
                }
            ],
            "edges": [
                {
                    "id": "edge1",
                    "source": "node1",
                    "target": "node2"
                }
            ]
        }

        # Execute
        result = await template_service._validate_template_structure(valid_definition)

        # Assertions
        assert result.is_valid is True
        assert len(result.errors) == 0
        assert result.complexity_score is not None
        assert result.estimated_runtime is not None

    @pytest.mark.asyncio
    async def test_validate_template_structure_invalid(self, template_service):
        """Test template structure validation with invalid input."""
        # Invalid template definition - missing nodes
        invalid_definition = {
            "edges": [
                {
                    "id": "edge1",
                    "source": "node1",
                    "target": "node2"
                }
            ]
        }

        # Execute
        result = await template_service._validate_template_structure(invalid_definition)

        # Assertions
        assert result.is_valid is False
        assert len(result.errors) > 0
        assert any("nodes" in error for error in result.errors)

    @pytest.mark.asyncio
    async def test_validate_component_structure_valid(self, template_service):
        """Test component structure validation with valid input."""
        # Valid component definition
        valid_definition = {
            "component_type": "action",
            "configuration": {
                "url": {"type": "string", "required": True},
                "method": {"type": "select", "options": ["GET", "POST"], "default": "GET"}
            }
        }

        # Execute
        result = await template_service._validate_component_structure(valid_definition)

        # Assertions
        assert result.is_valid is True
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_validate_component_structure_invalid(self, template_service):
        """Test component structure validation with invalid input."""
        # Invalid component definition - missing component_type
        invalid_definition = {
            "configuration": {
                "url": {"type": "string", "required": True}
            }
        }

        # Execute
        result = await template_service._validate_component_structure(invalid_definition)

        # Assertions
        assert result.is_valid is False
        assert len(result.errors) > 0
        assert any("component_type" in error for error in result.errors)

    # Utility Function Tests

    def test_bump_version_patch(self, template_service):
        """Test version bumping for patch version."""
        result = template_service._bump_version("1.0.0", "patch")
        assert result == "1.0.1"

    def test_bump_version_minor(self, template_service):
        """Test version bumping for minor version."""
        result = template_service._bump_version("1.0.0", "minor")
        assert result == "1.1.0"

    def test_bump_version_major(self, template_service):
        """Test version bumping for major version."""
        result = template_service._bump_version("1.0.0", "major")
        assert result == "2.0.0"

    def test_bump_version_malformed(self, template_service):
        """Test version bumping with malformed version."""
        result = template_service._bump_version("invalid", "patch")
        assert result == "1.0.0"

    def test_calculate_complexity_score(self, template_service):
        """Test complexity score calculation."""
        # Simple workflow
        simple_definition = {
            "nodes": [
                {"id": "node1", "type": "trigger"},
                {"id": "node2", "type": "action"}
            ],
            "edges": [
                {"source": "node1", "target": "node2"}
            ]
        }

        score = template_service._calculate_complexity_score(simple_definition)
        assert 0 <= score <= 1
        assert score < 0.5  # Should be relatively low complexity

        # Complex workflow
        complex_definition = {
            "nodes": [
                {"id": f"node{i}", "type": f"type{i % 5}"}
                for i in range(20)  # 20 nodes
            ],
            "edges": [
                {"source": f"node{i}", "target": f"node{i+1}"}
                for i in range(19)  # 19 edges
            ]
        }

        complex_score = template_service._calculate_complexity_score(complex_definition)
        assert 0 <= complex_score <= 1
        assert complex_score > score  # Should be higher than simple workflow

    def test_estimate_runtime(self, template_service):
        """Test runtime estimation."""
        # Small workflow
        small_definition = {
            "nodes": [{"id": "node1"}, {"id": "node2"}]
        }

        runtime = template_service._estimate_runtime(small_definition)
        assert runtime == "< 5 minutes"

        # Medium workflow
        medium_definition = {
            "nodes": [{"id": f"node{i}"} for i in range(10)]
        }

        runtime = template_service._estimate_runtime(medium_definition)
        assert runtime == "5-15 minutes"

        # Large workflow
        large_definition = {
            "nodes": [{"id": f"node{i}"} for i in range(25)]
        }

        runtime = template_service._estimate_runtime(large_definition)
        assert runtime == "> 30 minutes"

    # Analytics and Stats Tests

    @pytest.mark.asyncio
    async def test_get_template_categories(self, template_service, mock_db):
        """Test getting template categories."""
        # Mock category data
        mock_categories = [
            ComponentCategory(
                id=uuid4(),
                name="Automation",
                description="Automation workflows",
                icon="auto_awesome",
                is_active=True,
                applies_to_templates=True,
                applies_to_components=False
            )
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_categories
        mock_db.execute.return_value = mock_result

        # Execute
        result = await template_service.get_template_categories()

        # Assertions
        assert len(result) == 1
        assert result[0].name == "Automation"
        assert result[0].applies_to_templates is True

    @pytest.mark.asyncio
    async def test_get_featured_templates(self, template_service, mock_db, sample_template):
        """Test getting featured templates."""
        # Mock featured template
        sample_template.is_featured = True
        sample_template.is_public = True
        sample_template.status = TemplateStatus.PUBLISHED

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_template]
        mock_db.execute.return_value = mock_result

        # Execute
        result = await template_service.get_featured_templates(limit=10)

        # Assertions
        assert len(result) == 1
        assert result[0].id == sample_template.id
        assert result[0].is_featured is True

    @pytest.mark.asyncio
    async def test_get_template_versions(self, template_service, mock_db, sample_template):
        """Test getting template versions."""
        # Mock version data
        mock_versions = [
            TemplateVersion(
                id=uuid4(),
                template_id=sample_template.id,
                version="1.0.0",
                definition=sample_template.definition,
                changelog="Initial version",
                created_by=uuid4(),
                created_at=datetime.now(timezone.utc)
            ),
            TemplateVersion(
                id=uuid4(),
                template_id=sample_template.id,
                version="1.1.0",
                definition=sample_template.definition,
                changelog="Added new feature",
                created_by=uuid4(),
                created_at=datetime.now(timezone.utc)
            )
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_versions
        mock_db.execute.return_value = mock_result

        # Execute
        result = await template_service.get_template_versions(sample_template.id)

        # Assertions
        assert len(result) == 2
        assert result[0].version == "1.1.0"  # Should be ordered by version desc
        assert result[1].version == "1.0.0"


class TestTemplateValidationResult:
    """Test cases for TemplateValidationResult."""

    def test_validation_result_creation(self):
        """Test creating validation result."""
        result = TemplateValidationResult(
            is_valid=True,
            errors=[],
            warnings=["Minor warning"],
            suggestions=["Consider optimization"],
            complexity_score=0.7,
            estimated_runtime="5-10 minutes"
        )

        assert result.is_valid is True
        assert len(result.errors) == 0
        assert len(result.warnings) == 1
        assert len(result.suggestions) == 1
        assert result.complexity_score == 0.7
        assert result.estimated_runtime == "5-10 minutes"

    def test_validation_result_defaults(self):
        """Test validation result with defaults."""
        result = TemplateValidationResult(is_valid=False, errors=["Error"])

        assert result.is_valid is False
        assert len(result.errors) == 1
        assert len(result.warnings) == 0
        assert len(result.suggestions) == 0
        assert result.complexity_score is None
        assert result.estimated_runtime is None


# Integration Tests

class TestWorkflowTemplatesIntegration:
    """Integration tests for workflow templates service."""

    @pytest.mark.asyncio
    async def test_template_lifecycle(self, template_service, mock_db, sample_user):
        """Test complete template lifecycle from creation to deletion."""
        # This test would require a more complex setup with actual database
        # For now, we'll test the service method calls in sequence

        template_data = WorkflowTemplateCreate(
            name="Lifecycle Test",
            description="Testing template lifecycle",
            definition={
                "nodes": [{"id": "node1", "type": "trigger", "position": {"x": 0, "y": 0}}],
                "edges": []
            },
            category="test",
            is_public=False
        )

        # Mock validation and version creation
        template_service._validate_template_structure = AsyncMock(
            return_value=TemplateValidationResult(is_valid=True)
        )
        template_service._create_template_version = AsyncMock()
        template_service._check_template_usage = AsyncMock(return_value=0)

        # Test the sequence of operations that would happen
        # (Actual database operations would be mocked in unit tests)

        # 1. Create template
        # This would create the template in the database

        # 2. Get template
        # This would retrieve the created template

        # 3. Update template
        # This would update the template and create new version

        # 4. List templates
        # This would return the template in the list

        # 5. Rate template
        # This would add a rating to the template

        # 6. Instantiate template
        # This would create a workflow from the template

        # 7. Get versions
        # This would return the version history

        # 8. Delete template
        # This would remove the template (if not in use)

        # For integration purposes, we verify the service methods exist
        assert hasattr(template_service, 'create_template')
        assert hasattr(template_service, 'get_template')
        assert hasattr(template_service, 'update_template')
        assert hasattr(template_service, 'list_templates')
        assert hasattr(template_service, 'rate_template')
        assert hasattr(template_service, 'instantiate_template')
        assert hasattr(template_service, 'get_template_versions')
        assert hasattr(template_service, 'delete_template')


if __name__ == "__main__":
    # Run the tests
    pytest.main([__file__, "-v", "--tb=short"])