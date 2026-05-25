"""
HashiCorp Vault Integration Service for Secrets Management
"""

import hvac
import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json
import os
from functools import wraps

from app.core.config import settings

logger = logging.getLogger(__name__)


class VaultConnectionError(Exception):
    """Vault connection error"""
    pass


class VaultAuthenticationError(Exception):
    """Vault authentication error"""
    pass


class VaultService:
    """HashiCorp Vault service for secrets management"""
    
    def __init__(self):
        self.vault_url = getattr(settings, 'VAULT_URL', 'http://localhost:8200')
        self.vault_token = getattr(settings, 'VAULT_TOKEN', None)
        self.vault_role_id = getattr(settings, 'VAULT_ROLE_ID', None)
        self.vault_secret_id = getattr(settings, 'VAULT_SECRET_ID', None)
        self.vault_namespace = getattr(settings, 'VAULT_NAMESPACE', None)
        
        self.client = None
        self.token_lease_duration = 3600  # 1 hour default
        self.token_renewal_threshold = 300  # Renew when 5 minutes left
        self.last_token_renewal = None
        
        # Secret paths configuration
        self.secret_paths = {
            'database': 'secret/data/database',
            'redis': 'secret/data/redis',
            'api_keys': 'secret/data/api_keys',
            'oauth': 'secret/data/oauth',
            'encryption': 'secret/data/encryption',
            'certificates': 'secret/data/certificates'
        }
        
        # Initialize client
        self._initialize_client()
    
    def _initialize_client(self) -> None:
        """Initialize Vault client"""
        try:
            self.client = hvac.Client(
                url=self.vault_url,
                namespace=self.vault_namespace
            )
            
            # Verify connection
            if not self.client.sys.is_initialized():
                logger.warning("Vault is not initialized")
                return
            
            if self.client.sys.is_sealed():
                logger.error("Vault is sealed")
                raise VaultConnectionError("Vault is sealed")
            
            logger.info("Vault client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Vault client: {e}")
            self.client = None
    
    async def authenticate(self) -> bool:
        """Authenticate with Vault using available methods"""
        if not self.client:
            return False
        
        try:
            # Method 1: Token authentication
            if self.vault_token:
                self.client.token = self.vault_token
                if self.client.is_authenticated():
                    logger.info("Authenticated with Vault using token")
                    return True
            
            # Method 2: AppRole authentication
            if self.vault_role_id and self.vault_secret_id:
                auth_response = self.client.auth.approle.login(
                    role_id=self.vault_role_id,
                    secret_id=self.vault_secret_id
                )
                
                if auth_response and 'auth' in auth_response:
                    self.client.token = auth_response['auth']['client_token']
                    self.token_lease_duration = auth_response['auth'].get('lease_duration', 3600)
                    self.last_token_renewal = datetime.utcnow()
                    
                    logger.info("Authenticated with Vault using AppRole")
                    return True
            
            # Method 3: Kubernetes authentication (if running in K8s)
            if os.path.exists('/var/run/secrets/kubernetes.io/serviceaccount/token'):
                try:
                    with open('/var/run/secrets/kubernetes.io/serviceaccount/token', 'r') as f:
                        jwt_token = f.read().strip()
                    
                    auth_response = self.client.auth.kubernetes.login(
                        role='upm-plus-role',  # Configure this in Vault
                        jwt=jwt_token
                    )
                    
                    if auth_response and 'auth' in auth_response:
                        self.client.token = auth_response['auth']['client_token']
                        logger.info("Authenticated with Vault using Kubernetes")
                        return True
                        
                except Exception as k8s_error:
                    logger.debug(f"Kubernetes auth failed: {k8s_error}")
            
            logger.error("No valid authentication method found for Vault")
            return False
            
        except Exception as e:
            logger.error(f"Vault authentication failed: {e}")
            raise VaultAuthenticationError(f"Authentication failed: {e}")
    
    async def ensure_authenticated(self) -> bool:
        """Ensure client is authenticated, renew token if needed"""
        if not self.client:
            return False
        
        # Check if token needs renewal
        if self.last_token_renewal:
            time_since_renewal = (datetime.utcnow() - self.last_token_renewal).total_seconds()
            if time_since_renewal > (self.token_lease_duration - self.token_renewal_threshold):
                await self.renew_token()
        
        # Check authentication status
        if not self.client.is_authenticated():
            return await self.authenticate()
        
        return True
    
    async def renew_token(self) -> bool:
        """Renew Vault token"""
        if not self.client:
            return False
        
        try:
            renewal_response = self.client.auth.token.renew_self()
            if renewal_response and 'auth' in renewal_response:
                self.token_lease_duration = renewal_response['auth'].get('lease_duration', 3600)
                self.last_token_renewal = datetime.utcnow()
                logger.info("Vault token renewed successfully")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Token renewal failed: {e}")
            # Try to re-authenticate
            return await self.authenticate()
    
    async def get_secret(self, path: str, key: Optional[str] = None) -> Optional[Any]:
        """Get secret from Vault"""
        if not await self.ensure_authenticated():
            logger.error("Cannot retrieve secret: Vault not authenticated")
            return None
        
        try:
            # Handle KV v2 secrets engine
            if path.startswith('secret/'):
                response = self.client.secrets.kv.v2.read_secret_version(
                    path=path.replace('secret/data/', '').replace('secret/', '')
                )
                
                if response and 'data' in response and 'data' in response['data']:
                    secret_data = response['data']['data']
                    
                    if key:
                        return secret_data.get(key)
                    return secret_data
            
            # Handle other secrets engines
            else:
                response = self.client.read(path)
                if response and 'data' in response:
                    secret_data = response['data']
                    
                    if key:
                        return secret_data.get(key)
                    return secret_data
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get secret from {path}: {e}")
            return None
    
    async def set_secret(self, path: str, secret_data: Dict[str, Any]) -> bool:
        """Set secret in Vault"""
        if not await self.ensure_authenticated():
            logger.error("Cannot set secret: Vault not authenticated")
            return False
        
        try:
            # Handle KV v2 secrets engine
            if path.startswith('secret/'):
                response = self.client.secrets.kv.v2.create_or_update_secret(
                    path=path.replace('secret/data/', '').replace('secret/', ''),
                    secret=secret_data
                )
            else:
                response = self.client.write(path, **secret_data)
            
            logger.info(f"Secret written to {path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to set secret at {path}: {e}")
            return False
    
    async def delete_secret(self, path: str) -> bool:
        """Delete secret from Vault"""
        if not await self.ensure_authenticated():
            logger.error("Cannot delete secret: Vault not authenticated")
            return False
        
        try:
            if path.startswith('secret/'):
                self.client.secrets.kv.v2.delete_metadata_and_all_versions(
                    path=path.replace('secret/data/', '').replace('secret/', '')
                )
            else:
                self.client.delete(path)
            
            logger.info(f"Secret deleted from {path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete secret from {path}: {e}")
            return False
    
    async def get_database_credentials(self, database_name: str = "postgres") -> Optional[Dict[str, str]]:
        """Get database credentials from Vault"""
        try:
            # Try dynamic secrets first (database secrets engine)
            dynamic_path = f"database/creds/{database_name}"
            dynamic_creds = await self.get_secret(dynamic_path)
            
            if dynamic_creds:
                return {
                    'username': dynamic_creds.get('username'),
                    'password': dynamic_creds.get('password'),
                    'type': 'dynamic'
                }
            
            # Fall back to static secrets
            static_path = self.secret_paths['database']
            static_creds = await self.get_secret(static_path)
            
            if static_creds:
                return {
                    'username': static_creds.get('username'),
                    'password': static_creds.get('password'),
                    'host': static_creds.get('host'),
                    'port': static_creds.get('port'),
                    'database': static_creds.get('database'),
                    'type': 'static'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get database credentials: {e}")
            return None
    
    async def get_api_key(self, service_name: str) -> Optional[str]:
        """Get API key for external service"""
        api_keys = await self.get_secret(self.secret_paths['api_keys'])
        if api_keys:
            return api_keys.get(service_name)
        return None
    
    async def get_oauth_credentials(self, provider: str) -> Optional[Dict[str, str]]:
        """Get OAuth credentials for provider"""
        oauth_creds = await self.get_secret(self.secret_paths['oauth'])
        if oauth_creds and provider in oauth_creds:
            return oauth_creds[provider]
        return None
    
    async def get_encryption_key(self, key_name: str = "master_key") -> Optional[str]:
        """Get encryption key"""
        encryption_keys = await self.get_secret(self.secret_paths['encryption'])
        if encryption_keys:
            return encryption_keys.get(key_name)
        return None
    
    async def rotate_secret(self, path: str, generator_func: callable) -> bool:
        """Rotate a secret using provided generator function"""
        if not await self.ensure_authenticated():
            return False
        
        try:
            # Generate new secret
            new_secret = generator_func()
            
            # Store new secret
            success = await self.set_secret(path, new_secret)
            
            if success:
                logger.info(f"Secret rotated at {path}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to rotate secret at {path}: {e}")
            return False
    
    async def setup_database_secrets_engine(self, db_config: Dict[str, Any]) -> bool:
        """Setup database secrets engine for dynamic credentials"""
        if not await self.ensure_authenticated():
            return False
        
        try:
            # Enable database secrets engine
            self.client.sys.enable_secrets_engine(
                backend_type='database',
                path='database'
            )
            
            # Configure database connection
            self.client.secrets.database.configure(
                name='postgres',
                plugin_name='postgresql-database-plugin',
                connection_url=f"postgresql://{{{{username}}}}:{{{{password}}}}@{db_config['host']}:{db_config['port']}/{db_config['database']}?sslmode=require",
                allowed_roles=['upm-plus-role'],
                username=db_config['admin_username'],
                password=db_config['admin_password']
            )
            
            # Create role for dynamic credentials
            self.client.secrets.database.create_role(
                name='upm-plus-role',
                db_name='postgres',
                creation_statements=[
                    "CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
                    "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";"
                ],
                default_ttl=3600,  # 1 hour
                max_ttl=86400      # 24 hours
            )
            
            logger.info("Database secrets engine configured")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup database secrets engine: {e}")
            return False
    
    async def get_certificate(self, cert_name: str) -> Optional[Dict[str, str]]:
        """Get SSL certificate from Vault"""
        try:
            # Try PKI secrets engine first
            pki_path = f"pki/issue/upm-plus"
            pki_response = await self.get_secret(pki_path)
            
            if pki_response:
                return {
                    'certificate': pki_response.get('certificate'),
                    'private_key': pki_response.get('private_key'),
                    'ca_chain': pki_response.get('ca_chain'),
                    'type': 'dynamic'
                }
            
            # Fall back to static certificates
            cert_path = f"{self.secret_paths['certificates']}/{cert_name}"
            cert_data = await self.get_secret(cert_path)
            
            if cert_data:
                return {
                    'certificate': cert_data.get('certificate'),
                    'private_key': cert_data.get('private_key'),
                    'ca_chain': cert_data.get('ca_chain'),
                    'type': 'static'
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get certificate {cert_name}: {e}")
            return None
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Vault health status"""
        try:
            if not self.client:
                return {
                    'status': 'error',
                    'message': 'Vault client not initialized',
                    'authenticated': False
                }
            
            # Check Vault status
            health = self.client.sys.read_health_status()
            
            # Check authentication
            authenticated = self.client.is_authenticated()
            
            return {
                'status': 'healthy' if health.get('initialized') and not health.get('sealed') else 'unhealthy',
                'initialized': health.get('initialized', False),
                'sealed': health.get('sealed', True),
                'authenticated': authenticated,
                'version': health.get('version'),
                'cluster_name': health.get('cluster_name'),
                'last_token_renewal': self.last_token_renewal.isoformat() if self.last_token_renewal else None
            }
            
        except Exception as e:
            logger.error(f"Vault health check failed: {e}")
            return {
                'status': 'error',
                'message': str(e),
                'authenticated': False
            }


# Global Vault service instance
vault_service = VaultService()


def vault_required(func):
    """Decorator to ensure Vault is available and authenticated"""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if not await vault_service.ensure_authenticated():
            raise VaultConnectionError("Vault is not available or authenticated")
        return await func(*args, **kwargs)
    return wrapper


# Utility functions for common operations
async def get_secret_or_env(vault_path: str, vault_key: str, env_var: str, default: Optional[str] = None) -> Optional[str]:
    """Get secret from Vault or fall back to environment variable"""
    try:
        # Try Vault first
        secret_value = await vault_service.get_secret(vault_path, vault_key)
        if secret_value:
            return secret_value
    except Exception as e:
        logger.debug(f"Failed to get secret from Vault: {e}")
    
    # Fall back to environment variable
    env_value = os.getenv(env_var, default)
    if env_value:
        logger.debug(f"Using environment variable {env_var}")
        return env_value
    
    logger.warning(f"No secret found in Vault or environment for {vault_key}/{env_var}")
    return default


async def initialize_vault_secrets() -> None:
    """Initialize Vault with default secrets structure"""
    try:
        if not await vault_service.ensure_authenticated():
            logger.warning("Vault not available, skipping secret initialization")
            return
        
        # Initialize secret paths if they don't exist
        default_secrets = {
            'secret/data/database': {
                'host': 'localhost',
                'port': '5432',
                'database': 'upmplus',
                'username': 'upmplus_user',
                'password': 'change_me_in_production'
            },
            'secret/data/redis': {
                'host': 'localhost',
                'port': '6379',
                'password': ''
            },
            'secret/data/api_keys': {
                'openai': 'sk-...',
                'anthropic': 'sk-ant-...',
                'google': 'AIza...'
            },
            'secret/data/oauth': {
                'google': {
                    'client_id': 'your-google-client-id',
                    'client_secret': 'your-google-client-secret'
                },
                'microsoft': {
                    'client_id': 'your-microsoft-client-id',
                    'client_secret': 'your-microsoft-client-secret'
                }
            },
            'secret/data/encryption': {
                'master_key': 'generate-secure-key-here',
                'mfa_key': 'generate-mfa-encryption-key'
            }
        }
        
        for path, default_data in default_secrets.items():
            # Check if secret already exists
            existing_secret = await vault_service.get_secret(path)
            if not existing_secret:
                await vault_service.set_secret(path, default_data)
                logger.info(f"Initialized default secret at {path}")
        
        logger.info("Vault secrets initialization completed")
        
    except Exception as e:
        logger.error(f"Failed to initialize Vault secrets: {e}")