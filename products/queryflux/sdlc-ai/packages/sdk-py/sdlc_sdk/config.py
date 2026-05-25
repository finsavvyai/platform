"""
Configuration module for SDLC.ai SDK

Handles configuration management including environment variables,
settings validation, and default values.
"""

import os
from typing import Optional, Dict, Any, Union
from pathlib import Path
import warnings

from pydantic import BaseModel, Field, validator
from pydantic_settings import BaseSettings


class RetryConfig(BaseModel):
    """Configuration for retry logic."""

    max_retries: int = Field(default=3, ge=0, le=10)
    retry_backoff: float = Field(default=1.0, ge=0.1)
    retry_backoff_max: float = Field(default=60.0, ge=1.0)
    retry_on_status_codes: tuple = Field(default=(429, 500, 502, 503, 504))
    retry_jitter: bool = True


class SecurityConfig(BaseModel):
    """Security-related configuration."""

    encrypt_tokens: bool = True
    token_encryption_key: Optional[str] = None
    verify_ssl: bool = True
    certificate_bundle: Optional[str] = None
    certificate_pin: Optional[str] = None
    request_signing: bool = False
    request_signing_key: Optional[str] = None
    rate_limit: Optional[int] = Field(default=None, ge=1)  # requests per minute
    rate_limit_burst: Optional[int] = Field(default=None, ge=1)


class LoggingConfig(BaseModel):
    """Logging configuration."""

    enabled: bool = True
    level: str = Field(default="INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    format: str = "json"
    include_request_id: bool = True
    include_timing: bool = True
    mask_sensitive_data: bool = True
    sensitive_fields: list = Field(
        default_factory=lambda: [
            "api_key",
            "password",
            "token",
            "secret",
            "authorization",
            "cookie",
            "session",
        ]
    )


class CacheConfig(BaseModel):
    """Caching configuration."""

    enabled: bool = True
    ttl: int = Field(default=300, ge=0)  # seconds
    max_size: int = Field(default=1000, ge=0)
    backend: str = Field(default="memory", regex="^(memory|redis|disk)$")
    redis_url: Optional[str] = None
    disk_cache_dir: Optional[Path] = None


class Config(BaseSettings):
    """
    Main configuration class for SDLC.ai SDK.

    Supports environment variables with prefix SDLC_SDK_
    """

    # Core settings
    base_url: str = Field(
        default="https://api.sdlc.ai", description="Base URL for the SDLC.ai API"
    )
    api_version: str = Field(default="v3", description="API version")

    # Authentication
    api_key: Optional[str] = Field(
        default=None, description="API key for authentication"
    )
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    oauth_token_url: Optional[str] = None

    # Network settings
    timeout: float = Field(default=30.0, ge=1.0, le=300.0)
    connect_timeout: float = Field(default=5.0, ge=0.1, le=60.0)
    read_timeout: float = Field(default=25.0, ge=0.1, le=300.0)
    pool_connections: int = Field(default=10, ge=1, le=100)
    pool_maxsize: int = Field(default=10, ge=1, le=100)
    max_keepalive_connections: int = Field(default=5, ge=1, le=50)
    keepalive_expiry: float = Field(default=5.0, ge=1.0)

    # Proxy settings
    proxy_url: Optional[str] = None
    proxy_auth: Optional[Dict[str, str]] = None
    no_proxy: Optional[list] = None

    # Sub-configurations
    retry: RetryConfig = Field(default_factory=RetryConfig)
    security: SecurityConfig = Field(default_factory=SecurityConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    cache: CacheConfig = Field(default_factory=CacheConfig)

    # Feature flags
    enable_compression: bool = True
    enable_metrics: bool = True
    enable_tracing: bool = False
    auto_retry: bool = True

    # User agent
    user_agent: str = Field(
        default=f"SDLC-SDK-Python/{__version__}", description="Custom User-Agent header"
    )

    # Extra headers
    extra_headers: Dict[str, str] = Field(default_factory=dict)

    # Custom settings
    custom: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        env_prefix = "SDLC_SDK_"
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        validate_assignment = True

    @validator("base_url")
    def validate_base_url(cls, v):
        """Ensure base_url has proper format."""
        if not v.startswith(("http://", "https://")):
            raise ValueError("base_url must start with http:// or https://")
        if v.endswith("/"):
            v = v.rstrip("/")
        return v

    @validator("proxy_url")
    def validate_proxy_url(cls, v):
        """Validate proxy URL format."""
        if v and not v.startswith(("http://", "https://", "socks5://")):
            raise ValueError("proxy_url must be a valid URL")
        return v

    @validator("security", pre=True)
    def validate_security(cls, v):
        """Merge security settings from env."""
        if isinstance(v, dict):
            # Check for env variables that override security settings
            if "SDLC_SDK_VERIFY_SSL" in os.environ:
                v["verify_ssl"] = os.environ["SDLC_SDK_VERIFY_SSL"].lower() != "false"
            if "SDLC_SDK_RATE_LIMIT" in os.environ:
                try:
                    v["rate_limit"] = int(os.environ["SDLC_SDK_RATE_LIMIT"])
                except ValueError:
                    pass
        return v

    def get_auth_config(self) -> Dict[str, Any]:
        """Get authentication configuration."""
        config = {}
        if self.api_key:
            config["api_key"] = self.api_key
        if self.client_id:
            config["client_id"] = self.client_id
        if self.client_secret:
            config["client_secret"] = self.client_secret
        if self.oauth_token_url:
            config["token_url"] = self.oauth_token_url
        return config

    def get_httpx_config(self) -> Dict[str, Any]:
        """Get httpx client configuration."""
        config = {
            "timeout": (self.connect_timeout, self.read_timeout),
            "limits": {
                "max_keepalive_connections": self.max_keepalive_connections,
                "keepalive_expiry": self.keepalive_expiry,
                "max_connections": self.pool_connections,
                "max_pool_connections": self.pool_maxsize,
            },
            "verify": self.security.verify_ssl,
            "http2": True,
        }

        # Add proxy configuration
        if self.proxy_url:
            config["proxies"] = self.proxy_url
            if self.proxy_auth:
                config["proxy_auth"] = self.proxy_auth

        # Add SSL certificate bundle
        if self.security.certificate_bundle:
            config["verify"] = self.security.certificate_bundle

        # Add headers
        headers = {"User-Agent": self.user_agent}
        headers.update(self.extra_headers)

        if self.enable_compression:
            headers["Accept-Encoding"] = "gzip, deflate, br"

        config["headers"] = headers

        return config

    def update(self, **kwargs) -> "Config":
        """Update configuration with new values."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
            else:
                warnings.warn(f"Unknown configuration key: {key}")
        return self

    def merge_env(self) -> "Config":
        """Merge configuration from environment variables."""
        return self.__class__()


# Default configuration instance
default_config = Config()


def load_config(config_file: Optional[Union[str, Path]] = None, **kwargs) -> Config:
    """
    Load configuration from file and/or environment variables.

    Args:
        config_file: Path to configuration file (JSON/YAML)
        **kwargs: Additional configuration options

    Returns:
        Config instance
    """
    config = Config()

    # Load from file if provided
    if config_file:
        config_path = Path(config_file)
        if config_path.exists():
            if config_path.suffix in [".yaml", ".yml"]:
                import yaml

                with open(config_path) as f:
                    file_config = yaml.safe_load(f)
            elif config_path.suffix == ".json":
                import json

                with open(config_path) as f:
                    file_config = json.load(f)
            else:
                raise ValueError(
                    f"Unsupported config file format: {config_path.suffix}"
                )

            # Update config with file values
            for key, value in file_config.items():
                if hasattr(config, key):
                    setattr(config, key, value)

    # Update with provided kwargs
    config.update(**kwargs)

    return config
