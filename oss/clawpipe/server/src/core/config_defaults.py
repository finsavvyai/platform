#!/usr/bin/env python3
"""
Configuration Defaults and Validation

Default configuration schema and validation logic for ClusterConfig.
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger("finsavvyai.config")


def get_default_config() -> Dict:
    """Return the default configuration dictionary."""
    return {
        "master": {
            "host": None,
            "port": 8000,
            "cluster_id": "finsavvy-home-cluster",
        },
        "worker": {
            "default_port": 8001,
            "heartbeat_interval": 30,
            "max_load": 100,
            "default_models": ["gpt-3.5-turbo-sim"],
        },
        "logging": {
            "level": "INFO",
            "file": "logs/finsavvyai.log",
            "format": "json",
            "console": True,
        },
        "api": {
            "timeout": 30,
            "max_retries": 3,
            "cors_enabled": True,
            "auth_enabled": True,
            "auth_mode": "service",
            "rate_limit_enabled": True,
            "rate_limit_requests": 100,
            "rate_limit_window": 60,
        },
        "router": {
            "enabled": True,
            "default_speed_preference": "balanced",
        },
        "channels": {
            "enabled": False,
            "webhook_secret": None,
            "mention_trigger": "@finsavvy",
            "allowed_senders": None,
            "max_session_history": 20,
            "agent_id": "finsavvy-ai",
            "agent_name": "FinSavvyAI",
        },
        "vision": {
            "rate_limit_rate": 5.0,
            "max_concurrent_requests": 5,
            "cache_enabled": True,
            "cache_ttl": 3600,
            "preprocessing_enabled": True,
            "max_image_dimension": 2048,
            "jpeg_quality": 85,
            "fetch_timeout": 10,
            "pdf_dpi": 200,
            "max_pdf_pages": 50,
            "pipeline_max_steps": 10,
            "pipeline_timeout": 300,
        },
    }


def merge_config(default: Dict, user: Dict) -> None:
    """Recursively merge user config into default (in-place)."""
    for key, value in user.items():
        if (
            key in default
            and isinstance(default[key], dict)
            and isinstance(value, dict)
        ):
            merge_config(default[key], value)
        else:
            default[key] = value


def get_nested(config: Dict, key_path: str, default: Optional[object] = None) -> object:
    """Get config value by dot-separated path."""
    keys = key_path.split(".")
    value: object = config
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return default
    return value


def set_nested(config: Dict, key_path: str, value: object) -> None:
    """Set config value by dot-separated path."""
    keys = key_path.split(".")
    current = config
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    current[keys[-1]] = value


def validate_config(config: Dict) -> List[str]:
    """Validate configuration values. Returns list of error messages."""
    errors: List[str] = []

    for key in ["master.port", "worker.default_port"]:
        port = get_nested(config, key)
        if port is not None and (
            not isinstance(port, int) or port < 1 or port > 65535
        ):
            errors.append(
                f"{key} must be an integer between 1 and 65535, got {port}"
            )

    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    log_level = get_nested(config, "logging.level", "INFO")
    if isinstance(log_level, str) and log_level.upper() not in valid_levels:
        errors.append(
            f"logging.level must be one of {valid_levels}, got {log_level}"
        )

    rate_requests = get_nested(config, "api.rate_limit_requests")
    if rate_requests is not None and (
        not isinstance(rate_requests, int) or rate_requests < 1
    ):
        errors.append(
            f"api.rate_limit_requests must be a positive integer, got {rate_requests}"
        )

    rate_window = get_nested(config, "api.rate_limit_window")
    if rate_window is not None and (
        not isinstance(rate_window, int) or rate_window < 1
    ):
        errors.append(
            f"api.rate_limit_window must be a positive integer, got {rate_window}"
        )

    heartbeat = get_nested(config, "worker.heartbeat_interval")
    if heartbeat is not None and (not isinstance(heartbeat, int) or heartbeat < 5):
        errors.append(
            f"worker.heartbeat_interval must be >= 5 seconds, got {heartbeat}"
        )

    valid_auth_modes = {"none", "dev", "service"}
    auth_mode = get_nested(config, "api.auth_mode")
    if auth_mode is not None and auth_mode not in valid_auth_modes:
        errors.append(
            f"api.auth_mode must be one of {valid_auth_modes}, got {auth_mode}"
        )

    if errors:
        for err in errors:
            logger.warning("Config validation: %s", err)

    return errors
