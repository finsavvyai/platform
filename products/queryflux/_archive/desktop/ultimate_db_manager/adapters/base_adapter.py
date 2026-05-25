"""
Base Database Adapter Interface
Unified interface for both SQL and NoSQL databases
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import time
from datetime import datetime

class DatabaseType(Enum):
    """Supported database types"""
    # SQL Databases
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLITE = "sqlite"
    MARIADB = "mariadb"
    ORACLE = "oracle"
    SQLSERVER = "sqlserver"
    
    # NoSQL Databases
    MONGODB = "mongodb"
    REDIS = "redis"
    ELASTICSEARCH = "elasticsearch"
    CASSANDRA = "cassandra"
    DYNAMODB = "dynamodb"
    COUCHDB = "couchdb"
    NEO4J = "neo4j"
    
    # Cloud Databases
    SUPABASE = "supabase"
    PLANETSCALE = "planetscale"
    NEON = "neon"
    RAILWAY = "railway"
    AWS_RDS = "aws_rds"
    
    # Time Series Databases
    INFLUXDB = "influxdb"
    TIMESCALEDB = "timescaledb"
    PROMETHEUS = "prometheus"
    CLICKHOUSE = "clickhouse"
    
    @property
    def default_port(self) -> int:
        """Get default port for database type"""
        port_map = {
            # SQL Databases
            self.POSTGRESQL: 5432,
            self.MYSQL: 3306,
            self.SQLITE: 0,  # File-based
            self.MARIADB: 3306,
            self.ORACLE: 1521,
            self.SQLSERVER: 1433,
            
            # NoSQL Databases
            self.MONGODB: 27017,
            self.REDIS: 6379,
            self.ELASTICSEARCH: 9200,
            self.CASSANDRA: 9042,
            self.DYNAMODB: 8000,
            self.COUCHDB: 5984,
            self.NEO4J: 7687,
            
            # Cloud Databases
            self.SUPABASE: 5432,
            self.PLANETSCALE: 3306,
            self.NEON: 5432,
            self.RAILWAY: 5432,
            self.AWS_RDS: 5432,
            
            # Time Series Databases
            self.INFLUXDB: 8086,
            self.TIMESCALEDB: 5432,
            self.PROMETHEUS: 9090,
            self.CLICKHOUSE: 9000
        }
        return port_map.get(self, 5432)
    
    @property
    def category(self) -> str:
        """Get database category"""
        category_map = {
            # SQL Databases
            self.POSTGRESQL: "SQL",
            self.MYSQL: "SQL",
            self.SQLITE: "SQL",
            self.MARIADB: "SQL",
            self.ORACLE: "SQL",
            self.SQLSERVER: "SQL",
            
            # NoSQL Databases
            self.MONGODB: "NoSQL",
            self.REDIS: "NoSQL",
            self.ELASTICSEARCH: "NoSQL",
            self.CASSANDRA: "NoSQL",
            self.DYNAMODB: "NoSQL",
            self.COUCHDB: "NoSQL",
            self.NEO4J: "NoSQL",
            
            # Cloud Databases
            self.SUPABASE: "Cloud",
            self.PLANETSCALE: "Cloud",
            self.NEON: "Cloud",
            self.RAILWAY: "Cloud",
            self.AWS_RDS: "Cloud",
            
            # Time Series Databases
            self.INFLUXDB: "Time Series",
            self.TIMESCALEDB: "Time Series",
            self.PROMETHEUS: "Time Series",
            self.CLICKHOUSE: "Time Series"
        }
        return category_map.get(self, "Other")
    
    @property
    def supports_sql(self) -> bool:
        """Check if database supports SQL queries"""
        sql_databases = {
            self.POSTGRESQL, self.MYSQL, self.SQLITE, self.MARIADB,
            self.ORACLE, self.SQLSERVER, self.SUPABASE, self.PLANETSCALE,
            self.NEON, self.RAILWAY, self.AWS_RDS, self.TIMESCALEDB,
            self.CLICKHOUSE
        }
        return self in sql_databases
    
    @property
    def connection_template(self) -> Dict[str, Any]:
        """Get connection template for database type"""
        templates = {
            self.SUPABASE: {
                "url_pattern": "postgresql://[user]:[password]@[host]:[port]/[database]",
                "supports_token": True,
                "requires_ssl": True,
                "auth_method": "password_or_token"
            },
            self.PLANETSCALE: {
                "url_pattern": "mysql://[user]:[password]@[host]:[port]/[database]?sslaccept=strict",
                "supports_token": False,
                "requires_ssl": True,
                "auth_method": "password"
            },
            self.NEON: {
                "url_pattern": "postgresql://[user]:[password]@[host]:[port]/[database]?sslmode=require",
                "supports_token": False,
                "requires_ssl": True,
                "auth_method": "password"
            },
            self.RAILWAY: {
                "url_pattern": "postgresql://[user]:[password]@[host]:[port]/[database]",
                "supports_token": False,
                "requires_ssl": True,
                "auth_method": "password"
            },
            self.AWS_RDS: {
                "url_pattern": "postgresql://[user]:[password]@[host]:[port]/[database]",
                "supports_token": False,
                "requires_ssl": True,
                "auth_method": "password"
            },
            self.NEO4J: {
                "url_pattern": "bolt://[host]:[port]",
                "supports_token": False,
                "requires_ssl": False,
                "auth_method": "password"
            },
            self.INFLUXDB: {
                "url_pattern": "http://[host]:[port]",
                "supports_token": True,
                "requires_ssl": False,
                "auth_method": "token_or_password"
            }
        }
        return templates.get(self, {
            "url_pattern": "[protocol]://[host]:[port]/[database]",
            "supports_token": False,
            "requires_ssl": False,
            "auth_method": "password"
        })

class QueryType(Enum):
    """Query operation types"""
    SELECT = "select"
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    CREATE = "create"
    DROP = "drop"
    ALTER = "alter"
    INDEX = "index"
    AGGREGATE = "aggregate"
    CUSTOM = "custom"

@dataclass
class ConnectionParams:
    """Standardized database connection parameters"""
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    
    # SQL-specific parameters
    schema: Optional[str] = None
    
    # NoSQL-specific parameters
    auth_database: Optional[str] = None
    
    # Security parameters
    ssl: bool = False
    ssl_cert: Optional[str] = None
    ssl_key: Optional[str] = None
    ssl_ca: Optional[str] = None
    
    # Connection options
    timeout: int = 30
    pool_size: int = 5
    max_overflow: int = 10
    
    # Additional parameters for database-specific options
    additional_params: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'password': self.password,
            'database': self.database,
            'schema': self.schema,
            'auth_database': self.auth_database,
            'ssl': self.ssl,
            'ssl_cert': self.ssl_cert,
            'ssl_key': self.ssl_key,
            'ssl_ca': self.ssl_ca,
            'timeout': self.timeout,
            'pool_size': self.pool_size,
            'max_overflow': self.max_overflow,
            'additional_params': self.additional_params
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConnectionParams':
        """Create from dictionary"""
        return cls(**data)

@dataclass
class ColumnInfo:
    """Database column/field information"""
    name: str
    data_type: str
    nullable: bool = True
    primary_key: bool = False
    foreign_key: Optional[str] = None
    default_value: Optional[Any] = None
    max_length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TableInfo:
    """Database table/collection information"""
    name: str
    schema: Optional[str] = None
    row_count: Optional[int] = None
    size_bytes: Optional[int] = None
    columns: List[ColumnInfo] = field(default_factory=list)
    indexes: List[Dict[str, Any]] = field(default_factory=list)
    constraints: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DatabaseInfo:
    """Database connection and metadata information"""
    name: str
    db_type: DatabaseType
    host: str
    port: int
    version: Optional[str] = None
    size_bytes: Optional[int] = None
    table_count: Optional[int] = None
    connection_count: Optional[int] = None
    uptime: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class QueryResult:
    """Result of database query execution"""
    success: bool
    data: List[Dict[str, Any]] = field(default_factory=list)
    columns: List[ColumnInfo] = field(default_factory=list)
    row_count: int = 0
    total_count: Optional[int] = None
    execution_time: float = 0.0
    query_type: Optional[QueryType] = None
    query_plan: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ImportOptions:
    """Options for data import operations"""
    file_format: str
    table_name: Optional[str] = None
    schema_name: Optional[str] = None
    create_table: bool = True
    truncate_table: bool = False
    batch_size: int = 1000
    ignore_errors: bool = False
    progress_callback: Optional[callable] = None
    transformations: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ExportOptions:
    """Options for data export operations"""
    file_format: str
    include_headers: bool = True
    compression: Optional[str] = None
    batch_size: int = 10000
    progress_callback: Optional[callable] = None
    filters: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ImportResult:
    """Result of data import operation"""
    success: bool
    rows_imported: int = 0
    rows_failed: int = 0
    execution_time: float = 0.0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ExportResult:
    """Result of data export operation"""
    success: bool
    rows_exported: int = 0
    file_size: int = 0
    execution_time: float = 0.0
    file_path: str = ""
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

class DatabaseAdapter(ABC):
    """Unified database adapter interface for both SQL and NoSQL databases"""
    
    def __init__(self, connection_params: ConnectionParams):
        self.connection_params = connection_params
        self.client = None
        self.database = None
        self._connected = False
        self._connection_time = None
        self._last_activity = None
    
    @property
    @abstractmethod
    def database_type(self) -> DatabaseType:
        """Return the database type this adapter handles"""
        pass
    
    @property
    @abstractmethod
    def supports_transactions(self) -> bool:
        """Return whether this database supports transactions"""
        pass
    
    @property
    @abstractmethod
    def supports_schemas(self) -> bool:
        """Return whether this database supports schemas"""
        pass
    
    # Core connection methods
    
    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the database"""
        pass
    
    @abstractmethod
    def disconnect(self) -> None:
        """Close database connection"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test database connection and return status"""
        pass
    
    def is_connected(self) -> bool:
        """Check if adapter is currently connected"""
        return self._connected
    
    # Database information methods
    
    @abstractmethod
    def get_database_info(self) -> DatabaseInfo:
        """Get database metadata and information"""
        pass
    
    @abstractmethod
    def list_tables(self, schema: Optional[str] = None) -> List[TableInfo]:
        """List all tables/collections in the database"""
        pass
    
    @abstractmethod
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a specific table/collection"""
        pass
    
    @abstractmethod
    def list_schemas(self) -> List[str]:
        """List all schemas/databases (if supported)"""
        pass
    
    # Query execution methods
    
    @abstractmethod
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> QueryResult:
        """Execute a query and return results"""
        pass
    
    @abstractmethod
    def execute_non_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> int:
        """Execute a non-query statement and return affected rows"""
        pass
    
    # Data access methods
    
    @abstractmethod
    def get_sample_data(self, table_name: str, limit: int = 10, 
                       schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sample data from a table/collection"""
        pass
    
    # Import/Export methods
    
    @abstractmethod
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file"""
        pass
    
    @abstractmethod
    def export_data(self, query: str, file_path: str, options: ExportOptions) -> ExportResult:
        """Export data to file"""
        pass
    
    # Schema introspection methods
    
    @abstractmethod
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for a table"""
        pass
    
    @abstractmethod
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for a table"""
        pass
    
    @abstractmethod
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for a table"""
        pass
    
    # Optional methods with default implementations
    
    def validate_query(self, query: str) -> Dict[str, Any]:
        """Validate query syntax (optional)"""
        return {
            'valid': True,
            'warnings': [],
            'suggestions': []
        }
    
    def explain_query(self, query: str) -> Dict[str, Any]:
        """Explain query execution plan (optional)"""
        return {
            'supported': False,
            'message': f'Query explanation not implemented for {self.database_type.value}'
        }
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics (optional)"""
        return {
            'connected': self._connected,
            'connection_time': self._connection_time,
            'last_activity': self._last_activity,
            'adapter_type': self.database_type.value
        }
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get database health metrics (optional)"""
        return {
            'status': 'connected' if self._connected else 'disconnected',
            'response_time': 0.0,
            'memory_usage': None,
            'disk_usage': None,
            'connection_count': None
        }
    
    def create_index(self, table_name: str, columns: List[str], 
                    index_name: Optional[str] = None, 
                    schema: Optional[str] = None,
                    options: Optional[Dict[str, Any]] = None) -> bool:
        """Create an index (optional)"""
        return False
    
    def drop_index(self, index_name: str, table_name: str, 
                  schema: Optional[str] = None) -> bool:
        """Drop an index (optional)"""
        return False
    
    def analyze_table(self, table_name: str, schema: Optional[str] = None,
                     sample_size: int = 1000) -> Dict[str, Any]:
        """Analyze table data patterns (optional)"""
        try:
            # Get sample data
            samples = self.get_sample_data(table_name, sample_size, schema)
            
            if not samples:
                return {'error': 'No data found'}
            
            # Basic analysis
            column_stats = {}
            total_rows = len(samples)
            
            for row in samples:
                for column, value in row.items():
                    if column not in column_stats:
                        column_stats[column] = {
                            'non_null_count': 0,
                            'null_count': 0,
                            'unique_values': set(),
                            'data_types': set()
                        }
                    
                    if value is not None:
                        column_stats[column]['non_null_count'] += 1
                        column_stats[column]['unique_values'].add(str(value))
                        column_stats[column]['data_types'].add(type(value).__name__)
                    else:
                        column_stats[column]['null_count'] += 1
            
            # Calculate final statistics
            analysis = {}
            for column, stats in column_stats.items():
                analysis[column] = {
                    'null_percentage': (stats['null_count'] / total_rows) * 100,
                    'unique_count': len(stats['unique_values']),
                    'data_types': list(stats['data_types']),
                    'completeness': (stats['non_null_count'] / total_rows) * 100
                }
            
            return {
                'table': table_name,
                'schema': schema,
                'sample_size': total_rows,
                'column_analysis': analysis
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    # Transaction support (for databases that support it)
    
    def begin_transaction(self) -> bool:
        """Begin a transaction (if supported)"""
        if not self.supports_transactions:
            return False
        return True
    
    def commit_transaction(self) -> bool:
        """Commit current transaction (if supported)"""
        if not self.supports_transactions:
            return False
        return True
    
    def rollback_transaction(self) -> bool:
        """Rollback current transaction (if supported)"""
        if not self.supports_transactions:
            return False
        return True
    
    # Utility methods
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information"""
        return {
            'host': self.connection_params.host,
            'port': self.connection_params.port,
            'database': self.connection_params.database,
            'schema': self.connection_params.schema,
            'connected': self._connected,
            'connection_time': self._connection_time,
            'last_activity': self._last_activity,
            'database_type': self.database_type.value
        }
    
    def format_error(self, error: Exception) -> str:
        """Format error message consistently"""
        return f"{self.database_type.value} error: {str(error)}"
    
    def measure_execution_time(self, func, *args, **kwargs):
        """Measure execution time of a function"""
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            execution_time = time.time() - start_time
            self._last_activity = datetime.now()
            return result, execution_time
        except Exception as e:
            execution_time = time.time() - start_time
            self._last_activity = datetime.now()
            raise e
    
    # Context manager support
    
    def __enter__(self):
        """Context manager entry"""
        if not self._connected:
            self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
    
    def __repr__(self):
        return f"{self.__class__.__name__}(host={self.connection_params.host}, connected={self._connected})"