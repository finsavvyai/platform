"""
Enterprise API Gateway for UPM.Plus AutomationHub

This package provides comprehensive API gateway functionality including:
- API key management with scoped permissions
- Advanced rate limiting with Redis integration
- Request/response transformation and validation
- API versioning support
- WebSocket proxy functionality
- Comprehensive security middleware
- Usage analytics and monitoring
- Circuit breaker and health checks

Architecture Features:
- Integration with existing RBAC system
- Support for multiple authentication methods
- Distributed rate limiting across multiple gateway instances
- Configurable policies and rules engine
- Real-time monitoring and alerting
- Zero-downtime configuration updates

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

from .core import APIGateway
from .middleware import GatewayMiddleware
from .auth import GatewayAuthenticator
from .rate_limiter import RateLimiter
from .transformer import RequestTransformer, ResponseTransformer
from .versioning import APIVersioning
from .websocket import WebSocketProxy
from .config import GatewayConfig

__version__ = "1.0.0"
__all__ = [
    "APIGateway",
    "GatewayMiddleware",
    "GatewayAuthenticator",
    "RateLimiter",
    "RequestTransformer",
    "ResponseTransformer",
    "APIVersioning",
    "WebSocketProxy",
    "GatewayConfig",
]