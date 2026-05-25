"""
Tests for the UPM Core Service Layer.

Tests the base service classes, dependency injection,
and common service functionality.
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from uuid import uuid4

from src.udp.core.services import (
    DependencyInjectionContainer,
    BaseService,
    ServiceException,
    NotFoundError,
    ValidationError,
    DatabaseError,
)
from src.udp.core.models import User, Organization


class MockModel:
    """Mock model for testing BaseService."""

    def __init__(self):
        self.id = uuid4()
        self.created_at = None
        self.updated_at = None
        self.deleted_at = None
        self.created_by = None
        self.updated_by = None

    def update_from_dict(self, data):
        """Mock update method."""
        for key, value in data.items():
            setattr(self, key, value)

    def soft_delete(self):
        """Mock soft delete."""
        self.deleted_at = "2024-01-01T00:00:00Z"

    def to_dict(self):
        """Mock to_dict method."""
        return {"id": str(self.id)}


class MockService(BaseService):
    """Mock service for testing BaseService."""

    model_class = MockModel

    async def get_service_dependencies(self):
        """Mock dependencies."""
        return {}


class TestDependencyInjectionContainer:
    """Test dependency injection container functionality."""

    def test_singleton_pattern(self):
        """Test that container follows singleton pattern."""
        container1 = DependencyInjectionContainer()
        container2 = DependencyInjectionContainer()

        # Should be the same instance
        assert container1 is container2

    def test_factory_registration(self):
        """Test factory registration and retrieval."""
        container = DependencyInjectionContainer()

        # Register a factory function
        mock_service = Mock()
        container.register_factory(MockService, lambda: mock_service)

        # Retrieve service
        retrieved_service = container.get(MockService)
        assert retrieved_service is mock_service

    def test_invalid_factory_registration(self):
        """Test validation of factory functions."""
        container = DependencyInjectionContainer()

        # Test invalid factory
        with pytest.raises(ValueError):
            container.register_factory(MockService, "not_callable")

    def test_service_not_registered(self):
        """Test error when service not registered."""
        container = DependencyInjectionContainer()

        # Should raise error for unregistered service
        with pytest.raises(ServiceException) as exc_info:
            container.get(MockService)

        assert "SERVICE_NOT_REGISTERED" in str(exc_info.value)

    def test_container_clear(self):
        """Test container clear functionality."""
        container = DependencyInjectionContainer()

        # Register and retrieve a service
        mock_service = Mock()
        container.register_factory(MockService, lambda: mock_service)

        service1 = container.get(MockService)
        assert service1 is mock_service

        # Clear container
        container.clear()

        # Service should be recreated on next get
        service2 = container.get(MockService)
        # Since we're using the same factory, it returns the same mock
        assert service2 is mock_service


class TestServiceExceptions:
    """Test service exception hierarchy."""

    def test_service_exception_structure(self):
        """Test service exception with details."""
        details = {"field": "value", "number": 42}
        exc = ServiceException("Test message", error_code="TEST_ERROR", details=details)

        assert exc.message == "Test message"
        assert exc.error_code == "TEST_ERROR"
        assert exc.details == details
        assert str(exc) == "Test message"

    def test_subclass_exceptions(self):
        """Test specific service exception types."""
        # Test NotFoundError
        not_found = NotFoundError("Resource not found")
        assert isinstance(not_found, ServiceException)
        assert not_found.message == "Resource not found"

        # Test ValidationError
        validation = ValidationError("Invalid data")
        assert isinstance(validation, ServiceException)
        assert validation.message == "Invalid data"

        # Test DatabaseError with details
        db_error = DatabaseError(
            "DB failed", error_code="CONN_ERROR", details={"query": "SELECT *"}
        )
        assert isinstance(db_error, ServiceException)
        assert db_error.error_code == "CONN_ERROR"
        assert db_error.details["query"] == "SELECT *"


@pytest.mark.asyncio
class TestBaseService:
    """Test BaseService functionality."""

    async def test_model_class_validation(self):
        """Test that BaseService requires model_class."""
        # Should raise error if model_class is None
        with pytest.raises(NotImplementedError):
            BaseService()

    async def test_get_by_id_with_string(self):
        """Test get_by_id with string UUID."""
        service = MockService()

        # Mock the database operations
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = MockModel()

        service._execute_query = AsyncMock(return_value=mock_result)

        # Test with valid UUID string
        uuid_str = str(uuid4())
        result = await service.get_by_id(uuid_str)
        assert isinstance(result, MockModel)

    async def test_get_by_id_invalid_uuid(self):
        """Test get_by_id with invalid UUID string."""
        service = MockService()

        # Test with invalid UUID string
        with pytest.raises(ValidationError) as exc_info:
            await service.get_by_id("invalid-uuid")

        assert "Invalid UUID format" in str(exc_info.value)

    async def test_get_by_id_not_found(self):
        """Test get_by_id when record not found."""
        service = MockService()

        # Mock database returning None
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None

        service._execute_query = AsyncMock(return_value=mock_result)

        # Should raise NotFoundError
        with pytest.raises(NotFoundError) as exc_info:
            await service.get_by_id(uuid4())

        assert "not found" in str(exc_info.value)

    async def test_create_with_audit_fields(self):
        """Test create with audit fields."""
        service = MockService()
        created_by = uuid4()

        # Mock database session
        service.db_session = AsyncMock()

        data = {"name": "Test", "value": 42}
        result = await service.create(data, created_by=created_by)

        assert isinstance(result, MockModel)
        assert result.created_by == created_by

    async def test_soft_delete_functionality(self):
        """Test soft delete operation."""
        service = MockService()
        deleted_by = uuid4()

        # Mock database session and get_by_id
        service.db_session = AsyncMock()
        service.get_by_id = AsyncMock(return_value=MockModel())

        # Perform soft delete
        await service.delete(uuid4(), deleted_by=deleted_by)

        # Verify commit was called
        service.db_session.commit.assert_called_once()


@pytest.mark.asyncio
class TestServiceErrorHandling:
    """Test service error handling patterns."""

    async def test_database_error_handling(self):
        """Test handling of database errors."""
        service = MockService()

        # Mock database raising exception
        from sqlalchemy.exc import SQLAlchemyError

        service._execute_query = AsyncMock(
            side_effect=SQLAlchemyError("Connection failed")
        )

        # Should convert to DatabaseError
        with pytest.raises(DatabaseError) as exc_info:
            await service.get_by_id(uuid4())

        assert "DATABASE_ERROR" in str(exc_info.value)
        assert "Connection failed" in exc_info.value.details["original_error"]

    async def test_logging_functionality(self):
        """Test service logging."""
        service = MockService()

        # Mock logger
        mock_logger = Mock()
        service.logger = mock_logger

        # Test operation logging
        service._log_operation("test_operation", {"key": "value"})

        # Verify logger was called
        mock_logger.info.assert_called_once()

        # Test error logging
        error = Exception("Test error")
        service._log_error(error, "test_context", {"context": "data"})

        # Verify error logger was called
        mock_logger.error.assert_called()


class TestServiceRegistry:
    """Test service registry functionality."""

    def test_service_registration(self):
        """Test service registration in registry."""
        from src.udp.core.services import ServiceRegistry

        registry = ServiceRegistry()
        registry.register("test_service", MockService)

        # Test retrieval
        service_class = registry.get_service_class("test_service")
        assert service_class is MockService

    def test_invalid_service_registration(self):
        """Test registration of invalid service class."""
        from src.udp.core.services import ServiceRegistry

        registry = ServiceRegistry()

        # Should raise error for non-BaseService class
        with pytest.raises(ValueError):
            registry.register("invalid", str)  # str is not a BaseService

    def test_unregistered_service_retrieval(self):
        """Test retrieval of unregistered service."""
        from src.udp.core.services import ServiceRegistry

        registry = ServiceRegistry()

        # Should raise ServiceException for unregistered service
        with pytest.raises(ServiceException) as exc_info:
            registry.get_service_class("nonexistent")

        assert "not registered" in str(exc_info.value)


if __name__ == "__main__":
    pytest.main([__file__])
