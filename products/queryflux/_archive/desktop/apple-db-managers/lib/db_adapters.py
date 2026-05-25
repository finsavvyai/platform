#!/usr/bin/env python3
"""
Database Adapters System
Inspired by Beekeeper Studio's multi-database architecture
"""

import abc
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
import asyncio

# Database connection info
@dataclass
class DatabaseConfig:
    """Database connection configuration"""
    host: str = "localhost"
    port: int = 5432
    username: str = ""
    password: str = ""
    database: str = ""
    ssl: bool = False
    connection_timeout: int = 10
    extra_params: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra_params is None:
            self.extra_params = {}

# Query result structures
@dataclass
class QueryResult:
    """Query execution result"""
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: float
    has_more: bool = False

@dataclass
class TableInfo:
    """Table information"""
    name: str
    schema: str
    type: str  # 'table', 'view', 'materialized_view'
    row_count: Optional[int] = None
    comment: Optional[str] = None

@dataclass
class ColumnInfo:
    """Column information"""
    name: str
    data_type: str
    is_nullable: bool
    is_primary_key: bool
    default_value: Optional[str] = None
    comment: Optional[str] = None

# Base database adapter
class BaseDatabaseAdapter(abc.ABC):
    """Base class for all database adapters"""

    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.connection = None
        self.is_connected = False

    @abc.abstractmethod
    async def connect(self) -> bool:
        """Connect to database"""
        pass

    @abc.abstractmethod
    async def disconnect(self):
        """Disconnect from database"""
        pass

    @abc.abstractmethod
    async def test_connection(self) -> bool:
        """Test database connection"""
        pass

    @abc.abstractmethod
    async def execute_query(self, query: str) -> QueryResult:
        """Execute SQL query"""
        pass

    @abc.abstractmethod
    async def get_schemas(self) -> List[str]:
        """Get list of schemas"""
        pass

    @abc.abstractmethod
    async def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get list of tables in schema"""
        pass

    @abc.abstractmethod
    async def get_table_columns(self, table: str, schema: str = None) -> List[ColumnInfo]:
        """Get columns for a table"""
        pass

    @abc.abstractmethod
    async def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get data from table"""
        pass

    @property
    @abc.abstractmethod
    def database_type(self) -> str:
        """Database type identifier"""
        pass

    @property
    @abc.abstractmethod
    def default_port(self) -> int:
        """Default port for this database type"""
        pass

    @property
    @abc.abstractmethod
    def icon(self) -> str:
        """Emoji icon for this database type"""
        pass

    @property
    @abc.abstractmethod
    def color(self) -> str:
        """Brand color for this database type"""
        pass

# PostgreSQL Adapter
class PostgreSQLAdapter(BaseDatabaseAdapter):
    """PostgreSQL database adapter"""

    @property
    def database_type(self) -> str:
        return "postgresql"

    @property
    def default_port(self) -> int:
        return 5432

    @property
    def icon(self) -> str:
        return "🐘"

    @property
    def color(self) -> str:
        return "#336791"

    async def connect(self) -> bool:
        """Connect to PostgreSQL"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor

            self.connection = psycopg2.connect(
                host=self.config.host,
                port=self.config.port,
                user=self.config.username,
                password=self.config.password,
                database=self.config.database or 'postgres',
                cursor_factory=RealDictCursor,
                connect_timeout=self.config.connection_timeout
            )
            self.is_connected = True
            return True
        except Exception as e:
            raise ConnectionError(f"PostgreSQL connection failed: {str(e)}")

    async def disconnect(self):
        """Disconnect from PostgreSQL"""
        if self.connection:
            self.connection.close()
            self.is_connected = False

    async def test_connection(self) -> bool:
        """Test PostgreSQL connection"""
        try:
            await self.connect()
            with self.connection.cursor() as cur:
                cur.execute("SELECT 1")
            await self.disconnect()
            return True
        except:
            return False

    async def execute_query(self, query: str) -> QueryResult:
        """Execute PostgreSQL query"""
        import time
        start_time = time.time()

        with self.connection.cursor() as cur:
            cur.execute(query)

            if cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = [list(row.values()) if hasattr(row, 'values') else list(row) for row in cur.fetchall()]
                row_count = len(rows)
            else:
                columns = []
                rows = []
                row_count = cur.rowcount

        execution_time = (time.time() - start_time) * 1000
        return QueryResult(columns, rows, row_count, execution_time)

    async def get_schemas(self) -> List[str]:
        """Get PostgreSQL schemas"""
        with self.connection.cursor() as cur:
            cur.execute("""
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                ORDER BY schema_name
            """)
            return [row['schema_name'] for row in cur.fetchall()]

    async def get_tables(self, schema: str = "public") -> List[TableInfo]:
        """Get PostgreSQL tables"""
        with self.connection.cursor() as cur:
            cur.execute("""
                SELECT table_name, table_type
                FROM information_schema.tables
                WHERE table_schema = %s
                ORDER BY table_type, table_name
            """, (schema,))

            tables = []
            for row in cur.fetchall():
                table_type = 'table' if row['table_type'] == 'BASE TABLE' else 'view'
                tables.append(TableInfo(row['table_name'], schema, table_type))
            return tables

    async def get_table_columns(self, table: str, schema: str = "public") -> List[ColumnInfo]:
        """Get PostgreSQL table columns"""
        with self.connection.cursor() as cur:
            cur.execute("""
                SELECT
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    tc.constraint_type = 'PRIMARY KEY' as is_primary_key
                FROM information_schema.columns c
                LEFT JOIN information_schema.key_column_usage kcu
                    ON c.table_name = kcu.table_name
                    AND c.column_name = kcu.column_name
                    AND c.table_schema = kcu.table_schema
                LEFT JOIN information_schema.table_constraints tc
                    ON kcu.constraint_name = tc.constraint_name
                    AND kcu.table_schema = tc.table_schema
                WHERE c.table_schema = %s AND c.table_name = %s
                ORDER BY c.ordinal_position
            """, (schema, table))

            columns = []
            for row in cur.fetchall():
                columns.append(ColumnInfo(
                    name=row['column_name'],
                    data_type=row['data_type'],
                    is_nullable=row['is_nullable'] == 'YES',
                    is_primary_key=bool(row['is_primary_key']),
                    default_value=row['column_default']
                ))
            return columns

    async def get_table_data(self, table: str, schema: str = "public", limit: int = 1000) -> QueryResult:
        """Get PostgreSQL table data"""
        query = f'SELECT * FROM "{schema}"."{table}" LIMIT {limit}'
        return await self.execute_query(query)

# MySQL Adapter
class MySQLAdapter(BaseDatabaseAdapter):
    """MySQL/MariaDB database adapter"""

    @property
    def database_type(self) -> str:
        return "mysql"

    @property
    def default_port(self) -> int:
        return 3306

    @property
    def icon(self) -> str:
        return "🐬"

    @property
    def color(self) -> str:
        return "#4479A1"

    async def connect(self) -> bool:
        """Connect to MySQL"""
        try:
            import mysql.connector

            self.connection = mysql.connector.connect(
                host=self.config.host,
                port=self.config.port,
                user=self.config.username,
                password=self.config.password,
                database=self.config.database,
                connection_timeout=self.config.connection_timeout
            )
            self.is_connected = True
            return True
        except Exception as e:
            raise ConnectionError(f"MySQL connection failed: {str(e)}")

    async def disconnect(self):
        """Disconnect from MySQL"""
        if self.connection:
            self.connection.close()
            self.is_connected = False

    async def test_connection(self) -> bool:
        """Test MySQL connection"""
        try:
            await self.connect()
            cursor = self.connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
            await self.disconnect()
            return True
        except:
            return False

    async def execute_query(self, query: str) -> QueryResult:
        """Execute MySQL query"""
        import time
        start_time = time.time()

        cursor = self.connection.cursor()
        cursor.execute(query)

        if cursor.description:
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            row_count = len(rows)
        else:
            columns = []
            rows = []
            row_count = cursor.rowcount

        cursor.close()
        execution_time = (time.time() - start_time) * 1000
        return QueryResult(columns, [list(row) for row in rows], row_count, execution_time)

    async def get_schemas(self) -> List[str]:
        """Get MySQL schemas (databases)"""
        cursor = self.connection.cursor()
        cursor.execute("SHOW DATABASES")
        schemas = [row[0] for row in cursor.fetchall()
                  if row[0] not in ('information_schema', 'performance_schema', 'mysql', 'sys')]
        cursor.close()
        return schemas

    async def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get MySQL tables"""
        cursor = self.connection.cursor()
        if schema:
            cursor.execute(f"USE `{schema}`")

        cursor.execute("SHOW FULL TABLES")
        tables = []
        for row in cursor.fetchall():
            table_type = 'table' if row[1] == 'BASE TABLE' else 'view'
            tables.append(TableInfo(row[0], schema or self.config.database, table_type))
        cursor.close()
        return tables

    async def get_table_columns(self, table: str, schema: str = None) -> List[ColumnInfo]:
        """Get MySQL table columns"""
        cursor = self.connection.cursor()
        if schema:
            cursor.execute(f"USE `{schema}`")

        cursor.execute(f"DESCRIBE `{table}`")
        columns = []
        for row in cursor.fetchall():
            columns.append(ColumnInfo(
                name=row[0],
                data_type=row[1],
                is_nullable=row[2] == 'YES',
                is_primary_key=row[3] == 'PRI',
                default_value=row[4]
            ))
        cursor.close()
        return columns

    async def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get MySQL table data"""
        table_ref = f"`{schema}`.`{table}`" if schema else f"`{table}`"
        query = f"SELECT * FROM {table_ref} LIMIT {limit}"
        return await self.execute_query(query)

# MongoDB Adapter
class MongoDBAdapter(BaseDatabaseAdapter):
    """MongoDB database adapter"""

    @property
    def database_type(self) -> str:
        return "mongodb"

    @property
    def default_port(self) -> int:
        return 27017

    @property
    def icon(self) -> str:
        return "🍃"

    @property
    def color(self) -> str:
        return "#47A248"

    async def connect(self) -> bool:
        """Connect to MongoDB"""
        try:
            from pymongo import MongoClient

            connection_string = f"mongodb://{self.config.username}:{self.config.password}@{self.config.host}:{self.config.port}/"
            if not self.config.username:
                connection_string = f"mongodb://{self.config.host}:{self.config.port}/"

            self.connection = MongoClient(connection_string, serverSelectionTimeoutMS=self.config.connection_timeout * 1000)
            # Test connection
            self.connection.admin.command('ping')
            self.is_connected = True
            return True
        except Exception as e:
            raise ConnectionError(f"MongoDB connection failed: {str(e)}")

    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.connection:
            self.connection.close()
            self.is_connected = False

    async def test_connection(self) -> bool:
        """Test MongoDB connection"""
        try:
            await self.connect()
            await self.disconnect()
            return True
        except:
            return False

    async def execute_query(self, query: str) -> QueryResult:
        """Execute MongoDB query (limited support)"""
        # MongoDB doesn't use SQL, so this is a simplified implementation
        # In a real implementation, you'd parse the query or provide a different interface
        return QueryResult([], [], 0, 0)

    async def get_schemas(self) -> List[str]:
        """Get MongoDB databases"""
        return self.connection.list_database_names()

    async def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get MongoDB collections"""
        if not schema:
            schema = self.config.database

        db = self.connection[schema]
        collections = []
        for collection_name in db.list_collection_names():
            collections.append(TableInfo(collection_name, schema, 'collection'))
        return collections

    async def get_table_columns(self, table: str, schema: str = None) -> List[ColumnInfo]:
        """Get MongoDB collection fields (sample-based)"""
        if not schema:
            schema = self.config.database

        db = self.connection[schema]
        collection = db[table]

        # Sample a few documents to infer schema
        sample_docs = list(collection.find().limit(10))
        fields = set()

        for doc in sample_docs:
            fields.update(doc.keys())

        columns = []
        for field in sorted(fields):
            columns.append(ColumnInfo(
                name=field,
                data_type="Mixed",
                is_nullable=True,
                is_primary_key=field == "_id"
            ))
        return columns

    async def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get MongoDB collection data"""
        if not schema:
            schema = self.config.database

        db = self.connection[schema]
        collection = db[table]

        docs = list(collection.find().limit(limit))
        if not docs:
            return QueryResult([], [], 0, 0)

        # Convert documents to tabular format
        all_fields = set()
        for doc in docs:
            all_fields.update(doc.keys())

        columns = sorted(list(all_fields))
        rows = []

        for doc in docs:
            row = []
            for field in columns:
                value = doc.get(field, None)
                # Convert complex types to strings
                if isinstance(value, (dict, list)):
                    value = str(value)
                row.append(value)
            rows.append(row)

        return QueryResult(columns, rows, len(rows), 0)

# Redis Adapter
class RedisAdapter(BaseDatabaseAdapter):
    """Redis database adapter"""

    @property
    def database_type(self) -> str:
        return "redis"

    @property
    def default_port(self) -> int:
        return 6379

    @property
    def icon(self) -> str:
        return "💎"

    @property
    def color(self) -> str:
        return "#DC382D"

    async def connect(self) -> bool:
        """Connect to Redis"""
        try:
            import redis

            self.connection = redis.Redis(
                host=self.config.host,
                port=self.config.port,
                password=self.config.password or None,
                db=int(self.config.database) if self.config.database else 0,
                socket_timeout=self.config.connection_timeout
            )
            # Test connection
            self.connection.ping()
            self.is_connected = True
            return True
        except Exception as e:
            raise ConnectionError(f"Redis connection failed: {str(e)}")

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.connection:
            self.connection.close()
            self.is_connected = False

    async def test_connection(self) -> bool:
        """Test Redis connection"""
        try:
            await self.connect()
            await self.disconnect()
            return True
        except:
            return False

    async def execute_query(self, query: str) -> QueryResult:
        """Execute Redis command"""
        # Parse and execute Redis commands
        parts = query.strip().split()
        if not parts:
            return QueryResult([], [], 0, 0)

        command = parts[0].upper()
        args = parts[1:]

        try:
            result = self.connection.execute_command(command, *args)
            if isinstance(result, list):
                rows = [[str(item)] for item in result]
                return QueryResult(['value'], rows, len(rows), 0)
            else:
                return QueryResult(['result'], [[str(result)]], 1, 0)
        except Exception as e:
            raise RuntimeError(f"Redis command failed: {str(e)}")

    async def get_schemas(self) -> List[str]:
        """Get Redis databases"""
        info = self.connection.info()
        db_count = info.get('databases', 16)  # Default Redis has 16 databases
        return [f"db{i}" for i in range(db_count)]

    async def get_tables(self, schema: str = None) -> List[TableInfo]:
        """Get Redis keys (as tables)"""
        # Switch to the specified database
        if schema and schema.startswith('db'):
            db_num = int(schema[2:])
            self.connection.execute_command('SELECT', db_num)

        keys = self.connection.keys('*')
        tables = []
        for key in keys[:100]:  # Limit to first 100 keys
            key_type = self.connection.type(key).decode('utf-8')
            tables.append(TableInfo(key.decode('utf-8'), schema or 'db0', key_type))
        return tables

    async def get_table_columns(self, table: str, schema: str = None) -> List[ColumnInfo]:
        """Get Redis key structure"""
        key_type = self.connection.type(table).decode('utf-8')

        if key_type == 'string':
            return [ColumnInfo('value', 'string', False, True)]
        elif key_type == 'hash':
            return [ColumnInfo('field', 'string', False, True), ColumnInfo('value', 'string', False, False)]
        elif key_type in ['list', 'set', 'zset']:
            return [ColumnInfo('index', 'int', False, True), ColumnInfo('value', 'string', False, False)]
        else:
            return [ColumnInfo('data', 'mixed', False, True)]

    async def get_table_data(self, table: str, schema: str = None, limit: int = 1000) -> QueryResult:
        """Get Redis key data"""
        key_type = self.connection.type(table).decode('utf-8')

        if key_type == 'string':
            value = self.connection.get(table)
            return QueryResult(['value'], [[value.decode('utf-8') if value else None]], 1, 0)

        elif key_type == 'hash':
            hash_data = self.connection.hgetall(table)
            rows = [[k.decode('utf-8'), v.decode('utf-8')] for k, v in hash_data.items()]
            return QueryResult(['field', 'value'], rows, len(rows), 0)

        elif key_type == 'list':
            list_data = self.connection.lrange(table, 0, limit - 1)
            rows = [[i, item.decode('utf-8')] for i, item in enumerate(list_data)]
            return QueryResult(['index', 'value'], rows, len(rows), 0)

        elif key_type == 'set':
            set_data = self.connection.smembers(table)
            rows = [[i, item.decode('utf-8')] for i, item in enumerate(set_data)]
            return QueryResult(['index', 'value'], rows, len(rows), 0)

        elif key_type == 'zset':
            zset_data = self.connection.zrange(table, 0, limit - 1, withscores=True)
            rows = [[item[1], item[0].decode('utf-8')] for item in zset_data]
            return QueryResult(['score', 'value'], rows, len(rows), 0)

        else:
            return QueryResult(['data'], [['Unsupported key type']], 1, 0)

# Database Factory
class DatabaseAdapterFactory:
    """Factory for creating database adapters"""

    _adapters = {
        'postgresql': PostgreSQLAdapter,
        'mysql': MySQLAdapter,
        'mongodb': MongoDBAdapter,
        'redis': RedisAdapter,
    }

    @classmethod
    def create_adapter(cls, db_type: str, config: DatabaseConfig) -> BaseDatabaseAdapter:
        """Create a database adapter"""
        adapter_class = cls._adapters.get(db_type.lower())
        if not adapter_class:
            raise ValueError(f"Unsupported database type: {db_type}")

        # Set default port if not specified
        if config.port == 5432:  # Default was PostgreSQL
            adapter = adapter_class(config)
            config.port = adapter.default_port

        return adapter_class(config)

    @classmethod
    def get_supported_databases(cls) -> List[Dict[str, str]]:
        """Get list of supported database types"""
        databases = []
        for db_type, adapter_class in cls._adapters.items():
            # Create a dummy instance to get metadata
            dummy_config = DatabaseConfig()
            adapter = adapter_class(dummy_config)
            databases.append({
                'type': db_type,
                'name': db_type.title(),
                'icon': adapter.icon,
                'color': adapter.color,
                'default_port': adapter.default_port
            })
        return databases