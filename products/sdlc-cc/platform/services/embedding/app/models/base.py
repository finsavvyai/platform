"""
Base models for the embedding service.

This module contains base SQLAlchemy models and mixins that are used
across all other models in the embedding service.
"""

import uuid
from datetime import datetime
from typing import Any, Dict

from sqlalchemy import Boolean, DateTime, String, UUID
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

Base = declarative_base()


class TimestampMixin:
    """Mixin to add timestamp fields to models."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Timestamp when the record was created",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Timestamp when the record was last updated",
    )


class SoftDeleteMixin:
    """Mixin to add soft delete functionality to models."""

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, comment="Whether the record is deleted"
    )
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when the record was deleted",
    )

    def soft_delete(self) -> None:
        """Mark the record as deleted."""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()

    def restore(self) -> None:
        """Restore a soft-deleted record."""
        self.is_deleted = False
        self.deleted_at = None


class TenantMixin:
    """Mixin to add tenant isolation to models."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        comment="Tenant ID for multi-tenancy",
    )


class MetadataMixin:
    """Mixin to add metadata field to models."""

    metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Additional metadata in JSON format",
    )


class AuditMixin:
    """Mixin to add audit fields to models."""

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="User who created the record",
    )
    updated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="User who last updated the record",
    )


class VersionMixin:
    """Mixin to add versioning to models."""

    version: Mapped[int] = mapped_column(
        String(50),
        nullable=False,
        default="1.0.0",
        comment="Version of the record",
    )


class StatusMixin:
    """Mixin to add status field to models."""

    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="active",
        index=True,
        comment="Status of the record",
    )
