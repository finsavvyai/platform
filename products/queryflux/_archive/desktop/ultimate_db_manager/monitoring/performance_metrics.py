#!/usr/bin/env python3
"""
Performance Metrics Collection System
Tracks query execution times, connection performance, and database resource usage
"""

import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from collections import defaultdict, deque
from enum import Enum
import statistics
import logging
import psutil
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class MetricCategory(Enum):
    QUERY_PERFORMANCE = "query_performance"
    CONNECTION_PERFORMANCE = "connection_performance"
    RESOURCE_USAGE = "resource_usage"
    DATABASE_STATS = "database_stats"

@dataclass
class QueryMetric:
    """Query execution performance metric"""
    query_id: str
    connection_id: str
    query_text: str
    execution_time: float
    rows_affected: int
    timestamp: datetime
    success: bool
    error_message: Optional[str] = None
    query_plan: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ConnectionMetric:
    """Connection performance metric"""
    connection_id: str
    database_type: str
    connection_time: float
    active_queries: int
    total_queries: int
    avg_query_time: float
    timestamp: datetime
    status: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ResourceMetric:
    """System resource usage metric"""
    connection_id: str
    cpu_usage: float
    memory_usage: float
    disk_io_read: float
    disk_io_write: float
    network_io_sent: float
    network_io_received: float
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class DatabaseMetric:
    """Database-specific performance metric"""
    connection_id: str
    database_type: str
    metric_name: str
    metric_value: float
    unit: str
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

class PerformanceMetricsCollector:
    """Collects and manages performance metrics"""
    
    def __init__(self, max_metrics: int = 10000):
        self.max_metrics = max_metrics
        self.query_metrics = deque(maxlen=max_metrics)
        self.connection_metrics = deque(maxlen=max_metrics)
        self.resource_metrics = deque(maxlen=max_metrics)
        self.database_metrics = deque(maxlen=max_metrics)
        
        # Thread-safe locks
        self._query_lock = threading.Lock()
        self._connection_lock = threading.Lock()
        self._resource_lock = threading.Lock()
        self._database_lock = threading.Lock()
        
        # Callbacks for real-time notifications
        self.metric_callbacks: List[Callable] = []
        
        # Performance thresholds
        self.thresholds = {
            'slow_query_time': 1.0,  # seconds
            'very_slow_query_time': 5.0,  # seconds
            'high_cpu_usage': 80.0,  # percent
            'high_memory_usage': 85.0,  # percent
            'connection_timeout': 30.0,  # seconds
        }
        
        logger.info("📊 Performance metrics collector initialized")
    
    def add_metric_callback(self, callback: Callable):
        """Add callback for real-time metric notifications"""
        self.metric_callbacks.append(callback)
    
    def remove_metric_callback(self, callback: Callable):
        """Remove metric callback"""
        if callback in self.metric_callbacks:
            self.metric_callbacks.remove(callback)
    
    def _notify_callbacks(self, metric_type: str, metric: Any):
        """Notify all callbacks of new metric"""
        for callback in self.metric_callbacks:
            try:
                callback(metric_type, metric)
            except Exception as e:
                logger.error(f"Error in metric callback: {e}")
    
    @contextmanager
    def track_query_performance(self, connection_id: str, query_text: str):
        """Context manager to track query execution performance"""
        query_id = f"query_{int(time.time() * 1000000)}"
        start_time = time.time()
        start_timestamp = datetime.now()
        
        try:
            yield query_id
            # Query succeeded
            execution_time = time.time() - start_time
            
            metric = QueryMetric(
                query_id=query_id,
                connection_id=connection_id,
                query_text=query_text[:500],  # Truncate long queries
                execution_time=execution_time,
                rows_affected=0,  # Will be updated by caller if needed
                timestamp=start_timestamp,
                success=True
            )
            
            self.record_query_metric(metric)
            
        except Exception as e:
            # Query failed
            execution_time = time.time() - start_time
            
            metric = QueryMetric(
                query_id=query_id,
                connection_id=connection_id,
                query_text=query_text[:500],
                execution_time=execution_time,
                rows_affected=0,
                timestamp=start_timestamp,
                success=False,
                error_message=str(e)
            )
            
            self.record_query_metric(metric)
            raise
    
    def record_query_metric(self, metric: QueryMetric):
        """Record a query performance metric"""
        with self._query_lock:
            self.query_metrics.append(metric)
        
        # Check for performance issues
        if metric.execution_time > self.thresholds['very_slow_query_time']:
            logger.warning(f"Very slow query detected: {metric.execution_time:.2f}s - {metric.query_text[:100]}")
        elif metric.execution_time > self.thresholds['slow_query_time']:
            logger.info(f"Slow query detected: {metric.execution_time:.2f}s - {metric.query_text[:100]}")
        
        self._notify_callbacks('query', metric)
    
    def record_connection_metric(self, metric: ConnectionMetric):
        """Record a connection performance metric"""
        with self._connection_lock:
            self.connection_metrics.append(metric)
        
        # Check for connection issues
        if metric.connection_time > self.thresholds['connection_timeout']:
            logger.warning(f"Slow connection detected: {metric.connection_time:.2f}s for {metric.connection_id}")
        
        self._notify_callbacks('connection', metric)
    
    def record_resource_metric(self, metric: ResourceMetric):
        """Record a resource usage metric"""
        with self._resource_lock:
            self.resource_metrics.append(metric)
        
        # Check for resource issues
        if metric.cpu_usage > self.thresholds['high_cpu_usage']:
            logger.warning(f"High CPU usage detected: {metric.cpu_usage:.1f}% for {metric.connection_id}")
        
        if metric.memory_usage > self.thresholds['high_memory_usage']:
            logger.warning(f"High memory usage detected: {metric.memory_usage:.1f}% for {metric.connection_id}")
        
        self._notify_callbacks('resource', metric)
    
    def record_database_metric(self, metric: DatabaseMetric):
        """Record a database-specific metric"""
        with self._database_lock:
            self.database_metrics.append(metric)
        
        self._notify_callbacks('database', metric)
    
    def get_query_performance_stats(self, connection_id: Optional[str] = None, 
                                  hours: int = 1) -> Dict[str, Any]:
        """Get query performance statistics"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._query_lock:
            filtered_metrics = [
                m for m in self.query_metrics
                if m.timestamp >= cutoff_time and (
                    connection_id is None or m.connection_id == connection_id
                )
            ]
        
        if not filtered_metrics:
            return {"message": "No query metrics found for the specified period"}
        
        # Calculate statistics
        execution_times = [m.execution_time for m in filtered_metrics]
        successful_queries = [m for m in filtered_metrics if m.success]
        failed_queries = [m for m in filtered_metrics if not m.success]
        
        stats = {
            "total_queries": len(filtered_metrics),
            "successful_queries": len(successful_queries),
            "failed_queries": len(failed_queries),
            "success_rate": len(successful_queries) / len(filtered_metrics) * 100,
            "execution_time": {
                "min": min(execution_times),
                "max": max(execution_times),
                "avg": statistics.mean(execution_times),
                "median": statistics.median(execution_times),
                "p95": self._percentile(execution_times, 95),
                "p99": self._percentile(execution_times, 99)
            },
            "slow_queries": len([m for m in filtered_metrics if m.execution_time > self.thresholds['slow_query_time']]),
            "very_slow_queries": len([m for m in filtered_metrics if m.execution_time > self.thresholds['very_slow_query_time']]),
            "period_hours": hours,
            "connection_id": connection_id
        }
        
        return stats
    
    def get_connection_performance_stats(self, connection_id: Optional[str] = None,
                                       hours: int = 1) -> Dict[str, Any]:
        """Get connection performance statistics"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._connection_lock:
            filtered_metrics = [
                m for m in self.connection_metrics
                if m.timestamp >= cutoff_time and (
                    connection_id is None or m.connection_id == connection_id
                )
            ]
        
        if not filtered_metrics:
            return {"message": "No connection metrics found for the specified period"}
        
        # Get latest metrics per connection
        latest_metrics = {}
        for metric in filtered_metrics:
            if metric.connection_id not in latest_metrics or metric.timestamp > latest_metrics[metric.connection_id].timestamp:
                latest_metrics[metric.connection_id] = metric
        
        stats = {
            "active_connections": len(latest_metrics),
            "total_queries": sum(m.total_queries for m in latest_metrics.values()),
            "avg_query_time": statistics.mean([m.avg_query_time for m in latest_metrics.values()]) if latest_metrics else 0,
            "connections": {
                conn_id: {
                    "database_type": metric.database_type,
                    "status": metric.status,
                    "active_queries": metric.active_queries,
                    "total_queries": metric.total_queries,
                    "avg_query_time": metric.avg_query_time,
                    "connection_time": metric.connection_time
                }
                for conn_id, metric in latest_metrics.items()
            },
            "period_hours": hours
        }
        
        return stats
    
    def get_resource_usage_stats(self, connection_id: Optional[str] = None,
                               hours: int = 1) -> Dict[str, Any]:
        """Get resource usage statistics"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._resource_lock:
            filtered_metrics = [
                m for m in self.resource_metrics
                if m.timestamp >= cutoff_time and (
                    connection_id is None or m.connection_id == connection_id
                )
            ]
        
        if not filtered_metrics:
            return {"message": "No resource metrics found for the specified period"}
        
        # Calculate statistics for each resource type
        cpu_usage = [m.cpu_usage for m in filtered_metrics]
        memory_usage = [m.memory_usage for m in filtered_metrics]
        disk_read = [m.disk_io_read for m in filtered_metrics]
        disk_write = [m.disk_io_write for m in filtered_metrics]
        network_sent = [m.network_io_sent for m in filtered_metrics]
        network_received = [m.network_io_received for m in filtered_metrics]
        
        stats = {
            "cpu_usage": {
                "min": min(cpu_usage),
                "max": max(cpu_usage),
                "avg": statistics.mean(cpu_usage),
                "current": cpu_usage[-1] if cpu_usage else 0
            },
            "memory_usage": {
                "min": min(memory_usage),
                "max": max(memory_usage),
                "avg": statistics.mean(memory_usage),
                "current": memory_usage[-1] if memory_usage else 0
            },
            "disk_io": {
                "read_avg": statistics.mean(disk_read),
                "write_avg": statistics.mean(disk_write),
                "read_total": sum(disk_read),
                "write_total": sum(disk_write)
            },
            "network_io": {
                "sent_avg": statistics.mean(network_sent),
                "received_avg": statistics.mean(network_received),
                "sent_total": sum(network_sent),
                "received_total": sum(network_received)
            },
            "data_points": len(filtered_metrics),
            "period_hours": hours,
            "connection_id": connection_id
        }
        
        return stats
    
    def get_database_metrics_stats(self, connection_id: Optional[str] = None,
                                 metric_name: Optional[str] = None,
                                 hours: int = 1) -> Dict[str, Any]:
        """Get database-specific metrics statistics"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._database_lock:
            filtered_metrics = [
                m for m in self.database_metrics
                if m.timestamp >= cutoff_time and (
                    connection_id is None or m.connection_id == connection_id
                ) and (
                    metric_name is None or m.metric_name == metric_name
                )
            ]
        
        if not filtered_metrics:
            return {"message": "No database metrics found for the specified period"}
        
        # Group by metric name
        metrics_by_name = defaultdict(list)
        for metric in filtered_metrics:
            metrics_by_name[metric.metric_name].append(metric.metric_value)
        
        stats = {}
        for name, values in metrics_by_name.items():
            stats[name] = {
                "count": len(values),
                "min": min(values),
                "max": max(values),
                "avg": statistics.mean(values),
                "median": statistics.median(values),
                "latest": values[-1] if values else 0,
                "unit": filtered_metrics[-1].unit if filtered_metrics else ""
            }
        
        return {
            "metrics": stats,
            "period_hours": hours,
            "connection_id": connection_id,
            "metric_name": metric_name
        }
    
    def get_slowest_queries(self, connection_id: Optional[str] = None,
                          hours: int = 24, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the slowest queries"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._query_lock:
            filtered_metrics = [
                m for m in self.query_metrics
                if m.timestamp >= cutoff_time and m.success and (
                    connection_id is None or m.connection_id == connection_id
                )
            ]
        
        # Sort by execution time and get top N
        slowest = sorted(filtered_metrics, key=lambda x: x.execution_time, reverse=True)[:limit]
        
        return [
            {
                "query_id": m.query_id,
                "connection_id": m.connection_id,
                "query_text": m.query_text,
                "execution_time": m.execution_time,
                "timestamp": m.timestamp.isoformat(),
                "rows_affected": m.rows_affected
            }
            for m in slowest
        ]
    
    def clear_old_metrics(self, hours: int = 24):
        """Clear metrics older than specified hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        with self._query_lock:
            self.query_metrics = deque(
                (m for m in self.query_metrics if m.timestamp >= cutoff_time),
                maxlen=self.max_metrics
            )
        
        with self._connection_lock:
            self.connection_metrics = deque(
                (m for m in self.connection_metrics if m.timestamp >= cutoff_time),
                maxlen=self.max_metrics
            )
        
        with self._resource_lock:
            self.resource_metrics = deque(
                (m for m in self.resource_metrics if m.timestamp >= cutoff_time),
                maxlen=self.max_metrics
            )
        
        with self._database_lock:
            self.database_metrics = deque(
                (m for m in self.database_metrics if m.timestamp >= cutoff_time),
                maxlen=self.max_metrics
            )
        
        logger.info(f"Cleared metrics older than {hours} hours")
    
    def _percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile of data"""
        if not data:
            return 0.0
        
        sorted_data = sorted(data)
        index = (percentile / 100) * (len(sorted_data) - 1)
        
        if index.is_integer():
            return sorted_data[int(index)]
        else:
            lower = sorted_data[int(index)]
            upper = sorted_data[int(index) + 1]
            return lower + (upper - lower) * (index - int(index))

class DatabaseResourceMonitor:
    """Monitors database-specific resource usage"""
    
    def __init__(self, metrics_collector: PerformanceMetricsCollector):
        self.metrics_collector = metrics_collector
        self.monitoring = False
        self.monitor_thread = None
        
    def start_monitoring(self, connection_manager, interval: int = 30):
        """Start monitoring database resources"""
        if self.monitoring:
            return
        
        self.monitoring = True
        self.monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(connection_manager, interval),
            daemon=True
        )
        self.monitor_thread.start()
        logger.info("🔍 Database resource monitoring started")
    
    def stop_monitoring(self):
        """Stop monitoring database resources"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("⏹️ Database resource monitoring stopped")
    
    def _monitor_loop(self, connection_manager, interval: int):
        """Main monitoring loop"""
        while self.monitoring:
            try:
                # Monitor system resources
                self._collect_system_metrics()
                
                # Monitor each database connection
                for connection_id in connection_manager.list_connections():
                    self._collect_connection_metrics(connection_manager, connection_id)
                
                time.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in resource monitoring loop: {e}")
                time.sleep(interval * 2)  # Wait longer on error
    
    def _collect_system_metrics(self):
        """Collect system-level resource metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            
            # Disk I/O
            disk_io = psutil.disk_io_counters()
            
            # Network I/O
            network_io = psutil.net_io_counters()
            
            metric = ResourceMetric(
                connection_id="system",
                cpu_usage=cpu_percent,
                memory_usage=memory.percent,
                disk_io_read=disk_io.read_bytes if disk_io else 0,
                disk_io_write=disk_io.write_bytes if disk_io else 0,
                network_io_sent=network_io.bytes_sent if network_io else 0,
                network_io_received=network_io.bytes_recv if network_io else 0,
                timestamp=datetime.now(),
                metadata={
                    "cpu_count": psutil.cpu_count(),
                    "memory_total_gb": round(memory.total / 1024**3, 2),
                    "memory_available_gb": round(memory.available / 1024**3, 2)
                }
            )
            
            self.metrics_collector.record_resource_metric(metric)
            
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
    
    def _collect_connection_metrics(self, connection_manager, connection_id: str):
        """Collect metrics for a specific database connection"""
        try:
            adapter = connection_manager.get_connection(connection_id)
            if not adapter or not adapter.is_connected():
                return
            
            # Get connection info
            connection_info = adapter.get_connection_info()
            
            # Collect database-specific metrics based on database type
            if hasattr(adapter, 'get_performance_metrics'):
                db_metrics = adapter.get_performance_metrics()
                
                for metric_name, metric_value in db_metrics.items():
                    if isinstance(metric_value, (int, float)):
                        db_metric = DatabaseMetric(
                            connection_id=connection_id,
                            database_type=connection_info.get('database_type', 'unknown'),
                            metric_name=metric_name,
                            metric_value=float(metric_value),
                            unit=self._get_metric_unit(metric_name),
                            timestamp=datetime.now()
                        )
                        self.metrics_collector.record_database_metric(db_metric)
            
        except Exception as e:
            logger.error(f"Error collecting metrics for connection {connection_id}: {e}")
    
    def _get_metric_unit(self, metric_name: str) -> str:
        """Get appropriate unit for metric name"""
        unit_mapping = {
            'active_connections': 'count',
            'total_connections': 'count',
            'cache_hit_ratio': 'percent',
            'buffer_hit_ratio': 'percent',
            'database_size': 'bytes',
            'table_count': 'count',
            'index_count': 'count',
            'query_time': 'milliseconds',
            'lock_waits': 'count',
            'deadlocks': 'count',
            'transactions_per_second': 'tps',
            'queries_per_second': 'qps'
        }
        
        return unit_mapping.get(metric_name, 'value')

# Global instance
_performance_metrics_collector = None

def get_performance_metrics_collector() -> PerformanceMetricsCollector:
    """Get the global performance metrics collector instance"""
    global _performance_metrics_collector
    if _performance_metrics_collector is None:
        _performance_metrics_collector = PerformanceMetricsCollector()
    return _performance_metrics_collector

__all__ = [
    'PerformanceMetricsCollector',
    'DatabaseResourceMonitor',
    'QueryMetric',
    'ConnectionMetric',
    'ResourceMetric',
    'DatabaseMetric',
    'MetricCategory',
    'get_performance_metrics_collector'
]