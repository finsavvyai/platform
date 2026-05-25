"""
Base service classes for UPM business logic services.

Provides common functionality including CRUD operations,
dependency injection, error handling, and service lifecycle management.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from typing import Any, Union

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.models.base import BaseModel
from ..core.services import (
    DatabaseError,
    NotFoundError,
    ServiceException,
    ValidationError,
)


class BaseAsyncService(ABC):
    """
    Base async service class.

    Provides async-specific functionality for services
    that work with asynchronous database operations.
    """

    def __init__(self, db_session: AsyncSession, logger: logging.Logger = None):
        self.db_session = db_session
        if logger is None:
            self.logger = logging.getLogger(
                f"upm.services.{self.__class__.__name__.lower()}"
            )
        else:
            self.logger = logger

    @abstractmethod
    async def get_service_dependencies(self) -> dict:
        """
        Define service dependencies for dependency injection.

        Returns:
            Dictionary mapping service names to class names
        """
        pass

    async def _execute_query(self, query):
        """Execute a database query with error handling."""
        try:
            result = await self.db_session.execute(query)
            return result
        except SQLAlchemyError as e:
            self.logger.error(f"Database query failed: {str(e)}")
            raise DatabaseError(f"Database error: {str(e)}")

    async def _get_dependency(self, service_name: str):
        """Get a dependency service instance."""
        dependencies = await self.get_service_dependencies()
        if service_name not in dependencies:
            raise ServiceException(
                f"Service dependency '{service_name}' not defined",
                error_code="DEPENDENCY_NOT_FOUND",
            )

        service_class_name = dependencies[service_name]

        # Import and instantiate the service
        try:
            module = __import__(service_class_name, package=__name__)
            service_class = getattr(module, service_class_name)
            return service_class(self.db_session)
        except (ImportError, AttributeError) as e:
            self.logger.error(f"Failed to load service '{service_name}': {e}")
            raise ServiceException(
                f"Failed to load service '{service_name}': {str(e)}",
                error_code="SERVICE_LOAD_ERROR",
            )


class ServiceRegistry:
    """
    Registry for managing service instances and dependencies.
    """

    def __init__(self):
        self._services = {}
        self._singletons = {}

    def register(
        self, name: str, service_class: type[BaseAsyncService], singleton: bool = True
    ):
        """Register a service class."""
        self._services[name] = (service_class, singleton)

    def get(self, name: str, db_session: AsyncSession) -> BaseAsyncService:
        """Get a service instance."""
        if name not in self._services:
            raise ServiceException(f"Service '{name}' not registered")

        service_class, is_singleton = self._services[name]

        if is_singleton:
            if name not in self._singletons:
                self._singletons[name] = service_class(db_session)
            return self._singletons[name]
        else:
            return service_class(db_session)

    def clear(self):
        """Clear all singleton instances."""
        self._singletons.clear()


# Global service registry instance
service_registry = ServiceRegistry()


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

    async def get_by_id(self, id: Union[str, uuid.UUID]) -> BaseModel:
        """Get a single record by ID."""
        if isinstance(id, str):
            try:
                id = uuid.UUID(id)
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

    async def create(
        self, data: dict[str, Any], created_by: uuid.UUID = None
    ) -> BaseModel:
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
        try:
            from ..core.services import DatabaseError
        except ImportError:
            # Fallback if DatabaseError is not available in the same module
            class DatabaseError(ServiceException):
                """Exception raised for database errors."""

                pass

            raise DatabaseError(
                f"Failed to create {self.model_class.__name__}: {str(e)}",
                error_code="CREATE_ERROR",
                details={"data": data, "original_error": str(e)},
            )

    async def update(
        self,
        id: Union[str, uuid.UUID],
        data: dict[str, Any],
        updated_by: uuid.UUID = None,
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
            try:
                from ..core.services import DatabaseError
            except ImportError:

                class DatabaseError(ServiceException):
                    """Exception raised for database errors."""

                    pass

            raise DatabaseError(
                f"Failed to update {self.model_class.__name__}: {str(e)}",
                error_code="UPDATE_ERROR",
                details={"id": str(id), "data": data, "original_error": str(e)},
            )

    async def delete(
        self, id: Union[str, uuid.UUID], deleted_by: uuid.UUID = None
    ) -> None:
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
            try:
                from ..core.services import DatabaseError
            except ImportError:

                class DatabaseError(ServiceException):
                    """Exception raised for database errors."""

                    pass

            raise DatabaseError(
                f"Failed to delete {self.model_class.__name__}: {str(e)}",
                error_code="DELETE_ERROR",
                details={"id": str(id), "original_error": str(e)},
            )

    async def hard_delete(self, id: Union[str, uuid.UUID]) -> None:
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
            try:
                from ..core.services import DatabaseError
            except ImportError:

                class DatabaseError(ServiceException):
                    """Exception raised for database errors."""

                    pass

            raise DatabaseError(
                f"Failed to hard delete {self.model_class.__name__}: {str(e)}",
                error_code="HARD_DELETE_ERROR",
                details={"id": str(id), "original_error": str(e)},
            )

    async def count(self, filters: dict[str, Any] = None) -> int:
        """Count records matching filters."""
        from sqlalchemy import func

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

    async def exists(self, id: Union[str, uuid.UUID]) -> bool:
        """Check if a record exists."""
        if isinstance(id, str):
            try:
                id = uuid.UUID(id)
            except ValueError:
                return False

        from sqlalchemy import func

        query = select(func.count(self.model_class.id)).where(self.model_class.id == id)
        result = await self._execute_query(query)
        return result.scalar() > 0
