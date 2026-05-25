"""
Domain models for automated remediation functionality.

Defines data structures and enums for remediation suggestions,
fix generation, and vulnerability mitigation strategies.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator


class RemediationType(str, Enum):
    """Types of remediation suggestions."""

    VERSION_BUMP = "version_bump"
    ALTERNATIVE_PACKAGE = "alternative_package"
    PATCH_APPLICATION = "patch_application"
    CONFIGURATION_CHANGE = "configuration_change"
    DEPENDENCY_REMOVAL = "dependency_removal"
    SECURITY_PATCH = "security_patch"
    VULNERABILITY_ACCEPTANCE = "vulnerability_acceptance"
    TEMPORARY_MITIGATION = "temporary_mitigation"


class RemediationPriority(str, Enum):
    """Priority levels for remediation actions."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class BreakingChangeRisk(str, Enum):
    """Risk levels for breaking changes."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"
    UNKNOWN = "unknown"


class FixComplexity(str, Enum):
    """Complexity levels for applying fixes."""

    TRIVIAL = "trivial"
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    VERY_COMPLEX = "very_complex"


class RemediationStatus(str, Enum):
    """Status of remediation application."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    APPLIED = "applied"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"
    SKIPPED = "skipped"


# Pydantic models for API serialization


class VersionBumpModel(BaseModel):
    """Version bump remediation model."""

    current_version: str = Field(..., description="Current package version")
    suggested_version: str = Field(..., description="Suggested new version")
    vulnerability_fixes: list[str] = Field(
        default_factory=list, description="List of vulnerability IDs this version fixes"
    )
    breaking_change_risk: BreakingChangeRisk = Field(
        default=BreakingChangeRisk.NONE, description="Risk of breaking changes"
    )
    changelog_summary: str = Field(
        default="", description="Summary of changes in new version"
    )
    download_url: Optional[str] = Field(
        None, description="Download URL for new version"
    )
    release_date: Optional[datetime] = Field(
        None, description="Release date of new version"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence in this suggestion (0-1)"
    )
    effort_estimate: str = Field(default="", description="Estimated effort to apply")
    complexity: FixComplexity = Field(default=FixComplexity.SIMPLE)
    test_requirements: list[str] = Field(default_factory=list)

    @validator("confidence_score")
    def validate_confidence(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        return v


class AlternativePackageModel(BaseModel):
    """Alternative package remediation model."""

    original_package: str = Field(..., description="Original package name")
    alternative_package: str = Field(..., description="Alternative package name")
    ecosystem: str = Field(..., description="Package ecosystem")
    compatibility_score: float = Field(
        ..., ge=0.0, le=1.0, description="Compatibility with original (0-1)"
    )
    api_similarity_score: float = Field(
        ..., ge=0.0, le=1.0, description="API similarity score (0-1)"
    )
    maintenance_score: float = Field(
        ..., ge=0.0, le=1.0, description="Maintenance quality score (0-1)"
    )
    security_score: float = Field(
        ..., ge=0.0, le=1.0, description="Security assessment score (0-1)"
    )
    popularity_score: float = Field(
        ..., ge=0.0, le=1.0, description="Popularity score (0-1)"
    )
    migration_effort: str = Field(..., description="Estimated migration effort")
    migration_guide: str = Field(default="", description="Detailed migration guide")
    code_changes_required: list[str] = Field(
        default_factory=list, description="List of required code changes"
    )
    benefits: list[str] = Field(
        default_factory=list, description="Benefits of switching"
    )
    drawbacks: list[str] = Field(
        default_factory=list, description="Drawbacks of switching"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence in this suggestion (0-1)"
    )
    complexity: FixComplexity = Field(default=FixComplexity.MODERATE)

    @validator(
        "compatibility_score",
        "api_similarity_score",
        "maintenance_score",
        "security_score",
        "popularity_score",
    )
    def validate_scores(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Score must be between 0 and 1")
        return v


class PatchModel(BaseModel):
    """Patch application remediation model."""

    patch_type: str = Field(..., description="Type of patch")
    patch_source: str = Field(..., description="Source of the patch")
    patch_url: Optional[str] = Field(None, description="URL to patch file")
    patch_description: str = Field(..., description="Description of the patch")
    application_instructions: str = Field(
        ..., description="Instructions to apply patch"
    )
    rollback_instructions: str = Field(
        default="", description="Instructions to rollback patch"
    )
    testing_required: bool = Field(
        default=True, description="Whether testing is required"
    )
    test_cases: list[str] = Field(
        default_factory=list, description="Test cases to verify patch"
    )
    estimated_downtime: str = Field(
        default="", description="Estimated downtime during application"
    )
    risk_assessment: str = Field(
        default="", description="Risk assessment of applying patch"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence in this suggestion (0-1)"
    )
    complexity: FixComplexity = Field(default=FixComplexity.COMPLEX)

    @validator("confidence_score")
    def validate_confidence(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        return v


class ConfigurationChangeModel(BaseModel):
    """Configuration change remediation model."""

    config_file: str = Field(..., description="Configuration file to modify")
    current_config: dict[str, Any] = Field(..., description="Current configuration")
    suggested_config: dict[str, Any] = Field(..., description="Suggested configuration")
    change_description: str = Field(
        ..., description="Description of configuration changes"
    )
    validation_steps: list[str] = Field(
        default_factory=list, description="Steps to validate changes"
    )
    rollback_steps: list[str] = Field(
        default_factory=list, description="Steps to rollback changes"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Confidence in this suggestion (0-1)"
    )
    complexity: FixComplexity = Field(default=FixComplexity.SIMPLE)

    @validator("confidence_score")
    def validate_confidence(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        return v


class RemediationSuggestionModel(BaseModel):
    """Complete remediation suggestion model."""

    id: UUID = Field(default_factory=uuid4, description="Unique suggestion identifier")
    vulnerability_id: str = Field(..., description="Vulnerability ID this addresses")
    dependency_id: str = Field(..., description="Dependency ID requiring remediation")
    project_id: str = Field(..., description="Project ID")
    remediation_type: RemediationType = Field(..., description="Type of remediation")
    priority: RemediationPriority = Field(..., description="Priority level")
    title: str = Field(..., description="Short title of the suggestion")
    description: str = Field(..., description="Detailed description")

    # Type-specific data
    version_bump: Optional[VersionBumpModel] = Field(
        None, description="Version bump details"
    )
    alternative_package: Optional[AlternativePackageModel] = Field(
        None, description="Alternative package details"
    )
    patch: Optional[PatchModel] = Field(None, description="Patch details")
    configuration_change: Optional[ConfigurationChangeModel] = Field(
        None, description="Configuration change details"
    )

    # Common fields
    prerequisites: list[str] = Field(
        default_factory=list, description="Prerequisites for applying"
    )
    side_effects: list[str] = Field(
        default_factory=list, description="Potential side effects"
    )
    estimated_effort: str = Field(default="", description="Estimated effort to apply")
    automated_fix_available: bool = Field(
        default=False, description="Whether automated fix is available"
    )
    automated_fix_script: str = Field(
        default="", description="Script for automated fix"
    )
    confidence_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Overall confidence score (0-1)"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp"
    )
    expires_at: Optional[datetime] = Field(None, description="Expiration timestamp")
    status: RemediationStatus = Field(
        default=RemediationStatus.PENDING, description="Application status"
    )

    # Metadata
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    tags: list[str] = Field(default_factory=list, description="Tags for categorization")

    class Config:
        use_enum_values = True

    @validator("confidence_score")
    def validate_confidence(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Confidence score must be between 0 and 1")
        return v


class RemediationPlanModel(BaseModel):
    """Collection of remediation suggestions forming a plan."""

    id: UUID = Field(default_factory=uuid4, description="Unique plan identifier")
    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., description="Plan name")
    description: str = Field(default="", description="Plan description")
    suggestions: list[RemediationSuggestionModel] = Field(
        ..., description="Remediation suggestions"
    )

    # Plan-level information
    total_effort_estimate: str = Field(default="", description="Total estimated effort")
    risk_assessment: str = Field(default="", description="Overall risk assessment")
    dependencies: list[str] = Field(
        default_factory=list, description="Dependencies between suggestions"
    )

    # Execution information
    created_at: datetime = Field(
        default_factory=datetime.utcnow, description="Creation timestamp"
    )
    created_by: Optional[str] = Field(None, description="Creator")
    scheduled_at: Optional[datetime] = Field(
        None, description="Scheduled execution time"
    )
    started_at: Optional[datetime] = Field(None, description="Execution start time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")

    # Status
    status: str = Field(default="draft", description="Plan status")

    class Config:
        use_enum_values = True


class RemediationExecutionResult(BaseModel):
    """Result of executing a remediation suggestion."""

    id: UUID = Field(default_factory=uuid4, description="Unique execution ID")
    suggestion_id: UUID = Field(..., description="Suggestion ID that was executed")
    project_id: str = Field(..., description="Project ID")

    # Execution details
    executed_at: datetime = Field(
        default_factory=datetime.utcnow, description="Execution timestamp"
    )
    executed_by: Optional[str] = Field(None, description="Executor")
    execution_method: str = Field(
        ..., description="How it was executed (automated/manual)"
    )

    # Results
    success: bool = Field(..., description="Whether execution was successful")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    changes_made: list[str] = Field(
        default_factory=list, description="List of changes made"
    )
    artifacts_created: list[str] = Field(
        default_factory=list, description="Artifacts created"
    )

    # Verification
    verification_status: str = Field(
        default="pending", description="Verification status"
    )
    verification_results: dict[str, Any] = Field(
        default_factory=dict, description="Verification details"
    )

    # Rollback information
    backup_created: bool = Field(
        default=False, description="Whether backup was created"
    )
    backup_location: Optional[str] = Field(None, description="Backup location")
    rollback_available: bool = Field(
        default=False, description="Whether rollback is possible"
    )
    rolled_back_at: Optional[datetime] = Field(None, description="Rollback timestamp")

    # Metadata
    metadata: dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    class Config:
        use_enum_values = True


class RemediationAnalytics(BaseModel):
    """Analytics data for remediation effectiveness."""

    project_id: str = Field(..., description="Project ID")
    time_period: str = Field(..., description="Time period for analytics")

    # Metrics
    total_suggestions_generated: int = Field(
        default=0, description="Total suggestions generated"
    )
    suggestions_applied: int = Field(default=0, description="Suggestions applied")
    success_rate: float = Field(
        default=0.0, description="Success rate of applied suggestions"
    )

    # Type breakdown
    version_bumps: int = Field(default=0, description="Version bump suggestions")
    alternative_packages: int = Field(
        default=0, description="Alternative package suggestions"
    )
    patches_applied: int = Field(default=0, description="Patches applied")
    configuration_changes: int = Field(default=0, description="Configuration changes")

    # Time metrics
    avg_time_to_apply: str = Field(
        default="", description="Average time to apply suggestions"
    )
    vulnerabilities_fixed: int = Field(
        default=0, description="Number of vulnerabilities fixed"
    )

    # Risk metrics
    breaking_changes_encountered: int = Field(
        default=0, description="Breaking changes encountered"
    )
    rollbacks_performed: int = Field(default=0, description="Rollbacks performed")

    # Generated timestamp
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True
