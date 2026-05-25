"""
Core service layer for UPM application.

Provides base classes, dependency injection container,
error handling, and common service functionality.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Union
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models.base import BaseModel


class ServiceException(Exception):
    """Base exception for UPM services."""

    def __init__(
        self, message: str, error_code: str = None, details: dict[str, Any] = None
    ):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(ServiceException):
    """Exception raised when resource is not found."""

    pass


class ValidationError(ServiceException):
    """Exception raised for validation errors."""

    pass


class AuthorizationError(ServiceException):
    """Exception raised for authorization failures."""

    pass


class ConflictError(ServiceException):
    """Exception raised for resource conflicts."""

    pass


class DatabaseError(ServiceException):
    """Exception raised for database errors."""

    pass


class DependencyInjectionContainer:
    """
    Dependency injection container for managing service instances.

    Provides singleton service instances with lazy loading and
    dependency resolution capabilities.
    """

    _instance = None
    _services: dict[str, Any] = {}
    _factories: dict[str, callable] = {}

    def __new__(cls) -> "DependencyInjectionContainer":
        if not cls._instance:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Initialize the container with core services."""
        # Configuration will be loaded lazily when requested
        pass

    def register(self, interface: type, implementation: type):
        """Register a service implementation for an interface."""
        if not issubclass(implementation, interface):
            raise ValueError(f"{implementation} is not a subclass of {interface}")

        self._factories[interface.__name__] = lambda: implementation()

    def register_factory(self, interface: type, factory: callable):
        """Register a factory function for creating service instances."""
        if not callable(factory):
            raise ValueError("Factory must be callable")
        self._factories[interface.__name__] = factory

    def get(self, interface: type) -> Any:
        """Get a service instance for the given interface."""
        interface_name = interface.__name__

        if interface_name not in self._services:
            if interface_name in self._factories:
                try:
                    self._services[interface_name] = self._factories[interface_name]()
                except Exception as e:
                    raise ServiceException(
                        f"Failed to create service {interface_name}",
                        error_code="SERVICE_CREATION_FAILED",
                        details={"error": str(e)},
                    )
            else:
                raise ServiceException(
                    f"Service {interface_name} not registered",
                    error_code="SERVICE_NOT_REGISTERED",
                )

        return self._services[interface_name]

    def clear(self):
        """Clear all service instances (useful for testing)."""
        self._services.clear()


class BaseAsyncService(ABC):
    """
    Base class for all async services in UPM.

    Provides common functionality including database access, logging,
    error handling, and dependency injection.
    """

    def __init__(self, db_session: AsyncSession = None, logger: logging.Logger = None):
        self.db_session = db_session or self._create_db_session()
        self.logger = logger or self._create_logger()
        self.container = DependencyInjectionContainer()

    @abstractmethod
    async def get_service_dependencies(self) -> dict[str, type]:
        """
        Define service dependencies for this service.

        Override this method to specify which other services
        this service depends on.
        """
        pass

    async def _get_dependency(self, interface: type) -> Any:
        """Get a service dependency using the container."""
        return self.container.get(interface)

    def _create_db_session(self) -> AsyncSession:
        """Create a database session for this service."""
        from ..infrastructure.database import get_db_session

        return get_db_session()

    def _create_logger(self) -> logging.Logger:
        """Create a logger for this service."""
        return logging.getLogger(f"upm.services.{self.__class__.__name__.lower()}")

    async def _execute_query(
        self,
        query,
        params: dict[str, Any] = None,
        error_msg: str = "Database operation failed",
    ) -> Any:
        """Execute a database query with error handling."""
        try:
            result = await self.db_session.execute(query, params or {})
            return result
        except SQLAlchemyError as e:
            self.logger.error(f"{error_msg}: {str(e)}")
            raise DatabaseError(
                f"{error_msg}: {str(e)}",
                error_code="DATABASE_ERROR",
                details={"original_error": str(e), "query": str(query)},
            )

    async def _execute_in_transaction(self, operation: callable):
        """Execute an operation within a database transaction."""
        async with self.db_session.begin():
            try:
                result = await operation()
                await self.db_session.commit()
                return result
            except Exception as e:
                await self.db_session.rollback()
                self.logger.error(f"Transaction failed: {str(e)}")
                if isinstance(e, ServiceException):
                    raise
                raise DatabaseError(
                    f"Transaction failed: {str(e)}",
                    error_code="TRANSACTION_ERROR",
                    details={"original_error": str(e)},
                )

    def _log_operation(self, operation: str, details: dict[str, Any] = None):
        """Log service operation with structured data."""
        log_data = {
            "service": self.__class__.__name__,
            "operation": operation,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if details:
            log_data.update(details)

        self.logger.info("Service operation", extra={"upm_data": log_data})

    def _log_error(
        self, error: Exception, operation: str = None, context: dict[str, Any] = None
    ):
        """Log error with structured data."""
        log_data = {
            "service": self.__class__.__name__,
            "error": str(error),
            "error_type": type(error).__name__,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if operation:
            log_data["operation"] = operation
        if context:
            log_data.update(context)

        self.logger.error("Service error", extra={"upm_data": log_data})


class BaseService(BaseAsyncService):
    """
    Base service class for standard CRUD operations.

    Provides common functionality for create, read, update, delete
    operations with proper error handling and validation.
    """

    model_class: type[BaseModel] = None

    def __init__(self, db_session: AsyncSession = None, logger: logging.Logger = None):
        super().__init__(db_session, logger)
        if self.model_class is None:
            raise NotImplementedError("model_class must be defined in service subclass")

    async def get_by_id(self, id: Union[str, UUID]) -> BaseModel:
        """Get a single record by ID."""
        if isinstance(id, str):
            try:
                id = UUID(id)
            except ValueError:
                raise ValidationError(f"Invalid UUID format: {id}")

        query = select(self.model_class).where(self.model_class.id == id)
        result = await self._execute_query(query)
        entity = result.scalar_one_or_none()

        if not entity:
            raise NotFoundError(f"{self.model_class.__name__} with id {id} not found")

        return entity

    async def list_all(
        self, limit: int = 100, offset: int = 0, filters: dict[str, Any] = None
    ) -> list[BaseModel]:
        """List all records with optional filters."""
        query = select(self.model_class)

        # Apply filters
        if filters:
            for key, value in filters.items():
                if hasattr(self.model_class, key):
                    if isinstance(value, str) and "%" in value:
                        query = query.where(getattr(self.model_class, key).like(value))
                    else:
                        query = query.where(getattr(self.model_class, key) == value)

        # Apply soft delete filter
        if hasattr(self.model_class, "deleted_at"):
            query = query.where(self.model_class.deleted_at == None)

        # Apply pagination
        query = query.limit(limit).offset(offset)

        result = await self._execute_query(query)
        return result.scalars().all()

    async def create(self, data: dict[str, Any], created_by: UUID = None) -> BaseModel:
        """Create a new record."""
        entity = self.model_class()
        entity.update_from_dict(data)

        if created_by:
            entity.created_by = created_by

        try:
            self.db_session.add(entity)
            await self.db_session.commit()
            await self.db_session.refresh(entity)
            return entity
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to create {self.model_class.__name__}: {str(e)}")
            raise DatabaseError(
                f"Failed to create {self.model_class.__name__}: {str(e)}",
                error_code="CREATE_ERROR",
                details={"data": data, "original_error": str(e)},
            )

    async def update(
        self, id: Union[str, UUID], data: dict[str, Any], updated_by: UUID = None
    ) -> BaseModel:
        """Update an existing record."""
        entity = await self.get_by_id(id)

        # Track original values for audit
        original_values = entity.to_dict()

        entity.update_from_dict(data)

        if updated_by:
            entity.updated_by = updated_by

        try:
            await self.db_session.commit()
            await self.db_session.refresh(entity)

            # Log the update
            self._log_operation(
                "update",
                {
                    "id": str(id),
                    "original_values": original_values,
                    "updated_values": data,
                },
            )

            return entity
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update {self.model_class.__name__}: {str(e)}")
            raise DatabaseError(
                f"Failed to update {self.model_class.__name__}: {str(e)}",
                error_code="UPDATE_ERROR",
                details={"id": str(id), "data": data, "original_error": str(e)},
            )

    async def delete(self, id: Union[str, UUID], deleted_by: UUID = None) -> None:
        """Soft delete a record."""
        entity = await self.get_by_id(id)

        entity.soft_delete()
        if deleted_by:
            entity.updated_by = deleted_by

        try:
            await self.db_session.commit()

            # Log the deletion
            self._log_operation(
                "delete",
                {"id": str(id), "deleted_by": str(deleted_by) if deleted_by else None},
            )
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to delete {self.model_class.__name__}: {str(e)}")
            raise DatabaseError(
                f"Failed to delete {self.model_class.__name__}: {str(e)}",
                error_code="DELETE_ERROR",
                details={"id": str(id), "original_error": str(e)},
            )

    async def hard_delete(self, id: Union[str, UUID]) -> None:
        """Permanently delete a record (use with caution)."""
        entity = await self.get_by_id(id)

        try:
            await self.db_session.delete(entity)
            await self.db_session.commit()

            # Log the hard deletion
            self._log_operation("hard_delete", {"id": str(id)})
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(
                f"Failed to hard delete {self.model_class.__name__}: {str(e)}"
            )
            raise DatabaseError(
                f"Failed to hard delete {self.model_class.__name__}: {str(e)}",
                error_code="HARD_DELETE_ERROR",
                details={"id": str(id), "original_error": str(e)},
            )

    async def count(self, filters: dict[str, Any] = None) -> int:
        """Count records matching filters."""
        query = select(func.count(self.model_class.id))

        # Apply filters
        if filters:
            for key, value in filters.items():
                if hasattr(self.model_class, key):
                    if isinstance(value, str) and "%" in value:
                        query = query.where(getattr(self.model_class, key).like(value))
                    else:
                        query = query.where(getattr(self.model_class, key) == value)

        # Apply soft delete filter
        if hasattr(self.model_class, "deleted_at"):
            query = query.where(self.model_class.deleted_at == None)

        result = await self._execute_query(query)
        return result.scalar()

    async def exists(self, id: Union[str, UUID]) -> bool:
        """Check if a record exists."""
        if isinstance(id, str):
            try:
                id = UUID(id)
            except ValueError:
                return False

        query = select(func.count(self.model_class.id)).where(self.model_class.id == id)
        result = await self._execute_query(query)
        return result.scalar() > 0


class ServiceRegistry:
    """
    Registry for managing UPM services.

    Provides centralized service management, dependency resolution,
    and service lifecycle management.
    """

    def __init__(self):
        self._services: dict[str, type[BaseAsyncService]] = {}
        self._initialized = False

    def register(self, name: str, service_class: type[BaseAsyncService]):
        """Register a service class with the registry."""
        if not issubclass(service_class, BaseAsyncService):
            raise ValueError(f"{service_class} must inherit from BaseAsyncService")

        self._services[name] = service_class

    def get_service_class(self, name: str) -> type[BaseAsyncService]:
        """Get a service class by name."""
        if name not in self._services:
            raise ServiceException(f"Service {name} not registered")

        return self._services[name]

    def list_services(self) -> dict[str, type[BaseAsyncService]]:
        """Get all registered services."""
        return self._services.copy()

    async def create_service(
        self, name: str, db_session: AsyncSession = None, **kwargs
    ) -> BaseAsyncService:
        """Create a service instance."""
        service_class = self.get_service_class(name)
        service_instance = service_class(db_session=db_session, **kwargs)

        # Initialize service dependencies
        dependencies = await service_instance.get_service_dependencies()
        for dep_name, dep_interface in dependencies.items():
            dep_service = await self.create_service(dep_name, db_session)
            setattr(service_instance, f"_{dep_name}_service", dep_service)

        return service_instance

    def is_initialized(self) -> bool:
        """Check if service registry is initialized."""
        return self._initialized

    def mark_initialized(self):
        """Mark service registry as initialized."""
        self._initialized = True


# Global service registry instance
service_registry = ServiceRegistry()


def register_default_services():
    """Register default UPM services."""
    from ..services.dependency import DependencyService
    from ..services.organization import OrganizationService
    from ..services.project import ProjectService
    from ..services.security import SecurityService
    from ..services.user import UserService
    from ..services.workflow import WorkflowService

    service_classes = {
        "user_service": UserService,
        "organization_service": OrganizationService,
        "project_service": ProjectService,
        "dependency_service": DependencyService,
        "security_service": SecurityService,
        "workflow_service": WorkflowService,
    }

    for service_name, service_class in service_classes.items():
        service_registry.register(service_name, service_class)

    service_registry.mark_initialized()


# Import service classes at module level
from uuid import UUID

from sqlalchemy import func
