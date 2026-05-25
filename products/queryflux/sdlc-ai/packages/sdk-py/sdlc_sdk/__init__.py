"""
SDLC.ai Python SDK v3

The official Python SDK for the SDLC.ai Secure Data Learning Platform v3.
A Cloudflare-native, zero-trust middleware fabric for secure AI-data interactions.
"""

__version__ = "3.0.0"
__author__ = "SDLC.ai Team"
__email__ = "sdk@sdlc.ai"

from .client import SDLCClient, AsyncSDLCClient
from .config import Config
from .exceptions import (
    SDLCError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    RateLimitError,
    APIError,
    NetworkError,
    TimeoutError,
    NotFoundError,
    ConflictError,
    ServerError,
)

# Import auth classes
from .auth.base import BaseAuth
from .auth.api_key import APIKeyAuth
from .auth.oauth import OAuthAuth
from .auth.mtls import MTLSAuth

# Import main models
from .models.base import BaseModel
from .models.auth import AuthResponse, TokenInfo
from .models.user import User, UserCreate, UserUpdate
from .models.tenant import Tenant, TenantCreate, TenantUpdate
from .models.document import Document, DocumentUpload, DocumentProcessing
from .models.rag import RAGQuery, RAGResponse, RAGSource
from .models.policy import Policy, PolicyRule, PolicyTest
from .models.monitoring import Metrics, HealthCheck, AuditLog

__all__ = [
    # Version info
    "__version__",
    "__author__",
    "__email__",
    # Main clients
    "SDLCClient",
    "AsyncSDLCClient",
    "Config",
    # Exceptions
    "SDLCError",
    "AuthenticationError",
    "AuthorizationError",
    "ValidationError",
    "RateLimitError",
    "APIError",
    "NetworkError",
    "TimeoutError",
    "NotFoundError",
    "ConflictError",
    "ServerError",
    # Authentication
    "BaseAuth",
    "APIKeyAuth",
    "OAuthAuth",
    "MTLSAuth",
    # Models
    "BaseModel",
    "AuthResponse",
    "TokenInfo",
    "User",
    "UserCreate",
    "UserUpdate",
    "Tenant",
    "TenantCreate",
    "TenantUpdate",
    "Document",
    "DocumentUpload",
    "DocumentProcessing",
    "RAGQuery",
    "RAGResponse",
    "RAGSource",
    "Policy",
    "PolicyRule",
    "PolicyTest",
    "Metrics",
    "HealthCheck",
    "AuditLog",
]

# Configure logging
import structlog

logger = structlog.get_logger("sdlc_sdk")
logger.info("SDLC.ai SDK initialized", version=__version__)
