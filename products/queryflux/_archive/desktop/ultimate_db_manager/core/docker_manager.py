"""
Docker container management for database deployments.

This module provides Docker container lifecycle management, template system,
and monitoring capabilities for database containers.
"""

import logging
import socket
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Callable
from pathlib import Path
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

# Import monitoring components
from .docker_monitoring import (
    DockerMonitoringManager,
    ContainerMonitor,
    MonitoringConfig,
    ResourceUsage,
    ContainerHealth,
    LogEntry
)

logger = logging.getLogger(__name__)


class DatabaseType(Enum):
    """Supported database types for containers"""
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MONGODB = "mongodb"
    REDIS = "redis"
    SQLITE = "sqlite"


class ContainerStatus(Enum):
    """Container status states"""
    RUNNING = "running"
    STOPPED = "exited"
    PAUSED = "paused"
    RESTARTING = "restarting"
    REMOVING = "removing"
    DEAD = "dead"
    CREATED = "created"
    UNKNOWN = "unknown"


@dataclass
class VolumeMount:
    """Volume mount configuration"""
    host_path: str
    container_path: str
    mode: str = "rw"


@dataclass
class ResourceLimits:
    """Container resource limits"""
    memory: Optional[str] = None  # e.g., "512m", "1g"
    cpu_count: Optional[float] = None  # e.g., 0.5, 1.0
    cpu_percent: Optional[int] = None  # e.g., 50 for 50%


@dataclass
class ContainerConfig:
    """Docker container configuration"""
    name: str
    db_type: DatabaseType
    port: Optional[int] = None
    environment_vars: Dict[str, str] = field(default_factory=dict)
    volume_mounts: List[VolumeMount] = field(default_factory=list)
    resource_limits: Optional[ResourceLimits] = None
    auto_start: bool = True
    backup_schedule: Optional[str] = None


@dataclass
class ContainerInfo:
    """Container information and status"""
    container_id: str
    name: str
    db_type: DatabaseType
    status: ContainerStatus
    image: str
    ports: Dict[str, int]
    created_at: datetime
    started_at: Optional[datetime] = None
    volumes: List[str] = field(default_factory=list)
    environment: Dict[str, str] = field(default_factory=dict)
    resource_usage: Optional[Dict[str, Any]] = None


@dataclass
class ContainerTemplate:
    """Database container template"""
    db_type: DatabaseType
    image: str
    default_port: int
    internal_port: int
    data_path: str
    default_env_vars: Dict[str, str] = field(default_factory=dict)
    required_env_vars: List[str] = field(default_factory=list)
    health_check_command: Optional[str] = None
    
    def get_env_vars(self, config: ContainerConfig) -> Dict[str, str]:
        """Get environment variables for container"""
        env_vars = self.default_env_vars.copy()
        env_vars.update(config.environment_vars)
        return env_vars


class DockerManagerError(Exception):
    """Base exception for Docker manager operations"""
    pass


class DockerNotAvailableError(DockerManagerError):
    """Raised when Docker is not available"""
    pass


class ContainerNotFoundError(DockerManagerError):
    """Raised when container is not found"""
    pass


class PortAllocationError(DockerManagerError):
    """Raised when port allocation fails"""
    pass


class DockerManager:
    """
    Manages Docker containers for database deployments.
    
    Provides container lifecycle management, template system, and monitoring
    capabilities for database containers.
    """
    
    def __init__(self):
        """Initialize Docker manager"""
        if not DOCKER_AVAILABLE:
            raise DockerNotAvailableError(
                "Docker library not available. Install with: pip install docker"
            )
        
        try:
            self.client = docker.from_env()
            # Test Docker connection
            self.client.ping()
        except Exception as e:
            raise DockerNotAvailableError(f"Docker daemon not available: {e}")
        
        self.templates = self._load_container_templates()
        self._status_callbacks: List[Callable[[str, ContainerStatus], None]] = []
        
        # Initialize monitoring manager
        self.monitoring_manager = DockerMonitoringManager(self.client)
    
    def _load_container_templates(self) -> Dict[DatabaseType, ContainerTemplate]:
        """Load container templates for different database types"""
        return {
            DatabaseType.POSTGRESQL: ContainerTemplate(
                db_type=DatabaseType.POSTGRESQL,
                image="postgres:15-alpine",
                default_port=5432,
                internal_port=5432,
                data_path="/var/lib/postgresql/data",
                default_env_vars={
                    "POSTGRES_DB": "postgres",
                    "POSTGRES_USER": "postgres",
                    "POSTGRES_PASSWORD": "postgres"
                },
                required_env_vars=["POSTGRES_PASSWORD"],
                health_check_command="pg_isready -U postgres"
            ),
            DatabaseType.MYSQL: ContainerTemplate(
                db_type=DatabaseType.MYSQL,
                image="mysql:8.0",
                default_port=3306,
                internal_port=3306,
                data_path="/var/lib/mysql",
                default_env_vars={
                    "MYSQL_DATABASE": "mysql",
                    "MYSQL_USER": "mysql",
                    "MYSQL_PASSWORD": "mysql",
                    "MYSQL_ROOT_PASSWORD": "rootpassword"
                },
                required_env_vars=["MYSQL_ROOT_PASSWORD"],
                health_check_command="mysqladmin ping -h localhost"
            ),
            DatabaseType.MONGODB: ContainerTemplate(
                db_type=DatabaseType.MONGODB,
                image="mongo:6.0",
                default_port=27017,
                internal_port=27017,
                data_path="/data/db",
                default_env_vars={
                    "MONGO_INITDB_ROOT_USERNAME": "admin",
                    "MONGO_INITDB_ROOT_PASSWORD": "password"
                },
                required_env_vars=["MONGO_INITDB_ROOT_PASSWORD"],
                health_check_command="mongosh --eval 'db.runCommand(\"ping\")'"
            ),
            DatabaseType.REDIS: ContainerTemplate(
                db_type=DatabaseType.REDIS,
                image="redis:7-alpine",
                default_port=6379,
                internal_port=6379,
                data_path="/data",
                default_env_vars={},
                required_env_vars=[],
                health_check_command="redis-cli ping"
            ),
            DatabaseType.SQLITE: ContainerTemplate(
                db_type=DatabaseType.SQLITE,
                image="alpine:latest",
                default_port=0,  # SQLite doesn't use network ports
                internal_port=0,
                data_path="/data",
                default_env_vars={},
                required_env_vars=[],
                health_check_command="test -f /data/database.db"
            )
        }
    
    def add_status_callback(self, callback: Callable[[str, ContainerStatus], None]):
        """Add callback for container status changes"""
        self._status_callbacks.append(callback)
    
    def remove_status_callback(self, callback: Callable[[str, ContainerStatus], None]):
        """Remove status change callback"""
        if callback in self._status_callbacks:
            self._status_callbacks.remove(callback)
    
    def _notify_status_change(self, container_id: str, status: ContainerStatus):
        """Notify all callbacks of status change"""
        for callback in self._status_callbacks:
            try:
                callback(container_id, status)
            except Exception as e:
                logger.error(f"Error in status callback: {e}")
    
    def list_database_containers(self) -> List[ContainerInfo]:
        """
        List all database containers managed by this system.
        
        Returns:
            List of ContainerInfo objects for database containers
        """
        try:
            containers = []
            for container in self.client.containers.list(all=True):
                if self._is_database_container(container):
                    container_info = self._container_to_info(container)
                    containers.append(container_info)
            return containers
        except DockerException as e:
            raise DockerManagerError(f"Failed to list containers: {e}")
    
    def _is_database_container(self, container: Container) -> bool:
        """Check if container is a database container managed by this system"""
        # Check if container has our management label
        labels = container.labels or {}
        return labels.get("managed_by") == "ultimate_db_manager"
    
    def _container_to_info(self, container: Container) -> ContainerInfo:
        """Convert Docker container to ContainerInfo"""
        # Parse container status
        status_map = {
            "running": ContainerStatus.RUNNING,
            "exited": ContainerStatus.STOPPED,
            "paused": ContainerStatus.PAUSED,
            "restarting": ContainerStatus.RESTARTING,
            "removing": ContainerStatus.REMOVING,
            "dead": ContainerStatus.DEAD,
            "created": ContainerStatus.CREATED
        }
        status = status_map.get(container.status, ContainerStatus.UNKNOWN)
        
        # Parse ports
        ports = {}
        if container.ports:
            for internal_port, external_ports in container.ports.items():
                if external_ports:
                    port_num = int(internal_port.split('/')[0])
                    external_port = external_ports[0]['HostPort']
                    ports[str(port_num)] = int(external_port)
        
        # Parse database type from labels
        labels = container.labels or {}
        db_type_str = labels.get("db_type", "unknown")
        try:
            db_type = DatabaseType(db_type_str)
        except ValueError:
            db_type = DatabaseType.POSTGRESQL  # Default fallback
        
        # Parse timestamps
        created_at = datetime.fromisoformat(
            container.attrs['Created'].replace('Z', '+00:00')
        )
        
        started_at = None
        if container.attrs.get('State', {}).get('StartedAt'):
            started_at_str = container.attrs['State']['StartedAt']
            if started_at_str != "0001-01-01T00:00:00Z":
                started_at = datetime.fromisoformat(
                    started_at_str.replace('Z', '+00:00')
                )
        
        # Parse volumes
        volumes = []
        if container.attrs.get('Mounts'):
            for mount in container.attrs['Mounts']:
                if mount['Type'] == 'volume':
                    volumes.append(mount['Name'])
        
        return ContainerInfo(
            container_id=container.id,
            name=container.name,
            db_type=db_type,
            status=status,
            image=container.image.tags[0] if container.image.tags else "unknown",
            ports=ports,
            created_at=created_at,
            started_at=started_at,
            volumes=volumes,
            environment=container.attrs.get('Config', {}).get('Env', [])
        )
    
    def create_database_container(self, db_type: DatabaseType, 
                                config: ContainerConfig) -> ContainerInfo:
        """
        Create a new database container.
        
        Args:
            db_type: Type of database to create
            config: Container configuration
            
        Returns:
            ContainerInfo for the created container
            
        Raises:
            DockerManagerError: If container creation fails
            PortAllocationError: If port allocation fails
        """
        try:
            template = self.templates.get(db_type)
            if not template:
                raise DockerManagerError(f"No template available for {db_type}")
            
            # Auto-allocate port if not specified
            if not config.port and template.default_port > 0:
                config.port = self._find_available_port(template.default_port)
            
            # Validate required environment variables
            env_vars = template.get_env_vars(config)
            for required_var in template.required_env_vars:
                if required_var not in env_vars:
                    raise DockerManagerError(
                        f"Required environment variable {required_var} not provided"
                    )
            
            # Create volume for data persistence
            volume_name = f"{config.name}_data"
            try:
                self.client.volumes.create(volume_name)
                logger.info(f"Created volume: {volume_name}")
            except APIError as e:
                if "already exists" not in str(e):
                    raise DockerManagerError(f"Failed to create volume: {e}")
            
            # Prepare container configuration
            container_config = {
                "image": template.image,
                "name": config.name,
                "environment": env_vars,
                "labels": {
                    "managed_by": "ultimate_db_manager",
                    "db_type": db_type.value,
                    "created_at": datetime.now().isoformat()
                },
                "volumes": {
                    volume_name: {"bind": template.data_path, "mode": "rw"}
                },
                "detach": True,
                "remove": False
            }
            
            # Add port mapping if needed
            if config.port and template.internal_port > 0:
                container_config["ports"] = {
                    f"{template.internal_port}/tcp": config.port
                }
            
            # Add custom volume mounts
            for mount in config.volume_mounts:
                container_config["volumes"][mount.host_path] = {
                    "bind": mount.container_path,
                    "mode": mount.mode
                }
            
            # Add resource limits
            if config.resource_limits:
                container_config["mem_limit"] = config.resource_limits.memory
                container_config["cpu_count"] = config.resource_limits.cpu_count
                container_config["cpu_percent"] = config.resource_limits.cpu_percent
            
            # Create and start container
            logger.info(f"Creating container: {config.name}")
            container = self.client.containers.run(**container_config)
            
            # Wait for container to be ready
            self._wait_for_container_ready(container, template)
            
            container_info = self._container_to_info(container)
            self._notify_status_change(container_info.container_id, container_info.status)
            
            logger.info(f"Successfully created container: {config.name}")
            return container_info
            
        except DockerException as e:
            raise DockerManagerError(f"Failed to create container: {e}")
    
    def start_container(self, container_id: str) -> bool:
        """
        Start a stopped container.
        
        Args:
            container_id: Container ID or name
            
        Returns:
            True if started successfully
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If start operation fails
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            container.start()
            self._notify_status_change(container_id, ContainerStatus.RUNNING)
            logger.info(f"Started container: {container_id}")
            return True
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to start container: {e}")
    
    def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        """
        Stop a running container.
        
        Args:
            container_id: Container ID or name
            timeout: Timeout in seconds for graceful shutdown
            
        Returns:
            True if stopped successfully
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If stop operation fails
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            container.stop(timeout=timeout)
            self._notify_status_change(container_id, ContainerStatus.STOPPED)
            logger.info(f"Stopped container: {container_id}")
            return True
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to stop container: {e}")
    
    def restart_container(self, container_id: str, timeout: int = 10) -> bool:
        """
        Restart a container.
        
        Args:
            container_id: Container ID or name
            timeout: Timeout in seconds for graceful shutdown
            
        Returns:
            True if restarted successfully
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If restart operation fails
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            container.restart(timeout=timeout)
            self._notify_status_change(container_id, ContainerStatus.RUNNING)
            logger.info(f"Restarted container: {container_id}")
            return True
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to restart container: {e}")
    
    def remove_container(self, container_id: str, force: bool = False, 
                        remove_volumes: bool = False) -> bool:
        """
        Remove a container.
        
        Args:
            container_id: Container ID or name
            force: Force removal of running container
            remove_volumes: Remove associated volumes
            
        Returns:
            True if removed successfully
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If removal fails
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            # Get volume names before removal
            volumes_to_remove = []
            if remove_volumes and container.attrs.get('Mounts'):
                for mount in container.attrs['Mounts']:
                    if mount['Type'] == 'volume':
                        volumes_to_remove.append(mount['Name'])
            
            # Remove container
            container.remove(force=force)
            
            # Remove volumes if requested
            if remove_volumes:
                for volume_name in volumes_to_remove:
                    try:
                        volume = self.client.volumes.get(volume_name)
                        volume.remove()
                        logger.info(f"Removed volume: {volume_name}")
                    except Exception as e:
                        logger.warning(f"Failed to remove volume {volume_name}: {e}")
            
            logger.info(f"Removed container: {container_id}")
            return True
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to remove container: {e}")
    
    def get_container_info(self, container_id: str) -> ContainerInfo:
        """
        Get detailed information about a container.
        
        Args:
            container_id: Container ID or name
            
        Returns:
            ContainerInfo object
            
        Raises:
            ContainerNotFoundError: If container not found
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            return self._container_to_info(container)
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise
    
    def get_container_logs(self, container_id: str, tail: int = 100, 
                          follow: bool = False) -> str:
        """
        Get container logs.
        
        Args:
            container_id: Container ID or name
            tail: Number of lines to return from end of logs
            follow: Follow log output (streaming)
            
        Returns:
            Log output as string
            
        Raises:
            ContainerNotFoundError: If container not found
        """
        try:
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            logs = container.logs(tail=tail, follow=follow, timestamps=True)
            return logs.decode('utf-8') if isinstance(logs, bytes) else logs
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise
    
    def _find_available_port(self, preferred_port: int, 
                           start_range: int = 5432, end_range: int = 6000) -> int:
        """
        Find an available port for container binding.
        
        Args:
            preferred_port: Preferred port number
            start_range: Start of port range to search
            end_range: End of port range to search
            
        Returns:
            Available port number
            
        Raises:
            PortAllocationError: If no available port found
        """
        # First try the preferred port
        if self._is_port_available(preferred_port):
            return preferred_port
        
        # Search in range
        for port in range(start_range, end_range + 1):
            if self._is_port_available(port):
                return port
        
        raise PortAllocationError(
            f"No available ports found in range {start_range}-{end_range}"
        )
    
    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available for binding"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.bind(('localhost', port))
                return True
        except OSError:
            return False
    
    def _wait_for_container_ready(self, container: Container, 
                                template: ContainerTemplate, 
                                timeout: int = 60) -> bool:
        """
        Wait for container to be ready for connections.
        
        Args:
            container: Docker container object
            template: Container template with health check info
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if container is ready
            
        Raises:
            DockerManagerError: If container fails to become ready
        """
        if not template.health_check_command:
            # No health check available, just wait a bit
            time.sleep(2)
            return True
        
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                # Refresh container state
                container.reload()
                if container.status != 'running':
                    time.sleep(1)
                    continue
                
                # Run health check command
                result = container.exec_run(template.health_check_command)
                if result.exit_code == 0:
                    logger.info(f"Container {container.name} is ready")
                    return True
                
            except Exception as e:
                logger.debug(f"Health check failed: {e}")
            
            time.sleep(2)
        
        raise DockerManagerError(
            f"Container {container.name} failed to become ready within {timeout} seconds"
        )
    
    def get_available_templates(self) -> Dict[DatabaseType, ContainerTemplate]:
        """Get all available container templates"""
        return self.templates.copy()
    
    def is_docker_available(self) -> bool:
        """Check if Docker daemon is available"""
        try:
            self.client.ping()
            return True
        except Exception:
            return False 
   # Monitoring Methods
    
    def start_container_monitoring(self, container_id: str, 
                                 config: Optional[MonitoringConfig] = None):
        """
        Start monitoring a container for resource usage and logs.
        
        Args:
            container_id: Container ID or name
            config: Optional monitoring configuration
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If monitoring fails to start
        """
        try:
            # Verify container exists and is managed by us
            container = self.client.containers.get(container_id)
            if not self._is_database_container(container):
                raise DockerManagerError("Container is not managed by this system")
            
            self.monitoring_manager.start_monitoring_container(container.id, config)
            logger.info(f"Started monitoring container: {container_id}")
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to start monitoring: {e}")
    
    def stop_container_monitoring(self, container_id: str):
        """
        Stop monitoring a container.
        
        Args:
            container_id: Container ID or name
            
        Raises:
            ContainerNotFoundError: If container not found
        """
        try:
            container = self.client.containers.get(container_id)
            self.monitoring_manager.stop_monitoring_container(container.id)
            logger.info(f"Stopped monitoring container: {container_id}")
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                # Don't raise error if monitoring wasn't active
                logger.warning(f"Failed to stop monitoring: {e}")
    
    def get_container_resource_usage(self, container_id: str, 
                                   limit: Optional[int] = None) -> List[ResourceUsage]:
        """
        Get resource usage history for a container.
        
        Args:
            container_id: Container ID or name
            limit: Maximum number of entries to return
            
        Returns:
            List of ResourceUsage objects
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If container is not being monitored
        """
        try:
            container = self.client.containers.get(container_id)
            monitor = self.monitoring_manager.get_container_monitor(container.id)
            
            if not monitor:
                raise DockerManagerError(f"Container {container_id} is not being monitored")
            
            return monitor.get_resource_history(limit)
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise
    
    def get_container_health_status(self, container_id: str) -> Optional[ContainerHealth]:
        """
        Get current health status for a container.
        
        Args:
            container_id: Container ID or name
            
        Returns:
            ContainerHealth object or None if not monitored
            
        Raises:
            ContainerNotFoundError: If container not found
        """
        try:
            container = self.client.containers.get(container_id)
            monitor = self.monitoring_manager.get_container_monitor(container.id)
            
            if not monitor:
                return None
            
            return monitor.get_current_health()
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise
    
    def get_container_recent_logs(self, container_id: str, 
                                limit: Optional[int] = None) -> List[LogEntry]:
        """
        Get recent log entries for a container.
        
        Args:
            container_id: Container ID or name
            limit: Maximum number of entries to return
            
        Returns:
            List of LogEntry objects
            
        Raises:
            ContainerNotFoundError: If container not found
            DockerManagerError: If container is not being monitored
        """
        try:
            container = self.client.containers.get(container_id)
            monitor = self.monitoring_manager.get_container_monitor(container.id)
            
            if not monitor:
                raise DockerManagerError(f"Container {container_id} is not being monitored")
            
            return monitor.get_recent_logs(limit)
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise
    
    def add_monitoring_callbacks(self, 
                               resource_callback: Optional[Callable[[str, ResourceUsage], None]] = None,
                               log_callback: Optional[Callable[[str, LogEntry], None]] = None,
                               health_callback: Optional[Callable[[str, ContainerHealth], None]] = None,
                               alert_callback: Optional[Callable[[str, str, str, Any], None]] = None):
        """
        Add global monitoring callbacks.
        
        Args:
            resource_callback: Called when resource usage is updated
            log_callback: Called when new log entries are received
            health_callback: Called when health status changes
            alert_callback: Called when alerts are triggered
        """
        if resource_callback:
            self.monitoring_manager.add_global_resource_callback(resource_callback)
        
        if log_callback:
            self.monitoring_manager.add_global_log_callback(log_callback)
        
        if health_callback:
            self.monitoring_manager.add_global_health_callback(health_callback)
        
        if alert_callback:
            self.monitoring_manager.add_global_alert_callback(alert_callback)
    
    def get_monitored_containers(self) -> List[str]:
        """Get list of all monitored container IDs"""
        return self.monitoring_manager.get_all_monitored_containers()
    
    def stop_all_monitoring(self):
        """Stop monitoring all containers"""
        self.monitoring_manager.stop_all_monitoring()
    
    def get_container_stats_summary(self, container_id: str) -> Dict[str, Any]:
        """
        Get a summary of container statistics.
        
        Args:
            container_id: Container ID or name
            
        Returns:
            Dictionary with container statistics summary
            
        Raises:
            ContainerNotFoundError: If container not found
        """
        try:
            container = self.client.containers.get(container_id)
            
            # Get basic container info
            info = self._container_to_info(container)
            
            # Get monitoring data if available
            monitor = self.monitoring_manager.get_container_monitor(container.id)
            resource_history = []
            health_status = None
            recent_logs = []
            
            if monitor:
                resource_history = monitor.get_resource_history(limit=10)
                health_status = monitor.get_current_health()
                recent_logs = monitor.get_recent_logs(limit=50)
            
            # Calculate summary statistics
            avg_cpu = 0.0
            avg_memory = 0.0
            if resource_history:
                avg_cpu = sum(r.cpu_percent for r in resource_history) / len(resource_history)
                avg_memory = sum(r.memory_percent for r in resource_history) / len(resource_history)
            
            return {
                "container_info": {
                    "id": info.container_id,
                    "name": info.name,
                    "status": info.status.value,
                    "image": info.image,
                    "ports": info.ports,
                    "created_at": info.created_at.isoformat(),
                    "started_at": info.started_at.isoformat() if info.started_at else None
                },
                "resource_summary": {
                    "avg_cpu_percent": round(avg_cpu, 2),
                    "avg_memory_percent": round(avg_memory, 2),
                    "data_points": len(resource_history)
                },
                "health_status": {
                    "status": health_status.status if health_status else info.status.value,
                    "health_status": health_status.health_status if health_status else None,
                    "uptime_seconds": health_status.uptime.total_seconds() if health_status and health_status.uptime else None,
                    "restart_count": health_status.restart_count if health_status else 0
                },
                "logs_summary": {
                    "recent_entries": len(recent_logs),
                    "last_log_time": recent_logs[-1].timestamp.isoformat() if recent_logs else None
                },
                "monitoring_active": monitor is not None
            }
            
        except Exception as e:
            if "NotFound" in str(type(e).__name__) or "not found" in str(e).lower():
                raise ContainerNotFoundError(f"Container not found: {container_id}")
            else:
                raise DockerManagerError(f"Failed to get container stats: {e}")