"""
Security Hardening Infrastructure - Main security manager and HTTPS middleware
"""

import ssl
import logging
from typing import Dict, Any, Optional, Callable
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn

from app.core.config import settings
from app.services.security_manager import SecurityManager
from app.services.mfa_service import MFAService
from app.services.rbac_service import RBACService
from app.services.vault_service import vault_service
from app.services.encryption_service import encryption_service
from app.middleware.rate_limiting import RateLimitMiddleware
from app.middleware.security_middleware import (
    SecurityHeadersMiddleware,
    CORSSecurityMiddleware,
    RequestValidationMiddleware,
    IPWhitelistMiddleware,
    SecurityEventLogger
)
from app.middleware.secrets_middleware import SecretsInjectionMiddleware
from app.middleware.auth_middleware import AuthenticationMiddleware

logger = logging.getLogger(__name__)


class SecurityHardeningManager:
    """Main security hardening manager"""
    
    def __init__(self):
        self.security_manager = SecurityManager()
        self.mfa_service = MFAService()
        self.rbac_service = RBACService()
        self.auth_middleware = AuthenticationMiddleware()
        
        # Security configuration
        self.security_config = {
            'enforce_https': settings.ENVIRONMENT != "development",
            'trusted_hosts': self._get_trusted_hosts(),
            'enable_rate_limiting': True,
            'enable_request_validation': True,
            'enable_ip_whitelist': settings.ENVIRONMENT == "production",
            'enable_security_headers': True,
            'enable_cors_security': True,
            'enable_secrets_injection': True,
            'enable_security_logging': True
        }
    
    def _get_trusted_hosts(self) -> list:
        """Get trusted hosts based on environment"""
        if settings.ENVIRONMENT == "development":
            return ["localhost", "127.0.0.1", "*.localhost"]
        elif settings.ENVIRONMENT == "staging":
            return ["staging.upmplus.com", "*.staging.upmplus.com"]
        else:  # production
            return ["upmplus.com", "*.upmplus.com", "app.upmplus.com"]
    
    def configure_security_middleware(self, app: FastAPI) -> None:
        """Configure all security middleware"""
        try:
            logger.info("Configuring security middleware...")
            
            # 1. HTTPS Redirect (first middleware)
            if self.security_config['enforce_https']:
                app.add_middleware(HTTPSRedirectMiddleware)
                logger.info("HTTPS redirect middleware enabled")
            
            # 2. Trusted Host Middleware
            app.add_middleware(
                TrustedHostMiddleware,
                allowed_hosts=self.security_config['trusted_hosts']
            )
            logger.info(f"Trusted host middleware enabled: {self.security_config['trusted_hosts']}")
            
            # 3. Security Headers Middleware
            if self.security_config['enable_security_headers']:
                app.add_middleware(SecurityHeadersMiddleware)
                logger.info("Security headers middleware enabled")
            
            # 4. CORS Security Middleware
            if self.security_config['enable_cors_security']:
                app.add_middleware(CORSSecurityMiddleware)
                logger.info("CORS security middleware enabled")
            
            # 5. Request Validation Middleware
            if self.security_config['enable_request_validation']:
                app.add_middleware(RequestValidationMiddleware)
                logger.info("Request validation middleware enabled")
            
            # 6. IP Whitelist Middleware (for admin endpoints)
            if self.security_config['enable_ip_whitelist']:
                app.add_middleware(IPWhitelistMiddleware)
                logger.info("IP whitelist middleware enabled")
            
            # 7. Rate Limiting Middleware
            if self.security_config['enable_rate_limiting']:
                app.add_middleware(RateLimitMiddleware)
                logger.info("Rate limiting middleware enabled")
            
            # 8. Secrets Injection Middleware
            if self.security_config['enable_secrets_injection']:
                app.add_middleware(SecretsInjectionMiddleware)
                logger.info("Secrets injection middleware enabled")
            
            # 9. Security Event Logger (last middleware)
            if self.security_config['enable_security_logging']:
                app.add_middleware(SecurityEventLogger)
                logger.info("Security event logging middleware enabled")
            
            logger.info("Security middleware configuration completed")
            
        except Exception as e:
            logger.error(f"Failed to configure security middleware: {e}")
            raise
    
    async def initialize_security_services(self) -> None:
        """Initialize all security services"""
        try:
            logger.info("Initializing security services...")
            
            # Initialize Vault connection
            if vault_service:
                await vault_service.authenticate()
                logger.info("Vault service initialized")
            
            # Initialize RBAC system roles
            from app.core.database import get_db
            async with get_db() as db:
                await self.rbac_service.initialize_system_roles(db)
                logger.info("RBAC system roles initialized")
            
            # Initialize security policies
            async with get_db() as db:
                await self.security_manager.initialize_security_policies(db)
                logger.info("Security policies initialized")
            
            # Initialize secrets management
            from app.middleware.secrets_middleware import secrets_manager
            await secrets_manager.initialize_secrets()
            logger.info("Secrets management initialized")
            
            logger.info("Security services initialization completed")
            
        except Exception as e:
            logger.error(f"Failed to initialize security services: {e}")
            raise
    
    def configure_tls_settings(self) -> Dict[str, Any]:
        """Configure TLS settings for production"""
        if settings.ENVIRONMENT == "development":
            return {}
        
        tls_config = {
            'ssl_version': ssl.PROTOCOL_TLS_SERVER,
            'ssl_ciphers': 'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS',
            'ssl_options': ssl.OP_NO_SSLv2 | ssl.OP_NO_SSLv3 | ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1,
        }
        
        # Add certificate paths if available
        cert_file = getattr(settings, 'SSL_CERT_FILE', None)
        key_file = getattr(settings, 'SSL_KEY_FILE', None)
        
        if cert_file and key_file:
            tls_config.update({
                'ssl_certfile': cert_file,
                'ssl_keyfile': key_file
            })
        
        logger.info("TLS configuration prepared for production")
        return tls_config
    
    async def security_health_check(self) -> Dict[str, Any]:
        """Comprehensive security health check"""
        try:
            health_status = {
                'overall_status': 'healthy',
                'components': {},
                'warnings': [],
                'errors': []
            }
            
            # Check Vault service
            if vault_service:
                vault_health = await vault_service.health_check()
                health_status['components']['vault'] = vault_health
                
                if vault_health['status'] != 'healthy':
                    health_status['warnings'].append("Vault service is not healthy")
            else:
                health_status['components']['vault'] = {'status': 'not_configured'}
                health_status['warnings'].append("Vault service not configured")
            
            # Check encryption service
            try:
                test_data = "security_health_check"
                encrypted = encryption_service.encrypt_data(test_data)
                decrypted = encryption_service.decrypt_data(encrypted)
                
                health_status['components']['encryption'] = {
                    'status': 'healthy' if decrypted == test_data else 'error'
                }
            except Exception as e:
                health_status['components']['encryption'] = {
                    'status': 'error',
                    'error': str(e)
                }
                health_status['errors'].append(f"Encryption service error: {e}")
            
            # Check secrets management
            from app.middleware.secrets_middleware import secrets_manager
            secrets_health = await secrets_manager.health_check()
            health_status['components']['secrets'] = secrets_health
            
            if secrets_health['status'] != 'healthy':
                health_status['warnings'].append("Secrets management is degraded")
            
            # Check security manager
            from app.core.database import get_db
            async with get_db() as db:
                security_dashboard = await self.security_manager.get_security_dashboard_data(db)
                health_status['components']['security_manager'] = {
                    'status': 'healthy',
                    'recent_events': security_dashboard['recent_events'],
                    'open_incidents': security_dashboard['open_incidents']
                }
                
                if security_dashboard['open_incidents'] > 0:
                    health_status['warnings'].append(f"{security_dashboard['open_incidents']} open security incidents")
            
            # Determine overall status
            if health_status['errors']:
                health_status['overall_status'] = 'error'
            elif health_status['warnings']:
                health_status['overall_status'] = 'warning'
            
            return health_status
            
        except Exception as e:
            logger.error(f"Security health check failed: {e}")
            return {
                'overall_status': 'error',
                'error': str(e),
                'components': {}
            }
    
    def get_security_configuration_summary(self) -> Dict[str, Any]:
        """Get summary of security configuration"""
        return {
            'environment': settings.ENVIRONMENT,
            'https_enforced': self.security_config['enforce_https'],
            'trusted_hosts': self.security_config['trusted_hosts'],
            'middleware_enabled': {
                'rate_limiting': self.security_config['enable_rate_limiting'],
                'request_validation': self.security_config['enable_request_validation'],
                'ip_whitelist': self.security_config['enable_ip_whitelist'],
                'security_headers': self.security_config['enable_security_headers'],
                'cors_security': self.security_config['enable_cors_security'],
                'secrets_injection': self.security_config['enable_secrets_injection'],
                'security_logging': self.security_config['enable_security_logging']
            },
            'services_configured': {
                'vault': vault_service is not None,
                'encryption': encryption_service is not None,
                'mfa': self.mfa_service is not None,
                'rbac': self.rbac_service is not None
            }
        }


# Global security hardening manager
security_hardening = SecurityHardeningManager()


# Utility functions for FastAPI app configuration
def configure_security_for_app(app: FastAPI) -> None:
    """Configure security for FastAPI application"""
    security_hardening.configure_security_middleware(app)


async def initialize_security() -> None:
    """Initialize security services"""
    await security_hardening.initialize_security_services()


def get_uvicorn_ssl_config() -> Dict[str, Any]:
    """Get SSL configuration for Uvicorn"""
    return security_hardening.configure_tls_settings()


# Security startup event handler
async def security_startup_handler() -> None:
    """Security startup event handler for FastAPI"""
    try:
        logger.info("Starting security initialization...")
        await initialize_security()
        logger.info("Security initialization completed successfully")
    except Exception as e:
        logger.error(f"Security initialization failed: {e}")
        raise


# Security shutdown event handler
async def security_shutdown_handler() -> None:
    """Security shutdown event handler for FastAPI"""
    try:
        logger.info("Shutting down security services...")
        
        # Stop secrets rotation tasks
        from app.middleware.secrets_middleware import secrets_manager
        secrets_manager.stop_rotation_tasks()
        
        logger.info("Security services shutdown completed")
    except Exception as e:
        logger.error(f"Security shutdown error: {e}")


# Request validation decorator
def validate_request_security(func):
    """Decorator to validate request security"""
    async def wrapper(request: Request, *args, **kwargs):
        try:
            # Get database session
            from app.core.database import get_db
            async with get_db() as db:
                # Enforce security policies
                user_id = getattr(request.state, 'user_id', None)
                security_context = await security_hardening.security_manager.enforce_security_policies(
                    request, db, user_id
                )
                
                if not security_context['allowed']:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Request blocked by security policy"
                    )
                
                # Add security context to request state
                request.state.security_context = security_context
                
                return await func(request, *args, **kwargs)
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Security validation error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Security validation failed"
            )
    
    return wrapper