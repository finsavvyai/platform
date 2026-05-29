"""
Tenant management module for SDLC.ai SDK

Provides clients for tenant management operations.
"""

from .client import TenantsClient, AsyncTenantsClient

__all__ = [
    "TenantsClient",
    "AsyncTenantsClient",
]
