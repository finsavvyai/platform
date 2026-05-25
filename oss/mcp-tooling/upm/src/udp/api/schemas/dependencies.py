"""
Dependency API schemas for request/response models.

Defines Pydantic models for dependency CRUD operations,
validation, and serialization.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


class EcosystemType(str, Enum):
    """Supported dependency ecosystems."""

    NPM = "npm"
    PYPI = "pypi"
    MAVEN = "maven"
    GRADLE = "gradle"
    CARGO = "cargo"
    COMPOSER = "composer"
    RUBYGEMS = "rubygems"
    GO = "go"
    NUGET = "nuget"
    DOCKER = "docker"


class DependencyStatus(str, Enum):
    """Dependency status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DEPRECATED = "deprecated"
    VULNERABLE = "vulnerable"
    OUTDATED = "outdated"


class DependencyScope(str, Enum):
    """Dependency scope enumeration."""

    PRODUCTION = "production"
    DEVELOPMENT = "development"
    OPTIONAL = "optional"
    PEER = "peer"
    TEST = "test"


class DependencyBase(BaseModel):
    """Base dependency schema with common fields."""

    package_id: UUID = Field(..., description="Package ID")
    version_constraint: str = Field(
        ..., min_length=1, description="Version constraint (e.g., ^1.0.0, ~2.1.3)"
    )
    ecosystem: EcosystemType = Field(..., description="Package ecosystem")
    scope: DependencyScope = Field(
        DependencyScope.PRODUCTION, description="Dependency scope"
    )
    is_direct: bool = Field(True, description="Whether this is a direct dependency")
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Additional dependency metadata"
    )

    @validator("version_constraint")
    def validate_version_constraint(cls, v):
        """Validate version constraint format."""
        if not v or not v.strip():
            raise ValueError("Version constraint cannot be empty")
        return v.strip()


class DependencyCreate(DependencyBase):
    """Schema for creating a new dependency."""

    project_id: UUID = Field(..., description="Project ID the dependency belongs to")


class DependencyUpdate(BaseModel):
    """Schema for updating an existing dependency."""

    version_constraint: Optional[str] = Field(
        None, min_length=1, description="Version constraint"
    )
    scope: Optional[DependencyScope] = Field(None, description="Dependency scope")
    is_direct: Optional[bool] = Field(
        None, description="Whether this is a direct dependency"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional dependency metadata"
    )

    @validator("version_constraint")
    def validate_version_constraint(cls, v):
        """Validate version constraint if provided."""
        if v is not None and (not v or not v.strip()):
            raise ValueError("Version constraint cannot be empty")
        return v.strip() if v else v


class DependencyResponse(DependencyBase):
    """Schema for dependency response data."""

    id: UUID = Field(..., description="Dependency ID")
    project_id: UUID = Field(..., description="Project ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[UUID] = Field(None, description="Creator user ID")
    updated_by: Optional[UUID] = Field(None, description="Last updater user ID")

    # Optional related data
    package_name: Optional[str] = Field(None, description="Package name")
    package_version: Optional[str] = Field(None, description="Current package version")
    package_description: Optional[str] = Field(None, description="Package description")
    vulnerability_count: Optional[int] = Field(
        0, description="Number of known vulnerabilities"
    )

    class Config:
        """Pydantic config."""

        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class DependencyListResponse(BaseModel):
    """Schema for paginated dependency list response."""

    dependencies: List[DependencyResponse] = Field(
        ..., description="List of dependencies"
    )
    total: int = Field(..., description="Total number of dependencies")
    skip: int = Field(..., description="Number of dependencies skipped")
    limit: int = Field(..., description="Maximum number of dependencies returned")

    class Config:
        """Pydantic config."""

        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class DependencyTreeResponse(BaseModel):
    """Schema for dependency tree response."""

    project_id: UUID = Field(..., description="Project ID")
    dependencies: List[Dict[str, Any]] = Field(
        ..., description="Dependency tree structure"
    )
    total_dependencies: int = Field(..., description="Total number of dependencies")
    max_depth: int = Field(..., description="Maximum depth of the dependency tree")

    class Config:
        """Pydantic config."""

        json_encoders = {
            UUID: lambda v: str(v) if v else None,
        }


class DependencyConflictResponse(BaseModel):
    """Schema for dependency conflict analysis response."""

    conflicts: List[Dict[str, Any]] = Field(
        ..., description="List of dependency conflicts"
    )
    total_conflicts: int = Field(..., description="Total number of conflicts")
    severity_counts: Dict[str, int] = Field(
        ..., description="Count of conflicts by severity"
    )

    class Config:
        """Pydantic config."""

        json_encoders = {
            UUID: lambda v: str(v) if v else None,
        }


class DependencyAnalysisResponse(BaseModel):
    """Schema for dependency analysis response."""

    project_id: UUID = Field(..., description="Project ID")
    analysis_timestamp: datetime = Field(..., description="When analysis was performed")
    summary: Dict[str, Any] = Field(..., description="Analysis summary")
    dependencies: List[DependencyResponse] = Field(
        ..., description="Analyzed dependencies"
    )
    recommendations: List[Dict[str, Any]] = Field(
        default_factory=list, description="Recommendations"
    )
    issues: List[Dict[str, Any]] = Field(
        default_factory=list, description="Issues found"
    )

    class Config:
        """Pydantic config."""

        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class BatchDependencyCreate(BaseModel):
    """Schema for creating multiple dependencies at once."""

    dependencies: List[DependencyCreate] = Field(
        ..., min_items=1, description="List of dependencies to create"
    )
    overwrite_existing: bool = Field(
        False, description="Whether to overwrite existing dependencies"
    )


class BatchDependencyResponse(BaseModel):
    """Schema for batch dependency operation response."""

    created_count: int = Field(..., description="Number of dependencies created")
    updated_count: int = Field(..., description="Number of dependencies updated")
    skipped_count: int = Field(..., description="Number of dependencies skipped")
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="List of errors that occurred"
    )

    class Config:
        """Pydantic config."""

        json_encoders = {
            UUID: lambda v: str(v) if v else None,
        }
