"""
Database core package for the RAG service.

This package provides the core database functionality including connection management,
health monitoring, async session handling, and multi-tenant support.
"""

from .connection import (
    DatabaseConfig,
    DatabaseManager,
    TenantAwareDatabaseManager,
    MultiDatabaseManager,
    get_database_manager,
    get_multi_database_manager,
    close_database_connections,
    get_db_session,
    get_tenant_db_session,
)

from .health import (
    HealthStatus,
    ConnectionStats,
    HealthChecker,
    CircuitBreaker,
    HealthCheckMiddleware,
)

__all__ = [
    # Connection management
    "DatabaseConfig",
    "DatabaseManager",
    "TenantAwareDatabaseManager",
    "MultiDatabaseManager",
    "get_database_manager",
    "get_multi_database_manager",
    "close_database_connections",
    "get_db_session",
    "get_tenant_db_session",
    # Health monitoring
    "HealthStatus",
    "ConnectionStats",
    "HealthChecker",
    "CircuitBreaker",
    "HealthCheckMiddleware",
]

# Version information
__version__ = "1.0.0"
__author__ = "SDLC.ai Team"
__description__ = "Database core functionality for RAG service"
