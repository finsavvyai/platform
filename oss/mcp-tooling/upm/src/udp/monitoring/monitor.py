"""
Real-Time Monitoring System.

Comprehensive monitoring for system health, dependency status, security events,
and performance metrics with real-time data collection and analysis.
"""

import asyncio
import logging
import statistics
import threading
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Union

import psutil

logger = logging.getLogger(__name__)


@dataclass
class MonitoringConfig:
    """Configuration for monitoring systems."""
    collection_interval: float = 1.0  # seconds
    retention_period: int = 3600  # seconds
    alert_thresholds: dict[str, float] = field(default_factory=dict)
    enabled_monitors: list[str] = field(default_factory=lambda: ["system", "dependency", "security", "performance"])
    max_history_size: int = 1000


@dataclass
class MetricData:
    """Container for metric data."""
    name: str
    value: Union[float, int, str]
    timestamp: datetime
    tags: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthStatus:
    """Health status information."""
    service: str
    status: str  # "healthy", "degraded", "unhealthy"
    timestamp: datetime
    details: dict[str, Any] = field(default_factory=dict)
    metrics: dict[str, float] = field(default_factory=dict)


class BaseMonitor(ABC):
    """Base class for all monitoring systems."""

    def __init__(self, name: str, config: MonitoringConfig):
        self.name = name
        self.config = config
        self.is_running = False
        self.metrics_history = deque(maxlen=config.max_history_size)
        self.callbacks = []
        self._lock = threading.Lock()

    @abstractmethod
    async def collect_metrics(self) -> list[MetricData]:
        """Collect metrics from the monitored system."""
        pass

    @abstractmethod
    async def check_health(self) -> HealthStatus:
        """Check the health of the monitored system."""
        pass

    def add_callback(self, callback: Callable[[list[MetricData]], None]):
        """Add a callback for metric updates."""
        self.callbacks.append(callback)

    async def start_monitoring(self):
        """Start the monitoring loop."""
        self.is_running = True
        logger.info(f"Starting {self.name} monitor")

        while self.is_running:
            try:
                # Collect metrics
                metrics = await self.collect_metrics()

                # Store metrics
                with self._lock:
                    self.metrics_history.extend(metrics)

                # Notify callbacks
                for callback in self.callbacks:
                    try:
                        callback(metrics)
                    except Exception as e:
                        logger.error(f"Callback error in {self.name}: {e}")

                # Wait for next collection
                await asyncio.sleep(self.config.collection_interval)

            except Exception as e:
                logger.error(f"Error in {self.name} monitor: {e}", exc_info=True)
                await asyncio.sleep(self.config.collection_interval)

    def stop_monitoring(self):
        """Stop the monitoring loop."""
        self.is_running = False
        logger.info(f"Stopped {self.name} monitor")

    def get_metrics_history(self, duration_seconds: int = 300) -> list[MetricData]:
        """Get metrics from the last N seconds."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        with self._lock:
            return [m for m in self.metrics_history if m.timestamp >= cutoff_time]

    def get_latest_metrics(self) -> list[MetricData]:
        """Get the most recent metrics."""
        with self._lock:
            return list(self.metrics_history)[-10:]  # Last 10 metrics


class SystemMonitor(BaseMonitor):
    """Monitor system-level metrics."""

    def __init__(self, config: MonitoringConfig):
        super().__init__("system", config)
        self.cpu_history = deque(maxlen=60)  # 1 minute of data
        self.memory_history = deque(maxlen=60)
        self.disk_history = deque(maxlen=60)
        self.network_history = deque(maxlen=60)

    async def collect_metrics(self) -> list[MetricData]:
        """Collect system metrics."""
        try:
            metrics = []
            now = datetime.utcnow()

            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()

            metrics.extend([
                MetricData("system.cpu.percent", cpu_percent, now, {"type": "usage"}),
                MetricData("system.cpu.count", cpu_count, now, {"type": "count"}),
                MetricData("system.cpu.frequency", cpu_freq.current if cpu_freq else 0, now, {"type": "frequency"})
            ])

            # Memory metrics
            memory = psutil.virtual_memory()
            swap = psutil.swap_memory()

            metrics.extend([
                MetricData("system.memory.total", memory.total, now, {"type": "total"}),
                MetricData("system.memory.available", memory.available, now, {"type": "available"}),
                MetricData("system.memory.percent", memory.percent, now, {"type": "usage"}),
                MetricData("system.memory.used", memory.used, now, {"type": "used"}),
                MetricData("system.swap.total", swap.total, now, {"type": "total"}),
                MetricData("system.swap.used", swap.used, now, {"type": "used"}),
                MetricData("system.swap.percent", swap.percent, now, {"type": "usage"})
            ])

            # Disk metrics
            disk_usage = psutil.disk_usage('/')
            disk_io = psutil.disk_io_counters()

            metrics.extend([
                MetricData("system.disk.total", disk_usage.total, now, {"type": "total"}),
                MetricData("system.disk.used", disk_usage.used, now, {"type": "used"}),
                MetricData("system.disk.free", disk_usage.free, now, {"type": "free"}),
                MetricData("system.disk.percent", (disk_usage.used / disk_usage.total) * 100, now, {"type": "usage"})
            ])

            if disk_io:
                metrics.extend([
                    MetricData("system.disk.read_bytes", disk_io.read_bytes, now, {"type": "read"}),
                    MetricData("system.disk.write_bytes", disk_io.write_bytes, now, {"type": "write"}),
                    MetricData("system.disk.read_count", disk_io.read_count, now, {"type": "read_ops"}),
                    MetricData("system.disk.write_count", disk_io.write_count, now, {"type": "write_ops"})
                ])

            # Network metrics
            network_io = psutil.net_io_counters()
            if network_io:
                metrics.extend([
                    MetricData("system.network.bytes_sent", network_io.bytes_sent, now, {"type": "sent"}),
                    MetricData("system.network.bytes_recv", network_io.bytes_recv, now, {"type": "received"}),
                    MetricData("system.network.packets_sent", network_io.packets_sent, now, {"type": "sent"}),
                    MetricData("system.network.packets_recv", network_io.packets_recv, now, {"type": "received"}),
                    MetricData("system.network.errin", network_io.errin, now, {"type": "errors"}),
                    MetricData("system.network.errout", network_io.errout, now, {"type": "errors"}),
                    MetricData("system.network.dropin", network_io.dropin, now, {"type": "drops"}),
                    MetricData("system.network.dropout", network_io.dropout, now, {"type": "drops"})
                ])

            # Process metrics
            process = psutil.Process()
            metrics.extend([
                MetricData("system.process.cpu_percent", process.cpu_percent(), now, {"type": "usage"}),
                MetricData("system.process.memory_percent", process.memory_percent(), now, {"type": "usage"}),
                MetricData("system.process.memory_rss", process.memory_info().rss, now, {"type": "rss"}),
                MetricData("system.process.memory_vms", process.memory_info().vms, now, {"type": "vms"}),
                MetricData("system.process.num_threads", process.num_threads(), now, {"type": "count"}),
                MetricData("system.process.num_fds", process.num_fds(), now, {"type": "count"})
            ])

            # Update history
            self.cpu_history.append(cpu_percent)
            self.memory_history.append(memory.percent)
            self.disk_history.append((disk_usage.used / disk_usage.total) * 100)

            return metrics

        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}", exc_info=True)
            return []

    async def check_health(self) -> HealthStatus:
        """Check system health."""
        try:
            now = datetime.utcnow()

            # Get current metrics
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk_usage = psutil.disk_usage('/')

            # Calculate health status
            status = "healthy"
            details = {}

            # CPU health
            if cpu_percent > 90:
                status = "unhealthy"
                details["cpu"] = f"High CPU usage: {cpu_percent:.1f}%"
            elif cpu_percent > 80:
                status = "degraded"
                details["cpu"] = f"Elevated CPU usage: {cpu_percent:.1f}%"

            # Memory health
            if memory.percent > 95:
                status = "unhealthy"
                details["memory"] = f"Critical memory usage: {memory.percent:.1f}%"
            elif memory.percent > 85:
                if status == "healthy":
                    status = "degraded"
                details["memory"] = f"High memory usage: {memory.percent:.1f}%"

            # Disk health
            disk_percent = (disk_usage.used / disk_usage.total) * 100
            if disk_percent > 95:
                status = "unhealthy"
                details["disk"] = f"Critical disk usage: {disk_percent:.1f}%"
            elif disk_percent > 85:
                if status == "healthy":
                    status = "degraded"
                details["disk"] = f"High disk usage: {disk_percent:.1f}%"

            # Calculate averages
            avg_cpu = statistics.mean(self.cpu_history) if self.cpu_history else cpu_percent
            avg_memory = statistics.mean(self.memory_history) if self.memory_history else memory.percent
            avg_disk = statistics.mean(self.disk_history) if self.disk_history else disk_percent

            metrics = {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "disk_percent": disk_percent,
                "avg_cpu_1min": avg_cpu,
                "avg_memory_1min": avg_memory,
                "avg_disk_1min": avg_disk
            }

            return HealthStatus(
                service="system",
                status=status,
                timestamp=now,
                details=details,
                metrics=metrics
            )

        except Exception as e:
            logger.error(f"Error checking system health: {e}", exc_info=True)
            return HealthStatus(
                service="system",
                status="unhealthy",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )


class DependencyMonitor(BaseMonitor):
    """Monitor dependency-related metrics."""

    def __init__(self, config: MonitoringConfig):
        super().__init__("dependency", config)
        self.dependency_stats = defaultdict(int)
        self.vulnerability_counts = defaultdict(int)
        self.license_violations = defaultdict(int)

    async def collect_metrics(self) -> list[MetricData]:
        """Collect dependency metrics."""
        try:
            metrics = []
            now = datetime.utcnow()

            # Simulate dependency metrics collection
            # In production, this would query the actual dependency database

            # Total dependencies
            total_deps = 1500  # Simulated
            metrics.append(MetricData("dependency.total", total_deps, now, {"type": "count"}))

            # Dependencies by ecosystem
            ecosystem_counts = {
                "pypi": 600,
                "npm": 400,
                "maven": 300,
                "nuget": 150,
                "cargo": 50
            }

            for ecosystem, count in ecosystem_counts.items():
                metrics.append(MetricData("dependency.by_ecosystem", count, now, {"ecosystem": ecosystem}))

            # Vulnerable dependencies
            vulnerable_deps = 25  # Simulated
            metrics.append(MetricData("dependency.vulnerable", vulnerable_deps, now, {"type": "count"}))

            # Outdated dependencies
            outdated_deps = 180  # Simulated
            metrics.append(MetricData("dependency.outdated", outdated_deps, now, {"type": "count"}))

            # License violations
            license_violations = 12  # Simulated
            metrics.append(MetricData("dependency.license_violations", license_violations, now, {"type": "count"}))

            # Dependency resolution time
            resolution_time = 2.5  # Simulated seconds
            metrics.append(MetricData("dependency.resolution_time", resolution_time, now, {"type": "duration"}))

            # Package download rate
            download_rate = 45.2  # Simulated packages/minute
            metrics.append(MetricData("dependency.download_rate", download_rate, now, {"type": "rate"}))

            # Dependency conflicts
            conflicts = 8  # Simulated
            metrics.append(MetricData("dependency.conflicts", conflicts, now, {"type": "count"}))

            return metrics

        except Exception as e:
            logger.error(f"Error collecting dependency metrics: {e}", exc_info=True)
            return []

    async def check_health(self) -> HealthStatus:
        """Check dependency system health."""
        try:
            now = datetime.utcnow()

            # Simulate health check
            status = "healthy"
            details = {}

            # Check for high vulnerability count
            vulnerable_deps = 25  # Simulated
            if vulnerable_deps > 50:
                status = "unhealthy"
                details["vulnerabilities"] = f"High number of vulnerable dependencies: {vulnerable_deps}"
            elif vulnerable_deps > 20:
                status = "degraded"
                details["vulnerabilities"] = f"Elevated vulnerable dependencies: {vulnerable_deps}"

            # Check for resolution time
            resolution_time = 2.5  # Simulated
            if resolution_time > 10:
                status = "unhealthy"
                details["resolution"] = f"Slow dependency resolution: {resolution_time}s"
            elif resolution_time > 5:
                if status == "healthy":
                    status = "degraded"
                details["resolution"] = f"Slow dependency resolution: {resolution_time}s"

            # Check for conflicts
            conflicts = 8  # Simulated
            if conflicts > 20:
                status = "unhealthy"
                details["conflicts"] = f"High number of dependency conflicts: {conflicts}"
            elif conflicts > 10:
                if status == "healthy":
                    status = "degraded"
                details["conflicts"] = f"Elevated dependency conflicts: {conflicts}"

            metrics = {
                "total_dependencies": 1500,
                "vulnerable_dependencies": vulnerable_deps,
                "outdated_dependencies": 180,
                "license_violations": 12,
                "resolution_time": resolution_time,
                "conflicts": conflicts
            }

            return HealthStatus(
                service="dependency",
                status=status,
                timestamp=now,
                details=details,
                metrics=metrics
            )

        except Exception as e:
            logger.error(f"Error checking dependency health: {e}", exc_info=True)
            return HealthStatus(
                service="dependency",
                status="unhealthy",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )


class SecurityMonitor(BaseMonitor):
    """Monitor security-related events and metrics."""

    def __init__(self, config: MonitoringConfig):
        super().__init__("security", config)
        self.security_events = deque(maxlen=1000)
        self.threat_levels = defaultdict(int)

    async def collect_metrics(self) -> list[MetricData]:
        """Collect security metrics."""
        try:
            metrics = []
            now = datetime.utcnow()

            # Simulate security metrics collection
            # In production, this would query security databases and logs

            # Vulnerability counts by severity
            vuln_counts = {
                "critical": 3,
                "high": 8,
                "medium": 15,
                "low": 25
            }

            for severity, count in vuln_counts.items():
                metrics.append(MetricData("security.vulnerabilities", count, now, {"severity": severity}))

            # Security events
            security_events = 12  # Simulated
            metrics.append(MetricData("security.events", security_events, now, {"type": "count"}))

            # Failed authentication attempts
            failed_auth = 5  # Simulated
            metrics.append(MetricData("security.failed_auth", failed_auth, now, {"type": "count"}))

            # Policy violations
            policy_violations = 7  # Simulated
            metrics.append(MetricData("security.policy_violations", policy_violations, now, {"type": "count"}))

            # License violations
            license_violations = 4  # Simulated
            metrics.append(MetricData("security.license_violations", license_violations, now, {"type": "count"}))

            # Threat detection rate
            threat_rate = 2.3  # Simulated threats/hour
            metrics.append(MetricData("security.threat_rate", threat_rate, now, {"type": "rate"}))

            # Security scan duration
            scan_duration = 45.2  # Simulated seconds
            metrics.append(MetricData("security.scan_duration", scan_duration, now, {"type": "duration"}))

            # Compliance score
            compliance_score = 87.5  # Simulated percentage
            metrics.append(MetricData("security.compliance_score", compliance_score, now, {"type": "score"}))

            return metrics

        except Exception as e:
            logger.error(f"Error collecting security metrics: {e}", exc_info=True)
            return []

    async def check_health(self) -> HealthStatus:
        """Check security system health."""
        try:
            now = datetime.utcnow()

            # Simulate security health check
            status = "healthy"
            details = {}

            # Check for critical vulnerabilities
            critical_vulns = 3  # Simulated
            if critical_vulns > 5:
                status = "unhealthy"
                details["critical_vulns"] = f"High number of critical vulnerabilities: {critical_vulns}"
            elif critical_vulns > 2:
                status = "degraded"
                details["critical_vulns"] = f"Critical vulnerabilities detected: {critical_vulns}"

            # Check for failed authentication
            failed_auth = 5  # Simulated
            if failed_auth > 20:
                status = "unhealthy"
                details["auth_failures"] = f"High number of failed authentication attempts: {failed_auth}"
            elif failed_auth > 10:
                if status == "healthy":
                    status = "degraded"
                details["auth_failures"] = f"Elevated authentication failures: {failed_auth}"

            # Check compliance score
            compliance_score = 87.5  # Simulated
            if compliance_score < 70:
                status = "unhealthy"
                details["compliance"] = f"Low compliance score: {compliance_score}%"
            elif compliance_score < 80:
                if status == "healthy":
                    status = "degraded"
                details["compliance"] = f"Below target compliance score: {compliance_score}%"

            metrics = {
                "critical_vulnerabilities": critical_vulns,
                "high_vulnerabilities": 8,
                "medium_vulnerabilities": 15,
                "low_vulnerabilities": 25,
                "security_events": 12,
                "failed_auth": failed_auth,
                "policy_violations": 7,
                "compliance_score": compliance_score
            }

            return HealthStatus(
                service="security",
                status=status,
                timestamp=now,
                details=details,
                metrics=metrics
            )

        except Exception as e:
            logger.error(f"Error checking security health: {e}", exc_info=True)
            return HealthStatus(
                service="security",
                status="unhealthy",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )


class PerformanceMonitor(BaseMonitor):
    """Monitor application performance metrics."""

    def __init__(self, config: MonitoringConfig):
        super().__init__("performance", config)
        self.response_times = deque(maxlen=1000)
        self.throughput_history = deque(maxlen=100)
        self.error_rates = deque(maxlen=100)

    async def collect_metrics(self) -> list[MetricData]:
        """Collect performance metrics."""
        try:
            metrics = []
            now = datetime.utcnow()

            # Simulate performance metrics collection
            # In production, this would collect from application metrics

            # API response times
            avg_response_time = 125.5  # Simulated milliseconds
            p95_response_time = 450.2  # Simulated milliseconds
            p99_response_time = 1200.8  # Simulated milliseconds

            metrics.extend([
                MetricData("performance.response_time", avg_response_time, now, {"percentile": "avg"}),
                MetricData("performance.response_time", p95_response_time, now, {"percentile": "p95"}),
                MetricData("performance.response_time", p99_response_time, now, {"percentile": "p99"})
            ])

            # Throughput
            requests_per_second = 1250.5  # Simulated
            metrics.append(MetricData("performance.throughput", requests_per_second, now, {"type": "rps"}))

            # Error rates
            error_rate = 0.5  # Simulated percentage
            metrics.append(MetricData("performance.error_rate", error_rate, now, {"type": "percentage"}))

            # Database performance
            db_query_time = 45.2  # Simulated milliseconds
            db_connections = 25  # Simulated
            metrics.extend([
                MetricData("performance.db_query_time", db_query_time, now, {"type": "duration"}),
                MetricData("performance.db_connections", db_connections, now, {"type": "count"})
            ])

            # Cache performance
            cache_hit_rate = 87.5  # Simulated percentage
            cache_size = 1024 * 1024 * 256  # Simulated bytes (256MB)
            metrics.extend([
                MetricData("performance.cache_hit_rate", cache_hit_rate, now, {"type": "percentage"}),
                MetricData("performance.cache_size", cache_size, now, {"type": "bytes"})
            ])

            # Memory usage
            memory_usage = 512 * 1024 * 1024  # Simulated bytes (512MB)
            metrics.append(MetricData("performance.memory_usage", memory_usage, now, {"type": "bytes"}))

            # Active connections
            active_connections = 150  # Simulated
            metrics.append(MetricData("performance.active_connections", active_connections, now, {"type": "count"}))

            return metrics

        except Exception as e:
            logger.error(f"Error collecting performance metrics: {e}", exc_info=True)
            return []

    async def check_health(self) -> HealthStatus:
        """Check performance health."""
        try:
            now = datetime.utcnow()

            # Simulate performance health check
            status = "healthy"
            details = {}

            # Check response time
            avg_response_time = 125.5  # Simulated
            if avg_response_time > 2000:
                status = "unhealthy"
                details["response_time"] = f"Very slow response time: {avg_response_time}ms"
            elif avg_response_time > 1000:
                status = "degraded"
                details["response_time"] = f"Slow response time: {avg_response_time}ms"

            # Check error rate
            error_rate = 0.5  # Simulated
            if error_rate > 5:
                status = "unhealthy"
                details["error_rate"] = f"High error rate: {error_rate}%"
            elif error_rate > 2:
                if status == "healthy":
                    status = "degraded"
                details["error_rate"] = f"Elevated error rate: {error_rate}%"

            # Check throughput
            throughput = 1250.5  # Simulated
            if throughput < 100:
                status = "unhealthy"
                details["throughput"] = f"Low throughput: {throughput} rps"
            elif throughput < 500:
                if status == "healthy":
                    status = "degraded"
                details["throughput"] = f"Reduced throughput: {throughput} rps"

            metrics = {
                "avg_response_time": avg_response_time,
                "p95_response_time": 450.2,
                "p99_response_time": 1200.8,
                "throughput": throughput,
                "error_rate": error_rate,
                "db_query_time": 45.2,
                "cache_hit_rate": 87.5,
                "active_connections": 150
            }

            return HealthStatus(
                service="performance",
                status=status,
                timestamp=now,
                details=details,
                metrics=metrics
            )

        except Exception as e:
            logger.error(f"Error checking performance health: {e}", exc_info=True)
            return HealthStatus(
                service="performance",
                status="unhealthy",
                timestamp=datetime.utcnow(),
                details={"error": str(e)}
            )


class HealthChecker:
    """Comprehensive health checking system."""

    def __init__(self, monitors: list[BaseMonitor]):
        self.monitors = {monitor.name: monitor for monitor in monitors}
        self.health_history = deque(maxlen=1000)
        self.overall_health = "unknown"

    async def check_all_health(self) -> dict[str, HealthStatus]:
        """Check health of all monitored services."""
        health_statuses = {}

        for name, monitor in self.monitors.items():
            try:
                health = await monitor.check_health()
                health_statuses[name] = health
            except Exception as e:
                logger.error(f"Error checking health for {name}: {e}")
                health_statuses[name] = HealthStatus(
                    service=name,
                    status="unhealthy",
                    timestamp=datetime.utcnow(),
                    details={"error": str(e)}
                )

        # Calculate overall health
        self.overall_health = self._calculate_overall_health(health_statuses)

        # Store in history
        self.health_history.append({
            "timestamp": datetime.utcnow(),
            "overall_health": self.overall_health,
            "services": health_statuses
        })

        return health_statuses

    def _calculate_overall_health(self, health_statuses: dict[str, HealthStatus]) -> str:
        """Calculate overall system health."""
        if not health_statuses:
            return "unknown"

        statuses = [health.status for health in health_statuses.values()]

        if "unhealthy" in statuses:
            return "unhealthy"
        elif "degraded" in statuses:
            return "degraded"
        else:
            return "healthy"

    def get_health_summary(self) -> dict[str, Any]:
        """Get a summary of system health."""
        if not self.health_history:
            return {"overall_health": "unknown", "services": {}}

        latest = self.health_history[-1]
        return {
            "overall_health": latest["overall_health"],
            "timestamp": latest["timestamp"],
            "services": {
                name: {
                    "status": health.status,
                    "details": health.details,
                    "metrics": health.metrics
                }
                for name, health in latest["services"].items()
            }
        }

    def get_health_history(self, duration_seconds: int = 3600) -> list[dict[str, Any]]:
        """Get health history for the specified duration."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        return [
            entry for entry in self.health_history
            if entry["timestamp"] >= cutoff_time
        ]
