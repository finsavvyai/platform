"""
SQLAlchemy database models for Universal Dependency Platform.

Enterprise-grade database models with proper indexing, relationships,
encryption for sensitive data, and audit trail capabilities.
"""

from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from udp.core.database import Base
from udp.domain.models import (
    EcosystemType,
    LicenseType,
    PolicyAction,
    SecurityLevel,
    WorkflowStatus,
)


class BaseModel(Base):
    """Base model with common enterprise audit fields."""

    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(100), nullable=True)
    updated_by = Column(String(100), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)
    metadata_json = Column(JSON, default=dict, nullable=False)


class UserModel(BaseModel):
    """User database model."""
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="user")
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime, nullable=True)
    preferences = Column(JSON, default=dict, nullable=False)

    # Relationships
    organization = relationship("OrganizationModel", back_populates="users")


class OrganizationModel(BaseModel):
    """Organization database model."""

    __tablename__ = "organizations"

    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False, unique=True, index=True)
    domain = Column(String(255), nullable=True, index=True)
    industry = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)
    country = Column(String(2), nullable=True)
    compliance_frameworks = Column(JSON, default=list, nullable=False)
    allowed_licenses = Column(JSON, default=list, nullable=False)
    blocked_licenses = Column(JSON, default=list, nullable=False)
    max_vulnerability_score = Column(Float, default=7.0, nullable=False)
    auto_update_enabled = Column(Boolean, default=False, nullable=False)
    require_approval = Column(Boolean, default=True, nullable=False)
    notification_emails = Column(JSON, default=list, nullable=False)
    settings = Column(JSON, default=dict, nullable=False)

    # Relationships
    policies = relationship("PolicyModel", back_populates="organization", cascade="all, delete-orphan")
    workflows = relationship("WorkflowModel", back_populates="organization")
    dependency_graphs = relationship("DependencyGraphModel", back_populates="organization")
    users = relationship("UserModel", back_populates="organization")

    # Indexes
    __table_args__ = (
        Index("ix_organizations_name", "name"),
        Index("ix_organizations_industry", "industry"),
        Index("ix_organizations_size", "size"),
    )


class PackageModel(BaseModel):
    """Package database model."""

    __tablename__ = "packages"

    name = Column(String(255), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    ecosystem = Column(SQLEnum(EcosystemType), nullable=False, index=True)
    namespace = Column(String(255), nullable=True, index=True)
    description = Column(Text, nullable=True)
    homepage = Column(String(500), nullable=True)
    repository_url = Column(String(500), nullable=True)
    license = Column(SQLEnum(LicenseType), default=LicenseType.UNKNOWN, nullable=False)
    license_text = Column(Text, nullable=True)
    author = Column(String(255), nullable=True)
    maintainers = Column(JSON, default=list, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    download_url = Column(String(500), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    checksum = Column(String(128), nullable=True)
    tags = Column(JSON, default=list, nullable=False)

    # Relationships
    vulnerabilities = relationship("PackageVulnerabilityModel", back_populates="package")

    # Hybrid properties
    @hybrid_property
    def full_name(self) -> str:
        """Get full package name including namespace."""
        if self.namespace:
            return f"{self.namespace}/{self.name}"
        return self.name

    @hybrid_property
    def registry_key(self) -> str:
        """Get unique registry key."""
        return f"{self.ecosystem.value}:{self.full_name}@{self.version}"

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("name", "version", "ecosystem", "namespace", name="uq_package_version_ecosystem"),
        Index("ix_packages_ecosystem_name", "ecosystem", "name"),
        Index("ix_packages_license", "license"),
        Index("ix_packages_published_at", "published_at"),
        Index("ix_packages_full_name", "ecosystem", "namespace", "name"),
    )


class VulnerabilityModel(BaseModel):
    """Vulnerability database model."""

    __tablename__ = "vulnerabilities"

    cve_id = Column(String(20), nullable=True, unique=True, index=True)
    advisory_id = Column(String(100), nullable=False, unique=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(SQLEnum(SecurityLevel), nullable=False, index=True)
    cvss_score = Column(Float, nullable=True, index=True)
    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    updated_at_source = Column(DateTime(timezone=True), nullable=True)
    affected_versions = Column(JSON, nullable=False)
    fixed_versions = Column(JSON, default=list, nullable=False)
    source = Column(String(100), nullable=False, index=True)
    source_url = Column(String(500), nullable=True)
    references = Column(JSON, default=list, nullable=False)
    cwe_ids = Column(JSON, default=list, nullable=False)
    exploit_available = Column(Boolean, default=False, nullable=False, index=True)
    patch_available = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    packages = relationship("PackageVulnerabilityModel", back_populates="vulnerability")

    # Hybrid properties
    @hybrid_property
    def is_high_risk(self) -> bool:
        """Check if vulnerability is high risk."""
        return self.severity in [SecurityLevel.CRITICAL, SecurityLevel.HIGH]

    # Indexes
    __table_args__ = (
        Index("ix_vulnerabilities_severity_score", "severity", "cvss_score"),
        Index("ix_vulnerabilities_exploit_patch", "exploit_available", "patch_available"),
        Index("ix_vulnerabilities_published", "published_at", "severity"),
    )


class PackageVulnerabilityModel(BaseModel):
    """Association table for package-vulnerability relationships."""

    __tablename__ = "package_vulnerabilities"

    package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id", ondelete="CASCADE"), nullable=False)
    vulnerability_id = Column(UUID(as_uuid=True), ForeignKey("vulnerabilities.id", ondelete="CASCADE"), nullable=False)
    affected_version_range = Column(String(200), nullable=False)
    fixed_version = Column(String(50), nullable=True)
    first_detected_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_fixed = Column(Boolean, default=False, nullable=False, index=True)

    # Relationships
    package = relationship("PackageModel", back_populates="vulnerabilities")
    vulnerability = relationship("VulnerabilityModel", back_populates="packages")

    # Constraints
    __table_args__ = (
        UniqueConstraint("package_id", "vulnerability_id", name="uq_package_vulnerability"),
        Index("ix_package_vulnerabilities_package", "package_id"),
        Index("ix_package_vulnerabilities_vulnerability", "vulnerability_id"),
        Index("ix_package_vulnerabilities_detected", "first_detected_at"),
    )


class LicenseModel(BaseModel):
    """License database model."""

    __tablename__ = "licenses"

    name = Column(String(100), nullable=False, unique=True, index=True)
    spdx_id = Column(String(50), nullable=True, unique=True, index=True)
    license_type = Column(SQLEnum(LicenseType), nullable=False, index=True)
    text = Column(Text, nullable=True)
    url = Column(String(500), nullable=True)
    is_osi_approved = Column(Boolean, default=False, nullable=False, index=True)
    is_copyleft = Column(Boolean, default=False, nullable=False, index=True)
    allows_commercial_use = Column(Boolean, default=True, nullable=False)
    allows_modification = Column(Boolean, default=True, nullable=False)
    allows_distribution = Column(Boolean, default=True, nullable=False)
    requires_attribution = Column(Boolean, default=True, nullable=False)
    requires_source_disclosure = Column(Boolean, default=False, nullable=False, index=True)
    compatibility_notes = Column(Text, nullable=True)

    # Hybrid properties
    @hybrid_property
    def is_permissive(self) -> bool:
        """Check if license is permissive."""
        return not self.is_copyleft and self.allows_commercial_use

    @hybrid_property
    def enterprise_friendly(self) -> bool:
        """Check if license is enterprise-friendly."""
        return (
            self.allows_commercial_use
            and not self.requires_source_disclosure
            and not self.is_copyleft
        )

    # Indexes
    __table_args__ = (
        Index("ix_licenses_type_osi", "license_type", "is_osi_approved"),
        Index("ix_licenses_commercial_copyleft", "allows_commercial_use", "is_copyleft"),
    )


class PolicyModel(BaseModel):
    """Policy database model."""

    __tablename__ = "policies"

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    policy_type = Column(String(50), nullable=False, index=True)
    rules = Column(JSON, nullable=False)
    action = Column(SQLEnum(PolicyAction), default=PolicyAction.WARN, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    priority = Column(Integer, default=100, nullable=False, index=True)
    applicable_ecosystems = Column(JSON, default=list, nullable=False)
    exceptions = Column(JSON, default=list, nullable=False)

    # Relationships
    organization = relationship("OrganizationModel", back_populates="policies")

    # Hybrid properties
    @hybrid_property
    def is_blocking(self) -> bool:
        """Check if policy blocks actions."""
        return self.action == PolicyAction.BLOCK

    # Constraints
    __table_args__ = (
        Index("ix_policies_organization_type", "organization_id", "policy_type"),
        Index("ix_policies_active_priority", "is_active", "priority"),
        Index("ix_policies_organization_active", "organization_id", "is_active"),
    )


class DependencyGraphModel(BaseModel):
    """Dependency graph database model."""

    __tablename__ = "dependency_graphs"

    root_package_id = Column(UUID(as_uuid=True), ForeignKey("packages.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    dependencies = Column(JSON, nullable=False)
    conflicts = Column(JSON, default=list, nullable=False)
    vulnerabilities = Column(JSON, default=list, nullable=False)  # List of vulnerability IDs
    license_issues = Column(JSON, default=list, nullable=False)
    total_packages = Column(Integer, default=0, nullable=False)
    total_vulnerabilities = Column(Integer, default=0, nullable=False, index=True)
    risk_score = Column(Float, default=0.0, nullable=False, index=True)
    is_resolved = Column(Boolean, default=False, nullable=False, index=True)
    resolution_strategy = Column(String(100), nullable=True)

    # Relationships
    organization = relationship("OrganizationModel", back_populates="dependency_graphs")
    root_package = relationship("PackageModel")

    # Hybrid properties
    @hybrid_property
    def has_conflicts(self) -> bool:
        """Check if graph has unresolved conflicts."""
        return len(self.conflicts or []) > 0 and not self.is_resolved

    @hybrid_property
    def has_vulnerabilities(self) -> bool:
        """Check if graph has vulnerabilities."""
        return self.total_vulnerabilities > 0

    @hybrid_property
    def is_high_risk(self) -> bool:
        """Check if graph is high risk."""
        return self.risk_score >= 7.0

    # Indexes
    __table_args__ = (
        Index("ix_dependency_graphs_organization_risk", "organization_id", "risk_score"),
        Index("ix_dependency_graphs_vulnerabilities_resolved", "total_vulnerabilities", "is_resolved"),
        Index("ix_dependency_graphs_root_org", "root_package_id", "organization_id"),
    )


class WorkflowModel(BaseModel):
    """Workflow database model with Universal Package Manager support."""

    __tablename__ = "workflows"

    name = Column(String(200), nullable=False)
    workflow_type = Column(String(100), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    initiator_id = Column(String(100), nullable=False)
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False, index=True)
    input_data = Column(JSON, nullable=False)
    output_data = Column(JSON, nullable=True)
    current_state = Column(String(100), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True, index=True)
    approvals_required = Column(JSON, default=list, nullable=False)
    approvals_received = Column(JSON, default=list, nullable=False)
    checkpoints = Column(JSON, default=list, nullable=False)
    related_entities = Column(JSON, default=dict, nullable=False)

    # Universal Package Manager fields
    polyglot_project_data = Column(JSON, nullable=True, default=None)
    universal_packages = Column(JSON, default=list, nullable=False)
    cross_ecosystem_resolution = Column(JSON, default=dict, nullable=False)
    universal_audit_trail = Column(JSON, default=list, nullable=False)
    project_languages = Column(JSON, default=list, nullable=False)

    # Relationships
    organization = relationship("OrganizationModel", back_populates="workflows")

    # Hybrid properties
    @hybrid_property
    def is_complete(self) -> bool:
        """Check if workflow is complete."""
        return self.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED, WorkflowStatus.CANCELLED]

    @hybrid_property
    def is_pending_approval(self) -> bool:
        """Check if workflow is pending approval."""
        return self.status == WorkflowStatus.WAITING_FOR_APPROVAL

    @hybrid_property
    def is_polyglot_project(self) -> bool:
        """Check if workflow involves a polyglot project."""
        return len(self.project_languages or []) > 1

    # Indexes
    __table_args__ = (
        Index("ix_workflows_organization_status", "organization_id", "status"),
        Index("ix_workflows_type_status", "workflow_type", "status"),
        Index("ix_workflows_initiator_status", "initiator_id", "status"),
        Index("ix_workflows_started_completed", "started_at", "completed_at"),
        Index("ix_workflows_organization_type", "organization_id", "workflow_type"),
        Index("ix_workflows_polyglot", "organization_id", "project_languages"),
    )


class UniversalPackageModel(BaseModel):
    """Universal package model for cross-ecosystem tracking."""

    __tablename__ = "universal_packages"

    registry_key = Column(String(500), nullable=False, unique=True, index=True)
    ecosystem = Column(SQLEnum(EcosystemType), nullable=False, index=True)
    namespace = Column(String(255), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    version = Column(String(50), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Cross-ecosystem metadata
    bridge_mechanisms = Column(JSON, default=list, nullable=False)
    compatibility_scores = Column(JSON, default=dict, nullable=False)
    interop_metadata = Column(JSON, default=dict, nullable=False)

    # Resolution tracking
    resolution_strategy = Column(String(100), nullable=True)
    conflict_resolution_data = Column(JSON, default=dict, nullable=False)
    last_resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("OrganizationModel")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("ecosystem", "namespace", "name", "version", "organization_id",
                        name="uq_universal_package_org"),
        Index("ix_universal_packages_ecosystem_name", "ecosystem", "name"),
        Index("ix_universal_packages_organization", "organization_id"),
        Index("ix_universal_packages_resolved", "last_resolved_at"),
    )


class CrossLanguageDependencyModel(BaseModel):
    """Cross-language dependency relationship model."""

    __tablename__ = "cross_language_dependencies"

    source_package_id = Column(UUID(as_uuid=True), ForeignKey("universal_packages.id", ondelete="CASCADE"), nullable=False)
    target_package_id = Column(UUID(as_uuid=True), ForeignKey("universal_packages.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    relationship_type = Column(String(50), nullable=False, index=True)  # runtime, build, bridge, interop
    bridge_mechanism = Column(String(50), nullable=True, index=True)  # ffi, wasm, rest, grpc
    compatibility_score = Column(Float, default=1.0, nullable=False)

    # Bridge configuration
    bridge_config = Column(JSON, default=dict, nullable=False)
    performance_metrics = Column(JSON, default=dict, nullable=False)

    # Relationships
    source_package = relationship("UniversalPackageModel", foreign_keys=[source_package_id])
    target_package = relationship("UniversalPackageModel", foreign_keys=[target_package_id])
    organization = relationship("OrganizationModel")

    # Constraints
    __table_args__ = (
        UniqueConstraint("source_package_id", "target_package_id", "organization_id",
                        name="uq_cross_lang_dependency"),
        Index("ix_cross_lang_deps_source", "source_package_id"),
        Index("ix_cross_lang_deps_target", "target_package_id"),
        Index("ix_cross_lang_deps_organization", "organization_id"),
        Index("ix_cross_lang_deps_bridge", "bridge_mechanism"),
    )


class PolyglotProjectModel(BaseModel):
    """Polyglot project configuration model."""

    __tablename__ = "polyglot_projects"

    project_name = Column(String(200), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Project configuration
    project_languages = Column(JSON, nullable=False)  # List of EcosystemType
    manifest_files = Column(JSON, default=dict, nullable=False)  # Dict[EcosystemType, List[str]]

    # Universal lockfile
    universal_lockfile = Column(JSON, nullable=True)
    lockfile_version = Column(String(20), default="1.0", nullable=False)
    lockfile_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Project metadata
    build_configuration = Column(JSON, default=dict, nullable=False)
    deployment_configuration = Column(JSON, default=dict, nullable=False)

    # Relationships
    organization = relationship("OrganizationModel")

    # Constraints
    __table_args__ = (
        UniqueConstraint("project_name", "organization_id", name="uq_polyglot_project_org"),
        Index("ix_polyglot_projects_organization", "organization_id"),
        Index("ix_polyglot_projects_languages", "project_languages"),
        Index("ix_polyglot_projects_updated", "lockfile_updated_at"),
    )


# Audit log model for compliance tracking
class AuditLogModel(BaseModel):
    """Audit log for compliance and security tracking with Universal Package Manager support."""

    __tablename__ = "audit_logs"

    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    entity_type = Column(String(50), nullable=False, index=True)
    entity_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    user_id = Column(String(100), nullable=True, index=True)
    user_ip = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    changes = Column(JSON, nullable=True)  # Before/after state
    success = Column(Boolean, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    request_id = Column(String(100), nullable=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)

    # Universal Package Manager audit fields
    universal_package_registry_key = Column(String(500), nullable=True, index=True)
    cross_ecosystem_operation = Column(Boolean, default=False, nullable=False, index=True)
    polyglot_project_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    bridge_mechanism_used = Column(String(50), nullable=True, index=True)
    resolution_strategy = Column(String(100), nullable=True)
    ecosystem_compatibility_data = Column(JSON, nullable=True)

    # Indexes for audit queries
    __table_args__ = (
        Index("ix_audit_logs_organization_action", "organization_id", "action"),
        Index("ix_audit_logs_entity_action", "entity_type", "entity_id", "action"),
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
        Index("ix_audit_logs_created_action", "created_at", "action"),
        Index("ix_audit_logs_success_created", "success", "created_at"),
        Index("ix_audit_logs_universal_package", "universal_package_registry_key"),
        Index("ix_audit_logs_cross_ecosystem", "cross_ecosystem_operation", "created_at"),
        Index("ix_audit_logs_polyglot_project", "polyglot_project_id"),
        Index("ix_audit_logs_bridge_mechanism", "bridge_mechanism_used"),
    )
