"""
Docker container monitoring and resource tracking.

This module provides real-time monitoring capabilities for Docker containers,
including resource usage tracking, log streaming, and health monitoring.
"""

import logging
import time
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Callable, Iterator, Any
from queue import Queue, Empty
import json

try:
    import docker
    from docker.models.containers import Container
    from docker.errors import DockerException, NotFound, APIError
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False
    docker = None
    Container = None
    DockerException = Exception
    NotFound = Exception
    APIError = Exception

logger = logging.getLogger(__name__)


class MonitoringStatus(Enum):
    """Container monitoring status"""
    MONITORING = "monitoring"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class ResourceUsage:
    """Container resource usage metrics"""
    timestamp: datetime
    cpu_percent: float
    memory_usage: int  # bytes
    memory_limit: int  # bytes
    memory_percent: float
    network_rx_bytes: int
    network_tx_bytes: int
    block_read_bytes: int
    block_write_bytes: int
    pids: int


@dataclass
class ContainerHealth:
    """Container health status"""
    container_id: str
    status: str
    health_status: Optional[str] = None
    last_health_check: Optional[datetime] = None
    restart_count: int = 0
    uptime: Optional[timedelta] = None
    exit_code: Optional[int] = None


@dataclass
class LogEntry:
    """Container log entry"""
    timestamp: datetime
    message: str
    stream: str  # 'stdout' or 'stderr'
    container_id: str


@dataclass
class MonitoringConfig:
    """Configuration for container monitoring"""
    update_interval: float = 5.0  # seconds
    max_log_entries: int = 1000
    resource_history_size: int = 100
    enable_log_streaming: bool = True
    enable_resource_monitoring: bool = True
    alert_thresholds: Dict[str, float] = field(default_factory=lambda: {
        'cpu_percent': 80.0,
        'memory_percent': 85.0,
        'disk_usage_percent': 90.0
    })


class ContainerMonitor:
    """
    Monitors a single Docker container for resource usage, logs, and health.
    """
    
    def __init__(self, container_id: str, docker_client, config: MonitoringConfig):
        """
        Initialize container monitor.
        
        Args:
            container_id: Container ID to monitor
            docker_client: Docker client instance
            config: Monitoring configuration
        """
        self.container_id = container_id
        self.client = docker_client
        self.config = config
        
        self._monitoring = False
        self._monitor_thread: Optional[threading.Thread] = None
        self._log_thread: Optional[threading.Thread] = None
        
        # Resource usage history
        self._resource_history: List[ResourceUsage] = []
        self._resource_lock = threading.Lock()
        
        # Log entries
        self._log_entries: List[LogEntry] = []
        self._log_lock = threading.Lock()
        
        # Callbacks
        self._resource_callbacks: List[Callable[[ResourceUsage], None]] = []
        self._log_callbacks: List[Callable[[LogEntry], None]] = []
        self._health_callbacks: List[Callable[[ContainerHealth], None]] = []
        self._alert_callbacks: List[Callable[[str, str, Any], None]] = []
        
        # Current health status
        self._current_health: Optional[ContainerHealth] = None
    
    def start_monitoring(self):
        """Start monitoring the container"""
        if self._monitoring:
            return
        
        self._monitoring = True
        
        if self.config.enable_resource_monitoring:
            self._monitor_thread = threading.Thread(
                target=self._monitor_resources,
                daemon=True,
                name=f"monitor-{self.container_id[:12]}"
            )
            self._monitor_thread.start()
        
        if self.config.enable_log_streaming:
            self._log_thread = threading.Thread(
                target=self._stream_logs,
                daemon=True,
                name=f"logs-{self.container_id[:12]}"
            )
            self._log_thread.start()
        
        logger.info(f"Started monitoring container: {self.container_id[:12]}")
    
    def stop_monitoring(self):
        """Stop monitoring the container"""
        self._monitoring = False
        
        if self._monitor_thread and self._monitor_thread.is_alive():
            self._monitor_thread.join(timeout=5.0)
        
        if self._log_thread and self._log_thread.is_alive():
            self._log_thread.join(timeout=5.0)
        
        logger.info(f"Stopped monitoring container: {self.container_id[:12]}")
    
    def add_resource_callback(self, callback: Callable[[ResourceUsage], None]):
        """Add callback for resource usage updates"""
        self._resource_callbacks.append(callback)
    
    def add_log_callback(self, callback: Callable[[LogEntry], None]):
        """Add callback for log entries"""
        self._log_callbacks.append(callback)
    
    def add_health_callback(self, callback: Callable[[ContainerHealth], None]):
        """Add callback for health status updates"""
        self._health_callbacks.append(callback)
    
    def add_alert_callback(self, callback: Callable[[str, str, Any], None]):
        """Add callback for alerts"""
        self._alert_callbacks.append(callback)
    
    def get_resource_history(self, limit: Optional[int] = None) -> List[ResourceUsage]:
        """Get resource usage history"""
        with self._resource_lock:
            if limit:
                return self._resource_history[-limit:]
            return self._resource_history.copy()
    
    def get_recent_logs(self, limit: Optional[int] = None) -> List[LogEntry]:
        """Get recent log entries"""
        with self._log_lock:
            if limit:
                return self._log_entries[-limit:]
            return self._log_entries.copy()
    
    def get_current_health(self) -> Optional[ContainerHealth]:
        """Get current health status"""
        return self._current_health
    
    def _monitor_resources(self):
        """Monitor container resource usage"""
        while self._monitoring:
            try:
                container = self.client.containers.get(self.container_id)
                stats = container.stats(stream=False)
                
                # Parse resource usage
                resource_usage = self._parse_stats(stats)
                
                # Store in history
                with self._resource_lock:
                    self._resource_history.append(resource_usage)
                    if len(self._resource_history) > self.config.resource_history_size:
                        self._resource_history.pop(0)
                
                # Check for alerts
                self._check_resource_alerts(resource_usage)
                
                # Notify callbacks
                for callback in self._resource_callbacks:
                    try:
                        callback(resource_usage)
                    except Exception as e:
                        logger.error(f"Error in resource callback: {e}")
                
                # Update health status
                self._update_health_status(container)
                
            except Exception as e:
                logger.error(f"Error monitoring container {self.container_id[:12]}: {e}")
                time.sleep(1)  # Brief pause on error
            
            time.sleep(self.config.update_interval)
    
    def _stream_logs(self):
        """Stream container logs"""
        try:
            container = self.client.containers.get(self.container_id)
            
            # Get log stream
            log_stream = container.logs(
                stream=True,
                follow=True,
                timestamps=True,
                stdout=True,
                stderr=True
            )
            
            for log_line in log_stream:
                if not self._monitoring:
                    break
                
                try:
                    # Parse log line
                    log_entry = self._parse_log_line(log_line)
                    
                    # Store log entry
                    with self._log_lock:
                        self._log_entries.append(log_entry)
                        if len(self._log_entries) > self.config.max_log_entries:
                            self._log_entries.pop(0)
                    
                    # Notify callbacks
                    for callback in self._log_callbacks:
                        try:
                            callback(log_entry)
                        except Exception as e:
                            logger.error(f"Error in log callback: {e}")
                
                except Exception as e:
                    logger.error(f"Error parsing log line: {e}")
        
        except Exception as e:
            logger.error(f"Error streaming logs for container {self.container_id[:12]}: {e}")
    
    def _parse_stats(self, stats: Dict[str, Any]) -> ResourceUsage:
        """Parse Docker stats into ResourceUsage object"""
        # CPU usage calculation
        cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                   stats['precpu_stats']['cpu_usage']['total_usage']
        system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                      stats['precpu_stats']['system_cpu_usage']
        
        cpu_percent = 0.0
        if system_delta > 0:
            cpu_count = len(stats['cpu_stats']['cpu_usage']['percpu_usage'])
            cpu_percent = (cpu_delta / system_delta) * cpu_count * 100.0
        
        # Memory usage
        memory_usage = stats['memory_stats']['usage']
        memory_limit = stats['memory_stats']['limit']
        memory_percent = (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0
        
        # Network I/O
        network_rx = 0
        network_tx = 0
        if 'networks' in stats:
            for interface in stats['networks'].values():
                network_rx += interface.get('rx_bytes', 0)
                network_tx += interface.get('tx_bytes', 0)
        
        # Block I/O
        block_read = 0
        block_write = 0
        if 'blkio_stats' in stats and 'io_service_bytes_recursive' in stats['blkio_stats']:
            for entry in stats['blkio_stats']['io_service_bytes_recursive']:
                if entry['op'] == 'Read':
                    block_read += entry['value']
                elif entry['op'] == 'Write':
                    block_write += entry['value']
        
        # Process count
        pids = stats.get('pids_stats', {}).get('current', 0)
        
        return ResourceUsage(
            timestamp=datetime.now(),
            cpu_percent=cpu_percent,
            memory_usage=memory_usage,
            memory_limit=memory_limit,
            memory_percent=memory_percent,
            network_rx_bytes=network_rx,
            network_tx_bytes=network_tx,
            block_read_bytes=block_read,
            block_write_bytes=block_write,
            pids=pids
        )
    
    def _parse_log_line(self, log_line: bytes) -> LogEntry:
        """Parse a log line into LogEntry object"""
        log_str = log_line.decode('utf-8').strip()
        
        # Try to parse timestamp (Docker format: 2023-01-01T00:00:00.000000000Z message)
        timestamp = datetime.now()
        message = log_str
        stream = 'stdout'  # Default
        
        if ' ' in log_str:
            timestamp_str, message = log_str.split(' ', 1)
            try:
                # Parse Docker timestamp format
                timestamp = datetime.fromisoformat(
                    timestamp_str.replace('Z', '+00:00').split('.')[0]
                )
            except ValueError:
                # If parsing fails, use current time and include timestamp in message
                message = log_str
        
        return LogEntry(
            timestamp=timestamp,
            message=message,
            stream=stream,
            container_id=self.container_id
        )
    
    def _update_health_status(self, container: Container):
        """Update container health status"""
        try:
            container.reload()
            
            # Calculate uptime
            uptime = None
            if container.attrs.get('State', {}).get('StartedAt'):
                started_at_str = container.attrs['State']['StartedAt']
                if started_at_str != "0001-01-01T00:00:00Z":
                    started_at = datetime.fromisoformat(
                        started_at_str.replace('Z', '+00:00')
                    )
                    uptime = datetime.now(started_at.tzinfo) - started_at
            
            # Get health status
            health_status = None
            last_health_check = None
            if 'Health' in container.attrs.get('State', {}):
                health_info = container.attrs['State']['Health']
                health_status = health_info.get('Status')
                if health_info.get('Log'):
                    last_check = health_info['Log'][-1]
                    last_health_check = datetime.fromisoformat(
                        last_check['Start'].replace('Z', '+00:00')
                    )
            
            health = ContainerHealth(
                container_id=self.container_id,
                status=container.status,
                health_status=health_status,
                last_health_check=last_health_check,
                restart_count=container.attrs.get('RestartCount', 0),
                uptime=uptime,
                exit_code=container.attrs.get('State', {}).get('ExitCode')
            )
            
            self._current_health = health
            
            # Notify health callbacks
            for callback in self._health_callbacks:
                try:
                    callback(health)
                except Exception as e:
                    logger.error(f"Error in health callback: {e}")
        
        except Exception as e:
            logger.error(f"Error updating health status: {e}")
    
    def _check_resource_alerts(self, usage: ResourceUsage):
        """Check resource usage against alert thresholds"""
        alerts = []
        
        # CPU alert
        if usage.cpu_percent > self.config.alert_thresholds.get('cpu_percent', 80.0):
            alerts.append(('cpu_high', f'CPU usage: {usage.cpu_percent:.1f}%', usage.cpu_percent))
        
        # Memory alert
        if usage.memory_percent > self.config.alert_thresholds.get('memory_percent', 85.0):
            alerts.append(('memory_high', f'Memory usage: {usage.memory_percent:.1f}%', usage.memory_percent))
        
        # Send alerts
        for alert_type, message, value in alerts:
            for callback in self._alert_callbacks:
                try:
                    callback(alert_type, message, value)
                except Exception as e:
                    logger.error(f"Error in alert callback: {e}")


class DockerMonitoringManager:
    """
    Manages monitoring for multiple Docker containers.
    """
    
    def __init__(self, docker_client):
        """
        Initialize monitoring manager.
        
        Args:
            docker_client: Docker client instance
        """
        self.client = docker_client
        self.monitors: Dict[str, ContainerMonitor] = {}
        self.config = MonitoringConfig()
        
        # Global callbacks
        self._global_resource_callbacks: List[Callable[[str, ResourceUsage], None]] = []
        self._global_log_callbacks: List[Callable[[str, LogEntry], None]] = []
        self._global_health_callbacks: List[Callable[[str, ContainerHealth], None]] = []
        self._global_alert_callbacks: List[Callable[[str, str, str, Any], None]] = []
    
    def start_monitoring_container(self, container_id: str, 
                                 config: Optional[MonitoringConfig] = None):
        """
        Start monitoring a container.
        
        Args:
            container_id: Container ID to monitor
            config: Optional monitoring configuration
        """
        if container_id in self.monitors:
            logger.warning(f"Container {container_id[:12]} is already being monitored")
            return
        
        monitor_config = config or self.config
        monitor = ContainerMonitor(container_id, self.client, monitor_config)
        
        # Add global callbacks
        monitor.add_resource_callback(
            lambda usage: self._notify_global_resource_callbacks(container_id, usage)
        )
        monitor.add_log_callback(
            lambda entry: self._notify_global_log_callbacks(container_id, entry)
        )
        monitor.add_health_callback(
            lambda health: self._notify_global_health_callbacks(container_id, health)
        )
        monitor.add_alert_callback(
            lambda alert_type, message, value: self._notify_global_alert_callbacks(
                container_id, alert_type, message, value
            )
        )
        
        self.monitors[container_id] = monitor
        monitor.start_monitoring()
        
        logger.info(f"Started monitoring container: {container_id[:12]}")
    
    def stop_monitoring_container(self, container_id: str):
        """
        Stop monitoring a container.
        
        Args:
            container_id: Container ID to stop monitoring
        """
        if container_id not in self.monitors:
            logger.warning(f"Container {container_id[:12]} is not being monitored")
            return
        
        monitor = self.monitors[container_id]
        monitor.stop_monitoring()
        del self.monitors[container_id]
        
        logger.info(f"Stopped monitoring container: {container_id[:12]}")
    
    def get_container_monitor(self, container_id: str) -> Optional[ContainerMonitor]:
        """Get monitor for a specific container"""
        return self.monitors.get(container_id)
    
    def get_all_monitored_containers(self) -> List[str]:
        """Get list of all monitored container IDs"""
        return list(self.monitors.keys())
    
    def stop_all_monitoring(self):
        """Stop monitoring all containers"""
        for container_id in list(self.monitors.keys()):
            self.stop_monitoring_container(container_id)
    
    def add_global_resource_callback(self, callback: Callable[[str, ResourceUsage], None]):
        """Add global callback for resource usage updates"""
        self._global_resource_callbacks.append(callback)
    
    def add_global_log_callback(self, callback: Callable[[str, LogEntry], None]):
        """Add global callback for log entries"""
        self._global_log_callbacks.append(callback)
    
    def add_global_health_callback(self, callback: Callable[[str, ContainerHealth], None]):
        """Add global callback for health status updates"""
        self._global_health_callbacks.append(callback)
    
    def add_global_alert_callback(self, callback: Callable[[str, str, str, Any], None]):
        """Add global callback for alerts"""
        self._global_alert_callbacks.append(callback)
    
    def _notify_global_resource_callbacks(self, container_id: str, usage: ResourceUsage):
        """Notify global resource callbacks"""
        for callback in self._global_resource_callbacks:
            try:
                callback(container_id, usage)
            except Exception as e:
                logger.error(f"Error in global resource callback: {e}")
    
    def _notify_global_log_callbacks(self, container_id: str, entry: LogEntry):
        """Notify global log callbacks"""
        for callback in self._global_log_callbacks:
            try:
                callback(container_id, entry)
            except Exception as e:
                logger.error(f"Error in global log callback: {e}")
    
    def _notify_global_health_callbacks(self, container_id: str, health: ContainerHealth):
        """Notify global health callbacks"""
        for callback in self._global_health_callbacks:
            try:
                callback(container_id, health)
            except Exception as e:
                logger.error(f"Error in global health callback: {e}")
    
    def _notify_global_alert_callbacks(self, container_id: str, alert_type: str, 
                                     message: str, value: Any):
        """Notify global alert callbacks"""
        for callback in self._global_alert_callbacks:
            try:
                callback(container_id, alert_type, message, value)
            except Exception as e:
                logger.error(f"Error in global alert callback: {e}")