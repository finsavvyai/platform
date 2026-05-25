#!/usr/bin/env python3
"""
QuantumBeam Database Performance Optimization Tool
Provides comprehensive database performance analysis and optimization recommendations.
"""

import os
import sys
import json
import yaml
import time
import logging
import asyncio
import psycopg2
import psycopg2.extras
import redis
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import asyncpg
import boto3
from botocore.exceptions import ClientError
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class DatabaseMetrics:
    """Database performance metrics."""
    timestamp: datetime
    connections_active: int
    connections_idle: int
    connections_total: int
    database_size_gb: float
    cache_hit_ratio: float
    index_usage_ratio: float
    query_duration_avg_ms: float
    query_duration_p95_ms: float
    slow_queries_count: int
    deadlocks_count: int
    lock_wait_time_ms: float
    disk_io_read_mb_s: float
    disk_io_write_mb_s: float
    cpu_usage_percent: float
    memory_usage_percent: float

@dataclass
class QueryAnalysis:
    """Query performance analysis."""
    query_text: str
    query_type: str
    execution_count: int
    total_exec_time_ms: float
    avg_exec_time_ms: float
    max_exec_time_ms: float
    p95_exec_time_ms: float
    rows_returned: int
    rows_examined: int
    index_scans: int
    seq_scans: int
    cache_hits: int
    recommendations: List[str]

@dataclass
class IndexAnalysis:
    """Index performance analysis."""
    index_name: str
    table_name: str
    index_type: str
    size_mb: float
    usage_count: int
    last_used: datetime
    selectivity_ratio: float
    recommendations: List[str]
    rebuild_required: bool

@dataclass
class OptimizationRecommendation:
    """Database optimization recommendation."""
    category: str
    priority: str  # high, medium, low
    title: str
    description: str
    sql_statements: List[str]
    estimated_impact: str
    implementation_complexity: str
    risk_level: str
    estimated_time_to_implement: str

class DatabaseAnalyzer:
    """Database performance analyzer."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_connection = None
        self.redis_client = None
        self._initialize_connections()

    def _initialize_connections(self):
        """Initialize database and Redis connections."""
        # Initialize PostgreSQL connection
        try:
            self.db_connection = psycopg2.connect(
                host=self.config['database']['host'],
                port=self.config['database']['port'],
                database=self.config['database']['name'],
                user=self.config['database']['username'],
                password=self.config['database']['password'],
                connect_timeout=10,
                application_name='db_performance_analyzer'
            )
            logger.info("PostgreSQL connection established")
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise

        # Initialize Redis connection
        try:
            self.redis_client = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                password=os.getenv('REDIS_PASSWORD'),
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")

    async def collect_database_metrics(self, duration_minutes: int = 15) -> DatabaseMetrics:
        """Collect current database performance metrics."""
        cursor = self.db_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            # Get connection metrics
            cursor.execute("""
                SELECT
                    count(*) FILTER (WHERE state = 'active') as active_connections,
                    count(*) FILTER (WHERE state = 'idle') as idle_connections,
                    count(*) as total_connections
                FROM pg_stat_activity
                WHERE datname = current_database()
            """)
            conn_metrics = cursor.fetchone()

            # Get database size
            cursor.execute("""
                SELECT pg_size_pretty(pg_database_size(current_database())) as size_pretty,
                       pg_database_size(current_database()) / 1024 / 1024 / 1024 as size_gb
            """)
            db_size = cursor.fetchone()

            # Get cache hit ratio
            cursor.execute("""
                SELECT
                    (heap_blks_hit::float / NULLIF(heap_blks_hit + heap_blks_read, 0)) * 100 as cache_hit_ratio
                FROM pg_stat_database
                WHERE datname = current_database()
            """)
            cache_ratio = cursor.fetchone()

            # Get index usage ratio
            cursor.execute("""
                SELECT
                    (idx_scan::float / NULLIF(idx_scan + seq_scan, 0)) * 100 as index_usage_ratio
                FROM pg_stat_user_tables
                WHERE schemaname = 'public'
            """)
            index_metrics = cursor.fetchall()
            avg_index_usage = np.mean([row['index_usage_ratio'] for row in index_metrics if row['index_usage_ratio']])

            # Get slow queries (from pg_stat_statements if available)
            slow_queries = 0
            try:
                cursor.execute("""
                    SELECT sum(calls) as total_calls,
                           sum(total_exec_time) as total_time,
                           sum(mean_exec_time) / sum(calls) as avg_time
                    FROM pg_stat_statements
                    WHERE mean_exec_time > 1000  -- queries taking more than 1 second
                """)
                slow_query_stats = cursor.fetchone()
                if slow_query_stats and slow_query_stats['total_calls']:
                    slow_queries = slow_query_stats['total_calls']
            except psycopg2.Error:
                # pg_stat_statements might not be available
                pass

            return DatabaseMetrics(
                timestamp=datetime.now(),
                connections_active=conn_metrics['active_connections'],
                connections_idle=conn_metrics['idle_connections'],
                connections_total=conn_metrics['total_connections'],
                database_size_gb=db_size['size_gb'],
                cache_hit_ratio=cache_ratio['cache_hit_ratio'],
                index_usage_ratio=avg_index_usage,
                query_duration_avg_ms=0,  # Will be calculated from query stats
                query_duration_p95_ms=0,
                slow_queries_count=slow_queries,
                deadlocks_count=0,
                lock_wait_time_ms=0,
                disk_io_read_mb_s=0,
                disk_io_write_mb_s=0,
                cpu_usage_percent=0,
                memory_usage_percent=0
            )

        except Exception as e:
            logger.error(f"Failed to collect database metrics: {e}")
            raise
        finally:
            cursor.close()

    def analyze_slow_queries(self, limit: int = 20) -> List[QueryAnalysis]:
        """Analyze slow queries from pg_stat_statements."""
        cursor = self.db_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            cursor.execute("""
                SELECT
                    query,
                    calls as execution_count,
                    total_exec_time as total_exec_time_ms,
                    mean_exec_time as avg_exec_time_ms,
                    max_exec_time as max_exec_time_ms,
                    stddev_exec_time as stddev_exec_time_ms,
                    rows,
                    shared_blks_hit,
                    shared_blks_read,
                    local_blks_hit,
                    local_blks_read,
                    temp_blks_read,
                    temp_blks_written
                FROM pg_stat_statements
                WHERE calls > 10
                ORDER BY mean_exec_time DESC
                LIMIT %s
            """, (limit,))

            queries = []
            for row in cursor.fetchall():
                # Generate recommendations
                recommendations = self._generate_query_recommendations(row)

                analysis = QueryAnalysis(
                    query_text=row['query'][:200] + "..." if len(row['query']) > 200 else row['query'],
                    query_type=self._detect_query_type(row['query']),
                    execution_count=row['execution_count'],
                    total_exec_time_ms=row['total_exec_time_ms'],
                    avg_exec_time_ms=row['avg_exec_time_ms'],
                    max_exec_time_ms=row['max_exec_time_ms'],
                    p95_exec_time_ms=row['avg_exec_time_ms'] + (1.96 * row['stddev_exec_time_ms']),
                    rows_returned=row['rows'],
                    rows_examined=row['shared_blks_read'] + row['local_blks_read'],
                    index_scans=row['shared_blks_hit'],
                    seq_scans=row['shared_blks_read'],
                    cache_hits=row['shared_blks_hit'],
                    recommendations=recommendations
                )
                queries.append(analysis)

            return queries

        except Exception as e:
            logger.error(f"Failed to analyze slow queries: {e}")
            return []
        finally:
            cursor.close()

    def analyze_indexes(self) -> List[IndexAnalysis]:
        """Analyze index usage and performance."""
        cursor = self.db_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            # Get index statistics
            cursor.execute("""
                SELECT
                    schemaname,
                    tablename,
                    indexname,
                    indexdef,
                    idx_scan as usage_count,
                    idx_tup_read,
                    idx_tup_fetch,
                    pg_size_pretty(pg_relation_size(indexrelid::regclass)) as size_pretty,
                    pg_relation_size(indexrelid::regclass) / 1024 / 1024 as size_mb
                FROM pg_stat_user_indexes
                JOIN pg_index ON pg_stat_user_indexes.indexrelid = pg_index.indexrelid
                JOIN pg_class ON pg_class.oid = pg_stat_user_indexes.indexrelid
                WHERE schemaname = 'public'
                ORDER BY idx_scan DESC
            """)

            indexes = []
            for row in cursor.fetchall():
                recommendations = self._generate_index_recommendations(row)

                analysis = IndexAnalysis(
                    index_name=row['indexname'],
                    table_name=row['tablename'],
                    index_type=self._detect_index_type(row['indexdef']),
                    size_mb=row['size_mb'],
                    usage_count=row['usage_count'],
                    last_used=datetime.now(),  # Would need additional tracking
                    selectivity_ratio=self._calculate_index_selectivity(row['tablename'], row['indexname']),
                    recommendations=recommendations,
                    rebuild_required=row['usage_count'] == 0 and row['size_mb'] > 10
                )
                indexes.append(analysis)

            return indexes

        except Exception as e:
            logger.error(f"Failed to analyze indexes: {e}")
            return []
        finally:
            cursor.close()

    def _generate_query_recommendations(self, query_stats: Dict[str, Any]) -> List[str]:
        """Generate optimization recommendations for a query."""
        recommendations = []

        # Check for sequential scans
        if query_stats['shared_blks_read'] > 1000:
            recommendations.append("Consider adding indexes to reduce sequential scans")

        # Check for low cache hit ratio
        total_blocks = query_stats['shared_blks_hit'] + query_stats['shared_blks_read']
        if total_blocks > 0:
            cache_hit_ratio = query_stats['shared_blks_hit'] / total_blocks
            if cache_hit_ratio < 0.8:
                recommendations.append("Low cache hit ratio - consider increasing shared_buffers")

        # Check for high execution time
        if query_stats['avg_exec_time_ms'] > 5000:
            recommendations.append("Query takes >5 seconds - consider query optimization")

        # Check for temp table usage
        if query_stats['temp_blks_read'] > 0 or query_stats['temp_blks_written'] > 0:
            recommendations.append("Query uses temporary tables - consider query rewrite")

        # Check for high row count
        if query_stats['rows'] > 10000:
            recommendations.append("Query returns many rows - consider pagination or filtering")

        return recommendations

    def _generate_index_recommendations(self, index_stats: Dict[str, Any]) -> List[str]:
        """Generate optimization recommendations for an index."""
        recommendations = []

        # Check for unused indexes
        if index_stats['usage_count'] == 0:
            if index_stats['size_mb'] > 10:
                recommendations.append(f"Large unused index ({index_stats['size_mb']:.1f}MB) - consider dropping")
            else:
                recommendations.append("Unused index - consider dropping")

        # Check for small indexes that might not be effective
        if index_stats['size_mb'] < 1 and index_stats['usage_count'] < 100:
            recommendations.append("Small index with low usage - evaluate effectiveness")

        # Check for high usage indexes that might benefit from optimization
        if index_stats['usage_count'] > 10000:
            recommendations.append("High-usage index - consider monitoring fragmentation")

        return recommendations

    def _detect_query_type(self, query: str) -> str:
        """Detect query type from SQL text."""
        query_lower = query.lower().strip()
        if query_lower.startswith('select'):
            return 'SELECT'
        elif query_lower.startswith('insert'):
            return 'INSERT'
        elif query_lower.startswith('update'):
            return 'UPDATE'
        elif query_lower.startswith('delete'):
            return 'DELETE'
        elif query_lower.startswith('create'):
            return 'CREATE'
        elif query_lower.startswith('drop'):
            return 'DROP'
        elif query_lower.startswith('alter'):
            return 'ALTER'
        else:
            return 'OTHER'

    def _detect_index_type(self, index_def: str) -> str:
        """Detect index type from index definition."""
        index_def_lower = index_def.lower()
        if 'using btree' in index_def_lower:
            return 'BTREE'
        elif 'using hash' in index_def_lower:
            return 'HASH'
        elif 'using gist' in index_def_lower:
            return 'GIST'
        elif 'using gin' in index_def_lower:
            return 'GIN'
        elif 'using brin' in index_def_lower:
            return 'BRIN'
        else:
            return 'BTREE'  # Default

    def _calculate_index_selectivity(self, table_name: str, index_name: str) -> float:
        """Calculate index selectivity (simplified)."""
        cursor = self.db_connection.cursor()

        try:
            # Get approximate row count
            cursor.execute(f"SELECT reltuples::float FROM pg_class WHERE relname = '{table_name}'")
            result = cursor.fetchone()
            if result and result[0] > 0:
                # Simplified selectivity calculation
                return 0.1  # Placeholder - would need more complex logic
            return 0.0
        except Exception:
            return 0.0
        finally:
            cursor.close()

    def generate_optimization_recommendations(self) -> List[OptimizationRecommendation]:
        """Generate comprehensive optimization recommendations."""
        recommendations = []

        # Configuration analysis
        recommendations.extend(self._analyze_configuration())

        # Index recommendations
        index_analyses = self.analyze_indexes()
        recommendations.extend(self._generate_index_recommendations(index_analyses))

        # Query recommendations
        query_analyses = self.analyze_slow_queries()
        recommendations.extend(self._generate_query_recommendations_list(query_analyses))

        # Table analysis
        recommendations.extend(self._analyze_tables())

        return recommendations

    def _analyze_configuration(self) -> List[OptimizationRecommendation]:
        """Analyze database configuration."""
        recommendations = []
        cursor = self.db_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            # Check shared_buffers
            cursor.execute("SHOW shared_buffers")
            shared_buffers = cursor.fetchone()['shared_buffers']
            if '8MB' == shared_buffers or '16MB' == shared_buffers:
                recommendations.append(OptimizationRecommendation(
                    category="configuration",
                    priority="high",
                    title="Increase shared_buffers",
                    description="shared_buffers is set to default value. Consider increasing to 25% of system RAM.",
                    sql_statements=[f"ALTER SYSTEM SET shared_buffers = '256MB';"],
                    estimated_impact="Improves cache hit ratio and query performance",
                    implementation_complexity="low",
                    risk_level="low",
                    estimated_time_to_implement="5 minutes"
                ))

            # Check work_mem
            cursor.execute("SHOW work_mem")
            work_mem = cursor.fetchone()['work_mem']
            if '4MB' == work_mem:
                recommendations.append(OptimizationRecommendation(
                    category="configuration",
                    priority="medium",
                    title="Increase work_mem",
                    description="work_mem is set to default. Consider increasing for complex queries.",
                    sql_statements=[f"ALTER SYSTEM SET work_mem = '64MB';"],
                    estimated_impact="Improves sorting and hash operation performance",
                    implementation_complexity="low",
                    risk_level="medium",
                    estimated_time_to_implement="5 minutes"
                ))

            # Check maintenance_work_mem
            cursor.execute("SHOW maintenance_work_mem")
            maintenance_work_mem = cursor.fetchone()['maintenance_work_mem']
            if '64MB' == maintenance_work_mem:
                recommendations.append(OptimizationRecommendation(
                    category="configuration",
                    priority="medium",
                    title="Increase maintenance_work_mem",
                    description="maintenance_work_mem is set to default. Consider increasing for faster index creation.",
                    sql_statements=[f"ALTER SYSTEM SET maintenance_work_mem = '512MB';"],
                    estimated_impact="Faster index creation and VACUUM operations",
                    implementation_complexity="low",
                    risk_level="low",
                    estimated_time_to_implement="5 minutes"
                ))

            # Check random_page_cost
            cursor.execute("SHOW random_page_cost")
            random_page_cost = cursor.fetchone()['random_page_cost']
            if random_page_cost == '4.0' and self._is_ssd_storage():
                recommendations.append(OptimizationRecommendation(
                    category="configuration",
                    priority="high",
                    title="Adjust random_page_cost for SSD",
                    description="random_page_cost should be reduced for SSD storage systems.",
                    sql_statements=[f"ALTER SYSTEM SET random_page_cost = '1.1';"],
                    estimated_impact="Improves query planner decisions for SSD",
                    implementation_complexity="low",
                    risk_level="low",
                    estimated_time_to_implement="5 minutes"
                ))

        except Exception as e:
            logger.error(f"Failed to analyze configuration: {e}")
        finally:
            cursor.close()

        return recommendations

    def _is_ssd_storage(self) -> bool:
        """Check if database is running on SSD storage."""
        # Simplified check - would need more sophisticated detection
        return True  # Assume SSD for modern deployments

    def _generate_index_recommendations(self, index_analyses: List[IndexAnalysis]) -> List[OptimizationRecommendation]:
        """Generate index optimization recommendations."""
        recommendations = []

        # Find unused indexes
        unused_indexes = [idx for idx in index_analyses if idx.usage_count == 0]
        if unused_indexes:
            total_size = sum(idx.size_mb for idx in unused_indexes)
            recommendations.append(OptimizationRecommendation(
                category="indexes",
                priority="medium",
                title=f"Remove {len(unused_indexes)} unused indexes",
                description=f"Found {len(unused_indexes)} unused indexes consuming {total_size:.1f}MB of storage.",
                sql_statements=[f"DROP INDEX {idx.index_name};" for idx in unused_indexes],
                estimated_impact=f"Recover {total_size:.1f}MB storage and improve write performance",
                implementation_complexity="low",
                risk_level="medium",
                estimated_time_to_implement="10 minutes"
            ))

        # Find indexes that might need rebuilding
        fragmented_indexes = [idx for idx in index_analyses if idx.rebuild_required]
        if fragmented_indexes:
            recommendations.append(OptimizationRecommendation(
                category="indexes",
                priority="low",
                title="Rebuild fragmented indexes",
                description="Some indexes may be fragmented and could benefit from rebuilding.",
                sql_statements=[f"REINDEX INDEX {idx.index_name};" for idx in fragmented_indexes],
                estimated_impact="Improve index performance and reduce fragmentation",
                implementation_complexity="medium",
                risk_level="low",
                estimated_time_to_implement="30 minutes"
            ))

        return recommendations

    def _generate_query_recommendations_list(self, query_analyses: List[QueryAnalysis]) -> List[OptimizationRecommendation]:
        """Generate query optimization recommendations."""
        recommendations = []

        # Find very slow queries
        slow_queries = [q for q in query_analyses if q.avg_exec_time_ms > 1000]
        if slow_queries:
            recommendations.append(OptimizationRecommendation(
                category="queries",
                priority="high",
                title=f"Optimize {len(slow_queries)} slow queries",
                description=f"Found {len(slow_queries)} queries with average execution time >1 second.",
                sql_statements=["-- See detailed query analysis for specific optimizations"],
                estimated_impact="Significant improvement in application response time",
                implementation_complexity="high",
                risk_level="medium",
                estimated_time_to_implement="2-4 hours"
            ))

        # Find queries with high sequential scans
        high_seq_scan_queries = [q for q in query_analyses if q.seq_scans > q.index_scans and q.execution_count > 100]
        if high_seq_scan_queries:
            recommendations.append(OptimizationRecommendation(
                category="queries",
                priority="medium",
                title="Add indexes for high sequential scan queries",
                description=f"Found {len(high_seq_scan_queries)} queries with excessive sequential scans.",
                sql_statements=["-- Create indexes based on query analysis"],
                estimated_impact="Reduce I/O and improve query performance",
                implementation_complexity="medium",
                risk_level="low",
                estimated_time_to_implement="1-2 hours"
            ))

        return recommendations

    def _analyze_tables(self) -> List[OptimizationRecommendation]:
        """Analyze table statistics and optimizations."""
        recommendations = []
        cursor = self.db_connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            # Find tables without primary keys
            cursor.execute("""
                SELECT schemaname, tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename NOT IN (
                    SELECT relname
                    FROM pg_class
                    WHERE relkind = 'r'
                    AND relhasindex = true
                )
            """)
            tables_no_pk = cursor.fetchall()

            if tables_no_pk:
                recommendations.append(OptimizationRecommendation(
                    category="tables",
                    priority="high",
                    title="Add primary keys to tables",
                    description=f"Found {len(tables_no_pk)} tables without primary keys.",
                    sql_statements=[f"-- ALTER TABLE {table['tablename']} ADD PRIMARY KEY (id);" for table in tables_no_pk],
                    estimated_impact="Improve data integrity and query performance",
                    implementation_complexity="high",
                    risk_level="high",
                    estimated_time_to_implement="4-8 hours"
                ))

            # Find tables with high dead tuple percentage
            cursor.execute("""
                SELECT schemaname, tablename, n_dead_tup, n_live_tup,
                       (n_dead_tup::float / NULLIF(n_dead_tup + n_live_tup, 0)) * 100 as dead_tuple_percent
                FROM pg_stat_user_tables
                WHERE schemaname = 'public' AND n_live_tup > 0
                HAVING (n_dead_tup::float / NULLIF(n_dead_tup + n_live_tup, 0)) * 10 > 10
                ORDER BY dead_tuple_percent DESC
            """)
            high_dead_tuple_tables = cursor.fetchall()

            if high_dead_tuple_tables:
                recommendations.append(OptimizationRecommendation(
                    category="tables",
                    priority="medium",
                    title="VACUUM tables with high dead tuple percentage",
                    description=f"Found {len(high_dead_tuple_tables)} tables with >10% dead tuples.",
                    sql_statements=[f"VACUUM ANALYZE {table['tablename']};" for table in high_dead_tuple_tables],
                    estimated_impact="Reclaim storage and improve query performance",
                    implementation_complexity="medium",
                    risk_level="low",
                    estimated_time_to_implement="30 minutes"
                ))

        except Exception as e:
            logger.error(f"Failed to analyze tables: {e}")
        finally:
            cursor.close()

        return recommendations

class DatabaseOptimizer:
    """Main database optimization manager."""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'db-optimizer-config.yaml'
        self.config = self._load_config()
        self.analyzer = DatabaseAnalyzer(self.config['database'])

    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file."""
        config_path = Path(self.config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            # Return default configuration
            return {
                'database': {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': int(os.getenv('DB_PORT', 5432)),
                    'name': os.getenv('DB_NAME', 'quantumbeam'),
                    'username': os.getenv('DB_USER', 'postgres'),
                    'password': os.getenv('DB_PASSWORD')
                },
                'analysis': {
                    'slow_query_threshold_ms': 1000,
                    'unused_index_threshold_days': 30,
                    'dead_tuple_threshold_percent': 10
                },
                'recommendations': {
                    'min_improvement_percent': 10,
                    'max_risk_level': 'medium'
                }
            }

    def run_analysis(self, output_dir: str = './reports') -> str:
        """Run comprehensive database performance analysis."""
        logger.info("Starting database performance analysis")

        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Collect metrics
        metrics = asyncio.run(self.analyzer.collect_database_metrics())

        # Analyze queries
        slow_queries = self.analyzer.analyze_slow_queries()

        # Analyze indexes
        index_analyses = self.analyzer.analyze_indexes()

        # Generate recommendations
        recommendations = self.analyzer.generate_optimization_recommendations()

        # Create comprehensive report
        report = {
            'timestamp': datetime.now().isoformat(),
            'database_metrics': asdict(metrics),
            'slow_queries': [asdict(q) for q in slow_queries[:10]],  # Top 10
            'index_analyses': [asdict(i) for i in index_analyses[:20]],  # Top 20
            'recommendations': [asdict(r) for r in recommendations],
            'summary': {
                'total_recommendations': len(recommendations),
                'high_priority_recommendations': len([r for r in recommendations if r.priority == 'high']),
                'slow_queries_count': len(slow_queries),
                'unused_indexes_count': len([i for i in index_analyses if i.usage_count == 0]),
                'database_size_gb': metrics.database_size_gb,
                'cache_hit_ratio': metrics.cache_hit_ratio
            }
        }

        # Save report
        report_file = output_path / f'db-optimization-report-{timestamp}.json'
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        # Generate visualizations
        self._generate_visualizations(report, output_path, timestamp)

        logger.info(f"Database optimization report generated: {report_file}")
        return str(report_file)

    def _generate_visualizations(self, report: Dict[str, Any], output_path: Path, timestamp: str):
        """Generate performance visualizations."""
        try:
            import matplotlib.pyplot as plt
            import seaborn as sns

            # Set style
            plt.style.use('seaborn-v0_8')
            sns.set_palette("husl")

            # 1. Recommendation Priority Distribution
            if report['recommendations']:
                priorities = [r['priority'] for r in report['recommendations']]
                priority_counts = {p: priorities.count(p) for p in set(priorities)}

                plt.figure(figsize=(10, 6))
                plt.bar(priority_counts.keys(), priority_counts.values())
                plt.title('Database Optimization Recommendations by Priority')
                plt.xlabel('Priority')
                plt.ylabel('Count')
                plt.tight_layout()
                plt.savefig(output_path / f'recommendation-priorities-{timestamp}.png')
                plt.close()

            # 2. Slow Query Execution Times
            if report['slow_queries']:
                queries = report['slow_queries'][:10]
                query_names = [f"Q{i+1}" for i in range(len(queries))]
                avg_times = [q['avg_exec_time_ms'] for q in queries]

                plt.figure(figsize=(12, 6))
                bars = plt.bar(query_names, avg_times)
                plt.title('Top 10 Slow Queries - Average Execution Time')
                plt.xlabel('Query')
                plt.ylabel('Execution Time (ms)')
                plt.xticks(rotation=45)

                # Add value labels on bars
                for bar in bars:
                    height = bar.get_height()
                    plt.text(bar.get_x() + bar.get_width()/2., height,
                           f'{height:.1f}ms', ha='center', va='bottom')

                plt.tight_layout()
                plt.savefig(output_path / f'slow-queries-{timestamp}.png')
                plt.close()

            # 3. Index Usage Distribution
            if report['index_analyses']:
                indexes = report['index_analyses'][:20]
                usage_counts = [i['usage_count'] for i in indexes]
                index_names = [i['index_name'][:15] + "..." if len(i['index_name']) > 15 else i['index_name'] for i in indexes]

                plt.figure(figsize=(14, 8))
                bars = plt.barh(index_names, usage_counts)
                plt.title('Top 20 Index Usage Counts')
                plt.xlabel('Usage Count')
                plt.ylabel('Index Name')
                plt.tight_layout()
                plt.savefig(output_path / f'index-usage-{timestamp}.png')
                plt.close()

            logger.info("Performance visualizations generated")

        except ImportError:
            logger.warning("Matplotlib not available for visualizations")
        except Exception as e:
            logger.error(f"Failed to generate visualizations: {e}")

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Database Performance Optimizer')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--output-dir', default='./reports', help='Output directory for reports')
    parser.add_argument('--analyze-only', action='store_true', help='Run analysis without optimizations')

    args = parser.parse_args()

    try:
        optimizer = DatabaseOptimizer(args.config)
        report_file = optimizer.run_analysis(args.output_dir)
        print(f"Database optimization report generated: {report_file}")

        if not args.analyze_only:
            print("To apply optimizations, review the report and execute the recommended SQL statements manually.")

    except Exception as e:
        logger.error(f"Database optimization failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()