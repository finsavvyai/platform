"""
Oracle Database Adapter
Implements the unified DatabaseAdapter interface for Oracle Database
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

class OracleAdapter(DatabaseAdapter):
    """Oracle database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        super().__init__(connection_params)
        self._connection = None
        self._cursor = None
    
    @property
    def database_type(self) -> DatabaseType:
        """Return Oracle database type"""
        return DatabaseType.ORACLE
    
    @property
    def supports_transactions(self) -> bool:
        """Oracle supports transactions"""
        return True
    
    @property
    def supports_schemas(self) -> bool:
        """Oracle supports schemas"""
        return True
    
    def connect(self) -> bool:
        """Establish connection to Oracle database"""
        try:
            import oracledb
            
            start_time = time.time()
            
            # Build connection parameters
            conn_params = {
                'host': self.connection_params.host,
                'port': self.connection_params.port,
                'user': self.connection_params.username,
                'password': self.connection_params.password,
                'service_name': self.connection_params.database,
                'encoding': 'UTF-8'
            }
            
            # Handle SID vs Service Name
            if self.connection_params.additional_params.get('use_sid', False):
                conn_params['sid'] = self.connection_params.database
                del conn_params['service_name']
            
            # Add SSL parameters if specified
            if self.connection_params.ssl:
                conn_params['ssl_context'] = True
                if self.connection_params.ssl_cert:
                    conn_params['ssl_cert'] = self.connection_params.ssl_cert
                if self.connection_params.ssl_key:
                    conn_params['ssl_key'] = self.connection_params.ssl_key
                if self.connection_params.ssl_ca:
                    conn_params['ssl_ca'] = self.connection_params.ssl_ca
            
            # Add additional parameters
            for key, value in self.connection_params.additional_params.items():
                if key not in ['use_sid'] and key not in conn_params:
                    conn_params[key] = value
            
            # Create connection string or use individual parameters
            if 'dsn' in self.connection_params.additional_params:
                dsn = self.connection_params.additional_params['dsn']
                self._connection = oracledb.connect(
                    user=self.connection_params.username,
                    password=self.connection_params.password,
                    dsn=dsn
                )
            else:
                # Build DSN
                if 'service_name' in conn_params:
                    dsn = f"{conn_params['host']}:{conn_params['port']}/{conn_params['service_name']}"
                else:
                    dsn = f"{conn_params['host']}:{conn_params['port']}:{conn_params['sid']}"
                
                self._connection = oracledb.connect(
                    user=conn_params['user'],
                    password=conn_params['password'],
                    dsn=dsn
                )
            
            self._cursor = self._connection.cursor()
            
            # Set session parameters
            self._cursor.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'YYYY-MM-DD HH24:MI:SS'")
            self._cursor.execute("ALTER SESSION SET NLS_TIMESTAMP_FORMAT = 'YYYY-MM-DD HH24:MI:SS.FF'")
            
            self._connected = True
            self._connection_time = time.time() - start_time
            
            logger.info(f"Connected to Oracle at {self.connection_params.host}:{self.connection_params.port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Oracle: {e}")
            self._connected = False
            return False
    
    def disconnect(self) -> None:
        """Close Oracle connection"""
        try:
            if self._cursor:
                self._cursor.close()
                self._cursor = None
            
            if self._connection:
                self._connection.close()
                self._connection = None
            
            self._connected = False
            logger.info("Disconnected from Oracle")
            
        except Exception as e:
            logger.error(f"Error disconnecting from Oracle: {e}")
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Oracle connection"""
        try:
            if not self._connected:
                success = self.connect()
                if not success:
                    return {'success': False, 'error': 'Failed to connect'}
            
            # Test with a simple query
            start_time = time.time()
            self._cursor.execute("""
                SELECT 
                    banner as version,
                    SYS_CONTEXT('USERENV', 'DB_NAME') as database_name,
                    USER as current_user
                FROM v$version 
                WHERE banner LIKE 'Oracle Database%'
                AND ROWNUM = 1
            """)
            result = self._cursor.fetchone()
            response_time = time.time() - start_time
            
            return {
                'success': True,
                'response_time': response_time,
                'version': result[0] if result else 'unknown',
                'database': result[1] if result else 'unknown',
                'user': result[2] if result else 'unknown'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get Oracle database information"""
        try:
            # Get basic database info
            self._cursor.execute("""
                SELECT 
                    SYS_CONTEXT('USERENV', 'DB_NAME') as db_name,
                    banner as version
                FROM v$version 
                WHERE banner LIKE 'Oracle Database%'
                AND ROWNUM = 1
            """)
            db_info = self._cursor.fetchone()
            
            # Get database size
            self._cursor.execute("""
                SELECT SUM(bytes) as total_size
                FROM dba_data_files
            """)
            size_info = self._cursor.fetchone()
            
            # Get table count for current user
            self._cursor.execute("""
                SELECT COUNT(*) as table_count 
                FROM user_tables
            """)
            table_count = self._cursor.fetchone()[0]
            
            # Get session count
            self._cursor.execute("""
                SELECT COUNT(*) as session_count 
                FROM v$session 
                WHERE status = 'ACTIVE'
            """)
            session_count = self._cursor.fetchone()[0]
            
            return DatabaseInfo(
                name=db_info[0] if db_info else 'unknown',
                db_type=self.database_type,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=db_info[1] if db_info else 'unknown',
                size_bytes=size_info[0] if size_info and size_info[0] else 0,
                table_count=table_count,
                connection_count=session_count
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
        """List all tables in Oracle database"""
        try:
            if schema:
                # List tables in specific schema
                self._cursor.execute("""
                    SELECT 
                        table_name,
                        owner as schema_name,
                        num_rows,
                        blocks * 8192 as size_bytes
                    FROM all_tables
                    WHERE owner = UPPER(:schema)
                    ORDER BY table_name
                """, {'schema': schema})
            else:
                # List tables in current user's schema
                self._cursor.execute("""
                    SELECT 
                        table_name,
                        USER as schema_name,
                        num_rows,
                        blocks * 8192 as size_bytes
                    FROM user_tables
                    ORDER BY table_name
                """)
            
            tables = []
            for row in self._cursor.fetchall():
                tables.append(TableInfo(
                    name=row[0],
                    schema=row[1],
                    row_count=row[2] if row[2] is not None else 0,
                    size_bytes=row[3] if row[3] is not None else 0
                ))
            
            return tables
            
        except Exception as e:
            logger.error(f"Error listing tables: {e}")
            return []
    
    def get_table_info(self, table_name: str, schema: Optional[str] = None) -> TableInfo:
        """Get detailed information about an Oracle table"""
        try:
            schema_name = schema or 'USER'
            
            if schema:
                # Get table info from specific schema
                self._cursor.execute("""
                    SELECT 
                        table_name,
                        owner as schema_name,
                        num_rows,
                        blocks * 8192 as size_bytes
                    FROM all_tables
                    WHERE table_name = UPPER(:table_name) AND owner = UPPER(:schema)
                """, {'table_name': table_name, 'schema': schema})
            else:
                # Get table info from current user's schema
                self._cursor.execute("""
                    SELECT 
                        table_name,
                        USER as schema_name,
                        num_rows,
                        blocks * 8192 as size_bytes
                    FROM user_tables
                    WHERE table_name = UPPER(:table_name)
                """, {'table_name': table_name})
            
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
                name=table_info[0],
                schema=table_info[1],
                row_count=table_info[2] if table_info[2] is not None else 0,
                size_bytes=table_info[3] if table_info[3] is not None else 0,
                columns=columns,
                indexes=indexes,
                constraints=constraints
            )
            
        except Exception as e:
            logger.error(f"Error getting table info: {e}")
            return TableInfo(name=table_name, schema=schema)
    
    def list_schemas(self) -> List[str]:
        """List all schemas in Oracle database"""
        try:
            self._cursor.execute("""
                SELECT username 
                FROM all_users 
                WHERE username NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'SYSMAN', 'OUTLN', 'MGMT_VIEW', 'DIP', 'ORACLE_OCM', 'APPQOSSYS', 'WMSYS', 'EXFSYS', 'CTXSYS', 'ANONYMOUS', 'XDB', 'XS$NULL', 'OJVMSYS', 'LBACSYS', 'FLOWS_FILES', 'APEX_030200', 'APEX_PUBLIC_USER', 'SPATIAL_CSW_ADMIN_USR', 'SPATIAL_WFS_ADMIN_USR', 'PUBLIC')
                ORDER BY username
            """)
            
            return [row[0] for row in self._cursor.fetchall()]
            
        except Exception as e:
            logger.error(f"Error listing schemas: {e}")
            return [self.connection_params.username or 'USER']
    
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
                rows = self._cursor.fetchall()
                data = []
                for row in rows:
                    # Convert Oracle-specific types to Python types
                    row_dict = {}
                    for i, value in enumerate(row):
                        column_name = self._cursor.description[i][0]
                        # Handle Oracle-specific data types
                        if hasattr(value, 'read'):  # CLOB/BLOB
                            row_dict[column_name] = value.read()
                        else:
                            row_dict[column_name] = value
                    data.append(row_dict)
                
                columns = [ColumnInfo(name=desc[0], data_type=self._oracle_type_to_string(desc[1])) 
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
        """Get sample data from an Oracle table"""
        try:
            if schema:
                query = f'SELECT * FROM "{schema}"."{table_name}" WHERE ROWNUM <= :limit'
            else:
                query = f'SELECT * FROM "{table_name}" WHERE ROWNUM <= :limit'
            
            self._cursor.execute(query, {'limit': limit})
            
            data = []
            for row in self._cursor.fetchall():
                row_dict = {}
                for i, value in enumerate(row):
                    column_name = self._cursor.description[i][0]
                    # Handle Oracle-specific data types
                    if hasattr(value, 'read'):  # CLOB/BLOB
                        row_dict[column_name] = value.read()
                    else:
                        row_dict[column_name] = value
                data.append(row_dict)
            
            return data
            
        except Exception as e:
            logger.error(f"Error getting sample data: {e}")
            return []
    
    def get_table_schema(self, table_name: str, schema: Optional[str] = None) -> List[ColumnInfo]:
        """Get schema information for an Oracle table"""
        try:
            if schema:
                self._cursor.execute("""
                    SELECT 
                        column_name,
                        data_type,
                        data_length,
                        data_precision,
                        data_scale,
                        nullable,
                        data_default,
                        column_id
                    FROM all_tab_columns
                    WHERE table_name = UPPER(:table_name) AND owner = UPPER(:schema)
                    ORDER BY column_id
                """, {'table_name': table_name, 'schema': schema})
            else:
                self._cursor.execute("""
                    SELECT 
                        column_name,
                        data_type,
                        data_length,
                        data_precision,
                        data_scale,
                        nullable,
                        data_default,
                        column_id
                    FROM user_tab_columns
                    WHERE table_name = UPPER(:table_name)
                    ORDER BY column_id
                """, {'table_name': table_name})
            
            columns = []
            for row in self._cursor.fetchall():
                # Build data type string
                data_type = row[1]
                if row[3] is not None and row[4] is not None:  # precision and scale
                    data_type = f"{data_type}({row[3]},{row[4]})"
                elif row[3] is not None:  # precision only
                    data_type = f"{data_type}({row[3]})"
                elif row[2] is not None and row[1] in ['VARCHAR2', 'CHAR', 'NVARCHAR2', 'NCHAR']:  # length for string types
                    data_type = f"{data_type}({row[2]})"
                
                columns.append(ColumnInfo(
                    name=row[0],
                    data_type=data_type,
                    nullable=row[5] == 'Y',
                    default_value=row[6],
                    max_length=row[2],
                    precision=row[3],
                    scale=row[4],
                    metadata={'column_id': row[7]}
                ))
            
            # Check for primary key
            if schema:
                self._cursor.execute("""
                    SELECT column_name
                    FROM all_cons_columns
                    WHERE constraint_name IN (
                        SELECT constraint_name
                        FROM all_constraints
                        WHERE table_name = UPPER(:table_name) 
                        AND owner = UPPER(:schema)
                        AND constraint_type = 'P'
                    )
                """, {'table_name': table_name, 'schema': schema})
            else:
                self._cursor.execute("""
                    SELECT column_name
                    FROM user_cons_columns
                    WHERE constraint_name IN (
                        SELECT constraint_name
                        FROM user_constraints
                        WHERE table_name = UPPER(:table_name) 
                        AND constraint_type = 'P'
                    )
                """, {'table_name': table_name})
            
            pk_columns = {row[0] for row in self._cursor.fetchall()}
            
            # Mark primary key columns
            for column in columns:
                if column.name in pk_columns:
                    column.primary_key = True
            
            return columns
            
        except Exception as e:
            logger.error(f"Error getting table schema: {e}")
            return []
    
    def get_indexes(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get index information for an Oracle table"""
        try:
            if schema:
                self._cursor.execute("""
                    SELECT 
                        i.index_name,
                        i.index_type,
                        i.uniqueness,
                        i.status,
                        LISTAGG(ic.column_name, ', ') WITHIN GROUP (ORDER BY ic.column_position) as columns
                    FROM all_indexes i
                    JOIN all_ind_columns ic ON i.index_name = ic.index_name AND i.owner = ic.index_owner
                    WHERE i.table_name = UPPER(:table_name) AND i.owner = UPPER(:schema)
                    GROUP BY i.index_name, i.index_type, i.uniqueness, i.status
                    ORDER BY i.index_name
                """, {'table_name': table_name, 'schema': schema})
            else:
                self._cursor.execute("""
                    SELECT 
                        i.index_name,
                        i.index_type,
                        i.uniqueness,
                        i.status,
                        LISTAGG(ic.column_name, ', ') WITHIN GROUP (ORDER BY ic.column_position) as columns
                    FROM user_indexes i
                    JOIN user_ind_columns ic ON i.index_name = ic.index_name
                    WHERE i.table_name = UPPER(:table_name)
                    GROUP BY i.index_name, i.index_type, i.uniqueness, i.status
                    ORDER BY i.index_name
                """, {'table_name': table_name})
            
            indexes = []
            for row in self._cursor.fetchall():
                indexes.append({
                    'name': row[0],
                    'type': row[1],
                    'unique': row[2] == 'UNIQUE',
                    'status': row[3],
                    'columns': row[4].split(', ') if row[4] else []
                })
            
            return indexes
            
        except Exception as e:
            logger.error(f"Error getting indexes: {e}")
            return []
    
    def get_constraints(self, table_name: str, schema: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get constraint information for an Oracle table"""
        try:
            if schema:
                self._cursor.execute("""
                    SELECT 
                        c.constraint_name,
                        c.constraint_type,
                        c.status,
                        c.r_constraint_name,
                        LISTAGG(cc.column_name, ', ') WITHIN GROUP (ORDER BY cc.position) as columns,
                        c.search_condition
                    FROM all_constraints c
                    LEFT JOIN all_cons_columns cc ON c.constraint_name = cc.constraint_name AND c.owner = cc.owner
                    WHERE c.table_name = UPPER(:table_name) AND c.owner = UPPER(:schema)
                    GROUP BY c.constraint_name, c.constraint_type, c.status, c.r_constraint_name, c.search_condition
                    ORDER BY c.constraint_name
                """, {'table_name': table_name, 'schema': schema})
            else:
                self._cursor.execute("""
                    SELECT 
                        c.constraint_name,
                        c.constraint_type,
                        c.status,
                        c.r_constraint_name,
                        LISTAGG(cc.column_name, ', ') WITHIN GROUP (ORDER BY cc.position) as columns,
                        c.search_condition
                    FROM user_constraints c
                    LEFT JOIN user_cons_columns cc ON c.constraint_name = cc.constraint_name
                    WHERE c.table_name = UPPER(:table_name)
                    GROUP BY c.constraint_name, c.constraint_type, c.status, c.r_constraint_name, c.search_condition
                    ORDER BY c.constraint_name
                """, {'table_name': table_name})
            
            constraints = []
            for row in self._cursor.fetchall():
                constraint_type_map = {
                    'P': 'PRIMARY KEY',
                    'U': 'UNIQUE',
                    'R': 'FOREIGN KEY',
                    'C': 'CHECK',
                    'V': 'VIEW CHECK',
                    'O': 'READ ONLY'
                }
                
                constraints.append({
                    'name': row[0],
                    'type': constraint_type_map.get(row[1], row[1]),
                    'status': row[2],
                    'columns': row[4].split(', ') if row[4] else [],
                    'referenced_constraint': row[3],
                    'search_condition': row[5]
                })
            
            return constraints
            
        except Exception as e:
            logger.error(f"Error getting constraints: {e}")
            return []
    
    def import_data(self, file_path: str, options: ImportOptions) -> ImportResult:
        """Import data from file to Oracle"""
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
            elif file_format in ['dmp', 'dump']:
                return self._import_oracle_dump(file_path, options, start_time)
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
        """Export data from Oracle to file"""
        start_time = time.time()
        
        try:
            file_format = options.file_format.lower()
            
            if file_format == 'csv':
                return self._export_csv(query, file_path, options, start_time)
            elif file_format == 'json':
                return self._export_json(query, file_path, options, start_time)
            elif file_format == 'sql':
                return self._export_sql(query, file_path, options, start_time)
            elif file_format in ['dmp', 'dump']:
                return self._export_oracle_dump(file_path, options, start_time)
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
        """Explain Oracle query execution plan"""
        try:
            # Create a unique statement ID
            statement_id = f"EXPLAIN_{int(time.time())}"
            
            # Delete any existing plan
            self._cursor.execute("DELETE FROM plan_table WHERE statement_id = :stmt_id", {'stmt_id': statement_id})
            
            # Explain the query
            explain_query = f"EXPLAIN PLAN SET STATEMENT_ID = '{statement_id}' FOR {query}"
            self._cursor.execute(explain_query)
            
            # Get the execution plan
            self._cursor.execute("""
                SELECT 
                    id,
                    parent_id,
                    LPAD(' ', 2 * level) || operation || ' ' || options as operation,
                    object_name,
                    cost,
                    cardinality,
                    bytes
                FROM plan_table
                WHERE statement_id = :stmt_id
                START WITH id = 0
                CONNECT BY PRIOR id = parent_id
                ORDER BY id
            """, {'stmt_id': statement_id})
            
            plan = []
            for row in self._cursor.fetchall():
                plan.append({
                    'id': row[0],
                    'parent_id': row[1],
                    'operation': row[2],
                    'object_name': row[3],
                    'cost': row[4],
                    'cardinality': row[5],
                    'bytes': row[6]
                })
            
            # Clean up
            self._cursor.execute("DELETE FROM plan_table WHERE statement_id = :stmt_id", {'stmt_id': statement_id})
            self._connection.commit()
            
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
    
    def _oracle_type_to_string(self, oracle_type) -> str:
        """Convert Oracle type code to string"""
        try:
            import oracledb
            
            type_map = {
                oracledb.DB_TYPE_VARCHAR: 'VARCHAR2',
                oracledb.DB_TYPE_CHAR: 'CHAR',
                oracledb.DB_TYPE_NUMBER: 'NUMBER',
                oracledb.DB_TYPE_DATE: 'DATE',
                oracledb.DB_TYPE_TIMESTAMP: 'TIMESTAMP',
                oracledb.DB_TYPE_CLOB: 'CLOB',
                oracledb.DB_TYPE_BLOB: 'BLOB',
                oracledb.DB_TYPE_RAW: 'RAW',
                oracledb.DB_TYPE_LONG: 'LONG',
                oracledb.DB_TYPE_LONG_RAW: 'LONG RAW'
            }
            
            return type_map.get(oracle_type, str(oracle_type))
            
        except:
            return str(oracle_type)
    
    def _import_csv(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import CSV file to Oracle"""
        try:
            table_name = options.table_name
            schema_name = options.schema_name
            
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
                    self._create_table_from_csv_headers(table_name, schema_name, reader.fieldnames)
                
                # Truncate table if requested
                if options.truncate_table:
                    if schema_name:
                        self._cursor.execute(f'TRUNCATE TABLE "{schema_name}"."{table_name}"')
                    else:
                        self._cursor.execute(f'TRUNCATE TABLE "{table_name}"')
                
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
        """Import JSON file to Oracle"""
        try:
            table_name = options.table_name
            schema_name = options.schema_name
            
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
                if schema_name:
                    self._cursor.execute(f'TRUNCATE TABLE "{schema_name}"."{table_name}"')
                else:
                    self._cursor.execute(f'TRUNCATE TABLE "{table_name}"')
            
            # Import data in batches
            for i in range(0, len(data), options.batch_size):
                batch = data[i:i + options.batch_size]
                imported, batch_errors = self._insert_json_batch(table_name, schema_name, batch)
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
        """Import SQL file to Oracle"""
        try:
            with open(file_path, 'r', encoding='utf-8') as sqlfile:
                sql_content = sqlfile.read()
            
            # Split SQL statements (Oracle uses ; as delimiter)
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
    
    def _import_oracle_dump(self, file_path: str, options: ImportOptions, start_time: float) -> ImportResult:
        """Import Oracle dump file using impdp"""
        try:
            # Build impdp command
            cmd = [
                'impdp',
                f"{self.connection_params.username}/{self.connection_params.password}@{self.connection_params.host}:{self.connection_params.port}/{self.connection_params.database}",
                f'dumpfile={os.path.basename(file_path)}',
                f'directory=DATA_PUMP_DIR'
            ]
            
            if options.schema_name:
                cmd.append(f'schemas={options.schema_name}')
            
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
                    # Convert row to dict, handling Oracle-specific types
                    row_dict = {}
                    for i, value in enumerate(row):
                        column_name = fieldnames[i]
                        if hasattr(value, 'read'):  # CLOB/BLOB
                            row_dict[column_name] = value.read()
                        else:
                            row_dict[column_name] = value
                    
                    writer.writerow(row_dict)
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
            rows = []
            
            for row in self._cursor.fetchall():
                row_dict = {}
                for i, value in enumerate(row):
                    column_name = self._cursor.description[i][0]
                    # Handle Oracle-specific data types
                    if hasattr(value, 'read'):  # CLOB/BLOB
                        row_dict[column_name] = value.read()
                    else:
                        row_dict[column_name] = value
                rows.append(row_dict)
            
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
                    for i, value in enumerate(row):
                        if value is None:
                            values.append('NULL')
                        elif hasattr(value, 'read'):  # CLOB/BLOB
                            content = value.read()
                            escaped_content = content.replace("'", "''")
                            values.append(f"'{escaped_content}'")
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
    
    def _export_oracle_dump(self, file_path: str, options: ExportOptions, start_time: float) -> ExportResult:
        """Export database using expdp"""
        try:
            # Build expdp command
            cmd = [
                'expdp',
                f"{self.connection_params.username}/{self.connection_params.password}@{self.connection_params.host}:{self.connection_params.port}/{self.connection_params.database}",
                f'dumpfile={os.path.basename(file_path)}',
                f'directory=DATA_PUMP_DIR'
            ]
            
            if options.filters and 'schemas' in options.filters:
                cmd.append(f'schemas={options.filters["schemas"]}')
            else:
                cmd.append(f'schemas={self.connection_params.username}')
            
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
    
    def _create_table_from_csv_headers(self, table_name: str, schema_name: Optional[str], headers: List[str]):
        """Create table based on CSV headers"""
        columns = []
        for header in headers:
            # Clean header name
            clean_header = header.replace(' ', '_').replace('-', '_').replace('.', '_')
            columns.append(f'"{clean_header}" VARCHAR2(4000)')
        
        if schema_name:
            create_sql = f'CREATE TABLE "{schema_name}"."{table_name}" ({", ".join(columns)})'
        else:
            create_sql = f'CREATE TABLE "{table_name}" ({", ".join(columns)})'
        
        self._cursor.execute(create_sql)
        self._connection.commit()
    
    def _create_table_from_json_sample(self, table_name: str, schema_name: Optional[str], sample: Dict[str, Any]):
        """Create table based on JSON sample"""
        columns = []
        for key, value in sample.items():
            clean_key = key.replace(' ', '_').replace('-', '_').replace('.', '_')
            
            if isinstance(value, bool):
                data_type = 'NUMBER(1)'  # Oracle boolean as number
            elif isinstance(value, int):
                data_type = 'NUMBER'
            elif isinstance(value, float):
                data_type = 'NUMBER'
            elif isinstance(value, dict) or isinstance(value, list):
                data_type = 'CLOB'  # Store as JSON string
            else:
                data_type = 'VARCHAR2(4000)'
            
            columns.append(f'"{clean_key}" {data_type}')
        
        if schema_name:
            create_sql = f'CREATE TABLE "{schema_name}"."{table_name}" ({", ".join(columns)})'
        else:
            create_sql = f'CREATE TABLE "{table_name}" ({", ".join(columns)})'
        
        self._cursor.execute(create_sql)
        self._connection.commit()
    
    def _insert_csv_batch(self, table_name: str, schema_name: Optional[str], batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
        """Insert batch of CSV rows"""
        if not batch:
            return 0, []
        
        errors = []
        imported = 0
        
        try:
            # Get column names
            columns = list(batch[0].keys())
            placeholders = ', '.join([':' + str(i+1) for i in range(len(columns))])
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            if schema_name:
                insert_sql = f'INSERT INTO "{schema_name}"."{table_name}" ({column_names}) VALUES ({placeholders})'
            else:
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
    
    def _insert_json_batch(self, table_name: str, schema_name: Optional[str], batch: List[Dict[str, Any]]) -> tuple[int, List[str]]:
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
            placeholders = ', '.join([':' + str(i+1) for i in range(len(columns))])
            column_names = ', '.join([f'"{col}"' for col in columns])
            
            if schema_name:
                insert_sql = f'INSERT INTO "{schema_name}"."{table_name}" ({column_names}) VALUES ({placeholders})'
            else:
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