"""
Core data models for the Universal Dependency Platform (UPM).

This module contains all SQLAlchemy models representing the core entities
in the UPM system including organizations, projects, dependencies,
vulnerabilities, workflows, and more.
"""

from .base import Base
from .organization import Organization, OrganizationMember
from .user import User
from .project import Project
from .package import Package, PackageVersion
from .dependency import Dependency
from .vulnerability import (
    Vulnerability,
    VulnerabilityPackageModel,
    ProjectVulnerabilityModel,
)
from .license import License
from .repository import Repository, RepositoryType, RepositoryProvider, ScanStatus
from .compliance import (
    ComplianceRule,
    ComplianceCheck,
    ComplianceReport,
    ComplianceStatus,
    ViolationSeverity,
)
from .analysis import (
    Analysis,
    AnalysisResult,
    SBOM,
    AnalysisType,
    AnalysisStatus,
    SeverityLevel,
)
from .build import Build, Deployment, BuildStatus, BuildType, EnvironmentType
from .environment import Environment, EnvironmentVariable, EnvironmentStatus
from .policy import Policy
from .workflow import Workflow
from .rbac import (
    Permission,
    Role,
    UserRoleAssignment,
    ResourcePermission,
    RoleTemplate,
    PermissionScope,
    ResourceType,
)
from .feedback import UserFeedback, RecommendationMetrics

__all__ = [
    # Base model
    "Base",
    # Organization and user models
    "Organization",
    "OrganizationMember",
    "User",
    # Project and dependency models
    "Project",
    "Package",
    "PackageVersion",
    "Dependency",
    "DependencyResolution",
    # Security and vulnerability models
    "Vulnerability",
    "PackageVulnerability",
    "ProjectVulnerability",
    # License and compliance models
    "License",
    "ComplianceRule",
    "ComplianceCheck",
    "ComplianceReport",
    "ComplianceStatus",
    "ViolationSeverity",
    # Repository and build models
    "Repository",
    "RepositoryType",
    "RepositoryProvider",
    "ScanStatus",
    "Build",
    "Deployment",
    "BuildStatus",
    "BuildType",
    "EnvironmentType",
    # Analysis and SBOM models
    "Analysis",
    "AnalysisResult",
    "SBOM",
    "AnalysisType",
    "AnalysisStatus",
    "SeverityLevel",
    # Environment models
    "Environment",
    "EnvironmentVariable",
    "EnvironmentStatus",
    # Policy and workflow models
    "Policy",
    "Workflow",
    # RBAC models
    "Permission",
    "Role",
    "UserRoleAssignment",
    "ResourcePermission",
    "RoleTemplate",
    "PermissionScope",
    "ResourceType",
    # Feedback and metrics models
    "UserFeedback",
    "RecommendationMetrics",
]
