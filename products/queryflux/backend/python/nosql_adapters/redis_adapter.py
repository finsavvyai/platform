"""
Redis Adapter
Provides Redis-specific implementation for the NoSQL interface
"""

import time
import json
from typing import Dict, List, Optional, Any
from .base_adapter import (
    BaseNoSQLAdapter, DatabaseType, QueryType,
    DatabaseInfo, CollectionInfo, QueryResult, ConnectionParams
)

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

class RedisAdapter(BaseNoSQLAdapter):
    """Redis database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        if not REDIS_AVAILABLE:
            raise ImportError("redis is required for Redis support. Install with: pip install redis")
        
        super().__init__(connection_params)
        self._db_number = connection_params.database or 0
    
    @property
    def database_type(self) -> DatabaseType:
        return DatabaseType.REDIS
    
    def connect(self) -> bool:
        """Establish connection to Redis"""
        try:
            # Create Redis connection
            self.client = redis.Redis(
                host=self.connection_params.host,
                port=self.connection_params.port,
                db=self._db_number,
                username=self.connection_params.username,
                password=self.connection_params.password,
                ssl=self.connection_params.ssl,
                decode_responses=True,  # Decode byte responses to strings
                socket_connect_timeout=5,
                socket_timeout=5,
                **self.connection_params.additional_params
            )
            
            # Test connection
            self.client.ping()
            
            self._connected = True
            self._connection_time = time.time()
            return True
            
        except Exception as e:
            self._connected = False
            raise Exception(self.format_error(e))
    
    def disconnect(self):
        """Close Redis connection"""
        if self.client:
            self.client.close()
            self.client = None
            self._connected = False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Redis connection"""
        try:
            if not self._connected:
                self.connect()
            
            # Get server info
            info = self.client.info()
            
            return {
                'success': True,
                'version': info.get('redis_version'),
                'connection_time': time.time() - self._connection_time if self._connection_time else 0,
                'server_info': {
                    'redis_version': info.get('redis_version'),
                    'uptime_in_seconds': info.get('uptime_in_seconds'),
                    'used_memory': info.get('used_memory'),
                    'connected_clients': info.get('connected_clients')
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': self.format_error(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get Redis database information"""
        if not self._connected:
            raise Exception("Not connected to database")
        
        try:
            info = self.client.info()
            
            # Get keyspace info for current database
            keyspace_key = f'db{self._db_number}'
            keyspace_info = info.get(keyspace_key, {})
            
            # Extract key count from keyspace string format (keys=X,expires=Y)
            keys_count = 0
            if isinstance(keyspace_info, str):
                for part in keyspace_info.split(','):
                    if part.startswith('keys='):
                        keys_count = int(part.split('=')[1])
                        break
            elif isinstance(keyspace_info, dict):
                keys_count = keyspace_info.get('keys', 0)
            
            return DatabaseInfo(
                name=f"Redis DB {self._db_number}",
                db_type=DatabaseType.REDIS,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=info.get('redis_version'),
                size_bytes=info.get('used_memory', 0),
                collections_count=1,  # Redis has one logical database per DB number
                documents_count=keys_count,
                metadata={
                    'uptime_seconds': info.get('uptime_in_seconds', 0),
                    'connected_clients': info.get('connected_clients', 0),
                    'total_commands_processed': info.get('total_commands_processed', 0),
                    'keyspace_hits': info.get('keyspace_hits', 0),
                    'keyspace_misses': info.get('keyspace_misses', 0),
                    'memory_usage': info.get('used_memory_human', 'N/A')
                }
            )
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def list_collections(self) -> List[CollectionInfo]:
        """List Redis key patterns as 'collections'"""
        try:
            # Get all keys
            all_keys = self.client.keys('*')
            
            if not all_keys:
                return []
            
            # Group keys by pattern (prefix before first :)
            patterns = {}
            for key in all_keys:
                if ':' in key:
                    prefix = key.split(':', 1)[0]
                else:
                    prefix = 'simple_keys'
                
                if prefix not in patterns:
                    patterns[prefix] = []
                patterns[prefix].append(key)
            
            collections = []
            for pattern, keys in patterns.items():
                # Sample a few keys to determine types
                sample_types = {}
                sample_keys = keys[:10]  # Sample first 10 keys
                
                for key in sample_keys:
                    key_type = self.client.type(key)
                    if key_type not in sample_types:
                        sample_types[key_type] = 0
                    sample_types[key_type] += 1
                
                # Calculate total memory usage for this pattern
                total_memory = sum(self.client.memory_usage(key) or 0 for key in keys)
                
                collections.append(CollectionInfo(
                    name=pattern,
                    document_count=len(keys),
                    size_bytes=total_memory,
                    indexes=[],  # Redis doesn't have traditional indexes
                    schema_sample=None,
                    metadata={
                        'key_types': sample_types,
                        'sample_keys': sample_keys[:5],  # Show first 5 as examples
                        'pattern': f"{pattern}:*" if pattern != 'simple_keys' else '*'
                    }
                ))
            
            return collections
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_collection_info(self, collection_name: str) -> CollectionInfo:
        """Get detailed information about a Redis key pattern"""
        try:
            # Get keys matching the pattern
            if collection_name == 'simple_keys':
                # Keys without pattern
                all_keys = self.client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k]
            else:
                pattern_keys = self.client.keys(f"{collection_name}:*")
            
            if not pattern_keys:
                return CollectionInfo(
                    name=collection_name,
                    document_count=0,
                    size_bytes=0,
                    indexes=[],
                    metadata={'pattern': f"{collection_name}:*"}
                )
            
            # Analyze key types and sizes
            type_distribution = {}
            total_memory = 0
            sample_data = {}
            
            for key in pattern_keys[:20]:  # Analyze first 20 keys
                key_type = self.client.type(key)
                key_memory = self.client.memory_usage(key) or 0
                
                if key_type not in type_distribution:
                    type_distribution[key_type] = 0
                type_distribution[key_type] += 1
                total_memory += key_memory
                
                # Get sample data for first few keys
                if len(sample_data) < 5:
                    try:
                        if key_type == 'string':
                            value = self.client.get(key)
                        elif key_type == 'hash':
                            value = self.client.hgetall(key)
                        elif key_type == 'list':
                            value = self.client.lrange(key, 0, 4)  # First 5 elements
                        elif key_type == 'set':
                            value = list(self.client.smembers(key))[:5]
                        elif key_type == 'zset':
                            value = self.client.zrange(key, 0, 4, withscores=True)
                        else:
                            value = None
                        
                        sample_data[key] = {
                            'type': key_type,
                            'value': value,
                            'size_bytes': key_memory
                        }
                    except:
                        pass
            
            return CollectionInfo(
                name=collection_name,
                document_count=len(pattern_keys),
                size_bytes=total_memory,
                indexes=[],
                schema_sample=sample_data,
                metadata={
                    'pattern': f"{collection_name}:*" if collection_name != 'simple_keys' else '*',
                    'type_distribution': type_distribution,
                    'avg_key_size': total_memory / len(pattern_keys) if pattern_keys else 0
                }
            )
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def execute_query(self, query: Any, collection: Optional[str] = None, 
                     limit: int = 100) -> QueryResult:
        """Execute a Redis command"""
        if not self._connected:
            raise Exception("Not connected to database")
        
        start_time = time.time()
        
        try:
            if isinstance(query, str):
                # Parse command string
                parts = query.strip().split()
                command = parts[0].upper()
                args = parts[1:] if len(parts) > 1 else []
            elif isinstance(query, dict):
                # Dictionary format: {"command": "GET", "args": ["key"]}
                command = query.get('command', '').upper()
                args = query.get('args', [])
            else:
                raise ValueError("Query must be a string command or dictionary")
            
            # Execute Redis command
            if command == 'GET':
                if not args:
                    raise ValueError("GET command requires a key")
                result = self.client.get(args[0])
                data = [{'key': args[0], 'value': result, 'type': 'string'}]
                query_type = QueryType.FIND
                
            elif command == 'SET':
                if len(args) < 2:
                    raise ValueError("SET command requires key and value")
                result = self.client.set(args[0], args[1])
                data = [{'key': args[0], 'value': args[1], 'result': result}]
                query_type = QueryType.INSERT
                
            elif command == 'HGETALL':
                if not args:
                    raise ValueError("HGETALL command requires a key")
                result = self.client.hgetall(args[0])
                data = [{'key': args[0], 'hash_data': result, 'type': 'hash'}]
                query_type = QueryType.FIND
                
            elif command == 'KEYS':
                pattern = args[0] if args else '*'
                keys = self.client.keys(pattern)[:limit]  # Limit results
                data = [{'pattern': pattern, 'keys': keys, 'count': len(keys)}]
                query_type = QueryType.FIND
                
            elif command == 'INFO':
                section = args[0] if args else None
                info = self.client.info(section)
                data = [{'section': section or 'all', 'info': info}]
                query_type = QueryType.CUSTOM
                
            elif command == 'SCAN':
                cursor = int(args[0]) if args else 0
                pattern = args[1] if len(args) > 1 else '*'
                count = min(int(args[2]) if len(args) > 2 else 10, limit)
                
                cursor, keys = self.client.scan(cursor, match=pattern, count=count)
                data = [{'cursor': cursor, 'keys': keys, 'pattern': pattern}]
                query_type = QueryType.FIND
                
            elif command == 'TYPE':
                if not args:
                    raise ValueError("TYPE command requires a key")
                key_type = self.client.type(args[0])
                data = [{'key': args[0], 'type': key_type}]
                query_type = QueryType.FIND
                
            else:
                # Try to execute as generic Redis command
                result = self.client.execute_command(command, *args)
                data = [{'command': command, 'args': args, 'result': result}]
                query_type = QueryType.CUSTOM
            
            execution_time = time.time() - start_time
            
            return QueryResult(
                success=True,
                data=data,
                total_count=len(data),
                execution_time=execution_time,
                query_type=query_type
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            return QueryResult(
                success=False,
                execution_time=execution_time,
                error_message=self.format_error(e)
            )
    
    def get_sample_documents(self, collection: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample keys/values from Redis pattern"""
        try:
            if collection == 'simple_keys':
                all_keys = self.client.keys('*')
                pattern_keys = [k for k in all_keys if ':' not in k]
            else:
                pattern_keys = self.client.keys(f"{collection}:*")
            
            sample_keys = pattern_keys[:limit]
            samples = []
            
            for key in sample_keys:
                try:
                    key_type = self.client.type(key)
                    
                    if key_type == 'string':
                        value = self.client.get(key)
                    elif key_type == 'hash':
                        value = self.client.hgetall(key)
                    elif key_type == 'list':
                        value = self.client.lrange(key, 0, 9)  # First 10 elements
                    elif key_type == 'set':
                        value = list(self.client.smembers(key))[:10]
                    elif key_type == 'zset':
                        value = self.client.zrange(key, 0, 9, withscores=True)
                    else:
                        value = None
                    
                    samples.append({
                        'key': key,
                        'type': key_type,
                        'value': value,
                        'ttl': self.client.ttl(key)
                    })
                    
                except Exception:
                    # Skip keys that can't be read
                    continue
            
            return samples
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get Redis performance statistics"""
        base_stats = super().get_performance_stats()
        
        if not self._connected:
            return base_stats
        
        try:
            info = self.client.info()
            
            redis_stats = {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory': info.get('used_memory', 0),
                'used_memory_human': info.get('used_memory_human', 'N/A'),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'instantaneous_ops_per_sec': info.get('instantaneous_ops_per_sec', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': self._calculate_hit_rate(info),
                'uptime_seconds': info.get('uptime_in_seconds', 0)
            }
            
            base_stats.update(redis_stats)
            return base_stats
            
        except Exception:
            return base_stats
    
    def get_query_suggestions(self, partial_query: str, 
                            context: Optional[Dict[str, Any]] = None) -> List[str]:
        """Get Redis command suggestions"""
        suggestions = []
        
        partial_upper = partial_query.upper().strip()
        
        # Common Redis commands
        commands = [
            'GET key',
            'SET key value',
            'HGET key field',
            'HGETALL key',
            'LPUSH key value',
            'LPOP key',
            'SADD key member',
            'SMEMBERS key',
            'KEYS pattern',
            'SCAN cursor',
            'DEL key',
            'EXISTS key',
            'TTL key',
            'EXPIRE key seconds',
            'TYPE key',
            'INFO',
            'PING'
        ]
        
        # Filter suggestions based on partial input
        if not partial_upper:
            suggestions = commands[:10]
        else:
            for cmd in commands:
                if cmd.startswith(partial_upper):
                    suggestions.append(cmd)
            
            # Add generic suggestions if partial matches command name
            command_name = partial_upper.split()[0] if partial_upper else ''
            if command_name and not suggestions:
                for cmd in commands:
                    if cmd.split()[0] == command_name:
                        suggestions.append(cmd)
        
        return suggestions[:10]
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get Redis health metrics"""
        base_metrics = super().get_health_metrics()
        
        if not self._connected:
            return base_metrics
        
        try:
            # Test response time
            start_time = time.time()
            self.client.ping()
            response_time = time.time() - start_time
            
            info = self.client.info()
            
            redis_metrics = {
                'response_time': response_time,
                'uptime': info.get('uptime_in_seconds', 0),
                'connected_clients': info.get('connected_clients', 0),
                'memory_usage': info.get('used_memory', 0),
                'hit_rate': self._calculate_hit_rate(info),
                'ops_per_second': info.get('instantaneous_ops_per_sec', 0),
                'keyspace_keys': self._get_total_keys(info)
            }
            
            base_metrics.update(redis_metrics)
            return base_metrics
            
        except Exception:
            return base_metrics
    
    def _calculate_hit_rate(self, info: Dict[str, Any]) -> float:
        """Calculate cache hit rate"""
        try:
            hits = info.get('keyspace_hits', 0)
            misses = info.get('keyspace_misses', 0)
            
            if hits + misses == 0:
                return 0.0
            
            return (hits / (hits + misses)) * 100
            
        except Exception:
            return 0.0
    
    def _get_total_keys(self, info: Dict[str, Any]) -> int:
        """Get total number of keys across all databases"""
        try:
            total_keys = 0
            
            for key, value in info.items():
                if key.startswith('db') and isinstance(value, str):
                    # Parse keyspace info (format: keys=X,expires=Y)
                    for part in value.split(','):
                        if part.startswith('keys='):
                            total_keys += int(part.split('=')[1])
                            break
            
            return total_keys
            
        except Exception:
            return 0