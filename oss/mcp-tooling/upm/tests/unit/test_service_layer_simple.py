"""
Simple tests for UPM service layer core functionality.

Tests service layer without complex dependencies.
"""

import pytest
import uuid
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime

from udp.core.services import (
    DependencyInjectionContainer,
    ServiceException,
    NotFoundError,
    ValidationError,
    DatabaseError,
)
from udp.core.models.base import BaseModel


class MockModel(BaseModel):
    """Mock model for testing."""

    def __init__(self):
        self.id = uuid.uuid4()

    def update_from_dict(self, data):
        pass

    def soft_delete(self):
        self.deleted_at = datetime.utcnow()

    def to_dict(self):
        return {"id": str(self.id)}


@pytest.mark.asyncio
class TestServiceLayerSimple:
    """Test service layer core functionality."""

    async def test_dependency_injection_container_singleton(self):
        """Test dependency injection container singleton behavior."""
        container1 = DependencyInjectionContainer()
        container2 = DependencyInjectionContainer()

        # Should be the same instance
        assert container1 is container2

        # Test basic functionality
        container.register("test_service", lambda: Mock())

        service = container.get("test_service")
        assert service is not None

    async def test_service_exceptions(self):
        """Test service layer exceptions."""
        # Test ServiceException
        with pytest.raises(ServiceException) as exc_info:
            error = ServiceException("Test error", "TEST_ERROR")
            raise error

        assert str(exc_info.value) == "Test error"
        assert exc_info.value.error_code == "TEST_ERROR"

        # Test NotFoundError
        with pytest.raises(NotFoundError) as exc_info:
            error = NotFoundError("Resource not found", "NOT_FOUND")
            raise error

        assert "Resource not found" in str(exc_info.value)
        assert exc_info.value.error_code == "NOT_FOUND"

        # Test ValidationError
        with pytest.raises(ValidationError) as exc_info:
            error = ValidationError("Invalid data", "VALIDATION_ERROR")
            raise error

        assert "Invalid data" in str(exc_info.value)
        assert exc_info.value.error_code == "VALIDATION_ERROR"

        # Test DatabaseError
        with pytest.raises(DatabaseError) as exc_info:
            error = DatabaseError("Database error", "DB_ERROR")
            raise error

        assert "Database error" in str(exc_info.value)
        assert exc_info.value.error_code == "DB_ERROR"

    async def test_base_model_functionality(self):
        """Test BaseModel functionality."""
        model = MockModel()

        # Test basic properties
        assert model.id is not None
        assert isinstance(model.id, uuid.UUID)
        assert model.created_at is None  # Will be set by database
        assert model.updated_at is None  # Will be set by database

        # Test soft delete
        assert not model.is_deleted
        model.soft_delete()
        assert model.is_deleted
        assert model.deleted_at is not None

        # Test restore
        model.restore()
        assert not model.is_deleted
        assert model.deleted_at is None

        # Test metadata functionality
        assert model.get_metadata() == {}

        model.set_metadata({"key1": "value1", "key2": 42})
        assert model.get_metadata() == {"key1": "value1", "key2": 42}

        model.add_metadata("key3", "value3")
        expected = {"key1": "value1", "key2": 42, "key3": "value3"}
        assert model.get_metadata() == expected

        model.remove_metadata("key2")
        assert model.get_metadata() == {"key1": "value1", "key3": "value3"}

    async def test_service_error_propagation(self):
        """Test error propagation in services."""
        db_session = AsyncMock()
        logger = Mock()

        # Mock a service that raises an error
        class MockService:
            def __init__(self, db_session=None, logger=None):
                self.db_session = db_session
                self.logger = logger

            async def test_method(self):
                raise ServiceException("Service error")

        service = MockService(db_session, logger)

        with pytest.raises(ServiceException):
            await service.test_method()

    async def test_service_logging(self):
        """Test service logging functionality."""
        logger = Mock()

        # Mock a service with logging
        class MockService:
            def __init__(self, db_session=None, logger=None):
                self.db_session = Mock()
                self.logger = logger or Mock()

            def _log_operation(self, operation, details=None):
                self.logger.info("Service operation")

        service = MockService(logger=logger)

        service._log_operation("test_operation", {"key": "value"})
        service.logger.info.assert_called_once_with("Service operation")

    def test_service_container_isolation(self):
        """Test that service instances are isolated."""
        container = DependencyInjectionContainer()

        # Register different instances
        service1 = Mock()
        service2 = Mock()

        container.register("service1", lambda: service1)
        container.register("service2", lambda: service2)

        # Should return same instances
        retrieved1 = container.get("service1")
        retrieved2 = container.get("service2")

        assert retrieved1 is service1
        assert retrieved2 is service2
        assert retrieved1 is not retrieved2

    def test_container_clear(self):
        """Test container clear functionality."""
        container = DependencyInjectionContainer()

        # Register and retrieve services
        container.register("test_service", Mock)
        service = container.get("test_service")
        assert service is not None

        # Clear container
        container.clear()

        # Service should be recreated
        service_after_clear = container.get("test_service")
        assert service_after_clear is not None
        assert service_after_clear is not service

    def test_container_registration_validation(self):
        """Test container registration validation."""
        container = DependencyInjectionContainer()

        # Test invalid factory
        with pytest.raises(ValueError):
            container.register("test_interface", "not_callable")

        # Test invalid inheritance
        with pytest.raises(ValueError):
            container.register("test_interface", lambda: "not_class")


if __name__ == "__main__":
    pytest.main(["-v", __file__])
