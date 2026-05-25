"""
Environment model for deployment environment management.

Manages deployment environments, their configurations,
and associated resources.
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from sqlalchemy import JSON, Boolean, Column, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel


class EnvironmentStatus(str, Enum):
    """Environment status values."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    MAINTENANCE = "maintenance"
    DEPRECATED = "deprecated"
    ARCHIVED = "archived"


class Environment(BaseModel):
    """
    Deployment environment model.

    Represents deployment environments (dev, staging, prod)
    with their configurations and access controls.
    """

    __tablename__ = "environments"

    # Environment identification
    name = Column(String(255), nullable=False, index=True, comment="Environment name")

    slug = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="URL-friendly environment identifier",
    )

    # Environment classification
    environment_type = Column(
        String(50),
        nullable=False,
        index=True,
        comment="Environment type (development, staging, production)",
    )

    status = Column(
        String(50),
        nullable=False,
        default=EnvironmentStatus.ACTIVE,
        comment="Environment status",
    )

    # Description and purpose
    description = Column(
        Text, nullable=True, comment="Environment description and purpose"
    )

    # Access control
    is_public = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether environment is publicly accessible",
    )

    requires_auth = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether authentication is required",
    )

    # Network configuration
    base_url = Column(
        String(500), nullable=True, comment="Base URL for the environment"
    )

    host = Column(String(255), nullable=True, comment="Environment hostname")

    port = Column(Integer, nullable=True, comment="Environment port")

    # Infrastructure details
    provider = Column(
        String(100),
        nullable=True,
        index=True,
        comment="Cloud provider (AWS, GCP, Azure, etc.)",
    )

    region = Column(String(100), nullable=True, comment="Cloud region")

    availability_zone = Column(String(100), nullable=True, comment="Availability zone")

    # Resource information
    cluster_name = Column(
        String(255), nullable=True, comment="Kubernetes/ECS cluster name"
    )

    namespace = Column(String(255), nullable=True, comment="Kubernetes namespace")

    # Environment configuration
    config = Column(JSON, default=dict, comment="Environment-specific configuration")

    environment_variables = Column(JSON, default=dict, comment="Environment variables")

    secrets = Column(JSON, default=dict, comment="Encrypted secrets (stored securely)")

    # Resource limits
    cpu_limit = Column(Integer, nullable=True, comment="CPU limit (cores)")

    memory_limit = Column(Integer, nullable=True, comment="Memory limit (MB)")

    storage_limit = Column(Integer, nullable=True, comment="Storage limit (GB)")

    # Service configuration
    services = Column(
        JSON, default=list, comment="List of services running in environment"
    )

    endpoints = Column(JSON, default=list, comment="List of service endpoints")

    # Monitoring and logging
    monitoring_enabled = Column(
        Boolean, default=True, nullable=False, comment="Whether monitoring is enabled"
    )

    monitoring_config = Column(JSON, default=dict, comment="Monitoring configuration")

    logging_enabled = Column(
        Boolean, default=True, nullable=False, comment="Whether logging is enabled"
    )

    log_level = Column(
        String(20), default="INFO", nullable=False, comment="Default log level"
    )

    # Security configuration
    ssl_enabled = Column(
        Boolean, default=True, nullable=False, comment="Whether SSL/TLS is enabled"
    )

    firewall_rules = Column(JSON, default=list, comment="Firewall rules")

    allowed_ips = Column(JSON, default=list, comment="List of allowed IP addresses")

    # Ownership and scope
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=True,
        index=True,
        comment="Owning organization",
    )

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Associated project",
    )

    # Lifecycle
    created_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When environment was created",
    )

    last_deployed_at = Column(
        String(50), nullable=True, comment="When last deployment occurred"
    )

    archived_at = Column(
        String(50), nullable=True, comment="When environment was archived"
    )

    # Indexes
    __table_args__ = (
        Index("idx_environments_type_status", "environment_type", "status"),
        Index("idx_environments_org_project", "organization_id", "project_id"),
        Index("idx_environments_provider_region", "provider", "region"),
        Index("idx_environments_public_auth", "is_public", "requires_auth"),
    )

    # Relationships
    organization = relationship("Organization", backref="environments")
    project = relationship("Project", backref="environments")

    def activate(self):
        """Activate the environment."""
        self.status = EnvironmentStatus.ACTIVE
        self.archived_at = None

    def deactivate(self):
        """Deactivate the environment."""
        self.status = EnvironmentStatus.INACTIVE

    def set_maintenance(self, reason: Optional[str] = None):
        """Put environment in maintenance mode."""
        self.status = EnvironmentStatus.MAINTENANCE
        if reason:
            self.add_metadata({"maintenance_reason": reason})

    def archive(self):
        """Archive the environment."""
        self.status = EnvironmentStatus.ARCHIVED
        self.archived_at = datetime.utcnow().isoformat()

    @property
    def is_production(self) -> bool:
        """Check if this is a production environment."""
        return self.environment_type.lower() in ["production", "prod"]

    @property
    def is_development(self) -> bool:
        """Check if this is a development environment."""
        return self.environment_type.lower() in ["development", "dev", "local"]

    @property
    def is_staging(self) -> bool:
        """Check if this is a staging environment."""
        return self.environment_type.lower() in [
            "staging",
            "stage",
            "pre-prod",
            "preprod",
        ]

    @property
    def is_active(self) -> bool:
        """Check if environment is active."""
        return self.status == EnvironmentStatus.ACTIVE

    def can_deploy(self, user_role: str) -> bool:
        """Check if user can deploy to this environment."""
        # Basic role-based access control
        if self.is_production and user_role not in [
            "admin",
            "devops",
            "release_manager",
        ]:
            return False

        if self.is_staging and user_role not in ["admin", "devops", "developer", "qa"]:
            return False

        return self.is_active

    def get_service_url(self, service_name: str) -> Optional[str]:
        """Get URL for a specific service."""
        if not self.services or not self.base_url:
            return None

        for service in self.services:
            if service.get("name") == service_name:
                return f"{self.base_url}/{service.get('path', service_name)}"

        return None

    def get_variable(self, key: str, default=None):
        """Get environment variable value."""
        if not self.environment_variables:
            return default
        return self.environment_variables.get(key, default)

    def set_variable(self, key: str, value: str, is_secret: bool = False):
        """Set environment variable."""
        if not self.environment_variables:
            self.environment_variables = {}

        self.environment_variables[key] = {
            "value": value,
            "is_secret": is_secret,
            "updated_at": datetime.utcnow().isoformat(),
        }

    def add_service(self, name: str, config: Dict):
        """Add a service to the environment."""
        if not self.services:
            self.services = []

        service = {
            "name": name,
            "config": config,
            "added_at": datetime.utcnow().isoformat(),
        }

        self.services.append(service)

    def remove_service(self, name: str):
        """Remove a service from the environment."""
        if not self.services:
            return

        self.services = [s for s in self.services if s.get("name") != name]

    def update_last_deployment(self):
        """Update last deployment timestamp."""
        self.last_deployed_at = datetime.utcnow().isoformat()

    def __repr__(self) -> str:
        return f"<Environment(id={self.id}, name={self.name}, type={self.environment_type})>"


class EnvironmentVariable(BaseModel):
    """
    Environment variable model.

    Stores environment variables and secrets for
    different environments with encryption support.
    """

    __tablename__ = "environment_variables"

    # Variable identification
    name = Column(String(255), nullable=False, index=True, comment="Variable name")

    # Scope
    environment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("environments.id"),
        nullable=False,
        index=True,
        comment="Environment ID",
    )

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True,
        comment="Project ID (null for org-level vars)",
    )

    # Variable properties
    value = Column(Text, nullable=True, comment="Variable value (encrypted if secret)")

    encrypted_value = Column(
        Text, nullable=True, comment="Encrypted variable value for secrets"
    )

    is_secret = Column(
        Boolean, default=False, nullable=False, comment="Whether variable is a secret"
    )

    is_required = Column(
        Boolean, default=False, nullable=False, comment="Whether variable is required"
    )

    default_value = Column(Text, nullable=True, comment="Default value if not set")

    # Variable metadata
    description = Column(Text, nullable=True, comment="Variable description")

    variable_type = Column(
        String(50),
        default="string",
        comment="Variable type (string, number, boolean, json)",
    )

    validation_pattern = Column(
        String(500), nullable=True, comment="Validation regex pattern"
    )

    # Access control
    access_roles = Column(
        JSON, default=list, comment="Roles that can access this variable"
    )

    # Versioning
    version = Column(Integer, default=1, nullable=False, comment="Variable version")

    # Indexes
    __table_args__ = (
        Index("idx_env_vars_env_name", "environment_id", "name"),
        Index("idx_env_vars_secret", "is_secret", "environment_id"),
        Index("idx_env_vars_project", "project_id", "is_secret"),
    )

    # Relationships
    environment = relationship("Environment", backref="variables")
    project = relationship("Project", backref="environment_variables")

    def get_value(self) -> Optional[str]:
        """Get variable value (decrypt if secret)."""
        if self.is_secret:
            # TODO: Implement decryption
            return self.encrypted_value
        return self.value

    def set_value(self, value: str, encrypt: bool = False):
        """Set variable value (encrypt if secret)."""
        if self.is_secret or encrypt:
            # TODO: Implement encryption
            self.encrypted_value = value
            self.value = None
        else:
            self.value = value
            self.encrypted_value = None

    def increment_version(self):
        """Increment variable version."""
        self.version += 1

    def __repr__(self) -> str:
        return f"<EnvironmentVariable(id={self.id}, name={self.name}, env_id={self.environment_id})>"
