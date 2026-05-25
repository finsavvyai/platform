"""
Unified Database Adapters
Support for both SQL and NoSQL databases through a unified interface
"""

from .base_adapter import DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult
from .adapter_factory import AdapterFactory
from .sql_adapters import PostgreSQLAdapter, MySQLAdapter, SQLiteAdapter
from .nosql_adapters import MongoDBAdapter, RedisAdapter

__all__ = [
    'DatabaseAdapter',
    'DatabaseType',
    'ConnectionParams', 
    'QueryResult',
    'AdapterFactory',
    'PostgreSQLAdapter',
    'MySQLAdapter',
    'SQLiteAdapter',
    'MongoDBAdapter',
    'RedisAdapter'
]