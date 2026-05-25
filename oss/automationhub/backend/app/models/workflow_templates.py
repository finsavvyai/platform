"""
Workflow Templates and Components Database Models

Database models for workflow template management including:
- Workflow templates with versioning
- Reusable components library
- Template ratings and reviews
- Categories and tags
- Usage analytics
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from enum import Enum

from sqlalchemy import (
    Column, String, Text, Boolean, DateTime, JSON, Float, Integer,
    ForeignKey, Table, Index, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship, mapped_column, Mapped
from sqlalchemy.sql import func

from app.core.database import Base


class TemplateStatus(str, Enum):
    """Workflow template status."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class ComponentStatus(str, Enum):
    """Component status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"


class ComponentType(str, Enum):
    """Component types."""
    ACTION = "action"
    TRIGGER = "trigger"
    CONDITION = "condition"
    TRANSFORM = "transform"
    INTEGRATION = "integration"
    UTILITY = "utility"
    CUSTOM = "custom"


class DifficultyLevel(str, Enum):
    """Workflow difficulty levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


# Association tables for many-to-many relationships
template_tags = Table(
    'template_tags',
    Base.metadata,
    Column('template_id', UUID(as_uuid=True), ForeignKey('workflow_templates.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True)
)

component_tags = Table(
    'component_tags',
    Base.metadata,
    Column('component_id', UUID(as_uuid=True), ForeignKey('workflow_components.id'), primary_key=True),
    Column('tag_id', UUID(as_uuid=True), ForeignKey('tags.id'), primary_key=True)
)

template_dependencies = Table(
    'template_dependencies',
    Base.metadata,
    Column('template_id', UUID(as_uuid=True), ForeignKey('workflow_templates.id'), primary_key=True),
    Column('dependency_id', UUID(as_uuid=True), ForeignKey('workflow_templates.id'), primary_key=True)
)


class WorkflowTemplate(Base):
    """Workflow template model."""
    __tablename__ = "workflow_templates"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Template definition
    definition: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Organization
    category_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('component_categories.id'))
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)

    # Metadata
    difficulty_level: Mapped[Optional[DifficultyLevel]] = mapped_column(
        String(20), default=DifficultyLevel.BEGINNER
    )
    estimated_runtime: Mapped[Optional[str]] = mapped_column(String(100))

    # Visibility and status
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[TemplateStatus] = mapped_column(
        String(20), default=TemplateStatus.DRAFT
    )
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")

    # Ratings
    rating: Mapped[Optional[float]] = mapped_column(Float)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)

    # Usage statistics
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    download_count: Mapped[int] = mapped_column(Integer, default=0)

    # Ownership
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    category = relationship("ComponentCategory", back_populates="templates")
    created_by_user = relationship("User", back_populates="created_templates")
    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan")
    ratings = relationship("TemplateRating", back_populates="template", cascade="all, delete-orphan")
    usage_logs = relationship("TemplateUsageLog", back_populates="template", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_template_name', 'name'),
        Index('idx_template_category', 'category_id'),
        Index('idx_template_status', 'status'),
        Index('idx_template_public', 'is_public'),
        Index('idx_template_featured', 'is_featured'),
        Index('idx_template_rating', 'rating'),
        Index('idx_template_created_by', 'created_by'),
        Index('idx_template_created_at', 'created_at'),
        Index('idx_template_tags', 'tags', postgresql_using='gin'),
        UniqueConstraint('name', 'created_by', name='uq_template_name_user'),
    )


class WorkflowComponent(Base):
    """Reusable workflow component model."""
    __tablename__ = "workflow_components"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Basic information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # Component configuration
    component_type: Mapped[ComponentType] = mapped_column(String(50), nullable=False)
    category_id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('component_categories.id'))

    # Component definition and schemas
    definition: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    input_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    output_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    # Configuration options
    configuration_schema: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)
    default_configuration: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    # Organization
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)

    # Visibility and status
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[ComponentStatus] = mapped_column(
        String(20), default=ComponentStatus.ACTIVE
    )

    # Usage statistics
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[Optional[float]] = mapped_column(Float)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)

    # Version information
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")

    # Ownership
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )
    verified_by: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    category = relationship("ComponentCategory", back_populates="components")
    created_by_user = relationship("User", back_populates="created_components", foreign_keys=[created_by])
    verified_by_user = relationship("User", back_populates="verified_components", foreign_keys=[verified_by])
    usage_logs = relationship("ComponentUsageLog", back_populates="component", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_component_name', 'name'),
        Index('idx_component_type', 'component_type'),
        Index('idx_component_category', 'category_id'),
        Index('idx_component_status', 'status'),
        Index('idx_component_public', 'is_public'),
        Index('idx_component_verified', 'is_verified'),
        Index('idx_component_rating', 'rating'),
        Index('idx_component_created_by', 'created_by'),
        Index('idx_component_created_at', 'created_at'),
        Index('idx_component_tags', 'tags', postgresql_using='gin'),
        CheckConstraint('rating >= 0 AND rating <= 5', name='check_component_rating_range'),
    )


class ComponentCategory(Base):
    """Category for organizing templates and components."""
    __tablename__ = "component_categories"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Category information
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    icon: Mapped[Optional[str]] = mapped_column(String(100))
    color: Mapped[Optional[str]] = mapped_column(String(20))  # Hex color code

    # Category settings
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    applies_to_templates: Mapped[bool] = mapped_column(Boolean, default=True)
    applies_to_components: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sorting
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Parent category for hierarchical structure
    parent_id: Mapped[Optional[UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('component_categories.id'))

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    templates = relationship("WorkflowTemplate", back_populates="category")
    components = relationship("WorkflowComponent", back_populates="category")
    parent = relationship("ComponentCategory", remote_side=[id])
    children = relationship("ComponentCategory")

    # Indexes
    __table_args__ = (
        Index('idx_category_active', 'is_active'),
        Index('idx_category_sort_order', 'sort_order'),
        Index('idx_category_parent', 'parent_id'),
    )


class TemplateVersion(Base):
    """Version history for workflow templates."""
    __tablename__ = "template_versions"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Version information
    template_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('workflow_templates.id'), nullable=False
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)

    # Version data
    definition: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    changelog: Mapped[Optional[str]] = mapped_column(Text)

    # Version metadata
    is_major: Mapped[bool] = mapped_column(Boolean, default=False)
    is_breaking: Mapped[bool] = mapped_column(Boolean, default=False)

    # Ownership
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="versions")
    created_by_user = relationship("User")

    # Indexes
    __table_args__ = (
        Index('idx_version_template', 'template_id'),
        Index('idx_version_number', 'template_id', 'version'),
        UniqueConstraint('template_id', 'version', name='uq_template_version'),
    )


class TemplateRating(Base):
    """User ratings and reviews for templates."""
    __tablename__ = "template_ratings"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Rating information
    template_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('workflow_templates.id'), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )

    # Rating details
    rating: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5 stars
    review: Mapped[Optional[str]] = mapped_column(Text)

    # Helpful votes
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="ratings")
    user = relationship("User")

    # Indexes
    __table_args__ = (
        Index('idx_rating_template', 'template_id'),
        Index('idx_rating_user', 'user_id'),
        Index('idx_rating_value', 'rating'),
        UniqueConstraint('template_id', 'user_id', name='uq_template_user_rating'),
        CheckConstraint('rating >= 1 AND rating <= 5', name='check_rating_range'),
    )


class Tag(Base):
    """Tag model for categorizing templates and components."""
    __tablename__ = "tags"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Tag information
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    color: Mapped[Optional[str]] = mapped_column(String(20))  # Hex color code

    # Tag statistics
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Indexes
    __table_args__ = (
        Index('idx_tag_name', 'name'),
        Index('idx_tag_usage_count', 'usage_count'),
    )


class TemplateUsageLog(Base):
    """Usage logs for workflow templates."""
    __tablename__ = "template_usage_logs"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Usage information
    template_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('workflow_templates.id'), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )

    # Usage type
    usage_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'view', 'instantiate', 'download'

    # Additional context
    context: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="usage_logs")
    user = relationship("User")

    # Indexes
    __table_args__ = (
        Index('idx_usage_template', 'template_id'),
        Index('idx_usage_user', 'user_id'),
        Index('idx_usage_type', 'usage_type'),
        Index('idx_usage_created_at', 'created_at'),
    )


class ComponentUsageLog(Base):
    """Usage logs for workflow components."""
    __tablename__ = "component_usage_logs"

    id: Mapped[UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Usage information
    component_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('workflow_components.id'), nullable=False
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('users.id'), nullable=False
    )

    # Usage type
    usage_type: Mapped[str] = mapped_column(String(50), nullable=False)  # 'view', 'use', 'copy'

    # Additional context
    context: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    component = relationship("WorkflowComponent", back_populates="usage_logs")
    user = relationship("User")

    # Indexes
    __table_args__ = (
        Index('idx_comp_usage_component', 'component_id'),
        Index('idx_comp_usage_user', 'user_id'),
        Index('idx_comp_usage_type', 'usage_type'),
        Index('idx_comp_usage_created_at', 'created_at'),
    )