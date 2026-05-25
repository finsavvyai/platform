"""
Secure database connection manager with SQL injection prevention
"""

import psycopg2
from psycopg2 import pool, sql
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional, Dict, Any, List, Union
import logging
from dataclasses import dataclass
from enum import Enum

from .security import (
    DatabaseCredentials,
    SQLInjectionPrevention,
    SecurityError,
    credential_manager
)

logger = logging.getLogger(__name__)

class DatabaseType(Enum):
    POSTGRESQL = "postgresql"
    MONGODB = "mongodb"
    REDIS = "redis"
    ORACLE = "oracle"

@dataclass
class QueryResult:
    """Query execution result"""
    data: List[Dict[str, Any]]
    columns: List[str]
    row_count: int
    execution_time: float
    query: str

class SecureDatabaseManager:
    """Secure database connection manager with SQL injection prevention"""

    def __init__(self, max_connections: int = 20):
        self.max_connections = max_connections
        self.connection_pools: Dict[str, Any] = {}
        self.credentials_cache: Dict[str, DatabaseCredentials] = {}

    def register_connection(self, connection_id: str, credentials: DatabaseCredentials) -> None:
        """Register a new database connection"""
        try:
            # Test connection first
            self._test_connection(credentials)

            # Store credentials securely
            credential_manager.store_credentials(connection_id, credentials)

            # Create connection pool
            self._create_pool(connection_id, credentials)

            # Cache credentials (without password)
            safe_creds = DatabaseCredentials(
                host=credentials.host,
                port=credentials.port,
                username=credentials.username,
                password="***",  # Hidden
                database=credentials.database,
                ssl=credentials.ssl
            )
            self.credentials_cache[connection_id] = safe_creds

            logger.info(f"Connection {connection_id} registered successfully")

        except Exception as e:
            logger.error(f"Failed to register connection {connection_id}: {str(e)}")
            raise SecurityError(f"Connection registration failed: {str(e)}")

    def _test_connection(self, credentials: DatabaseCredentials) -> None:
        """Test database connection"""
        try:
            conn = psycopg2.connect(
                host=credentials.host,
                port=credentials.port,
                user=credentials.username,
                password=credentials.password,
                database=credentials.database or 'postgres',
                sslmode='require' if credentials.ssl else 'prefer',
                connect_timeout=10
            )
            conn.close()
        except psycopg2.Error as e:
            raise SecurityError(f"Database connection failed: {str(e)}")

    def _create_pool(self, connection_id: str, credentials: DatabaseCredentials) -> None:
        """Create connection pool for a database"""
        try:
            connection_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=self.max_connections,
                host=credentials.host,
                port=credentials.port,
                user=credentials.username,
                password=credentials.password,
                database=credentials.database or 'postgres',
                sslmode='require' if credentials.ssl else 'prefer',
                cursor_factory=RealDictCursor
            )
            self.connection_pools[connection_id] = connection_pool

        except psycopg2.Error as e:
            raise SecurityError(f"Failed to create connection pool: {str(e)}")

    @contextmanager
    def get_connection(self, connection_id: str):
        """Get database connection from pool"""
        if connection_id not in self.connection_pools:
            # Try to load credentials and create pool
            credentials = credential_manager.get_credentials(connection_id)
            if not credentials:
                raise SecurityError(f"Connection {connection_id} not found")
            self._create_pool(connection_id, credentials)

        pool_obj = self.connection_pools[connection_id]
        conn = None
        try:
            conn = pool_obj.getconn()
            yield conn
        finally:
            if conn:
                pool_obj.putconn(conn)

    def execute_query(
        self,
        connection_id: str,
        query: str,
        params: Optional[tuple] = None,
        allowed_operations: Optional[set[str]] = None
    ) -> QueryResult:
        """Execute SQL query with security checks"""
        import time

        start_time = time.time()

        # Security validation
        if allowed_operations and not SQLInjectionPrevention.validate_query_type(
            query, allowed_operations
        ):
            raise SecurityError(f"Query type not allowed. Permitted: {allowed_operations}")

        try:
            with self.get_connection(connection_id) as conn:
                with conn.cursor() as cursor:
                    # Execute parameterized query
                    if params:
                        cursor.execute(query, params)
                    else:
                        cursor.execute(query)

                    # Fetch results for SELECT queries
                    columns = []
                    data = []
                    row_count = cursor.rowcount

                    if cursor.description:
                        columns = [desc[0] for desc in cursor.description]
                        data = cursor.fetchall()
                        # Convert RealDictRow to regular dict
                        data = [dict(row) for row in data]

                    conn.commit()

                    execution_time = time.time() - start_time

                    return QueryResult(
                        data=data,
                        columns=columns,
                        row_count=row_count,
                        execution_time=execution_time,
                        query=query
                    )

        except psycopg2.Error as e:
            logger.error(f"Query execution failed: {str(e)}")
            raise SecurityError(f"Query execution failed: {str(e)}")

    def execute_admin_query(
        self,
        connection_id: str,
        query: str,
        params: Optional[tuple] = None
    ) -> QueryResult:
        """Execute administrative query (CREATE, DROP, etc.) with extra security"""
        # Only allow specific admin operations
        allowed_admin_ops = {'CREATE', 'DROP', 'ALTER', 'GRANT', 'REVOKE'}

        return self.execute_query(
            connection_id,
            query,
            params,
            allowed_operations=allowed_admin_ops
        )

    def get_databases(self, connection_id: str) -> List[str]:
        """Get list of databases (secure)"""
        query = """
        SELECT datname FROM pg_database
        WHERE datistemplate = false
        ORDER BY datname
        """

        result = self.execute_query(
            connection_id,
            query,
            allowed_operations={'SELECT'}
        )

        return [row['datname'] for row in result.data]

    def get_tables(self, connection_id: str, schema: str = 'public') -> List[Dict[str, Any]]:
        """Get list of tables in schema (secure)"""
        # Validate schema name
        schema = SQLInjectionPrevention.sanitize_identifier(schema)

        query = """
        SELECT schemaname, tablename, tableowner, tablespace, hasindexes, hasrules, hastriggers
        FROM pg_tables
        WHERE schemaname = %s
        ORDER BY tablename
        """

        result = self.execute_query(
            connection_id,
            query,
            params=(schema,),
            allowed_operations={'SELECT'}
        )

        return result.data

    def get_table_structure(self, connection_id: str, table_name: str, schema: str = 'public') -> List[Dict[str, Any]]:
        """Get table structure (secure)"""
        # Validate identifiers
        table_name = SQLInjectionPrevention.sanitize_identifier(table_name)
        schema = SQLInjectionPrevention.sanitize_identifier(schema)

        query = """
        SELECT
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """

        result = self.execute_query(
            connection_id,
            query,
            params=(schema, table_name),
            allowed_operations={'SELECT'}
        )

        return result.data

    def get_table_data(
        self,
        connection_id: str,
        table_name: str,
        schema: str = 'public',
        limit: int = 1000,
        offset: int = 0
    ) -> QueryResult:
        """Get table data with pagination (secure)"""
        # Validate inputs
        table_name = SQLInjectionPrevention.sanitize_identifier(table_name)
        schema = SQLInjectionPrevention.sanitize_identifier(schema)

        if limit > 10000:  # Safety limit
            limit = 10000

        # Use sql.Identifier for safe identifier formatting
        query = sql.SQL("""
        SELECT * FROM {schema}.{table}
        ORDER BY (SELECT NULL)
        LIMIT %s OFFSET %s
        """).format(
            schema=sql.Identifier(schema),
            table=sql.Identifier(table_name)
        )

        return self.execute_query(
            connection_id,
            query.as_string(psycopg2.extensions.connection('')),
            params=(limit, offset),
            allowed_operations={'SELECT'}
        )

    def create_database(self, connection_id: str, database_name: str) -> None:
        """Create database (secure)"""
        # Validate database name
        database_name = SQLInjectionPrevention.sanitize_identifier(database_name)

        # Use sql.Identifier for safe database creation
        query = sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))

        # Connect to postgres database for creating new database
        temp_creds = credential_manager.get_credentials(connection_id)
        if not temp_creds:
            raise SecurityError("Connection credentials not found")

        temp_creds.database = 'postgres'  # Connect to postgres db

        try:
            conn = psycopg2.connect(
                host=temp_creds.host,
                port=temp_creds.port,
                user=temp_creds.username,
                password=temp_creds.password,
                database='postgres'
            )
            conn.autocommit = True

            with conn.cursor() as cursor:
                cursor.execute(query)

            conn.close()
            logger.info(f"Database {database_name} created successfully")

        except psycopg2.Error as e:
            logger.error(f"Failed to create database {database_name}: {str(e)}")
            raise SecurityError(f"Database creation failed: {str(e)}")

    def drop_database(self, connection_id: str, database_name: str) -> None:
        """Drop database (secure with confirmation)"""
        # Validate database name
        database_name = SQLInjectionPrevention.sanitize_identifier(database_name)

        # Prevent dropping system databases
        system_dbs = {'postgres', 'template0', 'template1'}
        if database_name.lower() in system_dbs:
            raise SecurityError(f"Cannot drop system database: {database_name}")

        # Use sql.Identifier for safe database dropping
        query = sql.SQL("DROP DATABASE {}").format(sql.Identifier(database_name))

        # Connect to postgres database
        temp_creds = credential_manager.get_credentials(connection_id)
        if not temp_creds:
            raise SecurityError("Connection credentials not found")

        temp_creds.database = 'postgres'

        try:
            conn = psycopg2.connect(
                host=temp_creds.host,
                port=temp_creds.port,
                user=temp_creds.username,
                password=temp_creds.password,
                database='postgres'
            )
            conn.autocommit = True

            with conn.cursor() as cursor:
                cursor.execute(query)

            conn.close()
            logger.info(f"Database {database_name} dropped successfully")

        except psycopg2.Error as e:
            logger.error(f"Failed to drop database {database_name}: {str(e)}")
            raise SecurityError(f"Database drop failed: {str(e)}")

    def get_connection_info(self, connection_id: str) -> Optional[DatabaseCredentials]:
        """Get connection information (without password)"""
        return self.credentials_cache.get(connection_id)

    def list_connections(self) -> List[str]:
        """List all registered connections"""
        return credential_manager.list_connections()

    def remove_connection(self, connection_id: str) -> None:
        """Remove connection and clean up resources"""
        try:
            # Close connection pool
            if connection_id in self.connection_pools:
                pool_obj = self.connection_pools[connection_id]
                pool_obj.closeall()
                del self.connection_pools[connection_id]

            # Remove from cache
            if connection_id in self.credentials_cache:
                del self.credentials_cache[connection_id]

            # Remove stored credentials
            credential_manager.delete_credentials(connection_id)

            logger.info(f"Connection {connection_id} removed successfully")

        except Exception as e:
            logger.error(f"Failed to remove connection {connection_id}: {str(e)}")
            raise SecurityError(f"Connection removal failed: {str(e)}")

# Global instance
db_manager = SecureDatabaseManager()

__all__ = [
    'DatabaseType',
    'QueryResult',
    'SecureDatabaseManager',
    'db_manager'
]