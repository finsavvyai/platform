"""
LLM Configuration Management.

This module provides centralized configuration management for LLM providers,
including model settings, API keys, rate limiting, and safety configurations.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field, asdict
from pathlib import Path

from pydantic import BaseModel, Field, validator

logger = logging.getLogger(__name__)


class LogLevel(Enum):
    """Log levels for LLM operations."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class SelectionStrategy(Enum):
    """Provider selection strategies."""

    PRIORITY = "priority"
    ROUND_ROBIN = "round_robin"
    COST_OPTIMIZED = "cost_optimized"
    PERFORMANCE_OPTIMIZED = "performance_optimized"
    LOAD_BALANCED = "load_balanced"
    HEALTH_AWARE = "health_aware"


@dataclass
class ProviderConfig:
    """Configuration for an LLM provider."""

    name: str
    enabled: bool = True
    priority: int = 1
    weight: float = 1.0
    timeout: int = 30
    max_retries: int = 3
    max_requests_per_minute: Optional[int] = None
    max_concurrent_requests: Optional[int] = None

    # Provider-specific settings
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    organization: Optional[str] = None

    # Model-specific settings
    default_model: Optional[str] = None
    supported_models: List[str] = field(default_factory=list)
    model_settings: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    # Advanced settings
    enable_streaming: bool = True
    enable_function_calling: bool = True
    enable_vision: bool = False

    # Safety settings
    content_filter_enabled: bool = True
    content_filter_threshold: float = 0.7
    max_response_length: Optional[int] = None

    # Cost settings
    cost_tracking_enabled: bool = True
    budget_alerts_enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProviderConfig":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class ValidationConfig:
    """Configuration for response validation."""

    enabled: bool = True
    content_safety_enabled: bool = True
    pii_detection_enabled: bool = True
    format_validation_enabled: bool = True
    quality_assessment_enabled: bool = True

    # Thresholds
    content_safety_threshold: float = 0.7
    quality_threshold: float = 0.6

    # Actions on validation failure
    block_on_critical: bool = True
    block_on_error: bool = False
    log_warnings: bool = True

    # Custom validation rules
    custom_rules: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ValidationConfig":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class MonitoringConfig:
    """Configuration for LLM monitoring."""

    enabled: bool = True
    metrics_interval: int = 60  # seconds
    health_check_interval: int = 300  # seconds
    performance_tracking: bool = True

    # Alerting
    alert_on_failure: bool = True
    alert_on_slow_response: bool = True
    slow_response_threshold: float = 5.0  # seconds

    # Metrics retention
    metrics_retention_days: int = 30
    detailed_logging: bool = True

    # External integrations
    prometheus_enabled: bool = False
    prometheus_port: int = 9090
    sentry_dsn: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MonitoringConfig":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class CostConfig:
    """Configuration for cost tracking and budgets."""

    enabled: bool = True
    default_currency: str = "USD"
    cost_precision: int = 6

    # Budget settings
    default_daily_limit: Optional[float] = None
    default_monthly_limit: Optional[float] = None

    # Alert settings
    budget_alerts_enabled: bool = True
    alert_thresholds: Dict[str, float] = field(
        default_factory=lambda: {
            "daily": 0.8,
            "monthly": 0.8,
        }
    )

    # Cost optimization
    enable_cost_optimization: bool = True
    prefer_cheaper_provider: bool = False
    cost_weight_in_selection: float = 0.2

    # Reporting
    cost_report_interval: int = 3600  # seconds
    include_estimates: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CostConfig":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class CachingConfig:
    """Configuration for response caching."""

    enabled: bool = True
    cache_type: str = "redis"  # redis, memory, file
    ttl_seconds: int = 3600
    max_cache_size: int = 10000

    # Redis settings
    redis_url: Optional[str] = None
    redis_prefix: str = "llm:cache:"

    # Cache key generation
    include_context: bool = True
    include_user_id: bool = True
    include_tenant_id: bool = True

    # Cache invalidation
    invalidate_on_model_update: bool = True
    invalidate_on_provider_update: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CachingConfig":
        """Create from dictionary."""
        return cls(**data)


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""

    enabled: bool = True

    # Global limits
    global_requests_per_minute: Optional[int] = None
    global_requests_per_hour: Optional[int] = None
    global_tokens_per_minute: Optional[int] = None

    # Per-user limits
    user_requests_per_minute: Optional[int] = None
    user_tokens_per_minute: Optional[int] = None

    # Per-tenant limits
    tenant_requests_per_minute: Optional[int] = None
    tenant_tokens_per_minute: Optional[int] = None

    # Rate limiting strategy
    strategy: str = "sliding_window"  # fixed_window, sliding_window, token_bucket
    burst_size: int = 10

    # Storage
    storage_type: str = "redis"  # redis, memory
    storage_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CachingConfig":
        """Create from dictionary."""
        return cls(**data)


class LLMConfig(BaseModel):
    """Main LLM configuration model."""

    # General settings
    enabled: bool = Field(default=True, description="Enable LLM service")
    debug: bool = Field(default=False, description="Enable debug logging")
    log_level: LogLevel = Field(default=LogLevel.INFO, description="Log level")

    # Provider settings
    providers: List[ProviderConfig] = Field(
        default_factory=list, description="LLM provider configurations"
    )
    selection_strategy: SelectionStrategy = Field(
        default=SelectionStrategy.PRIORITY, description="Provider selection strategy"
    )

    # Feature settings
    validation: ValidationConfig = Field(
        default_factory=ValidationConfig, description="Response validation settings"
    )
    monitoring: MonitoringConfig = Field(
        default_factory=MonitoringConfig, description="Monitoring settings"
    )
    cost: CostConfig = Field(
        default_factory=CostConfig, description="Cost tracking settings"
    )
    caching: CachingConfig = Field(
        default_factory=CachingConfig, description="Caching settings"
    )
    rate_limiting: RateLimitConfig = Field(
        default_factory=RateLimitConfig, description="Rate limiting settings"
    )

    # Security settings
    api_key_rotation_enabled: bool = Field(
        default=False, description="Enable API key rotation"
    )
    audit_logging: bool = Field(default=True, description="Enable audit logging")

    # Performance settings
    max_concurrent_requests: int = Field(
        default=100, description="Maximum concurrent requests"
    )
    request_timeout: int = Field(default=60, description="Default request timeout")

    # Multi-tenancy
    multi_tenant_enabled: bool = Field(default=True, description="Enable multi-tenancy")
    tenant_isolation: bool = Field(default=True, description="Enable tenant isolation")

    # Configuration metadata
    version: str = Field(default="1.0.0", description="Configuration version")
    last_updated: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )
    updated_by: Optional[str] = Field(default=None, description="Updated by")

    class Config:
        arbitrary_types_allowed = True
        use_enum_values = True

    @validator("providers", pre=True)
    def validate_providers(cls, v):
        """Validate providers list."""
        if isinstance(v, list):
            return [
                ProviderConfig.from_dict(p) if isinstance(p, dict) else p for p in v
            ]
        return v

    @validator("validation", pre=True)
    def validate_validation(cls, v):
        """Validate validation config."""
        if isinstance(v, dict):
            return ValidationConfig.from_dict(v)
        return v

    @validator("monitoring", pre=True)
    def validate_monitoring(cls, v):
        """Validate monitoring config."""
        if isinstance(v, dict):
            return MonitoringConfig.from_dict(v)
        return v

    @validator("cost", pre=True)
    def validate_cost(cls, v):
        """Validate cost config."""
        if isinstance(v, dict):
            return CostConfig.from_dict(v)
        return v

    @validator("caching", pre=True)
    def validate_caching(cls, v):
        """Validate caching config."""
        if isinstance(v, dict):
            return CachingConfig.from_dict(v)
        return v

    @validator("rate_limiting", pre=True)
    def validate_rate_limiting(cls, v):
        """Validate rate limiting config."""
        if isinstance(v, dict):
            return RateLimitConfig.from_dict(v)
        return v

    def get_provider(self, name: str) -> Optional[ProviderConfig]:
        """Get provider configuration by name."""
        for provider in self.providers:
            if provider.name == name:
                return provider
        return None

    def add_provider(self, provider: ProviderConfig) -> None:
        """Add a provider configuration."""
        # Remove existing provider with same name
        self.providers = [p for p in self.providers if p.name != provider.name]
        self.providers.append(provider)
        self.last_updated = datetime.now()

    def remove_provider(self, name: str) -> bool:
        """Remove a provider configuration."""
        original_count = len(self.providers)
        self.providers = [p for p in self.providers if p.name != name]
        removed = len(self.providers) < original_count
        if removed:
            self.last_updated = datetime.now()
        return removed

    def get_enabled_providers(self) -> List[ProviderConfig]:
        """Get list of enabled providers."""
        return [p for p in self.providers if p.enabled]

    def validate_configuration(self) -> List[str]:
        """Validate the configuration and return any issues."""
        issues = []

        # Check if at least one provider is enabled
        enabled_providers = self.get_enabled_providers()
        if not enabled_providers:
            issues.append("No enabled providers found")

        # Check provider configurations
        for provider in enabled_providers:
            if not provider.api_key and provider.name not in ["local", "test"]:
                issues.append(f"Provider '{provider.name}' is missing API key")

            if not provider.supported_models and not provider.default_model:
                issues.append(f"Provider '{provider.name}' has no models configured")

        # Check rate limiting configuration
        if self.rate_limiting.enabled:
            if (
                not self.rate_limiting.storage_url
                and self.rate_limiting.storage_type == "redis"
            ):
                issues.append("Rate limiting enabled but no Redis URL configured")

        # Check caching configuration
        if self.caching.enabled:
            if self.caching.cache_type == "redis" and not self.caching.redis_url:
                issues.append("Caching enabled but no Redis URL configured")

        # Check monitoring configuration
        if self.monitoring.enabled and self.monitoring.sentry_dsn:
            # Basic validation of Sentry DSN format
            if not self.monitoring.sentry_dsn.startswith("https://"):
                issues.append("Invalid Sentry DSN format")

        return issues

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "enabled": self.enabled,
            "debug": self.debug,
            "log_level": self.log_level.value,
            "providers": [p.to_dict() for p in self.providers],
            "selection_strategy": self.selection_strategy.value,
            "validation": self.validation.to_dict(),
            "monitoring": self.monitoring.to_dict(),
            "cost": self.cost.to_dict(),
            "caching": self.caching.to_dict(),
            "rate_limiting": self.rate_limiting.to_dict(),
            "api_key_rotation_enabled": self.api_key_rotation_enabled,
            "audit_logging": self.audit_logging,
            "max_concurrent_requests": self.max_concurrent_requests,
            "request_timeout": self.request_timeout,
            "multi_tenant_enabled": self.multi_tenant_enabled,
            "tenant_isolation": self.tenant_isolation,
            "version": self.version,
            "last_updated": self.last_updated.isoformat(),
            "updated_by": self.updated_by,
        }


class LLMConfigManager:
    """Manages LLM configuration loading, saving, and validation."""

    def __init__(self, config_path: Optional[str] = None):
        """Initialize configuration manager."""
        self.config_path = config_path or os.getenv(
            "LLM_CONFIG_PATH", "llm_config.json"
        )
        self._config: Optional[LLMConfig] = None
        self._last_loaded: Optional[datetime] = None
        self._watch_file: bool = False

    async def load_config(self, config_path: Optional[str] = None) -> LLMConfig:
        """Load configuration from file or environment variables."""
        path = config_path or self.config_path

        try:
            # Try to load from file first
            if os.path.exists(path):
                with open(path, "r") as f:
                    data = json.load(f)
                config = LLMConfig(**data)
                logger.info(f"Loaded LLM configuration from {path}")
            else:
                # Create default configuration from environment variables
                config = await self._create_config_from_env()
                logger.info("Created LLM configuration from environment variables")

            # Validate configuration
            issues = config.validate_configuration()
            if issues:
                logger.warning(f"Configuration validation issues: {issues}")

            self._config = config
            self._last_loaded = datetime.now()

            return config

        except Exception as e:
            logger.error(f"Failed to load LLM configuration: {e}")
            # Return minimal default configuration
            return LLMConfig()

    async def save_config(self, config: LLMConfig, path: Optional[str] = None) -> None:
        """Save configuration to file."""
        target_path = path or self.config_path

        try:
            # Update metadata
            config.last_updated = datetime.now()

            # Ensure directory exists
            Path(target_path).parent.mkdir(parents=True, exist_ok=True)

            # Save to file
            with open(target_path, "w") as f:
                json.dump(config.to_dict(), f, indent=2)

            logger.info(f"Saved LLM configuration to {target_path}")

        except Exception as e:
            logger.error(f"Failed to save LLM configuration: {e}")
            raise

    async def _create_config_from_env(self) -> LLMConfig:
        """Create configuration from environment variables."""
        config = LLMConfig()

        # General settings
        config.enabled = os.getenv("LLM_ENABLED", "true").lower() == "true"
        config.debug = os.getenv("LLM_DEBUG", "false").lower() == "true"
        config.log_level = LogLevel(os.getenv("LLM_LOG_LEVEL", "INFO").upper())

        # Provider configurations
        if os.getenv("OPENAI_API_KEY"):
            openai_config = ProviderConfig(
                name="openai",
                api_key=os.getenv("OPENAI_API_KEY"),
                organization=os.getenv("OPENAI_ORGANIZATION"),
                base_url=os.getenv("OPENAI_BASE_URL"),
                timeout=int(os.getenv("OPENAI_TIMEOUT", "30")),
                max_retries=int(os.getenv("OPENAI_MAX_RETRIES", "3")),
                default_model=os.getenv("OPENAI_DEFAULT_MODEL", "gpt-3.5-turbo"),
                max_requests_per_minute=self._parse_int_env(
                    "OPENAI_MAX_REQUESTS_PER_MINUTE"
                ),
                max_concurrent_requests=self._parse_int_env(
                    "OPENAI_MAX_CONCURRENT_REQUESTS"
                ),
            )
            config.providers.append(openai_config)

        if os.getenv("ANTHROPIC_API_KEY"):
            anthropic_config = ProviderConfig(
                name="anthropic",
                api_key=os.getenv("ANTHROPIC_API_KEY"),
                base_url=os.getenv("ANTHROPIC_BASE_URL"),
                timeout=int(os.getenv("ANTHROPIC_TIMEOUT", "30")),
                max_retries=int(os.getenv("ANTHROPIC_MAX_RETRIES", "3")),
                default_model=os.getenv(
                    "ANTHROPIC_DEFAULT_MODEL", "claude-3-sonnet-20240229"
                ),
                max_requests_per_minute=self._parse_int_env(
                    "ANTHROPIC_MAX_REQUESTS_PER_MINUTE"
                ),
                max_concurrent_requests=self._parse_int_env(
                    "ANTHROPIC_MAX_CONCURRENT_REQUESTS"
                ),
            )
            config.providers.append(anthropic_config)

        # Redis settings for various components
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

        # Caching settings
        if os.getenv("LLM_CACHE_ENABLED", "true").lower() == "true":
            config.caching.enabled = True
            config.caching.redis_url = redis_url
            config.caching.ttl_seconds = int(os.getenv("LLM_CACHE_TTL", "3600"))

        # Cost tracking settings
        if os.getenv("LLM_COST_TRACKING_ENABLED", "true").lower() == "true":
            config.cost.enabled = True
            config.cost.default_daily_limit = self._parse_float_env(
                "LLM_DEFAULT_DAILY_LIMIT"
            )
            config.cost.default_monthly_limit = self._parse_float_env(
                "LLM_DEFAULT_MONTHLY_LIMIT"
            )

        # Monitoring settings
        if os.getenv("LLM_MONITORING_ENABLED", "true").lower() == "true":
            config.monitoring.enabled = True
            config.monitoring.sentry_dsn = os.getenv("SENTRY_DSN")
            config.monitoring.prometheus_enabled = (
                os.getenv("PROMETHEUS_ENABLED", "false").lower() == "true"
            )
            config.monitoring.prometheus_port = int(
                os.getenv("PROMETHEUS_PORT", "9090")
            )

        # Rate limiting settings
        if os.getenv("LLM_RATE_LIMIT_ENABLED", "true").lower() == "true":
            config.rate_limiting.enabled = True
            config.rate_limiting.storage_url = redis_url
            config.rate_limiting.global_requests_per_minute = self._parse_int_env(
                "LLM_GLOBAL_REQUESTS_PER_MINUTE"
            )
            config.rate_limiting.user_requests_per_minute = self._parse_int_env(
                "LLM_USER_REQUESTS_PER_MINUTE"
            )

        return config

    def _parse_int_env(self, key: str) -> Optional[int]:
        """Parse integer from environment variable."""
        value = os.getenv(key)
        if value is None:
            return None
        try:
            return int(value)
        except ValueError:
            logger.warning(f"Invalid integer value for {key}: {value}")
            return None

    def _parse_float_env(self, key: str) -> Optional[float]:
        """Parse float from environment variable."""
        value = os.getenv(key)
        if value is None:
            return None
        try:
            return float(value)
        except ValueError:
            logger.warning(f"Invalid float value for {key}: {value}")
            return None

    async def reload_config(self) -> LLMConfig:
        """Reload configuration from file."""
        return await self.load_config()

    def get_config(self) -> Optional[LLMConfig]:
        """Get current configuration."""
        return self._config

    async def update_config(self, updates: Dict[str, Any]) -> LLMConfig:
        """Update configuration with partial updates."""
        if not self._config:
            await self.load_config()

        current_dict = self._config.to_dict()
        self._deep_update(current_dict, updates)

        self._config = LLMConfig(**current_dict)
        await self.save_config(self._config)

        return self._config

    def _deep_update(self, base_dict: Dict, update_dict: Dict) -> None:
        """Deep update dictionary."""
        for key, value in update_dict.items():
            if (
                key in base_dict
                and isinstance(base_dict[key], dict)
                and isinstance(value, dict)
            ):
                self._deep_update(base_dict[key], value)
            else:
                base_dict[key] = value


# Global configuration manager instance
_config_manager: Optional[LLMConfigManager] = None


def get_config_manager(config_path: Optional[str] = None) -> LLMConfigManager:
    """Get global configuration manager instance."""
    global _config_manager
    if _config_manager is None:
        _config_manager = LLMConfigManager(config_path)
    return _config_manager


async def get_llm_config(config_path: Optional[str] = None) -> LLMConfig:
    """Get LLM configuration."""
    manager = get_config_manager(config_path)
    config = manager.get_config()
    if config is None:
        config = await manager.load_config()
    return config


# Utility functions for common configuration patterns
def create_openai_config(
    api_key: str,
    organization: Optional[str] = None,
    base_url: Optional[str] = None,
    **kwargs,
) -> ProviderConfig:
    """Create OpenAI provider configuration."""
    return ProviderConfig(
        name="openai",
        api_key=api_key,
        organization=organization,
        base_url=base_url,
        default_model="gpt-3.5-turbo",
        enable_function_calling=True,
        **kwargs,
    )


def create_anthropic_config(
    api_key: str, base_url: Optional[str] = None, **kwargs
) -> ProviderConfig:
    """Create Anthropic provider configuration."""
    return ProviderConfig(
        name="anthropic",
        api_key=api_key,
        base_url=base_url,
        default_model="claude-3-sonnet-20240229",
        enable_function_calling=True,
        enable_vision=True,
        **kwargs,
    )
