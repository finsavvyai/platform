"""
API Usage Tracking and Analytics System

This module provides comprehensive usage analytics including:
- Request/response logging and tracking
- Performance metrics collection
- Error tracking and analysis
- User and organization usage statistics
- API endpoint analytics
- Rate limiting analytics
- Cost and quota tracking
- Real-time monitoring dashboards
- Historical data analysis
- Usage reporting

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import asyncio
import json
import time
import uuid
import logging
from typing import Dict, List, Any, Optional, Tuple, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, deque
import statistics

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import joinedload

from app.core.database import get_db
from app.gateway.models import APIUsageLog, APIKey, User, WebSocketConnection
from app.core.config import settings

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    """Types of metrics collected"""
    REQUEST_COUNT = "request_count"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    THROUGHPUT = "throughput"
    DATA_TRANSFER = "data_transfer"
    CONCURRENT_CONNECTIONS = "concurrent_connections"
    RATE_LIMIT_VIOLATIONS = "rate_limit_violations"


class TimeWindow(str, Enum):
    """Time windows for analytics"""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


@dataclass
class UsageMetrics:
    """Usage metrics data structure"""
    timestamp: datetime
    endpoint: str
    method: str
    status_code: int
    response_time_ms: float
    response_size_bytes: int
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    api_key_id: Optional[str] = None
    ip_address: str = ""
    user_agent: str = ""
    error_message: Optional[str] = None
    rate_limited: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return asdict(self)


@dataclass
class EndpointStats:
    """Endpoint statistics"""
    endpoint: str
    method: str
    total_requests: int = 0
    success_requests: int = 0
    error_requests: int = 0
    avg_response_time: float = 0.0
    min_response_time: float = float('inf')
    max_response_time: float = 0.0
    p50_response_time: float = 0.0
    p95_response_time: float = 0.0
    p99_response_time: float = 0.0
    total_bytes_sent: int = 0
    unique_users: int = 0
    rate_limit_hits: int = 0
    last_access: Optional[datetime] = None

    def update(self, metrics: UsageMetrics):
        """Update statistics with new metrics"""
        self.total_requests += 1

        if 200 <= metrics.status_code < 400:
            self.success_requests += 1
        else:
            self.error_requests += 1

        # Update response time statistics
        if metrics.response_time_ms < self.min_response_time:
            self.min_response_time = metrics.response_time_ms
        if metrics.response_time_ms > self.max_response_time:
            self.max_response_time = metrics.response_time_ms

        self.total_bytes_sent += metrics.response_size_bytes

        if metrics.rate_limited:
            self.rate_limit_hits += 1

        self.last_access = metrics.timestamp

    def calculate_percentiles(self, response_times: List[float]):
        """Calculate response time percentiles"""
        if not response_times:
            return

        self.avg_response_time = statistics.mean(response_times)
        self.p50_response_time = statistics.median(response_times)
        self.p95_response_time = self._percentile(response_times, 0.95)
        self.p99_response_time = self._percentile(response_times, 0.99)

    @staticmethod
    def _percentile(data: List[float], percentile: float) -> float:
        """Calculate percentile"""
        if not data:
            return 0.0

        sorted_data = sorted(data)
        index = int(len(sorted_data) * percentile)
        return sorted_data[min(index, len(sorted_data) - 1)]


@dataclass
class UserStats:
    """User usage statistics"""
    user_id: str
    total_requests: int = 0
    unique_endpoints: int = 0
    avg_response_time: float = 0.0
    total_bytes: int = 0
    error_rate: float = 0.0
    last_activity: Optional[datetime] = None
    most_used_endpoint: str = ""
    tier: str = "default"
    organization_id: Optional[str] = None


@dataclass
class AlertThresholds:
    """Alert threshold configuration"""
    error_rate_threshold: float = 0.05  # 5%
    response_time_threshold: float = 5000  # 5 seconds
    rate_limit_threshold: int = 100  # per minute
    throughput_threshold: int = 10000  # per minute


class UsageTracker:
    """
    Tracks API usage in real-time and persists to database
    """

    def __init__(self):
        self.buffer: deque = deque(maxlen=10000)  # In-memory buffer
        self.batch_size = 100
        self.flush_interval = 30  # seconds
        self._flush_task: Optional[asyncio.Task] = None
        self._shutdown = False
        self.endpoint_stats: Dict[str, EndpointStats] = {}
        self.user_stats: Dict[str, UserStats] = {}

    async def start(self):
        """Start the usage tracker"""
        self._flush_task = asyncio.create_task(self._periodic_flush())
        logger.info("Usage tracker started")

    async def stop(self):
        """Stop the usage tracker"""
        self._shutdown = True
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass

        # Flush remaining data
        await self.flush_buffer()
        logger.info("Usage tracker stopped")

    async def track_request(self, metrics: UsageMetrics):
        """Track a request/response"""
        # Add to buffer
        self.buffer.append(metrics)

        # Update real-time statistics
        await self._update_stats(metrics)

        # Flush buffer if needed
        if len(self.buffer) >= self.batch_size:
            asyncio.create_task(self.flush_buffer())

    async def _update_stats(self, metrics: UsageMetrics):
        """Update real-time statistics"""
        # Update endpoint statistics
        endpoint_key = f"{metrics.method}:{metrics.endpoint}"
        if endpoint_key not in self.endpoint_stats:
            self.endpoint_stats[endpoint_key] = EndpointStats(
                endpoint=metrics.endpoint,
                method=metrics.method
            )

        self.endpoint_stats[endpoint_key].update(metrics)

        # Update user statistics
        if metrics.user_id:
            if metrics.user_id not in self.user_stats:
                self.user_stats[metrics.user_id] = UserStats(
                    user_id=metrics.user_id,
                    organization_id=metrics.organization_id
                )

            user_stats = self.user_stats[metrics.user_id]
            user_stats.total_requests += 1
            user_stats.total_bytes += metrics.response_size_bytes
            user_stats.last_activity = metrics.timestamp

            if metrics.endpoint not in getattr(user_stats, 'endpoints', set()):
                user_stats.unique_endpoints += 1

    async def _periodic_flush(self):
        """Periodically flush buffer to database"""
        while not self._shutdown:
            try:
                await asyncio.sleep(self.flush_interval)
                await self.flush_buffer()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Periodic flush error: {e}")

    async def flush_buffer(self):
        """Flush buffer to database"""
        if not self.buffer:
            return

        # Copy buffer and clear
        metrics_to_flush = list(self.buffer)
        self.buffer.clear()

        try:
            # Insert into database
            await self._insert_usage_logs(metrics_to_flush)
            logger.debug(f"Flushed {len(metrics_to_flush)} usage logs to database")

        except Exception as e:
            logger.error(f"Failed to flush usage logs: {e}")
            # Re-add to buffer for retry
            self.buffer.extendleft(metrics_to_flush)

    async def _insert_usage_logs(self, metrics_list: List[UsageMetrics]):
        """Insert usage logs into database"""
        async for db in get_db():
            try:
                # Create usage log records
                usage_logs = []
                for metrics in metrics_list:
                    usage_log = APIUsageLog(
                        request_id=str(uuid.uuid4()),
                        api_key_id=metrics.api_key_id,
                        user_id=metrics.user_id,
                        organization_id=metrics.organization_id,
                        method=metrics.method,
                        endpoint=metrics.endpoint,
                        path=metrics.endpoint,
                        status_code=metrics.status_code,
                        response_size_bytes=metrics.response_size_bytes,
                        response_time_ms=metrics.response_time_ms,
                        error_message=metrics.error_message,
                        rate_limited=metrics.rate_limited,
                        ip_address=metrics.ip_address,
                        user_agent=metrics.user_agent,
                        timestamp=metrics.timestamp,
                        request_metadata=metrics.metadata
                    )
                    usage_logs.append(usage_log)

                # Batch insert
                db.add_all(usage_logs)
                await db.commit()

            except Exception as e:
                await db.rollback()
                raise


class AnalyticsEngine:
    """
    Analytics engine for processing and analyzing usage data
    """

    def __init__(self):
        self.usage_tracker = UsageTracker()
        self.alert_thresholds = AlertThresholds()
        self._alerts_cache: Dict[str, datetime] = {}

    async def start(self):
        """Start the analytics engine"""
        await self.usage_tracker.start()

    async def stop(self):
        """Stop the analytics engine"""
        await self.usage_tracker.stop()

    async def get_endpoint_stats(
        self,
        endpoint: Optional[str] = None,
        time_window: TimeWindow = TimeWindow.HOUR,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get endpoint usage statistics"""
        async for db in get_db():
            # Calculate time range
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            # Build query
            query = select(
                APIUsageLog.endpoint,
                APIUsageLog.method,
                func.count(APIUsageLog.id).label('total_requests'),
                func.avg(APIUsageLog.response_time_ms).label('avg_response_time'),
                func.sum(APIUsageLog.response_size_bytes).label('total_bytes'),
                func.count(func.null_if(APIUsageLog.status_code < 400, True)).label('error_count'),
                func.count(func.null_if(APIUsageLog.rate_limited, False)).label('rate_limit_hits'),
                func.max(APIUsageLog.timestamp).label('last_access')
            ).where(
                APIUsageLog.timestamp >= start_time
            )

            if endpoint:
                query = query.where(APIUsageLog.endpoint == endpoint)

            query = query.group_by(
                APIUsageLog.endpoint,
                APIUsageLog.method
            ).order_by(
                desc('total_requests')
            ).limit(limit)

            result = await db.execute(query)
            rows = result.fetchall()

            # Convert to list of dictionaries
            stats = []
            for row in rows:
                error_rate = row.error_count / row.total_requests if row.total_requests > 0 else 0

                stats.append({
                    'endpoint': row.endpoint,
                    'method': row.method,
                    'total_requests': row.total_requests,
                    'avg_response_time_ms': float(row.avg_response_time or 0),
                    'total_bytes_sent': row.total_bytes or 0,
                    'error_rate': error_rate,
                    'rate_limit_hits': row.rate_limit_hits or 0,
                    'last_access': row.last_access.isoformat() if row.last_access else None
                })

            return stats

    async def get_user_stats(
        self,
        user_id: Optional[str] = None,
        time_window: TimeWindow = TimeWindow.DAY,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get user usage statistics"""
        async for db in get_db():
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            # Build query with user join
            query = select(
                APIUsageLog.user_id,
                func.count(APIUsageLog.id).label('total_requests'),
                func.count(func.distinct(APIUsageLog.endpoint)).label('unique_endpoints'),
                func.avg(APIUsageLog.response_time_ms).label('avg_response_time'),
                func.sum(APIUsageLog.response_size_bytes).label('total_bytes'),
                func.max(APIUsageLog.timestamp).label('last_activity')
            ).select_from(
                APIUsageLog.__table__
            ).where(
                and_(
                    APIUsageLog.timestamp >= start_time,
                    APIUsageLog.user_id.isnot(None)
                )
            )

            if user_id:
                query = query.where(APIUsageLog.user_id == user_id)

            query = query.group_by(
                APIUsageLog.user_id
            ).order_by(
                desc('total_requests')
            ).limit(limit)

            result = await db.execute(query)
            rows = result.fetchall()

            stats = []
            for row in rows:
                stats.append({
                    'user_id': row.user_id,
                    'total_requests': row.total_requests,
                    'unique_endpoints': row.unique_endpoints,
                    'avg_response_time_ms': float(row.avg_response_time or 0),
                    'total_bytes': row.total_bytes or 0,
                    'last_activity': row.last_activity.isoformat() if row.last_activity else None
                })

            return stats

    async def get_organization_stats(
        self,
        organization_id: Optional[str] = None,
        time_window: TimeWindow = TimeWindow.DAY
    ) -> List[Dict[str, Any]]:
        """Get organization usage statistics"""
        async for db in get_db():
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            query = select(
                APIUsageLog.organization_id,
                func.count(APIUsageLog.id).label('total_requests'),
                func.count(func.distinct(APIUsageLog.user_id)).label('unique_users'),
                func.count(func.distinct(APIUsageLog.endpoint)).label('unique_endpoints'),
                func.sum(APIUsageLog.response_size_bytes).label('total_bytes'),
                func.avg(APIUsageLog.response_time_ms).label('avg_response_time')
            ).where(
                and_(
                    APIUsageLog.timestamp >= start_time,
                    APIUsageLog.organization_id.isnot(None)
                )
            )

            if organization_id:
                query = query.where(APIUsageLog.organization_id == organization_id)

            query = query.group_by(
                APIUsageLog.organization_id
            ).order_by(
                desc('total_requests')
            )

            result = await db.execute(query)
            rows = result.fetchall()

            stats = []
            for row in rows:
                stats.append({
                    'organization_id': row.organization_id,
                    'total_requests': row.total_requests,
                    'unique_users': row.unique_users,
                    'unique_endpoints': row.unique_endpoints,
                    'total_bytes': row.total_bytes or 0,
                    'avg_response_time_ms': float(row.avg_response_time or 0)
                })

            return stats

    async def get_error_analysis(
        self,
        time_window: TimeWindow = TimeWindow.HOUR,
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get error analysis and trends"""
        async for db in get_db():
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            # Error count by status code
            error_query = select(
                APIUsageLog.status_code,
                func.count(APIUsageLog.id).label('count'),
                func.count(func.distinct(APIUsageLog.user_id)).label('unique_users')
            ).where(
                and_(
                    APIUsageLog.timestamp >= start_time,
                    APIUsageLog.status_code >= 400
                )
            ).group_by(
                APIUsageLog.status_code
            ).order_by(
                desc('count')
            )

            error_result = await db.execute(error_query)
            error_rows = error_result.fetchall()

            # Top error messages
            message_query = select(
                APIUsageLog.error_message,
                func.count(APIUsageLog.id).label('count')
            ).where(
                and_(
                    APIUsageLog.timestamp >= start_time,
                    APIUsageLog.error_message.isnot(None)
                )
            ).group_by(
                APIUsageLog.error_message
            ).order_by(
                desc('count')
            ).limit(limit)

            message_result = await db.execute(message_query)
            message_rows = message_result.fetchall()

            return {
                'time_window': time_window.value,
                'period': {
                    'start': start_time.isoformat(),
                    'end': end_time.isoformat()
                },
                'errors_by_status': [
                    {
                        'status_code': row.status_code,
                        'count': row.count,
                        'unique_users': row.unique_users
                    }
                    for row in error_rows
                ],
                'top_error_messages': [
                    {
                        'message': row.error_message,
                        'count': row.count
                    }
                    for row in message_rows
                ]
            }

    async def get_performance_metrics(
        self,
        time_window: TimeWindow = TimeWindow.HOUR
    ) -> Dict[str, Any]:
        """Get performance metrics"""
        async for db in get_db():
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            # Overall performance metrics
            perf_query = select(
                func.count(APIUsageLog.id).label('total_requests'),
                func.avg(APIUsageLog.response_time_ms).label('avg_response_time'),
                func.min(APIUsageLog.response_time_ms).label('min_response_time'),
                func.max(APIUsageLog.response_time_ms).label('max_response_time'),
                func.count(func.null_if(APIUsageLog.status_code >= 400, True)).label('error_count'),
                func.sum(APIUsageLog.response_size_bytes).label('total_bytes')
            ).where(
                APIUsageLog.timestamp >= start_time
            )

            perf_result = await db.execute(perf_query)
            perf_row = perf_result.first()

            if not perf_row:
                return {
                    'time_window': time_window.value,
                    'period': {
                        'start': start_time.isoformat(),
                        'end': end_time.isoformat()
                    },
                    'total_requests': 0,
                    'avg_response_time_ms': 0,
                    'min_response_time_ms': 0,
                    'max_response_time_ms': 0,
                    'error_rate': 0,
                    'throughput_rps': 0,
                    'total_bytes_transferred': 0
                }

            error_rate = perf_row.error_count / perf_row.total_requests if perf_row.total_requests > 0 else 0
            duration_seconds = (end_time - start_time).total_seconds()
            throughput_rps = perf_row.total_requests / duration_seconds if duration_seconds > 0 else 0

            return {
                'time_window': time_window.value,
                'period': {
                    'start': start_time.isoformat(),
                    'end': end_time.isoformat()
                },
                'total_requests': perf_row.total_requests,
                'avg_response_time_ms': float(perf_row.avg_response_time or 0),
                'min_response_time_ms': float(perf_row.min_response_time or 0),
                'max_response_time_ms': float(perf_row.max_response_time or 0),
                'error_rate': error_rate,
                'throughput_rps': throughput_rps,
                'total_bytes_transferred': perf_row.total_bytes or 0
            }

    async def get_rate_limit_analytics(
        self,
        time_window: TimeWindow = TimeWindow.HOUR
    ) -> Dict[str, Any]:
        """Get rate limiting analytics"""
        async for db in get_db():
            end_time = datetime.utcnow()
            start_time = self._calculate_start_time(end_time, time_window)

            query = select(
                func.count(APIUsageLog.id).label('total_requests'),
                func.count(func.null_if(APIUsageLog.rate_limited, False)).label('rate_limited'),
                func.count(func.distinct(APIUsageLog.user_id)).label('unique_users_limited'),
                func.count(func.distinct(APIUsageLog.ip_address)).label('unique_ips_limited')
            ).where(
                APIUsageLog.timestamp >= start_time
            )

            result = await db.execute(query)
            row = result.first()

            if not row:
                return {
                    'time_window': time_window.value,
                    'total_requests': 0,
                    'rate_limited_requests': 0,
                    'rate_limit_rate': 0,
                    'unique_users_limited': 0,
                    'unique_ips_limited': 0
                }

            rate_limit_rate = row.rate_limited / row.total_requests if row.total_requests > 0 else 0

            return {
                'time_window': time_window.value,
                'total_requests': row.total_requests,
                'rate_limited_requests': row.rate_limited,
                'rate_limit_rate': rate_limit_rate,
                'unique_users_limited': row.unique_users_limited,
                'unique_ips_limited': row.unique_ips_limited
            }

    async def get_websocket_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        async for db in get_db():
            # Active connections
            active_query = select(func.count(APIWebSocketConnection.id)).where(
                APIWebSocketConnection.is_active == True
            )
            active_result = await db.execute(active_query)
            active_connections = active_result.scalar()

            # Total connections today
            today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            total_query = select(func.count(APIWebSocketConnection.id)).where(
                APIWebSocketConnection.connected_at >= today
            )
            total_result = await db.execute(total_query)
            total_connections = total_result.scalar()

            # Average connection duration
            duration_query = select(
                func.avg(
                    func.extract('epoch', APIWebSocketConnection.disconnected_at - APIWebSocketConnection.connected_at)
                )
            ).where(
                and_(
                    APIWebSocketConnection.connected_at >= today,
                    APIWebSocketConnection.disconnected_at.isnot(None)
                )
            )
            duration_result = await db.execute(duration_query)
            avg_duration = duration_result.scalar()

            return {
                'active_connections': active_connections,
                'total_connections_today': total_connections,
                'average_connection_duration_seconds': float(avg_duration) if avg_duration else 0
            }

    def _calculate_start_time(self, end_time: datetime, window: TimeWindow) -> datetime:
        """Calculate start time based on time window"""
        if window == TimeWindow.MINUTE:
            return end_time - timedelta(minutes=1)
        elif window == TimeWindow.HOUR:
            return end_time - timedelta(hours=1)
        elif window == TimeWindow.DAY:
            return end_time - timedelta(days=1)
        elif window == TimeWindow.WEEK:
            return end_time - timedelta(weeks=1)
        elif window == TimeWindow.MONTH:
            return end_time - timedelta(days=30)
        else:
            return end_time - timedelta(hours=1)

    async def check_alerts(self) -> List[Dict[str, Any]]:
        """Check for alert conditions"""
        alerts = []

        # Get recent metrics
        perf_metrics = await self.get_performance_metrics(TimeWindow.MINUTE)
        error_analysis = await self.get_error_analysis(TimeWindow.MINUTE)
        rate_limit_metrics = await self.get_rate_limit_analytics(TimeWindow.MINUTE)

        # Check error rate threshold
        if perf_metrics['error_rate'] > self.alert_thresholds.error_rate_threshold:
            alert_key = "high_error_rate"
            if await self._should_send_alert(alert_key):
                alerts.append({
                    'type': 'error_rate',
                    'severity': 'high',
                    'message': f"High error rate: {perf_metrics['error_rate']:.2%}",
                    'value': perf_metrics['error_rate'],
                    'threshold': self.alert_thresholds.error_rate_threshold
                })

        # Check response time threshold
        if perf_metrics['avg_response_time_ms'] > self.alert_thresholds.response_time_threshold:
            alert_key = "high_response_time"
            if await self._should_send_alert(alert_key):
                alerts.append({
                    'type': 'response_time',
                    'severity': 'medium',
                    'message': f"High average response time: {perf_metrics['avg_response_time_ms']:.2f}ms",
                    'value': perf_metrics['avg_response_time_ms'],
                    'threshold': self.alert_thresholds.response_time_threshold
                })

        # Check rate limit threshold
        if rate_limit_metrics['rate_limit_rate'] > 0.1:  # 10% rate limited
            alert_key = "high_rate_limiting"
            if await self._should_send_alert(alert_key):
                alerts.append({
                    'type': 'rate_limiting',
                    'severity': 'medium',
                    'message': f"High rate limit rate: {rate_limit_metrics['rate_limit_rate']:.2%}",
                    'value': rate_limit_metrics['rate_limit_rate'],
                    'threshold': 0.1
                })

        return alerts

    async def _should_send_alert(self, alert_key: str, cooldown_minutes: int = 15) -> bool:
        """Check if alert should be sent (with cooldown)"""
        last_sent = self._alerts_cache.get(alert_key)
        if last_sent:
            if datetime.utcnow() - last_sent < timedelta(minutes=cooldown_minutes):
                return False

        self._alerts_cache[alert_key] = datetime.utcnow()
        return True

    async def generate_usage_report(
        self,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive usage report"""
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Get various statistics
        endpoint_stats = await self.get_endpoint_stats()
        user_stats = await self.get_user_stats()
        perf_metrics = await self.get_performance_metrics()
        error_analysis = await self.get_error_analysis()
        rate_limit_metrics = await self.get_rate_limit_analytics()
        websocket_stats = await self.get_websocket_stats()

        return {
            'report_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat()
            },
            'summary': {
                'total_requests': perf_metrics['total_requests'],
                'avg_response_time_ms': perf_metrics['avg_response_time_ms'],
                'error_rate': perf_metrics['error_rate'],
                'throughput_rps': perf_metrics['throughput_rps'],
                'total_bytes_transferred': perf_metrics['total_bytes_transferred']
            },
            'endpoints': endpoint_stats[:10],  # Top 10 endpoints
            'users': user_stats[:10],  # Top 10 users
            'errors': error_analysis,
            'rate_limiting': rate_limit_metrics,
            'websockets': websocket_stats,
            'generated_at': datetime.utcnow().isoformat()
        }


# Global analytics instance
analytics_engine = AnalyticsEngine()