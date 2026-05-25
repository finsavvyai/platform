"""
Remediation database models for Universal Dependency Platform.

Defines SQLAlchemy models for storing and tracking remediation suggestions,
fix applications, and automated remediation workflows.
"""

from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import uuid4, UUID

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    JSON,
    Text,
    ForeignKey,
    Index,
    Float,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, ARRAY
from sqlalchemy.orm import relationship

from .base import Base
import enum


class RemediationType(enum.Enum):
    """Types of remediation suggestions."""

    VERSION_BUMP = "version_bump"
    ALTERNATIVE_PACKAGE = "alternative_package"
    PATCH_APPLICATION = "patch_application"
    CONFIGURATION_CHANGE = "configuration_change"
    DEPENDENCY_REMOVAL = "dependency_removal"
    SECURITY_PATCH = "security_patch"


class RemediationPriority(enum.Enum):
    """Priority levels for remediation actions."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class RemediationStatus(enum.Enum):
    """Status of remediation suggestions."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPLIED = "applied"
    FAILED = "failed"
    EXPIRED = "expired"


class BreakingChangeRisk(enum.Enum):
    """Risk levels for breaking changes."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class RemediationSuggestionModel(Base):
    """Remediation suggestion model for storing fix recommendations."""

    __tablename__ = "remediation_suggestions"

    # Primary fields
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Relationships
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    vulnerability_id = Column(
        String(50),
        ForeignKey("vulnerabilities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    dependency_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("dependencies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    analysis_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("analysis_sessions.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Suggestion details
    remediation_type = Column(
        Enum(RemediationType),
        nullable=False,
        index=True,
        comment="Type of remediation suggested",
    )
    priority = Column(
        Enum(RemediationPriority),
        nullable=False,
        index=True,
        comment="Priority level of the remediation",
    )
    status = Column(
        Enum(RemediationStatus),
        default=RemediationStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current status of the remediation",
    )

    # Content
    title = Column(
        String(500),
        nullable=False,
        comment="Brief title of the remediation suggestion",
    )
    description = Column(
        Text,
        nullable=False,
        comment="Detailed description of the remediation",
    )

    # Version bump specific fields
    current_version = Column(
        String(100),
        nullable=True,
        comment="Current version of the dependency",
    )
    suggested_version = Column(
        String(100),
        nullable=True,
        comment="Suggested version to upgrade to",
    )
    vulnerability_fixes = Column(
        ARRAY(String),
        default=list,
        nullable=False,
        comment="List of vulnerability IDs fixed by this version bump",
    )
    breaking_change_risk = Column(
        Enum(BreakingChangeRisk),
        default=BreakingChangeRisk.NONE,
        nullable=False,
        comment="Risk level of breaking changes",
    )
    changelog_summary = Column(
        Text,
        nullable=True,
        comment="Summary of changes in the new version",
    )
    download_url = Column(
        String(500),
        nullable=True,
        comment="Download URL for the suggested version",
    )

    # Alternative package specific fields
    original_package = Column(
        String(255),
        nullable=True,
        comment="Original package name to be replaced",
    )
    alternative_package = Column(
        String(255),
        nullable=True,
        comment="Alternative package name",
    )
    compatibility_score = Column(
        Float,
        nullable=True,
        comment="Compatibility score with original package (0-1)",
    )
    api_similarity_score = Column(
        Float,
        nullable=True,
        comment="API similarity score (0-1)",
    )
    migration_effort = Column(
        String(100),
        nullable=True,
        comment="Estimated effort for migration",
    )
    migration_guide = Column(
        Text,
        nullable=True,
        comment="Detailed migration guide",
    )

    # Patch specific fields
    patch_type = Column(
        String(50),
        nullable=True,
        comment="Type of patch (security, bug_fix, etc.)",
    )
    patch_source = Column(
        String(100),
        nullable=True,
        comment="Source of the patch",
    )
    patch_url = Column(
        String(500),
        nullable=True,
        comment="URL to download the patch",
    )
    patch_description = Column(
        Text,
        nullable=True,
        comment="Description of the patch",
    )
    application_instructions = Column(
        Text,
        nullable=True,
        comment="Instructions to apply the patch",
    )
    rollback_instructions = Column(
        Text,
        nullable=True,
        comment="Instructions to rollback the patch",
    )

    # General fields
    prerequisites = Column(
        JSON,
        default=list,
        nullable=False,
        comment="Prerequisites for applying the remediation",
    )
    side_effects = Column(
        JSON,
        default=list,
        nullable=False,
        comment="Potential side effects of the remediation",
    )
    estimated_effort = Column(
        String(100),
        nullable=True,
        comment="Estimated effort to apply the fix",
    )
    automated_fix_available = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether an automated fix is available",
    )
    automated_fix_script = Column(
        Text,
        nullable=True,
        comment="Script for automated fix application",
    )
    confidence_score = Column(
        Float,
        default=0.0,
        nullable=False,
        index=True,
        comment="Confidence score of the suggestion (0-1)",
    )

    # Audit fields
    created_at = Column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default="now()",
        onupdate="now()",
        nullable=False,
    )
    expires_at = Column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When this suggestion expires",
    )
    created_by = Column(
        String(100),
        nullable=True,
        comment="User or system that created the suggestion",
    )
    approved_by = Column(
        String(100),
        nullable=True,
        comment="User who approved the suggestion",
    )
    approved_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the suggestion was approved",
    )
    applied_by = Column(
        String(100),
        nullable=True,
        comment="User who applied the suggestion",
    )
    applied_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the suggestion was applied",
    )

    # Metadata
    metadata_json = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Additional metadata",
    )

    # Relationships
    project = relationship("ProjectModel", back_populates="remediation_suggestions")
    vulnerability = relationship(
        "Vulnerability", back_populates="remediation_suggestions"
    )
    dependency = relationship(
        "DependencyModel", back_populates="remediation_suggestions"
    )
    analysis_session = relationship(
        "AnalysisSessionModel", back_populates="remediation_suggestions"
    )
    fix_applications = relationship(
        "FixApplicationModel",
        back_populates="suggestion",
        cascade="all, delete-orphan",
    )

    # Indexes
    __table_args__ = (
        Index("ix_remediation_suggestions_project_priority", "project_id", "priority"),
        Index(
            "ix_remediation_suggestions_vulnerability_type",
            "vulnerability_id",
            "remediation_type",
        ),
        Index("ix_remediation_suggestions_status_created", "status", "created_at"),
        Index("ix_remediation_suggestions_confidence", "confidence_score"),
        Index("ix_remediation_suggestions_expires", "expires_at"),
    )


class FixApplicationModel(Base):
    """Model for tracking fix applications and their results."""

    __tablename__ = "fix_applications"

    # Primary fields
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Relationships
    suggestion_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("remediation_suggestions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Application details
    application_method = Column(
        String(50),
        nullable=False,
        comment="How the fix was applied (automated, manual, etc.)",
    )
    status = Column(
        String(20),
        default="pending",
        nullable=False,
        index=True,
        comment="Status of the fix application",
    )

    # Execution details
    started_at = Column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
        comment="When the fix application started",
    )
    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When the fix application completed",
    )
    duration_seconds = Column(
        Float,
        nullable=True,
        comment="Duration of the fix application in seconds",
    )

    # Results
    success = Column(
        Boolean,
        nullable=True,
        comment="Whether the fix was applied successfully",
    )
    result_message = Column(
        Text,
        nullable=True,
        comment="Result message of the fix application",
    )
    error_message = Column(
        Text,
        nullable=True,
        comment="Error message if the fix failed",
    )

    # Changes made
    files_modified = Column(
        JSON,
        default=list,
        nullable=False,
        comment="List of files modified by the fix",
    )
    dependencies_changed = Column(
        JSON,
        default=list,
        nullable=False,
        comment="List of dependencies changed",
    )
    test_results = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Results of tests run after the fix",
    )

    # Verification
    verification_status = Column(
        String(20),
        nullable=True,
        comment="Status of fix verification",
    )
    verification_details = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Details of verification process",
    )

    # Rollback information
    backup_created = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether a backup was created",
    )
    backup_path = Column(
        String(500),
        nullable=True,
        comment="Path to the backup",
    )
    rollback_possible = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether the fix can be rolled back",
    )
    rollback_instructions = Column(
        Text,
        nullable=True,
        comment="Instructions for rolling back the fix",
    )

    # Audit fields
    applied_by = Column(
        String(100),
        nullable=True,
        comment="User who applied the fix",
    )
    environment = Column(
        String(50),
        nullable=True,
        comment="Environment where fix was applied (dev, staging, prod)",
    )

    # Metadata
    metadata_json = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Additional metadata",
    )

    # Relationships
    suggestion = relationship(
        "RemediationSuggestionModel", back_populates="fix_applications"
    )
    project = relationship("ProjectModel", back_populates="fix_applications")

    # Indexes
    __table_args__ = (
        Index("ix_fix_applications_suggestion_status", "suggestion_id", "status"),
        Index("ix_fix_applications_project_success", "project_id", "success"),
        Index("ix_fix_applications_started", "started_at"),
    )


class RemediationTemplateModel(Base):
    """Model for storing reusable remediation templates."""

    __tablename__ = "remediation_templates"

    # Primary fields
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Template details
    name = Column(
        String(255),
        nullable=False,
        index=True,
        comment="Name of the remediation template",
    )
    description = Column(
        Text,
        nullable=False,
        comment="Description of the template",
    )

    # Classification
    remediation_type = Column(
        Enum(RemediationType),
        nullable=False,
        index=True,
        comment="Type of remediation this template provides",
    )
    ecosystem = Column(
        String(50),
        nullable=True,
        index=True,
        comment="Ecosystem this template applies to",
    )
    vulnerability_patterns = Column(
        JSON,
        default=list,
        nullable=False,
        comment="Patterns of vulnerabilities this template applies to",
    )

    # Template content
    template_script = Column(
        Text,
        nullable=True,
        comment="Template script for automated fix",
    )
    template_instructions = Column(
        Text,
        nullable=True,
        comment="Template instructions for manual fix",
    )
    prerequisites_template = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Template for prerequisites",
    )
    validation_template = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Template for validation",
    )

    # Usage tracking
    usage_count = Column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of times this template has been used",
    )
    success_rate = Column(
        Float,
        default=0.0,
        nullable=False,
        comment="Success rate of this template",
    )
    last_used_at = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="When this template was last used",
    )

    # Status
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether this template is active",
    )
    is_public = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this template is publicly available",
    )

    # Audit fields
    created_at = Column(
        DateTime(timezone=True),
        server_default="now()",
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default="now()",
        onupdate="now()",
        nullable=False,
    )
    created_by = Column(
        String(100),
        nullable=True,
        comment="User who created this template",
    )

    # Metadata
    metadata_json = Column(
        JSON,
        default=dict,
        nullable=False,
        comment="Additional metadata",
    )

    # Indexes
    __table_args__ = (
        Index(
            "ix_remediation_templates_type_ecosystem", "remediation_type", "ecosystem"
        ),
        Index("ix_remediation_templates_active_success", "is_active", "success_rate"),
        Index("ix_remediation_templates_usage", "usage_count"),
    )
