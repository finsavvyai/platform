"""
Project management schemas for Universal Dependency Platform.
"""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    """Base project schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    slug: str = Field(
        ..., min_length=1, max_length=100, description="URL-friendly project identifier"
    )
    description: Optional[str] = Field(None, description="Project description")
    repository_url: Optional[str] = Field(
        None, max_length=500, description="Git repository URL"
    )
    repository_branch: str = Field("main", max_length=100, description="Primary branch")
    primary_language: Optional[str] = Field(
        None, max_length=50, description="Primary programming language"
    )
    ecosystem: Optional[str] = Field(
        None, max_length=50, description="Primary package ecosystem"
    )
    project_type: str = Field("polyglot", max_length=50, description="Project type")
    build_system: Optional[str] = Field(
        None, max_length=50, description="Primary build system"
    )
    analysis_frequency: str = Field(
        "daily", description="Analysis frequency: hourly, daily, weekly, monthly"
    )
    auto_scan_enabled: bool = Field(
        True, description="Enable automatic vulnerability scanning"
    )
    policy_enforcement_enabled: bool = Field(
        True, description="Enable policy enforcement"
    )


class ProjectCreate(BaseModel):
    """Project creation schema."""

    name: str = Field(..., min_length=1, max_length=255, description="Project name")
    slug: str = Field(
        ..., min_length=1, max_length=100, description="URL-friendly project identifier"
    )
    organization_id: str = Field(..., description="Organization ID")
    description: Optional[str] = Field(None, description="Project description")
    repository_url: Optional[str] = Field(
        None, max_length=500, description="Git repository URL"
    )
    repository_branch: str = Field("main", max_length=100, description="Primary branch")
    primary_language: Optional[str] = Field(
        None, max_length=50, description="Primary programming language"
    )
    ecosystem: Optional[str] = Field(
        None, max_length=50, description="Primary package ecosystem"
    )
    build_system: Optional[str] = Field(
        None, max_length=50, description="Primary build system"
    )
    analysis_frequency: str = Field("daily", description="Analysis frequency")
    auto_scan_enabled: bool = Field(
        True, description="Enable automatic vulnerability scanning"
    )
    policy_enforcement_enabled: bool = Field(
        True, description="Enable policy enforcement"
    )
    tags: Optional[list[str]] = Field(None, description="Project tags")
    settings: Optional[dict[str, Any]] = Field(None, description="Project settings")


class ProjectUpdate(BaseModel):
    """Project update schema."""

    name: Optional[str] = Field(
        None, min_length=1, max_length=255, description="Project name"
    )
    description: Optional[str] = Field(None, description="Project description")
    repository_url: Optional[str] = Field(
        None, max_length=500, description="Git repository URL"
    )
    repository_branch: Optional[str] = Field(
        None, max_length=100, description="Primary branch"
    )
    primary_language: Optional[str] = Field(
        None, max_length=50, description="Primary language"
    )
    ecosystem: Optional[str] = Field(
        None, max_length=50, description="Primary ecosystem"
    )
    build_system: Optional[str] = Field(None, max_length=50, description="Build system")
    analysis_frequency: Optional[str] = Field(None, description="Analysis frequency")
    auto_scan_enabled: Optional[bool] = Field(None, description="Enable auto scanning")
    policy_enforcement_enabled: Optional[bool] = Field(
        None, description="Enable policy enforcement"
    )
    tags: Optional[list[str]] = Field(None, description="Project tags")
    settings: Optional[dict[str, Any]] = Field(None, description="Project settings")


class ProjectResponse(BaseModel):
    """Project response schema."""

    id: str = Field(..., description="Project ID")
    organization_id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Project name")
    slug: str = Field(..., description="URL-friendly identifier")
    description: Optional[str] = Field(None, description="Project description")
    repository_url: Optional[str] = Field(None, description="Git repository URL")
    repository_branch: str = Field("main", description="Primary branch")
    primary_language: Optional[str] = Field(None, description="Primary language")
    ecosystem: Optional[str] = Field(None, description="Primary ecosystem")
    project_type: str = Field(..., description="Project type")
    status: str = Field(..., description="Project status")
    build_system: Optional[str] = Field(None, description="Build system")
    analysis_frequency: str = Field(..., description="Analysis frequency")
    auto_scan_enabled: bool = Field(..., description="Auto scanning enabled")
    policy_enforcement_enabled: bool = Field(
        ..., description="Policy enforcement enabled"
    )
    last_analysis_at: Optional[str] = Field(None, description="Last analysis timestamp")
    last_analysis_id: Optional[str] = Field(None, description="Last analysis ID")
    tags: Optional[list[str]] = Field(None, description="Project tags")
    settings: Optional[dict[str, Any]] = Field(None, description="Project settings")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")

    class Config:
        from_attributes = True


class ProjectSettingsUpdate(BaseModel):
    """Project settings update schema."""

    settings: dict[str, Any] = Field(..., description="Project settings to update")


class ProjectAnalysisConfigUpdate(BaseModel):
    """Project analysis configuration update schema."""

    config: dict[str, Any] = Field(..., description="Analysis configuration")
