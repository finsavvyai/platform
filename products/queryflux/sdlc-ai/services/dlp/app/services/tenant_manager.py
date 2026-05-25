"""
Multi-tenant DLP System for SDLC.ai DLP Service.

This module provides comprehensive multi-tenancy support with tenant isolation,
resource quotas, policy management, and audit logging per tenant.
"""

import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import json
import threading
from collections import defaultdict
import hashlib

from app.core.config import get_settings
from app.models.schemas import ViolationSeverity, RiskLevel

logger = logging.getLogger(__name__)


class TenantStatus(str, Enum):
    """Tenant status values."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"


class ResourceType(str, Enum):
    """Resource types for quota management."""

    SCANS_PER_DAY = "SCANS_PER_DAY"
    SCANS_PER_HOUR = "SCANS_PER_HOUR"
    CONTENT_SIZE_MB = "CONTENT_SIZE_MB"
    POLICIES = "POLICIES"
    RULES = "RULES"
    PATTERNS = "PATTERNS"
    ALERTS_PER_DAY = "ALERTS_PER_DAY"
    API_CALLS_PER_HOUR = "API_CALLS_PER_HOUR"
    STORAGE_GB = "STORAGE_GB"


@dataclass
class TenantQuota:
    """Resource quota configuration for a tenant."""

    resource_type: ResourceType
    limit: int
    current_usage: int = 0
    reset_time: Optional[datetime] = None
    warning_threshold: float = 0.8  # 80% of limit

    def __post_init__(self):
        """Initialize reset time if not provided."""
        if self.reset_time is None:
            if self.resource_type in [
                ResourceType.SCANS_PER_DAY,
                ResourceType.ALERTS_PER_DAY,
            ]:
                self.reset_time = datetime.utcnow().replace(
                    hour=0, minute=0, second=0, microsecond=0
                ) + timedelta(days=1)
            elif self.resource_type in [
                ResourceType.SCANS_PER_HOUR,
                ResourceType.API_CALLS_PER_HOUR,
            ]:
                self.reset_time = datetime.utcnow().replace(
                    minute=0, second=0, microsecond=0
                ) + timedelta(hours=1)

    @property
    def usage_percentage(self) -> float:
        """Calculate usage percentage."""
        if self.limit == 0:
            return 0.0
        return (self.current_usage / self.limit) * 100

    @property
    def is_warning_threshold_exceeded(self) -> bool:
        """Check if warning threshold is exceeded."""
        return self.usage_percentage >= (self.warning_threshold * 100)

    @property
    def is_quota_exceeded(self) -> bool:
        """Check if quota is exceeded."""
        return self.current_usage >= self.limit

    def can_consume(self, amount: int = 1) -> bool:
        """Check if tenant can consume specified amount."""
        return (self.current_usage + amount) <= self.limit

    def consume(self, amount: int = 1) -> bool:
        """Consume quota amount."""
        if not self.can_consume(amount):
            return False

        self.current_usage += amount
        return True

    def reset_if_needed(self) -> bool:
        """Reset quota if reset time has passed."""
        if self.reset_time and datetime.utcnow() >= self.reset_time:
            self.current_usage = 0

            # Set next reset time
            if self.resource_type in [
                ResourceType.SCANS_PER_DAY,
                ResourceType.ALERTS_PER_DAY,
            ]:
                self.reset_time = datetime.utcnow().replace(
                    hour=0, minute=0, second=0, microsecond=0
                ) + timedelta(days=1)
            elif self.resource_type in [
                ResourceType.SCANS_PER_HOUR,
                ResourceType.API_CALLS_PER_HOUR,
            ]:
                self.reset_time = datetime.utcnow().replace(
                    minute=0, second=0, microsecond=0
                ) + timedelta(hours=1)

            return True
        return False


@dataclass
class TenantConfiguration:
    """Tenant-specific configuration."""

    tenant_id: str
    name: str
    status: TenantStatus = TenantStatus.ACTIVE

    # Quota configuration
    quotas: Dict[ResourceType, TenantQuota] = field(default_factory=dict)

    # DLP configuration
    default_policies: List[str] = field(default_factory=list)
    default_rules: List[str] = field(default_factory=list)
    custom_patterns: List[str] = field(default_factory=list)

    # Feature flags
    features_enabled: Dict[str, bool] = field(default_factory=dict)

    # Integration settings
    alert_webhooks: List[str] = field(default_factory=list)
    sso_config: Dict[str, Any] = field(default_factory=dict)

    # Compliance settings
    compliance_standards: List[str] = field(default_factory=list)
    retention_days: int = 365

    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    # Audit settings
    audit_enabled: bool = True
    audit_retention_days: int = 2555  # 7 years

    def __post_init__(self):
        """Set default quotas if not provided."""
        if not self.quotas:
            self.quotas = self._get_default_quotas()

        # Set default features
        if not self.features_enabled:
            self.features_enabled = {
                "real_time_scanning": True,
                "batch_scanning": True,
                "streaming_scanning": True,
                "ml_classification": True,
                "custom_patterns": True,
                "custom_rules": True,
                "alerting": True,
                "reporting": True,
                "api_access": True,
            }

    def _get_default_quotas(self) -> Dict[ResourceType, TenantQuota]:
        """Get default quota configuration."""
        return {
            ResourceType.SCANS_PER_DAY: TenantQuota(
                resource_type=ResourceType.SCANS_PER_DAY, limit=10000
            ),
            ResourceType.SCANS_PER_HOUR: TenantQuota(
                resource_type=ResourceType.SCANS_PER_HOUR, limit=500
            ),
            ResourceType.CONTENT_SIZE_MB: TenantQuota(
                resource_type=ResourceType.CONTENT_SIZE_MB, limit=100
            ),
            ResourceType.POLICIES: TenantQuota(
                resource_type=ResourceType.POLICIES, limit=50
            ),
            ResourceType.RULES: TenantQuota(
                resource_type=ResourceType.RULES, limit=200
            ),
            ResourceType.PATTERNS: TenantQuota(
                resource_type=ResourceType.PATTERNS, limit=100
            ),
            ResourceType.ALERTS_PER_DAY: TenantQuota(
                resource_type=ResourceType.ALERTS_PER_DAY, limit=1000
            ),
            ResourceType.API_CALLS_PER_HOUR: TenantQuota(
                resource_type=ResourceType.API_CALLS_PER_HOUR, limit=5000
            ),
            ResourceType.STORAGE_GB: TenantQuota(
                resource_type=ResourceType.STORAGE_GB, limit=10
            ),
        }


@dataclass
class TenantAuditLog:
    """Audit log entry for tenant operations."""

    id: str
    tenant_id: str

    # Event details
    event_type: str
    event_category: str
    event_action: str

    # Resource information
    resource_type: Optional[str]
    resource_id: Optional[str]

    # User information
    user_id: Optional[str]
    user_email: Optional[str]

    # Request information
    request_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]

    # Event data
    details: Dict[str, Any] = field(default_factory=dict)

    # Result
    success: bool = True
    error_message: Optional[str] = None

    # Metadata
    timestamp: datetime = field(default_factory=datetime.utcnow)
    duration_ms: int = 0


class TenantManager:
    """Manages multi-tenant operations and isolation."""

    def __init__(self):
        self.settings = get_settings()

        # Tenant storage
        self.tenants: Dict[str, TenantConfiguration] = {}
        self._tenants_lock = threading.RLock()

        # Audit logs
        self.audit_logs: List[TenantAuditLog] = []
        self._audit_lock = threading.RLock()

        # Initialize default tenant if not exists
        self._ensure_default_tenant()

        # Start background tasks
        self._start_background_tasks()

    def _ensure_default_tenant(self):
        """Ensure default tenant exists."""
        with self._tenants_lock:
            if self.settings.default_tenant_id not in self.tenants:
                default_tenant = TenantConfiguration(
                    tenant_id=self.settings.default_tenant_id,
                    name="Default Tenant",
                    status=TenantStatus.ACTIVE,
                    created_by="system",
                )
                self.tenants[self.settings.default_tenant_id] = default_tenant
                logger.info(
                    f"Created default tenant: {self.settings.default_tenant_id}"
                )

    def _start_background_tasks(self):
        """Start background maintenance tasks."""
        import threading

        # Quota reset task
        def quota_reset_worker():
            while True:
                try:
                    self._reset_expired_quotas()
                    time.sleep(60)  # Check every minute
                except Exception as e:
                    logger.error(f"Error in quota reset worker: {e}")
                    time.sleep(60)

        quota_thread = threading.Thread(target=quota_reset_worker, daemon=True)
        quota_thread.start()

        # Audit log cleanup task
        def audit_cleanup_worker():
            while True:
                try:
                    self._cleanup_audit_logs()
                    time.sleep(3600)  # Check every hour
                except Exception as e:
                    logger.error(f"Error in audit cleanup worker: {e}")
                    time.sleep(3600)

        audit_thread = threading.Thread(target=audit_cleanup_worker, daemon=True)
        audit_thread.start()

    def create_tenant(
        self, tenant_config: TenantConfiguration
    ) -> Tuple[bool, List[str]]:
        """Create a new tenant."""
        errors = []

        with self._tenants_lock:
            # Validate tenant configuration
            if not tenant_config.tenant_id:
                errors.append("Tenant ID is required")

            if not tenant_config.name:
                errors.append("Tenant name is required")

            if tenant_config.tenant_id in self.tenants:
                errors.append(
                    f"Tenant with ID {tenant_config.tenant_id} already exists"
                )

            if errors:
                return False, errors

            # Create tenant
            self.tenants[tenant_config.tenant_id] = tenant_config

            # Log creation
            self._log_audit_event(
                tenant_id=tenant_config.tenant_id,
                event_type="TENANT_CREATED",
                event_category="TENANT_MANAGEMENT",
                event_action="CREATE",
                resource_type="TENANT",
                resource_id=tenant_config.tenant_id,
                details={
                    "name": tenant_config.name,
                    "status": tenant_config.status.value,
                    "quotas": {
                        k.value: v.limit for k, v in tenant_config.quotas.items()
                    },
                },
            )

            logger.info(f"Created tenant: {tenant_config.tenant_id}")
            return True, []

    def get_tenant(self, tenant_id: str) -> Optional[TenantConfiguration]:
        """Get tenant configuration by ID."""
        with self._tenants_lock:
            return self.tenants.get(tenant_id)

    def update_tenant(
        self, tenant_id: str, updates: Dict[str, Any]
    ) -> Tuple[bool, List[str]]:
        """Update tenant configuration."""
        errors = []

        with self._tenants_lock:
            tenant = self.tenants.get(tenant_id)
            if not tenant:
                errors.append(f"Tenant not found: {tenant_id}")
                return False, errors

            # Update tenant
            old_values = {}
            for field, value in updates.items():
                if hasattr(tenant, field):
                    old_values[field] = getattr(tenant, field)
                    setattr(tenant, field, value)

            tenant.updated_at = datetime.utcnow()

            # Log update
            self._log_audit_event(
                tenant_id=tenant_id,
                event_type="TENANT_UPDATED",
                event_category="TENANT_MANAGEMENT",
                event_action="UPDATE",
                resource_type="TENANT",
                resource_id=tenant_id,
                details={
                    "updates": updates,
                    "old_values": old_values,
                },
            )

            logger.info(f"Updated tenant: {tenant_id}")
            return True, []

    def delete_tenant(self, tenant_id: str) -> bool:
        """Delete a tenant."""
        with self._tenants_lock:
            if tenant_id not in self.tenants:
                return False

            # Cannot delete default tenant
            if tenant_id == self.settings.default_tenant_id:
                logger.warning("Cannot delete default tenant")
                return False

            # Get tenant details for logging
            tenant = self.tenants[tenant_id]

            # Delete tenant
            del self.tenants[tenant_id]

            # Log deletion
            self._log_audit_event(
                tenant_id=tenant_id,
                event_type="TENANT_DELETED",
                event_category="TENANT_MANAGEMENT",
                event_action="DELETE",
                resource_type="TENANT",
                resource_id=tenant_id,
                details={
                    "name": tenant.name,
                    "status": tenant.status.value,
                },
            )

            logger.info(f"Deleted tenant: {tenant_id}")
            return True

    def list_tenants(
        self, status: Optional[TenantStatus] = None, active_only: bool = False
    ) -> List[TenantConfiguration]:
        """List tenants with optional filtering."""
        with self._tenants_lock:
            tenants = list(self.tenants.values())

        # Apply filters
        if status:
            tenants = [t for t in tenants if t.status == status]

        if active_only:
            tenants = [t for t in tenants if t.status == TenantStatus.ACTIVE]

        return tenants

    def check_quota(
        self, tenant_id: str, resource_type: ResourceType, amount: int = 1
    ) -> Tuple[bool, str]:
        """Check if tenant has sufficient quota."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False, "Tenant not found"

        if tenant.status != TenantStatus.ACTIVE:
            return False, "Tenant is not active"

        quota = tenant.quotas.get(resource_type)
        if not quota:
            return False, f"Quota not configured for resource type: {resource_type}"

        # Reset quota if needed
        quota.reset_if_needed()

        # Check quota
        if not quota.can_consume(amount):
            return (
                False,
                f"Quota exceeded for {resource_type}. Current: {quota.current_usage}, Limit: {quota.limit}",
            )

        # Check warning threshold
        if quota.is_warning_threshold_exceeded:
            logger.warning(
                f"Tenant {tenant_id} quota warning for {resource_type}: "
                f"{quota.current_usage}/{quota.limit} ({quota.usage_percentage:.1f}%)"
            )

        return True, "OK"

    def consume_quota(
        self,
        tenant_id: str,
        resource_type: ResourceType,
        amount: int = 1,
        auto_reset: bool = True,
    ) -> Tuple[bool, str]:
        """Consume quota amount for tenant."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False, "Tenant not found"

        if tenant.status != TenantStatus.ACTIVE:
            return False, "Tenant is not active"

        quota = tenant.quotas.get(resource_type)
        if not quota:
            return False, f"Quota not configured for resource type: {resource_type}"

        # Reset quota if needed
        if auto_reset:
            quota.reset_if_needed()

        # Consume quota
        if not quota.consume(amount):
            return False, f"Insufficient quota for {resource_type}"

        # Log quota consumption
        self._log_audit_event(
            tenant_id=tenant_id,
            event_type="QUOTA_CONSUMED",
            event_category="RESOURCE_USAGE",
            event_action="CONSUME",
            resource_type=resource_type.value,
            details={
                "amount": amount,
                "remaining": quota.limit - quota.current_usage,
                "usage_percentage": quota.usage_percentage,
            },
        )

        return True, "OK"

    def get_quota_usage(self, tenant_id: str) -> Dict[str, Any]:
        """Get quota usage for tenant."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return {}

        quota_info = {}
        for resource_type, quota in tenant.quotas.items():
            # Reset if needed
            quota.reset_if_needed()

            quota_info[resource_type.value] = {
                "limit": quota.limit,
                "current_usage": quota.current_usage,
                "remaining": quota.limit - quota.current_usage,
                "usage_percentage": quota.usage_percentage,
                "is_warning_exceeded": quota.is_warning_threshold_exceeded,
                "is_quota_exceeded": quota.is_quota_exceeded,
                "reset_time": quota.reset_time.isoformat()
                if quota.reset_time
                else None,
            }

        return quota_info

    def is_feature_enabled(self, tenant_id: str, feature: str) -> bool:
        """Check if feature is enabled for tenant."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False

        return tenant.features_enabled.get(feature, False)

    def enable_feature(self, tenant_id: str, feature: str) -> bool:
        """Enable a feature for tenant."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False

        tenant.features_enabled[feature] = True
        tenant.updated_at = datetime.utcnow()

        self._log_audit_event(
            tenant_id=tenant_id,
            event_type="FEATURE_ENABLED",
            event_category="FEATURE_MANAGEMENT",
            event_action="ENABLE",
            resource_type="FEATURE",
            resource_id=feature,
            details={"feature": feature},
        )

        return True

    def disable_feature(self, tenant_id: str, feature: str) -> bool:
        """Disable a feature for tenant."""
        tenant = self.get_tenant(tenant_id)
        if not tenant:
            return False

        tenant.features_enabled[feature] = False
        tenant.updated_at = datetime.utcnow()

        self._log_audit_event(
            tenant_id=tenant_id,
            event_type="FEATURE_DISABLED",
            event_category="FEATURE_MANAGEMENT",
            event_action="DISABLE",
            resource_type="FEATURE",
            resource_id=feature,
            details={"feature": feature},
        )

        return True

    def _log_audit_event(
        self,
        tenant_id: str,
        event_type: str,
        event_category: str,
        event_action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        request_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Dict[str, Any] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        duration_ms: int = 0,
    ):
        """Log an audit event."""
        audit_log = TenantAuditLog(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            event_type=event_type,
            event_category=event_category,
            event_action=event_action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_email=user_email,
            request_id=request_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
            success=success,
            error_message=error_message,
            duration_ms=duration_ms,
        )

        with self._audit_lock:
            self.audit_logs.append(audit_log)

    def get_audit_logs(
        self,
        tenant_id: Optional[str] = None,
        event_type: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[TenantAuditLog]:
        """Get audit logs with filtering."""
        with self._audit_lock:
            logs = self.audit_logs.copy()

        # Apply filters
        if tenant_id:
            logs = [log for log in logs if log.tenant_id == tenant_id]

        if event_type:
            logs = [log for log in logs if log.event_type == event_type]

        if start_time:
            logs = [log for log in logs if log.timestamp >= start_time]

        if end_time:
            logs = [log for log in logs if log.timestamp <= end_time]

        # Sort by timestamp (newest first)
        logs.sort(key=lambda x: x.timestamp, reverse=True)

        # Apply pagination
        return logs[offset : offset + limit]

    def _reset_expired_quotas(self):
        """Reset quotas that have expired."""
        with self._tenants_lock:
            for tenant in self.tenants.values():
                for quota in tenant.quotas.values():
                    if quota.reset_if_needed():
                        logger.debug(
                            f"Reset quota for tenant {tenant.tenant_id}, resource {quota.resource_type}"
                        )

    def _cleanup_audit_logs(self):
        """Clean up old audit logs."""
        cutoff_time = datetime.utcnow() - timedelta(days=2555)  # 7 years

        with self._audit_lock:
            original_count = len(self.audit_logs)
            self.audit_logs = [
                log for log in self.audit_logs if log.timestamp > cutoff_time
            ]

            removed_count = original_count - len(self.audit_logs)
            if removed_count > 0:
                logger.info(f"Cleaned up {removed_count} old audit log entries")

    def get_tenant_statistics(self) -> Dict[str, Any]:
        """Get tenant statistics and summary."""
        with self._tenants_lock:
            tenants = list(self.tenants.values())

        # Basic counts
        total_tenants = len(tenants)
        active_tenants = len([t for t in tenants if t.status == TenantStatus.ACTIVE])
        inactive_tenants = len(
            [t for t in tenants if t.status == TenantStatus.INACTIVE]
        )
        suspended_tenants = len(
            [t for t in tenants if t.status == TenantStatus.SUSPENDED]
        )

        # Quota usage summary
        quota_summary = {}
        for resource_type in ResourceType:
            total_limit = 0
            total_usage = 0

            for tenant in tenants:
                quota = tenant.quotas.get(resource_type)
                if quota:
                    total_limit += quota.limit
                    total_usage += quota.current_usage

            quota_summary[resource_type.value] = {
                "total_limit": total_limit,
                "total_usage": total_usage,
                "usage_percentage": (total_usage / total_limit * 100)
                if total_limit > 0
                else 0,
            }

        # Feature usage
        feature_usage = defaultdict(int)
        for tenant in tenants:
            for feature, enabled in tenant.features_enabled.items():
                if enabled:
                    feature_usage[feature] += 1

        return {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "inactive_tenants": inactive_tenants,
            "suspended_tenants": suspended_tenants,
            "quota_summary": quota_summary,
            "feature_usage": dict(feature_usage),
            "total_audit_logs": len(self.audit_logs),
        }


# Singleton instance
_tenant_manager = None


def get_tenant_manager() -> TenantManager:
    """Get singleton instance of tenant manager."""
    global _tenant_manager
    if _tenant_manager is None:
        _tenant_manager = TenantManager()
    return _tenant_manager


class TenantContext:
    """Context manager for tenant operations."""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.tenant_manager = get_tenant_manager()
        self.start_time = time.time()

    def __enter__(self):
        # Validate tenant exists and is active
        tenant = self.tenant_manager.get_tenant(self.tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {self.tenant_id}")

        if tenant.status != TenantStatus.ACTIVE:
            raise ValueError(f"Tenant is not active: {self.tenant_id}")

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Log operation completion
        duration_ms = int((time.time() - self.start_time) * 1000)

        self.tenant_manager._log_audit_event(
            tenant_id=self.tenant_id,
            event_type="OPERATION_COMPLETED",
            event_category="SYSTEM",
            event_action="EXECUTE",
            details={
                "duration_ms": duration_ms,
                "success": exc_type is None,
                "error": str(exc_val) if exc_val else None,
            },
            success=exc_type is None,
            duration_ms=duration_ms,
        )
