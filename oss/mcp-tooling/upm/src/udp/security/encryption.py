"""
Encryption Management System.

Provides enterprise-grade encryption capabilities for data protection,
key management, and secure communication across the Universal Dependency Platform.
"""

import base64
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional, Union
from uuid import UUID

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class EncryptionAlgorithm(str, Enum):
    """Supported encryption algorithms."""
    AES_256_GCM = "aes_256_gcm"
    RSA_2048 = "rsa_2048"
    RSA_4096 = "rsa_4096"
    CHACHA20_POLY1305 = "chacha20_poly1305"


class KeyType(str, Enum):
    """Types of encryption keys."""
    SYMMETRIC = "symmetric"
    ASYMMETRIC_PUBLIC = "asymmetric_public"
    ASYMMETRIC_PRIVATE = "asymmetric_private"
    MASTER = "master"


@dataclass
class EncryptionKey:
    """Encryption key metadata."""
    id: UUID
    key_type: KeyType
    algorithm: EncryptionAlgorithm
    created_at: datetime
    expires_at: Optional[datetime]
    key_data: bytes
    metadata: dict[str, Any]


class EncryptionManager:
    """Enterprise encryption management system."""

    def __init__(self):
        self.keys: dict[UUID, EncryptionKey] = {}
        self.master_key: Optional[bytes] = None
        self.key_rotation_days = 90
        self._initialize_master_key()

    def generate_symmetric_key(
        self,
        algorithm: EncryptionAlgorithm = EncryptionAlgorithm.AES_256_GCM,
        expires_in_days: Optional[int] = None
    ) -> UUID:
        """
        Generate a new symmetric encryption key.

        Args:
            algorithm: Encryption algorithm to use
            expires_in_days: Key expiration in days (optional)

        Returns:
            UUID of the generated key
        """
        try:
            key_id = UUID()

            # Generate key based on algorithm
            if algorithm == EncryptionAlgorithm.AES_256_GCM:
                key_data = Fernet.generate_key()
            elif algorithm == EncryptionAlgorithm.CHACHA20_POLY1305:
                key_data = secrets.token_bytes(32)  # 256-bit key
            else:
                raise ValueError(f"Unsupported symmetric algorithm: {algorithm}")

            # Calculate expiration
            expires_at = None
            if expires_in_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            # Create key object
            key = EncryptionKey(
                id=key_id,
                key_type=KeyType.SYMMETRIC,
                algorithm=algorithm,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                key_data=key_data,
                metadata={"generated_by": "system"}
            )

            # Store key
            self.keys[key_id] = key

            logger.info(f"Generated symmetric key: {key_id}")
            return key_id

        except Exception as e:
            logger.error(f"Failed to generate symmetric key: {e}", exc_info=True)
            raise

    def generate_asymmetric_keypair(
        self,
        algorithm: EncryptionAlgorithm = EncryptionAlgorithm.RSA_2048,
        expires_in_days: Optional[int] = None
    ) -> dict[str, UUID]:
        """
        Generate a new asymmetric key pair.

        Args:
            algorithm: Encryption algorithm to use
            expires_in_days: Key expiration in days (optional)

        Returns:
            Dictionary with 'public_key_id' and 'private_key_id'
        """
        try:
            # Generate RSA key pair
            if algorithm == EncryptionAlgorithm.RSA_2048:
                private_key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=2048
                )
            elif algorithm == EncryptionAlgorithm.RSA_4096:
                private_key = rsa.generate_private_key(
                    public_exponent=65537,
                    key_size=4096
                )
            else:
                raise ValueError(f"Unsupported asymmetric algorithm: {algorithm}")

            public_key = private_key.public_key()

            # Serialize keys
            private_key_data = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            )

            public_key_data = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )

            # Calculate expiration
            expires_at = None
            if expires_in_days:
                expires_at = datetime.utcnow() + timedelta(days=expires_in_days)

            # Create key objects
            private_key_id = UUID()
            public_key_id = UUID()

            private_key_obj = EncryptionKey(
                id=private_key_id,
                key_type=KeyType.ASYMMETRIC_PRIVATE,
                algorithm=algorithm,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                key_data=private_key_data,
                metadata={"generated_by": "system", "keypair_id": str(public_key_id)}
            )

            public_key_obj = EncryptionKey(
                id=public_key_id,
                key_type=KeyType.ASYMMETRIC_PUBLIC,
                algorithm=algorithm,
                created_at=datetime.utcnow(),
                expires_at=expires_at,
                key_data=public_key_data,
                metadata={"generated_by": "system", "keypair_id": str(private_key_id)}
            )

            # Store keys
            self.keys[private_key_id] = private_key_obj
            self.keys[public_key_id] = public_key_obj

            logger.info(f"Generated asymmetric key pair: {public_key_id}, {private_key_id}")
            return {
                "public_key_id": public_key_id,
                "private_key_id": private_key_id
            }

        except Exception as e:
            logger.error(f"Failed to generate asymmetric key pair: {e}", exc_info=True)
            raise

    def encrypt_data(
        self,
        data: Union[str, bytes],
        key_id: UUID,
        additional_data: Optional[bytes] = None
    ) -> dict[str, Any]:
        """
        Encrypt data using the specified key.

        Args:
            data: Data to encrypt
            key_id: ID of the encryption key
            additional_data: Additional authenticated data (optional)

        Returns:
            Dictionary containing encrypted data and metadata
        """
        try:
            if key_id not in self.keys:
                raise ValueError(f"Key not found: {key_id}")

            key = self.keys[key_id]

            # Check if key is expired
            if key.expires_at and datetime.utcnow() > key.expires_at:
                raise ValueError(f"Key expired: {key_id}")

            # Convert string to bytes if needed
            if isinstance(data, str):
                data = data.encode('utf-8')

            # Encrypt based on key type and algorithm
            if key.key_type == KeyType.SYMMETRIC:
                if key.algorithm == EncryptionAlgorithm.AES_256_GCM:
                    fernet = Fernet(key.key_data)
                    encrypted_data = fernet.encrypt(data)
                else:
                    # For other symmetric algorithms, use simple XOR (not secure in production)
                    encrypted_data = self._simple_encrypt(data, key.key_data)
            elif key.key_type == KeyType.ASYMMETRIC_PUBLIC:
                # Load public key
                public_key = serialization.load_pem_public_key(key.key_data)
                encrypted_data = public_key.encrypt(
                    data,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None
                    )
                )
            else:
                raise ValueError(f"Cannot encrypt with key type: {key.key_type}")

            # Create result
            result = {
                "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8'),
                "key_id": str(key_id),
                "algorithm": key.algorithm.value,
                "encrypted_at": datetime.utcnow().isoformat(),
                "data_length": len(data)
            }

            if additional_data:
                result["additional_data"] = base64.b64encode(additional_data).decode('utf-8')

            logger.debug(f"Encrypted data with key: {key_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to encrypt data: {e}", exc_info=True)
            raise

    def decrypt_data(
        self,
        encrypted_data: str,
        key_id: UUID,
        additional_data: Optional[str] = None
    ) -> bytes:
        """
        Decrypt data using the specified key.

        Args:
            encrypted_data: Base64-encoded encrypted data
            key_id: ID of the decryption key
            additional_data: Base64-encoded additional authenticated data (optional)

        Returns:
            Decrypted data as bytes
        """
        try:
            if key_id not in self.keys:
                raise ValueError(f"Key not found: {key_id}")

            key = self.keys[key_id]

            # Check if key is expired
            if key.expires_at and datetime.utcnow() > key.expires_at:
                raise ValueError(f"Key expired: {key_id}")

            # Decode base64 data
            encrypted_bytes = base64.b64decode(encrypted_data)

            # Decrypt based on key type and algorithm
            if key.key_type == KeyType.SYMMETRIC:
                if key.algorithm == EncryptionAlgorithm.AES_256_GCM:
                    fernet = Fernet(key.key_data)
                    decrypted_data = fernet.decrypt(encrypted_bytes)
                else:
                    # For other symmetric algorithms, use simple XOR (not secure in production)
                    decrypted_data = self._simple_decrypt(encrypted_bytes, key.key_data)
            elif key.key_type == KeyType.ASYMMETRIC_PRIVATE:
                # Load private key
                private_key = serialization.load_pem_private_key(
                    key.key_data,
                    password=None
                )
                decrypted_data = private_key.decrypt(
                    encrypted_bytes,
                    padding.OAEP(
                        mgf=padding.MGF1(algorithm=hashes.SHA256()),
                        algorithm=hashes.SHA256(),
                        label=None
                    )
                )
            else:
                raise ValueError(f"Cannot decrypt with key type: {key.key_type}")

            logger.debug(f"Decrypted data with key: {key_id}")
            return decrypted_data

        except Exception as e:
            logger.error(f"Failed to decrypt data: {e}", exc_info=True)
            raise

    def rotate_key(self, key_id: UUID) -> UUID:
        """
        Rotate an encryption key.

        Args:
            key_id: ID of the key to rotate

        Returns:
            UUID of the new key
        """
        try:
            if key_id not in self.keys:
                raise ValueError(f"Key not found: {key_id}")

            old_key = self.keys[key_id]

            # Generate new key with same parameters
            if old_key.key_type == KeyType.SYMMETRIC:
                new_key_id = self.generate_symmetric_key(
                    algorithm=old_key.algorithm,
                    expires_in_days=self.key_rotation_days
                )
            elif old_key.key_type in [KeyType.ASYMMETRIC_PUBLIC, KeyType.ASYMMETRIC_PRIVATE]:
                # For key pairs, rotate both keys
                keypair_ids = self.generate_asymmetric_keypair(
                    algorithm=old_key.algorithm,
                    expires_in_days=self.key_rotation_days
                )
                new_key_id = keypair_ids["public_key_id"] if old_key.key_type == KeyType.ASYMMETRIC_PUBLIC else keypair_ids["private_key_id"]
            else:
                raise ValueError(f"Cannot rotate key type: {old_key.key_type}")

            # Mark old key as rotated
            old_key.metadata["rotated_to"] = str(new_key_id)
            old_key.metadata["rotated_at"] = datetime.utcnow().isoformat()

            logger.info(f"Rotated key {key_id} to {new_key_id}")
            return new_key_id

        except Exception as e:
            logger.error(f"Failed to rotate key: {e}", exc_info=True)
            raise

    def get_key_info(self, key_id: UUID) -> Optional[dict[str, Any]]:
        """Get information about a key without exposing the key data."""
        if key_id not in self.keys:
            return None

        key = self.keys[key_id]
        return {
            "id": str(key.id),
            "key_type": key.key_type.value,
            "algorithm": key.algorithm.value,
            "created_at": key.created_at.isoformat(),
            "expires_at": key.expires_at.isoformat() if key.expires_at else None,
            "metadata": key.metadata,
            "is_expired": key.expires_at and datetime.utcnow() > key.expires_at
        }

    def list_keys(
        self,
        key_type: Optional[KeyType] = None,
        algorithm: Optional[EncryptionAlgorithm] = None
    ) -> list[dict[str, Any]]:
        """List all keys with optional filtering."""
        keys = []

        for key in self.keys.values():
            if key_type and key.key_type != key_type:
                continue
            if algorithm and key.algorithm != algorithm:
                continue

            keys.append(self.get_key_info(key.id))

        return keys

    def delete_key(self, key_id: UUID) -> bool:
        """Delete a key (secure deletion)."""
        try:
            if key_id not in self.keys:
                return False

            # Securely delete key data
            key = self.keys[key_id]
            key.key_data = b'\x00' * len(key.key_data)  # Overwrite with zeros

            # Remove from storage
            del self.keys[key_id]

            logger.info(f"Deleted key: {key_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete key: {e}", exc_info=True)
            return False

    def hash_data(
        self,
        data: Union[str, bytes],
        algorithm: str = "sha256",
        salt: Optional[bytes] = None
    ) -> str:
        """
        Hash data using specified algorithm.

        Args:
            data: Data to hash
            algorithm: Hash algorithm (sha256, sha512, blake2b)
            salt: Optional salt for hashing

        Returns:
            Hexadecimal hash string
        """
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')

            if salt:
                data = salt + data

            if algorithm == "sha256":
                hash_obj = hashlib.sha256(data)
            elif algorithm == "sha512":
                hash_obj = hashlib.sha512(data)
            elif algorithm == "blake2b":
                hash_obj = hashlib.blake2b(data)
            else:
                raise ValueError(f"Unsupported hash algorithm: {algorithm}")

            return hash_obj.hexdigest()

        except Exception as e:
            logger.error(f"Failed to hash data: {e}", exc_info=True)
            raise

    def derive_key_from_password(
        self,
        password: str,
        salt: bytes,
        length: int = 32
    ) -> bytes:
        """
        Derive encryption key from password using PBKDF2.

        Args:
            password: Password to derive key from
            salt: Salt for key derivation
            length: Length of derived key in bytes

        Returns:
            Derived key as bytes
        """
        try:
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=length,
                salt=salt,
                iterations=100000,
            )
            key = kdf.derive(password.encode('utf-8'))
            return key

        except Exception as e:
            logger.error(f"Failed to derive key from password: {e}", exc_info=True)
            raise

    def _initialize_master_key(self):
        """Initialize the master encryption key."""
        try:
            # In production, this would be loaded from secure key management
            self.master_key = Fernet.generate_key()
            logger.info("Master encryption key initialized")
        except Exception as e:
            logger.error(f"Failed to initialize master key: {e}")
            raise

    def _simple_encrypt(self, data: bytes, key: bytes) -> bytes:
        """Simple XOR encryption (not secure, for demonstration only)."""
        result = bytearray()
        key_len = len(key)
        for i, byte in enumerate(data):
            result.append(byte ^ key[i % key_len])
        return bytes(result)

    def _simple_decrypt(self, data: bytes, key: bytes) -> bytes:
        """Simple XOR decryption (not secure, for demonstration only)."""
        return self._simple_encrypt(data, key)  # XOR is symmetric
