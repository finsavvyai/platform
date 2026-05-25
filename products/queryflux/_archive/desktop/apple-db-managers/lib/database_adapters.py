#!/usr/bin/env python3
"""
🚀 Ultimate Multi-Database Manager - Database Adapters
Comprehensive database adapter system supporting multiple database types
"""

import abc
import json
import sqlite3
import logging
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum

# Database drivers
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False

try:
    import pymongo
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False

try:
    import mysql.connector
    MYSQL_AVAILABLE = True
except ImportError:
    MYSQL_AVAILABLE = False

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

try:
    import cx_Oracle
    ORACLE_AVAILABLE = True
except ImportError:
    ORACLE_AVAILABLE = False

try:
    import pyodbc
    SQLSERVER_AVAILABLE = True
except ImportError:
    SQLSERVER_AVAILABLE = False

try:
    from clickhouse_driver import Client as ClickHouseClient
    CLICKHOUSE_AVAILABLE = True
except ImportError:
    CLICKHOUSE_AVAILABLE = False

try:
    from cassandra.cluster import Cluster
    CASSANDRA_AVAILABLE = True
except ImportError:
    CASSANDRA_AVAILABLE = False

try:
    from elasticsearch import Elasticsearch
    ELASTICSEARCH_AVAILABLE = True
except ImportError:
    ELASTICSEARCH_AVAILABLE = False

try:
    from influxdb_client import InfluxDBClient
    INFLUXDB_AVAILABLE = True
except ImportError:
    INFLUXDB_AVAILABLE = False

try:
    import couchdb
    COUCHDB_AVAILABLE = True
except ImportError:
    COUCHDB_AVAILABLE = False


class DatabaseType(Enum):
    """Supported database types"""
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MARIADB = "mariadb"
    MONGODB = "mongodb"
    REDIS = "redis"
    SQLITE = "sqlite"
    ORACLE = "oracle"
    SQLSERVER = "sqlserver"
    CLICKHOUSE = "clickhouse"
    CASSANDRA = "cassandra"
    ELASTICSEARCH = "elasticsearch"
    INFLUXDB = "influxdb"
    COUCHDB = "couchdb"


@dataclass
class ConnectionParams:
    """Database connection parameters"""
    db_type: DatabaseType
    host: str = "localhost"
    port: int = None
    username: str = ""
    password: str = ""
    database: str = ""
    ssl: bool = False
    additional_params: Dict[str, Any] = None

    def __post_init__(self):
        if self.additional_params is None:
            self.additional_params = {}
        
        # Set default ports if not specified
        if self.port is None:
            default_ports = {
                DatabaseType.POSTGRESQL: 5432,
                DatabaseType.MYSQL: 3306,
                DatabaseType.MARIADB: 3306,
                DatabaseType.MONGODB: 27017,
                DatabaseType.REDIS: 6379,
                DatabaseType.ORACLE: 1521,
                DatabaseType.SQLSERVER: 1433,
                DatabaseType.CLICKHOUSE: 8123,
                DatabaseType.CASSANDRA: 9042,
                DatabaseType.ELASTICSEARCH: 9200,
                DatabaseType.INFLUXDB: 8086,
                DatabaseType.COUCHDB: 5984,
            }
            self.port = default_ports.get(self.db_type, 5432)


@dataclass
class QueryResult:
    """Query execution result"""
    success: bool
    data: List[Dict[str, Any]] = None
    columns: List[str] = None
    rows_affected: int = 0
    execution_time: float = 0.0
    error: str = ""

    def __post_init__(self):
        if self.data is None:
            self.data = []
        if self.columns is None:
            self.columns = []


@dataclass
class TableInfo:
    """Table information structure"""
    name: str
    schema: str = ""
    columns: List[Dict[str, Any]] = None
    row_count: int = 0
    size_bytes: int = 0

    def __post_init__(self):
        if self.columns is None:
            self.columns = []


@dataclass
class SchemaInfo:
    """Schema information structure"""
    name: str
    tables: List[TableInfo] = None
    views: List[str] = None
    functions: List[str] = None

    def __post_init__(self):
        if self.tables is None:
            self.tables = []
        if self.views is None:
            self.views = []
        if self.functions is None:
            self.functions = []


class DatabaseAdapter(abc.ABC):
    """Abstract base class for database adapters"""

    def __init__(self, connection_params: ConnectionParams):
        self.connection_params = connection_params
        self.connection = None
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    @abc.abstractmethod
    def connect(self) -> bool:
        """Establish database connection"""
        pass

    @abc.abstractmethod
    def disconnect(self) -> bool:
        """Close database connection"""
        pass

    @abc.abstractmethod
    def test_connection(self) -> bool:
        """Test database connection"""
        pass

    @abc.abstractmethod
    def execute_query(self, query: str, params: List[Any] = None) -> QueryResult:
        """Execute a query and return results"""
        pass

    @abc.abstractmethod
    def get_schemas(self) -> List[SchemaInfo]:
        """Get list of schemas/databases"""
        pass

    @abc.abstractmethod
    def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get list of tables in schema"""
        pass

    @abc.abstractmethod
    def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get table data with optional limit"""
        pass

    @abc.abstractmethod
    def import_dump(self, file_path: str, **kwargs) -> bool:
        """Import data from dump file"""
        pass

    @abc.abstractmethod
    def export_dump(self, output_path: str, **kwargs) -> bool:
        """Export data to dump file"""
        pass

    def is_connected(self) -> bool:
        """Check if connection is active"""
        return self.connection is not None

    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information"""
        return {
            "type": self.connection_params.db_type.value,
            "host": self.connection_params.host,
            "port": self.connection_params.port,
            "database": self.connection_params.database,
            "username": self.connection_params.username,
            "ssl": self.connection_params.ssl,
            "connected": self.is_connected()
        }


class PostgreSQLAdapter(DatabaseAdapter):
    """PostgreSQL database adapter"""

    def connect(self) -> bool:
        """Establish PostgreSQL connection"""
        if not POSTGRES_AVAILABLE:
            self.logger.error("PostgreSQL driver not available")
            return False

        try:
            self.connection = psycopg2.connect(
                host=self.connection_params.host,
                port=self.connection_params.port,
                user=self.connection_params.username,
                password=self.connection_params.password,
                database=self.connection_params.database or 'postgres',
                cursor_factory=RealDictCursor,
                connect_timeout=10
            )
            self.logger.info("PostgreSQL connection established")
            return True
        except Exception as e:
            self.logger.error(f"PostgreSQL connection failed: {e}")
            return False

    def disconnect(self) -> bool:
        """Close PostgreSQL connection"""
        try:
            if self.connection:
                self.connection.close()
                self.connection = None
            return True
        except Exception as e:
            self.logger.error(f"PostgreSQL disconnect failed: {e}")
            return False

    def test_connection(self) -> bool:
        """Test PostgreSQL connection"""
        try:
            with self.connection.cursor() as cur:
                cur.execute("SELECT 1")
                return True
        except Exception:
            return False

    def execute_query(self, query: str, params: List[Any] = None) -> QueryResult:
        """Execute PostgreSQL query"""
        import time
        start_time = time.time()
        
        try:
            with self.connection.cursor() as cur:
                cur.execute(query, params)
                
                if cur.description:
                    # SELECT query
                    rows = cur.fetchall()
                    columns = [desc[0] for desc in cur.description]
                    data = [dict(row) for row in rows]
                    
                    return QueryResult(
                        success=True,
                        data=data,
                        columns=columns,
                        rows_affected=len(rows),
                        execution_time=time.time() - start_time
                    )
                else:
                    # INSERT/UPDATE/DELETE query
                    self.connection.commit()
                    return QueryResult(
                        success=True,
                        rows_affected=cur.rowcount,
                        execution_time=time.time() - start_time
                    )
                    
        except Exception as e:
            self.connection.rollback()
            return QueryResult(
                success=False,
                error=str(e),
                execution_time=time.time() - start_time
            )

    def get_schemas(self) -> List[SchemaInfo]:
        """Get PostgreSQL schemas"""
        query = """
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            ORDER BY schema_name
        """
        result = self.execute_query(query)
        
        schemas = []
        if result.success:
            for row in result.data:
                schema_info = SchemaInfo(name=row['schema_name'])
                schema_info.tables = self.get_tables(row['schema_name'])
                schemas.append(schema_info)
        
        return schemas

    def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get PostgreSQL tables"""
        if schema is None:
            schema = 'public'
            
        query = """
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = %s
            ORDER BY table_name
        """
        result = self.execute_query(query, [schema])
        
        tables = []
        if result.success:
            for row in result.data:
                table_info = TableInfo(
                    name=row['table_name'],
                    schema=schema
                )
                # Get column information
                col_query = """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position
                """
                col_result = self.execute_query(col_query, [schema, row['table_name']])
                if col_result.success:
                    table_info.columns = col_result.data
                
                tables.append(table_info)
        
        return tables

    def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get PostgreSQL table data"""
        if schema is None:
            schema = 'public'
            
        query = f'SELECT * FROM "{schema}"."{table}" LIMIT %s'
        return self.execute_query(query, [limit])

    def import_dump(self, file_path: str, **kwargs) -> bool:
        """Import PostgreSQL dump file"""
        import subprocess
        try:
            cmd = [
                'psql',
                f'-h{self.connection_params.host}',
                f'-p{self.connection_params.port}',
                f'-U{self.connection_params.username}',
                f'-d{self.connection_params.database}',
                '-f', file_path
            ]
            
            env = {'PGPASSWORD': self.connection_params.password}
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.logger.info(f"PostgreSQL dump imported successfully: {file_path}")
                return True
            else:
                self.logger.error(f"PostgreSQL import failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"PostgreSQL import error: {e}")
            return False

    def export_dump(self, output_path: str, **kwargs) -> bool:
        """Export PostgreSQL dump file"""
        import subprocess
        try:
            cmd = [
                'pg_dump',
                f'-h{self.connection_params.host}',
                f'-p{self.connection_params.port}',
                f'-U{self.connection_params.username}',
                f'-d{self.connection_params.database}',
                '-f', output_path
            ]
            
            # Add format option if specified
            format_type = kwargs.get('format', 'plain')
            if format_type != 'plain':
                cmd.extend(['-F', format_type])
            
            env = {'PGPASSWORD': self.connection_params.password}
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.logger.info(f"PostgreSQL dump exported successfully: {output_path}")
                return True
            else:
                self.logger.error(f"PostgreSQL export failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"PostgreSQL export error: {e}")
            return False


class MySQLAdapter(DatabaseAdapter):
    """MySQL/MariaDB database adapter"""

    def connect(self) -> bool:
        """Establish MySQL connection"""
        if not MYSQL_AVAILABLE:
            self.logger.error("MySQL driver not available")
            return False

        try:
            self.connection = mysql.connector.connect(
                host=self.connection_params.host,
                port=self.connection_params.port,
                user=self.connection_params.username,
                password=self.connection_params.password,
                database=self.connection_params.database,
                ssl_disabled=not self.connection_params.ssl,
                connection_timeout=10
            )
            self.logger.info("MySQL connection established")
            return True
        except Exception as e:
            self.logger.error(f"MySQL connection failed: {e}")
            return False

    def disconnect(self) -> bool:
        """Close MySQL connection"""
        try:
            if self.connection:
                self.connection.close()
                self.connection = None
            return True
        except Exception as e:
            self.logger.error(f"MySQL disconnect failed: {e}")
            return False

    def test_connection(self) -> bool:
        """Test MySQL connection"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False

    def execute_query(self, query: str, params: List[Any] = None) -> QueryResult:
        """Execute MySQL query"""
        import time
        start_time = time.time()
        
        try:
            cursor = self.connection.cursor(dictionary=True)
            cursor.execute(query, params)
            
            if cursor.description:
                # SELECT query
                rows = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description]
                
                return QueryResult(
                    success=True,
                    data=rows,
                    columns=columns,
                    rows_affected=len(rows),
                    execution_time=time.time() - start_time
                )
            else:
                # INSERT/UPDATE/DELETE query
                self.connection.commit()
                return QueryResult(
                    success=True,
                    rows_affected=cursor.rowcount,
                    execution_time=time.time() - start_time
                )
                
        except Exception as e:
            self.connection.rollback()
            return QueryResult(
                success=False,
                error=str(e),
                execution_time=time.time() - start_time
            )
        finally:
            if 'cursor' in locals():
                cursor.close()

    def get_schemas(self) -> List[SchemaInfo]:
        """Get MySQL databases"""
        query = "SHOW DATABASES"
        result = self.execute_query(query)
        
        schemas = []
        if result.success:
            for row in result.data:
                db_name = row['Database']
                if db_name not in ['information_schema', 'performance_schema', 'mysql', 'sys']:
                    schema_info = SchemaInfo(name=db_name)
                    schemas.append(schema_info)
        
        return schemas

    def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get MySQL tables"""
        if schema:
            query = f"SHOW TABLES FROM `{schema}`"
        else:
            query = "SHOW TABLES"
            
        result = self.execute_query(query)
        
        tables = []
        if result.success:
            for row in result.data:
                table_name = list(row.values())[0]  # Get first column value
                table_info = TableInfo(
                    name=table_name,
                    schema=schema or self.connection_params.database
                )
                tables.append(table_info)
        
        return tables

    def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get MySQL table data"""
        if schema:
            query = f"SELECT * FROM `{schema}`.`{table}` LIMIT %s"
        else:
            query = f"SELECT * FROM `{table}` LIMIT %s"
        return self.execute_query(query, [limit])

    def import_dump(self, file_path: str, **kwargs) -> bool:
        """Import MySQL dump file"""
        import subprocess
        try:
            cmd = [
                'mysql',
                f'-h{self.connection_params.host}',
                f'-P{self.connection_params.port}',
                f'-u{self.connection_params.username}',
                f'-p{self.connection_params.password}',
                self.connection_params.database
            ]
            
            with open(file_path, 'r') as dump_file:
                result = subprocess.run(cmd, stdin=dump_file, capture_output=True, text=True)
            
            if result.returncode == 0:
                self.logger.info(f"MySQL dump imported successfully: {file_path}")
                return True
            else:
                self.logger.error(f"MySQL import failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"MySQL import error: {e}")
            return False

    def export_dump(self, output_path: str, **kwargs) -> bool:
        """Export MySQL dump file"""
        import subprocess
        try:
            cmd = [
                'mysqldump',
                f'-h{self.connection_params.host}',
                f'-P{self.connection_params.port}',
                f'-u{self.connection_params.username}',
                f'-p{self.connection_params.password}',
                self.connection_params.database
            ]
            
            with open(output_path, 'w') as dump_file:
                result = subprocess.run(cmd, stdout=dump_file, stderr=subprocess.PIPE, text=True)
            
            if result.returncode == 0:
                self.logger.info(f"MySQL dump exported successfully: {output_path}")
                return True
            else:
                self.logger.error(f"MySQL export failed: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"MySQL export error: {e}")
            return False


class SQLiteAdapter(DatabaseAdapter):
    """SQLite database adapter"""

    def connect(self) -> bool:
        """Establish SQLite connection"""
        try:
            # For SQLite, the database parameter is the file path
            db_path = self.connection_params.database or ':memory:'
            self.connection = sqlite3.connect(db_path)
            self.connection.row_factory = sqlite3.Row  # Enable dict-like access
            self.logger.info(f"SQLite connection established: {db_path}")
            return True
        except Exception as e:
            self.logger.error(f"SQLite connection failed: {e}")
            return False

    def disconnect(self) -> bool:
        """Close SQLite connection"""
        try:
            if self.connection:
                self.connection.close()
                self.connection = None
            return True
        except Exception as e:
            self.logger.error(f"SQLite disconnect failed: {e}")
            return False

    def test_connection(self) -> bool:
        """Test SQLite connection"""
        try:
            cursor = self.connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            return True
        except Exception:
            return False

    def execute_query(self, query: str, params: List[Any] = None) -> QueryResult:
        """Execute SQLite query"""
        import time
        start_time = time.time()
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(query, params or [])
            
            if cursor.description:
                # SELECT query
                rows = cursor.fetchall()
                columns = [desc[0] for desc in cursor.description]
                data = [dict(row) for row in rows]
                
                return QueryResult(
                    success=True,
                    data=data,
                    columns=columns,
                    rows_affected=len(rows),
                    execution_time=time.time() - start_time
                )
            else:
                # INSERT/UPDATE/DELETE query
                self.connection.commit()
                return QueryResult(
                    success=True,
                    rows_affected=cursor.rowcount,
                    execution_time=time.time() - start_time
                )
                
        except Exception as e:
            self.connection.rollback()
            return QueryResult(
                success=False,
                error=str(e),
                execution_time=time.time() - start_time
            )
        finally:
            if 'cursor' in locals():
                cursor.close()

    def get_schemas(self) -> List[SchemaInfo]:
        """Get SQLite schemas (databases)"""
        # SQLite has a main database and attached databases
        query = "PRAGMA database_list"
        result = self.execute_query(query)
        
        schemas = []
        if result.success:
            for row in result.data:
                schema_info = SchemaInfo(name=row['name'])
                schema_info.tables = self.get_tables(row['name'])
                schemas.append(schema_info)
        
        return schemas

    def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get SQLite tables"""
        query = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        result = self.execute_query(query)
        
        tables = []
        if result.success:
            for row in result.data:
                table_info = TableInfo(
                    name=row['name'],
                    schema=schema or 'main'
                )
                # Get column information
                col_query = f"PRAGMA table_info({row['name']})"
                col_result = self.execute_query(col_query)
                if col_result.success:
                    table_info.columns = col_result.data
                
                tables.append(table_info)
        
        return tables

    def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get SQLite table data"""
        query = f"SELECT * FROM `{table}` LIMIT ?"
        return self.execute_query(query, [limit])

    def import_dump(self, file_path: str, **kwargs) -> bool:
        """Import SQLite dump file"""
        try:
            with open(file_path, 'r') as dump_file:
                sql_script = dump_file.read()
                self.connection.executescript(sql_script)
                self.connection.commit()
            
            self.logger.info(f"SQLite dump imported successfully: {file_path}")
            return True
        except Exception as e:
            self.logger.error(f"SQLite import error: {e}")
            return False

    def export_dump(self, output_path: str, **kwargs) -> bool:
        """Export SQLite dump file"""
        try:
            with open(output_path, 'w') as dump_file:
                for line in self.connection.iterdump():
                    dump_file.write(f"{line}\n")
            
            self.logger.info(f"SQLite dump exported successfully: {output_path}")
            return True
        except Exception as e:
            self.logger.error(f"SQLite export error: {e}")
            return False


class DatabaseAdapterFactory:
    """Factory class for creating database adapters"""
    
    _adapters = {
        DatabaseType.POSTGRESQL: PostgreSQLAdapter,
        DatabaseType.MYSQL: MySQLAdapter,
        DatabaseType.MARIADB: MySQLAdapter,  # Use MySQL adapter for MariaDB
        DatabaseType.SQLITE: SQLiteAdapter,
        # TODO: Add other database adapters
    }
    
    @classmethod
    def create_adapter(cls, connection_params: ConnectionParams) -> DatabaseAdapter:
        """Create appropriate database adapter"""
        adapter_class = cls._adapters.get(connection_params.db_type)
        
        if adapter_class is None:
            raise ValueError(f"Unsupported database type: {connection_params.db_type}")
        
        return adapter_class(connection_params)
    
    @classmethod
    def get_supported_databases(cls) -> List[DatabaseType]:
        """Get list of supported database types"""
        return list(cls._adapters.keys())
    
    @classmethod
    def is_driver_available(cls, db_type: DatabaseType) -> bool:
        """Check if database driver is available"""
        availability_map = {
            DatabaseType.POSTGRESQL: POSTGRES_AVAILABLE,
            DatabaseType.MYSQL: MYSQL_AVAILABLE,
            DatabaseType.MARIADB: MYSQL_AVAILABLE,
            DatabaseType.MONGODB: MONGODB_AVAILABLE,
            DatabaseType.REDIS: REDIS_AVAILABLE,
            DatabaseType.SQLITE: True,  # Built-in to Python
            DatabaseType.ORACLE: ORACLE_AVAILABLE,
            DatabaseType.SQLSERVER: SQLSERVER_AVAILABLE,
            DatabaseType.CLICKHOUSE: CLICKHOUSE_AVAILABLE,
            DatabaseType.CASSANDRA: CASSANDRA_AVAILABLE,
            DatabaseType.ELASTICSEARCH: ELASTICSEARCH_AVAILABLE,
            DatabaseType.INFLUXDB: INFLUXDB_AVAILABLE,
            DatabaseType.COUCHDB: COUCHDB_AVAILABLE,
        }
        return availability_map.get(db_type, False)


# Example usage and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Test PostgreSQL adapter
    if POSTGRES_AVAILABLE:
        postgres_params = ConnectionParams(
            db_type=DatabaseType.POSTGRESQL,
            host="localhost",
            port=5432,
            username="postgres",
            password="password",
            database="postgres"
        )
        
        adapter = DatabaseAdapterFactory.create_adapter(postgres_params)
        if adapter.connect():
            print("PostgreSQL connection successful!")
            
            # Test query
            result = adapter.execute_query("SELECT version()")
            if result.success:
                print(f"PostgreSQL version: {result.data[0]}")
            
            adapter.disconnect()
    
    # Test SQLite adapter
    sqlite_params = ConnectionParams(
        db_type=DatabaseType.SQLITE,
        database=":memory:"
    )
    
    adapter = DatabaseAdapterFactory.create_adapter(sqlite_params)
    if adapter.connect():
        print("SQLite connection successful!")
        
        # Create test table
        adapter.execute_query("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
        adapter.execute_query("INSERT INTO test (name) VALUES (?)", ["Test Name"])
        
        # Query data
        result = adapter.execute_query("SELECT * FROM test")
        if result.success:
            print(f"SQLite test data: {result.data}")
        
        adapter.disconnect()
