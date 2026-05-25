"""
Build model for CI/CD integration and build tracking.

Integrates with CI/CD systems to track builds, deployments,
and their dependency analysis results.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class BuildStatus(str, Enum):
    """Build status values."""

    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"
    SKIPPED = "skipped"


class BuildType(str, Enum):
    """Build types."""

    BUILD = "build"
    DEPLOY = "deploy"
    RELEASE = "release"
    TEST = "test"
    SCAN = "scan"
    OTHER = "other"


class EnvironmentType(str, Enum):
    """Deployment environment types."""

    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"
    DR = "disaster_recovery"
    OTHER = "other"


class Build(BaseModel):
    """
    CI/CD build execution model.

    Tracks build executions, their status, artifacts,
    and associated analysis results.
    """

    __tablename__ = "builds"

    # Build identification
    build_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique build identifier",
    )

    build_number = Column(
        String(50), nullable=False, index=True, comment="Build number from CI/CD system"
    )

    build_type = Column(
        String(50), nullable=False, default=BuildType.BUILD, comment="Type of build"
    )

    # Build metadata
    title = Column(String(500), nullable=True, comment="Build title or description")

    # Source information
    repository_id = Column(
        UUID(as_uuid=True),
        ForeignKey("repositories.id"),
        nullable=True,
        index=True,
        comment="Source repository",
    )

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Associated project",
    )

    # Git information
    branch = Column(String(255), nullable=True, index=True, comment="Git branch name")

    tag = Column(String(255), nullable=True, index=True, comment="Git tag name")

    commit_hash = Column(
        String(40), nullable=True, index=True, comment="Git commit SHA"
    )

    commit_message = Column(Text, nullable=True, comment="Git commit message")

    commit_author = Column(String(255), nullable=True, comment="Git commit author")

    commit_author_email = Column(
        String(255), nullable=True, comment="Git commit author email"
    )

    # CI/CD system information
    ci_system = Column(
        String(100),
        nullable=True,
        index=True,
        comment="CI/CD system (GitHub Actions, Jenkins, etc.)",
    )

    ci_url = Column(
        String(1000), nullable=True, comment="URL to CI/CD system build page"
    )

    pipeline_id = Column(String(100), nullable=True, comment="Pipeline/job identifier")

    # Build status and timing
    status = Column(
        String(50), nullable=False, default=BuildStatus.PENDING, comment="Build status"
    )

    queued_at = Column(String(50), nullable=True, comment="When build was queued")

    started_at = Column(String(50), nullable=True, comment="When build started")

    completed_at = Column(String(50), nullable=True, comment="When build completed")

    duration_seconds = Column(Float, nullable=True, comment="Build duration in seconds")

    # Build configuration
    config = Column(JSON, default=dict, comment="Build configuration and variables")

    build_matrix = Column(JSON, default=list, comment="Build matrix configurations")

    # Build environment
    environment = Column(
        String(50), nullable=True, index=True, comment="Target environment"
    )

    runner = Column(String(255), nullable=True, comment="Build runner/agent name")

    os_type = Column(String(50), nullable=True, comment="Operating system type")

    os_version = Column(String(100), nullable=True, comment="Operating system version")

    # Build artifacts
    artifacts = Column(JSON, default=list, comment="List of build artifacts")

    artifact_urls = Column(JSON, default=dict, comment="Artifact download URLs")

    # Test results
    test_passed = Column(
        Integer, default=0, nullable=False, comment="Number of tests passed"
    )

    test_failed = Column(
        Integer, default=0, nullable=False, comment="Number of tests failed"
    )

    test_skipped = Column(
        Integer, default=0, nullable=False, comment="Number of tests skipped"
    )

    test_total = Column(
        Integer, default=0, nullable=False, comment="Total number of tests"
    )

    code_coverage = Column(Float, nullable=True, comment="Code coverage percentage")

    # Security analysis integration
    security_scan_enabled = Column(
        Boolean, default=True, nullable=False, comment="Whether security scan was run"
    )

    security_scan_status = Column(
        String(50), nullable=True, comment="Security scan status"
    )

    vulnerabilities_found = Column(
        Integer, default=0, nullable=False, comment="Number of vulnerabilities found"
    )

    # Dependencies analysis
    dependencies_analyzed = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether dependencies were analyzed",
    )

    dependencies_count = Column(
        Integer, default=0, nullable=False, comment="Number of dependencies analyzed"
    )

    # Notifications and webhooks
    notifications_sent = Column(
        JSON, default=list, comment="List of notifications sent"
    )

    webhook_payload = Column(JSON, nullable=True, comment="Original webhook payload")

    # Error information
    error_message = Column(Text, nullable=True, comment="Error message if build failed")

    error_details = Column(JSON, nullable=True, comment="Detailed error information")

    # Trigger information
    triggered_by = Column(String(50), nullable=True, comment="What triggered the build")

    triggered_by_user = Column(
        UUID(as_uuid=True), nullable=True, comment="User who manually triggered build"
    )

    # Indexes
    __table_args__ = (
        Index("idx_builds_status_created", "status", "created_at"),
        Index("idx_builds_project_status", "project_id", "status"),
        Index("idx_builds_repo_branch", "repository_id", "branch"),
        Index("idx_builds_commit", "commit_hash", "status"),
        Index("idx_builds_ci_system", "ci_system", "build_number"),
    )

    # Relationships
    # repository = relationship("Repository", backref="builds")
    # project = relationship("Project", backref="builds")

    def start(self):
        """Mark build as started."""
        self.status = BuildStatus.RUNNING
        self.started_at = datetime.utcnow().isoformat()

    def complete(self, success: bool = True):
        """Mark build as completed."""
        self.status = BuildStatus.SUCCESS if success else BuildStatus.FAILED
        self.completed_at = datetime.utcnow().isoformat()

        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.completed_at)
                self.duration_seconds = (end - start).total_seconds()
            except:
                pass

    def fail(self, error_message: str, error_details: Optional[dict] = None):
        """Mark build as failed."""
        self.status = BuildStatus.FAILED
        self.completed_at = datetime.utcnow().isoformat()
        self.error_message = error_message
        self.error_details = error_details

        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.completed_at)
                self.duration_seconds = (end - start).total_seconds()
            except:
                pass

    def cancel(self):
        """Mark build as cancelled."""
        self.status = BuildStatus.CANCELLED
        self.completed_at = datetime.utcnow().isoformat()

    def queue(self):
        """Mark build as queued."""
        self.status = BuildStatus.QUEUED
        self.queued_at = datetime.utcnow().isoformat()

    def add_artifact(
        self,
        name: str,
        path: str,
        url: Optional[str] = None,
        size: Optional[int] = None,
    ):
        """Add a build artifact."""
        if not self.artifacts:
            self.artifacts = []

        artifact = {
            "name": name,
            "path": path,
            "size": size,
            "created_at": datetime.utcnow().isoformat(),
        }

        if url:
            artifact["url"] = url
            if not self.artifact_urls:
                self.artifact_urls = {}
            self.artifact_urls[name] = url

        self.artifacts.append(artifact)

    def update_test_results(
        self, passed: int, failed: int, skipped: int, coverage: Optional[float] = None
    ):
        """Update test results."""
        self.test_passed = passed
        self.test_failed = failed
        self.test_skipped = skipped
        self.test_total = passed + failed + skipped

        if coverage is not None:
            self.code_coverage = coverage

    @property
    def is_running(self) -> bool:
        """Check if build is currently running."""
        return self.status == BuildStatus.RUNNING

    @property
    def is_successful(self) -> bool:
        """Check if build completed successfully."""
        return self.status == BuildStatus.SUCCESS

    @property
    def is_failed(self) -> bool:
        """Check if build failed."""
        return self.status == BuildStatus.FAILED

    @property
    def has_vulnerabilities(self) -> bool:
        """Check if build found vulnerabilities."""
        return self.vulnerabilities_found > 0

    @property
    def test_success_rate(self) -> float:
        """Calculate test success rate."""
        if self.test_total == 0:
            return 100.0
        return (self.test_passed / self.test_total) * 100

    def __repr__(self) -> str:
        return f"<Build(id={self.id}, build_id={self.build_id}, status={self.status})>"


class Deployment(BaseModel):
    """
    Deployment tracking model.

    Tracks deployments of builds to various environments
    and their rollback information.
    """

    __tablename__ = "deployments"

    # Deployment identification
    deployment_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique deployment identifier",
    )

    # Related build
    build_id = Column(
        UUID(as_uuid=True),
        ForeignKey("builds.id"),
        nullable=False,
        index=True,
        comment="Associated build",
    )

    # Deployment details
    environment = Column(
        String(50), nullable=False, index=True, comment="Target environment"
    )

    environment_type = Column(
        String(50), nullable=False, index=True, comment="Environment type"
    )

    # Deployment status
    status = Column(
        String(50),
        nullable=False,
        default=BuildStatus.PENDING,
        comment="Deployment status",
    )

    # Timing
    started_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When deployment started",
    )

    completed_at = Column(
        String(50), nullable=True, comment="When deployment completed"
    )

    duration_seconds = Column(Float, nullable=True, comment="Deployment duration")

    # Deployment configuration
    config = Column(JSON, default=dict, comment="Deployment configuration")

    # Target information
    target_servers = Column(
        JSON, default=list, comment="List of target servers/services"
    )

    service_names = Column(
        JSON, default=list, comment="Names of services being deployed"
    )

    # Version information
    version = Column(String(100), nullable=True, comment="Deployed version")

    image_tag = Column(String(255), nullable=True, comment="Container image tag")

    # Rollback information
    rollback_enabled = Column(
        Boolean, default=True, nullable=False, comment="Whether rollback is enabled"
    )

    rollback_version = Column(
        String(100), nullable=True, comment="Version to rollback to"
    )

    rollback_reason = Column(Text, nullable=True, comment="Reason for rollback")

    # Health checks
    health_check_enabled = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether health checks are enabled",
    )

    health_check_url = Column(
        String(500), nullable=True, comment="Health check endpoint URL"
    )

    health_check_status = Column(
        String(50), nullable=True, comment="Health check status"
    )

    # Deployment metadata
    deployed_by = Column(
        UUID(as_uuid=True), nullable=True, comment="User who triggered deployment"
    )

    deployment_strategy = Column(
        String(50),
        nullable=True,
        comment="Deployment strategy (rolling, blue_green, canary)",
    )

    # Indexes
    __table_args__ = (
        Index("idx_deployments_build_env", "build_id", "environment"),
        Index("idx_deployments_status_started", "status", "started_at"),
        Index("idx_deployments_env_type", "environment_type", "status"),
    )

    # Relationships
    build = relationship("Build", backref="deployments")

    def complete(self, success: bool = True):
        """Mark deployment as completed."""
        self.status = BuildStatus.SUCCESS if success else BuildStatus.FAILED
        self.completed_at = datetime.utcnow().isoformat()

        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.completed_at)
                self.duration_seconds = (end - start).total_seconds()
            except:
                pass

    def rollback(
        self, reason: str, triggered_by: UUID, target_version: Optional[str] = None
    ):
        """Initiate rollback."""
        self.status = "rolling_back"
        self.rollback_reason = reason
        self.rollback_version = target_version
        self.updated_by = triggered_by

    @property
    def is_production(self) -> bool:
        """Check if this is a production deployment."""
        return self.environment_type == EnvironmentType.PRODUCTION

    @property
    def is_successful(self) -> bool:
        """Check if deployment was successful."""
        return self.status == BuildStatus.SUCCESS

    def __repr__(self) -> str:
        return (
            f"<Deployment(id={self.id}, env={self.environment}, status={self.status})>"
        )
