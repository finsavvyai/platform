#!/usr/bin/env python3
"""
FinSavvyAI Configuration Management

Sub-modules:
  config_defaults - Default schema, merge, validation
  config_env      - Environment variable overrides
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, Optional

from src.core.config_defaults import (
    get_default_config,
    get_nested,
    merge_config,
    set_nested,
    validate_config,
)
from src.core.config_env import apply_env_overrides

logger = logging.getLogger("finsavvyai.config")


class ClusterConfig:
    """Cluster configuration."""

    def __init__(self, config_path: Optional[str] = None) -> None:
        self.config_path = config_path or self._get_default_config_path()
        self.config = self._load_config()
        apply_env_overrides(self.config)
        self.validation_errors = validate_config(self.config)

    def _get_default_config_path(self) -> str:
        """Get default config file path."""
        home = Path.home()
        config_dir = home / ".finsavvyai"
        config_dir.mkdir(exist_ok=True)
        return str(config_dir / "cluster-config.json")

    def _load_config(self) -> Dict:
        """Load configuration from file."""
        default_config = get_default_config()

        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    user_config = json.load(f)
                    merge_config(default_config, user_config)
            except Exception as e:
                logger.warning(
                    "Could not load config from %s: %s. Using defaults.",
                    self.config_path,
                    e,
                )

        return default_config

    def save(self) -> None:
        """Save configuration to file."""
        os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
        with open(self.config_path, "w") as f:
            json.dump(self.config, f, indent=2)

    def get(self, key_path: str, default: object = None) -> object:
        """Get config value by dot-separated path."""
        return get_nested(self.config, key_path, default)

    def set(self, key_path: str, value: object) -> None:
        """Set config value by dot-separated path."""
        set_nested(self.config, key_path, value)

    @property
    def master_host(self) -> Optional[str]:
        return self.get("master.host")

    @property
    def master_port(self) -> int:
        return self.get("master.port", 8000)

    @property
    def cluster_id(self) -> str:
        return self.get("master.cluster_id", "finsavvy-home-cluster")

    @property
    def worker_port(self) -> int:
        return self.get("worker.default_port", 8001)

    @property
    def heartbeat_interval(self) -> int:
        return self.get("worker.heartbeat_interval", 30)

    @property
    def log_level(self) -> str:
        return self.get("logging.level", "INFO")

    @property
    def log_file(self) -> str:
        return self.get("logging.file", "logs/finsavvyai.log")
