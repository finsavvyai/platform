#!/usr/bin/env python3
"""
Real-Time Performance Dashboard
Advanced monitoring and analytics with AI-powered insights
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, AsyncGenerator
from dataclasses import dataclass, asdict
from enum import Enum
import statistics
from collections import defaultdict, deque
import psutil
import logging

logger = logging.getLogger(__name__)

class MetricType(Enum):
    PERFORMANCE = "performance"
    SECURITY = "security"
    USAGE = "usage"
    ERROR = "error"
    ALERT = "alert"

class AlertLevel(Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

@dataclass
class Metric:
    """Real-time metric data point"""
    timestamp: datetime
    connection_id: str
    metric_type: MetricType
    name: str
    value: float
    unit: str
    metadata: Dict[str, Any]

@dataclass
class Alert:
    """System alert"""
    id: str
    level: AlertLevel
    title: str
    message: str
    timestamp: datetime
    connection_id: Optional[str]
    resolved: bool = False

@dataclass
class PerformanceInsight:
    """AI-generated performance insight"""
    type: str
    severity: str
    title: str
    description: str
    recommendation: str
    impact: str
    timestamp: datetime

class RealTimeMonitor:
    """Real-time database performance monitor"""

    def __init__(self, db_manager):
        self.db_manager = db_manager
        self.metrics_buffer = deque(maxlen=10000)  # Keep last 10k metrics
        self.alerts = deque(maxlen=1000)  # Keep last 1k alerts
        self.subscribers = set()  # WebSocket subscribers
        self.monitoring = False
        self.alert_rules = {}
        self.baseline_metrics = {}

        # Performance thresholds
        self.thresholds = {
            'query_time': {'warning': 1.0, 'critical': 5.0},
            'connection_count': {'warning': 80, 'critical': 95},
            'cpu_usage': {'warning': 70.0, 'critical': 90.0},
            'memory_usage': {'warning': 80.0, 'critical': 95.0},
            'disk_usage': {'warning': 85.0, 'critical': 95.0},
            'error_rate': {'warning': 0.05, 'critical': 0.10}  # 5% and 10%
        }

        logger.info("🔍 Real-time monitor initialized")

    async def start_monitoring(self):
        """Start real-time monitoring"""
        if self.monitoring:
            return

        self.monitoring = True
        logger.info("📊 Starting real-time monitoring...")

        # Start monitoring tasks
        tasks = [
            self.monitor_system_metrics(),
            self.monitor_database_metrics(),
            self.monitor_query_performance(),
            self.analyze_patterns(),
            self.process_alerts()
        ]

        await asyncio.gather(*tasks, return_exceptions=True)

    async def stop_monitoring(self):
        """Stop real-time monitoring"""
        self.monitoring = False
        logger.info("⏹️ Real-time monitoring stopped")

    async def monitor_system_metrics(self):
        """Monitor system-level metrics"""
        while self.monitoring:
            try:
                # CPU usage
                cpu_percent = psutil.cpu_percent(interval=1)
                await self.record_metric(
                    connection_id="system",
                    metric_type=MetricType.PERFORMANCE,
                    name="cpu_usage",
                    value=cpu_percent,
                    unit="percent",
                    metadata={"cores": psutil.cpu_count()}
                )

                # Memory usage
                memory = psutil.virtual_memory()
                await self.record_metric(
                    connection_id="system",
                    metric_type=MetricType.PERFORMANCE,
                    name="memory_usage",
                    value=memory.percent,
                    unit="percent",
                    metadata={"total_gb": round(memory.total / 1024**3, 2)}
                )

                # Disk usage
                disk = psutil.disk_usage('/')
                await self.record_metric(
                    connection_id="system",
                    metric_type=MetricType.PERFORMANCE,
                    name="disk_usage",
                    value=(disk.used / disk.total) * 100,
                    unit="percent",
                    metadata={"total_gb": round(disk.total / 1024**3, 2)}
                )

                # Network I/O
                net_io = psutil.net_io_counters()
                await self.record_metric(
                    connection_id="system",
                    metric_type=MetricType.USAGE,
                    name="network_bytes_sent",
                    value=net_io.bytes_sent,
                    unit="bytes",
                    metadata={"packets_sent": net_io.packets_sent}
                )

                await asyncio.sleep(5)  # Check every 5 seconds

            except Exception as e:
                logger.error(f"System monitoring error: {e}")
                await asyncio.sleep(10)

    async def monitor_database_metrics(self):
        """Monitor database-specific metrics"""
        while self.monitoring:
            try:
                for connection_id in self.db_manager.list_connections():
                    await self.collect_db_metrics(connection_id)

                await asyncio.sleep(10)  # Check every 10 seconds

            except Exception as e:
                logger.error(f"Database monitoring error: {e}")
                await asyncio.sleep(15)

    async def collect_db_metrics(self, connection_id: str):
        """Collect metrics for a specific database connection"""
        try:
            # Connection count
            connection_query = """
            SELECT count(*) as active_connections
            FROM pg_stat_activity
            WHERE state = 'active'
            """

            result = self.db_manager.execute_query(
                connection_id, connection_query,
                allowed_operations={'SELECT'}
            )

            if result.data:
                await self.record_metric(
                    connection_id=connection_id,
                    metric_type=MetricType.PERFORMANCE,
                    name="active_connections",
                    value=result.data[0]['active_connections'],
                    unit="count",
                    metadata={"execution_time": result.execution_time}
                )

            # Database size
            size_query = """
            SELECT pg_size_pretty(pg_database_size(current_database())) as db_size,
                   pg_database_size(current_database()) as db_size_bytes
            """

            result = self.db_manager.execute_query(
                connection_id, size_query,
                allowed_operations={'SELECT'}
            )

            if result.data:
                await self.record_metric(
                    connection_id=connection_id,
                    metric_type=MetricType.USAGE,
                    name="database_size",
                    value=result.data[0]['db_size_bytes'],
                    unit="bytes",
                    metadata={
                        "formatted_size": result.data[0]['db_size'],
                        "execution_time": result.execution_time
                    }
                )

            # Cache hit ratio
            cache_query = """
            SELECT
                round(
                    (blks_hit * 100.0) / nullif(blks_hit + blks_read, 0), 2
                ) as cache_hit_ratio
            FROM pg_stat_database
            WHERE datname = current_database()
            """

            result = self.db_manager.execute_query(
                connection_id, cache_query,
                allowed_operations={'SELECT'}
            )

            if result.data and result.data[0]['cache_hit_ratio'] is not None:
                await self.record_metric(
                    connection_id=connection_id,
                    metric_type=MetricType.PERFORMANCE,
                    name="cache_hit_ratio",
                    value=result.data[0]['cache_hit_ratio'],
                    unit="percent",
                    metadata={"execution_time": result.execution_time}
                )

        except Exception as e:
            logger.error(f"Error collecting metrics for {connection_id}: {e}")

    async def monitor_query_performance(self):
        """Monitor query performance patterns"""
        while self.monitoring:
            try:
                for connection_id in self.db_manager.list_connections():
                    await self.analyze_slow_queries(connection_id)

                await asyncio.sleep(30)  # Check every 30 seconds

            except Exception as e:
                logger.error(f"Query performance monitoring error: {e}")
                await asyncio.sleep(60)

    async def analyze_slow_queries(self, connection_id: str):
        """Analyze slow queries for a connection"""
        try:
            # Get slow queries from pg_stat_statements if available
            slow_query = """
            SELECT
                query,
                calls,
                total_exec_time,
                mean_exec_time,
                rows
            FROM pg_stat_statements
            WHERE mean_exec_time > 1000  -- Slower than 1 second
            ORDER BY mean_exec_time DESC
            LIMIT 10
            """

            try:
                result = self.db_manager.execute_query(
                    connection_id, slow_query,
                    allowed_operations={'SELECT'}
                )

                if result.data:
                    for query_stat in result.data:
                        await self.record_metric(
                            connection_id=connection_id,
                            metric_type=MetricType.PERFORMANCE,
                            name="slow_query",
                            value=query_stat['mean_exec_time'],
                            unit="milliseconds",
                            metadata={
                                "query": query_stat['query'][:200] + "..." if len(query_stat['query']) > 200 else query_stat['query'],
                                "calls": query_stat['calls'],
                                "total_time": query_stat['total_exec_time']
                            }
                        )

                        # Create alert for very slow queries
                        if query_stat['mean_exec_time'] > 5000:  # 5 seconds
                            await self.create_alert(
                                level=AlertLevel.WARNING,
                                title="Slow Query Detected",
                                message=f"Query taking {query_stat['mean_exec_time']:.0f}ms on average",
                                connection_id=connection_id
                            )

            except Exception:
                # pg_stat_statements not available, skip
                pass

        except Exception as e:
            logger.error(f"Error analyzing slow queries for {connection_id}: {e}")

    async def record_metric(
        self,
        connection_id: str,
        metric_type: MetricType,
        name: str,
        value: float,
        unit: str,
        metadata: Dict[str, Any]
    ):
        """Record a new metric"""
        metric = Metric(
            timestamp=datetime.now(),
            connection_id=connection_id,
            metric_type=metric_type,
            name=name,
            value=value,
            unit=unit,
            metadata=metadata
        )

        self.metrics_buffer.append(metric)

        # Check for alerts
        await self.check_metric_thresholds(metric)

        # Broadcast to subscribers
        await self.broadcast_metric(metric)

    async def check_metric_thresholds(self, metric: Metric):
        """Check if metric exceeds thresholds and create alerts"""
        if metric.name not in self.thresholds:
            return

        thresholds = self.thresholds[metric.name]

        if metric.value >= thresholds['critical']:
            await self.create_alert(
                level=AlertLevel.CRITICAL,
                title=f"Critical {metric.name.replace('_', ' ').title()}",
                message=f"{metric.name} is at {metric.value}{metric.unit} (critical threshold: {thresholds['critical']}{metric.unit})",
                connection_id=metric.connection_id
            )
        elif metric.value >= thresholds['warning']:
            await self.create_alert(
                level=AlertLevel.WARNING,
                title=f"High {metric.name.replace('_', ' ').title()}",
                message=f"{metric.name} is at {metric.value}{metric.unit} (warning threshold: {thresholds['warning']}{metric.unit})",
                connection_id=metric.connection_id
            )

    async def create_alert(
        self,
        level: AlertLevel,
        title: str,
        message: str,
        connection_id: Optional[str] = None
    ):
        """Create a new alert"""
        alert = Alert(
            id=f"alert_{int(time.time() * 1000)}",
            level=level,
            title=title,
            message=message,
            timestamp=datetime.now(),
            connection_id=connection_id
        )

        self.alerts.append(alert)
        logger.warning(f"🚨 {level.value.upper()}: {title} - {message}")

        # Broadcast alert
        await self.broadcast_alert(alert)

    async def broadcast_metric(self, metric: Metric):
        """Broadcast metric to all subscribers"""
        if not self.subscribers:
            return

        message = {
            "type": "metric",
            "data": asdict(metric)
        }

        # Convert datetime to string for JSON serialization
        message["data"]["timestamp"] = metric.timestamp.isoformat()

        await self.broadcast_to_subscribers(message)

    async def broadcast_alert(self, alert: Alert):
        """Broadcast alert to all subscribers"""
        if not self.subscribers:
            return

        message = {
            "type": "alert",
            "data": asdict(alert)
        }

        # Convert datetime to string
        message["data"]["timestamp"] = alert.timestamp.isoformat()

        await self.broadcast_to_subscribers(message)

    async def broadcast_to_subscribers(self, message: Dict[str, Any]):
        """Broadcast message to all WebSocket subscribers"""
        if not self.subscribers:
            return

        json_message = json.dumps(message, default=str)

        # Remove disconnected subscribers
        disconnected = set()

        for subscriber in self.subscribers:
            try:
                await subscriber.send_text(json_message)
            except Exception:
                disconnected.add(subscriber)

        self.subscribers -= disconnected

    def add_subscriber(self, websocket):
        """Add WebSocket subscriber"""
        self.subscribers.add(websocket)
        logger.info(f"📡 Added subscriber (total: {len(self.subscribers)})")

    def remove_subscriber(self, websocket):
        """Remove WebSocket subscriber"""
        self.subscribers.discard(websocket)
        logger.info(f"📡 Removed subscriber (total: {len(self.subscribers)})")

    async def get_metrics_summary(
        self,
        connection_id: Optional[str] = None,
        hours: int = 1
    ) -> Dict[str, Any]:
        """Get metrics summary for the last N hours"""

        cutoff_time = datetime.now() - timedelta(hours=hours)

        # Filter metrics
        filtered_metrics = [
            m for m in self.metrics_buffer
            if m.timestamp >= cutoff_time and (
                connection_id is None or m.connection_id == connection_id
            )
        ]

        if not filtered_metrics:
            return {"summary": "No metrics found for the specified period"}

        # Group by metric name
        metrics_by_name = defaultdict(list)
        for metric in filtered_metrics:
            metrics_by_name[metric.name].append(metric.value)

        # Calculate statistics
        summary = {}
        for name, values in metrics_by_name.items():
            summary[name] = {
                "count": len(values),
                "min": min(values),
                "max": max(values),
                "avg": statistics.mean(values),
                "median": statistics.median(values),
                "latest": values[-1] if values else 0
            }

        # Add recent alerts
        recent_alerts = [
            asdict(alert) for alert in self.alerts
            if alert.timestamp >= cutoff_time and (
                connection_id is None or alert.connection_id == connection_id
            )
        ]

        return {
            "period_hours": hours,
            "connection_id": connection_id,
            "metrics": summary,
            "alerts": recent_alerts,
            "total_data_points": len(filtered_metrics)
        }

    async def get_performance_insights(self, connection_id: str) -> List[PerformanceInsight]:
        """Generate AI-powered performance insights"""
        insights = []

        # Analyze recent metrics for patterns
        recent_metrics = [
            m for m in self.metrics_buffer
            if m.connection_id == connection_id and
               m.timestamp >= datetime.now() - timedelta(hours=1)
        ]

        if not recent_metrics:
            return insights

        # Group metrics by type
        metrics_by_type = defaultdict(list)
        for metric in recent_metrics:
            metrics_by_type[metric.name].append(metric.value)

        # Generate insights based on patterns
        for metric_name, values in metrics_by_type.items():
            if len(values) < 5:  # Need enough data points
                continue

            # Trend analysis
            if len(values) >= 10:
                recent_avg = statistics.mean(values[-5:])
                older_avg = statistics.mean(values[-10:-5])

                if recent_avg > older_avg * 1.2:  # 20% increase
                    insights.append(PerformanceInsight(
                        type="trend",
                        severity="warning",
                        title=f"Increasing {metric_name.replace('_', ' ').title()}",
                        description=f"{metric_name} has increased by {((recent_avg/older_avg)-1)*100:.1f}% in recent samples",
                        recommendation=f"Monitor {metric_name} closely and investigate potential causes",
                        impact="Performance may degrade if trend continues",
                        timestamp=datetime.now()
                    ))

            # Outlier detection
            if len(values) >= 20:
                avg = statistics.mean(values)
                stdev = statistics.stdev(values)
                recent_value = values[-1]

                if abs(recent_value - avg) > 2 * stdev:  # 2 standard deviations
                    insights.append(PerformanceInsight(
                        type="anomaly",
                        severity="info",
                        title=f"Unusual {metric_name.replace('_', ' ').title()}",
                        description=f"Current {metric_name} ({recent_value}) is significantly different from average ({avg:.2f})",
                        recommendation="Check for recent changes or unusual activity",
                        impact="May indicate system irregularity",
                        timestamp=datetime.now()
                    ))

        return insights

    async def analyze_patterns(self):
        """Analyze metrics for patterns and generate insights"""
        while self.monitoring:
            try:
                # This could include ML-based pattern detection
                # For now, we'll do basic statistical analysis

                # Check for unusual patterns every 5 minutes
                await asyncio.sleep(300)

            except Exception as e:
                logger.error(f"Pattern analysis error: {e}")
                await asyncio.sleep(600)

    async def process_alerts(self):
        """Process and manage alerts"""
        while self.monitoring:
            try:
                # Auto-resolve old alerts
                cutoff_time = datetime.now() - timedelta(hours=24)

                # Remove very old alerts to prevent memory issues
                while self.alerts and self.alerts[0].timestamp < cutoff_time:
                    self.alerts.popleft()

                await asyncio.sleep(60)  # Check every minute

            except Exception as e:
                logger.error(f"Alert processing error: {e}")
                await asyncio.sleep(120)

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get current dashboard data"""
        return {
            "current_metrics": self.get_current_metrics(),
            "recent_alerts": list(self.alerts)[-10:],  # Last 10 alerts
            "system_status": self.get_system_status(),
            "connections": len(self.db_manager.list_connections()),
            "monitoring_active": self.monitoring
        }

    def get_current_metrics(self) -> Dict[str, Any]:
        """Get latest metrics for each type"""
        latest_metrics = {}

        # Get the most recent metric for each name/connection combination
        for metric in reversed(self.metrics_buffer):
            key = f"{metric.connection_id}_{metric.name}"
            if key not in latest_metrics:
                latest_metrics[key] = asdict(metric)
                latest_metrics[key]["timestamp"] = metric.timestamp.isoformat()

        return latest_metrics

    def get_system_status(self) -> str:
        """Get overall system status"""
        critical_alerts = [a for a in self.alerts if a.level == AlertLevel.CRITICAL and not a.resolved]
        warning_alerts = [a for a in self.alerts if a.level == AlertLevel.WARNING and not a.resolved]

        if critical_alerts:
            return "critical"
        elif warning_alerts:
            return "warning"
        else:
            return "healthy"

# Global monitor instance
real_time_monitor = None

def get_real_time_monitor(db_manager) -> RealTimeMonitor:
    """Get the global real-time monitor instance"""
    global real_time_monitor
    if real_time_monitor is None:
        real_time_monitor = RealTimeMonitor(db_manager)
    return real_time_monitor

__all__ = [
    'RealTimeMonitor',
    'Metric',
    'Alert',
    'PerformanceInsight',
    'MetricType',
    'AlertLevel',
    'get_real_time_monitor'
]