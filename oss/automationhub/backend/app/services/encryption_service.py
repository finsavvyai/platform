"""
Data Encryption Service for AES-256 encryption and field-level encryption
"""

import os
import base64
import hashlib
import secrets
from typing import Optional, Dict, Any, Union, List
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import logging
import json
from datetime import datetime

from app.services.vault_service import vault_service

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Encryption operation error"""
    pass


class DecryptionError(Exception):
    """Decryption operation error"""
    pass


class EncryptionService:
    """AES-256 encryption service for sensitive data"""
    
    def __init__(self):
        self.backend = default_backend()
        self.key_cache = {}
        self.key_rotation_interval = 86400 * 30  # 30 days
        
        # Initialize master key
        self.master_key = None
        self._initialize_master_key()
    
    def _initialize_master_key(self) -> None:
        """Initialize master encryption key"""
        try:
            # Try to get master key from Vault
            if vault_service:
                master_key = asyncio.run(vault_service.get_encryption_key("master_key"))
                if master_key:
                    self.master_key = master_key.encode() if isinstance(master_key, str) else master_key
                    logger.info("Master key loaded from Vault")
                    return
            
            # Fall back to environment variable
            env_key = os.getenv("ENCRYPTION_MASTER_KEY")
            if env_key:
                self.master_key = env_key.encode()
                logger.info("Master key loaded from environment")
                return
            
            # Generate new key if none exists (development only)
            if os.getenv("ENVIRONMENT") == "development":
                self.master_key = Fernet.generate_key()
                logger.warning("Generated new master key for development")
            else:
                raise EncryptionError("No master key found in production environment")
                
        except Exception as e:
            logger.error(f"Failed to initialize master key: {e}")
            raise EncryptionError(f"Master key initialization failed: {e}")
    
    def _derive_key(self, password: bytes, salt: bytes) -> bytes:
        """Derive encryption key from password and salt using PBKDF2"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,  # 256 bits
            salt=salt,
            iterations=100000,  # OWASP recommended minimum
            backend=self.backend
        )
        return kdf.derive(password)
    
    def generate_key(self) -> str:
        """Generate a new Fernet encryption key"""
        return Fernet.generate_key().decode()
    
    def encrypt_data(self, data: Union[str, bytes], key: Optional[str] = None) -> str:
        """Encrypt data using AES-256 (Fernet)"""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            # Use provided key or master key
            encryption_key = key.encode() if key else self.master_key
            
            if not encryption_key:
                raise EncryptionError("No encryption key available")
            
            # Create Fernet instance
            fernet = Fernet(encryption_key)
            
            # Encrypt data
            encrypted_data = fernet.encrypt(data)
            
            # Return base64 encoded string
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise EncryptionError(f"Encryption failed: {e}")
    
    def decrypt_data(self, encrypted_data: str, key: Optional[str] = None) -> str:
        """Decrypt data using AES-256 (Fernet)"""
        try:
            # Use provided key or master key
            decryption_key = key.encode() if key else self.master_key
            
            if not decryption_key:
                raise DecryptionError("No decryption key available")
            
            # Create Fernet instance
            fernet = Fernet(decryption_key)
            
            # Decode base64 and decrypt
            encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
            decrypted_data = fernet.decrypt(encrypted_bytes)
            
            return decrypted_data.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise DecryptionError(f"Decryption failed: {e}")
    
    def encrypt_file(self, file_path: str, output_path: Optional[str] = None, key: Optional[str] = None) -> str:
        """Encrypt a file"""
        try:
            if not os.path.exists(file_path):
                raise EncryptionError(f"File not found: {file_path}")
            
            # Read file data
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # Encrypt data
            encrypted_data = self.encrypt_data(file_data, key)
            
            # Determine output path
            if not output_path:
                output_path = f"{file_path}.encrypted"
            
            # Write encrypted data
            with open(output_path, 'w') as f:
                f.write(encrypted_data)
            
            logger.info(f"File encrypted: {file_path} -> {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"File encryption failed: {e}")
            raise EncryptionError(f"File encryption failed: {e}")
    
    def decrypt_file(self, encrypted_file_path: str, output_path: Optional[str] = None, key: Optional[str] = None) -> str:
        """Decrypt a file"""
        try:
            if not os.path.exists(encrypted_file_path):
                raise DecryptionError(f"Encrypted file not found: {encrypted_file_path}")
            
            # Read encrypted data
            with open(encrypted_file_path, 'r') as f:
                encrypted_data = f.read()
            
            # Decrypt data
            decrypted_data = self.decrypt_data(encrypted_data, key)
            
            # Determine output path
            if not output_path:
                output_path = encrypted_file_path.replace('.encrypted', '')
            
            # Write decrypted data
            with open(output_path, 'wb') as f:
                f.write(decrypted_data.encode('utf-8') if isinstance(decrypted_data, str) else decrypted_data)
            
            logger.info(f"File decrypted: {encrypted_file_path} -> {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"File decryption failed: {e}")
            raise DecryptionError(f"File decryption failed: {e}")
    
    def encrypt_json(self, data: Dict[str, Any], key: Optional[str] = None) -> str:
        """Encrypt JSON data"""
        try:
            json_string = json.dumps(data, separators=(',', ':'))
            return self.encrypt_data(json_string, key)
        except Exception as e:
            raise EncryptionError(f"JSON encryption failed: {e}")
    
    def decrypt_json(self, encrypted_data: str, key: Optional[str] = None) -> Dict[str, Any]:
        """Decrypt JSON data"""
        try:
            decrypted_string = self.decrypt_data(encrypted_data, key)
            return json.loads(decrypted_string)
        except Exception as e:
            raise DecryptionError(f"JSON decryption failed: {e}")
    
    def hash_data(self, data: Union[str, bytes], algorithm: str = "sha256") -> str:
        """Hash data using specified algorithm"""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            if algorithm == "sha256":
                hash_obj = hashlib.sha256(data)
            elif algorithm == "sha512":
                hash_obj = hashlib.sha512(data)
            elif algorithm == "md5":
                hash_obj = hashlib.md5(data)
            else:
                raise ValueError(f"Unsupported hash algorithm: {algorithm}")
            
            return hash_obj.hexdigest()
            
        except Exception as e:
            logger.error(f"Hashing failed: {e}")
            raise EncryptionError(f"Hashing failed: {e}")
    
    def generate_salt(self, length: int = 32) -> str:
        """Generate cryptographically secure salt"""
        return base64.b64encode(os.urandom(length)).decode('utf-8')
    
    def encrypt_with_password(self, data: Union[str, bytes], password: str) -> Dict[str, str]:
        """Encrypt data with password-derived key"""
        try:
            if isinstance(data, str):
                data = data.encode('utf-8')
            
            # Generate salt
            salt = os.urandom(16)
            
            # Derive key from password
            key = self._derive_key(password.encode(), salt)
            
            # Generate IV
            iv = os.urandom(16)
            
            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=self.backend
            )
            
            # Pad data to block size
            block_size = 16
            padding_length = block_size - (len(data) % block_size)
            padded_data = data + bytes([padding_length] * padding_length)
            
            # Encrypt
            encryptor = cipher.encryptor()
            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
            
            return {
                'encrypted_data': base64.b64encode(encrypted_data).decode('utf-8'),
                'salt': base64.b64encode(salt).decode('utf-8'),
                'iv': base64.b64encode(iv).decode('utf-8')
            }
            
        except Exception as e:
            logger.error(f"Password-based encryption failed: {e}")
            raise EncryptionError(f"Password-based encryption failed: {e}")
    
    def decrypt_with_password(self, encrypted_package: Dict[str, str], password: str) -> str:
        """Decrypt data with password-derived key"""
        try:
            # Extract components
            encrypted_data = base64.b64decode(encrypted_package['encrypted_data'])
            salt = base64.b64decode(encrypted_package['salt'])
            iv = base64.b64decode(encrypted_package['iv'])
            
            # Derive key from password
            key = self._derive_key(password.encode(), salt)
            
            # Create cipher
            cipher = Cipher(
                algorithms.AES(key),
                modes.CBC(iv),
                backend=self.backend
            )
            
            # Decrypt
            decryptor = cipher.decryptor()
            padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
            
            # Remove padding
            padding_length = padded_data[-1]
            data = padded_data[:-padding_length]
            
            return data.decode('utf-8')
            
        except Exception as e:
            logger.error(f"Password-based decryption failed: {e}")
            raise DecryptionError(f"Password-based decryption failed: {e}")


class FieldEncryption:
    """Field-level encryption for database columns"""
    
    def __init__(self, encryption_service: EncryptionService):
        self.encryption_service = encryption_service
        
        # Define fields that should be encrypted
        self.encrypted_fields = {
            'users': ['hashed_password', 'preferences'],
            'documents': ['content', 'metadata'],
            'workflows': ['configuration', 'secrets'],
            'agents': ['configuration', 'api_keys'],
            'oauth_providers': ['client_secret'],
            'security_events': ['details']
        }
    
    def should_encrypt_field(self, table_name: str, field_name: str) -> bool:
        """Check if field should be encrypted"""
        table_fields = self.encrypted_fields.get(table_name, [])
        return field_name in table_fields
    
    def encrypt_field_value(self, table_name: str, field_name: str, value: Any) -> Any:
        """Encrypt field value if it should be encrypted"""
        if not self.should_encrypt_field(table_name, field_name):
            return value
        
        if value is None:
            return None
        
        try:
            # Convert to string if needed
            if isinstance(value, dict):
                value = json.dumps(value)
            elif not isinstance(value, str):
                value = str(value)
            
            # Encrypt the value
            encrypted_value = self.encryption_service.encrypt_data(value)
            
            # Add encryption marker
            return f"ENC:{encrypted_value}"
            
        except Exception as e:
            logger.error(f"Field encryption failed for {table_name}.{field_name}: {e}")
            return value
    
    def decrypt_field_value(self, table_name: str, field_name: str, value: Any) -> Any:
        """Decrypt field value if it's encrypted"""
        if not isinstance(value, str) or not value.startswith("ENC:"):
            return value
        
        try:
            # Remove encryption marker and decrypt
            encrypted_value = value[4:]  # Remove "ENC:" prefix
            decrypted_value = self.encryption_service.decrypt_data(encrypted_value)
            
            # Try to parse as JSON if it looks like JSON
            if decrypted_value.startswith('{') or decrypted_value.startswith('['):
                try:
                    return json.loads(decrypted_value)
                except json.JSONDecodeError:
                    pass
            
            return decrypted_value
            
        except Exception as e:
            logger.error(f"Field decryption failed for {table_name}.{field_name}: {e}")
            return value
    
    def encrypt_model_fields(self, model_instance: Any) -> None:
        """Encrypt fields in a SQLAlchemy model instance"""
        table_name = model_instance.__tablename__
        
        for field_name in self.encrypted_fields.get(table_name, []):
            if hasattr(model_instance, field_name):
                current_value = getattr(model_instance, field_name)
                encrypted_value = self.encrypt_field_value(table_name, field_name, current_value)
                setattr(model_instance, field_name, encrypted_value)
    
    def decrypt_model_fields(self, model_instance: Any) -> None:
        """Decrypt fields in a SQLAlchemy model instance"""
        table_name = model_instance.__tablename__
        
        for field_name in self.encrypted_fields.get(table_name, []):
            if hasattr(model_instance, field_name):
                current_value = getattr(model_instance, field_name)
                decrypted_value = self.decrypt_field_value(table_name, field_name, current_value)
                setattr(model_instance, field_name, decrypted_value)


class FileEncryption:
    """File encryption and virus scanning service"""
    
    def __init__(self, encryption_service: EncryptionService):
        self.encryption_service = encryption_service
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.allowed_extensions = {
            '.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
            '.ppt', '.pptx', '.csv', '.json', '.xml', '.yaml', '.yml'
        }
        self.quarantine_dir = "quarantine"
        
        # Ensure quarantine directory exists
        os.makedirs(self.quarantine_dir, exist_ok=True)
    
    def validate_file(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        """Validate uploaded file for security"""
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'file_info': {}
        }
        
        try:
            # Check file size
            file_size = os.path.getsize(file_path)
            validation_result['file_info']['size'] = file_size
            
            if file_size > self.max_file_size:
                validation_result['valid'] = False
                validation_result['errors'].append(f"File too large: {file_size} bytes (max: {self.max_file_size})")
            
            # Check file extension
            file_ext = os.path.splitext(original_filename)[1].lower()
            validation_result['file_info']['extension'] = file_ext
            
            if file_ext not in self.allowed_extensions:
                validation_result['valid'] = False
                validation_result['errors'].append(f"File type not allowed: {file_ext}")
            
            # Check for suspicious content
            suspicious_patterns = [
                b'<script',
                b'javascript:',
                b'vbscript:',
                b'<?php',
                b'<%',
                b'exec(',
                b'system(',
                b'shell_exec('
            ]
            
            with open(file_path, 'rb') as f:
                file_content = f.read(1024)  # Read first 1KB
                
                for pattern in suspicious_patterns:
                    if pattern in file_content.lower():
                        validation_result['valid'] = False
                        validation_result['errors'].append("Suspicious content detected")
                        break
            
            # Basic virus signature check (simplified)
            virus_signatures = [
                b'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',  # EICAR test
            ]
            
            with open(file_path, 'rb') as f:
                file_content = f.read()
                
                for signature in virus_signatures:
                    if signature in file_content:
                        validation_result['valid'] = False
                        validation_result['errors'].append("Virus signature detected")
                        
                        # Move to quarantine
                        quarantine_path = os.path.join(
                            self.quarantine_dir, 
                            f"quarantine_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{original_filename}"
                        )
                        os.rename(file_path, quarantine_path)
                        validation_result['quarantined'] = quarantine_path
                        break
            
            return validation_result
            
        except Exception as e:
            logger.error(f"File validation failed: {e}")
            validation_result['valid'] = False
            validation_result['errors'].append(f"Validation error: {e}")
            return validation_result
    
    def encrypt_uploaded_file(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        """Encrypt uploaded file after validation"""
        try:
            # Validate file first
            validation_result = self.validate_file(file_path, original_filename)
            
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': 'File validation failed',
                    'validation_result': validation_result
                }
            
            # Generate unique encryption key for this file
            file_key = self.encryption_service.generate_key()
            
            # Encrypt file
            encrypted_path = self.encryption_service.encrypt_file(file_path, key=file_key)
            
            # Calculate file hash for integrity
            file_hash = self.encryption_service.hash_data(open(file_path, 'rb').read())
            
            # Remove original file
            os.remove(file_path)
            
            return {
                'success': True,
                'encrypted_path': encrypted_path,
                'encryption_key': file_key,
                'file_hash': file_hash,
                'file_info': validation_result['file_info']
            }
            
        except Exception as e:
            logger.error(f"File encryption failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def decrypt_file_for_download(self, encrypted_path: str, encryption_key: str) -> str:
        """Decrypt file for download"""
        try:
            # Create temporary file for decrypted content
            temp_path = f"{encrypted_path}.temp"
            
            # Decrypt file
            decrypted_path = self.encryption_service.decrypt_file(
                encrypted_path, 
                temp_path, 
                encryption_key
            )
            
            return decrypted_path
            
        except Exception as e:
            logger.error(f"File decryption for download failed: {e}")
            raise DecryptionError(f"File decryption failed: {e}")


# Global encryption service instances
encryption_service = EncryptionService()
field_encryption = FieldEncryption(encryption_service)
file_encryption = FileEncryption(encryption_service)


# Utility functions
def encrypt_sensitive_data(data: Union[str, Dict[str, Any]], key: Optional[str] = None) -> str:
    """Utility function to encrypt sensitive data"""
    if isinstance(data, dict):
        return encryption_service.encrypt_json(data, key)
    else:
        return encryption_service.encrypt_data(str(data), key)


def decrypt_sensitive_data(encrypted_data: str, key: Optional[str] = None, as_json: bool = False) -> Union[str, Dict[str, Any]]:
    """Utility function to decrypt sensitive data"""
    if as_json:
        return encryption_service.decrypt_json(encrypted_data, key)
    else:
        return encryption_service.decrypt_data(encrypted_data, key)


def hash_password(password: str) -> str:
    """Hash password with salt"""
    salt = encryption_service.generate_salt()
    password_hash = encryption_service.hash_data(password + salt)
    return f"{salt}:{password_hash}"


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        salt, stored_hash = hashed_password.split(':', 1)
        password_hash = encryption_service.hash_data(password + salt)
        return password_hash == stored_hash
    except Exception:
        return False