"""
NoSQL Adapter Factory
Creates appropriate adapter instances based on database type
"""

from typing import Dict, Optional, Type
from .base_adapter import BaseNoSQLAdapter, DatabaseType, ConnectionParams
from .mongodb_adapter import MongoDBAdapter
from .redis_adapter import RedisAdapter

try:
    from .elasticsearch_adapter import ElasticsearchAdapter
    ELASTICSEARCH_AVAILABLE = True
except ImportError:
    ELASTICSEARCH_AVAILABLE = False

try:
    from .cassandra_adapter import CassandraAdapter
    CASSANDRA_AVAILABLE = True
except ImportError:
    CASSANDRA_AVAILABLE = False

class NoSQLAdapterFactory:
    """Factory class to create NoSQL database adapters"""
    
    # Registry of available adapters
    _adapters: Dict[DatabaseType, Type[BaseNoSQLAdapter]] = {
        DatabaseType.MONGODB: MongoDBAdapter,
        DatabaseType.REDIS: RedisAdapter,
    }
    
    # Optional adapters (only if dependencies are available)
    if ELASTICSEARCH_AVAILABLE:
        _adapters[DatabaseType.ELASTICSEARCH] = ElasticsearchAdapter
    
    if CASSANDRA_AVAILABLE:
        _adapters[DatabaseType.CASSANDRA] = CassandraAdapter
    
    @classmethod
    def create_adapter(cls, db_type: DatabaseType, 
                      connection_params: ConnectionParams) -> BaseNoSQLAdapter:
        """Create a NoSQL adapter instance for the specified database type"""
        
        if db_type not in cls._adapters:
            available_types = list(cls._adapters.keys())
            raise ValueError(
                f"Unsupported database type: {db_type.value}. "
                f"Available types: {[t.value for t in available_types]}"
            )
        
        adapter_class = cls._adapters[db_type]
        return adapter_class(connection_params)
    
    @classmethod
    def create_from_uri(cls, uri: str) -> BaseNoSQLAdapter:
        """Create adapter from connection URI"""
        connection_params, db_type = cls._parse_uri(uri)
        return cls.create_adapter(db_type, connection_params)
    
    @classmethod
    def create_from_config(cls, config: Dict[str, any]) -> BaseNoSQLAdapter:
        """Create adapter from configuration dictionary"""
        db_type_str = config.get('type', '').lower()
        
        try:
            db_type = DatabaseType(db_type_str)
        except ValueError:
            raise ValueError(f"Invalid database type: {db_type_str}")
        
        connection_params = ConnectionParams(
            host=config.get('host', 'localhost'),
            port=config.get('port', cls._get_default_port(db_type)),
            username=config.get('username'),
            password=config.get('password'),
            database=config.get('database'),
            auth_database=config.get('auth_database'),
            ssl=config.get('ssl', False),
            additional_params=config.get('additional_params', {})
        )
        
        return cls.create_adapter(db_type, connection_params)
    
    @classmethod
    def get_available_types(cls) -> list[DatabaseType]:
        """Get list of available database types"""
        return list(cls._adapters.keys())
    
    @classmethod
    def is_type_supported(cls, db_type: DatabaseType) -> bool:
        """Check if a database type is supported"""
        return db_type in cls._adapters
    
    @classmethod
    def get_adapter_requirements(cls, db_type: DatabaseType) -> Dict[str, any]:
        """Get requirements information for a specific adapter"""
        requirements = {
            DatabaseType.MONGODB: {
                'package': 'pymongo',
                'install_command': 'pip install pymongo',
                'default_port': 27017,
                'description': 'MongoDB document database'
            },
            DatabaseType.REDIS: {
                'package': 'redis',
                'install_command': 'pip install redis',
                'default_port': 6379,
                'description': 'Redis key-value store'
            },
            DatabaseType.ELASTICSEARCH: {
                'package': 'elasticsearch',
                'install_command': 'pip install elasticsearch',
                'default_port': 9200,
                'description': 'Elasticsearch search engine'
            },
            DatabaseType.CASSANDRA: {
                'package': 'cassandra-driver',
                'install_command': 'pip install cassandra-driver',
                'default_port': 9042,
                'description': 'Apache Cassandra wide-column store'
            }
        }
        
        return requirements.get(db_type, {})
    
    @classmethod
    def _parse_uri(cls, uri: str) -> tuple[ConnectionParams, DatabaseType]:
        """Parse connection URI and extract parameters"""
        from urllib.parse import urlparse, parse_qs
        
        parsed = urlparse(uri)
        
        # Determine database type from scheme
        scheme_to_type = {
            'mongodb': DatabaseType.MONGODB,
            'redis': DatabaseType.REDIS,
            'elasticsearch': DatabaseType.ELASTICSEARCH,
            'cassandra': DatabaseType.CASSANDRA
        }
        
        if parsed.scheme not in scheme_to_type:
            raise ValueError(f"Unsupported URI scheme: {parsed.scheme}")
        
        db_type = scheme_to_type[parsed.scheme]
        
        # Extract connection parameters
        connection_params = ConnectionParams(
            host=parsed.hostname or 'localhost',
            port=parsed.port or cls._get_default_port(db_type),
            username=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/') if parsed.path else None,
            ssl='ssl' in parse_qs(parsed.query),
            additional_params=dict(parse_qs(parsed.query))
        )
        
        return connection_params, db_type
    
    @classmethod
    def _get_default_port(cls, db_type: DatabaseType) -> int:
        """Get default port for database type"""
        default_ports = {
            DatabaseType.MONGODB: 27017,
            DatabaseType.REDIS: 6379,
            DatabaseType.ELASTICSEARCH: 9200,
            DatabaseType.CASSANDRA: 9042
        }
        
        return default_ports.get(db_type, 0)
    
    @classmethod
    def register_adapter(cls, db_type: DatabaseType, 
                        adapter_class: Type[BaseNoSQLAdapter]):
        """Register a custom adapter class"""
        if not issubclass(adapter_class, BaseNoSQLAdapter):
            raise ValueError("Adapter class must inherit from BaseNoSQLAdapter")
        
        cls._adapters[db_type] = adapter_class
    
    @classmethod
    def unregister_adapter(cls, db_type: DatabaseType):
        """Unregister an adapter"""
        if db_type in cls._adapters:
            del cls._adapters[db_type]
    
    @classmethod
    def test_dependencies(cls) -> Dict[DatabaseType, Dict[str, any]]:
        """Test which dependencies are available"""
        results = {}
        
        for db_type in DatabaseType:
            requirements = cls.get_adapter_requirements(db_type)
            package = requirements.get('package')
            
            if package:
                try:
                    __import__(package)
                    results[db_type] = {
                        'available': True,
                        'package': package
                    }
                except ImportError:
                    results[db_type] = {
                        'available': False,
                        'package': package,
                        'install_command': requirements.get('install_command')
                    }
        
        return results


# Convenience functions

def create_mongodb_adapter(host: str = 'localhost', port: int = 27017,
                          username: Optional[str] = None, password: Optional[str] = None,
                          database: Optional[str] = None, **kwargs) -> MongoDBAdapter:
    """Create a MongoDB adapter with simplified parameters"""
    params = ConnectionParams(
        host=host,
        port=port,
        username=username,
        password=password,
        database=database,
        additional_params=kwargs
    )
    return MongoDBAdapter(params)


def create_redis_adapter(host: str = 'localhost', port: int = 6379,
                        password: Optional[str] = None, db: int = 0,
                        **kwargs) -> RedisAdapter:
    """Create a Redis adapter with simplified parameters"""
    params = ConnectionParams(
        host=host,
        port=port,
        password=password,
        database=db,
        additional_params=kwargs
    )
    return RedisAdapter(params)


def create_adapter_from_url(url: str) -> BaseNoSQLAdapter:
    """Create adapter from connection URL"""
    return NoSQLAdapterFactory.create_from_uri(url)


def get_supported_databases() -> Dict[str, str]:
    """Get dictionary of supported databases and their descriptions"""
    factory = NoSQLAdapterFactory()
    supported = {}
    
    for db_type in factory.get_available_types():
        requirements = factory.get_adapter_requirements(db_type)
        supported[db_type.value] = requirements.get('description', f'{db_type.value} database')
    
    return supported