"""
Gateway Configuration Management

This module provides comprehensive configuration management for the API gateway including:
- Dynamic configuration loading and updates
- Environment-specific configurations
- Policy and rule management
- Security policy definitions
- Transformation rule configuration
- Rate limiting policy management

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import os
import json
import yaml
import logging
from typing import Dict, List, Any, Optional, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
import asyncio
from collections import defaultdict

from pydantic import BaseModel, Field, validator
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.gateway.models import GatewayConfiguration

logger = logging.getLogger(__name__)


class ConfigurationSource(str, Enum):
    """Configuration source types"""
    DATABASE = "database"
    FILE = "file"
    ENVIRONMENT = "environment"
    REMOTE = "remote"


class SecurityLevel(str, Enum):
    """Security levels for gateway policies"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class CORSConfig:
    """CORS configuration"""
    allow_origins: List[str] = field(default_factory=lambda: ["*"])
    allow_methods: List[str] = field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    allow_headers: List[str] = field(default_factory=lambda: ["*"])
    allow_credentials: bool = True
    expose_headers: List[str] = field(default_factory=list)
    max_age: int = 600


@dataclass
class SecurityHeadersConfig:
    """Security headers configuration"""
    enable_hsts: bool = True
    hsts_max_age: int = 31536000
    hsts_include_subdomains: bool = True
    hsts_preload: bool = False

    enable_csp: bool = True
    csp_policy: str = "default-src 'self'"

    enable_x_frame_options: bool = True
    x_frame_options: str = "DENY"

    enable_x_content_type_options: bool = True
    enable_x_xss_protection: bool = True
    enable_referrer_policy: bool = True
    referrer_policy: str = "strict-origin-when-cross-origin"

    enable_content_security_policy_report_only: bool = False


@dataclass
class RateLimitPolicy:
    """Rate limiting policy configuration"""
    default_limits: Dict[str, int] = field(default_factory=lambda: {
        "requests_per_minute": 1000,
        "requests_per_hour": 50000,
        "requests_per_day": 1000000
    })
    tier_limits: Dict[str, Dict[str, int]] = field(default_factory=lambda: {
        "free": {"requests_per_minute": 100, "requests_per_hour": 5000, "requests_per_day": 100000},
        "pro": {"requests_per_minute": 1000, "requests_per_hour": 50000, "requests_per_day": 1000000},
        "enterprise": {"requests_per_minute": 10000, "requests_per_hour": 500000, "requests_per_day": 10000000}
    })
    endpoint_limits: Dict[str, Dict[str, int]] = field(default_factory=dict)
    ip_based_limits: bool = True
    user_based_limits: bool = True
    organization_based_limits: bool = True
    global_limits: Dict[str, int] = field(default_factory=dict)


@dataclass
class AuthenticationPolicy:
    """Authentication policy configuration"""
    require_api_key: bool = True
    require_jwt: bool = False
    require_mfa_for_sensitive: bool = True
    sensitive_endpoints: List[str] = field(default_factory=lambda: [
        "/admin", "/users", "/organizations", "/api-keys"
    ])
    jwt_validation: bool = True
    api_key_validation: bool = True
    session_validation: bool = True
    token_refresh_enabled: bool = True


@dataclass
class TransformationRule:
    """Request/response transformation rule"""
    name: str
    enabled: bool = True
    priority: int = 100
    conditions: Dict[str, Any] = field(default_factory=dict)
    request_transformations: List[Dict[str, Any]] = field(default_factory=list)
    response_transformations: List[Dict[str, Any]] = field(default_factory=list)
    target_endpoints: List[str] = field(default_factory=list)
    exclude_endpoints: List[str] = field(default_factory=list)


@dataclass
class MonitoringConfig:
    """Monitoring and analytics configuration"""
    enable_request_logging: bool = True
    enable_response_logging: bool = False
    enable_performance_metrics: bool = True
    enable_error_tracking: bool = True
    log_body_size_limit: int = 1024  # bytes
    log_header_size_limit: int = 2048  # bytes
    sampling_rate: float = 1.0
    sensitive_fields: List[str] = field(default_factory=lambda: [
        "password", "token", "api_key", "secret", "authorization"
    ])


@dataclass
class GatewayPolicyConfig:
    """Comprehensive gateway policy configuration"""
    security_level: SecurityLevel = SecurityLevel.MEDIUM
    cors: CORSConfig = field(default_factory=CORSConfig)
    security_headers: SecurityHeadersConfig = field(default_factory=SecurityHeadersConfig)
    rate_limiting: RateLimitPolicy = field(default_factory=RateLimitPolicy)
    authentication: AuthenticationPolicy = field(default_factory=AuthenticationPolicy)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    transformation_rules: List[TransformationRule] = field(default_factory=list)

    # Custom policies
    custom_policies: Dict[str, Any] = field(default_factory=dict)

    # Feature flags
    enable_websocket_proxy: bool = True
    enable_api_versioning: bool = True
    enable_request_transformation: bool = True
    enable_response_transformation: bool = True
    enable_ip_whitelisting: bool = True
    enable_rate_limiting: bool = True


class GatewayConfig:
    """
    Main gateway configuration manager
    """

    def __init__(self):
        self.configurations: Dict[str, GatewayPolicyConfig] = {}
        self.current_config: Optional[GatewayPolicyConfig] = None
        self.environment: str = settings.ENVIRONMENT
        self.config_watchers: List[Callable] = []
        self._initialized = False

    async def initialize(self):
        """Initialize configuration manager"""
        if self._initialized:
            return

        try:
            # Load default configuration
            await self.load_default_configuration()

            # Load environment-specific configuration
            await self.load_environment_configuration()

            # Load configuration from database if available
            await self.load_database_configuration()

            # Set current configuration
            self.set_current_configuration(self.environment)

            self._initialized = True
            logger.info(f"Gateway configuration initialized for environment: {self.environment}")

        except Exception as e:
            logger.error(f"Failed to initialize gateway configuration: {e}")
            raise

    async def load_default_configuration(self):
        """Load default configuration"""
        default_config = GatewayPolicyConfig(
            security_level=SecurityLevel.MEDIUM,
            cors=CORSConfig(
                allow_origins=settings.ALLOWED_ORIGINS,
                allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                allow_credentials=True
            ),
            security_headers=SecurityHeadersConfig(
                enable_hsts=True,
                enable_csp=True,
                enable_x_frame_options=True,
                csp_policy="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
            ),
            rate_limiting=RateLimitPolicy(
                default_limits={
                    "requests_per_minute": 1000,
                    "requests_per_hour": 50000,
                    "requests_per_day": 1000000
                }
            ),
            authentication=AuthenticationPolicy(
                require_api_key=True,
                require_jwt=True,
                require_mfa_for_sensitive=True
            )
        )

        self.configurations["default"] = default_config

    async def load_environment_configuration(self):
        """Load environment-specific configuration"""
        env_config_file = Path(f"config/gateway/{self.environment}.yaml")

        if env_config_file.exists():
            try:
                with open(env_config_file, 'r') as f:
                    env_data = yaml.safe_load(f)

                config = self._dict_to_config(env_data)
                self.configurations[self.environment] = config
                logger.info(f"Loaded environment configuration from {env_config_file}")

            except Exception as e:
                logger.error(f"Failed to load environment configuration: {e}")
                # Fall back to default configuration
                self.configurations[self.environment] = self.configurations["default"]
        else:
            # Use default configuration for this environment
            self.configurations[self.environment] = self.configurations["default"]
            logger.info(f"Using default configuration for environment: {self.environment}")

    async def load_database_configuration(self):
        """Load configuration from database"""
        try:
            # This would be implemented to load from GatewayConfiguration model
            # For now, we'll skip database loading
            pass
        except Exception as e:
            logger.error(f"Failed to load database configuration: {e}")

    def _dict_to_config(self, data: Dict[str, Any]) -> GatewayPolicyConfig:
        """Convert dictionary to configuration object"""
        try:
            # Extract and convert nested configurations
            cors_data = data.get('cors', {})
            cors_config = CORSConfig(**cors_data)

            security_headers_data = data.get('security_headers', {})
            security_headers_config = SecurityHeadersConfig(**security_headers_data)

            rate_limiting_data = data.get('rate_limiting', {})
            rate_limiting_config = RateLimitPolicy(**rate_limiting_data)

            auth_data = data.get('authentication', {})
            auth_config = AuthenticationPolicy(**auth_data)

            monitoring_data = data.get('monitoring', {})
            monitoring_config = MonitoringConfig(**monitoring_data)

            transformation_rules_data = data.get('transformation_rules', [])
            transformation_rules = [
                TransformationRule(**rule_data)
                for rule_data in transformation_rules_data
            ]

            return GatewayPolicyConfig(
                security_level=SecurityLevel(data.get('security_level', 'medium')),
                cors=cors_config,
                security_headers=security_headers_config,
                rate_limiting=rate_limiting_config,
                authentication=auth_config,
                monitoring=monitoring_config,
                transformation_rules=transformation_rules,
                **{k: v for k, v in data.items()
                   if k not in ['cors', 'security_headers', 'rate_limiting',
                               'authentication', 'monitoring', 'transformation_rules', 'security_level']}
            )

        except Exception as e:
            logger.error(f"Failed to convert dict to config: {e}")
            return self.configurations.get("default", GatewayPolicyConfig())

    def set_current_configuration(self, environment: str):
        """Set current active configuration"""
        if environment not in self.configurations:
            logger.warning(f"Configuration for environment '{environment}' not found, using default")
            environment = "default"

        self.current_config = self.configurations[environment]
        logger.info(f"Set current configuration to: {environment}")

    def get_current_config(self) -> GatewayPolicyConfig:
        """Get current active configuration"""
        if not self.current_config:
            self.set_current_configuration(self.environment)
        return self.current_config

    def get_config(self, environment: Optional[str] = None) -> GatewayPolicyConfig:
        """Get configuration for specific environment"""
        if environment is None:
            return self.get_current_config()

        return self.configurations.get(environment, self.configurations["default"])

    def update_configuration(self, environment: str, config: GatewayPolicyConfig):
        """Update configuration for specific environment"""
        self.configurations[environment] = config

        if environment == self.environment:
            self.set_current_configuration(environment)

        # Notify configuration watchers
        asyncio.create_task(self._notify_watchers(environment, config))

    async def save_configuration_to_file(self, environment: str, config: GatewayPolicyConfig):
        """Save configuration to file"""
        try:
            config_dir = Path("config/gateway")
            config_dir.mkdir(parents=True, exist_ok=True)

            config_file = config_dir / f"{environment}.yaml"

            config_dict = asdict(config)

            with open(config_file, 'w') as f:
                yaml.dump(config_dict, f, default_flow_style=False, indent=2)

            logger.info(f"Saved configuration to {config_file}")

        except Exception as e:
            logger.error(f"Failed to save configuration to file: {e}")
            raise

    async def reload_configuration(self, environment: Optional[str] = None):
        """Reload configuration from sources"""
        if environment:
            await self.load_environment_configuration()
            self.set_current_configuration(environment)
        else:
            await self.load_environment_configuration()
            self.set_current_configuration(self.environment)

    def register_config_watcher(self, callback: Callable):
        """Register a configuration change watcher"""
        self.config_watchers.append(callback)

    async def _notify_watchers(self, environment: str, config: GatewayPolicyConfig):
        """Notify all registered configuration watchers"""
        for watcher in self.config_watchers:
            try:
                if asyncio.iscoroutinefunction(watcher):
                    await watcher(environment, config)
                else:
                    watcher(environment, config)
            except Exception as e:
                logger.error(f"Configuration watcher failed: {e}")

    def validate_configuration(self, config: GatewayPolicyConfig) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []

        # Validate CORS configuration
        if not config.cors.allow_origins:
            errors.append("CORS allow_origins cannot be empty")

        # Validate rate limiting
        if config.rate_limiting.default_limits.get("requests_per_minute", 0) <= 0:
            errors.append("Rate limit per minute must be positive")

        # Validate security headers
        if config.security_headers.hsts_max_age <= 0:
            errors.append("HSTS max age must be positive")

        return errors

    def get_feature_flags(self) -> Dict[str, bool]:
        """Get current feature flags"""
        config = self.get_current_config()
        return {
            "websocket_proxy": config.enable_websocket_proxy,
            "api_versioning": config.enable_api_versioning,
            "request_transformation": config.enable_request_transformation,
            "response_transformation": config.enable_response_transformation,
            "ip_whitelisting": config.enable_ip_whitelisting,
            "rate_limiting": config.enable_rate_limiting,
        }

    def is_endpoint_sensitive(self, endpoint: str) -> bool:
        """Check if endpoint requires enhanced security"""
        config = self.get_current_config()

        for sensitive_endpoint in config.authentication.sensitive_endpoints:
            if endpoint.startswith(sensitive_endpoint):
                return True

        return False

    def get_endpoint_rate_limits(self, endpoint: str, tier: str = "default") -> Dict[str, int]:
        """Get rate limits for specific endpoint and tier"""
        config = self.get_current_config()

        # Check endpoint-specific limits first
        if endpoint in config.rate_limiting.endpoint_limits:
            return config.rate_limiting.endpoint_limits[endpoint]

        # Check tier-specific limits
        if tier in config.rate_limiting.tier_limits:
            return config.rate_limiting.tier_limits[tier]

        # Return default limits
        return config.rate_limiting.default_limits

    def to_dict(self, environment: Optional[str] = None) -> Dict[str, Any]:
        """Convert configuration to dictionary"""
        config = self.get_config(environment)
        return asdict(config)


# Global configuration instance
gateway_config = GatewayConfig()