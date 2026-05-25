"""
Database infrastructure for Universal Dependency Platform.

Provides database connection management, session handling,
transaction management, and health monitoring.
"""

from ..database_manager import (
    DatabaseManager,
    check_database_health,
    close_database,
    db_manager,
    get_async_session,
    init_database,
)

# Aliases for backward compatibility with consumers
DatabaseConnectionManager = DatabaseManager
get_db_session = get_async_session
initialize_database = init_database
init_db = init_database
close_db = close_database

# Expose session maker via db_manager for test fixtures
async_session_maker = None  # Lazily set after init


def get_session_factory():
    """Get the session factory from the database manager."""
    return db_manager._session_factory


__all__ = [
    "DatabaseManager",
    "DatabaseConnectionManager",
    "db_manager",
    "get_async_session",
    "get_db_session",
    "check_database_health",
    "init_database",
    "initialize_database",
    "init_db",
    "close_database",
    "close_db",
    "async_session_maker",
    "get_session_factory",
]
