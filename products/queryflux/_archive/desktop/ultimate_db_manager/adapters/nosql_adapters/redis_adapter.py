"""
Redis Database Adapter
Implements the unified DatabaseAdapter interface for Redis
"""

import time
import json
import os
import subprocess
from typing import Dict, List, Optional, Any, Union
import logging
from datetime import datetime

from ..base_adapter import (
    DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult, 
    TableInfo, ColumnInfo, DatabaseInfo, ImportOptions, ExportOptions,
    ImportResult, ExportResult, QueryType
)

logger = logging.getLogger(__name__)

class RedisAdapter(DatabaseAdapter):
    """Redis database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._client = None
        self._db_number = int(connection_params.database) if connection_params.database else 0
    
    @property
    def database_type(self) -> DatabaseType:
        """Return Redis database type"""
        return DatabaseType.REDIS
    
    @property
    def supports_transactions(self) -> bool:
        """Redis supports transactions"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """Redis doesn't have traditional schemas"""
        return False
    
    def connect(self) -> bool:
        """Establish connection to Redis database"""
        try:
            import redis
            
            start_time = time.time()
            
            # Build connection parameters
            conn_params = {
                'host': self.connection_params.host,
                'port': self.connection_params.port,
                'db': self._db_number,
                'socket_timeout': self.connection_params.timeout,
                'socket_connect_timeout': self.connection_params.timeout,
                'decode_responses': True  # Automatically decode byte responses to strings
            }
            
            # Add password if specified
            if self.connection_params.password:
                conn_params['password'] = self.connection_params.password
            
            # Add SSL parameters if specified
            if self.connection_params.ssl:
                conn_params['ssl'] = True
                if self.connection_params.ssl_cert:
                    conn_params['ssl_certfile'] = self.connection_params.ssl_cert
                if self.connection_params.ssl_key:
                    conn_params['ssl_keyfile'] = self.connection_params.ssl_key
                if self.connection_params.ssl_ca:
                    conn_params['ssl_ca_certs'] = self.connection_params.ssl_ca
            
            # Add additional parameters
            conn_params.update(self.connection_params.additional_params)
            
            self._client = redis.Redis(**conn_params)
            
            # Test connection
            self._client.ping()
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to Redis at {self.connection_params.host}:{self.connection_params.port} (db {self._db_number})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close Redis connection"""
        try:
            if self._client:
                self._client.close()
                self._client = None
            
            self._connected = False
            logger.info("Disconnected from Redis")
            
        except Exception as e:
            logger.error(f"Error disconnecting from Redis: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Redis connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with ping command
            start_time = time.time()
            pong = self._client.ping()
            response_time = time.time() - start_time
            
            # Get server info
            info = self._client.info()
            
            return {
                'success': True,
                'response_time': response_time,
                'ping_response': pong,
                'version': info.get('redis_version', 'unknown'),
                'database': self._db_number,
                'server_info': {
                    'uptime_in_seconds': info.get('uptime_in_seconds'),
                    'connected_clients': info.get('connected_clients'),
                    'used_memory': info.get('used_memory'),
                    'total_commands_processed': info.get('total_commands_processed')
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get Redis database information"""
        try:
            # Get server info
            info = self._client.info()
            
            # Get database-specific info
            db_info = info.get(f'db{self._db_number}', {})
            
            # Count keys in current database
            key_count = self._client.dbsize()
            
            return DatabaseInfo(
                name=f"db{self._db_number}",
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=info.get('redis_version', 'unknown'),
                table_count=key_count,  # Use key count as "table" count
                connection_count=info.get('connected_clients', 0),
                uptime=f"{info.get('uptime_in_seconds', 0)} seconds",
                metadata={
                    'keys': key_count,
                    'expires': db_info.get('expires', 0),
                    'avg_ttl': db_info.get('avg_ttl', 0),
                    'used_memory': info.get('used_memory', 0),
                    'used_memory_human': info.get('used_memory_human', '0B'),
                    'total_commands_processed': info.get('total_commands_processed', 0),
                    'keyspace_hits': info.get('keyspace_hits', 0),
                    'keyspace_misses': info.get('keyspace_misses', 0)
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting database info: {e}")
            return DatabaseInfo(
                name=f"db{self._db_number}",
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port
            )
    
    def list_tables(self, schema: Optional[str] = None) -> List[TableInfo]:
        """List key patterns in Redis database (grouped by common prefixes)"""
        try:
            # Get all keys
            all_keys = self._client.keys('*')
            
            if not all_keys:
                return []
            
            # Group keys by common prefixes (simulate "tables")
            prefix_groups = {}
            
            for key in all_keys:
                # Extract prefix (everything before first colon or underscore)
                if ':' in key:
                    prefix = key.split(':', 1)[0]
                elif '_' in key:
                    prefix = key.split('_', 1)[0]
                else:
                    prefix = 'misc'  # Keys without clear prefix
                
                if prefix not in prefix_groups:
                    prefix_groups[prefix] = []
                prefix_groups[prefix].append(key)
            
            tables = []
            for prefix, keys in prefix_groups.items():
                # Calculate approximate size
                total_memory = 0
                for key in keys[:10]:  # Sample first 10 keys for performance
                    try:
                        memory_usage = self._client.memory_usage(key)
                        if memory_usage:
                            total_memory += memory_usage
                    except:
                        pass
                
                # Estimate total size based on sample
                if len(keys) > 10:
                    avg_size = total_memory / min(10, len(keys))
                    total_memory = int(avg_size * len(keys))
                
                tables.append(TableInfo(
                    name=prefix,
                    schema=f"db{self._db_number}",
                    row_count=len(keys),
                    size_bytes=total_memory,
                    metadata={
                        'key_pattern': f"{prefix}:*" if ':' in keys[0] else f"{prefix}_*",
                        'sample_keys': keys[:5]  # Show first 5 keys as samples
                    }
                ))
            
            return sorted(tables, key=lambda t: t.row_count, reverse=True)
            
        except Exception as e:
            logger.error(f"Error listing key patterns: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a Redis key pattern"""
        try:
            # Find keys matching the pattern
            if table_name == 'misc':
                # Special case for miscellaneous keys
                all_keys = self._client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k and '_' not in k]
            else:
                pattern_keys = self._client.keys(f"{table_name}:*")
                if not pattern_keys:
                    pattern_keys = self._client.keys(f"{table_name}_*")
            
            if not pattern_keys:
                return TableInfo(name=table_name, schema=schema)
            
            # Analyze key types and sizes
            type_counts = {}
            total_memory = 0
            sample_data = []
            
            for key in pattern_keys[:50]:  # Analyze first 50 keys
                try:
                    key_type = self._client.type(key)
                    type_counts[key_type] = type_counts.get(key_type, 0) + 1
                    
                    # Get memory usage
                    try:
                        memory_usage = self._client.memory_usage(key)
                        if memory_usage:
                            total_memory += memory_usage
                    except:
                        pass
                    
                    # Get TTL
                    ttl = self._client.ttl(key)
                    
                    sample_data.append({
                        'key': key,
                        'type': key_type,
                        'ttl': ttl if ttl > 0 else None
                    })
                    
                except Exception as e:
                    logger.warning(f"Error analyzing key {key}: {e}")
            
            # Estimate total memory for all keys
            if len(pattern_keys) > 50:
                avg_memory = total_memory / min(50, len(pattern_keys))
                total_memory = int(avg_memory * len(pattern_keys))
            
            return TableInfo(
                name=table_name,
                schema=f"db{self._db_number}",
                row_count=len(pattern_keys),
                size_bytes=total_memory,
                metadata={
                    'key_types': type_counts,
                    'sample_keys': sample_data[:10],
                    'total_keys': len(pattern_keys)
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting key pattern info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all databases in Redis (db0, db1, etc.)"""
        try:
            # Get info about all databases
            info = self._client.info('keyspace')
            databases = []
            
            # Parse keyspace info to find databases with keys
            for key, value in info.items():
                if key.startswith('db'):
                    databases.append(key)
            
            # Always include current database even if empty
            current_db = f"db{self._db_number}"
            if current_db not in databases:
                databases.append(current_db)
            
            return sorted(databases)
            
        except Exception as e:
            logger.error(f"Error listing databases: {e}")
            return [f"db{self._db_number}"]
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> QueryResult:
        """Execute a Redis command and return results"""
        try:
            start_time = time.time()
            
            # Parse Redis command
            command_parts = self._parse_redis_command(query)
            
            if not command_parts:
                return QueryResult(
                    success=False,
                    errors=["Invalid Redis command"],
                    execution_time=time.time() - start_time
                )
            
            command = command_parts[0].upper()
            args = command_parts[1:]
            
            # Execute command
            if command == 'GET':
                if len(args) != 1:
                    raise ValueError("GET requires exactly one key")
                result = self._client.get(args[0])
                data = [{'key': args[0], 'value': result, 'type': 'string'}]
                
            elif command == 'MGET':
                if len(args) < 1:
                    raise ValueError("MGET requires at least one key")
                results = self._client.mget(args)
                data = [{'key': key, 'value': value, 'type': 'string'} 
                       for key, value in zip(args, results)]
                
            elif command == 'KEYS':
                pattern = args[0] if args else '*'
                keys = self._client.keys(pattern)
                data = [{'key': key, 'type': self._client.type(key)} for key in keys]
                
            elif command == 'SCAN':
                cursor = int(args[0]) if args else 0
                match_pattern = None
                count = 10
                
                # Parse SCAN arguments
                i = 1
                while i < len(args):
                    if args[i].upper() == 'MATCH' and i + 1 < len(args):
                        match_pattern = args[i + 1]
                        i += 2
                    elif args[i].upper() == 'COUNT' and i + 1 < len(args):
                        count = int(args[i + 1])
                        i += 2
                    else:
                        i += 1
                
                cursor, keys = self._client.scan(cursor, match=match_pattern, count=count)
                data = [{'cursor': cursor, 'keys': keys}]
                
            elif command == 'HGETALL':
                if len(args) != 1:
                    raise ValueError("HGETALL requires exactly one key")
                result = self._client.hgetall(args[0])
                data = [{'key': args[0], 'hash': result, 'type': 'hash'}]
                
            elif command == 'LRANGE':
                if len(args) < 3:
                    raise ValueError("LRANGE requires key, start, and stop")
                key, start, stop = args[0], int(args[1]), int(args[2])
                result = self._client.lrange(key, start, stop)
                data = [{'key': key, 'list': result, 'type': 'list'}]
                
            elif command == 'SMEMBERS':
                if len(args) != 1:
                    raise ValueError("SMEMBERS requires exactly one key")
                result = self._client.smembers(args[0])
                data = [{'key': args[0], 'set': list(result), 'type': 'set'}]
                
            elif command == 'ZRANGE':
                if len(args) < 3:
                    raise ValueError("ZRANGE requires key, start, and stop")
                key, start, stop = args[0], int(args[1]), int(args[2])
                withscores = 'WITHSCORES' in [arg.upper() for arg in args[3:]]
                result = self._client.zrange(key, start, stop, withscores=withscores)
                data = [{'key': key, 'zset': result, 'type': 'zset'}]
                
            elif command == 'INFO':
                section = args[0] if args else None
                result = self._client.info(section)
                data = [{'info': result}]
                
            elif command == 'DBSIZE':
                result = self._client.dbsize()
                data = [{'dbsize': result}]
                
            else:
                # Try to execute as generic command
                try:
                    result = self._client.execute_command(command, *args)
                    data = [{'command': command, 'result': result}]
                except Exception as e:
                    return QueryResult(
                        success=False,
                        errors=[f"Unsupported command '{command}': {str(e)}"],
                        execution_time=time.time() - start_time
                    )
            
            # Generate column info
            columns = []
            if data:
                for key in data[0].keys():
                    columns.append(ColumnInfo(
                        name=key,
                        data_type=type(data[0][key]).__name__,
                        nullable=True
                    ))
            
            return QueryResult(
                success=True,
                data=data,
                columns=columns,
                row_count=len(data),
                execution_time=time.time() - start_time,
                query_type=QueryType.SELECT
            )
            
        except Exception as e:
            logger.error(f"Error executing Redis command: {e}")
            return QueryResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time if 'start_time' in locals() else 0.0
            )
    
    def execute_non_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> int:
        """Execute a Redis command that modifies data"""
        try:
            command_parts = self._parse_redis_command(query)
            
            if not command_parts:
                raise ValueError("Invalid Redis command")
            
            command = command_parts[0].upper()
            args = command_parts[1:]
            
            # Execute modifying commands
            if command == 'SET':
                if len(args) < 2:
                    raise ValueError("SET requires key and value")
                result = self._client.set(args[0], args[1])
                return 1 if result else 0
                
            elif command == 'MSET':
                if len(args) % 2 != 0:
                    raise ValueError("MSET requires even number of arguments (key-value pairs)")
                mapping = {args[i]: args[i+1] for i in range(0, len(args), 2)}
                result = self._client.mset(mapping)
                return len(mapping) if result else 0
                
            elif command == 'DEL':
                if len(args) < 1:
                    raise ValueError("DEL requires at least one key")
                return self._client.delete(*args)
                
            elif command == 'HSET':
                if len(args) < 3:
                    raise ValueError("HSET requires key, field, and value")
                key = args[0]
                mapping = {args[i]: args[i+1] for i in range(1, len(args), 2)}
                return self._client.hset(key, mapping=mapping)
                
            elif command == 'LPUSH':
                if len(args) < 2:
                    raise ValueError("LPUSH requires key and at least one value")
                return self._client.lpush(args[0], *args[1:])
                
            elif command == 'RPUSH':
                if len(args) < 2:
                    raise ValueError("RPUSH requires key and at least one value")
                return self._client.rpush(args[0], *args[1:])
                
            elif command == 'SADD':
                if len(args) < 2:
                    raise ValueError("SADD requires key and at least one member")
                return self._client.sadd(args[0], *args[1:])
                
            elif command == 'ZADD':
                if len(args) < 3 or len(args) % 2 == 0:
                    raise ValueError("ZADD requires key and score-member pairs")
                key = args[0]
                mapping = {args[i+1]: float(args[i]) for i in range(1, len(args), 2)}
                return self._client.zadd(key, mapping)
                
            elif command == 'FLUSHDB':
                result = self._client.flushdb()
                return 1 if result else 0
                
            elif command == 'EXPIRE':
                if len(args) != 2:
                    raise ValueError("EXPIRE requires key and seconds")
                return self._client.expire(args[0], int(args[1]))
                
            else:
                # Try to execute as generic command
                result = self._client.execute_command(command, *args)
                return 1 if result else 0
            
        except Exception as e:
            logger.error(f"Error executing Redis non-query: {e}")
            raise e
    
    def get_sample_data(self, table_name: str, limit: int = 10, 
                       schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sample data from Redis key pattern"""
        try:
            # Find keys matching the pattern
            if table_name == 'misc':
                all_keys = self._client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k and '_' not in k]
            else:
                pattern_keys = self._client.keys(f"{table_name}:*")
                if not pattern_keys:
                    pattern_keys = self._client.keys(f"{table_name}_*")
            
            if not pattern_keys:
                return []
            
            # Get sample data from first few keys
            sample_data = []
            for key in pattern_keys[:limit]:
                try:
                    key_type = self._client.type(key)
                    ttl = self._client.ttl(key)
                    
                    value_data = {'key': key, 'type': key_type, 'ttl': ttl if ttl > 0 else None}
                    
                    # Get value based on type
                    if key_type == 'string':
                        value_data['value'] = self._client.get(key)
                    elif key_type == 'hash':
                        value_data['value'] = self._client.hgetall(key)
                    elif key_type == 'list':
                        value_data['value'] = self._client.lrange(key, 0, 4)  # First 5 items
                        value_data['length'] = self._client.llen(key)
                    elif key_type == 'set':
                        members = list(self._client.smembers(key))
                        value_data['value'] = members[:5]  # First 5 members
                        value_data['length'] = len(members)
                    elif key_type == 'zset':
                        value_data['value'] = self._client.zrange(key, 0, 4, withscores=True)
                        value_data['length'] = self._client.zcard(key)
                    else:
                        value_data['value'] = f"<{key_type}>"
                    
                    sample_data.append(value_data)
                    
                except Exception as e:
                    logger.warning(f"Error getting sample data for key {key}: {e}")
            
            return sample_data
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for Redis key pattern"""
        # Redis doesn't have a fixed schema, but we can analyze key patterns
        try:
            # Get sample data to infer schema
            sample_data = self.get_sample_data(table_name, limit=20)
            
            if not sample_data:
                return []
            
            # Analyze common fields across samples
            field_analysis = {}
            
            for item in sample_data:
                # Always have key, type, ttl
                for field in ['key', 'type', 'ttl']:
                    if field not in field_analysis:
                        field_analysis[field] = {'types': set(), 'null_count': 0, 'total_count': 0}
                    
                    field_analysis[field]['total_count'] += 1
                    value = item.get(field)
                    
                    if value is None:
                        field_analysis[field]['null_count'] += 1
                    else:
                        field_analysis[field]['types'].add(type(value).__name__)
                
                # Analyze value structure for hashes
                if item.get('type') == 'hash' and isinstance(item.get('value'), dict):
                    for hash_field, hash_value in item['value'].items():
                        field_name = f"hash.{hash_field}"
                        if field_name not in field_analysis:
                            field_analysis[field_name] = {'types': set(), 'null_count': 0, 'total_count': 0}
                        
                        field_analysis[field_name]['total_count'] += 1
                        if hash_value is None:
                            field_analysis[field_name]['null_count'] += 1
                        else:
                            field_analysis[field_name]['types'].add(type(hash_value).__name__)
            
            # Convert to ColumnInfo objects
            columns = []
            for field, analysis in field_analysis.items():
                # Determine primary data type
                types = list(analysis['types'])
                if len(types) == 1:
                    data_type = types[0]
                elif len(types) > 1:
                    data_type = f"mixed({', '.join(sorted(types))})"
                else:
                    data_type = "null"
                
                # Calculate nullability
                nullable = analysis['null_count'] > 0
                
                columns.append(ColumnInfo(
                    name=field,
                    data_type=data_type,
                    nullable=nullable,
                    primary_key=field == 'key',
                    metadata={
                        'types': types,
                        'null_percentage': (analysis['null_count'] / analysis['total_count']) * 100,
                        'presence_percentage': ((analysis['total_count'] - analysis['null_count']) / len(sample_data)) * 100
                    }
                ))
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting key pattern schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for Redis (Redis doesn't have traditional indexes)"""
        # Redis doesn't have traditional indexes, but we can return info about sorted sets
        try:
            # Find keys matching the pattern
            if table_name == 'misc':
                all_keys = self._client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k and '_' not in k]
            else:
                pattern_keys = self._client.keys(f"{table_name}:*")
                if not pattern_keys:
                    pattern_keys = self._client.keys(f"{table_name}_*")
            
            indexes = []
            
            # Check for sorted sets (which act like indexes)
            for key in pattern_keys[:10]:  # Check first 10 keys
                try:
                    key_type = self._client.type(key)
                    if key_type == 'zset':
                        card = self._client.zcard(key)
                        indexes.append({
                            'name': key,
                            'type': 'sorted_set',
                            'cardinality': card,
                            'description': f'Sorted set with {card} members'
                        })
                except Exception as e:
                    logger.warning(f"Error checking index for key {key}: {e}")
            
            return indexes
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for Redis (Redis doesn't have constraints)"""
        # Redis doesn't have traditional constraints
        # We can return TTL information as a form of constraint
        try:
            # Find keys matching the pattern
            if table_name == 'misc':
                all_keys = self._client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k and '_' not in k]
            else:
                pattern_keys = self._client.keys(f"{table_name}:*")
                if not pattern_keys:
                    pattern_keys = self._client.keys(f"{table_name}_*")
            
            constraints = []
            
            # Check for TTL constraints
            ttl_keys = []
            for key in pattern_keys[:20]:  # Check first 20 keys
                try:
                    ttl = self._client.ttl(key)
                    if ttl > 0:
                        ttl_keys.append({'key': key, 'ttl': ttl})
                except Exception as e:
                    logger.warning(f"Error checking TTL for key {key}: {e}")
            
            if ttl_keys:
                constraints.append({
                    'name': 'ttl_expiration',
                    'type': 'TTL',
                    'description': f'{len(ttl_keys)} keys have expiration times',
                    'keys_with_ttl': ttl_keys[:5]  # Show first 5 as examples
                })
            
            return constraints
            
        except Exception as e:
            logger.error(f"Error getting constraints: {e}")
            return []
    
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file to Redis"""
        start_time = time.time()
        
        try:
            if not os.path.exists(file_path):
                return ImportResult(
                    success=False,
                    errors=[f"File not found: {file_path}"]
                )
            
            file_format = options.file_format.lower()
            
            if file_format == 'json':
                return self._import_json(file_path, options, start_time)
            elif file_format == 'rdb':
                return self._import_rdb(file_path, options, start_time)
            elif file_format == 'aof':
                return self._import_aof(file_path, options, start_time)
            elif file_format == 'csv':
                return self._import_csv(file_path, options, start_time)
            else:
                return ImportResult(
                    success=False,
                    errors=[f"Unsupported file format: {file_format}"],
                    execution_time=time.time() - start_time
                )
                
        except Exception as e:
            logger.error(f"Error importing data: {e}")
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def export_data(self, query: str, file_path: str, options: ExportOptions) -> ExportResult:
        """Export data from Redis to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'rdb':
                return self._export_rdb(file_path, options, start_time)
            elif file_format == 'aof':
                return self._export_aof(file_path, options, start_time)
            elif file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            else:
                return ExportResult(
                    success=False,
                    errors=[f"Unsupported file format: {file_format}"],
                    execution_time=time.time() - start_time
                )
                
        except Exception as e:
            logger.error(f"Error exporting data: {e}")
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _parse_redis_command(self, command: str) -> List[str]:
        """Parse Redis command string into parts"""
        try:
            # Simple parsing - split by spaces but handle quoted strings
            parts = []
            current_part = ""
            in_quotes = False
            quote_char = None
            
            i = 0
            while i < len(command):
                char = command[i]
                
                if not in_quotes:
                    if char in ['"', "'"]:
                        in_quotes = True
                        quote_char = char
                    elif char == ' ':
                        if current_part:
                            parts.append(current_part)
                            current_part = ""
                    else:
                        current_part += char
                else:
                    if char == quote_char:
                        in_quotes = False
                        quote_char = None
                    else:
                        current_part += char
                
                i += 1
            
            if current_part:
                parts.append(current_part)
            
            return parts
            
        except Exception as e:
            logger.error(f"Error parsing Redis command: {e}")
            return []
    
    def _import_json(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import JSON file to Redis"""
        try:
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                data = json.load(jsonfile)
            
            if not isinstance(data, dict):
                return ImportResult(
                    success=False,
                    errors=["JSON file must contain a dictionary of key-value pairs"],
                    execution_time=time.time() - start_time
                )
            
            rows_imported = 0
            errors = []
            
            # Clear database if requested
            if options.truncate_table:
                self._client.flushdb()
            
            # Import data
            for key, value in data.items():
                try:
                    if isinstance(value, dict):
                        # Store as hash
                        self._client.hset(key, mapping=value)
                    elif isinstance(value, list):
                        # Store as list
                        self._client.delete(key)  # Clear existing
                        if value:  # Only if list is not empty
                            self._client.lpush(key, *reversed(value))
                    else:
                        # Store as string
                        self._client.set(key, json.dumps(value) if not isinstance(value, str) else value)
                    
                    rows_imported += 1
                    
                    if options.progress_callback and rows_imported % 100 == 0:
                        options.progress_callback(rows_imported, f"Imported {rows_imported} keys")
                        
                except Exception as e:
                    error_msg = f"Key '{key}': {str(e)}"
                    errors.append(error_msg)
                    
                    if not options.ignore_errors:
                        break
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_imported,
                rows_failed=len(errors),
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_rdb(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import RDB file to Redis using redis-cli"""
        try:
            # Stop Redis server, replace RDB file, restart (not practical for remote Redis)
            # Instead, we'll use redis-cli with --rdb option if available
            
            return ImportResult(
                success=False,
                errors=["RDB import requires direct server access and is not supported in client mode"],
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_aof(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import AOF file to Redis"""
        try:
            # Read AOF file and execute commands
            rows_imported = 0
            errors = []
            
            with open(file_path, 'r', encoding='utf-8') as aof_file:
                lines = aof_file.readlines()
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                if line.startswith('*'):
                    # Redis protocol format
                    try:
                        # Parse command from protocol format
                        num_args = int(line[1:])
                        command_parts = []
                        
                        for j in range(num_args):
                            i += 1
                            if i >= len(lines):
                                break
                            
                            # Skip length line
                            i += 1
                            if i >= len(lines):
                                break
                            
                            # Get argument
                            arg = lines[i].strip()
                            command_parts.append(arg)
                        
                        if command_parts:
                            # Execute command
                            self._client.execute_command(*command_parts)
                            rows_imported += 1
                            
                    except Exception as e:
                        error_msg = f"Line {i}: {str(e)}"
                        errors.append(error_msg)
                        
                        if not options.ignore_errors:
                            break
                
                i += 1
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_imported,
                rows_failed=len(errors),
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_csv(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import CSV file to Redis"""
        try:
            import csv
            
            rows_imported = 0
            errors = []
            
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                
                for row_num, row in enumerate(reader, 1):
                    try:
                        # Use first column as key, rest as hash fields
                        columns = list(row.keys())
                        if not columns:
                            continue
                        
                        key_column = columns[0]
                        key = row[key_column]
                        
                        if len(columns) == 2:
                            # Simple key-value
                            value_column = columns[1]
                            self._client.set(key, row[value_column])
                        else:
                            # Hash with multiple fields
                            hash_data = {col: row[col] for col in columns[1:] if row[col]}
                            if hash_data:
                                self._client.hset(key, mapping=hash_data)
                        
                        rows_imported += 1
                        
                        if options.progress_callback and rows_imported % 100 == 0:
                            options.progress_callback(rows_imported, f"Imported {rows_imported} rows")
                            
                    except Exception as e:
                        error_msg = f"Row {row_num}: {str(e)}"
                        errors.append(error_msg)
                        
                        if not options.ignore_errors:
                            break
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_imported,
                rows_failed=len(errors),
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_json(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export Redis data to JSON file"""
        try:
            # Parse query to get key pattern
            pattern = query.strip() if query.strip() else '*'
            
            # Get all matching keys
            keys = self._client.keys(pattern)
            
            if not keys:
                # Create empty file
                with open(file_path, 'w', encoding='utf-8') as jsonfile:
                    json.dump({}, jsonfile)
                
                return ExportResult(
                    success=True,
                    rows_exported=0,
                    file_path=file_path,
                    execution_time=time.time() - start_time
                )
            
            # Export data
            export_data = {}
            rows_exported = 0
            
            for key in keys:
                try:
                    key_type = self._client.type(key)
                    
                    if key_type == 'string':
                        export_data[key] = self._client.get(key)
                    elif key_type == 'hash':
                        export_data[key] = self._client.hgetall(key)
                    elif key_type == 'list':
                        export_data[key] = self._client.lrange(key, 0, -1)
                    elif key_type == 'set':
                        export_data[key] = list(self._client.smembers(key))
                    elif key_type == 'zset':
                        export_data[key] = self._client.zrange(key, 0, -1, withscores=True)
                    else:
                        export_data[key] = f"<{key_type}>"
                    
                    rows_exported += 1
                    
                    if options.progress_callback and rows_exported % 100 == 0:
                        options.progress_callback(rows_exported, f"Exported {rows_exported} keys")
                        
                except Exception as e:
                    logger.warning(f"Error exporting key {key}: {e}")
            
            # Write to JSON file
            with open(file_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(export_data, jsonfile, indent=2, default=str)
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                rows_exported=rows_exported,
                file_size=file_size,
                file_path=file_path,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_rdb(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export Redis data to RDB file using BGSAVE"""
        try:
            # Trigger background save
            self._client.bgsave()
            
            # Note: This creates an RDB file on the Redis server, not locally
            # For a complete implementation, you'd need to copy the file from server
            
            return ExportResult(
                success=True,
                file_path=file_path,
                execution_time=time.time() - start_time,
                metadata={'note': 'RDB file created on Redis server. Manual copy required.'}
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_aof(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export Redis data to AOF format"""
        try:
            # Get all keys and generate AOF commands
            keys = self._client.keys('*')
            
            rows_exported = 0
            
            with open(file_path, 'w', encoding='utf-8') as aof_file:
                for key in keys:
                    try:
                        key_type = self._client.type(key)
                        
                        if key_type == 'string':
                            value = self._client.get(key)
                            aof_file.write(f"*3\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n${len(value)}\r\n{value}\r\n")
                            
                        elif key_type == 'hash':
                            hash_data = self._client.hgetall(key)
                            for field, value in hash_data.items():
                                aof_file.write(f"*4\r\n$4\r\nHSET\r\n${len(key)}\r\n{key}\r\n${len(field)}\r\n{field}\r\n${len(value)}\r\n{value}\r\n")
                        
                        # Add more types as needed...
                        
                        rows_exported += 1
                        
                    except Exception as e:
                        logger.warning(f"Error exporting key {key}: {e}")
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                rows_exported=rows_exported,
                file_size=file_size,
                file_path=file_path,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_csv(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export Redis data to CSV file"""
        try:
            import csv
            
            # Parse query to get key pattern
            pattern = query.strip() if query.strip() else '*'
            
            # Get all matching keys
            keys = self._client.keys(pattern)
            
            if not keys:
                # Create empty CSV
                with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(['key', 'type', 'value'])
                
                return ExportResult(
                    success=True,
                    rows_exported=0,
                    file_path=file_path,
                    execution_time=time.time() - start_time
                )
            
            rows_exported = 0
            
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                
                if options.include_headers:
                    writer.writerow(['key', 'type', 'value', 'ttl'])
                
                for key in keys:
                    try:
                        key_type = self._client.type(key)
                        ttl = self._client.ttl(key)
                        
                        if key_type == 'string':
                            value = self._client.get(key)
                        elif key_type == 'hash':
                            value = json.dumps(self._client.hgetall(key))
                        elif key_type == 'list':
                            value = json.dumps(self._client.lrange(key, 0, -1))
                        elif key_type == 'set':
                            value = json.dumps(list(self._client.smembers(key)))
                        elif key_type == 'zset':
                            value = json.dumps(self._client.zrange(key, 0, -1, withscores=True))
                        else:
                            value = f"<{key_type}>"
                        
                        writer.writerow([key, key_type, value, ttl if ttl > 0 else None])
                        rows_exported += 1
                        
                        if options.progress_callback and rows_exported % 100 == 0:
                            options.progress_callback(rows_exported, f"Exported {rows_exported} keys")
                            
                    except Exception as e:
                        logger.warning(f"Error exporting key {key}: {e}")
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                rows_exported=rows_exported,
                file_size=file_size,
                file_path=file_path,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )