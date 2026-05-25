"""
UPM infrastructure components.

Provides database connections, caching, external service integrations,
and other infrastructure-level functionality.
"""

from .database import (
    DatabaseConnectionManager,
    DatabaseManager,
    check_database_health,
    close_database,
    close_db,
    db_manager,
    get_async_session,
    get_db_session,
    init_database,
    init_db,
    initialize_database,
)

__all__ = [
    # Database management
    "DatabaseManager",
    "DatabaseConnectionManager",
    "db_manager",
    "get_async_session",
    "get_db_session",
    "initialize_database",
    "init_database",
    "init_db",
    "close_database",
    "close_db",
    "check_database_health",
]
