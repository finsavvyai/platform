"""
MongoDB Database Adapter
Implements the unified DatabaseAdapter interface for MongoDB
"""

import time
import json
import os
import subprocess
from typing import Dict, List, Optional, Any
import logging
from datetime import datetime

from ..base_adapter import (
    DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult, 
    TableInfo, ColumnInfo, DatabaseInfo, ImportOptions, ExportOptions,
    ImportResult, ExportResult, QueryType
)

logger = logging.getLogger(__name__)

class MongoDBAdapter(DatabaseAdapter):
    """MongoDB database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._client = None
        self._database = None
    
    @property
    def database_type(self) -> DatabaseType:
        """Return MongoDB database type"""
        return DatabaseType.MONGODB
    
    @property
    def supports_transactions(self) -> bool:
        """MongoDB supports transactions (in replica sets)"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """MongoDB doesn't have traditional schemas"""
        return False
    
    def connect(self) -> bool:
        """Establish connection to MongoDB database"""
        try:
            from pymongo import MongoClient
            from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
            
            start_time = time.time()
            
            # Build connection URI
            if self.connection_params.username and self.connection_params.password:
                auth_string = f"{self.connection_params.username}:{self.connection_params.password}@"
            else:
                auth_string = ""
            
            # Handle auth database
            auth_db = self.connection_params.auth_database or self.connection_params.database or "admin"
            
            uri = f"mongodb://{auth_string}{self.connection_params.host}:{self.connection_params.port}/{auth_db}"
            
            # Add SSL parameters if specified
            connect_params = {
                'serverSelectionTimeoutMS': self.connection_params.timeout * 1000,
                'connectTimeoutMS': self.connection_params.timeout * 1000
            }
            
            if self.connection_params.ssl:
                connect_params['ssl'] = True
                if self.connection_params.ssl_cert:
                    connect_params['ssl_certfile'] = self.connection_params.ssl_cert
                if self.connection_params.ssl_key:
                    connect_params['ssl_keyfile'] = self.connection_params.ssl_key
                if self.connection_params.ssl_ca:
                    connect_params['ssl_ca_certs'] = self.connection_params.ssl_ca
            
            # Add additional parameters
            connect_params.update(self.connection_params.additional_params)
            
            self._client = MongoClient(uri, **connect_params)
            
            # Test connection
            self._client.admin.command('ping')
            
            # Set database
            if self.connection_params.database:
                self._database = self._client[self.connection_params.database]
            else:
                # Use first available database
                db_names = self._client.list_database_names()
                if db_names:
                    self._database = self._client[db_names[0]]
                else:
                    self._database = self._client['test']
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to MongoDB at {self.connection_params.host}:{self.connection_params.port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close MongoDB connection"""
        try:
            if self._client:
                self._client.close()
                self._client = None
                self._database = None
            
            self._connected = False
            logger.info("Disconnected from MongoDB")
            
        except Exception as e:
            logger.error(f"Error disconnecting from MongoDB: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test MongoDB connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with a simple command
            start_time = time.time()
            server_info = self._client.server_info()
            response_time = time.time() - start_time
            
            return {
                'success': True,
                'response_time': response_time,
                'version': server_info.get('version', 'unknown'),
                'database': self._database.name,
                'server_info': server_info
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get MongoDB database information"""
        try:
            # Get database stats
            stats = self._database.command('dbStats')
            
            # Get server info
            server_info = self._client.server_info()
            
            # Count collections
            collection_count = len(self._database.list_collection_names())
            
            return DatabaseInfo(
                name=self._database.name,
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=server_info.get('version', 'unknown'),
                size_bytes=stats.get('dataSize', 0),
                table_count=collection_count,
                metadata={
                    'collections': collection_count,
                    'objects': stats.get('objects', 0),
                    'avgObjSize': stats.get('avgObjSize', 0),
                    'indexes': stats.get('indexes', 0),
                    'indexSize': stats.get('indexSize', 0)
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting database info: {e}")
            return DatabaseInfo(
                name=self.connection_params.database or 'unknown',
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port
            )
    
    def list_tables(self, schema: Optional[str] = None) -> List[TableInfo]:
        """List all collections in MongoDB database"""
        try:
            collections = []
            
            for collection_name in self._database.list_collection_names():
                collection = self._database[collection_name]
                
                # Get collection stats
                try:
                    stats = self._database.command('collStats', collection_name)
                    row_count = stats.get('count', 0)
                    size_bytes = stats.get('size', 0)
                except:
                    # Fallback to count if collStats fails
                    row_count = collection.count_documents({})
                    size_bytes = 0
                
                collections.append(TableInfo(
                    name=collection_name,
                    schema=self._database.name,
                    row_count=row_count,
                    size_bytes=size_bytes
                ))
            
            return collections
            
        except Exception as e:
            logger.error(f"Error listing collections: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a MongoDB collection"""
        try:
            collection = self._database[table_name]
            
            # Get collection stats
            try:
                stats = self._database.command('collStats', table_name)
                row_count = stats.get('count', 0)
                size_bytes = stats.get('size', 0)
            except:
                row_count = collection.count_documents({})
                size_bytes = 0
            
            # Get indexes
            indexes = self.get_indexes(table_name)
            
            # Analyze schema from sample documents
            columns = self.get_table_schema(table_name)
            
            return TableInfo(
                name=table_name,
                schema=self._database.name,
                row_count=row_count,
                size_bytes=size_bytes,
                columns=columns,
                indexes=indexes,
                metadata={
                    'capped': stats.get('capped', False) if 'stats' in locals() else False,
                    'maxSize': stats.get('maxSize', 0) if 'stats' in locals() else 0
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all databases in MongoDB"""
        try:
            return self._client.list_database_names()
        except Exception as e:
            logger.error(f"Error listing databases: {e}")
            return [self._database.name] if self._database else []
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> QueryResult:
        """Execute a MongoDB query and return results"""
        try:
            start_time = time.time()
            
            # Parse MongoDB query (simplified JSON-based approach)
            query_dict = self._parse_mongodb_query(query)
            
            collection_name = query_dict.get('collection')
            operation = query_dict.get('operation', 'find')
            filter_doc = query_dict.get('filter', {})
            options = query_dict.get('options', {})
            
            if not collection_name:
                return QueryResult(
                    success=False,
                    errors=["Collection name is required"],
                    execution_time=time.time() - start_time
                )
            
            collection = self._database[collection_name]
            
            # Execute operation
            if operation == 'find':
                cursor = collection.find(filter_doc, **options)
                limit = options.get('limit', 1000)  # Default limit
                data = list(cursor.limit(limit))
                
                # Convert ObjectId to string for JSON serialization
                for doc in data:
                    self._convert_objectids_to_strings(doc)
                
                # Generate column info from first document
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
            
            elif operation == 'count':
                count = collection.count_documents(filter_doc)
                return QueryResult(
                    success=True,
                    data=[{'count': count}],
                    columns=[ColumnInfo(name='count', data_type='int')],
                    row_count=1,
                    execution_time=time.time() - start_time,
                    query_type=QueryType.AGGREGATE
                )
            
            elif operation == 'aggregate':
                pipeline = query_dict.get('pipeline', [])
                cursor = collection.aggregate(pipeline)
                data = list(cursor)
                
                # Convert ObjectId to string
                for doc in data:
                    self._convert_objectids_to_strings(doc)
                
                return QueryResult(
                    success=True,
                    data=data,
                    row_count=len(data),
                    execution_time=time.time() - start_time,
                    query_type=QueryType.AGGREGATE
                )
            
            else:
                return QueryResult(
                    success=False,
                    errors=[f"Unsupported operation: {operation}"],
                    execution_time=time.time() - start_time
                )
            
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return QueryResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time if 'start_time' in locals() else 0.0
            )
    
    def execute_non_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> int:
        """Execute a non-query MongoDB operation and return affected documents"""
        try:
            query_dict = self._parse_mongodb_query(query)
            
            collection_name = query_dict.get('collection')
            operation = query_dict.get('operation')
            
            if not collection_name:
                raise ValueError("Collection name is required")
            
            collection = self._database[collection_name]
            
            if operation == 'insert_one':
                document = query_dict.get('document', {})
                result = collection.insert_one(document)
                return 1 if result.inserted_id else 0
            
            elif operation == 'insert_many':
                documents = query_dict.get('documents', [])
                result = collection.insert_many(documents)
                return len(result.inserted_ids)
            
            elif operation == 'update_one':
                filter_doc = query_dict.get('filter', {})
                update_doc = query_dict.get('update', {})
                result = collection.update_one(filter_doc, update_doc)
                return result.modified_count
            
            elif operation == 'update_many':
                filter_doc = query_dict.get('filter', {})
                update_doc = query_dict.get('update', {})
                result = collection.update_many(filter_doc, update_doc)
                return result.modified_count
            
            elif operation == 'delete_one':
                filter_doc = query_dict.get('filter', {})
                result = collection.delete_one(filter_doc)
                return result.deleted_count
            
            elif operation == 'delete_many':
                filter_doc = query_dict.get('filter', {})
                result = collection.delete_many(filter_doc)
                return result.deleted_count
            
            else:
                raise ValueError(f"Unsupported operation: {operation}")
            
        except Exception as e:
            logger.error(f"Error executing non-query: {e}")
            raise e
    
    def get_sample_data(self, table_name: str, limit: int = 10, 
                       schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sample data from a MongoDB collection"""
        try:
            collection = self._database[table_name]
            cursor = collection.find().limit(limit)
            data = list(cursor)
            
            # Convert ObjectId to string
            for doc in data:
                self._convert_objectids_to_strings(doc)
            
            return data
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for a MongoDB collection by analyzing sample documents"""
        try:
            collection = self._database[table_name]
            
            # Get sample documents to analyze schema
            sample_docs = list(collection.find().limit(100))
            
            if not sample_docs:
                return []
            
            # Analyze field types across all sample documents
            field_analysis = {}
            
            for doc in sample_docs:
                for field, value in doc.items():
                    if field not in field_analysis:
                        field_analysis[field] = {
                            'types': set(),
                            'null_count': 0,
                            'total_count': 0
                        }
                    
                    field_analysis[field]['total_count'] += 1
                    
                    if value is None:
                        field_analysis[field]['null_count'] += 1
                    else:
                        field_analysis[field]['types'].add(type(value).__name__)
            
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
                    primary_key=field == '_id',
                    metadata={
                        'types': types,
                        'null_percentage': (analysis['null_count'] / analysis['total_count']) * 100,
                        'presence_percentage': ((analysis['total_count'] - analysis['null_count']) / len(sample_docs)) * 100
                    }
                ))
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting collection schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for a MongoDB collection"""
        try:
            collection = self._database[table_name]
            indexes = []
            
            for index_info in collection.list_indexes():
                indexes.append({
                    'name': index_info.get('name', 'unknown'),
                    'keys': index_info.get('key', {}),
                    'unique': index_info.get('unique', False),
                    'sparse': index_info.get('sparse', False),
                    'background': index_info.get('background', False),
                    'expireAfterSeconds': index_info.get('expireAfterSeconds'),
                    'partialFilterExpression': index_info.get('partialFilterExpression')
                })
            
            return indexes
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for a MongoDB collection"""
        # MongoDB doesn't have traditional constraints like SQL databases
        # We can return validation rules if they exist
        try:
            collection_info = self._database.command('listCollections', filter={'name': table_name})
            
            constraints = []
            for collection in collection_info.get('cursor', {}).get('firstBatch', []):
                options = collection.get('options', {})
                validator = options.get('validator')
                
                if validator:
                    constraints.append({
                        'name': 'document_validator',
                        'type': 'VALIDATION',
                        'definition': validator
                    })
            
            return constraints
            
        except Exception as e:
            logger.error(f"Error getting constraints: {e}")
            return []
    
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file to MongoDB"""
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
            elif file_format == 'bson':
                return self._import_bson(file_path, options, start_time)
            elif file_format == 'csv':
                return self._import_csv(file_path, options, start_time)
            elif file_format == 'archive':
                return self._import_mongodump(file_path, options, start_time)
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
        """Export data from MongoDB to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'bson':
                return self._export_bson(query, file_path, options, start_time)
            elif file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            elif file_format == 'archive':
                return self._export_mongodump(file_path, options, start_time)
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
    
    def _parse_mongodb_query(self, query: str) -> Dict[str, Any]:
        """Parse MongoDB query string (simplified JSON-based approach)"""
        try:
            # Try to parse as JSON
            if query.strip().startswith('{'):
                return json.loads(query)
            
            # Handle simple query formats
            # Example: "db.collection.find({filter})"
            if 'db.' in query and '.find(' in query:
                # Extract collection name
                parts = query.split('.')
                if len(parts) >= 3:
                    collection = parts[1]
                    
                    # Extract filter from find()
                    find_start = query.find('.find(')
                    if find_start != -1:
                        filter_start = find_start + 6
                        filter_end = query.rfind(')')
                        filter_str = query[filter_start:filter_end]
                        
                        try:
                            filter_doc = json.loads(filter_str) if filter_str.strip() else {}
                        except:
                            filter_doc = {}
                        
                        return {
                            'collection': collection,
                            'operation': 'find',
                            'filter': filter_doc
                        }
            
            # Default fallback
            return {
                'collection': query,
                'operation': 'find',
                'filter': {}
            }
            
        except Exception as e:
            logger.error(f"Error parsing MongoDB query: {e}")
            return {
                'collection': 'unknown',
                'operation': 'find',
                'filter': {}
            }
    
    def _convert_objectids_to_strings(self, doc: Dict[str, Any]):
        """Convert ObjectId instances to strings for JSON serialization"""
        try:
            from bson import ObjectId
            
            for key, value in doc.items():
                if isinstance(value, ObjectId):
                    doc[key] = str(value)
                elif isinstance(value, dict):
                    self._convert_objectids_to_strings(value)
                elif isinstance(value, list):
                    for item in value:
                        if isinstance(item, dict):
                            self._convert_objectids_to_strings(item)
                        elif isinstance(item, ObjectId):
                            # Handle ObjectId in list (would need to modify list in place)
                            pass
        except ImportError:
            # bson not available, skip conversion
            pass
    
    def _import_json(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import JSON file to MongoDB"""
        try:
            collection_name = options.table_name
            if not collection_name:
                return ImportResult(
                    success=False,
                    errors=["Collection name is required for JSON import"],
                    execution_time=time.time() - start_time
                )
            
            collection = self._database[collection_name]
            
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                data = json.load(jsonfile)
            
            if not isinstance(data, list):
                data = [data]
            
            rows_imported = 0
            errors = []
            
            # Clear collection if requested
            if options.truncate_table:
                collection.delete_many({})
            
            # Import data in batches
            for i in range(0, len(data), options.batch_size):
                batch = data[i:i + options.batch_size]
                
                try:
                    result = collection.insert_many(batch, ordered=False)
                    rows_imported += len(result.inserted_ids)
                    
                    if options.progress_callback:
                        options.progress_callback(i + len(batch), f"Imported {rows_imported} documents")
                        
                except Exception as e:
                    error_msg = f"Batch {i//options.batch_size + 1}: {str(e)}"
                    errors.append(error_msg)
                    
                    if not options.ignore_errors:
                        break
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_imported,
                rows_failed=len(data) - rows_imported,
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_bson(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import BSON file to MongoDB using mongorestore"""
        try:
            cmd = [
                'mongorestore',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--db', self.connection_params.database
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            if options.table_name:
                cmd.extend(['--collection', options.table_name])
            
            cmd.append(file_path)
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            return ImportResult(
                success=result.returncode == 0,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_csv(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import CSV file to MongoDB"""
        try:
            cmd = [
                'mongoimport',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--db', self.connection_params.database,
                '--collection', options.table_name or 'imported_data',
                '--type', 'csv',
                '--headerline',
                '--file', file_path
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            if options.truncate_table:
                cmd.append('--drop')
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            return ImportResult(
                success=result.returncode == 0,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_mongodump(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import MongoDB archive using mongorestore"""
        try:
            cmd = [
                'mongorestore',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--archive=' + file_path
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            return ImportResult(
                success=result.returncode == 0,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_json(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export MongoDB data to JSON file"""
        try:
            # Execute query to get data
            query_result = self.execute_query(query)
            
            if not query_result.success:
                return ExportResult(
                    success=False,
                    errors=query_result.errors,
                    execution_time=time.time() - start_time
                )
            
            # Write to JSON file
            with open(file_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(query_result.data, jsonfile, indent=2, default=str)
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                rows_exported=len(query_result.data),
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
    
    def _export_bson(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export MongoDB data to BSON file using mongodump"""
        try:
            # Extract collection name from query
            query_dict = self._parse_mongodb_query(query)
            collection_name = query_dict.get('collection', 'unknown')
            
            cmd = [
                'mongodump',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--db', self.connection_params.database,
                '--collection', collection_name,
                '--out', os.path.dirname(file_path)
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            
            return ExportResult(
                success=result.returncode == 0,
                file_size=file_size,
                file_path=file_path,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_csv(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export MongoDB data to CSV file using mongoexport"""
        try:
            # Extract collection name from query
            query_dict = self._parse_mongodb_query(query)
            collection_name = query_dict.get('collection', 'unknown')
            filter_doc = query_dict.get('filter', {})
            
            cmd = [
                'mongoexport',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--db', self.connection_params.database,
                '--collection', collection_name,
                '--type', 'csv',
                '--out', file_path
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            if filter_doc:
                cmd.extend(['--query', json.dumps(filter_doc)])
            
            # Add fields if specified
            if options.filters and 'fields' in options.filters:
                cmd.extend(['--fields', ','.join(options.filters['fields'])])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            
            return ExportResult(
                success=result.returncode == 0,
                file_size=file_size,
                file_path=file_path,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _export_mongodump(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export MongoDB database using mongodump archive"""
        try:
            cmd = [
                'mongodump',
                '--host', f"{self.connection_params.host}:{self.connection_params.port}",
                '--db', self.connection_params.database,
                '--archive=' + file_path
            ]
            
            if self.connection_params.username:
                cmd.extend(['--username', self.connection_params.username])
            if self.connection_params.password:
                cmd.extend(['--password', self.connection_params.password])
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
            
            return ExportResult(
                success=result.returncode == 0,
                file_size=file_size,
                file_path=file_path,
                errors=[result.stderr] if result.stderr else [],
                execution_time=time.time() - start_time,
                metadata={'stdout': result.stdout, 'returncode': result.returncode}
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )