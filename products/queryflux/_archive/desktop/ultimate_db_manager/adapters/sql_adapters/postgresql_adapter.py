"""
PostgreSQL Database Adapter
Implements the unified DatabaseAdapter interface for PostgreSQL
"""

import time
import csv
import json
import os
import subprocess
import tempfile
from typing import Dict, List, Optional, Any
import logging

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    psycopg2 = None
    RealDictCursor = None
    PSYCOPG2_AVAILABLE = False

from ..base_adapter import (
    DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult, 
    TableInfo, ColumnInfo, DatabaseInfo, ImportOptions, ExportOptions,
    ImportResult, ExportResult, QueryType
)

logger = logging.getLogger(__name__)

class PostgreSQLAdapter(DatabaseAdapter):
    """PostgreSQL database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._connection = None
        self._cursor = None
    
    @property
    def database_type(self) -> DatabaseType:
        """Return PostgreSQL database type"""
        return DatabaseType.POSTGRESQL
    
    @property
    def supports_transactions(self) -> bool:
        """PostgreSQL supports transactions"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """PostgreSQL supports schemas"""
        return True
    
    def connect(self) -> bool:
        """Establish connection to PostgreSQL database"""
        if not PSYCOPG2_AVAILABLE:
            logger.error("psycopg2 is not available. Install with: pip install psycopg2-binary")
            return False
            
        try:
            
            start_time = time.time()
            
            # Build connection string
            conn_params = {
                'host': self.connection_params.host,
                'port': self.connection_params.port,
                'user': self.connection_params.username,
                'password': self.connection_params.password,
                'database': self.connection_params.database or 'postgres',
                'connect_timeout': self.connection_params.timeout
            }
            
            # Add SSL parameters if specified
            if self.connection_params.ssl:
                conn_params['sslmode'] = 'require'
                if self.connection_params.ssl_cert:
                    conn_params['sslcert'] = self.connection_params.ssl_cert
                if self.connection_params.ssl_key:
                    conn_params['sslkey'] = self.connection_params.ssl_key
                if self.connection_params.ssl_ca:
                    conn_params['sslrootcert'] = self.connection_params.ssl_ca
            
            # Add additional parameters
            conn_params.update(self.connection_params.additional_params)
            
            self._connection = psycopg2.connect(**conn_params)
            self._connection.autocommit = True
            self._cursor = self._connection.cursor(cursor_factory=RealDictCursor)
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to PostgreSQL at {self.connection_params.host}:{self.connection_params.port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close PostgreSQL connection"""
        try:
            if self._cursor:
                self._cursor.close()
                self._cursor = None
            
            if self._connection:
                self._connection.close()
                self._connection = None
            
            self._connected = False
            logger.info("Disconnected from PostgreSQL")
            
        except Exception as e:
            logger.error(f"Error disconnecting from PostgreSQL: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test PostgreSQL connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with a simple query
            start_time = time.time()
            self._cursor.execute("SELECT version(), current_database(), current_user")
            result = self._cursor.fetchone()
            response_time = time.time() - start_time
            
            return {
                'success': True,
                'response_time': response_time,
                'version': result['version'],
                'database': result['current_database'],
                'user': result['current_user']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get PostgreSQL database information"""
        try:
            # Get basic database info
            self._cursor.execute("""
                SELECT 
                    current_database() as name,
                    version() as version,
                    pg_database_size(current_database()) as size_bytes
            """)
            db_info = self._cursor.fetchone()
            
            # Get table count
            self._cursor.execute("""
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            """)
            table_count = self._cursor.fetchone()['table_count']
            
            # Get connection count
            self._cursor.execute("SELECT COUNT(*) as conn_count FROM pg_stat_activity")
            conn_count = self._cursor.fetchone()['conn_count']
            
            return DatabaseInfo(
                name=db_info['name'],
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=db_info['version'],
                size_bytes=db_info['size_bytes'],
                table_count=table_count,
                connection_count=conn_count
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
        """List all tables in PostgreSQL database"""
        try:
            schema_filter = schema or 'public'
            
            self._cursor.execute("""
                SELECT 
                    t.table_name,
                    t.table_schema,
                    COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count,
                    pg_total_relation_size(c.oid) as size_bytes
                FROM information_schema.tables t
                LEFT JOIN pg_class c ON c.relname = t.table_name
                LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
                WHERE t.table_type = 'BASE TABLE'
                AND t.table_schema = %s
                ORDER BY t.table_name
            """, (schema_filter,))
            
            tables = []
            for row in self._cursor.fetchall():
                tables.append(TableInfo(
                    name=row['table_name'],
                    schema=row['table_schema'],
                    row_count=row['row_count'],
                    size_bytes=row['size_bytes'] or 0
                ))
            
            return tables
            
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a PostgreSQL table"""
        try:
            schema_name = schema or 'public'
            
            # Get basic table info
            self._cursor.execute("""
                SELECT 
                    t.table_name,
                    t.table_schema,
                    COALESCE(s.n_tup_ins + s.n_tup_upd + s.n_tup_del, 0) as row_count,
                    pg_total_relation_size(c.oid) as size_bytes
                FROM information_schema.tables t
                LEFT JOIN pg_class c ON c.relname = t.table_name
                LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
                WHERE t.table_name = %s AND t.table_schema = %s
            """, (table_name, schema_name))
            
            table_info = self._cursor.fetchone()
            if not table_info:
                raise ValueError(f"Table {schema_name}.{table_name} not found")
            
            # Get columns
            columns = self.get_table_schema(table_name, schema)
            
            # Get indexes
            indexes = self.get_indexes(table_name, schema)
            
            # Get constraints
            constraints = self.get_constraints(table_name, schema)
            
            return TableInfo(
                name=table_info['table_name'],
                schema=table_info['table_schema'],
                row_count=table_info['row_count'],
                size_bytes=table_info['size_bytes'] or 0,
                columns=columns,
                indexes=indexes,
                constraints=constraints
            )
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all schemas in PostgreSQL database"""
        try:
            self._cursor.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
                ORDER BY schema_name
            """)
            
            return [row['schema_name'] for row in self._cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error listing schemas: {e}")
            return ['public']
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> QueryResult:
        """Execute a query and return results"""
        try:
            start_time = time.time()
            
            # Execute query
            if params:
                self._cursor.execute(query, params)
            else:
                self._cursor.execute(query)
            
            execution_time = time.time() - start_time
            
            # Determine query type
            query_type = self._determine_query_type(query)
            
            # Get results for SELECT queries
            if query_type == QueryType.SELECT:
                data = [dict(row) for row in self._cursor.fetchall()]
                columns = [ColumnInfo(name=desc[0], data_type=str(desc[1])) 
                          for desc in self._cursor.description] if self._cursor.description else []
                row_count = len(data)
            else:
                data = []
                columns = []
                row_count = self._cursor.rowcount
            
            return QueryResult(
                success=True,
                data=data,
                columns=columns,
                row_count=row_count,
                execution_time=execution_time,
                query_type=query_type
            )
            
        except Exception as e:
            logger.error(f"Error executing query: {e}")
            return QueryResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time if 'start_time' in locals() else 0.0
            )
    
    def execute_non_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> int:
        """Execute a non-query statement and return affected rows"""
        try:
            if params:
                self._cursor.execute(query, params)
            else:
                self._cursor.execute(query)
            
            return self._cursor.rowcount
            
        except Exception as e:
            logger.error(f"Error executing non-query: {e}")
            raise e
    
    def get_sample_data(self, table_name: str, limit: int = 10, 
                       schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sample data from a PostgreSQL table"""
        try:
            schema_name = schema or 'public'
            query = f'SELECT * FROM "{schema_name}"."{table_name}" LIMIT %s'
            
            self._cursor.execute(query, (limit,))
            return [dict(row) for row in self._cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for a PostgreSQL table"""
        try:
            schema_name = schema or 'public'
            
            self._cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale
                FROM information_schema.columns
                WHERE table_name = %s AND table_schema = %s
                ORDER BY ordinal_position
            """, (table_name, schema_name))
            
            columns = []
            for row in self._cursor.fetchall():
                columns.append(ColumnInfo(
                    name=row['column_name'],
                    data_type=row['data_type'],
                    nullable=row['is_nullable'] == 'YES',
                    default_value=row['column_default'],
                    max_length=row['character_maximum_length'],
                    precision=row['numeric_precision'],
                    scale=row['numeric_scale']
                ))
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting table schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for a PostgreSQL table"""
        try:
            schema_name = schema or 'public'
            
            self._cursor.execute("""
                SELECT 
                    i.indexname as index_name,
                    i.indexdef as definition,
                    ix.indisunique as is_unique,
                    ix.indisprimary as is_primary
                FROM pg_indexes i
                JOIN pg_class c ON c.relname = i.tablename
                JOIN pg_index ix ON ix.indexrelid = (
                    SELECT oid FROM pg_class WHERE relname = i.indexname
                )
                WHERE i.tablename = %s AND i.schemaname = %s
            """, (table_name, schema_name))
            
            indexes = []
            for row in self._cursor.fetchall():
                indexes.append({
                    'name': row['index_name'],
                    'definition': row['definition'],
                    'unique': row['is_unique'],
                    'primary': row['is_primary']
                })
            
            return indexes
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for a PostgreSQL table"""
        try:
            schema_name = schema or 'public'
            
            self._cursor.execute("""
                SELECT 
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    ccu.table_name as foreign_table_name,
                    ccu.column_name as foreign_column_name
                FROM information_schema.table_constraints tc
                LEFT JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                LEFT JOIN information_schema.constraint_column_usage ccu 
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.table_name = %s AND tc.table_schema = %s
            """, (table_name, schema_name))
            
            constraints = []
            for row in self._cursor.fetchall():
                constraints.append({
                    'name': row['constraint_name'],
                    'type': row['constraint_type'],
                    'column': row['column_name'],
                    'foreign_table': row['foreign_table_name'],
                    'foreign_column': row['foreign_column_name']
                })
            
            return constraints
            
        except Exception as e:
            logger.error(f"Error getting constraints: {e}")
            return []
    
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file to PostgreSQL"""
        start_time = time.time()
        
        try:
            if not os.path.exists(file_path):
                return ImportResult(
                    success=False,
                    errors=[f"File not found: {file_path}"]
                )
            
            file_format = options.file_format.lower()
            
            if file_format == 'csv':
                return self._import_csv(file_path, options, start_time)
            elif file_format == 'json':
                return self._import_json(file_path, options, start_time)
            elif file_format == 'sql':
                return self._import_sql(file_path, options, start_time)
            elif file_format in ['dump', 'custom', 'tar']:
                return self._import_pg_dump(file_path, options, start_time)
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
        """Export data from PostgreSQL to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            elif file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'sql':
                return self._export_sql(query, file_path, options, start_time)
            elif file_format in ['dump', 'custom', 'tar']:
                return self._export_pg_dump(file_path, options, start_time)
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
    
    def explain_query(self, query: str) -> Dict[str, Any]:
        """Explain PostgreSQL query execution plan"""
        try:
            explain_query = f"EXPLAIN (FORMAT JSON, ANALYZE, BUFFERS) {query}"
            self._cursor.execute(explain_query)
            result = self._cursor.fetchone()
            
            return {
                'supported': True,
                'plan': result if result else None
            }
            
        except Exception as e:
            return {
                'supported': False,
                'error': str(e)
            }
    
    def _determine_query_type(self, query: str) -> QueryType:
        """Determine the type of SQL query"""
        query_upper = query.strip().upper()
        
        if query_upper.startswith('SELECT'):
            return QueryType.SELECT
        elif query_upper.startswith('INSERT'):
            return QueryType.INSERT
        elif query_upper.startswith('UPDATE'):
            return QueryType.UPDATE
        elif query_upper.startswith('DELETE'):
            return QueryType.DELETE
        elif query_upper.startswith('CREATE'):
            return QueryType.CREATE
        elif query_upper.startswith('DROP'):
            return QueryType.DROP
        elif query_upper.startswith('ALTER'):
            return QueryType.ALTER
        else:
            return QueryType.CUSTOM
    
    def _import_csv(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import CSV file to PostgreSQL"""
        try:
            table_name = options.table_name
            schema_name = options.schema_name or 'public'
            
            if not table_name:
                return ImportResult(
                    success=False,
                    errors=["Table name is required for CSV import"],
                    execution_time=time.time() - start_time
                )
            
            rows_imported = 0
            errors = []
            
            with open(
                file_path, 'r', encoding='utf-8') as csvfile:
                # Detect delimiter
                sample = csvfile.read(1024)
                csvfile.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(csvfile, delimiter=delimiter)
                
                # Create table if requested
                if options.create_table and reader.fieldnames:
                    self._create_table_from_csv_headers(table_name, schema_name, reader.fieldnames)
                
                # Truncate table if requested
                if options.truncate_table:
                    self._cursor.execute(f'TRUNCATE TABLE "{schema_name}"."{table_name}"')
                
                # Import data in batches
                batch = []
                for row_num, row in enumerate(reader, 1):
                    batch.append(row)
                    
                    if len(batch) >= options.batch_size:
                        imported, batch_errors = self._insert_csv_batch(table_name, schema_name, batch)
                        rows_imported += imported
                        errors.extend(batch_errors)
                        batch = []
                        
                        if options.progress_callback:
                            options.progress_callback(row_num, f"Imported {rows_imported} rows")
                
                # Import remaining rows
                if batch:
                    imported, batch_errors = self._insert_csv_batch(table_name, schema_name, batch)
                    rows_imported += imported
                    errors.extend(batch_errors)
            
            return ImportResult(
                success=len(errors) == 0 or options.ignore_errors,
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
    
    def _import_json(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import JSON file to PostgreSQL"""
        try:
            table_name = options.table_name
            schema_name = options.schema_name or 'public'
            
            if not table_name:
                return ImportResult(
                    success=False,
                    errors=["Table name is required for JSON import"],
                    execution_time=time.time() - start_time
                )
            
            with open(file_path, 'r', encoding='utf-8') as jsonfile:
                data = json.load(jsonfile)
            
            if not isinstance(data, list):
                data = [data]
            
            rows_imported = 0
            errors = []
            
            # Create table if requested
            if options.create_table and data:
                self._create_table_from_json_sample(table_name, schema_name, data[0])
            
            # Truncate table if requested
            if options.truncate_table:
                self._cursor.execute(f'TRUNCATE TABLE "{schema_name}"."{table_name}"')
            
            # Import data in batches
            for i in range(0, len(data), options.batch_size):
                batch = data[i:i + options.batch_size]
                imported, batch_errors = self._insert_json_batch(table_name, schema_name, batch)
                rows_imported += imported
                errors.extend(batch_errors)
                
                if options.progress_callback:
                    options.progress_callback(i + len(batch), f"Imported {rows_imported} rows")
            
            return ImportResult(
                success=len(errors) == 0 or options.ignore_errors,
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
    
    def _import_sql(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import SQL file to PostgreSQL"""
        try:
            with open(file_path, 'r', encoding='utf-8') as sqlfile:
                sql_content = sqlfile.read()
            
            # Split SQL statements
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            
            rows_affected = 0
            errors = []
            
            for i, statement in enumerate(statements):
                try:
                    self._cursor.execute(statement)
                    rows_affected += self._cursor.rowcount
                    
                    if options.progress_callback:
                        options.progress_callback(i + 1, f"Executed {i + 1}/{len(statements)} statements")
                        
                except Exception as e:
                    error_msg = f"Statement {i + 1}: {str(e)}"
                    errors.append(error_msg)
                    
                    if not options.ignore_errors:
                        break
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_affected,
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
    
    def _import_pg_dump(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import PostgreSQL dump file"""
        try:
            # Use pg_restore for custom/tar formats, psql for plain SQL
            file_ext = os.path.splitext(file_path)[1].lower()
            
            if file_ext in ['.dump', '.custom', '.tar']:
                cmd = [
                    'pg_restore',
                    '--host', self.connection_params.host,
                    '--port', str(self.connection_params.port),
                    '--username', self.connection_params.username,
                    '--dbname', self.connection_params.database,
                    '--verbose'
                ]
                
                if options.ignore_errors:
                    cmd.append('--exit-on-error')
                
                cmd.append(file_path)
            else:
                cmd = [
                    'psql',
                    '--host', self.connection_params.host,
                    '--port', str(self.connection_params.port),
                    '--username', self.connection_params.username,
                    '--dbname', self.connection_params.database,
                    '--file', file_path
                ]
            
            # Set password via environment variable
            env = os.environ.copy()
            if self.connection_params.password:
                env['PGPASSWORD'] = self.connection_params.password
            
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            
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
    
    def _export_csv(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export query results to CSV file"""
        try:
            # Execute query
            self._cursor.execute(query)
            rows = self._cursor.fetchall()
            
            if not rows:
                return ExportResult(
                    success=True,
                    rows_exported=0,
                    file_path=file_path,
                    execution_time=time.time() - start_time
                )
            
            # Write to CSV
            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = [desc[0] for desc in self._cursor.description]
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                if options.include_headers:
                    writer.writeheader()
                
                rows_exported = 0
                for row in rows:
                    writer.writerow(dict(row))
                    rows_exported += 1
                    
                    if options.progress_callback and rows_exported % 1000 == 0:
                        options.progress_callback(rows_exported, f"Exported {rows_exported} rows")
            
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
    
    def _export_json(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export query results to JSON file"""
        try:
            # Execute query
            self._cursor.execute(query)
            rows = [dict(row) for row in self._cursor.fetchall()]
            
            # Write to JSON
            with open(file_path, 'w', encoding='utf-8') as jsonfile:
                json.dump(rows, jsonfile, indent=2, default=str)
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                rows_exported=len(rows),
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
    
    def _export_sql(self, query: str, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export query results as SQL INSERT statements"""
        try:
            # Execute query to get table structure
            self._cursor.execute(query)
            rows = self._cursor.fetchall()
            
            if not rows:
                return ExportResult(
                    success=True,
                    rows_exported=0,
                    file_path=file_path,
                    execution_time=time.time() - start_time
                )
            
            # Extract table name from query (simplified)
            table_name = self._extract_table_name_from_query(query)
            
            with open(file_path, 'w', encoding='utf-8') as sqlfile:
                fieldnames = [desc[0] for desc in self._cursor.description]
                
                rows_exported = 0
                for row in rows:
                    values = []
                    for value in row:
                        if value is None:
                            values.append('NULL')
                        elif isinstance(value, str):
                            escaped_value = value.replace("'", "''")
                            values.append(f"'{escaped_value}'")
                        else:
                            values.append(str(value))
                    
                    insert_sql = f"INSERT INTO {table_name} ({', '.join(fieldnames)}) VALUES ({', '.join(values)});\n"
                    sqlfile.write(insert_sql)
                    rows_exported += 1
                    
                    if options.progress_callback and rows_exported % 1000 == 0:
                        options.progress_callback(rows_exported, f"Exported {rows_exported} rows")
            
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
    
    def _export_pg_dump(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export database using pg_dump"""
        try:
            cmd = [
                'pg_dump',
                '--host', self.connection_params.host,
                '--port', str(self.connection_params.port),
                '--username', self.connection_params.username,
                '--dbname', self.connection_params.database,
                '--file', file_path
            ]
            
            # Add format option
            if options.file_format == 'custom':
                cmd.extend(['--format', 'custom'])
            elif options.file_format == 'tar':
                cmd.extend(['--format', 'tar'])
            
            # Set password via environment variable
            env = os.environ.copy()
            if self.connection_params.password:
                env['PGPASSWORD'] = self.connection_params.password
            
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            
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
    
    def _create_table_from_csv_headers(self, table_name: str, schema_name: str, headers: List[str]):
        """Create table based on CSV headers"""
        columns = []
        for header in headers:
            # Clean header name
            clean_header = header.replace(' ', '_').replace('-', '_')
            columns.append(f'"{clean_header}" TEXT')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}" ({", ".join(columns)})'
        self._cursor.execute(create_sql)
    
    def _create_table_from_json_sample(self, table_name: str, schema_name: str, sample: Dict[str, Any]):
        """Create table based on JSON sample"""
        columns = []
        for key, value in sample.items():
            clean_key = key.replace(' ', '_').replace('-', '_')
            
            if isinstance(value, bool):
                data_type = 'BOOLEAN'
            elif isinstance(value, int):
                data_type = 'INTEGER'
            elif isinstance(value, float):
                data_type = 'NUMERIC'
            elif isinstance(value, dict) or isinstance(value, list):
                data_type = 'JSONB'
            else:
                data_type = 'TEXT'
            
            columns.append(f'"{clean_key}" {data_type}')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS "{schema_name}"."{table_name}" ({", ".join(columns)})'
        self._cursor.execute(create_sql)
    
    def _insert_csv_batch(self, table_name: str, schema_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
        """Insert batch of CSV rows"""
        if not batch:
            return 0, []
        
        errors = []
        imported = 0
        
        try:
            # Get column names
            columns = list(batch[0].keys())
            placeholders = ', '.join(['%s'] * len(columns))
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            insert_sql = f'INSERT INTO "{schema_name}"."{table_name}" ({column_names}) VALUES ({placeholders})'
            
            for row in batch:
                try:
                    values = [row.get(col) for col in columns]
                    self._cursor.execute(insert_sql, values)
                    # For testing: if cursor.execute doesn't raise an exception, consider it successful
                    imported += 1
                except Exception as e:
                    errors.append(f"Row error: {str(e)}")
                    
        except Exception as e:
            errors.append(f"Batch error: {str(e)}")
        
        return imported, errors
    
    def _insert_json_batch(self, table_name: str, schema_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
        """Insert batch of JSON rows"""
        if not batch:
            return 0, []
        
        errors = []
        imported = 0
        
        try:
            # Get all possible columns from the batch
            all_columns = set()
            for row in batch:
                all_columns.update(row.keys())
            
            columns = list(all_columns)
            placeholders = ', '.join(['%s'] * len(columns))
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            insert_sql = f'INSERT INTO "{schema_name}"."{table_name}" ({column_names}) VALUES ({placeholders})'
            
            for row in batch:
                try:
                    values = []
                    for col in columns:
                        value = row.get(col)
                        if isinstance(value, (dict, list)):
                            value = json.dumps(value)
                        values.append(value)
                    
                    self._cursor.execute(insert_sql, values)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row error: {str(e)}")
                    
        except Exception as e:
            errors.append(f"Batch error: {str(e)}")
        
        return imported, errors
    
    def _extract_table_name_from_query(self, query: str) -> str:
        """Extract table name from SELECT query (simplified)"""
        # This is a simplified implementation
        # A more robust version would use SQL parsing
        query_upper = query.upper()
        if 'FROM' in query_upper:
            parts = query_upper.split('FROM')[1].split()
            if parts:
                return parts[0].strip()
        return 'exported_data'