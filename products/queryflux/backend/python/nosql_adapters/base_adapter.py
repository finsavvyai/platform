"""
Base adapter interface for NoSQL databases
Provides unified interface for different NoSQL database types
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field
from enum import Enum
import time

class DatabaseType(Enum):
    """Supported database types"""
    MONGODB = "mongodb"
    REDIS = "redis"
    ELASTICSEARCH = "elasticsearch"
    CASSANDRA = "cassandra"
    DYNAMODB = "dynamodb"
    COUCHDB = "couchdb"

class QueryType(Enum):
    """Query operation types"""
    FIND = "find"
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    AGGREGATE = "aggregate"
    INDEX = "index"
    CUSTOM = "custom"

@dataclass
class DatabaseInfo:
    """Database connection and metadata information"""
    name: str
    db_type: DatabaseType
    host: str
    port: int
    version: Optional[str] = None
    size_bytes: Optional[int] = None
    collections_count: Optional[int] = None
    documents_count: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CollectionInfo:
    """Collection/Table metadata"""
    name: str
    document_count: int
    size_bytes: int
    indexes: List[Dict[str, Any]] = field(default_factory=list)
    schema_sample: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class QueryResult:
    """Result of database query execution"""
    success: bool
    data: List[Dict[str, Any]] = field(default_factory=list)
    total_count: Optional[int] = None
    execution_time: float = 0.0
    query_type: Optional[QueryType] = None
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ConnectionParams:
    """Database connection parameters"""
    host: str
    port: int
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    auth_database: Optional[str] = None
    ssl: bool = False
    additional_params: Dict[str, Any] = field(default_factory=dict)

class BaseNoSQLAdapter(ABC):
    """Base adapter interface for NoSQL databases"""
    
    def __init__(self, connection_params: ConnectionParams):
        self.connection_params = connection_params
        self.client = None
        self.database = None
        self._connected = False
        self._connection_time = None
    
    @property
    @abstractmethod
    def database_type(self) -> DatabaseType:
        """Return the database type this adapter handles"""
        pass
    
    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the database"""
        pass
    
    @abstractmethod
    def disconnect(self):
        """Close database connection"""
        pass
    
    @abstractmethod
    def test_connection(self) -> Dict[str, Any]:
        """Test database connection and return status"""
        pass
    
    @abstractmethod
    def get_database_info(self) -> DatabaseInfo:
        """Get database metadata and information"""
        pass
    
    @abstractmethod
    def list_collections(self) -> List[CollectionInfo]:
        """List all collections/tables in the database"""
        pass
    
    @abstractmethod
    def get_collection_info(self, collection_name: str) -> CollectionInfo:
        """Get detailed information about a specific collection"""
        pass
    
    @abstractmethod
    def execute_query(self, query: Any, collection: Optional[str] = None, 
                     limit: int = 100) -> QueryResult:
        """Execute a query and return results"""
        pass
    
    @abstractmethod
    def get_sample_documents(self, collection: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample documents from a collection"""
        pass
    
    # Optional methods with default implementations
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics (optional)"""
        return {
            'connected': self._connected,
            'connection_time': self._connection_time,
            'adapter_type': self.database_type.value
        }
    
    def validate_query(self, query: Any) -> Dict[str, Any]:
        """Validate query syntax (optional)"""
        return {
            'valid': True,
            'warnings': [],
            'suggestions': []
        }
    
    def explain_query(self, query: Any, collection: Optional[str] = None) -> Dict[str, Any]:
        """Explain query execution plan (optional)"""
        return {
            'supported': False,
            'message': f'Query explanation not implemented for {self.database_type.value}'
        }
    
    def create_index(self, collection: str, fields: List[str], 
                    options: Optional[Dict[str, Any]] = None) -> bool:
        """Create an index (optional)"""
        return False
    
    def drop_index(self, collection: str, index_name: str) -> bool:
        """Drop an index (optional)"""
        return False
    
    def get_query_suggestions(self, partial_query: str, 
                            context: Optional[Dict[str, Any]] = None) -> List[str]:
        """Get query auto-completion suggestions (optional)"""
        return []
    
    def convert_from_sql(self, sql_query: str) -> Dict[str, Any]:
        """Convert SQL query to native query format (optional)"""
        return {
            'supported': False,
            'message': f'SQL conversion not implemented for {self.database_type.value}'
        }
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get database health metrics (optional)"""
        return {
            'status': 'connected' if self._connected else 'disconnected',
            'response_time': 0.0,
            'memory_usage': None,
            'disk_usage': None
        }
    
    def analyze_collection(self, collection: str, sample_size: int = 1000) -> Dict[str, Any]:
        """Analyze collection data patterns (optional)"""
        try:
            # Get sample documents
            samples = self.get_sample_documents(collection, sample_size)
            
            if not samples:
                return {'error': 'No documents found'}
            
            # Basic analysis
            field_types = {}
            field_counts = {}
            null_counts = {}
            
            for doc in samples:
                for field, value in doc.items():
                    # Track field types
                    field_type = type(value).__name__
                    if field not in field_types:
                        field_types[field] = {}
                    if field_type not in field_types[field]:
                        field_types[field][field_type] = 0
                    field_types[field][field_type] += 1
                    
                    # Track field presence
                    if field not in field_counts:
                        field_counts[field] = 0
                    field_counts[field] += 1
                    
                    # Track null values
                    if value is None:
                        if field not in null_counts:
                            null_counts[field] = 0
                        null_counts[field] += 1
            
            total_docs = len(samples)
            
            # Calculate field statistics
            field_stats = {}
            for field in field_counts:
                field_stats[field] = {
                    'presence_ratio': field_counts[field] / total_docs,
                    'null_ratio': null_counts.get(field, 0) / total_docs,
                    'types': field_types[field]
                }
            
            return {
                'collection': collection,
                'sample_size': total_docs,
                'total_fields': len(field_stats),
                'field_analysis': field_stats,
                'most_common_fields': sorted(field_counts.items(), 
                                           key=lambda x: x[1], reverse=True)[:10]
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    # Utility methods
    
    def is_connected(self) -> bool:
        """Check if adapter is currently connected"""
        return self._connected
    
    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information"""
        return {
            'host': self.connection_params.host,
            'port': self.connection_params.port,
            'database': self.connection_params.database,
            'connected': self._connected,
            'connection_time': self._connection_time
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
            return result, execution_time
        except Exception as e:
            execution_time = time.time() - start_time
            raise e
    
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