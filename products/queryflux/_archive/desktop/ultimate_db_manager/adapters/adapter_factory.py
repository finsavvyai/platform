"""
Unified Database Adapter Factory
Creates appropriate adapter instances for both SQL and NoSQL databases
"""

from typing import Dict, Optional, Type, List, Any
from urllib.parse import urlparse, parse_qs
import importlib
import logging

from .base_adapter import DatabaseAdapter, DatabaseType, ConnectionParams

logger = logging.getLogger(__name__)

class AdapterRegistry:
    """Registry for database adapters with dynamic loading"""
    
    def __init__(self):
        self._adapters: Dict[DatabaseType, Type[DatabaseAdapter]] = {}
        self._adapter_modules: Dict[DatabaseType, str] = {}
        self._requirements: Dict[DatabaseType, Dict[str, Any]] = {}
        self._initialize_default_adapters()
    
    def _initialize_default_adapters(self):
        """Initialize default adapter mappings"""
        # SQL Adapters
        self._adapter_modules[DatabaseType.POSTGRESQL] = "ultimate_db_manager.adapters.sql_adapters.postgresql_adapter"
        self._adapter_modules[DatabaseType.MYSQL] = "ultimate_db_manager.adapters.sql_adapters.mysql_adapter"
        self._adapter_modules[DatabaseType.SQLITE] = "ultimate_db_manager.adapters.sql_adapters.sqlite_adapter"
        self._adapter_modules[DatabaseType.MARIADB] = "ultimate_db_manager.adapters.sql_adapters.mysql_adapter"  # MariaDB uses MySQL adapter
        self._adapter_modules[DatabaseType.ORACLE] = "ultimate_db_manager.adapters.sql_adapters.oracle_adapter"
        self._adapter_modules[DatabaseType.SQLSERVER] = "ultimate_db_manager.adapters.sql_adapters.sqlserver_adapter"
        
        # NoSQL Adapters
        self._adapter_modules[DatabaseType.MONGODB] = "ultimate_db_manager.adapters.nosql_adapters.mongodb_adapter"
        self._adapter_modules[DatabaseType.REDIS] = "ultimate_db_manager.adapters.nosql_adapters.redis_adapter"
        self._adapter_modules[DatabaseType.CASSANDRA] = "ultimate_db_manager.adapters.nosql_adapters.cassandra_adapter"
        self._adapter_modules[DatabaseType.COUCHDB] = "ultimate_db_manager.adapters.nosql_adapters.couchdb_adapter"
        self._adapter_modules[DatabaseType.NEO4J] = "ultimate_db_manager.adapters.nosql_adapters.neo4j_adapter"
        
        # Cloud Adapters (use base SQL adapters with cloud-specific configurations)
        self._adapter_modules[DatabaseType.SUPABASE] = "ultimate_db_manager.adapters.cloud_adapters.supabase_adapter"
        self._adapter_modules[DatabaseType.PLANETSCALE] = "ultimate_db_manager.adapters.cloud_adapters.planetscale_adapter"
        self._adapter_modules[DatabaseType.NEON] = "ultimate_db_manager.adapters.cloud_adapters.neon_adapter"
        self._adapter_modules[DatabaseType.RAILWAY] = "ultimate_db_manager.adapters.cloud_adapters.railway_adapter"
        self._adapter_modules[DatabaseType.AWS_RDS] = "ultimate_db_manager.adapters.cloud_adapters.aws_rds_adapter"
        
        # Time Series Adapters
        self._adapter_modules[DatabaseType.INFLUXDB] = "ultimate_db_manager.adapters.timeseries_adapters.influxdb_adapter"
        self._adapter_modules[DatabaseType.TIMESCALEDB] = "ultimate_db_manager.adapters.sql_adapters.postgresql_adapter"  # TimescaleDB uses PostgreSQL adapter
        self._adapter_modules[DatabaseType.PROMETHEUS] = "ultimate_db_manager.adapters.timeseries_adapters.prometheus_adapter"
        self._adapter_modules[DatabaseType.CLICKHOUSE] = "ultimate_db_manager.adapters.timeseries_adapters.clickhouse_adapter"
        
        # Requirements information
        self._requirements = {
            # SQL Databases
            DatabaseType.POSTGRESQL: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'PostgreSQL relational database',
                'category': 'SQL'
            },
            DatabaseType.MYSQL: {
                'packages': ['PyMySQL'],
                'install_command': 'pip install PyMySQL',
                'default_port': 3306,
                'description': 'MySQL relational database',
                'category': 'SQL'
            },
            DatabaseType.MARIADB: {
                'packages': ['PyMySQL'],
                'install_command': 'pip install PyMySQL',
                'default_port': 3306,
                'description': 'MariaDB relational database',
                'category': 'SQL'
            },
            DatabaseType.SQLITE: {
                'packages': [],  # Built into Python
                'install_command': 'No installation required',
                'default_port': 0,  # File-based
                'description': 'SQLite embedded database',
                'category': 'SQL'
            },
            DatabaseType.ORACLE: {
                'packages': ['oracledb'],
                'install_command': 'pip install oracledb',
                'default_port': 1521,
                'description': 'Oracle Database',
                'category': 'SQL'
            },
            DatabaseType.SQLSERVER: {
                'packages': ['pyodbc'],
                'install_command': 'pip install pyodbc',
                'default_port': 1433,
                'description': 'Microsoft SQL Server',
                'category': 'SQL'
            },
            
            # NoSQL Databases
            DatabaseType.MONGODB: {
                'packages': ['pymongo'],
                'install_command': 'pip install pymongo',
                'default_port': 27017,
                'description': 'MongoDB document database',
                'category': 'NoSQL'
            },
            DatabaseType.REDIS: {
                'packages': ['redis'],
                'install_command': 'pip install redis',
                'default_port': 6379,
                'description': 'Redis key-value store',
                'category': 'NoSQL'
            },
            DatabaseType.ELASTICSEARCH: {
                'packages': ['elasticsearch'],
                'install_command': 'pip install elasticsearch',
                'default_port': 9200,
                'description': 'Elasticsearch search engine',
                'category': 'NoSQL'
            },
            DatabaseType.CASSANDRA: {
                'packages': ['cassandra-driver'],
                'install_command': 'pip install cassandra-driver',
                'default_port': 9042,
                'description': 'Apache Cassandra wide-column store',
                'category': 'NoSQL'
            },
            DatabaseType.COUCHDB: {
                'packages': ['couchdb'],
                'install_command': 'pip install couchdb',
                'default_port': 5984,
                'description': 'Apache CouchDB document database',
                'category': 'NoSQL'
            },
            DatabaseType.NEO4J: {
                'packages': ['neo4j'],
                'install_command': 'pip install neo4j',
                'default_port': 7687,
                'description': 'Neo4j graph database',
                'category': 'NoSQL'
            },
            
            # Cloud Databases
            DatabaseType.SUPABASE: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'Supabase PostgreSQL cloud database',
                'category': 'Cloud'
            },
            DatabaseType.PLANETSCALE: {
                'packages': ['PyMySQL'],
                'install_command': 'pip install PyMySQL',
                'default_port': 3306,
                'description': 'PlanetScale serverless MySQL',
                'category': 'Cloud'
            },
            DatabaseType.NEON: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'Neon serverless PostgreSQL',
                'category': 'Cloud'
            },
            DatabaseType.RAILWAY: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'Railway cloud database hosting',
                'category': 'Cloud'
            },
            DatabaseType.AWS_RDS: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'Amazon RDS cloud database',
                'category': 'Cloud'
            },
            
            # Time Series Databases
            DatabaseType.INFLUXDB: {
                'packages': ['influxdb-client'],
                'install_command': 'pip install influxdb-client',
                'default_port': 8086,
                'description': 'InfluxDB time series database',
                'category': 'Time Series'
            },
            DatabaseType.TIMESCALEDB: {
                'packages': ['psycopg2-binary'],
                'install_command': 'pip install psycopg2-binary',
                'default_port': 5432,
                'description': 'TimescaleDB PostgreSQL extension',
                'category': 'Time Series'
            },
            DatabaseType.PROMETHEUS: {
                'packages': ['prometheus-api-client'],
                'install_command': 'pip install prometheus-api-client',
                'default_port': 9090,
                'description': 'Prometheus monitoring database',
                'category': 'Time Series'
            },
            DatabaseType.CLICKHOUSE: {
                'packages': ['clickhouse-driver'],
                'install_command': 'pip install clickhouse-driver',
                'default_port': 9000,
                'description': 'ClickHouse columnar database',
                'category': 'Time Series'
            }
        }
    
    def register_adapter(self, db_type: DatabaseType, adapter_class: Type[DatabaseAdapter],
                        module_path: Optional[str] = None):
        """Register an adapter class"""
        if not issubclass(adapter_class, DatabaseAdapter):
            raise ValueError("Adapter class must inherit from DatabaseAdapter")
        
        self._adapters[db_type] = adapter_class
        if module_path:
            self._adapter_modules[db_type] = module_path
        
        logger.info(f"Registered adapter for {db_type.value}: {adapter_class.__name__}")
    
    def unregister_adapter(self, db_type: DatabaseType):
        """Unregister an adapter"""
        if db_type in self._adapters:
            del self._adapters[db_type]
        if db_type in self._adapter_modules:
            del self._adapter_modules[db_type]
        
        logger.info(f"Unregistered adapter for {db_type.value}")
    
    def get_adapter_class(self, db_type: DatabaseType) -> Type[DatabaseAdapter]:
        """Get adapter class, loading it if necessary"""
        if db_type in self._adapters:
            return self._adapters[db_type]
        
        # Try to load the adapter dynamically
        if db_type in self._adapter_modules:
            try:
                module_path = self._adapter_modules[db_type]
                module = importlib.import_module(module_path)
                
                # Find the adapter class in the module
                adapter_class = None
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) and 
                        issubclass(attr, DatabaseAdapter) and 
                        attr != DatabaseAdapter):
                        adapter_class = attr
                        break
                
                if adapter_class:
                    self._adapters[db_type] = adapter_class
                    logger.info(f"Dynamically loaded adapter for {db_type.value}: {adapter_class.__name__}")
                    return adapter_class
                else:
                    raise ImportError(f"No adapter class found in module {module_path}")
                    
            except ImportError as e:
                logger.error(f"Failed to load adapter for {db_type.value}: {e}")
                raise ValueError(f"Adapter for {db_type.value} is not available. {e}")
        
        raise ValueError(f"No adapter registered for database type: {db_type.value}")
    
    def is_adapter_available(self, db_type: DatabaseType) -> bool:
        """Check if an adapter is available"""
        try:
            self.get_adapter_class(db_type)
            return True
        except ValueError:
            return False
    
    def get_available_types(self) -> List[DatabaseType]:
        """Get list of available database types"""
        available = []
        for db_type in DatabaseType:
            if self.is_adapter_available(db_type):
                available.append(db_type)
        return available
    
    def get_requirements(self, db_type: DatabaseType) -> Dict[str, Any]:
        """Get requirements information for a database type"""
        return self._requirements.get(db_type, {})
    
    def test_dependencies(self) -> Dict[DatabaseType, Dict[str, Any]]:
        """Test which dependencies are available"""
        results = {}
        
        for db_type in DatabaseType:
            requirements = self.get_requirements(db_type)
            packages = requirements.get('packages', [])
            
            if not packages:  # SQLite case
                results[db_type] = {
                    'available': True,
                    'packages': packages
                }
                continue
            
            missing_packages = []
            for package in packages:
                try:
                    importlib.import_module(package.replace('-', '_'))
                except ImportError:
                    missing_packages.append(package)
            
            results[db_type] = {
                'available': len(missing_packages) == 0,
                'packages': packages,
                'missing_packages': missing_packages,
                'install_command': requirements.get('install_command')
            }
        
        return results

# Global registry instance
_registry = AdapterRegistry()

class AdapterFactory:
    """Factory class to create database adapters"""
    
    @classmethod
    def create_adapter(cls, db_type: DatabaseType, 
                      connection_params: ConnectionParams) -> DatabaseAdapter:
        """Create a database adapter instance for the specified database type"""
        adapter_class = _registry.get_adapter_class(db_type)
        return adapter_class(connection_params)
    
    @classmethod
    def create_from_uri(cls, uri: str) -> DatabaseAdapter:
        """Create adapter from connection URI"""
        connection_params, db_type = cls._parse_uri(uri)
        return cls.create_adapter(db_type, connection_params)
    
    @classmethod
    def create_from_config(cls, config: Dict[str, Any]) -> DatabaseAdapter:
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
            schema=config.get('schema'),
            auth_database=config.get('auth_database'),
            ssl=config.get('ssl', False),
            ssl_cert=config.get('ssl_cert'),
            ssl_key=config.get('ssl_key'),
            ssl_ca=config.get('ssl_ca'),
            timeout=config.get('timeout', 30),
            pool_size=config.get('pool_size', 5),
            max_overflow=config.get('max_overflow', 10),
            additional_params=config.get('additional_params', {})
        )
        
        return cls.create_adapter(db_type, connection_params)
    
    @classmethod
    def get_available_types(cls) -> List[DatabaseType]:
        """Get list of available database types"""
        return _registry.get_available_types()
    
    @classmethod
    def is_type_supported(cls, db_type: DatabaseType) -> bool:
        """Check if a database type is supported"""
        return _registry.is_adapter_available(db_type)
    
    @classmethod
    def get_adapter_requirements(cls, db_type: DatabaseType) -> Dict[str, Any]:
        """Get requirements information for a specific adapter"""
        return _registry.get_requirements(db_type)
    
    @classmethod
    def register_adapter(cls, db_type: DatabaseType, adapter_class: Type[DatabaseAdapter],
                        module_path: Optional[str] = None):
        """Register a custom adapter class"""
        _registry.register_adapter(db_type, adapter_class, module_path)
    
    @classmethod
    def unregister_adapter(cls, db_type: DatabaseType):
        """Unregister an adapter"""
        _registry.unregister_adapter(db_type)
    
    @classmethod
    def test_dependencies(cls) -> Dict[DatabaseType, Dict[str, Any]]:
        """Test which dependencies are available"""
        return _registry.test_dependencies()
    
    @classmethod
    def _parse_uri(cls, uri: str) -> tuple[ConnectionParams, DatabaseType]:
        """Parse connection URI and extract parameters"""
        parsed = urlparse(uri)
        
        # Determine database type from scheme
        scheme_to_type = {
            # SQL Databases
            'postgresql': DatabaseType.POSTGRESQL,
            'postgres': DatabaseType.POSTGRESQL,
            'mysql': DatabaseType.MYSQL,
            'mariadb': DatabaseType.MARIADB,
            'sqlite': DatabaseType.SQLITE,
            'oracle': DatabaseType.ORACLE,
            'sqlserver': DatabaseType.SQLSERVER,
            'mssql': DatabaseType.SQLSERVER,
            
            # NoSQL Databases
            'mongodb': DatabaseType.MONGODB,
            'mongo': DatabaseType.MONGODB,
            'redis': DatabaseType.REDIS,
            'elasticsearch': DatabaseType.ELASTICSEARCH,
            'cassandra': DatabaseType.CASSANDRA,
            'couchdb': DatabaseType.COUCHDB,
            'neo4j': DatabaseType.NEO4J,
            'bolt': DatabaseType.NEO4J,  # Neo4j bolt protocol
            
            # Cloud Databases (use same schemes as base types)
            'supabase': DatabaseType.SUPABASE,
            'planetscale': DatabaseType.PLANETSCALE,
            'neon': DatabaseType.NEON,
            'railway': DatabaseType.RAILWAY,
            'awsrds': DatabaseType.AWS_RDS,
            
            # Time Series Databases
            'influxdb': DatabaseType.INFLUXDB,
            'influx': DatabaseType.INFLUXDB,
            'timescaledb': DatabaseType.TIMESCALEDB,
            'timescale': DatabaseType.TIMESCALEDB,
            'prometheus': DatabaseType.PROMETHEUS,
            'clickhouse': DatabaseType.CLICKHOUSE
        }
        
        if parsed.scheme not in scheme_to_type:
            raise ValueError(f"Unsupported URI scheme: {parsed.scheme}")
        
        db_type = scheme_to_type[parsed.scheme]
        
        # Parse query parameters
        query_params = dict(parse_qs(parsed.query))
        
        # Extract connection parameters
        connection_params = ConnectionParams(
            host=parsed.hostname or 'localhost',
            port=parsed.port or cls._get_default_port(db_type),
            username=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/') if parsed.path else None,
            ssl='ssl' in query_params or 'sslmode' in query_params,
            timeout=int(query_params.get('timeout', [30])[0]),
            additional_params=query_params
        )
        
        return connection_params, db_type
    
    @classmethod
    def _get_default_port(cls, db_type: DatabaseType) -> int:
        """Get default port for database type"""
        requirements = _registry.get_requirements(db_type)
        return requirements.get('default_port', 0)

# Convenience functions

def create_adapter(db_type: DatabaseType, **kwargs) -> DatabaseAdapter:
    """Create adapter with simplified parameters"""
    # Convert kwargs to ConnectionParams
    connection_params = ConnectionParams(
        host=kwargs.get('host', 'localhost'),
        port=kwargs.get('port', AdapterFactory._get_default_port(db_type)),
        username=kwargs.get('username'),
        password=kwargs.get('password'),
        database=kwargs.get('database'),
        schema=kwargs.get('schema'),
        ssl=kwargs.get('ssl', False),
        timeout=kwargs.get('timeout', 30),
        additional_params={k: v for k, v in kwargs.items() 
                          if k not in ['host', 'port', 'username', 'password', 
                                     'database', 'schema', 'ssl', 'timeout']}
    )
    
    return AdapterFactory.create_adapter(db_type, connection_params)

def create_postgresql_adapter(host: str = 'localhost', port: int = 5432,
                             username: Optional[str] = None, password: Optional[str] = None,
                             database: Optional[str] = None, **kwargs) -> DatabaseAdapter:
    """Create a PostgreSQL adapter with simplified parameters"""
    return create_adapter(DatabaseType.POSTGRESQL, host=host, port=port,
                         username=username, password=password, database=database, **kwargs)

def create_mysql_adapter(host: str = 'localhost', port: int = 3306,
                        username: Optional[str] = None, password: Optional[str] = None,
                        database: Optional[str] = None, **kwargs) -> DatabaseAdapter:
    """Create a MySQL adapter with simplified parameters"""
    return create_adapter(DatabaseType.MYSQL, host=host, port=port,
                         username=username, password=password, database=database, **kwargs)

def create_sqlite_adapter(database: str, **kwargs) -> DatabaseAdapter:
    """Create a SQLite adapter with simplified parameters"""
    return create_adapter(DatabaseType.SQLITE, host='', port=0,
                         database=database, **kwargs)

def create_oracle_adapter(host: str = 'localhost', port: int = 1521,
                         username: Optional[str] = None, password: Optional[str] = None,
                         database: Optional[str] = None, **kwargs) -> DatabaseAdapter:
    """Create an Oracle adapter with simplified parameters"""
    return create_adapter(DatabaseType.ORACLE, host=host, port=port,
                         username=username, password=password, database=database, **kwargs)

def create_mongodb_adapter(host: str = 'localhost', port: int = 27017,
                          username: Optional[str] = None, password: Optional[str] = None,
                          database: Optional[str] = None, **kwargs) -> DatabaseAdapter:
    """Create a MongoDB adapter with simplified parameters"""
    return create_adapter(DatabaseType.MONGODB, host=host, port=port,
                         username=username, password=password, database=database, **kwargs)

def create_redis_adapter(host: str = 'localhost', port: int = 6379,
                        password: Optional[str] = None, db: int = 0,
                        **kwargs) -> DatabaseAdapter:
    """Create a Redis adapter with simplified parameters"""
    return create_adapter(DatabaseType.REDIS, host=host, port=port,
                         password=password, database=db, **kwargs)

def create_adapter_from_url(url: str) -> DatabaseAdapter:
    """Create adapter from connection URL"""
    return AdapterFactory.create_from_uri(url)

def get_supported_databases() -> Dict[str, Dict[str, Any]]:
    """Get dictionary of supported databases and their information"""
    supported = {}
    
    for db_type in AdapterFactory.get_available_types():
        requirements = AdapterFactory.get_adapter_requirements(db_type)
        supported[db_type.value] = {
            'description': requirements.get('description', f'{db_type.value} database'),
            'category': requirements.get('category', 'Unknown'),
            'default_port': requirements.get('default_port', 0),
            'packages': requirements.get('packages', [])
        }
    
    return supported