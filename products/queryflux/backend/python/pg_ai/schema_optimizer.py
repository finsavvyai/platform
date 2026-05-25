"""
AI-Powered Schema Optimizer
Intelligent database schema analysis and optimization recommendations
"""

import re
import time
import json
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field
from collections import defaultdict, Counter
import psycopg2
import psycopg2.extras

try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except ImportError:
    NETWORKX_AVAILABLE = False

from .config import AIConfig

@dataclass
class IndexRecommendation:
    """Index optimization recommendation"""
    table_name: str
    columns: List[str]
    index_type: str  # 'btree', 'hash', 'gin', 'gist', etc.
    reason: str
    priority: str  # 'high', 'medium', 'low'
    estimated_benefit: float  # 0.0-1.0
    cost_estimate: str
    sql_statement: str

@dataclass
class SchemaIssue:
    """Schema design issue"""
    severity: str  # 'critical', 'warning', 'suggestion'
    category: str  # 'normalization', 'performance', 'design', 'naming'
    table_name: Optional[str]
    column_name: Optional[str]
    description: str
    recommendation: str
    impact: str

@dataclass
class TableAnalysis:
    """Detailed table analysis"""
    table_name: str
    row_count: int
    size_bytes: int
    columns: List[Dict[str, Any]]
    indexes: List[Dict[str, Any]]
    foreign_keys: List[Dict[str, Any]]
    issues: List[SchemaIssue] = field(default_factory=list)
    recommendations: List[IndexRecommendation] = field(default_factory=list)
    normalization_score: float = 0.0
    performance_score: float = 0.0

@dataclass
class SchemaOptimizationReport:
    """Comprehensive schema optimization report"""
    timestamp: float
    database_name: str
    overall_score: float  # 0-100
    table_analyses: List[TableAnalysis] = field(default_factory=list)
    global_issues: List[SchemaIssue] = field(default_factory=list)
    global_recommendations: List[str] = field(default_factory=list)
    performance_insights: Dict[str, Any] = field(default_factory=dict)
    optimization_priority: List[str] = field(default_factory=list)

class SchemaOptimizer:
    """AI-assisted database schema design and optimization"""
    
    def __init__(self, conn_params: Dict[str, str], config: Optional[AIConfig] = None):
        self.conn_params = conn_params
        self.config = config or AIConfig.create_default()
        
        # Analysis cache
        self.schema_cache = {}
        self.query_patterns = defaultdict(list)
        self.performance_stats = {}
        
        # Optimization rules
        self.optimization_rules = self._load_optimization_rules()
        
    def _load_optimization_rules(self) -> Dict[str, Any]:
        """Load schema optimization rules and patterns"""
        return {
            'naming_conventions': {
                'table_patterns': [
                    r'^[a-z][a-z0-9_]*[a-z0-9]$',  # snake_case
                ],
                'column_patterns': [
                    r'^[a-z][a-z0-9_]*[a-z0-9]$',  # snake_case
                ],
                'reserved_words': [
                    'user', 'order', 'group', 'table', 'column', 'index',
                    'select', 'insert', 'update', 'delete', 'where', 'from'
                ]
            },
            'performance_rules': {
                'large_table_threshold': 1000000,  # 1M rows
                'wide_table_threshold': 50,        # 50 columns
                'missing_pk_critical': True,
                'unused_index_threshold': 0.1,     # < 10% usage
                'duplicate_index_check': True
            },
            'normalization_rules': {
                'max_columns_1nf': 30,
                'repeated_groups_check': True,
                'nullable_fk_warning': True,
                'circular_dependency_check': True
            },
            'data_type_optimizations': {
                'oversized_varchar': 1000,  # VARCHAR longer than needed
                'int_vs_bigint_threshold': 2147483647,
                'text_vs_varchar_analysis': True,
                'enum_opportunity_threshold': 10  # Distinct values
            }
        }
    
    def analyze_schema(self, schema_name: str = 'public') -> SchemaOptimizationReport:
        """Perform comprehensive schema analysis"""
        start_time = time.time()
        
        try:
            # Get schema information
            schema_info = self._get_comprehensive_schema_info(schema_name)
            
            # Analyze each table
            table_analyses = []
            for table_info in schema_info['tables']:
                analysis = self._analyze_table(table_info, schema_info)
                table_analyses.append(analysis)
            
            # Perform global analysis
            global_issues = self._analyze_global_issues(schema_info, table_analyses)
            global_recommendations = self._generate_global_recommendations(table_analyses, global_issues)
            
            # Calculate scores
            overall_score = self._calculate_overall_score(table_analyses, global_issues)
            performance_insights = self._generate_performance_insights(table_analyses)
            optimization_priority = self._prioritize_optimizations(table_analyses, global_issues)
            
            return SchemaOptimizationReport(
                timestamp=time.time(),
                database_name=self.conn_params.get('dbname', 'unknown'),
                overall_score=overall_score,
                table_analyses=table_analyses,
                global_issues=global_issues,
                global_recommendations=global_recommendations,
                performance_insights=performance_insights,
                optimization_priority=optimization_priority
            )
            
        except Exception as e:
            # Return error report
            return SchemaOptimizationReport(
                timestamp=time.time(),
                database_name=self.conn_params.get('dbname', 'unknown'),
                overall_score=0,
                global_issues=[SchemaIssue(
                    severity='critical',
                    category='system',
                    table_name=None,
                    column_name=None,
                    description=f"Failed to analyze schema: {str(e)}",
                    recommendation="Check database connection and permissions",
                    impact="Cannot perform optimization"
                )]
            )
    
    def _get_comprehensive_schema_info(self, schema_name: str) -> Dict[str, Any]:
        """Get comprehensive schema information"""
        with psycopg2.connect(**self.conn_params) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                
                schema_info = {
                    'tables': [],
                    'views': [],
                    'indexes': [],
                    'constraints': [],
                    'functions': [],
                    'statistics': {}
                }
                
                # Get tables with detailed information
                cur.execute("""
                    SELECT 
                        t.table_name,
                        t.table_type,
                        COALESCE(s.n_tup_ins, 0) as inserts,
                        COALESCE(s.n_tup_upd, 0) as updates,
                        COALESCE(s.n_tup_del, 0) as deletes,
                        COALESCE(s.n_live_tup, 0) as live_tuples,
                        COALESCE(s.n_dead_tup, 0) as dead_tuples,
                        COALESCE(pg_total_relation_size(c.oid), 0) as total_size,
                        COALESCE(pg_relation_size(c.oid), 0) as table_size,
                        obj_description(c.oid) as comment
                    FROM information_schema.tables t
                    LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (
                        SELECT oid FROM pg_namespace WHERE nspname = %s
                    )
                    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name 
                        AND s.schemaname = %s
                    WHERE t.table_schema = %s
                    AND t.table_type = 'BASE TABLE'
                    ORDER BY COALESCE(pg_total_relation_size(c.oid), 0) DESC
                """, (schema_name, schema_name, schema_name))
                
                for table_row in cur.fetchall():
                    table_info = dict(table_row)
                    
                    # Get columns
                    cur.execute("""
                        SELECT 
                            column_name, 
                            data_type, 
                            character_maximum_length,
                            numeric_precision,
                            numeric_scale,
                            is_nullable,
                            column_default,
                            ordinal_position,
                            col_description(pgc.oid, c.ordinal_position) as comment
                        FROM information_schema.columns c
                        LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
                        LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace 
                            AND pgn.nspname = c.table_schema
                        WHERE c.table_schema = %s 
                        AND c.table_name = %s
                        ORDER BY c.ordinal_position
                    """, (schema_name, table_info['table_name']))
                    
                    table_info['columns'] = [dict(col) for col in cur.fetchall()]
                    
                    # Get indexes
                    cur.execute("""
                        SELECT 
                            i.relname as index_name,
                            ix.indisunique as is_unique,
                            ix.indisprimary as is_primary,
                            ix.indkey,
                            array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                            pg_get_indexdef(i.oid) as index_def,
                            COALESCE(s.idx_scan, 0) as usage_count,
                            COALESCE(s.idx_tup_read, 0) as tuples_read,
                            COALESCE(s.idx_tup_fetch, 0) as tuples_fetched
                        FROM pg_index ix
                        JOIN pg_class i ON i.oid = ix.indexrelid
                        JOIN pg_class t ON t.oid = ix.indrelid
                        JOIN pg_namespace n ON n.oid = t.relnamespace
                        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                        LEFT JOIN pg_stat_user_indexes s ON s.indexrelname = i.relname
                        WHERE n.nspname = %s AND t.relname = %s
                        GROUP BY i.relname, ix.indisunique, ix.indisprimary, ix.indkey, 
                                 i.oid, s.idx_scan, s.idx_tup_read, s.idx_tup_fetch
                        ORDER BY ix.indisprimary DESC, ix.indisunique DESC
                    """, (schema_name, table_info['table_name']))
                    
                    table_info['indexes'] = [dict(idx) for idx in cur.fetchall()]
                    
                    # Get foreign keys
                    cur.execute("""
                        SELECT 
                            tc.constraint_name,
                            kcu.column_name,
                            ccu.table_name AS foreign_table_name,
                            ccu.column_name AS foreign_column_name,
                            rc.update_rule,
                            rc.delete_rule
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu 
                            ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.constraint_column_usage ccu 
                            ON ccu.constraint_name = tc.constraint_name
                        LEFT JOIN information_schema.referential_constraints rc 
                            ON tc.constraint_name = rc.constraint_name
                        WHERE tc.constraint_type = 'FOREIGN KEY' 
                        AND tc.table_schema = %s 
                        AND tc.table_name = %s
                    """, (schema_name, table_info['table_name']))
                    
                    table_info['foreign_keys'] = [dict(fk) for fk in cur.fetchall()]
                    
                    # Get check constraints
                    cur.execute("""
                        SELECT 
                            cc.constraint_name,
                            cc.check_clause
                        FROM information_schema.check_constraints cc
                        JOIN information_schema.table_constraints tc 
                            ON cc.constraint_name = tc.constraint_name
                        WHERE tc.table_schema = %s 
                        AND tc.table_name = %s
                    """, (schema_name, table_info['table_name']))
                    
                    table_info['check_constraints'] = [dict(cc) for cc in cur.fetchall()]
                    
                    schema_info['tables'].append(table_info)
                
                return schema_info
    
    def _analyze_table(self, table_info: Dict[str, Any], schema_info: Dict[str, Any]) -> TableAnalysis:
        """Analyze individual table for issues and optimizations"""
        table_name = table_info['table_name']
        columns = table_info['columns']
        indexes = table_info['indexes']
        foreign_keys = table_info['foreign_keys']
        
        analysis = TableAnalysis(
            table_name=table_name,
            row_count=table_info.get('live_tuples', 0),
            size_bytes=table_info.get('total_size', 0),
            columns=columns,
            indexes=indexes,
            foreign_keys=foreign_keys
        )
        
        # Analyze naming conventions
        analysis.issues.extend(self._check_naming_conventions(table_info))
        
        # Analyze normalization
        analysis.issues.extend(self._check_normalization_issues(table_info))
        analysis.normalization_score = self._calculate_normalization_score(table_info)
        
        # Analyze performance issues
        analysis.issues.extend(self._check_performance_issues(table_info))
        analysis.performance_score = self._calculate_performance_score(table_info)
        
        # Generate index recommendations
        analysis.recommendations.extend(self._generate_index_recommendations(table_info))
        
        # Analyze data types
        analysis.issues.extend(self._check_data_type_issues(table_info))
        
        return analysis
    
    def _check_naming_conventions(self, table_info: Dict[str, Any]) -> List[SchemaIssue]:
        """Check naming convention issues"""
        issues = []
        table_name = table_info['table_name']
        rules = self.optimization_rules['naming_conventions']
        
        # Check table name
        if not re.match(rules['table_patterns'][0], table_name):
            issues.append(SchemaIssue(
                severity='suggestion',
                category='naming',
                table_name=table_name,
                column_name=None,
                description=f"Table name '{table_name}' doesn't follow snake_case convention",
                recommendation="Use snake_case naming (e.g., user_accounts, order_items)",
                impact="Affects code readability and maintenance"
            ))
        
        # Check for reserved words
        if table_name.lower() in rules['reserved_words']:
            issues.append(SchemaIssue(
                severity='warning',
                category='naming',
                table_name=table_name,
                column_name=None,
                description=f"Table name '{table_name}' is a reserved word",
                recommendation="Use a different name to avoid conflicts",
                impact="May cause query parsing issues"
            ))
        
        # Check column names
        for column in table_info['columns']:
            col_name = column['column_name']
            
            if not re.match(rules['column_patterns'][0], col_name):
                issues.append(SchemaIssue(
                    severity='suggestion',
                    category='naming',
                    table_name=table_name,
                    column_name=col_name,
                    description=f"Column '{col_name}' doesn't follow snake_case convention",
                    recommendation="Use snake_case naming for consistency",
                    impact="Affects code readability"
                ))
            
            if col_name.lower() in rules['reserved_words']:
                issues.append(SchemaIssue(
                    severity='warning',
                    category='naming',
                    table_name=table_name,
                    column_name=col_name,
                    description=f"Column '{col_name}' is a reserved word",
                    recommendation="Use a different column name",
                    impact="May require quoting in queries"
                ))
        
        return issues
    
    def _check_normalization_issues(self, table_info: Dict[str, Any]) -> List[SchemaIssue]:
        """Check normalization-related issues"""
        issues = []
        table_name = table_info['table_name']
        columns = table_info['columns']
        
        # Check for missing primary key
        has_primary_key = any(idx['is_primary'] for idx in table_info['indexes'])
        if not has_primary_key:
            issues.append(SchemaIssue(
                severity='critical',
                category='normalization',
                table_name=table_name,
                column_name=None,
                description=f"Table '{table_name}' lacks a primary key",
                recommendation="Add a primary key constraint (consider using SERIAL or UUID)",
                impact="Affects replication, performance, and data integrity"
            ))
        
        # Check for too many columns (potential 1NF violation)
        if len(columns) > self.optimization_rules['normalization_rules']['max_columns_1nf']:
            issues.append(SchemaIssue(
                severity='warning',
                category='normalization',
                table_name=table_name,
                column_name=None,
                description=f"Table has {len(columns)} columns, which may indicate denormalization",
                recommendation="Consider breaking into multiple related tables",
                impact="May affect maintenance and query performance"
            ))
        
        # Check for repeated column patterns (potential normalization issue)
        column_patterns = self._find_repeated_column_patterns(columns)
        for pattern, count in column_patterns.items():
            if count > 2:
                issues.append(SchemaIssue(
                    severity='suggestion',
                    category='normalization',
                    table_name=table_name,
                    column_name=None,
                    description=f"Found {count} columns with pattern '{pattern}*'",
                    recommendation="Consider normalizing into a separate table",
                    impact="Could improve maintainability and reduce redundancy"
                ))
        
        # Check for nullable foreign keys
        for fk in table_info['foreign_keys']:
            column_name = fk['column_name']
            column = next((c for c in columns if c['column_name'] == column_name), None)
            if column and column['is_nullable'] == 'YES':
                issues.append(SchemaIssue(
                    severity='suggestion',
                    category='normalization',
                    table_name=table_name,
                    column_name=column_name,
                    description=f"Foreign key '{column_name}' is nullable",
                    recommendation="Consider if this relationship should be optional",
                    impact="May indicate incomplete relationships"
                ))
        
        return issues
    
    def _check_performance_issues(self, table_info: Dict[str, Any]) -> List[SchemaIssue]:
        """Check performance-related issues"""
        issues = []
        table_name = table_info['table_name']
        row_count = table_info.get('live_tuples', 0)
        dead_tuples = table_info.get('dead_tuples', 0)
        
        # Check for unused indexes
        for index in table_info['indexes']:
            if not index['is_primary'] and index.get('usage_count', 0) == 0:
                issues.append(SchemaIssue(
                    severity='warning',
                    category='performance',
                    table_name=table_name,
                    column_name=None,
                    description=f"Index '{index['index_name']}' appears to be unused",
                    recommendation="Consider dropping unused indexes to improve write performance",
                    impact="Unused indexes slow down INSERT/UPDATE/DELETE operations"
                ))
        
        # Check for duplicate indexes
        duplicate_indexes = self._find_duplicate_indexes(table_info['indexes'])
        for duplicate_group in duplicate_indexes:
            index_names = [idx['index_name'] for idx in duplicate_group]
            issues.append(SchemaIssue(
                severity='warning',
                category='performance',
                table_name=table_name,
                column_name=None,
                description=f"Duplicate indexes detected: {', '.join(index_names)}",
                recommendation="Remove redundant indexes, keep the most specific one",
                impact="Duplicate indexes waste storage and slow down writes"
            ))
        
        # Check for high dead tuple ratio
        if row_count > 0 and dead_tuples > 0:
            dead_ratio = dead_tuples / (row_count + dead_tuples)
            if dead_ratio > 0.2:  # More than 20% dead tuples
                issues.append(SchemaIssue(
                    severity='warning',
                    category='performance',
                    table_name=table_name,
                    column_name=None,
                    description=f"High dead tuple ratio: {dead_ratio:.1%}",
                    recommendation="Run VACUUM ANALYZE to clean up dead tuples",
                    impact="Dead tuples slow down queries and waste space"
                ))
        
        # Check for missing indexes on foreign keys
        fk_columns = {fk['column_name'] for fk in table_info['foreign_keys']}
        indexed_columns = set()
        for index in table_info['indexes']:
            if index['columns']:
                indexed_columns.add(index['columns'][0])  # First column of index
        
        missing_fk_indexes = fk_columns - indexed_columns
        for col_name in missing_fk_indexes:
            issues.append(SchemaIssue(
                severity='suggestion',
                category='performance',
                table_name=table_name,
                column_name=col_name,
                description=f"Foreign key column '{col_name}' lacks an index",
                recommendation="Add an index on foreign key columns for better join performance",
                impact="Missing indexes on FKs can slow down JOINs and deletes on referenced tables"
            ))
        
        return issues
    
    def _check_data_type_issues(self, table_info: Dict[str, Any]) -> List[SchemaIssue]:
        """Check data type optimization issues"""
        issues = []
        table_name = table_info['table_name']
        
        for column in table_info['columns']:
            col_name = column['column_name']
            data_type = column['data_type'].lower()
            max_length = column.get('character_maximum_length')
            
            # Check for oversized VARCHAR
            if data_type == 'character varying' and max_length:
                if max_length > self.optimization_rules['data_type_optimizations']['oversized_varchar']:
                    issues.append(SchemaIssue(
                        severity='suggestion',
                        category='design',
                        table_name=table_name,
                        column_name=col_name,
                        description=f"VARCHAR({max_length}) might be oversized",
                        recommendation="Consider using TEXT or appropriate smaller VARCHAR size",
                        impact="Oversized VARCHAR can waste space and memory"
                    ))
            
            # Check for potential ENUM opportunities
            # This would require actual data analysis, so we'll skip for now
            
            # Check for inappropriate use of TEXT vs VARCHAR
            if data_type == 'text':
                issues.append(SchemaIssue(
                    severity='suggestion',
                    category='design',
                    table_name=table_name,
                    column_name=col_name,
                    description=f"Column '{col_name}' uses TEXT data type",
                    recommendation="Consider VARCHAR with appropriate length if data has predictable size",
                    impact="TEXT might be less efficient than VARCHAR for fixed-size data"
                ))
        
        return issues
    
    def _generate_index_recommendations(self, table_info: Dict[str, Any]) -> List[IndexRecommendation]:
        """Generate index recommendations based on table analysis"""
        recommendations = []
        table_name = table_info['table_name']
        columns = table_info['columns']
        existing_indexes = table_info['indexes']
        foreign_keys = table_info['foreign_keys']
        
        # Get existing indexed columns
        indexed_columns = set()
        for index in existing_indexes:
            if index['columns']:
                indexed_columns.update(index['columns'])
        
        # Recommend indexes for foreign key columns
        for fk in foreign_keys:
            col_name = fk['column_name']
            if col_name not in indexed_columns:
                recommendations.append(IndexRecommendation(
                    table_name=table_name,
                    columns=[col_name],
                    index_type='btree',
                    reason=f"Foreign key column needs index for efficient JOINs",
                    priority='high',
                    estimated_benefit=0.8,
                    cost_estimate='low',
                    sql_statement=f"CREATE INDEX idx_{table_name}_{col_name} ON {table_name} ({col_name});"
                ))
        
        # Recommend composite indexes for multi-column searches
        # This would typically be based on query analysis, but we'll provide some heuristics
        
        # Look for columns that might benefit from indexing
        candidate_columns = []
        for column in columns:
            col_name = column['column_name']
            data_type = column['data_type'].lower()
            
            # Skip if already indexed
            if col_name in indexed_columns:
                continue
                
            # Good candidates for indexing
            if any(keyword in col_name.lower() for keyword in 
                   ['email', 'username', 'name', 'code', 'status', 'type', 'category']):
                candidate_columns.append(col_name)
            
            # Date/timestamp columns are often filtered
            if 'timestamp' in data_type or 'date' in data_type:
                candidate_columns.append(col_name)
        
        # Generate recommendations for candidate columns
        for col_name in candidate_columns[:3]:  # Limit to top 3 candidates
            recommendations.append(IndexRecommendation(
                table_name=table_name,
                columns=[col_name],
                index_type='btree',
                reason=f"Column '{col_name}' appears to be frequently filtered",
                priority='medium',
                estimated_benefit=0.6,
                cost_estimate='low',
                sql_statement=f"CREATE INDEX idx_{table_name}_{col_name} ON {table_name} ({col_name});"
            ))
        
        return recommendations
    
    def _find_repeated_column_patterns(self, columns: List[Dict[str, Any]]) -> Dict[str, int]:
        """Find repeated column name patterns"""
        patterns = defaultdict(int)
        
        for column in columns:
            col_name = column['column_name']
            
            # Extract potential patterns (prefixes ending with numbers or underscores)
            matches = re.findall(r'([a-z_]+)_?\d*$', col_name.lower())
            for match in matches:
                if len(match) > 2:  # Only consider meaningful patterns
                    patterns[match] += 1
        
        # Only return patterns that appear more than once
        return {pattern: count for pattern, count in patterns.items() if count > 1}
    
    def _find_duplicate_indexes(self, indexes: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
        """Find duplicate or redundant indexes"""
        duplicates = []
        
        # Group indexes by their column sets
        column_groups = defaultdict(list)
        for index in indexes:
            if index['columns']:
                # Create a tuple of columns as key
                columns_key = tuple(sorted(index['columns']))
                column_groups[columns_key].append(index)
        
        # Find groups with multiple indexes
        for column_set, index_list in column_groups.items():
            if len(index_list) > 1:
                duplicates.append(index_list)
        
        return duplicates
    
    def _calculate_normalization_score(self, table_info: Dict[str, Any]) -> float:
        """Calculate normalization score (0-100)"""
        score = 100.0
        
        # Deduct for missing primary key
        has_primary_key = any(idx['is_primary'] for idx in table_info['indexes'])
        if not has_primary_key:
            score -= 30
        
        # Deduct for too many columns
        column_count = len(table_info['columns'])
        if column_count > 30:
            score -= min(20, (column_count - 30) * 2)
        
        # Deduct for repeated patterns
        patterns = self._find_repeated_column_patterns(table_info['columns'])
        score -= min(15, len(patterns) * 5)
        
        return max(0, score)
    
    def _calculate_performance_score(self, table_info: Dict[str, Any]) -> float:
        """Calculate performance score (0-100)"""
        score = 100.0
        
        # Deduct for unused indexes
        unused_indexes = sum(1 for idx in table_info['indexes'] 
                           if not idx['is_primary'] and idx.get('usage_count', 0) == 0)
        score -= unused_indexes * 10
        
        # Deduct for missing FK indexes
        fk_columns = {fk['column_name'] for fk in table_info['foreign_keys']}
        indexed_columns = set()
        for index in table_info['indexes']:
            if index['columns']:
                indexed_columns.add(index['columns'][0])
        
        missing_fk_indexes = len(fk_columns - indexed_columns)
        score -= missing_fk_indexes * 15
        
        # Deduct for high dead tuple ratio
        row_count = table_info.get('live_tuples', 0)
        dead_tuples = table_info.get('dead_tuples', 0)
        if row_count > 0 and dead_tuples > 0:
            dead_ratio = dead_tuples / (row_count + dead_tuples)
            if dead_ratio > 0.2:
                score -= dead_ratio * 50
        
        return max(0, score)
    
    def _analyze_global_issues(self, schema_info: Dict[str, Any], table_analyses: List[TableAnalysis]) -> List[SchemaIssue]:
        """Analyze schema-wide issues"""
        issues = []
        
        # Check for naming consistency across tables
        table_names = [table['table_name'] for table in schema_info['tables']]
        
        # Check for similar table names that might indicate redundancy
        similar_names = self._find_similar_table_names(table_names)
        for group in similar_names:
            if len(group) > 1:
                issues.append(SchemaIssue(
                    severity='suggestion',
                    category='design',
                    table_name=None,
                    column_name=None,
                    description=f"Similar table names found: {', '.join(group)}",
                    recommendation="Verify if these tables serve different purposes or could be consolidated",
                    impact="Similar names can cause confusion and maintenance issues"
                ))
        
        # Check for missing relationships
        # This would require more sophisticated analysis
        
        # Check for circular dependencies
        if NETWORKX_AVAILABLE:
            circular_deps = self._find_circular_dependencies(schema_info['tables'])
            if circular_deps:
                issues.append(SchemaIssue(
                    severity='warning',
                    category='design',
                    table_name=None,
                    column_name=None,
                    description=f"Circular dependencies detected: {' -> '.join(circular_deps)}",
                    recommendation="Review foreign key relationships to eliminate cycles",
                    impact="Circular dependencies can complicate data operations"
                ))
        
        return issues
    
    def _find_similar_table_names(self, table_names: List[str]) -> List[List[str]]:
        """Find groups of similar table names"""
        from difflib import SequenceMatcher
        
        similar_groups = []
        processed = set()
        
        for i, name1 in enumerate(table_names):
            if name1 in processed:
                continue
                
            group = [name1]
            for j, name2 in enumerate(table_names[i+1:], i+1):
                if name2 in processed:
                    continue
                    
                # Calculate similarity
                similarity = SequenceMatcher(None, name1, name2).ratio()
                if similarity > 0.7:  # 70% similarity threshold
                    group.append(name2)
                    processed.add(name2)
            
            if len(group) > 1:
                similar_groups.append(group)
            
            processed.add(name1)
        
        return similar_groups
    
    def _find_circular_dependencies(self, tables: List[Dict[str, Any]]) -> Optional[List[str]]:
        """Find circular dependencies using graph analysis"""
        if not NETWORKX_AVAILABLE:
            return None
            
        # Build dependency graph
        G = nx.DiGraph()
        
        for table in tables:
            table_name = table['table_name']
            G.add_node(table_name)
            
            for fk in table['foreign_keys']:
                target_table = fk['foreign_table_name']
                G.add_edge(table_name, target_table)
        
        # Find cycles
        try:
            cycle = nx.find_cycle(G, orientation='original')
            return [edge[0] for edge in cycle]
        except nx.NetworkXNoCycle:
            return None
    
    def _generate_global_recommendations(self, table_analyses: List[TableAnalysis], 
                                       global_issues: List[SchemaIssue]) -> List[str]:
        """Generate schema-wide recommendations"""
        recommendations = []
        
        # Count issue types across all tables
        issue_counts = defaultdict(int)
        for analysis in table_analyses:
            for issue in analysis.issues:
                issue_counts[issue.category] += 1
        
        # Generate recommendations based on common issues
        if issue_counts['naming'] > len(table_analyses) * 0.5:
            recommendations.append("Establish and enforce consistent naming conventions across all tables")
        
        if issue_counts['performance'] > len(table_analyses) * 0.3:
            recommendations.append("Review and optimize indexes across the schema for better performance")
        
        if issue_counts['normalization'] > 0:
            recommendations.append("Review table designs for proper normalization")
        
        # Performance recommendations
        total_recommendations = sum(len(analysis.recommendations) for analysis in table_analyses)
        if total_recommendations > 0:
            recommendations.append(f"Implement {total_recommendations} index recommendations to improve query performance")
        
        # General recommendations
        recommendations.append("Regularly monitor database performance and run VACUUM ANALYZE")
        recommendations.append("Consider implementing automated schema documentation")
        
        return recommendations
    
    def _calculate_overall_score(self, table_analyses: List[TableAnalysis], 
                                global_issues: List[SchemaIssue]) -> float:
        """Calculate overall schema score"""
        if not table_analyses:
            return 0.0
        
        # Average table scores
        avg_normalization = sum(analysis.normalization_score for analysis in table_analyses) / len(table_analyses)
        avg_performance = sum(analysis.performance_score for analysis in table_analyses) / len(table_analyses)
        
        # Weight the scores
        table_score = (avg_normalization * 0.4 + avg_performance * 0.6)
        
        # Deduct for global issues
        global_deduction = 0
        for issue in global_issues:
            if issue.severity == 'critical':
                global_deduction += 15
            elif issue.severity == 'warning':
                global_deduction += 10
            else:
                global_deduction += 5
        
        return max(0, table_score - global_deduction)
    
    def _generate_performance_insights(self, table_analyses: List[TableAnalysis]) -> Dict[str, Any]:
        """Generate performance insights"""
        insights = {
            'total_tables': len(table_analyses),
            'total_issues': sum(len(analysis.issues) for analysis in table_analyses),
            'total_recommendations': sum(len(analysis.recommendations) for analysis in table_analyses),
            'largest_tables': [],
            'tables_needing_attention': []
        }
        
        # Find largest tables
        sorted_tables = sorted(table_analyses, key=lambda t: t.size_bytes, reverse=True)
        insights['largest_tables'] = [
            {'name': t.table_name, 'size_bytes': t.size_bytes, 'row_count': t.row_count}
            for t in sorted_tables[:5]
        ]
        
        # Find tables needing most attention
        tables_by_issues = sorted(table_analyses, key=lambda t: len(t.issues), reverse=True)
        insights['tables_needing_attention'] = [
            {'name': t.table_name, 'issue_count': len(t.issues), 'performance_score': t.performance_score}
            for t in tables_by_issues[:5] if len(t.issues) > 0
        ]
        
        return insights
    
    def _prioritize_optimizations(self, table_analyses: List[TableAnalysis], 
                                 global_issues: List[SchemaIssue]) -> List[str]:
        """Prioritize optimization tasks"""
        priorities = []
        
        # Critical issues first
        critical_issues = []
        for analysis in table_analyses:
            for issue in analysis.issues:
                if issue.severity == 'critical':
                    critical_issues.append(f"{analysis.table_name}: {issue.description}")
        
        if critical_issues:
            priorities.extend(critical_issues)
        
        # High-impact recommendations
        high_impact_recs = []
        for analysis in table_analyses:
            for rec in analysis.recommendations:
                if rec.priority == 'high':
                    high_impact_recs.append(f"{analysis.table_name}: {rec.reason}")
        
        if high_impact_recs:
            priorities.extend(high_impact_recs[:5])  # Top 5 high-impact items
        
        # Global issues
        for issue in global_issues:
            if issue.severity in ['critical', 'warning']:
                priorities.append(f"Schema-wide: {issue.description}")
        
        return priorities
    
    def suggest_query_optimizations(self, query: str) -> List[str]:
        """Suggest optimizations for a specific query"""
        suggestions = []
        query_upper = query.upper().strip()
        
        # Basic query analysis
        if 'SELECT *' in query_upper:
            suggestions.append("Avoid SELECT * - specify only needed columns")
        
        if 'ORDER BY' in query_upper and 'LIMIT' not in query_upper:
            suggestions.append("Consider adding LIMIT when using ORDER BY")
        
        if query_upper.count('JOIN') > 3:
            suggestions.append("Complex joins detected - consider breaking into smaller queries or adding indexes")
        
        if 'WHERE' not in query_upper and 'SELECT' in query_upper:
            suggestions.append("Consider adding WHERE clause to limit result set")
        
        # Look for potential index usage
        table_pattern = r'FROM\s+(\w+)'
        tables = re.findall(table_pattern, query_upper)
        
        for table in tables:
            suggestions.append(f"Ensure proper indexes exist on {table} for optimal performance")
        
        return suggestions