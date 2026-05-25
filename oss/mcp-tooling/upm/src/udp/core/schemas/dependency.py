"""
Dependency management schemas for Universal Dependency Platform.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class DependencyLanguage(str, Enum):
    """Supported programming languages."""

    JAVA = "java"
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    CSHARP = "csharp"
    RUBY = "ruby"
    PHP = "php"


class DependencyFramework(str, Enum):
    """Supported frameworks."""

    SPRING = "spring"
    DJANGO = "django"
    FLASK = "flask"
    FASTAPI = "fastapi"
    EXPRESS = "express"
    REACT = "react"
    ANGULAR = "angular"
    VUE = "vue"
    RAILS = "rails"
    LARAVEL = "laravel"


class VulnerabilitySeverity(str, Enum):
    """Vulnerability severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class LicenseType(str, Enum):
    """Common license types."""

    MIT = "MIT"
    APACHE = "Apache-2.0"
    GPL = "GPL"
    BSD = "BSD"
    ISC = "ISC"
    PROPRIETARY = "proprietary"


class DependencyBase(BaseModel):
    """Base dependency schema."""

    name: str = Field(..., description="Dependency name")
    version: str = Field(..., description="Dependency version")
    language: DependencyLanguage = Field(..., description="Programming language")
    framework: Optional[DependencyFramework] = Field(None, description="Framework")
    description: Optional[str] = Field(None, description="Dependency description")
    repository_url: Optional[str] = Field(None, description="Source repository URL")
    license: Optional[LicenseType] = Field(None, description="License type")
    is_active: bool = Field(True, description="Whether dependency is active")


class DependencyCreate(DependencyBase):
    """Dependency creation schema."""

    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class DependencyUpdate(BaseModel):
    """Dependency update schema."""

    name: Optional[str] = Field(None, description="Dependency name")
    version: Optional[str] = Field(None, description="Dependency version")
    language: Optional[DependencyLanguage] = Field(
        None, description="Programming language"
    )
    framework: Optional[DependencyFramework] = Field(None, description="Framework")
    description: Optional[str] = Field(None, description="Dependency description")
    repository_url: Optional[str] = Field(None, description="Source repository URL")
    license: Optional[LicenseType] = Field(None, description="License type")
    is_active: Optional[bool] = Field(None, description="Whether dependency is active")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class DependencyResponse(DependencyBase):
    """Dependency response schema."""

    id: str = Field(..., description="Dependency ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    class Config:
        from_attributes = True


class Vulnerability(BaseModel):
    """Vulnerability schema."""

    id: str = Field(..., description="Vulnerability ID")
    title: str = Field(..., description="Vulnerability title")
    description: str = Field(..., description="Vulnerability description")
    severity: VulnerabilitySeverity = Field(..., description="Severity level")
    cvss_score: Optional[float] = Field(None, description="CVSS score")
    cve_id: Optional[str] = Field(None, description="CVE identifier")
    published_at: Optional[datetime] = Field(None, description="Publication date")
    patched_versions: Optional[List[str]] = Field(None, description="Patched versions")


class DependencyAnalysis(BaseModel):
    """Dependency analysis result schema."""

    dependency_id: str = Field(..., description="Dependency ID")
    vulnerabilities: List[Vulnerability] = Field(
        default_factory=list, description="Security vulnerabilities"
    )
    compatibility_score: float = Field(..., description="Compatibility score (0-1)")
    maintenance_score: float = Field(..., description="Maintenance score (0-1)")
    popularity_score: float = Field(..., description="Popularity score (0-1)")
    license_compatible: bool = Field(..., description="License compatibility")
    recommendations: List[str] = Field(
        default_factory=list, description="Recommendations"
    )
    analyzed_at: datetime = Field(..., description="Analysis timestamp")


class DependencySearch(BaseModel):
    """Dependency search schema."""

    query: Optional[str] = Field(None, description="Search query")
    language: Optional[DependencyLanguage] = Field(
        None, description="Programming language filter"
    )
    framework: Optional[DependencyFramework] = Field(
        None, description="Framework filter"
    )
    license: Optional[LicenseType] = Field(None, description="License filter")
    min_version: Optional[str] = Field(None, description="Minimum version")
    max_version: Optional[str] = Field(None, description="Maximum version")
    include_vulnerabilities: bool = Field(
        False, description="Include vulnerability analysis"
    )
    sort_by: Optional[str] = Field("created_at", description="Sort field")
    sort_order: Optional[str] = Field("desc", description="Sort order (asc/desc)")
    limit: int = Field(50, ge=1, le=1000, description="Maximum results")
    offset: int = Field(0, ge=0, description="Results offset")


class DependencyRecommendation(BaseModel):
    """Dependency recommendation schema."""

    name: str = Field(..., description="Recommended dependency name")
    version: str = Field(..., description="Recommended version")
    reason: str = Field(..., description="Recommendation reason")
    confidence: float = Field(..., description="Confidence score (0-1)")
    alternatives: List[str] = Field(
        default_factory=list, description="Alternative dependencies"
    )


class DependencyUsage(BaseModel):
    """Dependency usage statistics schema."""

    dependency_id: str = Field(..., description="Dependency ID")
    project_count: int = Field(
        ..., description="Number of projects using this dependency"
    )
    download_count: int = Field(..., description="Download count")
    last_updated: datetime = Field(..., description="Last usage update")
    trending: bool = Field(False, description="Whether dependency is trending")
