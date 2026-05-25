"""Security hardening for UPM.

Provides encryption at rest, key rotation, secure configuration,
and security headers for production deployment.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import secrets
import string
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from starlette.middleware.base import BaseHTTPMiddleware

from ...core.config import settings

logger = logging.getLogger(__name__)


class EncryptionLevel(str, Enum):
    """Encryption strength levels."""

    AES128 = "aes128"
    AES256 = "aes256"


class KeyRotationPolicy(str, Enum):
    """Key rotation policies."""

    TIME_BASED = "time_based"
    EVENT_BASED = "event_based"
    NEVER = "never"


@dataclass
class EncryptionConfig:
    """Configuration for encryption settings."""

    algorithm: EncryptionLevel = EncryptionLevel.AES256
    key_rotation_days: int = 90
    key_rotation_policy: KeyRotationPolicy = KeyRotationPolicy.TIME_BASED
    enable_key_escrow: bool = True
    encryption_at_rest: bool = True
    encryption_in_transit: bool = True


class SecurePasswordGenerator:
    """Generates secure random passwords."""

    LOWERCASE = string.ascii_lowercase
    UPPERCASE = string.ascii_uppercase
    DIGITS = string.digits
    SPECIAL = "!@#$%^&*()_+-=[]{}|;:,.<>?/`~"

    @classmethod
    def generate(
        cls,
        length: int = 16,
        use_lowercase: bool = True,
        use_uppercase: bool = True,
        use_digits: bool = True,
        use_special: bool = True,
        exclude_ambiguous: bool = True,
    ) -> str:
        """Generate a secure random password.

        Args:
            length: Password length
            use_lowercase: Include lowercase letters
            use_uppercase: Include uppercase letters
            use_digits: Include digits
            use_special: Include special characters
            exclude_ambiguous: Exclude ambiguous chars (0OIl1)

        Returns:
            Generated password
        """
        charset = ""

        if use_lowercase:
            charset += cls.LOWERCASE
        if use_uppercase:
            charset += cls.UPPERCASE
        if use_digits:
            charset += cls.DIGITS
        if use_special:
            charset += cls.SPECIAL

        if exclude_ambiguous:
            # Remove ambiguous characters
            for char in "0OIl1":
                charset = charset.replace(char, "")

        if not charset:
            raise ValueError("No character set selected")

        return "".join(secrets.choice(charset) for _ in range(length))

    @classmethod
    def generate_api_key(cls, prefix: str = "upm_", length: int = 32) -> str:
        """Generate a secure API key.

        Args:
            prefix: Key prefix
            length: Random portion length

        Returns:
            API key
        """
        random_part = secrets.token_urlsafe(length)
        return f"{prefix}{random_part}"


class DataEncryption:
    """Handles data encryption and decryption at rest.

    Uses Fernet (symmetric encryption) with PBKDF2 key derivation.
    """

    def __init__(self, config: Optional[EncryptionConfig] = None):
        self.config = config or EncryptionConfig()
        self._fernet: Optional[Fernet] = None
        self._master_key: Optional[bytes] = None
        self._init_encryption()

    def _init_encryption(self) -> None:
        """Initialize encryption with master key."""
        master_key_env = os.environ.get("UPM_MASTER_KEY")

        if master_key_env:
            self._master_key = master_key_env.encode()
        else:
            # Generate or load key from file
            key_file = Path("config/master.key")
            if key_file.exists():
                self._master_key = key_file.read_bytes()
            else:
                self._master_key = self._generate_master_key()
                key_file.parent.mkdir(parents=True, exist_ok=True)
                key_file.write_bytes(self._master_key)
                logger.info(f"Generated new master key at {key_file}")

        # Derive encryption key from master key
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"upm_encryption_salt",
            iterations=100000,
            backend=default_backend(),
        )
        key = base64.urlsafe_b64encode(kdf.derive(self._master_key))

        self._fernet = Fernet(key)

    def _generate_master_key(self) -> bytes:
        """Generate a new master key."""
        return secrets.token_bytes(32)

    def encrypt(self, data: str) -> str:
        """Encrypt data.

        Args:
            data: Plain text data

        Returns:
            Encrypted data (base64-encoded)
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        encrypted = self._fernet.encrypt(data.encode())
        return encrypted.decode()

    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt data.

        Args:
            encrypted_data: Encrypted data

        Returns:
            Plain text data

        Raises:
            ValueError: If decryption fails
        """
        if not self._fernet:
            raise RuntimeError("Encryption not initialized")

        try:
            decrypted = self._fernet.decrypt(encrypted_data.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")

    def encrypt_dict(self, data: dict[str, Any]) -> dict[str, str]:
        """Encrypt dictionary values.

        Args:
            data: Dictionary to encrypt

        Returns:
            Dictionary with encrypted values
        """
        return {k: self.encrypt(json.dumps(v)) for k, v in data.items()}

    def decrypt_dict(self, encrypted_dict: dict[str, str]) -> dict[str, Any]:
        """Decrypt dictionary values.

        Args:
            encrypted_dict: Dictionary with encrypted values

        Returns:
            Decrypted dictionary
        """
        try:
            return {k: json.loads(self.decrypt(v)) for k, v in encrypted_dict.items()}
        except Exception as e:
            raise ValueError(f"Dict decryption failed: {e}")

    def rotate_key(self) -> bool:
        """Rotate encryption key.

        Returns:
            True if rotation succeeded
        """
        try:
            # Generate new master key
            new_master_key = self._generate_master_key()

            # Update encryption
            old_fernet = self._fernet
            self._master_key = new_master_key

            kdf = PBKDF2(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b"upm_encryption_salt",
                iterations=100000,
                backend=default_backend(),
            )
            key = base64.urlsafe_b64encode(kdf.derive(new_master_key))
            self._fernet = Fernet(key)

            # Save new key
            key_file = Path("config/master.key")
            key_file.write_bytes(new_master_key)

            logger.info("Successfully rotated encryption key")

            return True

        except Exception as e:
            logger.error(f"Key rotation failed: {e}")
            return False


class SecureConfig:
    """Manages secure configuration values."""

    def __init__(self):
        self._data: dict[str, str] = {}
        self._encrypted_fields: Set[str] = set()
        self._encryption = DataEncryption()

    def set(self, key: str, value: str, encrypt: bool = False) -> None:
        """Set a configuration value.

        Args:
            key: Configuration key
            value: Configuration value
            encrypt: Whether to encrypt the value
        """
        if encrypt:
            self._data[key] = self._encryption.encrypt(value)
            self._encrypted_fields.add(key)
        else:
            self._data[key] = value

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get a configuration value.

        Args:
            key: Configuration key
            default: Default value if not found

        Returns:
            Configuration value
        """
        value = self._data.get(key, default)

        if key in self._encrypted_fields:
            return self._encryption.decrypt(value)

        return value

    def get_all(self, decrypt: bool = True) -> dict[str, str]:
        """Get all configuration values.

        Args:
            decrypt: Whether to decrypt encrypted values

        Returns:
            Dictionary of all configuration values
        """
        if decrypt:
            result = {}
            for key, value in self._data.items():
                if key in self._encrypted_fields:
                    result[key] = self._encryption.decrypt(value)
                else:
                    result[key] = value
            return result

        return self._data.copy()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to HTTP responses.

    Implements OWASP recommended security headers.
    """

    CSP_DIRECTIVE = """
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self';
    connect-src 'self' https://api.upm.dev;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
    block-all-mixed-content;
    """

    async def dispatch(self, request, call_next):
        """Process request and add security headers."""
        response = await call_next(request)

        # Add security headers
        headers = {
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
            "Content-Security-Policy": self.CSP_DIRECTIVE,
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
        }

        for header_name, header_value in headers.items():
            response.headers[header_name] = header_value

        return response


class SecurityAuditor:
    """Audits security configuration and provides recommendations."""

    def __init__(self):
        self.encryption = DataEncryption()

    def audit_config(self) -> dict[str, Any]:
        """Audit current security configuration.

        Returns:
            Audit results with recommendations
        """
        findings = []
        score = 100

        # Check encryption at rest
        if settings.ENCRYPTION_AT_REST:
            findings.append(
                {
                    "level": "info",
                    "category": "encryption",
                    "message": "Encryption at rest is enabled",
                    "status": "pass",
                }
            )
        else:
            findings.append(
                {
                    "level": "critical",
                    "category": "encryption",
                    "message": "Encryption at rest is not enabled",
                    "status": "fail",
                    "recommendation": "Enable ENCRYPTION_AT_REST in settings",
                }
            )
            score -= 20

        # Check HTTPS
        if settings.SERVER_HOST.startswith("https://"):
            findings.append(
                {
                    "level": "info",
                    "category": "transport",
                    "message": "HTTPS is enabled",
                    "status": "pass",
                }
            )
        else:
            findings.append(
                {
                    "level": "high",
                    "category": "transport",
                    "message": "HTTP is being used (unencrypted transport)",
                    "status": "fail",
                    "recommendation": "Configure HTTPS with valid TLS certificate",
                }
            )
            score -= 15

        # Check secret key strength
        if len(settings.SECRET_KEY) < 32:
            findings.append(
                {
                    "level": "medium",
                    "category": "credentials",
                    "message": "SECRET_KEY is too short",
                    "status": "fail",
                    "recommendation": "Use a SECRET_KEY of at least 32 characters",
                }
            )
            score -= 10

        # Check CORS configuration
        if settings.BACKEND_CORS_ORIGINS:
            if settings.BACKEND_CORS_ORIGINS == ["*"]:
                findings.append(
                    {
                        "level": "medium",
                        "category": "cors",
                        "message": "CORS is configured to allow all origins",
                        "status": "warning",
                        "recommendation": "Specify exact allowed origins",
                    }
                )
                score -= 5

        # Check debug mode
        if settings.DEBUG:
            findings.append(
                {
                    "level": "high",
                    "category": "general",
                    "message": "Debug mode is enabled",
                    "status": "fail",
                    "recommendation": "Disable DEBUG mode in production",
                }
            )
            score -= 15

        return {
            "score": max(score, 0),
            "grade": self._calculate_grade(score),
            "findings": findings,
            "timestamp": datetime.utcnow().isoformat(),
        }

    def _calculate_grade(self, score: int) -> str:
        """Calculate security grade from score.

        Args:
            score: Security score (0-100)

        Returns:
            Letter grade (A-F)
        """
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"


def generate_secure_token(
    token_type: str = "api",
    expires_in: Optional[int] = None,
) -> str:
    """Generate a secure random token.

    Args:
        token_type: Type of token (api, refresh, reset, etc.)
        expires_in: Optional expiration time

    Returns:
        Generated token
    """
    prefix_map = {
        "api": "upm_api",
        "refresh": "upm_rf",
        "reset": "upm_rst",
        "webhook": "upm_wh",
    }

    prefix = prefix_map.get(token_type, "upm_tok")
    random_bytes = secrets.token_bytes(32)
    token = f"{prefix}_{random_bytes.hex()}"

    return token


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash a password with salt.

    Args:
        password: Plain text password
        salt: Optional salt (generated if not provided)

    Returns:
        Tuple of (hashed_password, salt)
    """
    if salt is None:
        salt = secrets.token_hex(16)

    # Use SHA-256
    salted_password = (salt + password).encode()
    hashed = hashlib.sha256(salted_password).hexdigest()

    return f"sha256${salt}${hashed}", salt


def verify_hashed_password(password: str, hashed_password: str) -> bool:
    """Verify a password against a hash.

    Args:
        password: Plain text password
        hashed_password: Hashed password

    Returns:
        True if password matches hash
    """
    try:
        algorithm, salt, hash_value = hashed_password.split("$")

        if algorithm != "sha256":
            # Fallback to other algorithms
            return False

        # Reconstruct hash and verify
        _, new_salt = hash_password(password, salt)
        return secrets.compare_digest(new_salt.encode(), hashed_password.encode())

    except ValueError:
        return False


import base64

# Singleton instances
_data_encryption: Optional[DataEncryption] = None
_secure_config: Optional[SecureConfig] = None


def get_encryption() -> DataEncryption:
    """Get data encryption instance."""
    global _data_encryption
    if _data_encryption is None:
        _data_encryption = DataEncryption()
    return _data_encryption


def get_secure_config() -> SecureConfig:
    """Get secure config instance."""
    global _secure_config
    if _secure_config is None:
        _secure_config = SecureConfig()
    return _secure_config
