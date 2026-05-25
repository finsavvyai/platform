"""
MySQL/MariaDB Database Adapter
Implements the unified DatabaseAdapter interface for MySQL and MariaDB
"""

import time
import csv
import json
import os
import subprocess
from typing import Dict, List, Optional, Any
import logging

from ..base_adapter import (
    DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult, 
    TableInfo, ColumnInfo, DatabaseInfo, ImportOptions, ExportOptions,
    ImportResult, ExportResult, QueryType
)

logger = logging.getLogger(__name__)

class MySQLAdapter(DatabaseAdapter):
    """MySQL/MariaDB database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._connection = None
        self._cursor = None
    
    @property
    def database_type(self) -> DatabaseType:
        """Return MySQL database type"""
        return DatabaseType.MYSQL
    
    @property
    def supports_transactions(self) -> bool:
        """MySQL supports transactions"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """MySQL uses databases instead of schemas"""
        return False
    
    def connect(self) -> bool:
        """Establish connection to MySQL database"""
        try:
            import pymysql
            
            start_time = time.time()
            
            # Build connection parameters
            conn_params = {
                'host': self.connection_params.host,
                'port': self.connection_params.port,
                'user': self.connection_params.username,
                'password': self.connection_params.password,
                'database': self.connection_params.database,
                'connect_timeout': self.connection_params.timeout,
                'charset': 'utf8mb4',
                'cursorclass': pymysql.cursors.DictCursor
            }
            
            # Add SSL parameters if specified
            if self.connection_params.ssl:
                ssl_params = {}
                if self.connection_params.ssl_cert:
                    ssl_params['cert'] = self.connection_params.ssl_cert
                if self.connection_params.ssl_key:
                    ssl_params['key'] = self.connection_params.ssl_key
                if self.connection_params.ssl_ca:
                    ssl_params['ca'] = self.connection_params.ssl_ca
                
                if ssl_params:
                    conn_params['ssl'] = ssl_params
                else:
                    conn_params['ssl'] = {}
            
            # Add additional parameters
            for key, value in self.connection_params.additional_params.items():
                if key not in conn_params:
                    conn_params[key] = value
            
            self._connection = pymysql.connect(**conn_params)
            self._cursor = self._connection.cursor()
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to MySQL at {self.connection_params.host}:{self.connection_params.port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MySQL: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close MySQL connection"""
        try:
            if self._cursor:
                self._cursor.close()
                self._cursor = None
            
            if self._connection:
                self._connection.close()
                self._connection = None
            
            self._connected = False
            logger.info("Disconnected from MySQL")
            
        except Exception as e:
            logger.error(f"Error disconnecting from MySQL: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test MySQL connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with a simple query
            start_time = time.time()
            self._cursor.execute("SELECT VERSION() as version, DATABASE() as database, USER() as user")
            result = self._cursor.fetchone()
            response_time = time.time() - start_time
            
            return {
                'success': True,
                'response_time': response_time,
                'version': result['version'],
                'database': result['database'],
                'user': result['user']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get MySQL database information"""
        try:
            # Get basic database info
            self._cursor.execute("""
                SELECT 
                    DATABASE() as name,
                    VERSION() as version
            """)
            db_info = self._cursor.fetchone()
            
            # Get database size
            self._cursor.execute("""
                SELECT 
                    SUM(data_length + index_length) as size_bytes
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            """)
            size_info = self._cursor.fetchone()
            
            # Get table count
            self._cursor.execute("""
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            """)
            table_count = self._cursor.fetchone()['table_count']
            
            # Get connection count
            self._cursor.execute("SHOW STATUS LIKE 'Threads_connected'")
            conn_result = self._cursor.fetchone()
            conn_count = int(conn_result['Value']) if conn_result else 0
            
            return DatabaseInfo(
                name=db_info['name'] or 'unknown',
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=db_info['version'],
                size_bytes=size_info['size_bytes'] or 0,
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
        """List all tables in MySQL database"""
        try:
            database_name = schema or self.connection_params.database
            
            self._cursor.execute("""
                SELECT 
                    t.table_name,
                    t.table_schema,
                    t.table_rows as row_count,
                    (t.data_length + t.index_length) as size_bytes
                FROM information_schema.tables t
                WHERE t.table_type = 'BASE TABLE'
                AND t.table_schema = %s
                ORDER BY t.table_name
            """, (database_name,))
            
            tables = []
            for row in self._cursor.fetchall():
                tables.append(TableInfo(
                    name=row['table_name'],
                    schema=row['table_schema'],
                    row_count=row['row_count'] or 0,
                    size_bytes=row['size_bytes'] or 0
                ))
            
            return tables
            
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a MySQL table"""
        try:
            database_name = schema or self.connection_params.database
            
            # Get basic table info
            self._cursor.execute("""
                SELECT 
                    t.table_name,
                    t.table_schema,
                    t.table_rows as row_count,
                    (t.data_length + t.index_length) as size_bytes
                FROM information_schema.tables t
                WHERE t.table_name = %s AND t.table_schema = %s
            """, (table_name, database_name))
            
            table_info = self._cursor.fetchone()
            if not table_info:
                raise ValueError(f"Table {database_name}.{table_name} not found")
            
            # Get columns
            columns = self.get_table_schema(table_name, schema)
            
            # Get indexes
            indexes = self.get_indexes(table_name, schema)
            
            # Get constraints
            constraints = self.get_constraints(table_name, schema)
            
            return TableInfo(
                name=table_info['table_name'],
                schema=table_info['table_schema'],
                row_count=table_info['row_count'] or 0,
                size_bytes=table_info['size_bytes'] or 0,
                columns=columns,
                indexes=indexes,
                constraints=constraints
            )
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all databases in MySQL (equivalent to schemas)"""
        try:
            self._cursor.execute("""
                SELECT schema_name 
                FROM information_schema.schemata 
                WHERE schema_name NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
                ORDER BY schema_name
            """)
            
            return [row['schema_name'] for row in self._cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error listing schemas: {e}")
            return [self.connection_params.database] if self.connection_params.database else []
    
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
                data = self._cursor.fetchall()
                columns = [ColumnInfo(name=desc[0], data_type=str(desc[1])) 
                          for desc in self._cursor.description] if self._cursor.description else []
                row_count = len(data)
            else:
                data = []
                columns = []
                row_count = self._cursor.rowcount
            
            # Commit for non-SELECT queries
            if query_type != QueryType.SELECT:
                self._connection.commit()
            
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
            # Rollback on error
            try:
                self._connection.rollback()
            except:
                pass
            
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
            
            self._connection.commit()
            return self._cursor.rowcount
            
        except Exception as e:
            self._connection.rollback()
            logger.error(f"Error executing non-query: {e}")
            raise e
    
    def get_sample_data(self, table_name: str, limit: int = 10, 
                       schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get sample data from a MySQL table"""
        try:
            database_name = schema or self.connection_params.database
            query = f'SELECT * FROM `{database_name}`.`{table_name}` LIMIT %s'
            
            self._cursor.execute(query, (limit,))
            return self._cursor.fetchall()
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for a MySQL table"""
        try:
            database_name = schema or self.connection_params.database
            
            self._cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length,
                    numeric_precision,
                    numeric_scale,
                    column_key,
                    extra
                FROM information_schema.columns
                WHERE table_name = %s AND table_schema = %s
                ORDER BY ordinal_position
            """, (table_name, database_name))
            
            columns = []
            for row in self._cursor.fetchall():
                columns.append(ColumnInfo(
                    name=row['column_name'],
                    data_type=row['data_type'],
                    nullable=row['is_nullable'] == 'YES',
                    primary_key=row['column_key'] == 'PRI',
                    default_value=row['column_default'],
                    max_length=row['character_maximum_length'],
                    precision=row['numeric_precision'],
                    scale=row['numeric_scale'],
                    metadata={
                        'key': row['column_key'],
                        'extra': row['extra']
                    }
                ))
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting table schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for a MySQL table"""
        try:
            database_name = schema or self.connection_params.database
            
            self._cursor.execute("""
                SELECT 
                    index_name,
                    column_name,
                    non_unique,
                    index_type,
                    seq_in_index
                FROM information_schema.statistics
                WHERE table_name = %s AND table_schema = %s
                ORDER BY index_name, seq_in_index
            """, (table_name, database_name))
            
            # Group by index name
            indexes_dict = {}
            for row in self._cursor.fetchall():
                index_name = row['index_name']
                if index_name not in indexes_dict:
                    indexes_dict[index_name] = {
                        'name': index_name,
                        'unique': row['non_unique'] == 0,
                        'primary': index_name == 'PRIMARY',
                        'type': row['index_type'],
                        'columns': []
                    }
                indexes_dict[index_name]['columns'].append(row['column_name'])
            
            return list(indexes_dict.values())
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for a MySQL table"""
        try:
            database_name = schema or self.connection_params.database
            
            self._cursor.execute("""
                SELECT 
                    tc.constraint_name,
                    tc.constraint_type,
                    kcu.column_name,
                    kcu.referenced_table_name as foreign_table_name,
                    kcu.referenced_column_name as foreign_column_name
                FROM information_schema.table_constraints tc
                LEFT JOIN information_schema.key_column_usage kcu 
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.table_name = %s AND tc.table_schema = %s
            """, (table_name, database_name))
            
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
        """Import data from file to MySQL"""
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
            elif file_format == 'dump':
                return self._import_mysql_dump(file_path, options, start_time)
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
        """Export data from MySQL to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            elif file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'sql':
                return self._export_sql(query, file_path, options, start_time)
            elif file_format == 'dump':
                return self._export_mysql_dump(file_path, options, start_time)
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
        """Explain MySQL query execution plan"""
        try:
            explain_query = f"EXPLAIN FORMAT=JSON {query}"
            self._cursor.execute(explain_query)
            result = self._cursor.fetchone()
            
            return {
                'supported': True,
                'plan': json.loads(result['EXPLAIN']) if result and 'EXPLAIN' in result else result
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
        """Import CSV file to MySQL"""
        try:
            table_name = options.table_name
            database_name = options.schema_name or self.connection_params.database
            
            if not table_name:
                return ImportResult(
                    success=False,
                    errors=["Table name is required for CSV import"],
                    execution_time=time.time() - start_time
                )
            
            rows_imported = 0
            errors = []
            
            with open(file_path, 'r', encoding='utf-8') as csvfile:
                # Detect delimiter
                sample = csvfile.read(1024)
                csvfile.seek(0)
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                
                reader = csv.DictReader(csvfile, delimiter=delimiter)
                
                # Create table if requested
                if options.create_table and reader.fieldnames:
                    self._create_table_from_csv_headers(table_name, database_name, reader.fieldnames)
                
                # Truncate table if requested
                if options.truncate_table:
                    self._cursor.execute(f'TRUNCATE TABLE `{database_name}`.`{table_name}`')
                
                # Import data in batches
                batch = []
                for row_num, row in enumerate(reader, 1):
                    batch.append(row)
                    
                    if len(batch) >= options.batch_size:
                        imported, batch_errors = self._insert_csv_batch(table_name, database_name, batch)
                        rows_imported += imported
                        errors.extend(batch_errors)
                        batch = []
                        
                        if options.progress_callback:
                            options.progress_callback(row_num, f"Imported {rows_imported} rows")
                
                # Import remaining rows
                if batch:
                    imported, batch_errors = self._insert_csv_batch(table_name, database_name, batch)
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
        """Import JSON file to MySQL"""
        try:
            table_name = options.table_name
            database_name = options.schema_name or self.connection_params.database
            
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
                self._create_table_from_json_sample(table_name, database_name, data[0])
            
            # Truncate table if requested
            if options.truncate_table:
                self._cursor.execute(f'TRUNCATE TABLE `{database_name}`.`{table_name}`')
            
            # Import data in batches
            for i in range(0, len(data), options.batch_size):
                batch = data[i:i + options.batch_size]
                imported, batch_errors = self._insert_json_batch(table_name, database_name, batch)
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
        """Import SQL file to MySQL"""
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
            
            # Commit all changes
            self._connection.commit()
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_affected,
                rows_failed=len(errors),
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            self._connection.rollback()
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_mysql_dump(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import MySQL dump file"""
        try:
            cmd = [
                'mysql',
                '--host', self.connection_params.host,
                '--port', str(self.connection_params.port),
                '--user', self.connection_params.username,
                '--database', self.connection_params.database
            ]
            
            if self.connection_params.password:
                cmd.append(f'--password={self.connection_params.password}')
            
            # Read and execute the dump file
            with open(file_path, 'r') as dump_file:
                result = subprocess.run(cmd, stdin=dump_file, capture_output=True, text=True)
            
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
                    writer.writerow(row)
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
            rows = self._cursor.fetchall()
            
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
                    for key in fieldnames:
                        value = row[key]
                        if value is None:
                            values.append('NULL')
                        elif isinstance(value, str):
                            escaped_value = value.replace("'", "''")
                            values.append(f"'{escaped_value}'")
                        else:
                            values.append(str(value))
                    
                    insert_sql = f"INSERT INTO `{table_name}` (`{'`, `'.join(fieldnames)}`) VALUES ({', '.join(values)});\n"
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
    
    def _export_mysql_dump(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export database using mysqldump"""
        try:
            cmd = [
                'mysqldump',
                '--host', self.connection_params.host,
                '--port', str(self.connection_params.port),
                '--user', self.connection_params.username,
                '--databases', self.connection_params.database,
                '--result-file', file_path
            ]
            
            if self.connection_params.password:
                cmd.append(f'--password={self.connection_params.password}')
            
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
    
    def _create_table_from_csv_headers(self, table_name: str, database_name: str, headers: List[str]):
        """Create table based on CSV headers"""
        columns = []
        for header in headers:
            # Clean header name
            clean_header = header.replace(' ', '_').replace('-', '_')
            columns.append(f'`{clean_header}` TEXT')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS `{database_name}`.`{table_name}` ({", ".join(columns)})'
        self._cursor.execute(create_sql)
        self._connection.commit()
    
    def _create_table_from_json_sample(self, table_name: str, database_name: str, sample: Dict[str, Any]):
        """Create table based on JSON sample"""
        columns = []
        for key, value in sample.items():
            clean_key = key.replace(' ', '_').replace('-', '_')
            
            if isinstance(value, bool):
                data_type = 'BOOLEAN'
            elif isinstance(value, int):
                data_type = 'INT'
            elif isinstance(value, float):
                data_type = 'DECIMAL(10,2)'
            elif isinstance(value, dict) or isinstance(value, list):
                data_type = 'JSON'
            else:
                data_type = 'TEXT'
            
            columns.append(f'`{clean_key}` {data_type}')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS `{database_name}`.`{table_name}` ({", ".join(columns)})'
        self._cursor.execute(create_sql)
        self._connection.commit()
    
    def _insert_csv_batch(self, table_name: str, database_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
        """Insert batch of CSV rows"""
        if not batch:
            return 0, []
        
        errors = []
        imported = 0
        
        try:
            # Get column names
            columns = list(batch[0].keys())
            placeholders = ', '.join(['%s'] * len(columns))
            column_names = ', '.join([f'`{col}`' for col in columns])
            
            insert_sql = f'INSERT INTO `{database_name}`.`{table_name}` ({column_names}) VALUES ({placeholders})'
            
            for row in batch:
                try:
                    values = [row.get(col) for col in columns]
                    self._cursor.execute(insert_sql, values)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row error: {str(e)}")
            
            self._connection.commit()
                    
        except Exception as e:
            self._connection.rollback()
            errors.append(f"Batch error: {str(e)}")
        
        return imported, errors
    
    def _insert_json_batch(self, table_name: str, database_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
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
            column_names = ', '.join([f'`{col}`' for col in columns])
            
            insert_sql = f'INSERT INTO `{database_name}`.`{table_name}` ({column_names}) VALUES ({placeholders})'
            
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
            
            self._connection.commit()
                    
        except Exception as e:
            self._connection.rollback()
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
                return parts[0].strip().replace('`', '')
        return 'exported_data'