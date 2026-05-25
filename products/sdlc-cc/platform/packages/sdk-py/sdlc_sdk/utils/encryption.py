"""
Encryption utilities for SDLC.ai SDK

Provides secure encryption and decryption operations for sensitive data.
"""

import base64
import os
from typing import Optional, Union

import structlog
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = structlog.get_logger("sdlc_sdk.encryption")


def generate_key(password: Optional[str] = None) -> bytes:
    """
    Generate an encryption key from password or random bytes.

    Args:
        password: Optional password for key derivation

    Returns:
        Encryption key as bytes
    """
    if password:
        # Derive key from password using PBKDF2
        salt = b"sdlc_sdk_salt"  # In production, use random salt per key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = kdf.derive(password.encode())
        return base64.urlsafe_b64encode(key)
    else:
        # Generate random key
        return Fernet.generate_key()


def encrypt_data(data: Union[str, bytes], key: Optional[bytes] = None) -> str:
    """
    Encrypt data using Fernet symmetric encryption.

    Args:
        data: Data to encrypt (string or bytes)
        key: Encryption key (generated if not provided)

    Returns:
        Base64-encoded encrypted data
    """
    if key is None:
        key = generate_key()
        logger.warning("Using generated key - store it securely for decryption")

    f = Fernet(key)

    if isinstance(data, str):
        data = data.encode()

    encrypted = f.encrypt(data)
    return base64.urlsafe_b64encode(encrypted).decode()


def decrypt_data(encrypted_data: str, key: bytes) -> str:
    """
    Decrypt data using Fernet symmetric encryption.

    Args:
        encrypted_data: Base64-encoded encrypted data
        key: Encryption key used for encryption

    Returns:
        Decrypted data as string

    Raises:
        ValueError: If decryption fails
    """
    try:
        f = Fernet(key)
        encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = f.decrypt(encrypted_bytes)
        return decrypted.decode()
    except Exception as e:
        logger.error("Decryption failed", error=str(e))
        raise ValueError("Failed to decrypt data - invalid key or corrupted data")


def hash_data(data: Union[str, bytes], salt: Optional[bytes] = None) -> str:
    """
    Hash data using SHA-256 with optional salt.

    Args:
        data: Data to hash
        salt: Optional salt bytes

    Returns:
        Hex-encoded hash
    """
    if isinstance(data, str):
        data = data.encode()

    if salt is None:
        salt = os.urandom(16)

    digest = hashes.Hash(hashes.SHA256())
    digest.update(data + salt)
    return digest.finalize().hex()


def mask_sensitive_data(data: str, mask_char: str = "*", visible_chars: int = 4) -> str:
    """
    Mask sensitive data for logging.

    Args:
        data: Sensitive data to mask
        mask_char: Character to use for masking
        visible_chars: Number of characters to keep visible

    Returns:
        Masked data string
    """
    if not data or len(data) <= visible_chars:
        return mask_char * len(data) if data else ""

    return data[:visible_chars] + mask_char * (len(data) - visible_chars)
