"""
Project API schemas for request/response models.

Defines Pydantic models for project CRUD operations,
validation, and serialization.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, Field, validator


class ProjectStatus(str, Enum):
    """Project status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"
    DELETED = "deleted"


class ProjectType(str, Enum):
    """Project type enumeration."""

    APPLICATION = "application"
    LIBRARY = "library"
    SERVICE = "service"
    TOOL = "tool"
    FRAMEWORK = "framework"
    OTHER = "other"


class ProjectBase(BaseModel):
    """Base project schema with common fields."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    description: Optional[str] = Field(
        None, max_length=2000, description="Project description"
    )
    repository_url: Optional[str] = Field(
        None, max_length=500, description="Repository URL"
    )
    homepage_url: Optional[str] = Field(
        None, max_length=500, description="Homepage URL"
    )
    project_type: ProjectType = Field(
        ProjectType.APPLICATION, description="Type of project"
    )
    status: ProjectStatus = Field(ProjectStatus.ACTIVE, description="Project status")
    tags: Optional[List[str]] = Field(default_factory=list, description="Project tags")
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Additional project metadata"
    )

    @validator("name")
    def validate_name(cls, v):
        """Validate project name."""
        if not v or not v.strip():
            raise ValueError("Project name cannot be empty")
        return v.strip()

    @validator("repository_url")
    def validate_repository_url(cls, v):
        """Validate repository URL format if provided."""
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Repository URL must start with http:// or https://")
        return v

    @validator("homepage_url")
    def validate_homepage_url(cls, v):
        """Validate homepage URL format if provided."""
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("Homepage URL must start with http:// or https://")
        return v


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""

    organization_id: UUID = Field(
        ..., description="Organization ID the project belongs to"
    )
    settings: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Project-specific settings"
    )


class ProjectUpdate(BaseModel):
    """Schema for updating an existing project."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Project name"
    )
    description: Optional[str] = Field(
        None, max_length=2000, description="Project description"
    )
    repository_url: Optional[str] = Field(
        None, max_length=500, description="Repository URL"
    )
    homepage_url: Optional[str] = Field(
        None, max_length=500, description="Homepage URL"
    )
    project_type: Optional[ProjectType] = Field(None, description="Type of project")
    status: Optional[ProjectStatus] = Field(None, description="Project status")
    tags: Optional[List[str]] = Field(None, description="Project tags")
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional project metadata"
    )
    settings: Optional[Dict[str, Any]] = Field(
        None, description="Project-specific settings"
    )

    @validator("name")
    def validate_name(cls, v):
        """Validate project name if provided."""
        if v is not None and (not v or not v.strip()):
            raise ValueError("Project name cannot be empty")
        return v.strip() if v else v

    @validator("repository_url")
    def validate_repository_url(cls, v):
        """Validate repository URL format if provided."""
        if (
            v is not None
            and v
            and not (v.startswith("http://") or v.startswith("https://"))
        ):
            raise ValueError("Repository URL must start with http:// or https://")
        return v

    @validator("homepage_url")
    def validate_homepage_url(cls, v):
        """Validate homepage URL format if provided."""
        if (
            v is not None
            and v
            and not (v.startswith("http://") or v.startswith("https://"))
        ):
            raise ValueError("Homepage URL must start with http:// or https://")
        return v


class ProjectResponse(ProjectBase):
    """Schema for project response data."""

    id: UUID = Field(..., description="Project ID")
    organization_id: UUID = Field(..., description="Organization ID")
    settings: Dict[str, Any] = Field(
        default_factory=dict, description="Project-specific settings"
    )
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    created_by: Optional[UUID] = Field(None, description="Creator user ID")
    updated_by: Optional[UUID] = Field(None, description="Last updater user ID")

    class Config:
        """Pydantic config."""

        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class ProjectListResponse(BaseModel):
    """Schema for paginated project list response."""

    projects: List[ProjectResponse] = Field(..., description="List of projects")
    total: int = Field(..., description="Total number of projects")
    skip: int = Field(..., description="Number of projects skipped")
    limit: int = Field(..., description="Maximum number of projects returned")

    class Config:
        """Pydantic config."""

        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class ProjectSettingsUpdate(BaseModel):
    """Schema for updating project settings."""

    settings: Dict[str, Any] = Field(..., description="New project settings")


class ProjectSettingsResponse(BaseModel):
    """Schema for project settings response."""

    id: UUID = Field(..., description="Project ID")
    settings: Dict[str, Any] = Field(..., description="Project settings")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")

    class Config:
        """Pydantic config."""

        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            UUID: lambda v: str(v) if v else None,
        }


class ProjectStatsResponse(BaseModel):
    """Schema for project statistics response."""

    total_dependencies: int = Field(..., description="Total number of dependencies")
    direct_dependencies: int = Field(..., description="Number of direct dependencies")
    transitive_dependencies: int = Field(
        ..., description="Number of transitive dependencies"
    )
    vulnerabilities: int = Field(..., description="Number of security vulnerabilities")
    last_analysis: Optional[datetime] = Field(
        None, description="Last analysis timestamp"
    )
    ecosystem_breakdown: Dict[str, int] = Field(
        default_factory=dict, description="Dependencies by ecosystem"
    )

    class Config:
        """Pydantic config."""

        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
        }
