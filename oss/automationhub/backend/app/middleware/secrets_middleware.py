"""
Secrets Injection Middleware for Runtime Configuration
"""

import os
import asyncio
import logging
from typing import Dict, Any, Optional, Callable
from fastapi import Request, Response
from contextlib import asynccontextmanager

from app.services.vault_service import vault_service, get_secret_or_env
from app.core.config import settings

logger = logging.getLogger(__name__)


class SecretsManager:
    """Manages secrets injection and rotation"""
    
    def __init__(self):
        self.secrets_cache = {}
        self.cache_ttl = 300  # 5 minutes cache TTL
        self.last_refresh = {}
        self.rotation_tasks = {}
        
        # Define secret mappings
        self.secret_mappings = {
            # Database secrets
            'DATABASE_PASSWORD': {
                'vault_path': 'secret/data/database',
                'vault_key': 'password',
                'env_var': 'DATABASE_PASSWORD',
                'rotation_interval': 86400  # 24 hours
            },
            'DATABASE_USERNAME': {
                'vault_path': 'secret/data/database',
                'vault_key': 'username',
                'env_var': 'DATABASE_USERNAME',
                'rotation_interval': None  # No rotation for username
            },
            
            # Redis secrets
            'REDIS_PASSWORD': {
                'vault_path': 'secret/data/redis',
                'vault_key': 'password',
                'env_var': 'REDIS_PASSWORD',
                'rotation_interval': 86400
            },
            
            # API Keys
            'OPENAI_API_KEY': {
                'vault_path': 'secret/data/api_keys',
                'vault_key': 'openai',
                'env_var': 'OPENAI_API_KEY',
                'rotation_interval': None
            },
            'ANTHROPIC_API_KEY': {
                'vault_path': 'secret/data/api_keys',
                'vault_key': 'anthropic',
                'env_var': 'ANTHROPIC_API_KEY',
                'rotation_interval': None
            },
            
            # OAuth Credentials
            'GOOGLE_CLIENT_SECRET': {
                'vault_path': 'secret/data/oauth',
                'vault_key': 'google.client_secret',
                'env_var': 'GOOGLE_CLIENT_SECRET',
                'rotation_interval': None
            },
            'MICROSOFT_CLIENT_SECRET': {
                'vault_path': 'secret/data/oauth',
                'vault_key': 'microsoft.client_secret',
                'env_var': 'MICROSOFT_CLIENT_SECRET',
                'rotation_interval': None
            },
            
            # Encryption Keys
            'MFA_ENCRYPTION_KEY': {
                'vault_path': 'secret/data/encryption',
                'vault_key': 'mfa_key',
                'env_var': 'MFA_ENCRYPTION_KEY',
                'rotation_interval': 2592000  # 30 days
            },
            'SECRET_KEY': {
                'vault_path': 'secret/data/encryption',
                'vault_key': 'master_key',
                'env_var': 'SECRET_KEY',
                'rotation_interval': 2592000  # 30 days
            }
        }
    
    async def initialize_secrets(self) -> None:
        """Initialize secrets from Vault"""
        try:
            logger.info("Initializing secrets from Vault...")
            
            for secret_name, config in self.secret_mappings.items():
                await self._load_secret(secret_name, config)
            
            # Start rotation tasks for secrets that require it
            await self._start_rotation_tasks()
            
            logger.info("Secrets initialization completed")
            
        except Exception as e:
            logger.error(f"Failed to initialize secrets: {e}")
            # Fall back to environment variables
            logger.info("Falling back to environment variables")
    
    async def _load_secret(self, secret_name: str, config: Dict[str, Any]) -> None:
        """Load a single secret from Vault or environment"""
        try:
            # Get secret from Vault or environment
            secret_value = await get_secret_or_env(
                config['vault_path'],
                config['vault_key'],
                config['env_var']
            )
            
            if secret_value:
                # Cache the secret
                self.secrets_cache[secret_name] = {
                    'value': secret_value,
                    'loaded_at': asyncio.get_event_loop().time(),
                    'config': config
                }
                
                # Set environment variable for backward compatibility
                os.environ[secret_name] = secret_value
                
                logger.debug(f"Loaded secret: {secret_name}")
            else:
                logger.warning(f"Failed to load secret: {secret_name}")
                
        except Exception as e:
            logger.error(f"Error loading secret {secret_name}: {e}")
    
    async def _start_rotation_tasks(self) -> None:
        """Start background tasks for secret rotation"""
        for secret_name, cached_secret in self.secrets_cache.items():
            config = cached_secret['config']
            rotation_interval = config.get('rotation_interval')
            
            if rotation_interval:
                # Create rotation task
                task = asyncio.create_task(
                    self._rotation_task(secret_name, rotation_interval)
                )
                self.rotation_tasks[secret_name] = task
                logger.info(f"Started rotation task for {secret_name} (interval: {rotation_interval}s)")
    
    async def _rotation_task(self, secret_name: str, interval: int) -> None:
        """Background task for secret rotation"""
        while True:
            try:
                await asyncio.sleep(interval)
                
                # Check if secret needs rotation
                if await self._should_rotate_secret(secret_name):
                    await self._rotate_secret(secret_name)
                
            except asyncio.CancelledError:
                logger.info(f"Rotation task cancelled for {secret_name}")
                break
            except Exception as e:
                logger.error(f"Error in rotation task for {secret_name}: {e}")
                # Continue the loop to retry
    
    async def _should_rotate_secret(self, secret_name: str) -> bool:
        """Check if secret should be rotated"""
        try:
            cached_secret = self.secrets_cache.get(secret_name)
            if not cached_secret:
                return False
            
            config = cached_secret['config']
            rotation_interval = config.get('rotation_interval')
            
            if not rotation_interval:
                return False
            
            # Check if enough time has passed
            current_time = asyncio.get_event_loop().time()
            loaded_at = cached_secret['loaded_at']
            
            return (current_time - loaded_at) >= rotation_interval
            
        except Exception as e:
            logger.error(f"Error checking rotation for {secret_name}: {e}")
            return False
    
    async def _rotate_secret(self, secret_name: str) -> None:
        """Rotate a secret"""
        try:
            logger.info(f"Rotating secret: {secret_name}")
            
            cached_secret = self.secrets_cache.get(secret_name)
            if not cached_secret:
                return
            
            config = cached_secret['config']
            
            # For database credentials, request new dynamic credentials
            if secret_name in ['DATABASE_PASSWORD', 'DATABASE_USERNAME']:
                await self._rotate_database_credentials()
            
            # For encryption keys, generate new keys
            elif secret_name in ['MFA_ENCRYPTION_KEY', 'SECRET_KEY']:
                await self._rotate_encryption_key(secret_name, config)
            
            # Reload the secret
            await self._load_secret(secret_name, config)
            
            logger.info(f"Successfully rotated secret: {secret_name}")
            
        except Exception as e:
            logger.error(f"Failed to rotate secret {secret_name}: {e}")
    
    async def _rotate_database_credentials(self) -> None:
        """Rotate database credentials using Vault dynamic secrets"""
        try:
            # Get new dynamic credentials from Vault
            new_creds = await vault_service.get_database_credentials()
            
            if new_creds and new_creds.get('type') == 'dynamic':
                # Update cached credentials
                self.secrets_cache['DATABASE_USERNAME'] = {
                    'value': new_creds['username'],
                    'loaded_at': asyncio.get_event_loop().time(),
                    'config': self.secret_mappings['DATABASE_USERNAME']
                }
                
                self.secrets_cache['DATABASE_PASSWORD'] = {
                    'value': new_creds['password'],
                    'loaded_at': asyncio.get_event_loop().time(),
                    'config': self.secret_mappings['DATABASE_PASSWORD']
                }
                
                # Update environment variables
                os.environ['DATABASE_USERNAME'] = new_creds['username']
                os.environ['DATABASE_PASSWORD'] = new_creds['password']
                
                logger.info("Database credentials rotated successfully")
            
        except Exception as e:
            logger.error(f"Failed to rotate database credentials: {e}")
    
    async def _rotate_encryption_key(self, secret_name: str, config: Dict[str, Any]) -> None:
        """Rotate encryption key"""
        try:
            import secrets
            
            # Generate new encryption key
            new_key = secrets.token_urlsafe(32)
            
            # Store new key in Vault
            vault_path = config['vault_path']
            vault_key = config['vault_key']
            
            # Get current secrets from path
            current_secrets = await vault_service.get_secret(vault_path)
            if not current_secrets:
                current_secrets = {}
            
            # Update with new key
            if '.' in vault_key:
                # Handle nested keys like 'google.client_secret'
                keys = vault_key.split('.')
                nested_dict = current_secrets
                for key in keys[:-1]:
                    if key not in nested_dict:
                        nested_dict[key] = {}
                    nested_dict = nested_dict[key]
                nested_dict[keys[-1]] = new_key
            else:
                current_secrets[vault_key] = new_key
            
            # Store updated secrets
            await vault_service.set_secret(vault_path, current_secrets)
            
            logger.info(f"Encryption key rotated: {secret_name}")
            
        except Exception as e:
            logger.error(f"Failed to rotate encryption key {secret_name}: {e}")
    
    async def get_secret(self, secret_name: str) -> Optional[str]:
        """Get secret value with cache refresh if needed"""
        try:
            cached_secret = self.secrets_cache.get(secret_name)
            
            if not cached_secret:
                # Try to load secret if not cached
                config = self.secret_mappings.get(secret_name)
                if config:
                    await self._load_secret(secret_name, config)
                    cached_secret = self.secrets_cache.get(secret_name)
            
            if cached_secret:
                # Check if cache is still valid
                current_time = asyncio.get_event_loop().time()
                loaded_at = cached_secret['loaded_at']
                
                if (current_time - loaded_at) > self.cache_ttl:
                    # Refresh cache
                    config = cached_secret['config']
                    await self._load_secret(secret_name, config)
                    cached_secret = self.secrets_cache.get(secret_name)
                
                return cached_secret['value'] if cached_secret else None
            
            # Fall back to environment variable
            return os.getenv(secret_name)
            
        except Exception as e:
            logger.error(f"Error getting secret {secret_name}: {e}")
            return os.getenv(secret_name)
    
    async def refresh_all_secrets(self) -> None:
        """Refresh all cached secrets"""
        try:
            logger.info("Refreshing all secrets...")
            
            for secret_name, config in self.secret_mappings.items():
                await self._load_secret(secret_name, config)
            
            logger.info("All secrets refreshed")
            
        except Exception as e:
            logger.error(f"Failed to refresh secrets: {e}")
    
    def stop_rotation_tasks(self) -> None:
        """Stop all rotation tasks"""
        for secret_name, task in self.rotation_tasks.items():
            task.cancel()
            logger.info(f"Stopped rotation task for {secret_name}")
        
        self.rotation_tasks.clear()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check secrets manager health"""
        try:
            vault_health = await vault_service.health_check()
            
            # Count loaded secrets
            loaded_secrets = len(self.secrets_cache)
            total_secrets = len(self.secret_mappings)
            
            # Count active rotation tasks
            active_rotations = len([task for task in self.rotation_tasks.values() if not task.done()])
            
            return {
                'status': 'healthy' if vault_health['status'] == 'healthy' else 'degraded',
                'vault_status': vault_health['status'],
                'loaded_secrets': loaded_secrets,
                'total_secrets': total_secrets,
                'active_rotations': active_rotations,
                'cache_size': len(self.secrets_cache)
            }
            
        except Exception as e:
            logger.error(f"Secrets manager health check failed: {e}")
            return {
                'status': 'error',
                'message': str(e),
                'loaded_secrets': len(self.secrets_cache),
                'total_secrets': len(self.secret_mappings)
            }


# Global secrets manager instance
secrets_manager = SecretsManager()


class SecretsInjectionMiddleware:
    """Middleware to inject secrets into request context"""
    
    def __init__(self):
        self.secrets_manager = secrets_manager
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Inject secrets into request context if needed"""
        
        # Add secrets manager to request state for access in endpoints
        request.state.secrets_manager = self.secrets_manager
        
        # Process request
        response = await call_next(request)
        
        return response


# Utility functions
async def get_runtime_secret(secret_name: str) -> Optional[str]:
    """Get secret at runtime"""
    return await secrets_manager.get_secret(secret_name)


@asynccontextmanager
async def secrets_lifespan():
    """Context manager for secrets lifecycle"""
    try:
        # Initialize secrets
        await secrets_manager.initialize_secrets()
        yield secrets_manager
    finally:
        # Cleanup
        secrets_manager.stop_rotation_tasks()


# Decorator for endpoints that need specific secrets
def requires_secrets(*secret_names):
    """Decorator to ensure specific secrets are available"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Check if all required secrets are available
            missing_secrets = []
            for secret_name in secret_names:
                secret_value = await secrets_manager.get_secret(secret_name)
                if not secret_value:
                    missing_secrets.append(secret_name)
            
            if missing_secrets:
                raise RuntimeError(f"Missing required secrets: {', '.join(missing_secrets)}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator