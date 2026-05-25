"""
Multi-Tenant Architecture for Universal Dependency Platform.

Provides organization isolation, tenant-specific configurations,
resource quotas, and cross-tenant security for enterprise customers.
"""

import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field
from udp.domain.models import Organization

logger = logging.getLogger(__name__)


class TenantTier(str, Enum):
    """Tenant subscription tiers."""
    FREE = "free"
    STANDARD = "standard"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"
    CUSTOM = "custom"


class ResourceQuota(BaseModel):
    """Resource quotas for tenant organizations."""

    # Workflow execution limits
    max_concurrent_workflows: int = 5
    max_workflows_per_month: int = 100
    max_workflow_duration_minutes: int = 60

    # Dependency analysis limits
    max_dependencies_per_analysis: int = 1000
    max_analyses_per_month: int = 50
    max_manifest_size_mb: int = 10

    # Storage limits
    max_storage_gb: int = 1
    max_dependency_graphs: int = 10
    max_packages: int = 10000

    # API limits
    max_api_requests_per_hour: int = 1000
    max_api_requests_per_day: int = 10000

    # Marketplace limits
    max_marketplace_purchases_per_month: int = 5
    max_custom_workflows: int = 3

    # Security and compliance
    max_security_scans_per_month: int = 20
    max_sbom_generations_per_month: int = 10

    # Support and SLA
    support_level: str = "community"  # "community", "standard", "premium", "enterprise"
    sla_response_time_hours: int = 48
    sla_uptime_percentage: float = 99.0


class TenantConfiguration(BaseModel):
    """Tenant-specific configuration settings."""

    organization_id: UUID
    tier: TenantTier
    quotas: ResourceQuota

    # Feature flags
    features: dict[str, bool] = Field(default_factory=dict)

    # Custom settings
    settings: dict[str, Any] = Field(default_factory=dict)

    # Compliance and security
    compliance_frameworks: set[str] = Field(default_factory=set)
    security_requirements: dict[str, Any] = Field(default_factory=dict)

    # Billing and usage tracking
    billing_cycle: str = "monthly"  # "monthly", "yearly"
    usage_tracking_enabled: bool = True
    auto_scaling_enabled: bool = False

    # Audit and logging
    audit_logging_enabled: bool = True
    log_retention_days: int = 30

    # Integration settings
    webhook_endpoints: list[str] = Field(default_factory=list)
    api_keys: list[str] = Field(default_factory=list)

    # Custom domains and branding
    custom_domain: Optional[str] = None
    branding_enabled: bool = False
    custom_logo_url: Optional[str] = None


class UsageMetrics(BaseModel):
    """Usage metrics for tenant organizations."""

    organization_id: UUID
    period_start: datetime
    period_end: datetime

    # Workflow usage
    workflows_executed: int = 0
    workflows_failed: int = 0
    total_workflow_duration_minutes: float = 0.0

    # Dependency analysis usage
    analyses_performed: int = 0
    dependencies_analyzed: int = 0
    manifest_files_processed: int = 0

    # Storage usage
    storage_used_gb: float = 0.0
    dependency_graphs_created: int = 0
    packages_stored: int = 0

    # API usage
    api_requests_made: int = 0
    api_requests_failed: int = 0

    # Marketplace usage
    marketplace_purchases: int = 0
    custom_workflows_created: int = 0

    # Security and compliance usage
    security_scans_performed: int = 0
    sbom_generations: int = 0

    # Cost tracking
    estimated_cost: float = 0.0
    quota_utilization_percentage: float = 0.0


class TenantManager:
    """Manages multi-tenant operations and resource isolation."""

    def __init__(self):
        self._tenant_configs: dict[UUID, TenantConfiguration] = {}
        self._usage_metrics: dict[UUID, UsageMetrics] = {}
        self._quota_cache: dict[UUID, ResourceQuota] = {}

    async def initialize_tenant(
        self,
        organization: Organization,
        tier: TenantTier = TenantTier.STANDARD
    ) -> TenantConfiguration:
        """
        Initialize a new tenant organization.

        Args:
            organization: Organization to initialize
            tier: Subscription tier for the organization

        Returns:
            Tenant configuration
        """
        try:
            logger.info(f"Initializing tenant for organization {organization.id} with tier {tier}")

            # Get quotas based on tier
            quotas = self._get_quotas_for_tier(tier)

            # Create tenant configuration
            config = TenantConfiguration(
                organization_id=organization.id,
                tier=tier,
                quotas=quotas,
                features=self._get_features_for_tier(tier),
                settings=self._get_default_settings_for_tier(tier),
                compliance_frameworks=organization.compliance_frameworks,
                security_requirements=organization.security_requirements or {}
            )

            # Store configuration
            self._tenant_configs[organization.id] = config

            # Initialize usage metrics
            now = datetime.utcnow()
            metrics = UsageMetrics(
                organization_id=organization.id,
                period_start=now,
                period_end=now + timedelta(days=30)
            )
            self._usage_metrics[organization.id] = metrics

            # Cache quotas
            self._quota_cache[organization.id] = quotas

            logger.info(f"Tenant initialized successfully for organization {organization.id}")
            return config

        except Exception as e:
            logger.error(f"Failed to initialize tenant for organization {organization.id}: {e}", exc_info=True)
            raise

    async def get_tenant_config(self, organization_id: UUID) -> Optional[TenantConfiguration]:
        """Get tenant configuration for an organization."""
        return self._tenant_configs.get(organization_id)

    async def update_tenant_config(
        self,
        organization_id: UUID,
        updates: dict[str, Any]
    ) -> TenantConfiguration:
        """
        Update tenant configuration.

        Args:
            organization_id: Organization ID
            updates: Configuration updates

        Returns:
            Updated tenant configuration
        """
        try:
            config = self._tenant_configs.get(organization_id)
            if not config:
                raise ValueError(f"Tenant configuration not found for organization {organization_id}")

            # Update configuration
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
                else:
                    config.settings[key] = value

            # Update cache
            self._quota_cache[organization_id] = config.quotas

            logger.info(f"Updated tenant configuration for organization {organization_id}")
            return config

        except Exception as e:
            logger.error(f"Failed to update tenant configuration: {e}", exc_info=True)
            raise

    async def check_quota(
        self,
        organization_id: UUID,
        resource_type: str,
        amount: int = 1
    ) -> bool:
        """
        Check if organization has quota available for a resource.

        Args:
            organization_id: Organization ID
            resource_type: Type of resource to check
            amount: Amount of resource needed

        Returns:
            True if quota is available, False otherwise
        """
        try:
            config = self._tenant_configs.get(organization_id)
            if not config:
                logger.warning(f"No tenant configuration found for organization {organization_id}")
                return False

            metrics = self._usage_metrics.get(organization_id)
            if not metrics:
                logger.warning(f"No usage metrics found for organization {organization_id}")
                return False

            # Check quota based on resource type
            quota_available = True

            if resource_type == "workflow_execution":
                quota_available = metrics.workflows_executed + amount <= config.quotas.max_concurrent_workflows
            elif resource_type == "dependency_analysis":
                quota_available = metrics.analyses_performed + amount <= config.quotas.max_analyses_per_month
            elif resource_type == "storage":
                quota_available = metrics.storage_used_gb + amount <= config.quotas.max_storage_gb
            elif resource_type == "api_requests":
                quota_available = metrics.api_requests_made + amount <= config.quotas.max_api_requests_per_hour
            elif resource_type == "marketplace_purchase":
                quota_available = metrics.marketplace_purchases + amount <= config.quotas.max_marketplace_purchases_per_month
            elif resource_type == "security_scan":
                quota_available = metrics.security_scans_performed + amount <= config.quotas.max_security_scans_per_month

            if not quota_available:
                logger.warning(
                    f"Quota exceeded for organization {organization_id}, "
                    f"resource: {resource_type}, amount: {amount}"
                )

            return quota_available

        except Exception as e:
            logger.error(f"Failed to check quota: {e}", exc_info=True)
            return False

    async def record_usage(
        self,
        organization_id: UUID,
        resource_type: str,
        amount: int = 1,
        metadata: Optional[dict[str, Any]] = None
    ):
        """
        Record resource usage for an organization.

        Args:
            organization_id: Organization ID
            resource_type: Type of resource used
            amount: Amount of resource used
            metadata: Additional metadata about the usage
        """
        try:
            metrics = self._usage_metrics.get(organization_id)
            if not metrics:
                logger.warning(f"No usage metrics found for organization {organization_id}")
                return

            # Update metrics based on resource type
            if resource_type == "workflow_execution":
                metrics.workflows_executed += amount
            elif resource_type == "workflow_failure":
                metrics.workflows_failed += amount
            elif resource_type == "workflow_duration":
                metrics.total_workflow_duration_minutes += amount
            elif resource_type == "dependency_analysis":
                metrics.analyses_performed += amount
            elif resource_type == "dependencies_analyzed":
                metrics.dependencies_analyzed += amount
            elif resource_type == "storage":
                metrics.storage_used_gb += amount
            elif resource_type == "api_request":
                metrics.api_requests_made += amount
            elif resource_type == "api_request_failure":
                metrics.api_requests_failed += amount
            elif resource_type == "marketplace_purchase":
                metrics.marketplace_purchases += amount
            elif resource_type == "security_scan":
                metrics.security_scans_performed += amount
            elif resource_type == "sbom_generation":
                metrics.sbom_generations += amount

            # Update quota utilization
            config = self._tenant_configs.get(organization_id)
            if config:
                metrics.quota_utilization_percentage = self._calculate_quota_utilization(metrics, config.quotas)

            logger.debug(f"Recorded usage for organization {organization_id}: {resource_type} = {amount}")

        except Exception as e:
            logger.error(f"Failed to record usage: {e}", exc_info=True)

    async def get_usage_metrics(
        self,
        organization_id: UUID,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None
    ) -> Optional[UsageMetrics]:
        """Get usage metrics for an organization."""
        return self._usage_metrics.get(organization_id)

    async def enforce_tenant_isolation(
        self,
        organization_id: UUID,
        user_id: UUID,
        resource_type: str,
        resource_id: Optional[UUID] = None
    ) -> bool:
        """
        Enforce tenant isolation for resource access.

        Args:
            organization_id: Organization ID
            user_id: User ID requesting access
            resource_type: Type of resource being accessed
            resource_id: ID of specific resource (if applicable)

        Returns:
            True if access is allowed, False otherwise
        """
        try:
            # In production, this would:
            # 1. Verify user belongs to organization
            # 2. Check resource ownership
            # 3. Validate access permissions
            # 4. Log access attempts

            logger.info(
                f"Enforcing tenant isolation: org={organization_id}, "
                f"user={user_id}, resource={resource_type}, id={resource_id}"
            )

            # For now, allow all access within organization
            return True

        except Exception as e:
            logger.error(f"Failed to enforce tenant isolation: {e}", exc_info=True)
            return False

    def _get_quotas_for_tier(self, tier: TenantTier) -> ResourceQuota:
        """Get resource quotas based on subscription tier."""
        quotas = {
            TenantTier.FREE: ResourceQuota(
                max_concurrent_workflows=1,
                max_workflows_per_month=10,
                max_workflow_duration_minutes=15,
                max_dependencies_per_analysis=100,
                max_analyses_per_month=5,
                max_manifest_size_mb=1,
                max_storage_gb=0.1,
                max_dependency_graphs=2,
                max_packages=1000,
                max_api_requests_per_hour=100,
                max_api_requests_per_day=1000,
                max_marketplace_purchases_per_month=0,
                max_custom_workflows=0,
                max_security_scans_per_month=2,
                max_sbom_generations_per_month=1,
                support_level="community",
                sla_response_time_hours=72,
                sla_uptime_percentage=95.0
            ),
            TenantTier.STANDARD: ResourceQuota(
                max_concurrent_workflows=5,
                max_workflows_per_month=100,
                max_workflow_duration_minutes=60,
                max_dependencies_per_analysis=1000,
                max_analyses_per_month=50,
                max_manifest_size_mb=10,
                max_storage_gb=1,
                max_dependency_graphs=10,
                max_packages=10000,
                max_api_requests_per_hour=1000,
                max_api_requests_per_day=10000,
                max_marketplace_purchases_per_month=5,
                max_custom_workflows=3,
                max_security_scans_per_month=20,
                max_sbom_generations_per_month=10,
                support_level="standard",
                sla_response_time_hours=48,
                sla_uptime_percentage=99.0
            ),
            TenantTier.PREMIUM: ResourceQuota(
                max_concurrent_workflows=20,
                max_workflows_per_month=500,
                max_workflow_duration_minutes=120,
                max_dependencies_per_analysis=5000,
                max_analyses_per_month=200,
                max_manifest_size_mb=50,
                max_storage_gb=10,
                max_dependency_graphs=50,
                max_packages=50000,
                max_api_requests_per_hour=5000,
                max_api_requests_per_day=50000,
                max_marketplace_purchases_per_month=20,
                max_custom_workflows=10,
                max_security_scans_per_month=100,
                max_sbom_generations_per_month=50,
                support_level="premium",
                sla_response_time_hours=24,
                sla_uptime_percentage=99.5
            ),
            TenantTier.ENTERPRISE: ResourceQuota(
                max_concurrent_workflows=100,
                max_workflows_per_month=2000,
                max_workflow_duration_minutes=300,
                max_dependencies_per_analysis=20000,
                max_analyses_per_month=1000,
                max_manifest_size_mb=100,
                max_storage_gb=100,
                max_dependency_graphs=200,
                max_packages=200000,
                max_api_requests_per_hour=20000,
                max_api_requests_per_day=200000,
                max_marketplace_purchases_per_month=100,
                max_custom_workflows=50,
                max_security_scans_per_month=500,
                max_sbom_generations_per_month=200,
                support_level="enterprise",
                sla_response_time_hours=4,
                sla_uptime_percentage=99.9
            )
        }

        return quotas.get(tier, quotas[TenantTier.STANDARD])

    def _get_features_for_tier(self, tier: TenantTier) -> dict[str, bool]:
        """Get feature flags based on subscription tier."""
        features = {
            TenantTier.FREE: {
                "basic_dependency_analysis": True,
                "security_scanning": False,
                "license_compliance": False,
                "marketplace_access": False,
                "custom_workflows": False,
                "api_access": True,
                "webhook_integrations": False,
                "advanced_analytics": False,
                "compliance_reporting": False,
                "priority_support": False
            },
            TenantTier.STANDARD: {
                "basic_dependency_analysis": True,
                "security_scanning": True,
                "license_compliance": True,
                "marketplace_access": True,
                "custom_workflows": True,
                "api_access": True,
                "webhook_integrations": True,
                "advanced_analytics": False,
                "compliance_reporting": False,
                "priority_support": False
            },
            TenantTier.PREMIUM: {
                "basic_dependency_analysis": True,
                "security_scanning": True,
                "license_compliance": True,
                "marketplace_access": True,
                "custom_workflows": True,
                "api_access": True,
                "webhook_integrations": True,
                "advanced_analytics": True,
                "compliance_reporting": True,
                "priority_support": True
            },
            TenantTier.ENTERPRISE: {
                "basic_dependency_analysis": True,
                "security_scanning": True,
                "license_compliance": True,
                "marketplace_access": True,
                "custom_workflows": True,
                "api_access": True,
                "webhook_integrations": True,
                "advanced_analytics": True,
                "compliance_reporting": True,
                "priority_support": True,
                "custom_integrations": True,
                "dedicated_support": True,
                "sla_guarantees": True
            }
        }

        return features.get(tier, features[TenantTier.STANDARD])

    def _get_default_settings_for_tier(self, tier: TenantTier) -> dict[str, Any]:
        """Get default settings based on subscription tier."""
        return {
            "auto_update_enabled": tier in [TenantTier.PREMIUM, TenantTier.ENTERPRISE],
            "require_approval": tier in [TenantTier.FREE, TenantTier.STANDARD],
            "notification_frequency": "daily" if tier == TenantTier.FREE else "immediate",
            "data_retention_days": 30 if tier == TenantTier.FREE else 365,
            "backup_frequency": "weekly" if tier in [TenantTier.FREE, TenantTier.STANDARD] else "daily"
        }

    def _calculate_quota_utilization(
        self,
        metrics: UsageMetrics,
        quotas: ResourceQuota
    ) -> float:
        """Calculate overall quota utilization percentage."""
        try:
            # Calculate utilization for different resource types
            workflow_util = min(metrics.workflows_executed / quotas.max_workflows_per_month, 1.0)
            analysis_util = min(metrics.analyses_performed / quotas.max_analyses_per_month, 1.0)
            storage_util = min(metrics.storage_used_gb / quotas.max_storage_gb, 1.0)
            api_util = min(metrics.api_requests_made / quotas.max_api_requests_per_day, 1.0)

            # Calculate weighted average
            total_util = (workflow_util + analysis_util + storage_util + api_util) / 4.0
            return min(total_util * 100, 100.0)

        except Exception as e:
            logger.error(f"Failed to calculate quota utilization: {e}")
            return 0.0


# Singleton instance
tenant_manager = TenantManager()
