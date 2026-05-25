"""
Base models and database configuration for the RAG service.
"""

import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar, Union

from pydantic import BaseModel, Field, validator
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator, TypeEngine

from app.core.config import get_settings

settings = get_settings()


class Base(DeclarativeBase):
    """Base declarative model for all database models."""

    # Generate __tablename__ automatically
    pass


class TimestampMixin:
    """Mixin for adding timestamp fields to models."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """Mixin for adding tenant isolation to models."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        comment="Tenant ID for multi-tenancy",
    )


class SoftDeleteMixin:
    """Mixin for soft delete functionality."""

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )


# Database engine and session configuration
class DatabaseManager:
    """Manages database connections and sessions."""

    def __init__(self):
        self._engine = None
        self._session_factory = None

    @property
    def engine(self):
        """Get or create the database engine."""
        if self._engine is None:
            self._engine = create_async_engine(
                settings.database_url,
                echo=settings.debug,
                pool_size=settings.db_pool_size,
                max_overflow=settings.db_max_overflow,
                pool_pre_ping=True,
                pool_recycle=3600,
                future=True,
            )
        return self._engine

    @property
    def session_factory(self):
        """Get or create the session factory."""
        if self._session_factory is None:
            self._session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=True,
                autocommit=False,
            )
        return self._session_factory

    async def get_session(self) -> AsyncSession:
        """Get a database session."""
        return self.session_factory()

    async def create_all(self):
        """Create all database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def drop_all(self):
        """Drop all database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    async def close(self):
        """Close the database engine."""
        if self._engine:
            await self._engine.dispose()


# Global database manager instance
db_manager = DatabaseManager()


async def get_db_session() -> AsyncSession:
    """Dependency for getting a database session."""
    return await db_manager.get_session()


# Type variables for generic operations
ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository:
    """Base repository with common CRUD operations."""

    def __init__(self, model: Type[ModelType]):
        self.model = model

    async def get(
        self, db: AsyncSession, id: Union[uuid.UUID, str]
    ) -> Optional[ModelType]:
        """Get a single record by ID."""
        if isinstance(id, str):
            try:
                id = uuid.UUID(id)
            except ValueError:
                return None

        result = await db.execute(db.query(self.model).filter(self.model.id == id))
        return result.scalar_one_or_none()

    async def get_multi(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> List[ModelType]:
        """Get multiple records with pagination."""
        query = db.query(self.model)

        if tenant_id and hasattr(self.model, "tenant_id"):
            query = query.filter(self.model.tenant_id == tenant_id)

        if hasattr(self.model, "is_deleted"):
            query = query.filter(self.model.is_deleted == False)

        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        obj_in: CreateSchemaType,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> ModelType:
        """Create a new record."""
        obj_data = obj_in.dict()

        if tenant_id and hasattr(self.model, "tenant_id"):
            obj_data["tenant_id"] = tenant_id

        db_obj = self.model(**obj_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]],
    ) -> ModelType:
        """Update an existing record."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(
        self,
        db: AsyncSession,
        id: Union[uuid.UUID, str],
        soft_delete: bool = True,
    ) -> Optional[ModelType]:
        """Delete a record."""
        obj = await self.get(db, id)
        if not obj:
            return None

        if soft_delete and hasattr(obj, "is_deleted"):
            obj.is_deleted = True
            obj.deleted_at = datetime.utcnow()
            db.add(obj)
        else:
            await db.delete(obj)

        await db.commit()
        return obj

    async def count(
        self,
        db: AsyncSession,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> int:
        """Count records."""
        query = db.query(func.count(self.model.id))

        if tenant_id and hasattr(self.model, "tenant_id"):
            query = query.filter(self.model.tenant_id == tenant_id)

        if hasattr(self.model, "is_deleted"):
            query = query.filter(self.model.is_deleted == False)

        result = await db.execute(query)
        return result.scalar() or 0


# Utility functions
def generate_uuid() -> uuid.UUID:
    """Generate a new UUID."""
    return uuid.uuid4()


def current_utc_time() -> datetime:
    """Get current UTC time."""
    return datetime.utcnow()


# Database health check
async def check_database_health(db: AsyncSession) -> Dict[str, Any]:
    """Check database health status."""
    try:
        result = await db.execute("SELECT 1 as health_check")
        row = result.first()

        if row and row[0] == 1:
            return {
                "status": "healthy",
                "message": "Database connection successful",
                "timestamp": current_utc_time().isoformat(),
            }
        else:
            return {
                "status": "unhealthy",
                "message": "Database health check failed",
                "timestamp": current_utc_time().isoformat(),
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": f"Database health check error: {str(e)}",
            "timestamp": current_utc_time().isoformat(),
        }


# Database schema validation
async def validate_database_schema(db: AsyncSession) -> Dict[str, Any]:
    """Validate that all required tables and columns exist."""
    required_tables = [
        "tenants",
        "users",
        "documents",
        "document_chunks",
        "api_keys",
        "policies",
        "audit_logs",
        "token_usage",
        "dlp_scans",
    ]

    validation_result = {
        "status": "valid",
        "missing_tables": [],
        "missing_columns": [],
        "timestamp": current_utc_time().isoformat(),
    }

    # Check tables exist
    for table_name in required_tables:
        result = await db.execute(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table_name)",
            {"table_name": table_name},
        )
        exists = result.scalar()

        if not exists:
            validation_result["missing_tables"].append(table_name)

    # Check critical columns for document_chunks table (for vector search)
    if "document_chunks" not in validation_result["missing_tables"]:
        required_columns = ["id", "document_id", "content", "embedding", "tenant_id"]

        for column_name in required_columns:
            result = await db.execute(
                """
                SELECT EXISTS (
                    SELECT FROM information_schema.columns
                    WHERE table_name = 'document_chunks' AND column_name = :column_name
                )
                """,
                {"column_name": column_name},
            )
            exists = result.scalar()

            if not exists:
                validation_result["missing_columns"].append(
                    f"document_chunks.{column_name}"
                )

    if validation_result["missing_tables"] or validation_result["missing_columns"]:
        validation_result["status"] = "invalid"

    return validation_result
