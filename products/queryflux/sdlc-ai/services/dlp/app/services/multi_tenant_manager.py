"""
Multi-tenant DLP System for SDLC.ai DLP Service.

This module provides comprehensive multi-tenancy support with tenant isolation,
policy inheritance, resource quotas, and per-tenant configuration management.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import json
import threading
from pathlib import Path
import copy

from app.core.config import get_settings
from app.models.database import Tenant, DLPPolicy, DLPRule
from app.models.schemas import ViolationSeverity

logger = logging.getLogger(__name__)


class TenantStatus(str, Enum):
    """Tenant status values."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    PENDING = "PENDING"
    TERMINATED = "TERMINATED"


class TenantTier(str, Enum):
    """Tenant subscription tiers."""

    FREE = "FREE"
    BASIC = "BASIC"
    PROFESSIONAL = "PROFESSIONAL"
    ENTERPRISE = "ENTERPRISE"
    CUSTOM = "CUSTOM"


@dataclass
class TenantQuota:
    """Resource quota configuration for a tenant."""

    # Scanning quotas
    max_scans_per_day: int = 1000
    max_scans_per_hour: int = 100
    max_content_size_mb: int = 100
    max_batch_size: int = 100

    # Policy quotas
    max_policies: int = 10
    max_rules_per_policy: int = 50
    max_custom_patterns: int = 20

    # Storage quotas
    max_violation_retention_days: int = 90
    max_audit_retention_days: int = 365

    # Alert quotas
    max_alert_configurations: int = 5
    max_alerts_per_hour: int = 50

    # Performance quotas
    max_concurrent_scans: int = 5
    cache_size_mb: int = 100


@dataclass
class TenantConfiguration:
    """Configuration for a specific tenant."""

    tenant_id: str
    tier: TenantTier

    # DLP Configuration
    enabled_features: List[str] = field(default_factory=list)
    disabled_features: List[str] = field(default_factory=list)

    # Presidio Configuration
    presidio_enabled: bool = True
    presidio_entities: List[str] = field(default_factory=list)
    presidio_confidence_threshold: float = 0.8

    # ML Configuration
    ml_classification_enabled: bool = True
    custom_models: List[str] = field(default_factory=list)

    # Policy Configuration
    inherit_global_policies: bool = True
    policy_overrides: Dict[str, Any] = field(default_factory=dict)

    # Alert Configuration
    default_alert_recipients: List[str] = field(default_factory=list)
    alert_settings: Dict[str, Any] = field(default_factory=dict)

    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    def __post_init__(self):
        """Initialize default values based on tier."""
        if not self.enabled_features:
            self.enabled_features = self._get_default_features()

        if not self.presidio_entities:
            self.presidio_entities = self._get_default_entities()

    def _get_default_features(self) -> List[str]:
        """Get default features based on tenant tier."""
        tier_features = {
            TenantTier.FREE: ["basic_scanning", "email_alerts", "daily_reports"],
            TenantTier.BASIC: [
                "basic_scanning",
                "presidio_detection",
                "regex_patterns",
                "email_alerts",
                "daily_reports",
                "custom_patterns",
            ],
            TenantTier.PROFESSIONAL: [
                "basic_scanning",
                "presidio_detection",
                "regex_patterns",
                "ml_classification",
                "rule_engine",
                "email_alerts",
                "webhook_alerts",
                "slack_alerts",
                "daily_reports",
                "weekly_reports",
                "custom_patterns",
                "custom_rules",
            ],
            TenantTier.ENTERPRISE: [
                "basic_scanning",
                "presidio_detection",
                "regex_patterns",
                "ml_classification",
                "rule_engine",
                "real_time_scanning",
                "email_alerts",
                "webhook_alerts",
                "slack_alerts",
                "teams_alerts",
                "sms_alerts",
                "daily_reports",
                "weekly_reports",
                "monthly_reports",
                "custom_patterns",
                "custom_rules",
                "custom_models",
                "api_access",
                "sso_integration",
            ],
            TenantTier.CUSTOM: [
                # All features available for custom tier
            ],
        }

        return tier_features.get(self.tier, tier_features[TenantTier.FREE])

    def _get_default_entities(self) -> List[str]:
        """Get default Presidio entities based on tenant tier."""
        if self.tier in [TenantTier.FREE]:
            return ["EMAIL_ADDRESS", "PHONE_NUMBER"]
        elif self.tier == TenantTier.BASIC:
            return ["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON", "LOCATION"]
        else:
            # All entities for higher tiers
            return [
                "PERSON",
                "EMAIL_ADDRESS",
                "PHONE_NUMBER",
                "LOCATION",
                "DATE_TIME",
                "IBAN_CODE",
                "CREDIT_CARD",
                "IP_ADDRESS",
                "URL",
                "US_SSN",
                "US_DRIVER_LICENSE",
                "UK_NHS",
                "MEDICAL_RECORD",
                "LEGAL_DOCUMENT",
            ]


class TenantIsolationManager:
    """Manages tenant isolation and data separation."""

    def __init__(self):
        self.settings = get_settings()
        self._tenant_data: Dict[str, Dict[str, Any]] = {}
        self._isolation_lock = threading.RLock()

    def get_tenant_context(self, tenant_id: str) -> Dict[str, Any]:
        """Get isolated context for a tenant."""
        with self._isolation_lock:
            if tenant_id not in self._tenant_data:
                self._tenant_data[tenant_id] = {
                    "scans": [],
                    "violations": [],
                    "policies": [],
                    "rules": [],
                    "patterns": [],
                    "cache": {},
                    "statistics": {
                        "total_scans": 0,
                        "total_violations": 0,
                        "cache_hits": 0,
                        "cache_misses": 0,
                    },
                }

            return self._tenant_data[tenant_id]

    def add_scan_result(self, tenant_id: str, scan_result: Dict[str, Any]):
        """Add scan result to tenant context."""
        context = self.get_tenant_context(tenant_id)
        context["scans"].append(scan_result)
        context["statistics"]["total_scans"] += 1

        # Limit stored scans to prevent memory issues
        max_stored_scans = 1000
        if len(context["scans"]) > max_stored_scans:
            context["scans"] = context["scans"][-max_stored_scans:]

    def add_violations(self, tenant_id: str, violations: List[Dict[str, Any]]):
        """Add violations to tenant context."""
        context = self.get_tenant_context(tenant_id)
        context["violations"].extend(violations)
        context["statistics"]["total_violations"] += len(violations)

        # Limit stored violations to prevent memory issues
        max_stored_violations = 5000
        if len(context["violations"]) > max_stored_violations:
            context["violations"] = context["violations"][-max_stored_violations:]

    def get_tenant_statistics(self, tenant_id: str) -> Dict[str, Any]:
        """Get statistics for a specific tenant."""
        context = self.get_tenant_context(tenant_id)
        return copy.deepcopy(context["statistics"])

    def clear_tenant_data(self, tenant_id: str):
        """Clear all data for a tenant (e.g., for data retention)."""
        with self._isolation_lock:
            if tenant_id in self._tenant_data:
                del self._tenant_data[tenant_id]

    def cleanup_expired_data(self, max_age_hours: int = 24):
        """Clean up expired data for all tenants."""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)

        with self._isolation_lock:
            for tenant_id, context in self._tenant_data.items():
                # Clean up old scans
                context["scans"] = [
                    scan
                    for scan in context["scans"]
                    if datetime.fromisoformat(scan.get("timestamp", "1970-01-01"))
                    > cutoff_time
                ]

                # Clean up old violations
                context["violations"] = [
                    violation
                    for violation in context["violations"]
                    if datetime.fromisoformat(violation.get("created_at", "1970-01-01"))
                    > cutoff_time
                ]


class TenantPolicyManager:
    """Manages tenant-specific policies and policy inheritance."""

    def __init__(self):
        self._global_policies: Dict[str, Dict[str, Any]] = {}
        self._tenant_policies: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._policy_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._cache_lock = threading.RLock()

        # Load global policies
        self._load_global_policies()

    def _load_global_policies(self):
        """Load global default policies."""
        self._global_policies = {
            "basic_pii_policy": {
                "name": "Basic PII Detection",
                "description": "Detects basic personally identifiable information",
                "rules": [
                    {
                        "type": "presidio",
                        "entities": ["EMAIL_ADDRESS", "PHONE_NUMBER", "PERSON"],
                        "confidence_threshold": 0.8,
                    }
                ],
                "actions": [{"type": "violation", "severity": "MEDIUM"}],
            },
            "financial_data_policy": {
                "name": "Financial Data Protection",
                "description": "Detects financial information",
                "rules": [
                    {
                        "type": "presidio",
                        "entities": ["CREDIT_CARD", "IBAN_CODE"],
                        "confidence_threshold": 0.9,
                    },
                    {
                        "type": "regex",
                        "patterns": ["credit_card_general", "iban_code"],
                        "confidence_threshold": 0.85,
                    },
                ],
                "actions": [
                    {"type": "violation", "severity": "HIGH"},
                    {"type": "alert", "recipients": ["security@company.com"]},
                ],
            },
        }

    def get_effective_policies(
        self, tenant_id: str, tenant_config: TenantConfiguration
    ) -> List[Dict[str, Any]]:
        """Get effective policies for a tenant (global + tenant-specific)."""
        cache_key = f"{tenant_id}:{tenant_config.updated_at.isoformat()}"

        with self._cache_lock:
            if cache_key in self._policy_cache:
                return self._policy_cache[cache_key]

        effective_policies = []

        # Start with global policies if inheritance is enabled
        if tenant_config.inherit_global_policies:
            for policy_id, policy_data in self._global_policies.items():
                # Apply tenant overrides if any
                policy_copy = copy.deepcopy(policy_data)
                if policy_id in tenant_config.policy_overrides:
                    self._apply_policy_overrides(
                        policy_copy, tenant_config.policy_overrides[policy_id]
                    )

                # Check if policy is enabled for tenant
                if self._is_policy_enabled(policy_copy, tenant_config):
                    effective_policies.append(policy_copy)

        # Add tenant-specific policies
        tenant_policies = self._tenant_policies.get(tenant_id, {})
        for policy_data in tenant_policies.values():
            if self._is_policy_enabled(policy_data, tenant_config):
                effective_policies.append(policy_data)

        # Cache result
        with self._cache_lock:
            self._policy_cache[cache_key] = effective_policies

        return effective_policies

    def _apply_policy_overrides(
        self, policy: Dict[str, Any], overrides: Dict[str, Any]
    ):
        """Apply tenant-specific overrides to a policy."""
        if "rules" in overrides:
            # Override or merge rules
            if "merge_rules" in overrides and overrides["merge_rules"]:
                # Merge with existing rules
                policy["rules"].extend(overrides["rules"])
            else:
                # Replace rules entirely
                policy["rules"] = overrides["rules"]

        if "actions" in overrides:
            policy["actions"] = overrides["actions"]

        if "enabled" in overrides:
            policy["enabled"] = overrides["enabled"]

        # Apply other overrides
        for key, value in overrides.items():
            if key not in ["rules", "actions", "merge_rules", "enabled"]:
                policy[key] = value

    def _is_policy_enabled(
        self, policy: Dict[str, Any], tenant_config: TenantConfiguration
    ) -> bool:
        """Check if a policy is enabled for the tenant."""
        # Check if policy is explicitly disabled
        if policy.get("enabled", True) is False:
            return False

        # Check if policy requires features that are disabled
        required_features = policy.get("required_features", [])
        for feature in required_features:
            if feature in tenant_config.disabled_features:
                return False
            if feature not in tenant_config.enabled_features:
                return False

        return True

    def add_tenant_policy(
        self, tenant_id: str, policy_id: str, policy_data: Dict[str, Any]
    ):
        """Add a tenant-specific policy."""
        if tenant_id not in self._tenant_policies:
            self._tenant_policies[tenant_id] = {}

        self._tenant_policies[tenant_id][policy_id] = policy_data

        # Clear cache for this tenant
        self._clear_tenant_policy_cache(tenant_id)

    def remove_tenant_policy(self, tenant_id: str, policy_id: str):
        """Remove a tenant-specific policy."""
        if (
            tenant_id in self._tenant_policies
            and policy_id in self._tenant_policies[tenant_id]
        ):
            del self._tenant_policies[tenant_id][policy_id]

            # Clear cache for this tenant
            self._clear_tenant_policy_cache(tenant_id)

    def _clear_tenant_policy_cache(self, tenant_id: str):
        """Clear policy cache for a specific tenant."""
        with self._cache_lock:
            keys_to_remove = [
                key
                for key in self._policy_cache.keys()
                if key.startswith(f"{tenant_id}:")
            ]
            for key in keys_to_remove:
                del self._policy_cache[key]


class TenantQuotaManager:
    """Manages resource quotas and limits for tenants."""

    def __init__(self):
        self._tenant_quotas: Dict[str, TenantQuota] = {}
        self._quota_usage: Dict[str, Dict[str, Any]] = {}
        self._quota_lock = threading.RLock()

        # Load default quotas by tier
        self._load_default_quotas()

    def _load_default_quotas(self):
        """Load default quotas for different tenant tiers."""
        self._default_quotas = {
            TenantTier.FREE: TenantQuota(
                max_scans_per_day=100,
                max_scans_per_hour=10,
                max_content_size_mb=10,
                max_batch_size=10,
                max_policies=1,
                max_rules_per_policy=5,
                max_custom_patterns=2,
                max_violation_retention_days=30,
                max_alert_configurations=1,
                max_alerts_per_hour=5,
                max_concurrent_scans=1,
                cache_size_mb=10,
            ),
            TenantTier.BASIC: TenantQuota(
                max_scans_per_day=1000,
                max_scans_per_hour=100,
                max_content_size_mb=50,
                max_batch_size=50,
                max_policies=5,
                max_rules_per_policy=20,
                max_custom_patterns=10,
                max_violation_retention_days=90,
                max_alert_configurations=3,
                max_alerts_per_hour=25,
                max_concurrent_scans=3,
                cache_size_mb=50,
            ),
            TenantTier.PROFESSIONAL: TenantQuota(
                max_scans_per_day=10000,
                max_scans_per_hour=500,
                max_content_size_mb=100,
                max_batch_size=200,
                max_policies=20,
                max_rules_per_policy=50,
                max_custom_patterns=50,
                max_violation_retention_days=365,
                max_alert_configurations=10,
                max_alerts_per_hour=100,
                max_concurrent_scans=10,
                cache_size_mb=200,
            ),
            TenantTier.ENTERPRISE: TenantQuota(
                max_scans_per_day=100000,
                max_scans_per_hour=2000,
                max_content_size_mb=500,
                max_batch_size=1000,
                max_policies=100,
                max_rules_per_policy=200,
                max_custom_patterns=200,
                max_violation_retention_days=2555,  # 7 years
                max_alert_configurations=50,
                max_alerts_per_hour=500,
                max_concurrent_scans=50,
                cache_size_mb=1000,
            ),
            TenantTier.CUSTOM: TenantQuota(
                max_scans_per_day=1000000,  # Unlimited effectively
                max_scans_per_hour=10000,
                max_content_size_mb=1000,
                max_batch_size=5000,
                max_policies=1000,
                max_rules_per_policy=1000,
                max_custom_patterns=1000,
                max_violation_retention_days=2555,
                max_alert_configurations=100,
                max_alerts_per_hour=1000,
                max_concurrent_scans=100,
                cache_size_mb=5000,
            ),
        }

    def get_tenant_quota(self, tenant_id: str, tier: TenantTier) -> TenantQuota:
        """Get quota configuration for a tenant."""
        if tenant_id not in self._tenant_quotas:
            # Use default quota for tier
            self._tenant_quotas[tenant_id] = copy.deepcopy(
                self._default_quotas.get(tier, self._default_quotas[TenantTier.FREE])
            )

        return self._tenant_quotas[tenant_id]

    def check_quota(
        self, tenant_id: str, tier: TenantTier, resource: str, amount: int = 1
    ) -> Tuple[bool, str]:
        """Check if tenant has quota available for a resource."""
        quota = self.get_tenant_quota(tenant_id, tier)

        # Initialize usage tracking if needed
        if tenant_id not in self._quota_usage:
            self._quota_usage[tenant_id] = {
                "scans_today": 0,
                "scans_this_hour": 0,
                "policies_count": 0,
                "rules_count": 0,
                "patterns_count": 0,
                "alert_configurations_count": 0,
                "alerts_this_hour": 0,
                "concurrent_scans": 0,
                "last_reset": datetime.utcnow(),
            }

        usage = self._quota_usage[tenant_id]

        # Reset counters if needed
        self._reset_counters_if_needed(usage)

        # Check specific quota
        if resource == "scan":
            # Check daily quota
            if usage["scans_today"] + amount > quota.max_scans_per_day:
                return (
                    False,
                    f"Daily scan quota exceeded ({usage['scans_today']}/{quota.max_scans_per_day})",
                )

            # Check hourly quota
            if usage["scans_this_hour"] + amount > quota.max_scans_per_hour:
                return (
                    False,
                    f"Hourly scan quota exceeded ({usage['scans_this_hour']}/{quota.max_scans_per_hour})",
                )

        elif resource == "policy":
            if usage["policies_count"] + amount > quota.max_policies:
                return (
                    False,
                    f"Policy quota exceeded ({usage['policies_count']}/{quota.max_policies})",
                )

        elif resource == "rule":
            if usage["rules_count"] + amount > quota.max_rules_per_policy:
                return (
                    False,
                    f"Rule quota exceeded ({usage['rules_count']}/{quota.max_rules_per_policy})",
                )

        elif resource == "pattern":
            if usage["patterns_count"] + amount > quota.max_custom_patterns:
                return (
                    False,
                    f"Pattern quota exceeded ({usage['patterns_count']}/{quota.max_custom_patterns})",
                )

        elif resource == "alert_configuration":
            if (
                usage["alert_configurations_count"] + amount
                > quota.max_alert_configurations
            ):
                return (
                    False,
                    f"Alert configuration quota exceeded ({usage['alert_configurations_count']}/{quota.max_alert_configurations})",
                )

        elif resource == "alert":
            if usage["alerts_this_hour"] + amount > quota.max_alerts_per_hour:
                return (
                    False,
                    f"Alert quota exceeded ({usage['alerts_this_hour']}/{quota.max_alerts_per_hour})",
                )

        elif resource == "concurrent_scan":
            if usage["concurrent_scans"] + amount > quota.max_concurrent_scans:
                return (
                    False,
                    f"Concurrent scan quota exceeded ({usage['concurrent_scans']}/{quota.max_concurrent_scans})",
                )

        return True, "Quota available"

    def consume_quota(
        self, tenant_id: str, tier: TenantTier, resource: str, amount: int = 1
    ):
        """Consume quota for a resource."""
        can_consume, reason = self.check_quota(tenant_id, tier, resource, amount)

        if can_consume:
            usage = self._quota_usage[tenant_id]

            if resource == "scan":
                usage["scans_today"] += amount
                usage["scans_this_hour"] += amount
            elif resource == "policy":
                usage["policies_count"] += amount
            elif resource == "rule":
                usage["rules_count"] += amount
            elif resource == "pattern":
                usage["patterns_count"] += amount
            elif resource == "alert_configuration":
                usage["alert_configurations_count"] += amount
            elif resource == "alert":
                usage["alerts_this_hour"] += amount
            elif resource == "concurrent_scan":
                usage["concurrent_scans"] += amount

        return can_consume, reason

    def release_quota(self, tenant_id: str, resource: str, amount: int = 1):
        """Release quota (typically for concurrent resources)."""
        if tenant_id in self._quota_usage:
            usage = self._quota_usage[tenant_id]

            if resource == "concurrent_scan":
                usage["concurrent_scans"] = max(0, usage["concurrent_scans"] - amount)

    def _reset_counters_if_needed(self, usage: Dict[str, Any]):
        """Reset usage counters if time period has passed."""
        now = datetime.utcnow()
        last_reset = usage.get("last_reset", now)

        # Reset daily counter
        if (now - last_reset).days >= 1:
            usage["scans_today"] = 0

        # Reset hourly counter
        if (now - last_reset).seconds >= 3600:
            usage["scans_this_hour"] = 0
            usage["alerts_this_hour"] = 0

        # Update last reset time
        if (now - last_reset).seconds >= 3600:
            usage["last_reset"] = now

    def get_quota_usage(self, tenant_id: str, tier: TenantTier) -> Dict[str, Any]:
        """Get current quota usage for a tenant."""
        quota = self.get_tenant_quota(tenant_id, tier)
        usage = self._quota_usage.get(tenant_id, {})

        return {
            "quotas": {
                "max_scans_per_day": quota.max_scans_per_day,
                "max_scans_per_hour": quota.max_scans_per_hour,
                "max_content_size_mb": quota.max_content_size_mb,
                "max_policies": quota.max_policies,
                "max_rules_per_policy": quota.max_rules_per_policy,
                "max_custom_patterns": quota.max_custom_patterns,
                "max_alert_configurations": quota.max_alert_configurations,
                "max_alerts_per_hour": quota.max_alerts_per_hour,
                "max_concurrent_scans": quota.max_concurrent_scans,
            },
            "usage": {
                "scans_today": usage.get("scans_today", 0),
                "scans_this_hour": usage.get("scans_this_hour", 0),
                "policies_count": usage.get("policies_count", 0),
                "rules_count": usage.get("rules_count", 0),
                "patterns_count": usage.get("patterns_count", 0),
                "alert_configurations_count": usage.get(
                    "alert_configurations_count", 0
                ),
                "alerts_this_hour": usage.get("alerts_this_hour", 0),
                "concurrent_scans": usage.get("concurrent_scans", 0),
            },
            "percentages": {
                "scans_today_percent": (
                    usage.get("scans_today", 0) / quota.max_scans_per_day
                )
                * 100,
                "scans_this_hour_percent": (
                    usage.get("scans_this_hour", 0) / quota.max_scans_per_hour
                )
                * 100,
                "policies_percent": (
                    usage.get("policies_count", 0) / quota.max_policies
                )
                * 100,
                "rules_percent": (
                    usage.get("rules_count", 0) / quota.max_rules_per_policy
                )
                * 100,
                "patterns_percent": (
                    usage.get("patterns_count", 0) / quota.max_custom_patterns
                )
                * 100,
                "alert_configurations_percent": (
                    usage.get("alert_configurations_count", 0)
                    / quota.max_alert_configurations
                )
                * 100,
                "concurrent_scans_percent": (
                    usage.get("concurrent_scans", 0) / quota.max_concurrent_scans
                )
                * 100,
            },
        }


class MultiTenantManager:
    """Main multi-tenant management system."""

    def __init__(self):
        self.settings = get_settings()

        # Component managers
        self.isolation_manager = TenantIsolationManager()
        self.policy_manager = TenantPolicyManager()
        self.quota_manager = TenantQuotaManager()

        # Tenant configurations
        self._tenant_configs: Dict[str, TenantConfiguration] = {}
        self._config_lock = threading.RLock()

        # Load default tenant configurations
        self._load_default_tenant()

    def _load_default_tenant(self):
        """Load default tenant configuration."""
        default_config = TenantConfiguration(
            tenant_id="default",
            tier=TenantTier.FREE,
            enabled_features=["basic_scanning"],
            presidio_enabled=True,
            ml_classification_enabled=False,
        )

        self._tenant_configs["default"] = default_config

    def create_tenant(
        self,
        tenant_id: str,
        name: str,
        tier: TenantTier = TenantTier.FREE,
        description: Optional[str] = None,
        created_by: Optional[str] = None,
        **kwargs,
    ) -> TenantConfiguration:
        """Create a new tenant configuration."""
        with self._config_lock:
            if tenant_id in self._tenant_configs:
                raise ValueError(f"Tenant {tenant_id} already exists")

            # Create tenant configuration
            config = TenantConfiguration(
                tenant_id=tenant_id, tier=tier, created_by=created_by, **kwargs
            )

            self._tenant_configs[tenant_id] = config

            # Initialize tenant isolation context
            self.isolation_manager.get_tenant_context(tenant_id)

            logger.info(f"Created tenant {tenant_id} with tier {tier}")

            return config

    def get_tenant_config(self, tenant_id: str) -> Optional[TenantConfiguration]:
        """Get configuration for a tenant."""
        with self._config_lock:
            return self._tenant_configs.get(tenant_id)

    def update_tenant_config(
        self, tenant_id: str, updates: Dict[str, Any]
    ) -> Optional[TenantConfiguration]:
        """Update tenant configuration."""
        with self._config_lock:
            if tenant_id not in self._tenant_configs:
                return None

            config = self._tenant_configs[tenant_id]

            # Apply updates
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)

            config.updated_at = datetime.utcnow()

            # Clear relevant caches
            self.policy_manager._clear_tenant_policy_cache(tenant_id)

            logger.info(f"Updated configuration for tenant {tenant_id}")

            return config

    def delete_tenant(self, tenant_id: str):
        """Delete a tenant and all associated data."""
        with self._config_lock:
            if tenant_id not in self._tenant_configs:
                raise ValueError(f"Tenant {tenant_id} does not exist")

            # Remove configuration
            del self._tenant_configs[tenant_id]

            # Clear tenant data
            self.isolation_manager.clear_tenant_data(tenant_id)

            # Clear tenant policies
            self._tenant_policies = self.policy_manager._tenant_policies
            if tenant_id in self._tenant_policies:
                del self._tenant_policies[tenant_id]

            # Clear quota usage
            if tenant_id in self.quota_manager._quota_usage:
                del self.quota_manager._quota_usage[tenant_id]

            if tenant_id in self.quota_manager._tenant_quotas:
                del self.quota_manager._tenant_quotas[tenant_id]

            logger.info(f"Deleted tenant {tenant_id}")

    def list_tenants(self) -> List[Dict[str, Any]]:
        """List all tenants with their configurations."""
        with self._config_lock:
            tenants = []

            for tenant_id, config in self._tenant_configs.items():
                quota_usage = self.quota_manager.get_quota_usage(tenant_id, config.tier)

                tenant_info = {
                    "tenant_id": tenant_id,
                    "tier": config.tier.value,
                    "created_at": config.created_at.isoformat(),
                    "updated_at": config.updated_at.isoformat(),
                    "created_by": config.created_by,
                    "enabled_features": config.enabled_features,
                    "disabled_features": config.disabled_features,
                    "quota_usage": quota_usage,
                }

                tenants.append(tenant_info)

            return tenants

    def check_tenant_permissions(
        self, tenant_id: str, feature: str, operation: str = "access"
    ) -> Tuple[bool, str]:
        """Check if tenant has permission for a feature."""
        config = self.get_tenant_config(tenant_id)
        if not config:
            return False, "Tenant not found"

        # Check if feature is enabled
        if feature in config.disabled_features:
            return False, f"Feature {feature} is disabled for this tenant"

        if feature not in config.enabled_features:
            return False, f"Feature {feature} is not enabled for this tenant tier"

        return True, "Permission granted"

    def validate_tenant_request(
        self, tenant_id: str, request_type: str, **kwargs
    ) -> Tuple[bool, str]:
        """Validate a tenant request against quotas and permissions."""
        config = self.get_tenant_config(tenant_id)
        if not config:
            return False, "Tenant not found"

        # Check tenant status
        # (Would implement actual status checking)

        # Check quotas
        if request_type == "scan":
            can_scan, reason = self.quota_manager.check_quota(
                tenant_id, config.tier, "scan"
            )
            if not can_scan:
                return False, reason

            # Check content size
            content_size_mb = kwargs.get("content_size_mb", 0)
            if (
                content_size_mb > config.tier.max_scans_per_day
            ):  # This should be from quota
                return False, f"Content size {content_size_mb}MB exceeds limit"

        elif request_type == "policy":
            can_create, reason = self.quota_manager.check_quota(
                tenant_id, config.tier, "policy"
            )
            if not can_create:
                return False, reason

        elif request_type == "pattern":
            can_create, reason = self.quota_manager.check_quota(
                tenant_id, config.tier, "pattern"
            )
            if not can_create:
                return False, reason

        # Check permissions
        if request_type == "presidio_scan" and not config.presidio_enabled:
            return False, "Presidio scanning is not enabled for this tenant"

        if request_type == "ml_classification" and not config.ml_classification_enabled:
            return False, "ML classification is not enabled for this tenant"

        return True, "Request validated"

    def get_tenant_metrics(self, tenant_id: str) -> Dict[str, Any]:
        """Get comprehensive metrics for a tenant."""
        config = self.get_tenant_config(tenant_id)
        if not config:
            return {"error": "Tenant not found"}

        # Get isolation statistics
        isolation_stats = self.isolation_manager.get_tenant_statistics(tenant_id)

        # Get quota usage
        quota_usage = self.quota_manager.get_quota_usage(tenant_id, config.tier)

        # Get effective policies
        effective_policies = self.policy_manager.get_effective_policies(
            tenant_id, config
        )

        return {
            "tenant_id": tenant_id,
            "tier": config.tier.value,
            "configuration": {
                "enabled_features": config.enabled_features,
                "presidio_enabled": config.presidio_enabled,
                "ml_classification_enabled": config.ml_classification_enabled,
                "inherit_global_policies": config.inherit_global_policies,
            },
            "statistics": isolation_stats,
            "quota_usage": quota_usage,
            "policies": {
                "effective_policies_count": len(effective_policies),
                "global_policies_inherited": len(
                    [p for p in effective_policies if p.get("global", False)]
                ),
                "tenant_specific_policies": len(
                    [p for p in effective_policies if not p.get("global", False)]
                ),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }


# Singleton instance
_multi_tenant_manager = None


def get_multi_tenant_manager() -> MultiTenantManager:
    """Get singleton instance of multi-tenant manager."""
    global _multi_tenant_manager
    if _multi_tenant_manager is None:
        _multi_tenant_manager = MultiTenantManager()
    return _multi_tenant_manager
