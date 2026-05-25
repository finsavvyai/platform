"""
Package model for UPM package registry.

Represents software packages from various ecosystems with metadata,
versions, and vulnerability information.
"""

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

from .base import BaseModel


class Package(BaseModel):
    """
    Universal package model representing software packages across all ecosystems.

    This model provides a unified interface for packages from different
    package managers (Maven, npm, PyPI, Cargo, etc.) with standardized
    metadata and cross-ecosystem compatibility information.
    """

    __tablename__ = "packages"

    # Package identification
    name = Column(String(255), nullable=False, comment="Package name")

    ecosystem = Column(
        String(50), nullable=False, comment="Package ecosystem (maven, npm, pypi, etc.)"
    )

    # Package metadata
    group_id = Column(String(255), nullable=True, comment="Group ID for Maven packages")

    artifact_id = Column(
        String(255), nullable=True, comment="Artifact ID for Maven packages"
    )

    namespace = Column(
        String(255), nullable=True, comment="Namespace for packages (e.g., npm scope)"
    )

    # Basic information
    description = Column(Text, nullable=True, comment="Package description")

    homepage_url = Column(String(500), nullable=True, comment="Package homepage URL")

    repository_url = Column(
        String(500), nullable=True, comment="Source code repository URL"
    )

    documentation_url = Column(String(500), nullable=True, comment="Documentation URL")

    # License and legal
    license = Column(String(100), nullable=True, comment="Package license")

    license_url = Column(String(500), nullable=True, comment="License details URL")

    # Package URLs
    package_url = Column(String(500), nullable=True, comment="Package registry URL")

    download_url = Column(String(500), nullable=True, comment="Primary download URL")

    # Version information
    latest_version = Column(String(100), nullable=True, comment="Latest stable version")

    version_count = Column(
        Integer, default=0, nullable=False, comment="Number of available versions"
    )

    # Popularity and usage metrics
    download_count = Column(
        Integer, default=0, nullable=False, comment="Total download count"
    )

    star_count = Column(
        Integer, default=0, nullable=False, comment="Star/favorite count"
    )

    popularity_score = Column(
        Float, default=0.0, nullable=False, comment="Calculated popularity score (0-1)"
    )

    # Maintenance and quality
    maintenance_score = Column(
        Float, default=0.0, nullable=False, comment="Maintenance quality score (0-1)"
    )

    security_score = Column(
        Float, default=0.0, nullable=False, comment="Security assessment score (0-1)"
    )

    # Status and classification
    is_deprecated = Column(
        Boolean, default=False, nullable=False, comment="Whether package is deprecated"
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether package is actively maintained",
    )

    # Classification
    categories = Column(JSON, default=list, comment="Package categories/tags")

    keywords = Column(JSON, default=list, comment="Package keywords")

    # Extended metadata
    package_metadata = Column(
        JSON, default=dict, comment="Additional ecosystem-specific metadata"
    )

    # Indexes
    __table_args__ = (
        Index("idx_packages_ecosystem_name", "ecosystem", "name"),
        Index("idx_packages_name", "name"),
        Index("idx_packages_popularity", "popularity_score"),
        Index("idx_packages_security", "security_score"),
        Index("idx_packages_deprecated", "is_deprecated", "is_active"),
    )

    # Relationships - will be added as models are implemented
    # versions = relationship(
    #     "PackageVersion", back_populates="package", cascade="all, delete-orphan"
    # )

    # dependencies = relationship("Dependency", back_populates="package")

    # vulnerabilities = relationship(
    #     "PackageVulnerability", back_populates="package", cascade="all, delete-orphan"
    # )

    @property
    def full_name(self) -> str:
        """Get full package name including namespace/group."""
        if self.ecosystem == "maven" and self.group_id and self.artifact_id:
            return f"{self.group_id}:{self.artifact_id}"
        elif self.namespace:
            return f"{self.namespace}/{self.name}"
        else:
            return self.name

    @property
    def ecosystem_display_name(self) -> str:
        """Get human-readable ecosystem name."""
        ecosystem_names = {
            "maven": "Maven Central",
            "npm": "npm Registry",
            "pypi": "PyPI",
            "cargo": "Crates.io",
            "nuget": "NuGet Gallery",
            "composer": "Packagist",
            "rubygems": "RubyGems",
            "go": "Go Modules",
        }
        return ecosystem_names.get(self.ecosystem, self.ecosystem.capitalize())

    @property
    def has_vulnerabilities(self) -> bool:
        """Check if package has any vulnerabilities."""
        return len(self.vulnerabilities) > 0

    @property
    def critical_vulnerability_count(self) -> int:
        """Get count of critical vulnerabilities."""
        return len(
            [v for v in self.vulnerabilities if v.vulnerability.severity == "critical"]
        )

    def get_latest_version_info(self) -> Optional["PackageVersion"]:
        """Get information about the latest version."""
        if not self.latest_version:
            return None

        for version in self.versions:
            if version.version == self.latest_version:
                return version
        return None

    def update_popularity_score(self):
        """Recalculate popularity score based on metrics."""
        # Simple algorithm combining download count and stars
        # Normalize to 0-1 scale
        score = 0.0

        # Downloads component (70% weight)
        if self.download_count > 0:
            # Log scale for downloads
            import math

            download_score = min(1.0, math.log10(self.download_count + 1) / 8.0)
            score += download_score * 0.7

        # Stars component (30% weight)
        if self.star_count > 0:
            star_score = min(1.0, math.log10(self.star_count + 1) / 5.0)
            score += star_score * 0.3

        self.popularity_score = round(score, 3)

    def __repr__(self):
        return f"<Package(id={self.id}, name={self.name}, ecosystem={self.ecosystem})>"


class PackageVersion(BaseModel):
    """
    Package version model representing specific versions of packages.

    Each version has its own metadata, download information,
    and vulnerability associations.
    """

    __tablename__ = "package_versions"

    # Relationships
    package_id = Column(
        UUID(as_uuid=True),
        ForeignKey("packages.id"),
        nullable=False,
        comment="Package this version belongs to",
    )

    # Version information
    version = Column(String(100), nullable=False, comment="Semantic version string")

    is_prerelease = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this is a prerelease version",
    )

    is_latest = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this is the latest stable version",
    )

    # Release information
    published_at = Column(
        String(50), nullable=True, comment="When this version was published"
    )

    release_notes = Column(
        Text, nullable=True, comment="Release notes for this version"
    )

    # Download information
    download_url = Column(
        String(500), nullable=True, comment="Direct download URL for this version"
    )

    download_count = Column(
        Integer, default=0, nullable=False, comment="Download count for this version"
    )

    # File information
    size_bytes = Column(Integer, nullable=True, comment="Download size in bytes")

    checksum_md5 = Column(String(32), nullable=True, comment="MD5 checksum")

    checksum_sha1 = Column(String(40), nullable=True, comment="SHA-1 checksum")

    checksum_sha256 = Column(String(64), nullable=True, comment="SHA-256 checksum")

    # Dependencies for this version
    dependencies = Column(
        JSON, default=list, comment="Dependencies required by this version"
    )

    # Development dependencies
    dev_dependencies = Column(
        JSON, default=list, comment="Development dependencies for this version"
    )

    # Compatibility information
    python_requires = Column(
        String(100), nullable=True, comment="Python version requirements"
    )

    java_version = Column(
        String(20), nullable=True, comment="Minimum Java version required"
    )

    node_version = Column(
        String(20), nullable=True, comment="Node.js version requirements"
    )

    # Version-specific metadata
    version_metadata = Column(
        JSON, default=dict, comment="Additional version-specific metadata"
    )

    # Indexes
    __table_args__ = (
        Index("idx_package_versions_package_version", "package_id", "version"),
        Index("idx_package_versions_latest", "package_id", "is_latest"),
        Index("idx_package_versions_published", "published_at"),
    )

    # Relationships - will be added as models are implemented
    # package = relationship("Package", back_populates="versions")

    @property
    def is_stable(self) -> bool:
        """Check if version is stable (not prerelease)."""
        return not self.is_prerelease

    @property
    def display_name(self) -> str:
        """Get display name including package name."""
        return f"{self.package.name}@{self.version}"

    @property
    def size_display(self) -> str:
        """Get human-readable file size."""
        if not self.size_bytes:
            return "Unknown"

        for unit in ["B", "KB", "MB", "GB"]:
            if self.size_bytes < 1024.0:
                return f"{self.size_bytes:.1f} {unit}"
            self.size_bytes /= 1024.0
        return f"{self.size_bytes:.1f} TB"

    def __repr__(self):
        return f"<PackageVersion(id={self.id}, package_id={self.package_id}, version={self.version})>"
