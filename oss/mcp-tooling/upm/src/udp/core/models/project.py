"""
Project model for UPM project management.

Represents software projects with their dependencies, configurations,
and analysis results.
"""

from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Column, String, ForeignKey, Index, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class ProjectStatus(str, Enum):
    """Project status."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"
    ANALYZING = "analyzing"


class ProjectType(str, Enum):
    """Project type based on primary language/ecosystem."""

    MAVEN = "maven"
    GRADLE = "gradle"
    NPM = "npm"
    YARN = "yarn"
    PIP = "pip"
    POETRY = "poetry"
    CARGO = "cargo"
    COMPOSER = "composer"
    BUNDLE = "bundle"
    GO_MOD = "go_mod"
    POLYGLOT = "polyglot"


class Project(BaseModel):
    """
    Project model representing software projects analyzed by UPM.

    Projects contain dependencies, configuration settings, and analysis
    history. Projects belong to organizations and can be analyzed
    across multiple package ecosystems.
    """

    __tablename__ = "projects"

    # Relationships
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        comment="Organization that owns the project",
    )

    # Basic information
    name = Column(String(255), nullable=False, comment="Project name")

    slug = Column(
        String(100), nullable=False, comment="URL-friendly project identifier"
    )

    description = Column(Text, nullable=True, comment="Project description")

    # Repository and source code
    repository_url = Column(String(500), nullable=True, comment="Git repository URL")

    repository_branch = Column(
        String(100), default="main", nullable=False, comment="Primary branch to analyze"
    )

    # Project type and ecosystem
    primary_language = Column(
        String(50), nullable=True, comment="Primary programming language"
    )

    ecosystem = Column(String(50), nullable=True, comment="Primary package ecosystem")

    project_type = Column(
        String(50),
        default=ProjectType.POLYGLOT,
        nullable=False,
        comment="Project type for analysis configuration",
    )

    # Status and metadata
    status = Column(
        String(50),
        default=ProjectStatus.ACTIVE,
        nullable=False,
        comment="Current project status",
    )

    # Analysis tracking
    last_analysis_at = Column(
        String(50), nullable=True, comment="Timestamp of last dependency analysis"
    )

    last_analysis_id = Column(
        UUID(as_uuid=True), nullable=True, comment="ID of most recent analysis session"
    )

    analysis_frequency = Column(
        String(20),
        default="daily",
        nullable=False,
        comment="How often to analyze dependencies",
    )

    # Project settings
    auto_scan_enabled = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether to automatically scan for vulnerabilities",
    )

    policy_enforcement_enabled = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether to enforce compliance policies",
    )

    # Build and deployment
    build_system = Column(String(50), nullable=True, comment="Primary build system")

    deployment_pipeline = Column(
        JSON, nullable=True, comment="Integration with CI/CD pipelines"
    )

    # Configuration and settings
    settings = Column(JSON, default=dict, comment="Project-specific settings")

    # Tags and classification
    tags = Column(JSON, default=list, comment="Tags for project classification")

    # Indexes
    __table_args__ = (
        Index("idx_projects_org_slug", "organization_id", "slug"),
        Index("idx_projects_status_type", "status", "project_type"),
        Index("idx_projects_ecosystem", "ecosystem"),
        Index("idx_projects_last_analysis", "last_analysis_at"),
    )

    # Relationships - will be added as models are implemented
    # organization = relationship("Organization", back_populates="projects")

    # dependencies = relationship(
    #     "Dependency", back_populates="project", cascade="all, delete-orphan"
    # )

    # vulnerability_assessments = relationship(
    #     "ProjectVulnerability", back_populates="project", cascade="all, delete-orphan"
    # )

    # analysis_sessions = relationship(
    #     "AnalysisSession", back_populates="project", cascade="all, delete-orphan"
    # )

    # policy_evaluations = relationship(
    #     "PolicyEvaluation", back_populates="project", cascade="all, delete-orphan"
    # )

    # New relationships with additional models
    # repositories = relationship(
    #     "Repository", back_populates="project", cascade="all, delete-orphan"
    # )

    # builds = relationship(
    #     "Build", back_populates="project", cascade="all, delete-orphan"
    # )

    # environments = relationship(
    #     "Environment", back_populates="project", cascade="all, delete-orphan"
    # )

    # environment_variables = relationship(
    #     "EnvironmentVariable", back_populates="project", cascade="all, delete-orphan"
    # )

    # sboms = relationship("SBOM", backref="project", cascade="all, delete-orphan")

    @property
    def is_active(self) -> bool:
        """Check if project is active."""
        return self.status == ProjectStatus.ACTIVE

    @property
    def needs_analysis(self) -> bool:
        """Check if project needs dependency analysis."""
        if not self.last_analysis_at:
            return True

        try:
            last_analysis = datetime.fromisoformat(self.last_analysis_at)
            now = datetime.utcnow()

            # Check based on analysis frequency
            if self.analysis_frequency == "hourly":
                return (now - last_analysis) > timedelta(hours=1)
            elif self.analysis_frequency == "daily":
                return (now - last_analysis) > timedelta(days=1)
            elif self.analysis_frequency == "weekly":
                return (now - last_analysis) > timedelta(weeks=1)
            elif self.analysis_frequency == "monthly":
                return (now - last_analysis) > timedelta(days=30)
            else:
                return False
        except:
            return True

    @property
    def vulnerability_count(self) -> int:
        """Get total number of vulnerabilities."""
        return len([v for v in self.vulnerability_assessments if v.status == "open"])

    @property
    def critical_vulnerability_count(self) -> int:
        """Get number of critical vulnerabilities."""
        return len(
            [
                v
                for v in self.vulnerability_assessments
                if v.status == "open" and v.vulnerability.severity == "critical"
            ]
        )

    def get_setting(self, key: str, default=None):
        """Get project setting."""
        if not self.settings:
            return default
        return self.settings.get(key, default)

    def set_setting(self, key: str, value):
        """Set project setting."""
        if not self.settings:
            self.settings = {}
        self.settings[key] = value

    def add_tag(self, tag: str):
        """Add tag to project."""
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)

    def remove_tag(self, tag: str):
        """Remove tag from project."""
        if self.tags and tag in self.tags:
            self.tags.remove(tag)

    def __repr__(self):
        return (
            f"<Project(id={self.id}, name={self.name}, org_id={self.organization_id})>"
        )
