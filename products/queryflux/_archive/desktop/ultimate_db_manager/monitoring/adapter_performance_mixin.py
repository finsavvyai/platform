#!/usr/bin/env python3
"""
Database Adapter Performance Tracking Mixin
Adds performance monitoring capabilities to database adapters
"""

import time
from datetime import datetime
from typing import Dict, Any, Optional
from functools import wraps
import logging

from .performance_metrics import (
    get_performance_metrics_collector,
    QueryMetric,
    ConnectionMetric,
    ResourceMetric,
    DatabaseMetric
)

logger = logging.getLogger(__name__)

class PerformanceTrackingMixin:
    """Mixin to add performance tracking to database adapters"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.metrics_collector = get_performance_metrics_collector()
        self.connection_start_time = None
        self.query_count = 0
        self.total_query_time = 0.0
        self._performance_enabled = True
    
    def enable_performance_tracking(self):
        """Enable performance tracking"""
        self._performance_enabled = True
        logger.debug(f"Performance tracking enabled for {self.__class__.__name__}")
    
    def disable_performance_tracking(self):
        """Disable performance tracking"""
        self._performance_enabled = False
        logger.debug(f"Performance tracking disabled for {self.__class__.__name__}")
    
    def connect(self, connection_params, **kwargs):
        """Override connect to track connection performance"""
        if not self._performance_enabled:
            return super().connect(connection_params, **kwargs)
        
        self.connection_start_time = time.time()
        start_timestamp = datetime.now()
        
        try:
            result = super().connect(connection_params, **kwargs)
            
            if result:
                connection_time = time.time() - self.connection_start_time
                
                # Record connection metric
                metric = ConnectionMetric(
                    connection_id=getattr(self, 'connection_id', 'unknown'),
                    database_type=self.__class__.__name__.replace('Adapter', '').lower(),
                    connection_time=connection_time,
                    active_queries=0,
                    total_queries=0,
                    avg_query_time=0.0,
                    timestamp=start_timestamp,
                    status='connected',
                    metadata={
                        'host': getattr(connection_params, 'host', 'unknown'),
                        'port': getattr(connection_params, 'port', 'unknown'),
                        'database': getattr(connection_params, 'database', 'unknown')
                    }
                )
                
                self.metrics_collector.record_connection_metric(metric)
                logger.debug(f"Connection established in {connection_time:.3f}s")
            
            return result
            
        except Exception as e:
            connection_time = time.time() - self.connection_start_time
            logger.error(f"Connection failed after {connection_time:.3f}s: {e}")
            raise
    
    def execute_query(self, query: str, params=None, **kwargs):
        """Override execute_query to track performance"""
        if not self._performance_enabled:
            return super().execute_query(query, params, **kwargs)
        
        connection_id = getattr(self, 'connection_id', 'unknown')
        query_id = f"query_{int(time.time() * 1000000)}"
        start_time = time.time()
        start_timestamp = datetime.now()
        
        try:
            result = super().execute_query(query, params, **kwargs)
            
            execution_time = time.time() - start_time
            self.query_count += 1
            self.total_query_time += execution_time
            
            # Create and record the successful query metric
            rows_affected = getattr(result, 'row_count', 0) if result else 0
            query_plan = getattr(result, 'query_plan', None) if result else None
            
            metric = QueryMetric(
                query_id=query_id,
                connection_id=connection_id,
                query_text=query[:500],  # Truncate long queries
                execution_time=execution_time,
                rows_affected=rows_affected,
                timestamp=start_timestamp,
                success=True,
                query_plan=query_plan
            )
            
            self.metrics_collector.record_query_metric(metric)
            
            # Update connection metrics
            self._update_connection_metrics()
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            # Create and record the failed query metric
            metric = QueryMetric(
                query_id=query_id,
                connection_id=connection_id,
                query_text=query[:500],
                execution_time=execution_time,
                rows_affected=0,
                timestamp=start_timestamp,
                success=False,
                error_message=str(e)
            )
            
            self.metrics_collector.record_query_metric(metric)
            
            logger.error(f"Query failed after {execution_time:.3f}s: {e}")
            raise
    
    def _update_connection_metrics(self):
        """Update connection performance metrics"""
        if not self._performance_enabled or self.query_count == 0:
            return
        
        avg_query_time = self.total_query_time / self.query_count
        
        metric = ConnectionMetric(
            connection_id=getattr(self, 'connection_id', 'unknown'),
            database_type=self.__class__.__name__.replace('Adapter', '').lower(),
            connection_time=0.0,  # Not relevant for updates
            active_queries=0,  # Would need to track this separately
            total_queries=self.query_count,
            avg_query_time=avg_query_time,
            timestamp=datetime.now(),
            status='active',
            metadata={
                'total_query_time': self.total_query_time,
                'last_query_time': datetime.now().isoformat()
            }
        )
        
        self.metrics_collector.record_connection_metric(metric)
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get database-specific performance metrics"""
        if not self._performance_enabled:
            return {}
        
        base_metrics = {
            'query_count': self.query_count,
            'total_query_time': self.total_query_time,
            'avg_query_time': self.total_query_time / self.query_count if self.query_count > 0 else 0,
            'connection_uptime': time.time() - self.connection_start_time if self.connection_start_time else 0
        }
        
        # Add database-specific metrics
        try:
            db_specific_metrics = self._get_database_specific_metrics()
            base_metrics.update(db_specific_metrics)
        except Exception as e:
            logger.error(f"Error getting database-specific metrics: {e}")
        
        return base_metrics
    
    def _get_database_specific_metrics(self) -> Dict[str, Any]:
        """Override in subclasses to provide database-specific metrics"""
        return {}

class PostgreSQLPerformanceMixin(PerformanceTrackingMixin):
    """PostgreSQL-specific performance tracking"""
    
    def _get_database_specific_metrics(self) -> Dict[str, Any]:
        """Get PostgreSQL-specific performance metrics"""
        if not self.is_connected():
            return {}
        
        metrics = {}
        
        try:
            # Active connections
            result = self.execute_raw_query(
                "SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'"
            )
            if result and result.data:
                metrics['active_connections'] = result.data[0]['active_connections']
            
            # Database size
            result = self.execute_raw_query(
                "SELECT pg_database_size(current_database()) as db_size"
            )
            if result and result.data:
                metrics['database_size'] = result.data[0]['db_size']
            
            # Cache hit ratio
            result = self.execute_raw_query("""
                SELECT round(
                    (blks_hit * 100.0) / nullif(blks_hit + blks_read, 0), 2
                ) as cache_hit_ratio
                FROM pg_stat_database
                WHERE datname = current_database()
            """)
            if result and result.data and result.data[0]['cache_hit_ratio'] is not None:
                metrics['cache_hit_ratio'] = result.data[0]['cache_hit_ratio']
            
            # Table count
            result = self.execute_raw_query("""
                SELECT count(*) as table_count
                FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            if result and result.data:
                metrics['table_count'] = result.data[0]['table_count']
            
            # Index count
            result = self.execute_raw_query("""
                SELECT count(*) as index_count
                FROM pg_indexes
                WHERE schemaname = 'public'
            """)
            if result and result.data:
                metrics['index_count'] = result.data[0]['index_count']
            
        except Exception as e:
            logger.error(f"Error collecting PostgreSQL metrics: {e}")
        
        return metrics

class MySQLPerformanceMixin(PerformanceTrackingMixin):
    """MySQL-specific performance tracking"""
    
    def _get_database_specific_metrics(self) -> Dict[str, Any]:
        """Get MySQL-specific performance metrics"""
        if not self.is_connected():
            return {}
        
        metrics = {}
        
        try:
            # Active connections
            result = self.execute_raw_query("SHOW STATUS LIKE 'Threads_connected'")
            if result and result.data:
                metrics['active_connections'] = int(result.data[0]['Value'])
            
            # Database size
            result = self.execute_raw_query("""
                SELECT SUM(data_length + index_length) as db_size
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
            """)
            if result and result.data and result.data[0]['db_size']:
                metrics['database_size'] = result.data[0]['db_size']
            
            # Query cache hit ratio
            result = self.execute_raw_query("""
                SHOW STATUS WHERE Variable_name IN ('Qcache_hits', 'Qcache_inserts', 'Qcache_not_cached')
            """)
            if result and result.data:
                qcache_data = {row['Variable_name']: int(row['Value']) for row in result.data}
                total_queries = qcache_data.get('Qcache_hits', 0) + qcache_data.get('Qcache_inserts', 0) + qcache_data.get('Qcache_not_cached', 0)
                if total_queries > 0:
                    metrics['cache_hit_ratio'] = (qcache_data.get('Qcache_hits', 0) / total_queries) * 100
            
            # Table count
            result = self.execute_raw_query("""
                SELECT count(*) as table_count
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
            """)
            if result and result.data:
                metrics['table_count'] = result.data[0]['table_count']
            
        except Exception as e:
            logger.error(f"Error collecting MySQL metrics: {e}")
        
        return metrics

class MongoDBPerformanceMixin(PerformanceTrackingMixin):
    """MongoDB-specific performance tracking"""
    
    def _get_database_specific_metrics(self) -> Dict[str, Any]:
        """Get MongoDB-specific performance metrics"""
        if not self.is_connected():
            return {}
        
        metrics = {}
        
        try:
            # Database stats
            db_stats = self.client[self.database_name].command("dbStats")
            metrics['database_size'] = db_stats.get('dataSize', 0)
            metrics['collection_count'] = db_stats.get('collections', 0)
            metrics['index_count'] = db_stats.get('indexes', 0)
            
            # Server status
            server_status = self.client.admin.command("serverStatus")
            
            # Connection metrics
            connections = server_status.get('connections', {})
            metrics['active_connections'] = connections.get('current', 0)
            metrics['total_connections'] = connections.get('totalCreated', 0)
            
            # Operation counters
            opcounters = server_status.get('opcounters', {})
            metrics['queries_per_second'] = opcounters.get('query', 0)
            metrics['inserts_per_second'] = opcounters.get('insert', 0)
            metrics['updates_per_second'] = opcounters.get('update', 0)
            metrics['deletes_per_second'] = opcounters.get('delete', 0)
            
        except Exception as e:
            logger.error(f"Error collecting MongoDB metrics: {e}")
        
        return metrics

class RedisPerformanceMixin(PerformanceTrackingMixin):
    """Redis-specific performance tracking"""
    
    def _get_database_specific_metrics(self) -> Dict[str, Any]:
        """Get Redis-specific performance metrics"""
        if not self.is_connected():
            return {}
        
        metrics = {}
        
        try:
            # Redis INFO command
            info = self.client.info()
            
            # Memory metrics
            metrics['memory_usage'] = info.get('used_memory', 0)
            metrics['memory_peak'] = info.get('used_memory_peak', 0)
            
            # Connection metrics
            metrics['active_connections'] = info.get('connected_clients', 0)
            metrics['total_connections'] = info.get('total_connections_received', 0)
            
            # Key metrics
            metrics['total_keys'] = sum(info.get(f'db{i}', {}).get('keys', 0) for i in range(16))
            
            # Performance metrics
            metrics['operations_per_second'] = info.get('instantaneous_ops_per_sec', 0)
            metrics['keyspace_hits'] = info.get('keyspace_hits', 0)
            metrics['keyspace_misses'] = info.get('keyspace_misses', 0)
            
            # Calculate hit ratio
            hits = metrics['keyspace_hits']
            misses = metrics['keyspace_misses']
            if hits + misses > 0:
                metrics['cache_hit_ratio'] = (hits / (hits + misses)) * 100
            
        except Exception as e:
            logger.error(f"Error collecting Redis metrics: {e}")
        
        return metrics

def performance_tracked(func):
    """Decorator to add performance tracking to methods"""
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        if not hasattr(self, '_performance_enabled') or not self._performance_enabled:
            return func(self, *args, **kwargs)
        
        start_time = time.time()
        try:
            result = func(self, *args, **kwargs)
            execution_time = time.time() - start_time
            
            # Log slow operations
            if execution_time > 1.0:  # Log operations slower than 1 second
                logger.warning(f"Slow operation {func.__name__}: {execution_time:.3f}s")
            
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Operation {func.__name__} failed after {execution_time:.3f}s: {e}")
            raise
    
    return wrapper

__all__ = [
    'PerformanceTrackingMixin',
    'PostgreSQLPerformanceMixin',
    'MySQLPerformanceMixin',
    'MongoDBPerformanceMixin',
    'RedisPerformanceMixin',
    'performance_tracked'
]