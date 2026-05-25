#!/usr/bin/env python3
"""
Performance Monitoring Dashboard
Real-time performance dashboard with trend visualization and alerting
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import statistics
import logging

from .performance_metrics import (
    PerformanceMetricsCollector,
    DatabaseResourceMonitor,
    get_performance_metrics_collector
)
from .realtime_dashboard import (
    RealTimeMonitor,
    get_real_time_monitor,
    AlertLevel
)

logger = logging.getLogger(__name__)

@dataclass
class DashboardConfig:
    """Dashboard configuration"""
    refresh_interval: int = 5  # seconds
    history_hours: int = 24
    alert_thresholds: Dict[str, Dict[str, float]] = None
    enable_notifications: bool = True
    max_data_points: int = 1000
    
    def __post_init__(self):
        if self.alert_thresholds is None:
            self.alert_thresholds = {
                'query_time': {'warning': 1.0, 'critical': 5.0},
                'cpu_usage': {'warning': 70.0, 'critical': 90.0},
                'memory_usage': {'warning': 80.0, 'critical': 95.0},
                'connection_count': {'warning': 80, 'critical': 95},
                'error_rate': {'warning': 0.05, 'critical': 0.10}
            }

@dataclass
class TrendData:
    """Trend analysis data"""
    metric_name: str
    timestamps: List[datetime]
    values: List[float]
    trend_direction: str  # 'up', 'down', 'stable'
    trend_strength: float  # 0.0 to 1.0
    prediction: Optional[float] = None

@dataclass
class PerformanceRecommendation:
    """Performance optimization recommendation"""
    category: str
    priority: str  # 'high', 'medium', 'low'
    title: str
    description: str
    action: str
    impact: str
    timestamp: datetime

class PerformanceDashboard:
    """Real-time performance monitoring dashboard"""
    
    def __init__(self, config: DashboardConfig = None):
        self.config = config or DashboardConfig()
        self.metrics_collector = get_performance_metrics_collector()
        self.real_time_monitor = None
        self.resource_monitor = None
        
        # Dashboard state
        self.is_running = False
        self.subscribers = set()
        self.trend_data = {}
        self.recommendations = deque(maxlen=100)
        
        # Performance tracking
        self.performance_history = defaultdict(lambda: deque(maxlen=self.config.max_data_points))
        self.alert_history = deque(maxlen=1000)
        
        logger.info("📊 Performance dashboard initialized")
    
    async def start(self, connection_manager=None):
        """Start the performance dashboard"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Initialize real-time monitor if connection manager is provided
        if connection_manager:
            self.real_time_monitor = get_real_time_monitor(connection_manager)
            await self.real_time_monitor.start_monitoring()
            
            # Start resource monitoring
            self.resource_monitor = DatabaseResourceMonitor(self.metrics_collector)
            self.resource_monitor.start_monitoring(connection_manager, interval=30)
        
        # Start dashboard tasks
        tasks = [
            self.update_dashboard_data(),
            self.analyze_trends(),
            self.generate_recommendations(),
            self.broadcast_updates()
        ]
        
        logger.info("🚀 Performance dashboard started")
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def stop(self):
        """Stop the performance dashboard"""
        self.is_running = False
        
        if self.real_time_monitor:
            await self.real_time_monitor.stop_monitoring()
        
        if self.resource_monitor:
            self.resource_monitor.stop_monitoring()
        
        logger.info("⏹️ Performance dashboard stopped")
    
    async def update_dashboard_data(self):
        """Update dashboard data periodically"""
        while self.is_running:
            try:
                await self.collect_current_metrics()
                await asyncio.sleep(self.config.refresh_interval)
            except Exception as e:
                logger.error(f"Error updating dashboard data: {e}")
                await asyncio.sleep(self.config.refresh_interval * 2)
    
    async def collect_current_metrics(self):
        """Collect current performance metrics"""
        timestamp = datetime.now()
        
        # Collect query performance metrics
        query_stats = self.metrics_collector.get_query_performance_stats(hours=1)
        if 'execution_time' in query_stats:
            self.performance_history['avg_query_time'].append({
                'timestamp': timestamp,
                'value': query_stats['execution_time']['avg']
            })
            
            self.performance_history['query_count'].append({
                'timestamp': timestamp,
                'value': query_stats['total_queries']
            })
            
            self.performance_history['success_rate'].append({
                'timestamp': timestamp,
                'value': query_stats['success_rate']
            })
        
        # Collect connection metrics
        connection_stats = self.metrics_collector.get_connection_performance_stats(hours=1)
        if 'active_connections' in connection_stats:
            self.performance_history['active_connections'].append({
                'timestamp': timestamp,
                'value': connection_stats['active_connections']
            })
        
        # Collect resource metrics
        resource_stats = self.metrics_collector.get_resource_usage_stats(hours=1)
        if 'cpu_usage' in resource_stats:
            self.performance_history['cpu_usage'].append({
                'timestamp': timestamp,
                'value': resource_stats['cpu_usage']['current']
            })
            
            self.performance_history['memory_usage'].append({
                'timestamp': timestamp,
                'value': resource_stats['memory_usage']['current']
            })
    
    async def analyze_trends(self):
        """Analyze performance trends"""
        while self.is_running:
            try:
                await self.perform_trend_analysis()
                await asyncio.sleep(300)  # Analyze trends every 5 minutes
            except Exception as e:
                logger.error(f"Error analyzing trends: {e}")
                await asyncio.sleep(600)
    
    async def perform_trend_analysis(self):
        """Perform trend analysis on performance data"""
        for metric_name, data_points in self.performance_history.items():
            if len(data_points) < 10:  # Need at least 10 data points
                continue
            
            # Extract values and timestamps
            values = [point['value'] for point in data_points]
            timestamps = [point['timestamp'] for point in data_points]
            
            # Calculate trend
            trend_data = self.calculate_trend(metric_name, timestamps, values)
            self.trend_data[metric_name] = trend_data
            
            # Check for concerning trends
            await self.check_trend_alerts(trend_data)
    
    def calculate_trend(self, metric_name: str, timestamps: List[datetime], 
                       values: List[float]) -> TrendData:
        """Calculate trend for a metric"""
        if len(values) < 2:
            return TrendData(
                metric_name=metric_name,
                timestamps=timestamps,
                values=values,
                trend_direction='stable',
                trend_strength=0.0
            )
        
        # Simple linear regression for trend
        n = len(values)
        x = list(range(n))
        
        # Calculate slope
        x_mean = statistics.mean(x)
        y_mean = statistics.mean(values)
        
        numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            slope = 0
        else:
            slope = numerator / denominator
        
        # Determine trend direction and strength
        # Use relative threshold based on mean value
        threshold = max(0.01, abs(y_mean) * 0.001)  # 0.1% of mean or 0.01, whichever is larger
        
        if abs(slope) < threshold:  # Threshold for "stable"
            direction = 'stable'
            strength = 0.0
        elif slope > 0:
            direction = 'up'
            strength = min(abs(slope) / (y_mean + 0.001), 1.0)  # Normalize
        else:
            direction = 'down'
            strength = min(abs(slope) / (y_mean + 0.001), 1.0)
        
        # Simple prediction (next value)
        prediction = values[-1] + slope if len(values) > 0 else None
        
        return TrendData(
            metric_name=metric_name,
            timestamps=timestamps,
            values=values,
            trend_direction=direction,
            trend_strength=strength,
            prediction=prediction
        )
    
    async def check_trend_alerts(self, trend_data: TrendData):
        """Check if trends warrant alerts"""
        metric_name = trend_data.metric_name
        
        # Check for rapidly increasing concerning metrics
        if (trend_data.trend_direction == 'up' and 
            trend_data.trend_strength > 0.5 and
            metric_name in ['cpu_usage', 'memory_usage', 'avg_query_time']):
            
            await self.create_trend_alert(
                level=AlertLevel.WARNING,
                title=f"Increasing {metric_name.replace('_', ' ').title()}",
                message=f"{metric_name} is trending upward with strength {trend_data.trend_strength:.2f}",
                metric_name=metric_name
            )
        
        # Check for rapidly decreasing good metrics
        elif (trend_data.trend_direction == 'down' and 
              trend_data.trend_strength > 0.5 and
              metric_name in ['success_rate']):
            
            await self.create_trend_alert(
                level=AlertLevel.WARNING,
                title=f"Decreasing {metric_name.replace('_', ' ').title()}",
                message=f"{metric_name} is trending downward with strength {trend_data.trend_strength:.2f}",
                metric_name=metric_name
            )
    
    async def create_trend_alert(self, level: AlertLevel, title: str, 
                               message: str, metric_name: str):
        """Create a trend-based alert"""
        alert = {
            'id': f"trend_alert_{int(time.time() * 1000)}",
            'level': level.value,
            'title': title,
            'message': message,
            'timestamp': datetime.now().isoformat(),
            'type': 'trend',
            'metric_name': metric_name
        }
        
        self.alert_history.append(alert)
        logger.warning(f"🔍 Trend Alert: {title} - {message}")
        
        # Broadcast to subscribers
        await self.broadcast_alert(alert)
    
    async def generate_recommendations(self):
        """Generate performance optimization recommendations"""
        while self.is_running:
            try:
                await self.analyze_performance_patterns()
                await asyncio.sleep(600)  # Generate recommendations every 10 minutes
            except Exception as e:
                logger.error(f"Error generating recommendations: {e}")
                await asyncio.sleep(1200)
    
    async def analyze_performance_patterns(self):
        """Analyze performance patterns and generate recommendations"""
        recommendations = []
        
        # Analyze query performance
        query_stats = self.metrics_collector.get_query_performance_stats(hours=24)
        if query_stats and 'execution_time' in query_stats:
            avg_time = query_stats['execution_time']['avg']
            slow_queries = query_stats.get('slow_queries', 0)
            
            if avg_time > 1.0:
                recommendations.append(PerformanceRecommendation(
                    category='query_performance',
                    priority='high',
                    title='High Average Query Time',
                    description=f'Average query execution time is {avg_time:.2f}s',
                    action='Review and optimize slow queries, consider adding indexes',
                    impact='Improved response times and user experience',
                    timestamp=datetime.now()
                ))
            
            if slow_queries > query_stats['total_queries'] * 0.1:  # More than 10% slow queries
                recommendations.append(PerformanceRecommendation(
                    category='query_optimization',
                    priority='medium',
                    title='High Number of Slow Queries',
                    description=f'{slow_queries} slow queries detected in the last 24 hours',
                    action='Identify and optimize the slowest queries',
                    impact='Reduced database load and improved performance',
                    timestamp=datetime.now()
                ))
        
        # Analyze resource usage
        resource_stats = self.metrics_collector.get_resource_usage_stats(hours=24)
        if resource_stats:
            if 'cpu_usage' in resource_stats and resource_stats['cpu_usage']['avg'] > 70:
                recommendations.append(PerformanceRecommendation(
                    category='resource_optimization',
                    priority='high',
                    title='High CPU Usage',
                    description=f'Average CPU usage is {resource_stats["cpu_usage"]["avg"]:.1f}%',
                    action='Consider scaling up resources or optimizing queries',
                    impact='Better system stability and performance',
                    timestamp=datetime.now()
                ))
            
            if 'memory_usage' in resource_stats and resource_stats['memory_usage']['avg'] > 80:
                recommendations.append(PerformanceRecommendation(
                    category='resource_optimization',
                    priority='medium',
                    title='High Memory Usage',
                    description=f'Average memory usage is {resource_stats["memory_usage"]["avg"]:.1f}%',
                    action='Review memory-intensive operations and consider increasing memory',
                    impact='Reduced risk of out-of-memory errors',
                    timestamp=datetime.now()
                ))
        
        # Add recommendations to history
        for rec in recommendations:
            self.recommendations.append(rec)
        
        if recommendations:
            logger.info(f"💡 Generated {len(recommendations)} performance recommendations")
    
    async def broadcast_updates(self):
        """Broadcast dashboard updates to subscribers"""
        while self.is_running:
            try:
                if self.subscribers:
                    dashboard_data = await self.get_dashboard_data()
                    await self.broadcast_to_subscribers({
                        'type': 'dashboard_update',
                        'data': dashboard_data
                    })
                
                await asyncio.sleep(self.config.refresh_interval)
            except Exception as e:
                logger.error(f"Error broadcasting updates: {e}")
                await asyncio.sleep(self.config.refresh_interval * 2)
    
    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get current dashboard data"""
        current_time = datetime.now()
        
        # Get recent performance data
        recent_data = {}
        for metric_name, data_points in self.performance_history.items():
            if data_points:
                recent_data[metric_name] = {
                    'current': data_points[-1]['value'] if data_points else 0,
                    'history': [
                        {
                            'timestamp': point['timestamp'].isoformat(),
                            'value': point['value']
                        }
                        for point in list(data_points)[-50:]  # Last 50 points
                    ]
                }
        
        # Get trend data
        trends = {}
        for metric_name, trend in self.trend_data.items():
            trends[metric_name] = {
                'direction': trend.trend_direction,
                'strength': trend.trend_strength,
                'prediction': trend.prediction
            }
        
        # Get recent alerts
        recent_alerts = [
            alert for alert in list(self.alert_history)[-10:]  # Last 10 alerts
        ]
        
        # Get recent recommendations
        recent_recommendations = [
            asdict(rec) for rec in list(self.recommendations)[-5:]  # Last 5 recommendations
        ]
        
        # Convert datetime objects to strings
        for rec in recent_recommendations:
            rec['timestamp'] = rec['timestamp'].isoformat()
        
        return {
            'timestamp': current_time.isoformat(),
            'metrics': recent_data,
            'trends': trends,
            'alerts': recent_alerts,
            'recommendations': recent_recommendations,
            'status': self.get_overall_status(),
            'config': {
                'refresh_interval': self.config.refresh_interval,
                'history_hours': self.config.history_hours
            }
        }
    
    def get_overall_status(self) -> str:
        """Get overall system status"""
        # Check recent alerts
        recent_critical = any(
            alert['level'] == 'critical' 
            for alert in list(self.alert_history)[-10:]
        )
        
        recent_warnings = any(
            alert['level'] == 'warning' 
            for alert in list(self.alert_history)[-10:]
        )
        
        if recent_critical:
            return 'critical'
        elif recent_warnings:
            return 'warning'
        else:
            return 'healthy'
    
    async def broadcast_alert(self, alert: Dict[str, Any]):
        """Broadcast alert to subscribers"""
        if self.subscribers:
            await self.broadcast_to_subscribers({
                'type': 'alert',
                'data': alert
            })
    
    async def broadcast_to_subscribers(self, message: Dict[str, Any]):
        """Broadcast message to all subscribers"""
        if not self.subscribers:
            return
        
        json_message = json.dumps(message, default=str)
        disconnected = set()
        
        for subscriber in self.subscribers:
            try:
                await subscriber.send_text(json_message)
            except Exception:
                disconnected.add(subscriber)
        
        # Remove disconnected subscribers
        self.subscribers -= disconnected
    
    def add_subscriber(self, websocket):
        """Add WebSocket subscriber"""
        self.subscribers.add(websocket)
        logger.info(f"📡 Dashboard subscriber added (total: {len(self.subscribers)})")
    
    def remove_subscriber(self, websocket):
        """Remove WebSocket subscriber"""
        self.subscribers.discard(websocket)
        logger.info(f"📡 Dashboard subscriber removed (total: {len(self.subscribers)})")
    
    def get_performance_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance summary for the specified period"""
        query_stats = self.metrics_collector.get_query_performance_stats(hours=hours)
        connection_stats = self.metrics_collector.get_connection_performance_stats(hours=hours)
        resource_stats = self.metrics_collector.get_resource_usage_stats(hours=hours)
        
        return {
            'period_hours': hours,
            'query_performance': query_stats,
            'connection_performance': connection_stats,
            'resource_usage': resource_stats,
            'trends': {name: asdict(trend) for name, trend in self.trend_data.items()},
            'recommendations_count': len(self.recommendations),
            'alerts_count': len(self.alert_history)
        }
    
    def get_slowest_queries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the slowest queries"""
        return self.metrics_collector.get_slowest_queries(limit=limit)
    
    def clear_old_data(self, hours: int = 24):
        """Clear old dashboard data"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # Clear old performance history
        for metric_name in self.performance_history:
            self.performance_history[metric_name] = deque(
                (point for point in self.performance_history[metric_name] 
                 if point['timestamp'] >= cutoff_time),
                maxlen=self.config.max_data_points
            )
        
        # Clear old alerts
        self.alert_history = deque(
            (alert for alert in self.alert_history 
             if datetime.fromisoformat(alert['timestamp']) >= cutoff_time),
            maxlen=1000
        )
        
        # Clear old recommendations
        self.recommendations = deque(
            (rec for rec in self.recommendations if rec.timestamp >= cutoff_time),
            maxlen=100
        )
        
        logger.info(f"🧹 Cleared dashboard data older than {hours} hours")

# Global dashboard instance
_performance_dashboard = None

def get_performance_dashboard(config: DashboardConfig = None) -> PerformanceDashboard:
    """Get the global performance dashboard instance"""
    global _performance_dashboard
    if _performance_dashboard is None:
        _performance_dashboard = PerformanceDashboard(config)
    return _performance_dashboard

__all__ = [
    'PerformanceDashboard',
    'DashboardConfig',
    'TrendData',
    'PerformanceRecommendation',
    'get_performance_dashboard'
]