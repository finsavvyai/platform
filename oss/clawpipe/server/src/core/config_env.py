#!/usr/bin/env python3
"""
Configuration Environment Overrides

Applies environment variable overrides to the configuration dictionary.
Supports zero-config mode: when no API key is set and no explicit auth
mode is configured, auth defaults to "none" for frictionless startup.
"""

import logging
import os
from typing import Dict

logger = logging.getLogger("finsavvyai.config")


def _detect_zero_config(config: Dict) -> None:
    """Auto-set auth_mode to 'none' when no API key is configured.

    Only activates when the user has NOT explicitly set an auth mode
    via FINSAVVYAI_AUTH_MODE or FINSAVVYAI_AUTH_ENABLED env vars.
    """
    has_api_key = bool(os.getenv("FINSAVVYAI_API_KEY"))
    has_explicit_auth = bool(
        os.getenv("FINSAVVYAI_AUTH_MODE") or os.getenv("FINSAVVYAI_AUTH_ENABLED")
    )
    if not has_api_key and not has_explicit_auth:
        config["api"]["auth_mode"] = "none"
        config["api"]["auth_enabled"] = False
        logger.info("Running in open mode - no authentication required")


def apply_env_overrides(config: Dict) -> None:
    """Apply environment variable overrides to config (in-place)."""
    # Master settings
    if os.getenv("FINSAVVYAI_MASTER_HOST"):
        config["master"]["host"] = os.getenv("FINSAVVYAI_MASTER_HOST")
    if os.getenv("FINSAVVYAI_MASTER_PORT"):
        config["master"]["port"] = int(os.getenv("FINSAVVYAI_MASTER_PORT"))
    if os.getenv("FINSAVVYAI_CLUSTER_ID"):
        config["master"]["cluster_id"] = os.getenv("FINSAVVYAI_CLUSTER_ID")

    # API settings — auth mode (new) takes precedence over auth_enabled (legacy)
    if os.getenv("FINSAVVYAI_AUTH_MODE"):
        config["api"]["auth_mode"] = os.getenv("FINSAVVYAI_AUTH_MODE").lower()
    elif os.getenv("FINSAVVYAI_AUTH_ENABLED"):
        legacy = os.getenv("FINSAVVYAI_AUTH_ENABLED").lower() == "true"
        config["api"]["auth_mode"] = "service" if legacy else "none"
        config["api"]["auth_enabled"] = legacy

    # Zero-config detection (after explicit overrides so they take priority)
    _detect_zero_config(config)
    if os.getenv("FINSAVVYAI_RATE_LIMIT_REQUESTS"):
        config["api"]["rate_limit_requests"] = int(
            os.getenv("FINSAVVYAI_RATE_LIMIT_REQUESTS")
        )
    if os.getenv("FINSAVVYAI_RATE_LIMIT_WINDOW"):
        config["api"]["rate_limit_window"] = int(
            os.getenv("FINSAVVYAI_RATE_LIMIT_WINDOW")
        )

    # Logging settings
    if os.getenv("FINSAVVYAI_LOG_LEVEL"):
        config["logging"]["level"] = os.getenv("FINSAVVYAI_LOG_LEVEL")
    if os.getenv("FINSAVVYAI_LOG_FILE"):
        config["logging"]["file"] = os.getenv("FINSAVVYAI_LOG_FILE")

    # Channel settings
    if os.getenv("CHANNELS_ENABLED"):
        config["channels"]["enabled"] = (
            os.getenv("CHANNELS_ENABLED").lower() == "true"
        )
    if os.getenv("CHANNELS_WEBHOOK_SECRET"):
        config["channels"]["webhook_secret"] = os.getenv(
            "CHANNELS_WEBHOOK_SECRET"
        )
    if os.getenv("CHANNELS_MENTION_TRIGGER"):
        config["channels"]["mention_trigger"] = os.getenv(
            "CHANNELS_MENTION_TRIGGER"
        )

    # Vision settings
    if os.getenv("VISION_CACHE_ENABLED"):
        config["vision"]["cache_enabled"] = (
            os.getenv("VISION_CACHE_ENABLED").lower() == "true"
        )
    if os.getenv("VISION_CACHE_TTL"):
        config["vision"]["cache_ttl"] = int(os.getenv("VISION_CACHE_TTL"))
    if os.getenv("VISION_RATE_LIMIT"):
        config["vision"]["rate_limit_rate"] = float(
            os.getenv("VISION_RATE_LIMIT")
        )
