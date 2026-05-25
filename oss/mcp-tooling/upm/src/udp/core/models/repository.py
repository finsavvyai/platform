"""
Repository model for source code repository management.

Integrates with Git repositories, CI/CD systems, and tracks
source code metadata for dependency analysis.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import Boolean, Column, String, Text, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import Base


class RepositoryType(str, Enum):
    """Repository types."""

    GIT = "git"
    SVN = "svn"
    MERCURIAL = "mercurial"
    OTHER = "other"


class RepositoryProvider(str, Enum):
    """Repository hosting providers."""

    GITHUB = "github"
    GITLAB = "gitlab"
    BITBUCKET = "bitbucket"
    AZURE_DEVOPS = "azure_devops"
    GITEA = "gitea"
    SELF_HOSTED = "self_hosted"
    OTHER = "other"


class ScanStatus(str, Enum):
    """Repository scan status."""

    PENDING = "pending"
    SCANNING = "scanning"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class Repository(Base):
    """
    Source code repository model.

    Represents external repositories that are analyzed for
    dependencies and vulnerabilities.
    """

    __tablename__ = "repositories"

    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # Repository identification
    name = Column(String(255), nullable=False, index=True, comment="Repository name")

    full_name = Column(
        String(500),
        nullable=True,
        index=True,
        comment="Full repository name (owner/repo)",
    )

    # Repository URL and access
    url = Column(String(1000), nullable=False, comment="Repository URL")

    clone_url = Column(String(1000), nullable=True, comment="Git clone URL")

    ssh_url = Column(String(1000), nullable=True, comment="SSH clone URL")

    # Repository metadata
    repository_type = Column(
        String(50),
        nullable=False,
        default=RepositoryType.GIT,
        comment="Repository type",
    )

    provider = Column(String(50), nullable=True, index=True, comment="Hosting provider")

    description = Column(Text, nullable=True, comment="Repository description")

    language = Column(
        String(100), nullable=True, index=True, comment="Primary programming language"
    )

    languages = Column(
        JSON, default=dict, comment="Language breakdown (name: bytes/percentage)"
    )

    # Repository statistics
    stars_count = Column(
        String(20), default="0", nullable=False, comment="Number of stars/forks"
    )

    forks_count = Column(
        String(20), default="0", nullable=False, comment="Number of forks"
    )

    open_issues_count = Column(
        String(20), default="0", nullable=False, comment="Number of open issues"
    )

    size = Column(String(20), nullable=True, comment="Repository size in KB")

    # Branch and tag information
    default_branch = Column(
        String(255), default="main", nullable=False, comment="Default branch name"
    )

    branches = Column(JSON, default=list, comment="List of branch names")

    tags = Column(JSON, default=list, comment="List of tag names")

    # Access and credentials
    is_private = Column(
        Boolean, default=False, nullable=False, comment="Whether repository is private"
    )

    access_token = Column(
        String(500), nullable=True, comment="Encrypted access token for API access"
    )

    ssh_key = Column(
        Text, nullable=True, comment="SSH private key for repository access"
    )

    # Owner information
    owner_name = Column(String(255), nullable=True, comment="Repository owner name")

    owner_email = Column(String(255), nullable=True, comment="Repository owner email")

    # Scanning configuration
    auto_scan = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether to automatically scan on updates",
    )

    scan_frequency = Column(
        String(20),
        default="daily",
        nullable=False,
        comment="Scan frequency (hourly, daily, weekly)",
    )

    include_patterns = Column(
        JSON,
        default=["**/*.py", "**/*.js", "**/*.ts", "**/*.java", "**/*.go"],
        comment="File patterns to include in scan",
    )

    exclude_patterns = Column(
        JSON,
        default=["**/node_modules/**", "**/target/**", "**/build/**", "**/dist/**"],
        comment="File patterns to exclude from scan",
    )

    # Scan status and results
    last_scan_at = Column(String(50), nullable=True, comment="Timestamp of last scan")

    last_scan_status = Column(
        String(50),
        default=ScanStatus.PENDING,
        nullable=False,
        comment="Status of last scan",
    )

    last_scan_commit = Column(
        String(40), nullable=True, comment="Commit hash of last scan"
    )

    scan_error = Column(
        Text, nullable=True, comment="Error message from last failed scan"
    )

    # Integration settings
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Associated project ID",
    )

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        comment="Associated organization ID",
    )

    # External service integration
    ci_cd_config = Column(JSON, default=dict, comment="CI/CD integration configuration")

    webhook_secret = Column(
        String(255), nullable=True, comment="Webhook secret for repository events"
    )

    # Indexes for performance
    __table_args__ = (
        Index("idx_repos_provider_type", "provider", "repository_type"),
        Index("idx_repos_auto_scan", "auto_scan", "last_scan_at"),
        Index("idx_repos_project_org", "project_id", "organization_id"),
        Index("idx_repos_status_scan", "last_scan_status", "last_scan_at"),
    )

    # Relationships
    # project = relationship("Project", back_populates="repositories")
    # organization = relationship("Organization", back_populates="repositories")

    @property
    def is_github(self) -> bool:
        """Check if repository is hosted on GitHub."""
        return self.provider == RepositoryProvider.GITHUB

    @property
    def is_gitlab(self) -> bool:
        """Check if repository is hosted on GitLab."""
        return self.provider == RepositoryProvider.GITLAB

    def get_api_url(self) -> Optional[str]:
        """Get API URL for the repository."""
        if not self.provider or not self.full_name:
            return None

        api_urls = {
            RepositoryProvider.GITHUB: f"https://api.github.com/repos/{self.full_name}",
            RepositoryProvider.GITLAB: f"https://gitlab.com/api/v4/projects/{self.full_name.replace('/', '%2F')}",
            RepositoryProvider.BITBUCKET: f"https://api.bitbucket.org/2.0/repositories/{self.full_name}",
        }

        return api_urls.get(self.provider)

    def needs_scan(self) -> bool:
        """Check if repository needs to be scanned."""
        if not self.auto_scan:
            return False

        if not self.last_scan_at:
            return True

        try:
            last_scan = datetime.fromisoformat(self.last_scan_at)
            now = datetime.utcnow()

            # Check based on frequency
            if self.scan_frequency == "hourly":
                return (now - last_scan).total_seconds() > 3600
            elif self.scan_frequency == "daily":
                return (now - last_scan).days >= 1
            elif self.scan_frequency == "weekly":
                return (now - last_scan).days >= 7

            return False
        except:
            return True

    def update_scan_status(
        self,
        status: str,
        commit_hash: Optional[str] = None,
        error: Optional[str] = None,
    ):
        """Update scan status and metadata."""
        self.last_scan_status = status
        self.last_scan_at = datetime.utcnow().isoformat()

        if commit_hash:
            self.last_scan_commit = commit_hash

        if error:
            self.scan_error = error
        else:
            self.scan_error = None

    def get_language_breakdown(self) -> Dict[str, float]:
        """Get language breakdown as percentages."""
        if not self.languages:
            return {}

        # Calculate total and convert to percentages
        total = sum(self.languages.values())
        if total == 0:
            return {}

        return {
            lang: (bytes_val / total) * 100
            for lang, bytes_val in self.languages.items()
        }

    def __repr__(self) -> str:
        return f"<Repository(id={self.id}, name={self.name}, provider={self.provider})>"
