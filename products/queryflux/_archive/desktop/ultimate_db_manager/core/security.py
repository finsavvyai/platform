"""
Security utilities for Ultimate Database Manager
Handles authentication, credential management, and security policies with macOS Keychain integration
"""

import os
import sys
import keyring
import hashlib
import platform
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from pathlib import Path
import json
import base64
import logging

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from passlib.context import CryptContext
from jose import jwt, JWTError

# macOS specific imports
if platform.system() == "Darwin":
    try:
        import subprocess
        import plistlib
        MACOS_AVAILABLE = True
    except ImportError:
        MACOS_AVAILABLE = False
else:
    MACOS_AVAILABLE = False

# Security constants
SERVICE_NAME = "ultimate_db_manager"
SECRET_KEY = os.environ.get("UDB_SECRET_KEY", "your-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Password encryption context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Logger
logger = logging.getLogger(__name__)

@dataclass
class DatabaseCredentials:
    """Secure database credentials"""
    host: str
    port: int
    username: str
    password: str
    database: Optional[str] = None
    ssl: bool = False
    ssl_cert: Optional[str] = None
    ssl_key: Optional[str] = None
    ssl_ca: Optional[str] = None
    additional_params: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> 'DatabaseCredentials':
        """Create credentials from dictionary"""
        return cls(
            host=data['host'],
            port=int(data['port']),
            username=data['username'],
            password=data['password'],
            database=data.get('database'),
            ssl=data.get('ssl', False),
            ssl_cert=data.get('ssl_cert'),
            ssl_key=data.get('ssl_key'),
            ssl_ca=data.get('ssl_ca'),
            additional_params=data.get('additional_params', {})
        )

    def to_dict(self, include_password: bool = False) -> dict:
        """Convert to dictionary"""
        result = {
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'database': self.database,
            'ssl': self.ssl,
            'ssl_cert': self.ssl_cert,
            'ssl_key': self.ssl_key,
            'ssl_ca': self.ssl_ca,
            'additional_params': self.additional_params
        }
        
        if include_password:
            result['password'] = self.password
            
        return result

    def to_connection_string(self, db_type: str = "postgresql") -> str:
        """Convert to connection string format"""
        if db_type.lower() == "postgresql":
            conn_str = f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}"
            if self.database:
                conn_str += f"/{self.database}"
        elif db_type.lower() == "mysql":
            conn_str = f"mysql://{self.username}:{self.password}@{self.host}:{self.port}"
            if self.database:
                conn_str += f"/{self.database}"
        else:
            # Generic format
            conn_str = f"{db_type}://{self.username}:{self.password}@{self.host}:{self.port}"
            if self.database:
                conn_str += f"/{self.database}"
        
        return conn_str


@dataclass
class SecureCredentialEntry:
    """Secure credential entry with metadata"""
    profile_id: str
    profile_name: str
    credentials: DatabaseCredentials
    created_at: datetime
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    encrypted: bool = True
    keychain_stored: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def update_access(self):
        """Update access statistics"""
        self.last_accessed = datetime.now()
        self.access_count += 1

class MacOSKeychainManager:
    """macOS Keychain integration for secure credential storage"""
    
    def __init__(self, service_name: str = SERVICE_NAME):
        self.service_name = service_name
        self.keychain_available = MACOS_AVAILABLE and platform.system() == "Darwin"
        
        if not self.keychain_available:
            logger.warning("macOS Keychain not available on this platform")

    def store_password(self, account: str, password: str, label: Optional[str] = None) -> bool:
        """Store password in macOS Keychain"""
        if not self.keychain_available:
            return False
        
        try:
            # Use security command to store password
            cmd = [
                'security', 'add-generic-password',
                '-s', self.service_name,
                '-a', account,
                '-w', password,
                '-U'  # Update if exists
            ]
            
            if label:
                cmd.extend(['-l', label])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.debug(f"Successfully stored password for account {account}")
                return True
            else:
                logger.error(f"Failed to store password: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error storing password in Keychain: {e}")
            return False

    def get_password(self, account: str) -> Optional[str]:
        """Retrieve password from macOS Keychain"""
        if not self.keychain_available:
            return None
        
        try:
            cmd = [
                'security', 'find-generic-password',
                '-s', self.service_name,
                '-a', account,
                '-w'  # Return password only
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                password = result.stdout.strip()
                logger.debug(f"Successfully retrieved password for account {account}")
                return password
            else:
                logger.debug(f"Password not found for account {account}")
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving password from Keychain: {e}")
            return None

    def delete_password(self, account: str) -> bool:
        """Delete password from macOS Keychain"""
        if not self.keychain_available:
            return False
        
        try:
            cmd = [
                'security', 'delete-generic-password',
                '-s', self.service_name,
                '-a', account
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.debug(f"Successfully deleted password for account {account}")
                return True
            else:
                logger.debug(f"Password not found or already deleted for account {account}")
                return True  # Consider it success if already deleted
                
        except Exception as e:
            logger.error(f"Error deleting password from Keychain: {e}")
            return False

    def list_accounts(self) -> List[str]:
        """List all accounts stored in Keychain for this service"""
        if not self.keychain_available:
            return []
        
        try:
            cmd = [
                'security', 'dump-keychain',
                '-d'  # Include data
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                return []
            
            # Parse output to find our service entries
            accounts = []
            lines = result.stderr.split('\n')  # security outputs to stderr
            
            current_service = None
            current_account = None
            
            for line in lines:
                line = line.strip()
                if f'"svce"<blob>="{self.service_name}"' in line:
                    current_service = self.service_name
                elif current_service == self.service_name and '"acct"<blob>=' in line:
                    # Extract account name
                    start = line.find('"acct"<blob>="') + len('"acct"<blob>="')
                    end = line.find('"', start)
                    if start > 0 and end > start:
                        account = line[start:end]
                        accounts.append(account)
                        current_service = None  # Reset for next entry
            
            return accounts
            
        except Exception as e:
            logger.error(f"Error listing Keychain accounts: {e}")
            return []

    def store_certificate(self, name: str, cert_data: bytes, cert_type: str = "x509") -> bool:
        """Store certificate in macOS Keychain"""
        if not self.keychain_available:
            return False
        
        try:
            # Create temporary file for certificate
            import tempfile
            with tempfile.NamedTemporaryFile(mode='wb', suffix='.crt', delete=False) as temp_file:
                temp_file.write(cert_data)
                temp_path = temp_file.name
            
            try:
                cmd = [
                    'security', 'add-certificates',
                    '-k', 'login.keychain',  # Add to login keychain
                    temp_path
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                
                if result.returncode == 0:
                    logger.debug(f"Successfully stored certificate {name}")
                    return True
                else:
                    logger.error(f"Failed to store certificate: {result.stderr}")
                    return False
                    
            finally:
                # Clean up temporary file
                os.unlink(temp_path)
                
        except Exception as e:
            logger.error(f"Error storing certificate in Keychain: {e}")
            return False

    def is_available(self) -> bool:
        """Check if macOS Keychain is available"""
        return self.keychain_available


class SecureCredentialManager:
    """Enhanced credential manager with macOS Keychain integration"""

    def __init__(self, service_name: str = SERVICE_NAME, use_keychain: bool = True):
        self.service_name = service_name
        self.use_keychain = use_keychain and MACOS_AVAILABLE
        
        # Initialize storage backends
        self.keychain_manager = MacOSKeychainManager(service_name) if self.use_keychain else None
        self.fallback_keyring = keyring
        
        # Credential cache
        self._credential_cache: Dict[str, SecureCredentialEntry] = {}
        self._encryption_key = self._get_or_create_encryption_key()

    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for local storage"""
        key_file = self._get_config_dir() / "encryption.key"
        
        if key_file.exists():
            try:
                with open(key_file, 'rb') as f:
                    return f.read()
            except Exception as e:
                logger.warning(f"Failed to read encryption key: {e}")
        
        # Generate new key
        key = Fernet.generate_key()
        
        try:
            with open(key_file, 'wb', opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
                f.write(key)
            logger.info("Generated new encryption key")
        except Exception as e:
            logger.error(f"Failed to save encryption key: {e}")
        
        return key

    def store_credentials(self, profile_id: str, profile_name: str, 
                         credentials: DatabaseCredentials) -> bool:
        """Store credentials securely"""
        try:
            account_key = f"{profile_id}_credentials"
            
            # Try to store in macOS Keychain first
            keychain_stored = False
            if self.keychain_manager and self.keychain_manager.is_available():
                keychain_stored = self.keychain_manager.store_password(
                    account=account_key,
                    password=credentials.password,
                    label=f"Database Password - {profile_name}"
                )
                
                # Store SSL certificates if present
                if credentials.ssl_cert:
                    cert_data = credentials.ssl_cert.encode('utf-8')
                    self.keychain_manager.store_certificate(
                        f"{profile_id}_ssl_cert", cert_data
                    )
            
            # Fallback to system keyring if Keychain fails
            if not keychain_stored:
                try:
                    self.fallback_keyring.set_password(
                        self.service_name,
                        account_key,
                        credentials.password
                    )
                    logger.debug(f"Stored credentials in system keyring for {profile_id}")
                except Exception as e:
                    logger.warning(f"Failed to store in system keyring: {e}")
                    # Continue with local encrypted storage
            
            # Store non-sensitive data locally (encrypted)
            config_data = credentials.to_dict(include_password=False)
            self._store_encrypted_config(profile_id, config_data)
            
            # Update cache
            entry = SecureCredentialEntry(
                profile_id=profile_id,
                profile_name=profile_name,
                credentials=credentials,
                created_at=datetime.now(),
                keychain_stored=keychain_stored
            )
            self._credential_cache[profile_id] = entry
            
            logger.info(f"Successfully stored credentials for profile {profile_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store credentials for {profile_name}: {e}")
            raise SecurityError(f"Failed to store credentials: {str(e)}")

    def get_credentials(self, profile_id: str) -> Optional[DatabaseCredentials]:
        """Retrieve credentials from secure storage"""
        try:
            # Check cache first
            if profile_id in self._credential_cache:
                entry = self._credential_cache[profile_id]
                entry.update_access()
                return entry.credentials
            
            account_key = f"{profile_id}_credentials"
            password = None
            
            # Try macOS Keychain first
            if self.keychain_manager and self.keychain_manager.is_available():
                password = self.keychain_manager.get_password(account_key)
            
            # Fallback to system keyring
            if not password:
                try:
                    password = self.fallback_keyring.get_password(
                        self.service_name,
                        account_key
                    )
                except Exception as e:
                    logger.debug(f"Failed to get password from system keyring: {e}")
            
            if not password:
                logger.debug(f"No password found for profile {profile_id}")
                return None
            
            # Get config data
            config_data = self._get_encrypted_config(profile_id)
            if not config_data:
                logger.debug(f"No config data found for profile {profile_id}")
                return None
            
            # Combine and create credentials
            config_data['password'] = password
            credentials = DatabaseCredentials.from_dict(config_data)
            
            # Update cache
            entry = SecureCredentialEntry(
                profile_id=profile_id,
                profile_name=config_data.get('profile_name', 'Unknown'),
                credentials=credentials,
                created_at=datetime.now()
            )
            entry.update_access()
            self._credential_cache[profile_id] = entry
            
            return credentials
            
        except Exception as e:
            logger.error(f"Failed to retrieve credentials for {profile_id}: {e}")
            raise SecurityError(f"Failed to retrieve credentials: {str(e)}")

    def delete_credentials(self, profile_id: str) -> bool:
        """Delete stored credentials"""
        try:
            account_key = f"{profile_id}_credentials"
            success = True
            
            # Delete from macOS Keychain
            if self.keychain_manager and self.keychain_manager.is_available():
                if not self.keychain_manager.delete_password(account_key):
                    success = False
            
            # Delete from system keyring
            try:
                self.fallback_keyring.delete_password(
                    self.service_name,
                    account_key
                )
            except Exception as e:
                logger.debug(f"Failed to delete from system keyring: {e}")
            
            # Delete local config
            self._delete_encrypted_config(profile_id)
            
            # Remove from cache
            if profile_id in self._credential_cache:
                del self._credential_cache[profile_id]
            
            logger.info(f"Deleted credentials for profile {profile_id}")
            return success
            
        except Exception as e:
            logger.error(f"Failed to delete credentials for {profile_id}: {e}")
            return False

    def list_stored_profiles(self) -> List[str]:
        """List all profiles with stored credentials"""
        profiles = set()
        
        # Check macOS Keychain
        if self.keychain_manager and self.keychain_manager.is_available():
            accounts = self.keychain_manager.list_accounts()
            for account in accounts:
                if account.endswith('_credentials'):
                    profile_id = account[:-len('_credentials')]
                    profiles.add(profile_id)
        
        # Check local config files
        config_dir = self._get_config_dir()
        if config_dir.exists():
            for file_path in config_dir.glob("*.enc"):
                profile_id = file_path.stem
                profiles.add(profile_id)
        
        return list(profiles)

    def get_credential_stats(self) -> Dict[str, Any]:
        """Get credential storage statistics"""
        stats = {
            'total_profiles': len(self.list_stored_profiles()),
            'keychain_available': self.keychain_manager.is_available() if self.keychain_manager else False,
            'cache_size': len(self._credential_cache),
            'storage_backends': []
        }
        
        if self.keychain_manager and self.keychain_manager.is_available():
            stats['storage_backends'].append('macOS Keychain')
        
        stats['storage_backends'].append('System Keyring')
        stats['storage_backends'].append('Local Encrypted Storage')
        
        return stats

    def clear_cache(self):
        """Clear credential cache"""
        self._credential_cache.clear()
        logger.info("Cleared credential cache")

    def _get_config_dir(self) -> Path:
        """Get secure config directory"""
        config_dir = Path.home() / f".{self.service_name}" / "credentials"
        config_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
        return config_dir

    def _store_encrypted_config(self, profile_id: str, config_data: dict) -> None:
        """Store encrypted config data locally"""
        config_dir = self._get_config_dir()
        config_file = config_dir / f"{profile_id}.enc"
        
        try:
            # Encrypt data
            fernet = Fernet(self._encryption_key)
            json_data = json.dumps(config_data).encode('utf-8')
            encrypted_data = fernet.encrypt(json_data)
            
            # Write to file with restricted permissions
            with open(config_file, 'wb', opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
                f.write(encrypted_data)
                
        except Exception as e:
            logger.error(f"Failed to store encrypted config for {profile_id}: {e}")
            raise

    def _get_encrypted_config(self, profile_id: str) -> Optional[dict]:
        """Get encrypted config data from local storage"""
        config_dir = self._get_config_dir()
        config_file = config_dir / f"{profile_id}.enc"
        
        if not config_file.exists():
            return None
        
        try:
            # Read and decrypt data
            with open(config_file, 'rb') as f:
                encrypted_data = f.read()
            
            fernet = Fernet(self._encryption_key)
            json_data = fernet.decrypt(encrypted_data)
            
            return json.loads(json_data.decode('utf-8'))
            
        except Exception as e:
            logger.error(f"Failed to read encrypted config for {profile_id}: {e}")
            return None

    def _delete_encrypted_config(self, profile_id: str) -> None:
        """Delete encrypted config file"""
        config_dir = self._get_config_dir()
        config_file = config_dir / f"{profile_id}.enc"
        
        if config_file.exists():
            try:
                config_file.unlink()
            except Exception as e:
                logger.error(f"Failed to delete config file for {profile_id}: {e}")

class AuthenticationManager:
    """Handles user authentication and JWT tokens"""

    def __init__(self, secret_key: str = SECRET_KEY):
        self.secret_key = secret_key

    def create_access_token(self, user_id: str, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        if expires_delta is None:
            expires_delta = timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

        expire = datetime.utcnow() + expires_delta
        payload = {
            "sub": user_id,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }

        return jwt.encode(payload, self.secret_key, algorithm=ALGORITHM)

    def verify_token(self, token: str) -> Optional[str]:
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            token_type = payload.get("type")

            if user_id is None or token_type != "access":
                return None

            return user_id

        except JWTError:
            return None

    def hash_password(self, password: str) -> str:
        """Hash password securely"""
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)

class SQLInjectionPrevention:
    """Utilities for preventing SQL injection attacks"""

    DANGEROUS_KEYWORDS = {
        'drop', 'delete', 'insert', 'update', 'alter', 'create',
        'truncate', 'exec', 'execute', 'sp_', 'xp_'
    }

    @staticmethod
    def validate_identifier(identifier: str) -> bool:
        """Validate database identifier (table name, column name, etc.)"""
        if not identifier:
            return False

        # Check length
        if len(identifier) > 63:  # PostgreSQL limit
            return False

        # Check characters (alphanumeric, underscore, no spaces)
        if not identifier.replace('_', '').isalnum():
            return False

        # Check first character is not numeric
        if identifier[0].isdigit():
            return False

        # Check for dangerous keywords (basic check)
        if identifier.lower() in SQLInjectionPrevention.DANGEROUS_KEYWORDS:
            return False

        return True

    @staticmethod
    def sanitize_identifier(identifier: str) -> str:
        """Sanitize database identifier"""
        if not SQLInjectionPrevention.validate_identifier(identifier):
            raise SecurityError(f"Invalid database identifier: {identifier}")
        return identifier

    @staticmethod
    def validate_query_type(query: str, allowed_types: set[str]) -> bool:
        """Validate that query is of allowed type"""
        query_lower = query.strip().lower()

        for allowed_type in allowed_types:
            if query_lower.startswith(allowed_type.lower()):
                return True
        return False

class SecurityError(Exception):
    """Custom security exception"""
    pass

class InputValidator:
    """Input validation utilities"""

    @staticmethod
    def validate_port(port: Any) -> int:
        """Validate port number"""
        try:
            port_int = int(port)
            if 1 <= port_int <= 65535:
                return port_int
            else:
                raise SecurityError(f"Port must be between 1 and 65535, got {port}")
        except (ValueError, TypeError):
            raise SecurityError(f"Invalid port number: {port}")

    @staticmethod
    def validate_host(host: str) -> str:
        """Basic host validation"""
        if not host or len(host) > 255:
            raise SecurityError("Invalid host")
        return host.strip()

    @staticmethod
    def validate_connection_params(params: dict) -> dict:
        """Validate connection parameters"""
        validated = {}

        # Required fields
        validated['host'] = InputValidator.validate_host(params.get('host', ''))
        validated['port'] = InputValidator.validate_port(params.get('port', 5432))
        validated['username'] = params.get('username', '').strip()

        if not validated['username']:
            raise SecurityError("Username is required")

        # Optional fields
        validated['database'] = params.get('database', '').strip() or None
        validated['ssl'] = bool(params.get('ssl', False))

        return validated

class BiometricAuthManager:
    """Biometric authentication manager for macOS Touch ID/Face ID"""
    
    def __init__(self):
        self.available = MACOS_AVAILABLE and self._check_biometric_availability()
    
    def _check_biometric_availability(self) -> bool:
        """Check if biometric authentication is available"""
        if not MACOS_AVAILABLE:
            return False
        
        try:
            # Check if Touch ID or Face ID is available
            cmd = ['bioutil', '-r']  # Check biometric availability
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0
        except Exception:
            return False
    
    def authenticate(self, reason: str = "Access database credentials") -> bool:
        """Perform biometric authentication"""
        if not self.available:
            return False
        
        try:
            # Use AppleScript to trigger Touch ID/Face ID
            script = f'''
            tell application "System Events"
                display dialog "{reason}" with title "Database Manager Authentication" ¬
                    buttons {{"Cancel", "Authenticate"}} default button "Authenticate" ¬
                    with icon caution giving up after 30
                if button returned of result is "Authenticate" then
                    return true
                else
                    return false
                end if
            end tell
            '''
            
            cmd = ['osascript', '-e', script]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            return result.returncode == 0 and 'true' in result.stdout
            
        except Exception as e:
            logger.error(f"Biometric authentication failed: {e}")
            return False
    
    def is_available(self) -> bool:
        """Check if biometric authentication is available"""
        return self.available


class SecurityAuditLogger:
    """Security audit logging for credential access and operations"""
    
    def __init__(self, log_file: Optional[Path] = None):
        if log_file is None:
            log_dir = Path.home() / f".{SERVICE_NAME}" / "logs"
            log_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
            log_file = log_dir / "security_audit.log"
        
        self.log_file = log_file
        self.logger = logging.getLogger(f"{__name__}.audit")
        
        # Configure audit logger
        handler = logging.FileHandler(self.log_file, mode='a')
        formatter = logging.Formatter(
            '%(asctime)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        self.logger.setLevel(logging.INFO)
    
    def log_credential_access(self, profile_id: str, operation: str, success: bool, 
                            user_agent: Optional[str] = None):
        """Log credential access operations"""
        message = f"CREDENTIAL_ACCESS: profile={profile_id}, operation={operation}, success={success}"
        if user_agent:
            message += f", user_agent={user_agent}"
        
        if success:
            self.logger.info(message)
        else:
            self.logger.warning(message)
    
    def log_authentication_attempt(self, method: str, success: bool, details: Optional[str] = None):
        """Log authentication attempts"""
        message = f"AUTH_ATTEMPT: method={method}, success={success}"
        if details:
            message += f", details={details}"
        
        if success:
            self.logger.info(message)
        else:
            self.logger.warning(message)
    
    def log_security_event(self, event_type: str, details: str, severity: str = "INFO"):
        """Log general security events"""
        message = f"SECURITY_EVENT: type={event_type}, details={details}"
        
        if severity.upper() == "ERROR":
            self.logger.error(message)
        elif severity.upper() == "WARNING":
            self.logger.warning(message)
        else:
            self.logger.info(message)


class CredentialRotationManager:
    """Manages credential rotation and expiration"""
    
    def __init__(self, credential_manager: SecureCredentialManager):
        self.credential_manager = credential_manager
        self.rotation_policies: Dict[str, Dict[str, Any]] = {}
    
    def set_rotation_policy(self, profile_id: str, max_age_days: int = 90, 
                          warn_days_before: int = 7):
        """Set credential rotation policy for a profile"""
        self.rotation_policies[profile_id] = {
            'max_age_days': max_age_days,
            'warn_days_before': warn_days_before,
            'last_rotation': datetime.now(),
            'next_rotation': datetime.now() + timedelta(days=max_age_days)
        }
    
    def check_rotation_needed(self, profile_id: str) -> Dict[str, Any]:
        """Check if credential rotation is needed"""
        if profile_id not in self.rotation_policies:
            return {'rotation_needed': False, 'warning': False}
        
        policy = self.rotation_policies[profile_id]
        now = datetime.now()
        
        days_until_rotation = (policy['next_rotation'] - now).days
        
        return {
            'rotation_needed': days_until_rotation <= 0,
            'warning': days_until_rotation <= policy['warn_days_before'],
            'days_until_rotation': days_until_rotation,
            'next_rotation': policy['next_rotation']
        }
    
    def get_rotation_status(self) -> Dict[str, Dict[str, Any]]:
        """Get rotation status for all profiles"""
        status = {}
        for profile_id in self.rotation_policies:
            status[profile_id] = self.check_rotation_needed(profile_id)
        return status


# Enhanced security manager that combines all security features
class SecurityManager:
    """Comprehensive security manager with all security features"""
    
    def __init__(self, service_name: str = SERVICE_NAME):
        self.service_name = service_name
        
        # Initialize components
        self.credential_manager = SecureCredentialManager(service_name)
        self.auth_manager = AuthenticationManager()
        self.biometric_manager = BiometricAuthManager()
        self.audit_logger = SecurityAuditLogger()
        self.rotation_manager = CredentialRotationManager(self.credential_manager)
        
        # Security settings
        self.require_biometric = False
        self.session_timeout = timedelta(hours=8)
        self.max_failed_attempts = 3
        
        # Session management
        self._active_sessions: Dict[str, datetime] = {}
        self._failed_attempts: Dict[str, int] = {}
    
    def authenticate_and_get_credentials(self, profile_id: str, 
                                       require_biometric: Optional[bool] = None) -> Optional[DatabaseCredentials]:
        """Authenticate user and retrieve credentials"""
        require_biometric = require_biometric or self.require_biometric
        
        # Check session
        if not self._check_session_valid(profile_id):
            # Perform authentication
            if require_biometric and self.biometric_manager.is_available():
                if not self.biometric_manager.authenticate(f"Access credentials for profile {profile_id}"):
                    self.audit_logger.log_authentication_attempt("biometric", False, profile_id)
                    return None
                
                self.audit_logger.log_authentication_attempt("biometric", True, profile_id)
            
            # Create new session
            self._create_session(profile_id)
        
        # Get credentials
        try:
            credentials = self.credential_manager.get_credentials(profile_id)
            self.audit_logger.log_credential_access(profile_id, "retrieve", credentials is not None)
            return credentials
        except Exception as e:
            self.audit_logger.log_credential_access(profile_id, "retrieve", False)
            raise e
    
    def store_credentials_securely(self, profile_id: str, profile_name: str, 
                                 credentials: DatabaseCredentials) -> bool:
        """Store credentials with security checks"""
        try:
            success = self.credential_manager.store_credentials(profile_id, profile_name, credentials)
            self.audit_logger.log_credential_access(profile_id, "store", success)
            
            # Set default rotation policy
            self.rotation_manager.set_rotation_policy(profile_id)
            
            return success
        except Exception as e:
            self.audit_logger.log_credential_access(profile_id, "store", False)
            raise e
    
    def _check_session_valid(self, profile_id: str) -> bool:
        """Check if session is still valid"""
        if profile_id not in self._active_sessions:
            return False
        
        session_time = self._active_sessions[profile_id]
        if datetime.now() - session_time > self.session_timeout:
            del self._active_sessions[profile_id]
            return False
        
        return True
    
    def _create_session(self, profile_id: str):
        """Create new authentication session"""
        self._active_sessions[profile_id] = datetime.now()
    
    def invalidate_session(self, profile_id: str):
        """Invalidate authentication session"""
        if profile_id in self._active_sessions:
            del self._active_sessions[profile_id]
    
    def get_security_status(self) -> Dict[str, Any]:
        """Get comprehensive security status"""
        return {
            'keychain_available': self.credential_manager.keychain_manager.is_available() if self.credential_manager.keychain_manager else False,
            'biometric_available': self.biometric_manager.is_available(),
            'active_sessions': len(self._active_sessions),
            'credential_stats': self.credential_manager.get_credential_stats(),
            'rotation_status': self.rotation_manager.get_rotation_status(),
            'audit_log_file': str(self.audit_logger.log_file)
        }


# Global instances
credential_manager = SecureCredentialManager()
auth_manager = AuthenticationManager()
security_manager = SecurityManager()

__all__ = [
    'DatabaseCredentials',
    'SecureCredentialEntry',
    'MacOSKeychainManager',
    'SecureCredentialManager',
    'AuthenticationManager',
    'BiometricAuthManager',
    'SecurityAuditLogger',
    'CredentialRotationManager',
    'SecurityManager',
    'SQLInjectionPrevention',
    'SecurityError',
    'InputValidator',
    'credential_manager',
    'auth_manager',
    'security_manager'
]