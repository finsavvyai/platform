"""
Oracle Database Adapter
Provides Oracle-specific implementation for the universal database interface
"""

import time
from typing import Dict, List, Optional, Any
from .base_adapter import (
    BaseNoSQLAdapter, DatabaseType, QueryType,
    DatabaseInfo, CollectionInfo, QueryResult, ConnectionParams
)

try:
    import cx_Oracle
    ORACLE_AVAILABLE = True
except ImportError:
    ORACLE_AVAILABLE = False

class OracleAdapter(BaseNoSQLAdapter):
    """Oracle database adapter"""
    
    def __init__(self, connection_params: ConnectionParams):
        if not ORACLE_AVAILABLE:
            raise ImportError("cx_Oracle is required for Oracle support. Install with: pip install cx_Oracle")
        
        super().__init__(connection_params)
        self.service_name = connection_params.additional_params.get('service_name')
        self.sid = connection_params.additional_params.get('sid')
        self.tns_name = connection_params.additional_params.get('tns_name')
    
    @property
    def database_type(self) -> DatabaseType:
        return DatabaseType.ORACLE
    
    def connect(self) -> bool:
        """Establish connection to Oracle database"""
        try:
            # Build connection string
            if self.tns_name:
                # Use TNS name
                dsn = self.tns_name
            elif self.service_name:
                # Use service name
                dsn = cx_Oracle.makedsn(
                    self.connection_params.host,
                    self.connection_params.port,
                    service_name=self.service_name
                )
            elif self.sid:
                # Use SID
                dsn = cx_Oracle.makedsn(
                    self.connection_params.host,
                    self.connection_params.port,
                    sid=self.sid
                )
            else:
                # Default to host:port
                dsn = f"{self.connection_params.host}:{self.connection_params.port}"
            
            # Create connection
            self.client = cx_Oracle.connect(
                user=self.connection_params.username,
                password=self.connection_params.password,
                dsn=dsn,
                encoding="UTF-8"
            )
            
            # Set autocommit
            self.client.autocommit = True
            
            self._connected = True
            self._connection_time = time.time()
            return True
            
        except Exception as e:
            self._connected = False
            raise Exception(self.format_error(e))
    
    def disconnect(self):
        """Close Oracle connection"""
        if self.client:
            self.client.close()
            self.client = None
            self._connected = False
    
    def test_connection(self) -> Dict[str, Any]:
        """Test Oracle connection"""
        try:
            if not self._connected:
                self.connect()
            
            # Get Oracle version
            with self.client.cursor() as cursor:
                cursor.execute("SELECT * FROM v$version WHERE rownum = 1")
                version_info = cursor.fetchone()
                version = version_info[0] if version_info else "Unknown"
            
            return {
                'success': True,
                'version': version,
                'connection_time': time.time() - self._connection_time if self._connection_time else 0,
                'dsn': self.client.dsn
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': self.format_error(e)
            }
    
    def get_database_info(self) -> DatabaseInfo:
        """Get Oracle database information"""
        if not self._connected:
            raise Exception("Not connected to database")
        
        try:
            with self.client.cursor() as cursor:
                # Get database info
                cursor.execute("""
                    SELECT 
                        instance_name,
                        version,
                        status,
                        database_status,
                        host_name
                    FROM v$instance, v$database
                """)
                
                db_info = cursor.fetchone()
                
                # Get tablespace info
                cursor.execute("""
                    SELECT 
                        COUNT(*) as table_count
                    FROM user_tables
                """)
                table_count = cursor.fetchone()[0]
                
                # Get size info
                cursor.execute("""
                    SELECT 
                        SUM(bytes) as total_size
                    FROM user_segments
                """)
                size_result = cursor.fetchone()
                total_size = size_result[0] if size_result[0] else 0
            
            return DatabaseInfo(
                name=db_info[0] if db_info else "Oracle",
                db_type=DatabaseType.ORACLE,
                host=self.connection_params.host,
                port=self.connection_params.port,
                version=db_info[1] if db_info else None,
                size_bytes=total_size,
                collections_count=table_count,
                documents_count=0,  # Will be calculated per table
                metadata={
                    'instance_name': db_info[0] if db_info else None,
                    'status': db_info[2] if db_info else None,
                    'database_status': db_info[3] if db_info else None,
                    'host_name': db_info[4] if db_info else None
                }
            )
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def list_collections(self) -> List[CollectionInfo]:
        """List all tables in the Oracle database"""
        try:
            collections = []
            
            with self.client.cursor() as cursor:
                # Get all user tables with statistics
                cursor.execute("""
                    SELECT 
                        t.table_name,
                        NVL(t.num_rows, 0) as row_count,
                        NVL(s.bytes, 0) as size_bytes,
                        t.last_analyzed
                    FROM user_tables t
                    LEFT JOIN (
                        SELECT segment_name, SUM(bytes) as bytes
                        FROM user_segments
                        WHERE segment_type = 'TABLE'
                        GROUP BY segment_name
                    ) s ON t.table_name = s.segment_name
                    ORDER BY t.table_name
                """)
                
                for row in cursor.fetchall():
                    table_name, row_count, size_bytes, last_analyzed = row
                    
                    # Get column info
                    cursor.execute("""
                        SELECT column_name, data_type, nullable
                        FROM user_tab_columns
                        WHERE table_name = :table_name
                        ORDER BY column_id
                    """, table_name=table_name)
                    
                    columns = [
                        {
                            'column_name': col[0],
                            'data_type': col[1],
                            'nullable': col[2] == 'Y'
                        }
                        for col in cursor.fetchall()
                    ]
                    
                    # Get indexes
                    cursor.execute("""
                        SELECT 
                            index_name,
                            uniqueness,
                            status
                        FROM user_indexes
                        WHERE table_name = :table_name
                    """, table_name=table_name)
                    
                    indexes = [
                        {
                            'name': idx[0],
                            'unique': idx[1] == 'UNIQUE',
                            'status': idx[2]
                        }
                        for idx in cursor.fetchall()
                    ]
                    
                    collections.append(CollectionInfo(
                        name=table_name,
                        document_count=row_count or 0,
                        size_bytes=size_bytes or 0,
                        indexes=indexes,
                        schema_sample={'columns': columns},
                        metadata={
                            'last_analyzed': str(last_analyzed) if last_analyzed else None,
                            'column_count': len(columns)
                        }
                    ))
            
            return collections
            
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_collection_info(self, collection_name: str) -> CollectionInfo:
        """Get detailed information about an Oracle table"""
        try:
            with self.client.cursor() as cursor:
                # Get table statistics
                cursor.execute("""
                    SELECT 
                        num_rows,
                        blocks,
                        avg_row_len,
                        last_analyzed
                    FROM user_tables
                    WHERE table_name = :table_name
                """, table_name=collection_name.upper())
                
                table_stats = cursor.fetchone()
                
                if not table_stats:
                    raise Exception(f"Table {collection_name} not found")
                
                # Get size information
                cursor.execute("""
                    SELECT SUM(bytes) as total_size
                    FROM user_segments
                    WHERE segment_name = :table_name
                    AND segment_type = 'TABLE'
                """, table_name=collection_name.upper())
                
                size_info = cursor.fetchone()
                total_size = size_info[0] if size_info and size_info[0] else 0
                
                # Get detailed column information
                cursor.execute("""
                    SELECT 
                        column_name,
                        data_type,
                        data_length,
                        data_precision,
                        data_scale,
                        nullable,
                        column_id
                    FROM user_tab_columns
                    WHERE table_name = :table_name
                    ORDER BY column_id
                """, table_name=collection_name.upper())
                
                columns = []
                for col in cursor.fetchall():
                    columns.append({
                        'column_name': col[0],
                        'data_type': col[1],
                        'data_length': col[2],
                        'data_precision': col[3],
                        'data_scale': col[4],
                        'nullable': col[5] == 'Y',
                        'column_id': col[6]
                    })
                
                # Get constraints
                cursor.execute("""
                    SELECT 
                        constraint_name,
                        constraint_type,
                        status
                    FROM user_constraints
                    WHERE table_name = :table_name
                """, table_name=collection_name.upper())
                
                constraints = [
                    {
                        'name': con[0],
                        'type': con[1],
                        'status': con[2]
                    }
                    for con in cursor.fetchall()
                ]
                
                # Get indexes
                cursor.execute("""
                    SELECT 
                        i.index_name,
                        i.uniqueness,
                        i.status,
                        LISTAGG(ic.column_name, ', ') WITHIN GROUP (ORDER BY ic.column_position) as columns
                    FROM user_indexes i
                    JOIN user_ind_columns ic ON i.index_name = ic.index_name
                    WHERE i.table_name = :table_name
                    GROUP BY i.index_name, i.uniqueness, i.status
                """, table_name=collection_name.upper())
                
                indexes = [
                    {
                        'name': idx[0],
                        'unique': idx[1] == 'UNIQUE',
                        'status': idx[2],
                        'columns': idx[3].split(', ') if idx[3] else []
                    }
                    for idx in cursor.fetchall()
                ]
                
                return CollectionInfo(
                    name=collection_name,
                    document_count=table_stats[0] or 0,
                    size_bytes=total_size,
                    indexes=indexes,
                    schema_sample={'columns': columns},
                    metadata={
                        'blocks': table_stats[1],
                        'avg_row_len': table_stats[2],
                        'last_analyzed': str(table_stats[3]) if table_stats[3] else None,
                        'constraints': constraints
                    }
                )
                
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def execute_query(self, query: Any, collection: Optional[str] = None, 
                     limit: int = 100) -> QueryResult:
        """Execute Oracle SQL query"""
        if not self._connected:
            raise Exception("Not connected to database")
        
        start_time = time.time()
        
        try:
            if not isinstance(query, str):
                raise ValueError("Query must be a SQL string")
            
            # Add ROWNUM limit for SELECT queries if not present
            query_upper = query.upper().strip()
            if (query_upper.startswith('SELECT') and 
                'ROWNUM' not in query_upper and 
                'LIMIT' not in query_upper):
                
                # Wrap in subquery with ROWNUM
                query = f"SELECT * FROM ({query}) WHERE ROWNUM <= {limit}"
            
            with self.client.cursor() as cursor:
                # Execute query
                cursor.execute(query)
                
                # Determine query type
                if query_upper.startswith('SELECT') or query_upper.startswith('WITH'):
                    query_type = QueryType.FIND
                    
                    # Fetch results
                    columns = [desc[0] for desc in cursor.description] if cursor.description else []
                    rows = cursor.fetchall()
                    
                    # Convert to list of dictionaries
                    data = []
                    for row in rows:
                        row_dict = {}
                        for i, value in enumerate(row):
                            col_name = columns[i] if i < len(columns) else f'col_{i}'
                            # Handle Oracle-specific types
                            if hasattr(value, 'read'):  # CLOB/BLOB
                                value = value.read()
                            elif hasattr(value, 'strftime'):  # DATE/TIMESTAMP
                                value = value.isoformat()
                            row_dict[col_name] = value
                        data.append(row_dict)
                    
                    total_count = len(data)
                    
                elif any(query_upper.startswith(cmd) for cmd in ['INSERT', 'UPDATE', 'DELETE']):
                    if query_upper.startswith('INSERT'):
                        query_type = QueryType.INSERT
                    elif query_upper.startswith('UPDATE'):
                        query_type = QueryType.UPDATE
                    else:
                        query_type = QueryType.DELETE
                    
                    data = []
                    total_count = cursor.rowcount
                    
                else:
                    query_type = QueryType.CUSTOM
                    data = []
                    total_count = cursor.rowcount if hasattr(cursor, 'rowcount') else 0
                
                execution_time = time.time() - start_time
                
                return QueryResult(
                    success=True,
                    data=data,
                    total_count=total_count,
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
        """Get sample rows from Oracle table"""
        try:
            query = f"SELECT * FROM {collection} WHERE ROWNUM <= {limit}"
            result = self.execute_query(query, collection, limit)
            
            if result.success:
                return result.data
            else:
                raise Exception(result.error_message)
                
        except Exception as e:
            raise Exception(self.format_error(e))
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get Oracle performance statistics"""
        base_stats = super().get_performance_stats()
        
        if not self._connected:
            return base_stats
        
        try:
            with self.client.cursor() as cursor:
                # Get session info
                cursor.execute("""
                    SELECT 
                        COUNT(*) as session_count
                    FROM v$session
                    WHERE status = 'ACTIVE'
                """)
                active_sessions = cursor.fetchone()[0]
                
                # Get SGA info
                cursor.execute("""
                    SELECT 
                        SUM(value) as sga_size
                    FROM v$sga
                """)
                sga_info = cursor.fetchone()
                sga_size = sga_info[0] if sga_info else 0
                
                # Get buffer cache hit ratio
                cursor.execute("""
                    SELECT 
                        (1 - (phy.value / (cur.value + con.value))) * 100 as hit_ratio
                    FROM v$sysstat phy, v$sysstat cur, v$sysstat con
                    WHERE phy.name = 'physical reads'
                    AND cur.name = 'db block gets'
                    AND con.name = 'consistent gets'
                """)
                hit_ratio_info = cursor.fetchone()
                hit_ratio = hit_ratio_info[0] if hit_ratio_info else 0
                
                oracle_stats = {
                    'active_sessions': active_sessions,
                    'sga_size': sga_size,
                    'buffer_hit_ratio': hit_ratio,
                    'database_type': 'Oracle'
                }
                
                base_stats.update(oracle_stats)
                
        except Exception:
            pass
        
        return base_stats
    
    def explain_query(self, query: Any, collection: Optional[str] = None) -> Dict[str, Any]:
        """Explain Oracle query execution plan"""
        if not self._connected:
            return {'supported': False, 'message': 'Not connected to database'}
        
        try:
            with self.client.cursor() as cursor:
                # Use Oracle's EXPLAIN PLAN
                plan_table = f"PLAN_TABLE_{int(time.time())}"
                
                # Execute explain plan
                explain_query = f"EXPLAIN PLAN SET STATEMENT_ID = '{plan_table}' FOR {query}"
                cursor.execute(explain_query)
                
                # Get the execution plan
                cursor.execute(f"""
                    SELECT 
                        LPAD(' ', 2 * level) || operation || ' ' || options as execution_plan,
                        object_name,
                        cost,
                        cardinality,
                        bytes
                    FROM plan_table
                    WHERE statement_id = '{plan_table}'
                    START WITH id = 0
                    CONNECT BY PRIOR id = parent_id
                    ORDER BY id
                """)
                
                plan_rows = cursor.fetchall()
                
                # Clean up
                cursor.execute(f"DELETE FROM plan_table WHERE statement_id = '{plan_table}'")
                
                execution_plan = []
                for row in plan_rows:
                    execution_plan.append({
                        'operation': row[0],
                        'object_name': row[1],
                        'cost': row[2],
                        'cardinality': row[3],
                        'bytes': row[4]
                    })
                
                return {
                    'supported': True,
                    'execution_plan': execution_plan,
                    'total_cost': sum(row['cost'] or 0 for row in execution_plan)
                }
                
        except Exception as e:
            return {
                'supported': False,
                'error': self.format_error(e)
            }
    
    def get_query_suggestions(self, partial_query: str, 
                            context: Optional[Dict[str, Any]] = None) -> List[str]:
        """Get Oracle SQL query suggestions"""
        suggestions = []
        
        partial_upper = partial_query.upper().strip()
        
        # Oracle-specific query patterns
        oracle_patterns = [
            "SELECT * FROM user_tables",
            "SELECT table_name FROM user_tables WHERE table_name LIKE '%{table}%'",
            "SELECT * FROM {table} WHERE ROWNUM <= 10",
            "SELECT COUNT(*) FROM {table}",
            "DESCRIBE {table}",
            "SELECT * FROM user_tab_columns WHERE table_name = '{table}'",
            "SELECT * FROM user_indexes WHERE table_name = '{table}'",
            "SELECT * FROM user_constraints WHERE table_name = '{table}'",
            "SELECT * FROM v$session WHERE status = 'ACTIVE'",
            "SELECT * FROM v$sysstat WHERE name LIKE '%{metric}%'",
            "EXPLAIN PLAN FOR SELECT * FROM {table}",
            "ALTER TABLE {table} ADD COLUMN {column} {type}",
            "CREATE INDEX idx_{table}_{column} ON {table}({column})",
            "GRANT SELECT ON {table} TO {user}"
        ]
        
        if not partial_upper:
            suggestions = oracle_patterns[:10]
        else:
            # Filter based on partial input
            for pattern in oracle_patterns:
                if any(word in pattern.upper() for word in partial_upper.split()):
                    suggestions.append(pattern)
        
        return suggestions[:10]
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """Get Oracle health metrics"""
        base_metrics = super().get_health_metrics()
        
        if not self._connected:
            return base_metrics
        
        try:
            start_time = time.time()
            
            with self.client.cursor() as cursor:
                # Test response time
                cursor.execute("SELECT 1 FROM DUAL")
                cursor.fetchone()
                response_time = time.time() - start_time
                
                # Get basic health indicators
                cursor.execute("""
                    SELECT 
                        (SELECT COUNT(*) FROM v$session WHERE status = 'ACTIVE') as active_sessions,
                        (SELECT value FROM v$sysstat WHERE name = 'logons current') as current_logons,
                        (SELECT COUNT(*) FROM v$lock WHERE block > 0) as blocking_locks
                    FROM dual
                """)
                
                health_info = cursor.fetchone()
                
                oracle_metrics = {
                    'response_time': response_time,
                    'active_sessions': health_info[0] if health_info else 0,
                    'current_logons': health_info[1] if health_info else 0,
                    'blocking_locks': health_info[2] if health_info else 0
                }
                
                base_metrics.update(oracle_metrics)
                
        except Exception:
            pass
        
        return base_metrics
    
    def create_index(self, collection: str, fields: List[str], 
                    options: Optional[Dict[str, Any]] = None) -> bool:
        """Create an index on Oracle table"""
        if not self._connected:
            return False
        
        try:
            options = options or {}
            unique = options.get('unique', False)
            index_name = options.get('name', f"idx_{collection}_{'_'.join(fields)}")
            
            # Build CREATE INDEX statement
            unique_clause = "UNIQUE " if unique else ""
            columns = ", ".join(fields)
            
            sql = f"CREATE {unique_clause}INDEX {index_name} ON {collection} ({columns})"
            
            with self.client.cursor() as cursor:
                cursor.execute(sql)
                return True
                
        except Exception:
            return False