"""
Dependency model for Universal Dependency Platform.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class Dependency(BaseModel):
    """Dependency model."""

    __tablename__ = "dependencies"

    name = Column(String(255), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    language = Column(String(50), nullable=False, index=True)
    framework = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    repository_url = Column(String(500), nullable=True)
    license = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    dependency_metadata = Column(JSON, nullable=True)

    # Foreign keys
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relationships - will be added as models are implemented
    # created_by_user = relationship("User", back_populates="dependencies")
    # vulnerabilities = relationship("DependencyVulnerability", back_populates="dependency")
    # analyses = relationship("DependencyAnalysis", back_populates="dependency")


class DependencyVulnerability(BaseModel):
    """Dependency vulnerability model."""

    __tablename__ = "dependency_vulnerabilities"

    dependency_id = Column(
        UUID(as_uuid=True), ForeignKey("dependencies.id"), nullable=False
    )
    vulnerability_id = Column(String(100), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    cvss_score = Column(String(10), nullable=True)
    cve_id = Column(String(50), nullable=True, index=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    patched_versions = Column(JSON, nullable=True)

    # Relationships - will be added as models are implemented
    # dependency = relationship("Dependency", back_populates="vulnerabilities")


class DependencyAnalysis(BaseModel):
    """Dependency analysis model."""

    __tablename__ = "dependency_analyses"

    dependency_id = Column(
        UUID(as_uuid=True), ForeignKey("dependencies.id"), nullable=False
    )
    vulnerabilities = Column(JSON, nullable=False)
    compatibility_score = Column(String(10), nullable=False)
    maintenance_score = Column(String(10), nullable=False)
    popularity_score = Column(String(10), nullable=False)
    license_compatible = Column(Boolean, nullable=False)
    recommendations = Column(JSON, nullable=False)
    analyzed_at = Column(DateTime(timezone=True), nullable=False)

    # Relationships - will be added as models are implemented
    # dependency = relationship("Dependency", back_populates="analyses")
