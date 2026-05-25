"""
Analysis model for dependency analysis results.

Stores results of dependency analysis, SBOM generation,
and security vulnerability scanning.
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


class AnalysisType(str, Enum):
    """Analysis types."""

    DEPENDENCY = "dependency"
    VULNERABILITY = "vulnerability"
    LICENSE = "license"
    COMPLIANCE = "compliance"
    SBOM = "sbom"
    SECURITY = "security"
    CUSTOM = "custom"


class AnalysisStatus(str, Enum):
    """Analysis execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class SeverityLevel(str, Enum):
    """Issue severity levels."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Analysis(BaseModel):
    """
    Analysis execution record.

    Tracks analysis runs, their status, and results for
    various types of dependency and security analysis.
    """

    __tablename__ = "analysiss"

    # Analysis identification
    analysis_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique analysis identifier",
    )

    name = Column(String(255), nullable=False, comment="Analysis name/description")

    analysis_type = Column(
        String(50), nullable=False, index=True, comment="Type of analysis performed"
    )

    # Target information
    target_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of target (project, repository, dependency)",
    )

    target_id = Column(
        UUID(as_uuid=True), nullable=False, index=True, comment="ID of target entity"
    )

    target_version = Column(
        String(50), nullable=True, comment="Version/branch being analyzed"
    )

    # Execution details
    status = Column(
        String(50),
        nullable=False,
        default=AnalysisStatus.PENDING,
        comment="Analysis execution status",
    )

    started_at = Column(String(50), nullable=True, comment="When analysis started")

    completed_at = Column(String(50), nullable=True, comment="When analysis completed")

    duration_seconds = Column(
        Float, nullable=True, comment="Analysis duration in seconds"
    )

    # Analysis configuration
    config = Column(JSON, default=dict, comment="Analysis configuration and parameters")

    scanner_version = Column(
        String(50), nullable=True, comment="Version of scanner/tool used"
    )

    # Results summary
    total_issues = Column(
        Integer, default=0, nullable=False, comment="Total number of issues found"
    )

    critical_issues = Column(
        Integer, default=0, nullable=False, comment="Number of critical issues"
    )

    high_issues = Column(
        Integer, default=0, nullable=False, comment="Number of high severity issues"
    )

    medium_issues = Column(
        Integer, default=0, nullable=False, comment="Number of medium severity issues"
    )

    low_issues = Column(
        Integer, default=0, nullable=False, comment="Number of low severity issues"
    )

    # Metadata and context
    context = Column(
        JSON, default=dict, comment="Additional context about the analysis"
    )

    tags = Column(JSON, default=list, comment="Tags for categorization")

    # Error information
    error_message = Column(
        Text, nullable=True, comment="Error message if analysis failed"
    )

    error_stacktrace = Column(
        Text, nullable=True, comment="Error stacktrace if available"
    )

    # Indexes
    __table_args__ = (
        Index("idx_analysis_type_status", "analysis_type", "status"),
        Index("idx_analysis_target_id", "target_type", "target_id"),
        Index("idx_analysis_created_at", "created_at"),
        Index("idx_analysis_severity_counts", "critical_issues", "high_issues"),
    )

    def start(self):
        """Mark analysis as started."""
        self.status = AnalysisStatus.RUNNING
        self.started_at = datetime.utcnow().isoformat()

    def complete(self):
        """Mark analysis as completed."""
        self.status = AnalysisStatus.COMPLETED
        self.completed_at = datetime.utcnow().isoformat()

        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.completed_at)
                self.duration_seconds = (end - start).total_seconds()
            except:
                pass

    def fail(self, error_message: str, stacktrace: Optional[str] = None):
        """Mark analysis as failed."""
        self.status = AnalysisStatus.FAILED
        self.completed_at = datetime.utcnow().isoformat()
        self.error_message = error_message
        self.error_stacktrace = stacktrace

        if self.started_at:
            try:
                start = datetime.fromisoformat(self.started_at)
                end = datetime.fromisoformat(self.completed_at)
                self.duration_seconds = (end - start).total_seconds()
            except:
                pass

    def cancel(self):
        """Mark analysis as cancelled."""
        self.status = AnalysisStatus.CANCELLED
        self.completed_at = datetime.utcnow().isoformat()

    def update_issue_counts(self, critical=0, high=0, medium=0, low=0):
        """Update issue severity counts."""
        self.critical_issues += critical
        self.high_issues += high
        self.medium_issues += medium
        self.low_issues += low
        self.total_issues = (
            self.critical_issues
            + self.high_issues
            + self.medium_issues
            + self.low_issues
        )

    @property
    def has_critical_issues(self) -> bool:
        """Check if analysis found critical issues."""
        return self.critical_issues > 0

    @property
    def has_high_issues(self) -> bool:
        """Check if analysis found high severity issues."""
        return self.high_issues > 0

    @property
    def risk_score(self) -> float:
        """Calculate risk score (0-10)."""
        if self.total_issues == 0:
            return 0.0

        # Weighted sum of issues
        weighted_sum = (
            self.critical_issues * 10
            + self.high_issues * 5
            + self.medium_issues * 2
            + self.low_issues * 1
        )

        # Normalize to 0-10 scale
        return min(weighted_sum / max(self.total_issues, 1), 10.0)

    def __repr__(self) -> str:
        return (
            f"<Analysis(id={self.id}, type={self.analysis_type}, status={self.status})>"
        )


class AnalysisResult(BaseModel):
    """
    Detailed analysis result for specific findings.

    Stores individual issues, vulnerabilities, or findings
    discovered during analysis.
    """

    __tablename__ = "analysis_results"

    # Result identification
    result_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique result identifier",
    )

    analysis_id = Column(
        UUID(as_uuid=True),
        ForeignKey("analysiss.id"),
        nullable=False,
        index=True,
        comment="Parent analysis ID",
    )

    # Issue details
    issue_type = Column(
        String(100),
        nullable=False,
        index=True,
        comment="Type of issue (vulnerability, license conflict, etc.)",
    )

    severity = Column(
        String(50), nullable=False, index=True, comment="Issue severity level"
    )

    confidence = Column(
        String(50), nullable=True, comment="Confidence level of the finding"
    )

    # Description and details
    title = Column(String(500), nullable=False, comment="Issue title")

    description = Column(
        Text, nullable=True, comment="Detailed description of the issue"
    )

    # Location information
    file_path = Column(
        String(1000),
        nullable=True,
        index=True,
        comment="File path where issue was found",
    )

    line_number = Column(Integer, nullable=True, comment="Line number in file")

    start_line = Column(Integer, nullable=True, comment="Start line of affected code")

    end_line = Column(Integer, nullable=True, comment="End line of affected code")

    # Component information
    component_name = Column(
        String(255), nullable=True, index=True, comment="Component/package name"
    )

    component_version = Column(String(100), nullable=True, comment="Component version")

    component_type = Column(
        String(50),
        nullable=True,
        comment="Component type (dependency, library, framework)",
    )

    # Issue metadata
    cve_id = Column(
        String(50), nullable=True, index=True, comment="CVE identifier if applicable"
    )

    cwe_id = Column(String(50), nullable=True, comment="CWE identifier if applicable")

    owasp_category = Column(String(100), nullable=True, comment="OWASP category")

    # Recommendations and fixes
    recommendation = Column(
        Text, nullable=True, comment="Recommendation for fixing the issue"
    )

    fix_available = Column(
        Boolean, default=False, nullable=False, comment="Whether a fix is available"
    )

    fixed_version = Column(
        String(100), nullable=True, comment="Version that fixes the issue"
    )

    # External references
    references = Column(JSON, default=list, comment="External references and links")

    # Additional data
    result_metadata = Column(JSON, default=dict, comment="Additional issue metadata")

    # Status tracking
    status = Column(
        String(50),
        default="open",
        nullable=False,
        comment="Issue status (open, in_progress, resolved, false_positive)",
    )

    assigned_to = Column(
        UUID(as_uuid=True), nullable=True, comment="User assigned to resolve issue"
    )

    resolution = Column(
        Text, nullable=True, comment="Description of how issue was resolved"
    )

    # Indexes
    __table_args__ = (
        Index("idx_analysis_results_severity", "severity", "status"),
        Index("idx_analysis_results_component", "component_name", "component_version"),
        Index("idx_analysis_results_cve", "cve_id"),
        Index("idx_analysis_results_file", "file_path", "line_number"),
    )

    # Relationships
    analysis = relationship("Analysis", backref="results")

    @property
    def is_critical(self) -> bool:
        """Check if issue is critical."""
        return self.severity == SeverityLevel.CRITICAL

    @property
    def is_high(self) -> bool:
        """Check if issue is high severity."""
        return self.severity == SeverityLevel.HIGH

    @property
    def needs_attention(self) -> bool:
        """Check if issue needs attention."""
        return (
            self.severity in [SeverityLevel.CRITICAL, SeverityLevel.HIGH]
            and self.status == "open"
        )

    def resolve(self, resolution: str, resolved_by: UUID):
        """Mark issue as resolved."""
        self.status = "resolved"
        self.resolution = resolution
        self.updated_by = resolved_by

    def mark_false_positive(self, reason: str, marked_by: UUID):
        """Mark issue as false positive."""
        self.status = "false_positive"
        self.resolution = f"False positive: {reason}"
        self.updated_by = marked_by

    def __repr__(self) -> str:
        return f"<AnalysisResult(id={self.id}, issue_type={self.issue_type}, severity={self.severity})>"


class SBOM(BaseModel):
    """
    Software Bill of Materials (SBOM) records.

    Stores SBOM data in various formats (SPDX, CycloneDX)
    for projects and components.
    """

    __tablename__ = "sboms"

    # SBOM identification
    sbom_id = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique SBOM identifier",
    )

    format = Column(
        String(50), nullable=False, index=True, comment="SBOM format (SPDX, CycloneDX)"
    )

    version = Column(String(20), nullable=False, comment="SBOM format version")

    # Target information
    target_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Type of target (project, repository, image)",
    )

    target_id = Column(
        UUID(as_uuid=True), nullable=False, index=True, comment="ID of target entity"
    )

    target_name = Column(String(255), nullable=True, comment="Target name")

    # SBOM content
    sbom_data = Column(JSON, nullable=False, comment="Parsed SBOM data")

    raw_content = Column(Text, nullable=True, comment="Raw SBOM content")

    # Component counts
    total_components = Column(
        Integer, default=0, nullable=False, comment="Total number of components"
    )

    direct_dependencies = Column(
        Integer, default=0, nullable=False, comment="Number of direct dependencies"
    )

    transitive_dependencies = Column(
        Integer, default=0, nullable=False, comment="Number of transitive dependencies"
    )

    # Generation metadata
    generated_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When SBOM was generated",
    )

    generator = Column(
        String(255), nullable=True, comment="Tool that generated the SBOM"
    )

    # Indexes
    __table_args__ = (
        Index("idx_sbom_target_id", "target_type", "target_id"),
        Index("idx_sbom_format_version", "format", "version"),
        Index("idx_sbom_generated_at", "generated_at"),
    )

    def get_component_by_name(self, name: str) -> Optional[dict]:
        """Get component by name from SBOM data."""
        if not self.sbom_data or "components" not in self.sbom_data:
            return None

        for component in self.sbom_data["components"]:
            if component.get("name") == name:
                return component

        return None

    def get_license_summary(self) -> dict[str, int]:
        """Get summary of licenses used."""
        licenses = {}

        if not self.sbom_data or "components" not in self.sbom_data:
            return licenses

        for component in self.sbom_data.get("components", []):
            component_licenses = component.get("licenses", [])
            if component_licenses:
                for license_info in component_licenses:
                    license_id = license_info.get("id") or license_info.get(
                        "name", "Unknown"
                    )
                    licenses[license_id] = licenses.get(license_id, 0) + 1

        return licenses

    def __repr__(self) -> str:
        return f"<SBOM(id={self.id}, format={self.format}, target_id={self.target_id})>"
