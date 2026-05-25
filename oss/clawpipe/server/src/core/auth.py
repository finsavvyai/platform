#!/usr/bin/env python3
"""
FinSavvyAI Authentication and Authorization

Uses bcrypt for secure password hashing with automatic salting.
API keys are stored as bcrypt hashes - never in plaintext.

Middleware lives in auth_middleware.py.
"""

import hashlib
import json
import logging
import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import bcrypt  # Required dependency

from src.core.auth_middleware import (  # noqa: F401
    get_api_key_from_request,
    require_auth,
)

logger = logging.getLogger("finsavvyai.auth")


class APIKeyManager:
    """Manage API keys for authentication with secure bcrypt hashing."""

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or os.path.join(
            os.path.expanduser("~/.finsavvyai"), "api-keys.json")
        self.keys = self._load_keys()

    def _load_keys(self) -> Dict:
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    data = json.load(f)
                    if self._needs_migration(data):
                        self._migrate_keys(data)
                    return data
            except (json.JSONDecodeError, IOError):
                pass
        return {"keys": [], "version": 2}

    def _needs_migration(self, data: Dict) -> bool:
        return data.get("version", 1) < 2

    def _migrate_keys(self, data: Dict) -> None:
        for key_data in data.get("keys", []):
            if "hash" in key_data and "bcrypt_hash" not in key_data:
                key_data["needs_rotation"] = True
                key_data["migration_note"] = "SHA256 hash - generate new key"
        data["version"] = 2

    def _save_keys(self) -> None:
        Path(self.config_path).parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            json.dump(self.keys, f, indent=2)
        try:
            os.chmod(self.config_path, 0o600)
        except OSError:
            pass

    def generate_key(self, name: str, description: str = "") -> Dict:
        """Generate a new API key with bcrypt hash."""
        key_value = f"finsavvy-{secrets.token_hex(16)}"
        bcrypt_hash = bcrypt.hashpw(
            key_value.encode(), bcrypt.gensalt(rounds=12)
        ).decode()
        key_prefix = key_value[:16]
        key_data = {
            "name": name, "description": description,
            "bcrypt_hash": bcrypt_hash, "prefix": key_prefix,
            "created_at": datetime.now().isoformat(),
            "last_used": None, "enabled": True,
        }
        if "keys" not in self.keys:
            self.keys["keys"] = []
        self.keys["keys"].append(key_data)
        self._save_keys()
        return {"name": name, "description": description, "prefix": key_prefix,
                "created_at": key_data["created_at"], "enabled": True, "key": key_value}

    def validate_key(self, api_key: str) -> bool:
        """Validate an API key against stored bcrypt hashes."""
        if not api_key or not isinstance(api_key, str) or not api_key.startswith("finsavvy-"):
            return False
        key_prefix = api_key[:16]
        for key_data in self.keys.get("keys", []):
            if not key_data.get("enabled", True):
                continue
            if key_data.get("prefix") and key_data["prefix"] != key_prefix:
                continue
            stored_hash = key_data.get("bcrypt_hash")
            if stored_hash:
                try:
                    if bcrypt.checkpw(api_key.encode(), stored_hash.encode()):
                        key_data["last_used"] = datetime.now().isoformat()
                        self._save_keys()
                        return True
                except (ValueError, TypeError):
                    continue
            legacy_hash = key_data.get("hash")
            if legacy_hash:
                if hashlib.sha256(api_key.encode()).hexdigest() == legacy_hash:
                    logger.warning(
                        "Legacy SHA256 key '%s' used - rotate to bcrypt key",
                        key_data.get("name", "unknown"),
                    )
                    key_data["last_used"] = datetime.now().isoformat()
                    key_data["needs_rotation"] = True
                    self._save_keys()
                    return True
        return False

    def rotate_key(self, name: str) -> Optional[Dict]:
        """Generate a new key to replace an existing one."""
        for key_data in self.keys.get("keys", []):
            if key_data.get("name") == name and key_data.get("enabled", True):
                key_data["enabled"] = False
                key_data["revoked_at"] = datetime.now().isoformat()
                key_data["rotation_note"] = "Rotated"
                break
        else:
            return None
        return self.generate_key(f"{name}", f"Rotated from {name}")

    def revoke_key(self, name: str) -> bool:
        """Disable an API key by name."""
        for key_data in self.keys.get("keys", []):
            if key_data.get("name") == name:
                key_data["enabled"] = False
                key_data["revoked_at"] = datetime.now().isoformat()
                self._save_keys()
                return True
        return False

    def list_keys(self) -> List[Dict]:
        """List all API keys (without hashes)."""
        safe = {"name", "description", "prefix", "created_at", "last_used",
                "enabled", "needs_rotation", "revoked_at"}
        return [{k: v for k, v in key.items() if k in safe}
                for key in self.keys.get("keys", [])]
