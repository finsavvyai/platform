"""
Unit tests for UPM service layer.

Tests base service classes, dependency injection,
error handling, and service functionality.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime

from udp.core.services import (
    BaseService,
    ServiceRegistry,
    DependencyInjectionContainer,
    ServiceException,
    NotFoundError,
    ValidationError,
    DatabaseError,
)
from udp.services.user import UserService
from udp.services.organization import OrganizationService
from udp.services.project import ProjectService


@pytest.mark.asyncio
class TestServiceLayer:
    """Test service layer functionality."""

    async def test_dependency_injection_container(self):
        """Test dependency injection container."""
        container = DependencyInjectionContainer()

        # Test registration
        container.register(UserService, MockUserService)
        container.register(OrganizationService, MockOrganizationService)

        # Test retrieval
        user_service = container.get(UserService)
        org_service = container.get(OrganizationService)

        assert isinstance(user_service, MockUserService)
        assert isinstance(org_service, MockOrganizationService)

        # Test singleton behavior
        user_service2 = container.get(UserService)
        assert user_service is user_service2

        # Test error for non-existent service
        with pytest.raises(ServiceException):
            container.get(ProjectService)

    async def test_service_registry(self):
        """Test service registry."""
        registry = ServiceRegistry()

        # Test registration
        registry.register("user_service", MockUserService)
        registry.register("organization_service", MockOrganizationService)

        # Test retrieval
        user_service_class = registry.get_service_class("user_service")
        org_service_class = registry.get_service_class("organization_service")

        assert user_service_class == MockUserService
        assert org_service_class == MockOrganizationService

        # Test error for non-existent service
        with pytest.raises(ServiceException):
            registry.get_service_class("non_existent_service")

        # Test service listing
        services = registry.list_services()
        assert "user_service" in services
        assert "organization_service" in services

    async def test_service_creation(self):
        """Test service creation with dependencies."""
        registry = ServiceRegistry()

        # Register services
        registry.register("user_service", MockUserService)
        registry.register("organization_service", MockOrganizationService)
        registry.register("project_service", MockProjectService)

        # Test service creation without dependencies
        org_service = await registry.create_service("organization_service")
        assert isinstance(org_service, MockOrganizationService)

        # Test service creation with dependencies
        project_service = await registry.create_service("project_service")
        assert isinstance(project_service, MockProjectService)
        # Dependencies should be injected
        assert hasattr(project_service, "_organization_service")
        assert hasattr(project_service, "_user_service")

    async def test_base_service_crud_operations(self):
        """Test base service CRUD operations."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        # Test get_by_id
        test_uuid = uuid.uuid4()
        test_entity = MockModel()
        test_entity.id = test_uuid

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = test_entity

        with patch.object(service, "_execute_query", return_value=mock_result):
            result = await service.get_by_id(test_uuid)
            assert result == test_entity

        # Test get_by_id with invalid UUID
        with pytest.raises(ValidationError):
            await service.get_by_id("invalid-uuid")

        # Test get_by_id not found
        mock_result.scalar_one_or_none.return_value = None
        with patch.object(service, "_execute_query", return_value=mock_result):
            with pytest.raises(NotFoundError):
                await service.get_by_id(test_uuid)

    async def test_base_service_create_operation(self):
        """Test base service create operation."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        test_data = {"name": "Test", "description": "Test description"}
        created_by = uuid.uuid4()

        # Test successful creation
        test_entity = MockModel()
        test_entity.id = uuid.uuid4()

        with patch.object(service, "create", return_value=test_entity) as mock_create:
            result = await service.perform_create(test_data, created_by)
            assert result == test_entity
            mock_create.assert_called_once_with(test_data, created_by)

        # Test database error
        with patch.object(service, "create", side_effect=Exception("DB Error")):
            with pytest.raises(DatabaseError):
                await service.perform_create(test_data, created_by)

    async def test_base_service_list_operations(self):
        """Test base service list operations."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        # Test list_all
        test_entities = [MockModel() for _ in range(5)]

        mock_result = AsyncMock()
        mock_scalars = AsyncMock()
        mock_scalars.all.return_value = test_entities
        mock_result.scalars.return_value = mock_scalars

        with patch.object(service, "_execute_query", return_value=mock_result):
            result = await service.list_all(limit=10, offset=0)
            assert len(result) == 5

        # Test list with filters
        filters = {"status": "active"}
        with patch.object(service, "_execute_query", return_value=mock_result):
            result = await service.list_all(limit=10, offset=0, filters=filters)
            assert len(result) == 5

    async def test_base_service_update_operations(self):
        """Test base service update operations."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        test_uuid = uuid.uuid4()
        test_data = {"name": "Updated Name"}
        updated_by = uuid.uuid4()

        # Test successful update
        test_entity = MockModel()
        test_entity.id = test_uuid
        test_entity.to_dict.return_value = {"id": str(test_uuid), "name": "Old Name"}

        with patch.object(service, "update", return_value=test_entity) as mock_update:
            with patch.object(service, "get_by_id", return_value=test_entity):
                result = await service.perform_update(test_uuid, test_data, updated_by)
                assert result == test_entity
                mock_update.assert_called_once_with(test_uuid, test_data, updated_by)

        # Test update with invalid UUID
        with pytest.raises(ValidationError):
            await service.perform_update("invalid-uuid", test_data)

    async def test_base_service_delete_operations(self):
        """Test base service delete operations."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        test_uuid = uuid.uuid4()
        deleted_by = uuid.uuid4()

        # Test successful delete
        test_entity = MockModel()
        test_entity.id = test_uuid
        test_entity.soft_delete = Mock()

        with patch.object(service, "delete") as mock_delete:
            with patch.object(service, "get_by_id", return_value=test_entity):
                await service.perform_delete(test_uuid, deleted_by)
                test_entity.soft_delete.assert_called_once()
                mock_delete.assert_called_once_with(test_uuid, deleted_by)

        # Test hard delete
        test_entity.hard_delete = Mock()
        test_entity.id = test_uuid

        with patch.object(service, "hard_delete") as mock_hard_delete:
            with patch.object(service, "get_by_id", return_value=test_entity):
                await service.perform_hard_delete(test_uuid)
                mock_hard_delete.assert_called_once_with(test_uuid)

    async def test_base_service_count_and_exists(self):
        """Test base service count and exists operations."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)
        service.model_class = MockModel

        test_uuid = uuid.uuid4()

        # Test count
        mock_result = AsyncMock()
        mock_result.scalar.return_value = 10

        with patch.object(service, "count", return_value=10):
            result = await service.perform_count()
            assert result == 10

        # Test exists
        with patch.object(service, "exists", return_value=True):
            result = await service.perform_exists(test_uuid)
            assert result is True

        # Test exists with invalid UUID
        with pytest.raises(ValidationError):
            await service.perform_exists("invalid-uuid")

    async def test_service_error_handling(self):
        """Test service error handling."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)

        # Test ServiceException
        with pytest.raises(ServiceException) as exc_info:
            error = ServiceException("Test error", "TEST_ERROR", {"detail": "test"})
            raise error

        assert str(exc_info.value) == "Test error"
        assert exc_info.value.error_code == "TEST_ERROR"
        assert exc_info.value.details["detail"] == "test"

        # Test NotFoundError
        with pytest.raises(NotFoundError) as exc_info:
            raise NotFoundError("Not found", "NOT_FOUND")

        assert "Not found" in str(exc_info.value)
        assert exc_info.value.error_code == "NOT_FOUND"

        # Test ValidationError
        with pytest.raises(ValidationError) as exc_info:
            raise ValidationError("Invalid data", "VALIDATION_ERROR")

        assert "Invalid data" in str(exc_info.value)
        assert exc_info.value.error_code == "VALIDATION_ERROR"

        # Test DatabaseError
        with pytest.raises(DatabaseError) as exc_info:
            raise DatabaseError("Database error", "DB_ERROR")

        assert "Database error" in str(exc_info.value)
        assert exc_info.value.error_code == "DB_ERROR"

    async def test_service_logging(self):
        """Test service logging functionality."""
        db_session = AsyncMock()
        logger = Mock()

        service = MockBaseService(db_session, logger)

        # Test operation logging
        service._log_operation("test_operation", {"key": "value"})
        logger.info.assert_called_once()

        # Test error logging
        test_error = Exception("Test error")
        service._log_error(test_error, "test_operation", {"context": "test"})
        logger.error.assert_called_once()


# Mock classes for testing
class MockModel:
    """Mock model for testing."""

    def __init__(self):
        self.id = uuid.uuid4()

    def update_from_dict(self, data):
        pass

    def soft_delete(self):
        self.deleted_at = datetime.utcnow()

    def to_dict(self):
        return {"id": str(self.id)}


class MockUserService:
    """Mock user service for testing."""

    def __init__(self, db_session=None, logger=None):
        self.db_session = db_session
        self.logger = logger


class MockOrganizationService:
    """Mock organization service for testing."""

    def __init__(self, db_session=None, logger=None):
        self.db_session = db_session
        self.logger = logger


class MockProjectService:
    """Mock project service for testing."""

    def __init__(self, db_session=None, logger=None):
        self.db_session = db_session
        self.logger = logger


class MockBaseService(BaseService):
    """Mock base service for testing."""

    model_class = MockModel

    async def get_service_dependencies(self):
        """Define service dependencies."""
        return {}


if __name__ == "__main__":
    pytest.main(["-v", __file__])
