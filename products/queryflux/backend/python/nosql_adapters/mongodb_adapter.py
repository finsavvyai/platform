"""
MongoDB Adapter
Provides MongoDB-specific implementation for the NoSQL interface
"""

import time
from typing import Dict, List, Optional, Any
from .base_adapter import (
    BaseNoSQLAdapter, DatabaseType, QueryType, 
    DatabaseInfo, CollectionInfo, QueryResult, ConnectionParams
)

try:
    import pymongo
    from pymongo import MongoClient
    from bson import ObjectId
    import bson
    PYMONGO_AVAILABLE = True
except ImportError:
    PYMONGO_AVAILABLE = False

class MongoDBAdapter(BaseNoSQLAdapter):
    """MongoDB database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        if not PYMONGO_AVAILABLE:
            raise ImportError("pymongo is required for MongoDB support. Install with: pip install pymongo")
        
        super().__init__(connection_params)
    
    @property
    def database_type(self) -> DatabaseType:
        return DatabaseType.MONGODB
    
    def connect(self) -> bool:
        """Establish connection to MongoDB"""
        try:
            # Build connection URI
            uri_parts = []
            
            if self.connection_params.username and self.connection_params.password:
                auth_str = f"{self.connection_params.username}:{self.connection_params.password}"
                if self.connection_params.auth_database:
                    auth_str += f"@{self.connection_params.host}:{self.connection_params.port}/{self.connection_params.auth_database}"
                else:
                    auth_str += f"@{self.connection_params.host}:{self.connection_params.port}"
                uri = f"mongodb://{auth_str}"
            else:
                uri = f"mongodb://{self.connection_params.host}:{self.connection_params.port}"
            
            # Add SSL if specified
            if self.connection_params.ssl:
                uri += "?ssl=true"
            
            # Create client with timeout
            self.client = MongoClient(
                uri,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                **self.connection_params.additional_params
            )
            
            # Test connection
            self.client.server_info()
            
            # Select database
            if self.connection_params.database:
                self.database = self.client[self.connection_params.database]
            
            self._connected = True
            self._connection_time = time.time()
            return True
            
        except Exception as e:
            self._connected = False
            raise Exception(self.format_error(e))
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            self.client = None
            self.database = None
            self._connected = False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test MongoDB connection"""
        try:
            if not self._connected:
                self.connect()
            
            # Get server info
            server_info = self.client.server_info()
            
            return {
                'success': True,
                'version': server_info.get('version'),
                'connection_time': time.time() - self._connection_time if self._connection_time else 0,
                'server_info': server_info
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': self.format_error(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get MongoDB database information"""
        if not self._connected:
            raise Exception("Not connected to database")
        
        try:
            # Get database stats
            if self.database:
                stats = self.database.command("dbstats")
                db_name = self.database.name
            else:
                # Use admin database for server stats
                stats = self.client.admin.command("dbstats")
                db_name = "admin"
            
            # Get server info
            server_info = self.client.server_info()
            
            # Count collections
            collections = self.database.list_collection_names() if self.database else []
            
            return DatabaseInfo(
                name=db_name,
                db_type=DatabaseType.MONGODB,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=server_info.get('version'),
                size_bytes=stats.get('dataSize', 0),
                collections_count=len(collections),
                documents_count=stats.get('objects', 0),
                metadata={
                    'indexes': stats.get('indexes', 0),
                    'storage_size': stats.get('storageSize', 0),
                    'index_size': stats.get('indexSize', 0),
                    'file_size': stats.get('fileSize', 0),
                    'avg_obj_size': stats.get('avgObjSize', 0)
                }
            )
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def list_collections(self) -> List[CollectionInfo]:
        """List all collections in the database"""
        if not self.database:
            raise Exception("No database selected")
        
        try:
            collections = []
            
            for collection_name in self.database.list_collection_names():
                collection_info = self.get_collection_info(collection_name)
                collections.append(collection_info)
            
            return collections
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_collection_info(self, collection_name: str) -> CollectionInfo:
        """Get detailed information about a MongoDB collection"""
        if not self.database:
            raise Exception("No database selected")
        
        try:
            collection = self.database[collection_name]
            
            # Get collection stats
            try:
                stats = self.database.command("collstats", collection_name)
                document_count = stats.get('count', 0)
                size_bytes = stats.get('size', 0)
            except:
                # Fallback method
                document_count = collection.estimated_document_count()
                size_bytes = 0
            
            # Get indexes
            indexes = []
            try:
                for index in collection.list_indexes():
                    indexes.append({
                        'name': index.get('name'),
                        'keys': index.get('key'),
                        'unique': index.get('unique', False),
                        'sparse': index.get('sparse', False)
                    })
            except:
                indexes = []
            
            # Get schema sample
            schema_sample = None
            try:
                sample_doc = collection.find_one()
                if sample_doc:
                    # Convert ObjectId to string for JSON serialization
                    schema_sample = self._serialize_document(sample_doc)
            except:
                pass
            
            return CollectionInfo(
                name=collection_name,
                document_count=document_count,
                size_bytes=size_bytes,
                indexes=indexes,
                schema_sample=schema_sample,
                metadata={
                    'storage_size': stats.get('storageSize', 0) if 'stats' in locals() else 0,
                    'avg_obj_size': stats.get('avgObjSize', 0) if 'stats' in locals() else 0,
                    'index_count': len(indexes)
                }
            )
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def execute_query(self, query: Any, collection: Optional[str] = None, 
                     limit: int = 100) -> QueryResult:
        """Execute a MongoDB query"""
        if not self.database:
            raise Exception("No database selected")
        
        start_time = time.time()
        
        try:
            if isinstance(query, str):
                # Try to parse as JSON query
                import json
                query = json.loads(query)
            
            if not isinstance(query, dict):
                raise ValueError("Query must be a dictionary or JSON string")
            
            if not collection:
                raise ValueError("Collection name is required")
            
            coll = self.database[collection]
            
            # Determine query type and execute
            if 'find' in query or not any(op in query for op in ['insert', 'update', 'delete', 'aggregate']):
                # Find operation
                find_query = query.get('find', query)
                projection = query.get('projection', None)
                sort = query.get('sort', None)
                
                cursor = coll.find(find_query, projection)
                
                if sort:
                    cursor = cursor.sort(sort)
                
                cursor = cursor.limit(limit)
                
                documents = []
                for doc in cursor:
                    documents.append(self._serialize_document(doc))
                
                execution_time = time.time() - start_time
                
                return QueryResult(
                    success=True,
                    data=documents,
                    total_count=len(documents),
                    execution_time=execution_time,
                    query_type=QueryType.FIND
                )
            
            elif 'aggregate' in query:
                # Aggregation pipeline
                pipeline = query['aggregate']
                if not isinstance(pipeline, list):
                    pipeline = [pipeline]
                
                cursor = coll.aggregate(pipeline)
                documents = [self._serialize_document(doc) for doc in cursor]
                
                execution_time = time.time() - start_time
                
                return QueryResult(
                    success=True,
                    data=documents,
                    total_count=len(documents),
                    execution_time=execution_time,
                    query_type=QueryType.AGGREGATE
                )
            
            elif 'insert' in query:
                # Insert operation
                docs = query['insert']
                if isinstance(docs, dict):
                    result = coll.insert_one(docs)
                    inserted_count = 1
                else:
                    result = coll.insert_many(docs)
                    inserted_count = len(result.inserted_ids)
                
                execution_time = time.time() - start_time
                
                return QueryResult(
                    success=True,
                    data=[],
                    total_count=inserted_count,
                    execution_time=execution_time,
                    query_type=QueryType.INSERT,
                    metadata={'inserted_count': inserted_count}
                )
            
            else:
                raise ValueError(f"Unsupported query operation: {list(query.keys())}")
                
        except Exception as e:
            execution_time = time.time() - start_time
            return QueryResult(
                success=False,
                execution_time=execution_time,
                error_message=self.format_error(e)
            )
    
    def get_sample_documents(self, collection: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get sample documents from a MongoDB collection"""
        if not self.database:
            raise Exception("No database selected")
        
        try:
            coll = self.database[collection]
            documents = []
            
            for doc in coll.find().limit(limit):
                documents.append(self._serialize_document(doc))
            
            return documents
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get MongoDB performance statistics"""
        base_stats = super().get_performance_stats()
        
        if not self._connected:
            return base_stats
        
        try:
            # Get server status
            server_status = self.client.admin.command("serverStatus")
            
            mongo_stats = {
                'connections_current': server_status.get('connections', {}).get('current', 0),
                'connections_available': server_status.get('connections', {}).get('available', 0),
                'memory_resident': server_status.get('mem', {}).get('resident', 0),
                'memory_virtual': server_status.get('mem', {}).get('virtual', 0),
                'uptime_seconds': server_status.get('uptime', 0),
                'opcounters': server_status.get('opcounters', {}),
                'network': server_status.get('network', {})
            }
            
            base_stats.update(mongo_stats)
            return base_stats
            
        except Exception:
            return base_stats
    
    def explain_query(self, query: Any, collection: Optional[str] = None) -> Dict[str, Any]:
        """Explain MongoDB query execution plan"""
        if not self.database or not collection:
            return {'supported': False, 'message': 'Database and collection required'}
        
        try:
            if isinstance(query, str):
                import json
                query = json.loads(query)
            
            coll = self.database[collection]
            
            # Get query plan
            find_query = query.get('find', query)
            cursor = coll.find(find_query)
            
            explain_result = cursor.explain()
            
            return {
                'supported': True,
                'execution_plan': explain_result,
                'index_used': explain_result.get('executionStats', {}).get('indexUsed', False),
                'documents_examined': explain_result.get('executionStats', {}).get('docsExamined', 0),
                'execution_time': explain_result.get('executionStats', {}).get('executionTimeMillis', 0)
            }
            
        except Exception as e:
            return {
                'supported': False,
                'error': self.format_error(e)
            }
    
    def create_index(self, collection: str, fields: List[str], 
                    options: Optional[Dict[str, Any]] = None) -> bool:
        """Create an index on MongoDB collection"""
        if not self.database:
            return False
        
        try:
            coll = self.database[collection]
            
            # Convert fields to index specification
            if len(fields) == 1:
                index_spec = fields[0]
            else:
                index_spec = [(field, 1) for field in fields]  # Ascending by default
            
            # Create index
            coll.create_index(index_spec, **(options or {}))
            return True
            
        except Exception:
            return False
    
    def get_query_suggestions(self, partial_query: str, 
                            context: Optional[Dict[str, Any]] = None) -> List[str]:
        """Get MongoDB query suggestions"""
        suggestions = []
        
        # Basic MongoDB query patterns
        if not partial_query or partial_query.strip() == "{":
            suggestions.extend([
                '{"field": "value"}',
                '{"field": {"$gt": 0}}',
                '{"field": {"$in": ["value1", "value2"]}}',
                '{"$and": [{"field1": "value1"}, {"field2": "value2"}]}',
                '{"field": {"$regex": "pattern", "$options": "i"}}'
            ])
        
        # Aggregation pipeline suggestions
        if "aggregate" in partial_query.lower() or "[" in partial_query:
            suggestions.extend([
                '[{"$match": {"field": "value"}}]',
                '[{"$group": {"_id": "$field", "count": {"$sum": 1}}}]',
                '[{"$sort": {"field": 1}}]',
                '[{"$limit": 10}]',
                '[{"$project": {"field1": 1, "field2": 1}}]'
            ])
        
        return suggestions[:10]  # Limit suggestions
    
    def convert_from_sql(self, sql_query: str) -> Dict[str, Any]:
        """Convert SQL query to MongoDB query (basic conversion)"""
        try:
            sql_lower = sql_query.lower().strip()
            
            # Very basic SQL to MongoDB conversion
            if sql_lower.startswith('select'):
                # Extract basic SELECT patterns
                if ' from ' in sql_lower:
                    parts = sql_lower.split(' from ')
                    if len(parts) >= 2:
                        table = parts[1].split()[0]
                        
                        # Check for WHERE clause
                        if ' where ' in sql_lower:
                            where_part = sql_lower.split(' where ')[1]
                            # Very simple conversion (field = 'value')
                            if '=' in where_part:
                                field_value = where_part.split('=')
                                if len(field_value) == 2:
                                    field = field_value[0].strip()
                                    value = field_value[1].strip().strip("'\"")
                                    
                                    return {
                                        'supported': True,
                                        'collection': table,
                                        'query': {field: value}
                                    }
                        
                        return {
                            'supported': True,
                            'collection': table,
                            'query': {}
                        }
            
            return {
                'supported': False,
                'message': 'SQL conversion is limited to basic SELECT statements'
            }
            
        except Exception as e:
            return {
                'supported': False,
                'error': str(e)
            }
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get MongoDB health metrics"""
        base_metrics = super().get_health_metrics()
        
        if not self._connected:
            return base_metrics
        
        try:
            # Test response time
            start_time = time.time()
            self.client.admin.command('ping')
            response_time = time.time() - start_time
            
            # Get server status
            server_status = self.client.admin.command("serverStatus")
            
            mongo_metrics = {
                'response_time': response_time,
                'uptime': server_status.get('uptime', 0),
                'connections_current': server_status.get('connections', {}).get('current', 0),
                'connections_available': server_status.get('connections', {}).get('available', 0),
                'memory_usage': server_status.get('mem', {}).get('resident', 0),
                'operations_per_second': self._calculate_ops_per_second(server_status.get('opcounters', {})),
                'lock_ratio': self._calculate_lock_ratio(server_status.get('globalLock', {}))
            }
            
            base_metrics.update(mongo_metrics)
            return base_metrics
            
        except Exception:
            return base_metrics
    
    def _serialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize MongoDB document for JSON compatibility"""
        if not doc:
            return {}
        
        serialized = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, bson.datetime.datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, dict):
                serialized[key] = self._serialize_document(value)
            elif isinstance(value, list):
                serialized[key] = [self._serialize_document(item) if isinstance(item, dict) else item for item in value]
            else:
                serialized[key] = value
        
        return serialized
    
    def _calculate_ops_per_second(self, opcounters: Dict[str, Any]) -> float:
        """Calculate operations per second from opcounters"""
        try:
            total_ops = sum([
                opcounters.get('insert', 0),
                opcounters.get('query', 0),
                opcounters.get('update', 0),
                opcounters.get('delete', 0)
            ])
            
            uptime = opcounters.get('uptime', 1)
            return total_ops / uptime if uptime > 0 else 0.0
            
        except Exception:
            return 0.0
    
    def _calculate_lock_ratio(self, global_lock: Dict[str, Any]) -> float:
        """Calculate lock ratio from globalLock stats"""
        try:
            total_time = global_lock.get('totalTime', 0)
            lock_time = global_lock.get('lockTime', 0)
            
            if total_time > 0:
                return (lock_time / total_time) * 100
            return 0.0
            
        except Exception:
            return 0.0