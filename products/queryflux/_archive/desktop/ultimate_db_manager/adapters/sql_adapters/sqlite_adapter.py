"""
SQLite Database Adapter
Implements the unified DatabaseAdapter interface for SQLite
"""

import time
import csv
import json
import os
import sqlite3
import shutil
from typing import Dict, List, Optional, Any
import logging

from ..base_adapter import (
    DatabaseAdapter, DatabaseType, ConnectionParams, QueryResult, 
    TableInfo, ColumnInfo, DatabaseInfo, ImportOptions, ExportOptions,
    ImportResult, ExportResult, QueryType
)

logger = logging.getLogger(__name__)

class SQLiteAdapter(DatabaseAdapter):
    """SQLite database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._connection = None
        self._cursor = None
        self._db_path = connection_params.database or ':memory:'
    
    @property
    def database_type(self) -> DatabaseType:
        """Return SQLite database type"""
        return DatabaseType.SQLITE
    
    @property
    def supports_transactions(self) -> bool:
        """SQLite supports transactions"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """SQLite supports schemas (attached databases)"""
        return True
    
    def connect(self) -> bool:
        """Establish connection to SQLite database"""
        try:
            start_time = time.time()
            
            # Create directory if it doesn't exist (for file-based databases)
            if self._db_path != ':memory:' and not os.path.exists(os.path.dirname(self._db_path) or '.'):
                os.makedirs(os.path.dirname(self._db_path), exist_ok=True)
            
            # Build connection parameters
            conn_params = {
                'timeout': self.connection_params.timeout,
                'check_same_thread': False,  # Allow multi-threading
                'isolation_level': None  # Autocommit mode
            }
            
            # Add additional parameters
            conn_params.update(self.connection_params.additional_params)
            
            self._connection = sqlite3.connect(self._db_path, **conn_params)
            self._connection.row_factory = sqlite3.Row  # Enable column access by name
            self._cursor = self._connection.cursor()
            
            # Enable foreign key constraints
            self._cursor.execute("PRAGMA foreign_keys = ON")
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to SQLite database at {self._db_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to SQLite: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close SQLite connection"""
        try:
            if self._cursor:
                self._cursor.close()
                self._cursor = None
            
            if self._connection:
                self._connection.close()
                self._connection = None
            
            self._connected = False
            logger.info("Disconnected from SQLite")
            
        except Exception as e:
            logger.error(f"Error disconnecting from SQLite: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test SQLite connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with a simple query
            start_time = time.time()
            self._cursor.execute("SELECT sqlite_version()")
            result = self._cursor.fetchone()
            response_time = time.time() - start_time
            
            return {
                'success': True,
                'response_time': response_time,
                'version': result[0] if result else 'unknown',
                'database': self._db_path,
                'file_exists': os.path.exists(self._db_path) if self._db_path != ':memory:' else True
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get SQLite database information"""
        try:
            # Get SQLite version
            self._cursor.execute("SELECT sqlite_version()")
            version_result = self._cursor.fetchone()
            version = version_result[0] if version_result else 'unknown'
            
            # Get database size
            size_bytes = 0
            if self._db_path != ':memory:' and os.path.exists(self._db_path):
                size_bytes = os.path.getsize(self._db_path)
            
            # Get table count
            self._cursor.execute("""
                SELECT COUNT(*) 
                FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            table_count = self._cursor.fetchone()[0]
            
            # Get page count and page size for more detailed info
            self._cursor.execute("PRAGMA page_count")
            page_count = self._cursor.fetchone()[0]
            
            self._cursor.execute("PRAGMA page_size")
            page_size = self._cursor.fetchone()[0]
            
            return DatabaseInfo(
                name=os.path.basename(self._db_path) if self._db_path != ':memory:' else 'memory',
                db_type=self.database_type,
                host='localhost',
                port=0,  # SQLite doesn't use ports
                version=f"SQLite {version}",
                size_bytes=size_bytes,
                table_count=table_count,
                metadata={
                    'file_path': self._db_path,
                    'page_count': page_count,
                    'page_size': page_size,
                    'calculated_size': page_count * page_size
                }
            )
            
        except Exception as e:
            logger.error(f"Error getting database info: {e}")
            return DatabaseInfo(
                name=os.path.basename(self._db_path) if self._db_path != ':memory:' else 'memory',
                db_type=self.database_type,
                host='localhost',
                port=0
            )
    
    def list_tables(self, schema: Optional[str] = None) -> List[TableInfo]:
        """List all tables in SQLite database"""
        try:
            # Get table information
            self._cursor.execute("""
                SELECT 
                    name,
                    sql
                FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            """)
            
            tables = []
            for row in self._cursor.fetchall():
                table_name = row['name']
                
                # Get row count
                try:
                    self._cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                    row_count = self._cursor.fetchone()[0]
                except:
                    row_count = 0
                
                # Estimate size (SQLite doesn't provide direct table size)
                # We'll use a rough estimate based on row count and average row size
                size_bytes = 0
                if row_count > 0:
                    try:
                        # Get a sample row to estimate size
                        self._cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 1')
                        sample_row = self._cursor.fetchone()
                        if sample_row:
                            # Rough estimate: sum of string lengths + overhead
                            estimated_row_size = sum(len(str(val)) for val in sample_row) + 50
                            size_bytes = estimated_row_size * row_count
                    except:
                        pass
                
                tables.append(TableInfo(
                    name=table_name,
                    schema='main',  # SQLite default schema
                    row_count=row_count,
                    size_bytes=size_bytes,
                    metadata={'create_sql': row['sql']}
                ))
            
            return tables
            
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about a SQLite table"""
        try:
            # Get basic table info
            self._cursor.execute("""
                SELECT sql 
                FROM sqlite_master 
                WHERE type='table' AND name=?
            """, (table_name,))
            
            table_result = self._cursor.fetchone()
            if not table_result:
                raise ValueError(f"Table {table_name} not found")
            
            # Get row count
            self._cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            row_count = self._cursor.fetchone()[0]
            
            # Estimate size
            size_bytes = 0
            if row_count > 0:
                try:
                    self._cursor.execute(f'SELECT * FROM "{table_name}" LIMIT 1')
                    sample_row = self._cursor.fetchone()
                    if sample_row:
                        estimated_row_size = sum(len(str(val)) for val in sample_row) + 50
                        size_bytes = estimated_row_size * row_count
                except:
                    pass
            
            # Get columns
            columns = self.get_table_schema(table_name, schema)
            
            # Get indexes
            indexes = self.get_indexes(table_name, schema)
            
            # Get constraints (foreign keys)
            constraints = self.get_constraints(table_name, schema)
            
            return TableInfo(
                name=table_name,
                schema='main',
                row_count=row_count,
                size_bytes=size_bytes,
                columns=columns,
                indexes=indexes,
                constraints=constraints,
                metadata={'create_sql': table_result['sql']}
            )
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all schemas (attached databases) in SQLite"""
        try:
            self._cursor.execute("PRAGMA database_list")
            schemas = []
            
            for row in self._cursor.fetchall():
                schema_name = row['name']
                schemas.append(schema_name)
            
            return schemas
            
        except Exception as e:
            logger.error(f"Error listing schemas: {e}")
            return ['main']
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> QueryResult:
        """Execute a query and return results"""
        try:
            start_time = time.time()
            
            # Execute query
            if params:
                # Convert dict params to list for SQLite
                if isinstance(params, dict):
                    # For named parameters, SQLite expects :name format
                    named_params = {f":{k}" if not k.startswith(':') else k: v for k, v in params.items()}
                    self._cursor.execute(query, named_params)
                else:
                    self._cursor.execute(query, params)
            else:
                self._cursor.execute(query)
            
            execution_time = time.time() - start_time
            
            # Determine query type
            query_type = self._determine_query_type(query)
            
            # Get results for SELECT queries
            if query_type == QueryType.SELECT:
                rows = self._cursor.fetchall()
                data = [dict(row) for row in rows]
                columns = [ColumnInfo(name=desc[0], data_type='TEXT') 
                          for desc in self._cursor.description] if self._cursor.description else []
                row_count = len(data)
            else:
                data = []
                columns = []
                row_count = self._cursor.rowcount
                # Commit for non-SELECT queries
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
                if isinstance(params, dict):
                    named_params = {f":{k}" if not k.startswith(':') else k: v for k, v in params.items()}
                    self._cursor.execute(query, named_params)
                else:
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
        """Get sample data from a SQLite table"""
        try:
            query = f'SELECT * FROM "{table_name}" LIMIT ?'
            self._cursor.execute(query, (limit,))
            return [dict(row) for row in self._cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for a SQLite table"""
        try:
            self._cursor.execute(f'PRAGMA table_info("{table_name}")')
            
            columns = []
            for row in self._cursor.fetchall():
                columns.append(ColumnInfo(
                    name=row['name'],
                    data_type=row['type'],
                    nullable=not bool(row['notnull']),
                    primary_key=bool(row['pk']),
                    default_value=row['dflt_value'],
                    metadata={
                        'cid': row['cid'],  # Column ID
                        'pk_order': row['pk'] if row['pk'] > 0 else None
                    }
                ))
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting table schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for a SQLite table"""
        try:
            self._cursor.execute(f'PRAGMA index_list("{table_name}")')
            
            indexes = []
            for row in self._cursor.fetchall():
                index_name = row['name']
                
                # Get index columns
                self._cursor.execute(f'PRAGMA index_info("{index_name}")')
                index_columns = []
                for col_row in self._cursor.fetchall():
                    index_columns.append(col_row['name'])
                
                indexes.append({
                    'name': index_name,
                    'unique': bool(row['unique']),
                    'partial': bool(row['partial']),
                    'columns': index_columns,
                    'origin': row['origin']  # 'c' for CREATE INDEX, 'u' for UNIQUE, 'pk' for PRIMARY KEY
                })
            
            return indexes
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for a SQLite table"""
        try:
            constraints = []
            
            # Get foreign key constraints
            self._cursor.execute(f'PRAGMA foreign_key_list("{table_name}")')
            for row in self._cursor.fetchall():
                constraints.append({
                    'name': f"fk_{table_name}_{row['from']}",
                    'type': 'FOREIGN KEY',
                    'column': row['from'],
                    'foreign_table': row['table'],
                    'foreign_column': row['to'],
                    'on_update': row['on_update'],
                    'on_delete': row['on_delete'],
                    'match': row['match']
                })
            
            # Get check constraints (from table SQL)
            self._cursor.execute("""
                SELECT sql 
                FROM sqlite_master 
                WHERE type='table' AND name=?
            """, (table_name,))
            
            table_sql = self._cursor.fetchone()
            if table_sql and table_sql['sql']:
                sql = table_sql['sql']
                # Simple parsing for CHECK constraints
                if 'CHECK' in sql.upper():
                    constraints.append({
                        'name': f"check_{table_name}",
                        'type': 'CHECK',
                        'definition': 'See table CREATE statement'
                    })
            
            return constraints
            
        except Exception as e:
            logger.error(f"Error getting constraints: {e}")
            return []
    
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file to SQLite"""
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
            elif file_format == 'sqlite' or file_format == 'db':
                return self._import_sqlite_db(file_path, options, start_time)
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
        """Export data from SQLite to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            elif file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'sql':
                return self._export_sql(query, file_path, options, start_time)
            elif file_format == 'sqlite' or file_format == 'db':
                return self._export_sqlite_db(file_path, options, start_time)
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
        """Explain SQLite query execution plan"""
        try:
            explain_query = f"EXPLAIN QUERY PLAN {query}"
            self._cursor.execute(explain_query)
            result = self._cursor.fetchall()
            
            plan = [dict(row) for row in result]
            
            return {
                'supported': True,
                'plan': plan
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
        """Import CSV file to SQLite"""
        try:
            table_name = options.table_name
            
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
                    self._create_table_from_csv_headers(table_name, reader.fieldnames)
                
                # Truncate table if requested
                if options.truncate_table:
                    self._cursor.execute(f'DELETE FROM "{table_name}"')
                
                # Import data in batches
                batch = []
                for row_num, row in enumerate(reader, 1):
                    batch.append(row)
                    
                    if len(batch) >= options.batch_size:
                        imported, batch_errors = self._insert_csv_batch(table_name, batch)
                        rows_imported += imported
                        errors.extend(batch_errors)
                        batch = []
                        
                        if options.progress_callback:
                            options.progress_callback(row_num, f"Imported {rows_imported} rows")
                
                # Import remaining rows
                if batch:
                    imported, batch_errors = self._insert_csv_batch(table_name, batch)
                    rows_imported += imported
                    errors.extend(batch_errors)
                
                # Commit transaction
                self._connection.commit()
            
            return ImportResult(
                success=len(errors) == 0 or options.ignore_errors,
                rows_imported=rows_imported,
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
    
    def _import_json(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import JSON file to SQLite"""
        try:
            table_name = options.table_name
            
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
                self._create_table_from_json_sample(table_name, data[0])
            
            # Truncate table if requested
            if options.truncate_table:
                self._cursor.execute(f'DELETE FROM "{table_name}"')
            
            # Import data in batches
            for i in range(0, len(data), options.batch_size):
                batch = data[i:i + options.batch_size]
                imported, batch_errors = self._insert_json_batch(table_name, batch)
                rows_imported += imported
                errors.extend(batch_errors)
                
                if options.progress_callback:
                    options.progress_callback(i + len(batch), f"Imported {rows_imported} rows")
            
            # Commit transaction
            self._connection.commit()
            
            return ImportResult(
                success=len(errors) == 0 or options.ignore_errors,
                rows_imported=rows_imported,
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
    
    def _import_sql(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import SQL file to SQLite"""
        try:
            with open(file_path, 'r', encoding='utf-8') as sqlfile:
                sql_content = sqlfile.read()
            
            # Execute the entire SQL content (SQLite can handle multiple statements)
            try:
                self._cursor.executescript(sql_content)
                self._connection.commit()
                
                return ImportResult(
                    success=True,
                    rows_imported=self._cursor.rowcount if self._cursor.rowcount > 0 else 1,
                    execution_time=time.time() - start_time
                )
                
            except Exception as e:
                self._connection.rollback()
                return ImportResult(
                    success=False,
                    errors=[str(e)],
                    execution_time=time.time() - start_time
                )
            
        except Exception as e:
            return ImportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _import_sqlite_db(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import SQLite database file by attaching and copying tables"""
        try:
            # Attach the source database
            self._cursor.execute(f'ATTACH DATABASE ? AS source_db', (file_path,))
            
            # Get list of tables in source database
            self._cursor.execute("""
                SELECT name FROM source_db.sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            
            tables = [row[0] for row in self._cursor.fetchall()]
            rows_imported = 0
            errors = []
            
            for table_name in tables:
                try:
                    # Get table schema
                    self._cursor.execute(f"""
                        SELECT sql FROM source_db.sqlite_master 
                        WHERE type='table' AND name=?
                    """, (table_name,))
                    
                    create_sql = self._cursor.fetchone()
                    if create_sql:
                        # Create table in main database
                        self._cursor.execute(create_sql[0])
                        
                        # Copy data
                        self._cursor.execute(f"""
                            INSERT INTO main."{table_name}" 
                            SELECT * FROM source_db."{table_name}"
                        """)
                        
                        rows_imported += self._cursor.rowcount
                        
                except Exception as e:
                    error_msg = f"Table {table_name}: {str(e)}"
                    errors.append(error_msg)
                    
                    if not options.ignore_errors:
                        break
            
            # Detach source database
            self._cursor.execute('DETACH DATABASE source_db')
            self._connection.commit()
            
            return ImportResult(
                success=len(errors) == 0,
                rows_imported=rows_imported,
                rows_failed=len(errors),
                errors=errors,
                execution_time=time.time() - start_time
            )
            
        except Exception as e:
            try:
                self._cursor.execute('DETACH DATABASE source_db')
            except:
                pass
            self._connection.rollback()
            
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
                # Create empty CSV
                with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                    if options.include_headers and self._cursor.description:
                        writer = csv.writer(csvfile)
                        headers = [desc[0] for desc in self._cursor.description]
                        writer.writerow(headers)
                
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
                # Create empty file
                with open(file_path, 'w', encoding='utf-8') as sqlfile:
                    sqlfile.write("-- No data to export\n")
                
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
                        elif isinstance(value, (int, float)):
                            values.append(str(value))
                        else:
                            escaped_value = str(value).replace("'", "''")
                            values.append(f"'{escaped_value}'")
                    
                    column_names = '", "'.join(fieldnames)
                    insert_sql = f'INSERT INTO "{table_name}" ("{column_names}") VALUES ({", ".join(values)});\n'
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
    
    def _export_sqlite_db(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export entire SQLite database to another file"""
        try:
            if self._db_path == ':memory:':
                return ExportResult(
                    success=False,
                    errors=["Cannot export in-memory database"],
                    execution_time=time.time() - start_time
                )
            
            # Simple file copy for complete database export
            shutil.copy2(self._db_path, file_path)
            
            file_size = os.path.getsize(file_path)
            
            return ExportResult(
                success=True,
                file_size=file_size,
                file_path=file_path,
                execution_time=time.time() - start_time,
                metadata={'export_type': 'complete_database'}
            )
            
        except Exception as e:
            return ExportResult(
                success=False,
                errors=[str(e)],
                execution_time=time.time() - start_time
            )
    
    def _create_table_from_csv_headers(self, table_name: str, headers: List[str]):
        """Create table based on CSV headers"""
        columns = []
        for header in headers:
            # Clean header name
            clean_header = header.replace(' ', '_').replace('-', '_').replace('.', '_')
            columns.append(f'"{clean_header}" TEXT')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(columns)})'
        self._cursor.execute(create_sql)
    
    def _create_table_from_json_sample(self, table_name: str, sample: Dict[str, Any]):
        """Create table based on JSON sample"""
        columns = []
        for key, value in sample.items():
            clean_key = key.replace(' ', '_').replace('-', '_').replace('.', '_')
            
            if isinstance(value, bool):
                data_type = 'INTEGER'  # SQLite stores booleans as integers
            elif isinstance(value, int):
                data_type = 'INTEGER'
            elif isinstance(value, float):
                data_type = 'REAL'
            elif isinstance(value, dict) or isinstance(value, list):
                data_type = 'TEXT'  # Store as JSON string
            else:
                data_type = 'TEXT'
            
            columns.append(f'"{clean_key}" {data_type}')
        
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({", ".join(columns)})'
        self._cursor.execute(create_sql)
    
    def _insert_csv_batch(self, table_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
        """Insert batch of CSV rows"""
        if not batch:
            return 0, []
        
        errors = []
        imported = 0
        
        try:
            # Get column names
            columns = list(batch[0].keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            insert_sql = f'INSERT INTO "{table_name}" ({column_names}) VALUES ({placeholders})'
            
            for row in batch:
                try:
                    values = [row.get(col) for col in columns]
                    self._cursor.execute(insert_sql, values)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row error: {str(e)}")
                    
        except Exception as e:
            errors.append(f"Batch error: {str(e)}")
        
        return imported, errors
    
    def _insert_json_batch(self, table_name: str, batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
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
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            insert_sql = f'INSERT INTO "{table_name}" ({column_names}) VALUES ({placeholders})'
            
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
        query_upper = query.upper()
        if 'FROM' in query_upper:
            parts = query_upper.split('FROM')[1].split()
            if parts:
                return parts[0].strip().replace('"', '')
        return 'exported_data'