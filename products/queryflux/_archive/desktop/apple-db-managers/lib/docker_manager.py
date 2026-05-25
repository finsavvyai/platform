#!/usr/bin/env python3
"""
🚀 Ultimate Multi-Database Manager - Docker Integration
Comprehensive Docker container management for database services
"""

import json
import time
import logging
import subprocess
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path

try:
    import docker
    from docker.errors import DockerException, APIError, NotFound
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

from .database_adapters import DatabaseType


class ContainerStatus(Enum):
    """Container status enumeration"""
    RUNNING = "running"
    STOPPED = "stopped"
    PAUSED = "paused"
    RESTARTING = "restarting"
    REMOVING = "removing"
    DEAD = "dead"
    CREATED = "created"
    EXITED = "exited"


@dataclass
class ContainerConfig:
    """Database container configuration"""
    name: str
    db_type: DatabaseType
    image: str
    port: int
    environment: Dict[str, str]
    volumes: Dict[str, str] = None
    networks: List[str] = None
    restart_policy: str = "unless-stopped"
    memory_limit: str = "512m"
    cpu_limit: float = 1.0

    def __post_init__(self):
        if self.volumes is None:
            self.volumes = {}
        if self.networks is None:
            self.networks = ["bridge"]


@dataclass
class ContainerInfo:
    """Container information"""
    id: str
    name: str
    db_type: DatabaseType
    image: str
    status: ContainerStatus
    port: int
    created: str
    started: str = ""
    ip_address: str = ""
    memory_usage: int = 0
    cpu_usage: float = 0.0
    logs: List[str] = None

    def __post_init__(self):
        if self.logs is None:
            self.logs = []


class DockerManager:
    """Docker container management for databases"""

    def __init__(self):
        self.client = None
        self.logger = logging.getLogger(self.__class__.__name__)
        self._initialize_docker()

    def _initialize_docker(self):
        """Initialize Docker client"""
        if not DOCKER_AVAILABLE:
            self.logger.error("Docker SDK not available")
            return

        try:
            self.client = docker.from_env()
            # Test connection
            self.client.ping()
            self.logger.info("Docker client initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize Docker client: {e}")
            self.client = None

    def is_docker_available(self) -> bool:
        """Check if Docker is available and running"""
        return self.client is not None

    def get_default_configs(self) -> Dict[DatabaseType, ContainerConfig]:
        """Get default container configurations for each database type"""
        configs = {
            DatabaseType.POSTGRESQL: ContainerConfig(
                name="postgres-ultimate",
                db_type=DatabaseType.POSTGRESQL,
                image="postgres:16-alpine",
                port=5432,
                environment={
                    "POSTGRES_DB": "ultimate_db",
                    "POSTGRES_USER": "ultimate_user",
                    "POSTGRES_PASSWORD": "ultimate_pass",
                    "POSTGRES_INITDB_ARGS": "--encoding=UTF-8 --lc-collate=C --lc-ctype=C"
                },
                volumes={
                    "postgres_data": "/var/lib/postgresql/data"
                }
            ),
            
            DatabaseType.MYSQL: ContainerConfig(
                name="mysql-ultimate",
                db_type=DatabaseType.MYSQL,
                image="mysql:8.0",
                port=3306,
                environment={
                    "MYSQL_ROOT_PASSWORD": "ultimate_root_pass",
                    "MYSQL_DATABASE": "ultimate_db",
                    "MYSQL_USER": "ultimate_user",
                    "MYSQL_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "mysql_data": "/var/lib/mysql"
                }
            ),
            
            DatabaseType.MARIADB: ContainerConfig(
                name="mariadb-ultimate",
                db_type=DatabaseType.MARIADB,
                image="mariadb:11.0",
                port=3306,
                environment={
                    "MARIADB_ROOT_PASSWORD": "ultimate_root_pass",
                    "MARIADB_DATABASE": "ultimate_db",
                    "MARIADB_USER": "ultimate_user",
                    "MARIADB_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "mariadb_data": "/var/lib/mysql"
                }
            ),
            
            DatabaseType.MONGODB: ContainerConfig(
                name="mongodb-ultimate",
                db_type=DatabaseType.MONGODB,
                image="mongo:7.0",
                port=27017,
                environment={
                    "MONGO_INITDB_ROOT_USERNAME": "ultimate_user",
                    "MONGO_INITDB_ROOT_PASSWORD": "ultimate_pass",
                    "MONGO_INITDB_DATABASE": "ultimate_db"
                },
                volumes={
                    "mongodb_data": "/data/db"
                }
            ),
            
            DatabaseType.REDIS: ContainerConfig(
                name="redis-ultimate",
                db_type=DatabaseType.REDIS,
                image="redis:7.2-alpine",
                port=6379,
                environment={
                    "REDIS_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "redis_data": "/data"
                }
            ),
            
            DatabaseType.CLICKHOUSE: ContainerConfig(
                name="clickhouse-ultimate",
                db_type=DatabaseType.CLICKHOUSE,
                image="clickhouse/clickhouse-server:latest",
                port=8123,
                environment={
                    "CLICKHOUSE_DB": "ultimate_db",
                    "CLICKHOUSE_USER": "ultimate_user",
                    "CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT": "1",
                    "CLICKHOUSE_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "clickhouse_data": "/var/lib/clickhouse"
                }
            ),
            
            DatabaseType.CASSANDRA: ContainerConfig(
                name="cassandra-ultimate",
                db_type=DatabaseType.CASSANDRA,
                image="cassandra:4.1",
                port=9042,
                environment={
                    "CASSANDRA_CLUSTER_NAME": "UltimateCluster",
                    "CASSANDRA_DC": "datacenter1",
                    "CASSANDRA_RACK": "rack1"
                },
                volumes={
                    "cassandra_data": "/var/lib/cassandra"
                },
                memory_limit="2g"
            ),
            
            DatabaseType.ELASTICSEARCH: ContainerConfig(
                name="elasticsearch-ultimate",
                db_type=DatabaseType.ELASTICSEARCH,
                image="elasticsearch:8.11.0",
                port=9200,
                environment={
                    "discovery.type": "single-node",
                    "ELASTIC_PASSWORD": "ultimate_pass",
                    "xpack.security.enabled": "false"
                },
                volumes={
                    "elasticsearch_data": "/usr/share/elasticsearch/data"
                },
                memory_limit="1g"
            ),
            
            DatabaseType.INFLUXDB: ContainerConfig(
                name="influxdb-ultimate",
                db_type=DatabaseType.INFLUXDB,
                image="influxdb:2.7-alpine",
                port=8086,
                environment={
                    "INFLUXDB_DB": "ultimate_db",
                    "INFLUXDB_ADMIN_USER": "ultimate_user",
                    "INFLUXDB_ADMIN_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "influxdb_data": "/var/lib/influxdb2"
                }
            ),
            
            DatabaseType.COUCHDB: ContainerConfig(
                name="couchdb-ultimate",
                db_type=DatabaseType.COUCHDB,
                image="couchdb:3.3",
                port=5984,
                environment={
                    "COUCHDB_USER": "ultimate_user",
                    "COUCHDB_PASSWORD": "ultimate_pass"
                },
                volumes={
                    "couchdb_data": "/opt/couchdb/data"
                }
            )
        }
        
        return configs

    def find_available_port(self, start_port: int = 5432, max_attempts: int = 100) -> int:
        """Find an available port starting from the given port"""
        import socket
        
        for port in range(start_port, start_port + max_attempts):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('localhost', port))
                    return port
            except OSError:
                continue
        
        raise RuntimeError(f"No available ports found in range {start_port}-{start_port + max_attempts}")

    def create_container(self, config: ContainerConfig, custom_port: int = None) -> Optional[str]:
        """Create a new database container"""
        if not self.is_docker_available():
            self.logger.error("Docker not available")
            return None

        try:
            # Use custom port or find available port
            if custom_port:
                port = custom_port
            else:
                port = self.find_available_port(config.port)
            
            # Create volumes if they don't exist
            for volume_name in config.volumes.keys():
                try:
                    self.client.volumes.create(name=volume_name)
                except APIError as e:
                    if "already exists" not in str(e):
                        self.logger.warning(f"Volume creation warning: {e}")

            # Prepare container configuration
            container_config = {
                'image': config.image,
                'name': config.name,
                'environment': config.environment,
                'ports': {f'{config.port}/tcp': port},
                'volumes': {vol: {'bind': mount, 'mode': 'rw'} for vol, mount in config.volumes.items()},
                'restart_policy': {"Name": config.restart_policy},
                'mem_limit': config.memory_limit,
                'nano_cpus': int(config.cpu_limit * 1e9),
                'detach': True
            }

            # Create and start container
            container = self.client.containers.run(**container_config)
            
            self.logger.info(f"Container created successfully: {config.name} (ID: {container.short_id})")
            return container.id
            
        except Exception as e:
            self.logger.error(f"Failed to create container {config.name}: {e}")
            return None

    def start_container(self, container_id: str) -> bool:
        """Start a container"""
        if not self.is_docker_available():
            return False

        try:
            container = self.client.containers.get(container_id)
            container.start()
            self.logger.info(f"Container started: {container.name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to start container {container_id}: {e}")
            return False

    def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        """Stop a container"""
        if not self.is_docker_available():
            return False

        try:
            container = self.client.containers.get(container_id)
            container.stop(timeout=timeout)
            self.logger.info(f"Container stopped: {container.name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to stop container {container_id}: {e}")
            return False

    def remove_container(self, container_id: str, force: bool = False, remove_volumes: bool = False) -> bool:
        """Remove a container"""
        if not self.is_docker_available():
            return False

        try:
            container = self.client.containers.get(container_id)
            container_name = container.name
            
            # Stop container if running
            if container.status == 'running':
                container.stop(timeout=10)
            
            # Remove container
            container.remove(force=force, v=remove_volumes)
            
            self.logger.info(f"Container removed: {container_name}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to remove container {container_id}: {e}")
            return False

    def list_containers(self, all_containers: bool = True) -> List[ContainerInfo]:
        """List all database containers"""
        if not self.is_docker_available():
            return []

        containers = []
        try:
            docker_containers = self.client.containers.list(all=all_containers)
            
            for container in docker_containers:
                # Try to determine database type from image or labels
                db_type = self._detect_database_type(container)
                if db_type:
                    container_info = self._get_container_info(container, db_type)
                    containers.append(container_info)
                    
        except Exception as e:
            self.logger.error(f"Failed to list containers: {e}")

        return containers

    def get_container_logs(self, container_id: str, lines: int = 100) -> List[str]:
        """Get container logs"""
        if not self.is_docker_available():
            return []

        try:
            container = self.client.containers.get(container_id)
            logs = container.logs(tail=lines, timestamps=True).decode('utf-8')
            return logs.split('\n')
        except Exception as e:
            self.logger.error(f"Failed to get logs for container {container_id}: {e}")
            return []

    def get_container_stats(self, container_id: str) -> Dict[str, Any]:
        """Get container resource usage statistics"""
        if not self.is_docker_available():
            return {}

        try:
            container = self.client.containers.get(container_id)
            stats = container.stats(stream=False)
            
            # Calculate CPU usage percentage
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                       stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                          stats['precpu_stats']['system_cpu_usage']
            
            cpu_usage = 0.0
            if system_delta > 0:
                cpu_usage = (cpu_delta / system_delta) * 100.0

            # Memory usage
            memory_usage = stats['memory_stats'].get('usage', 0)
            memory_limit = stats['memory_stats'].get('limit', 0)
            
            return {
                'cpu_usage': cpu_usage,
                'memory_usage': memory_usage,
                'memory_limit': memory_limit,
                'memory_percent': (memory_usage / memory_limit * 100) if memory_limit > 0 else 0,
                'network_rx': stats['networks'].get('eth0', {}).get('rx_bytes', 0),
                'network_tx': stats['networks'].get('eth0', {}).get('tx_bytes', 0)
            }
            
        except Exception as e:
            self.logger.error(f"Failed to get stats for container {container_id}: {e}")
            return {}

    def health_check(self, container_id: str) -> Dict[str, Any]:
        """Perform health check on container"""
        if not self.is_docker_available():
            return {'healthy': False, 'error': 'Docker not available'}

        try:
            container = self.client.containers.get(container_id)
            
            # Basic health indicators
            health_info = {
                'healthy': container.status == 'running',
                'status': container.status,
                'uptime': self._calculate_uptime(container),
                'restart_count': container.attrs['RestartCount'],
                'last_started': container.attrs['State']['StartedAt']
            }
            
            # Check if container has health check defined
            if 'Health' in container.attrs['State']:
                health_info['health_status'] = container.attrs['State']['Health']['Status']
                health_info['health_log'] = container.attrs['State']['Health']['Log'][-1] if container.attrs['State']['Health']['Log'] else None
            
            return health_info
            
        except Exception as e:
            self.logger.error(f"Failed to perform health check for container {container_id}: {e}")
            return {'healthy': False, 'error': str(e)}

    def _detect_database_type(self, container) -> Optional[DatabaseType]:
        """Detect database type from container image or labels"""
        image_name = container.image.tags[0] if container.image.tags else container.image.id
        image_name = image_name.lower()
        
        # Map image names to database types
        db_mappings = {
            'postgres': DatabaseType.POSTGRESQL,
            'mysql': DatabaseType.MYSQL,
            'mariadb': DatabaseType.MARIADB,
            'mongo': DatabaseType.MONGODB,
            'redis': DatabaseType.REDIS,
            'clickhouse': DatabaseType.CLICKHOUSE,
            'cassandra': DatabaseType.CASSANDRA,
            'elasticsearch': DatabaseType.ELASTICSEARCH,
            'influxdb': DatabaseType.INFLUXDB,
            'couchdb': DatabaseType.COUCHDB
        }
        
        for keyword, db_type in db_mappings.items():
            if keyword in image_name:
                return db_type
        
        return None

    def _get_container_info(self, container, db_type: DatabaseType) -> ContainerInfo:
        """Extract container information"""
        # Get port mapping
        port = 0
        if container.ports:
            for container_port, host_ports in container.ports.items():
                if host_ports:
                    port = int(host_ports[0]['HostPort'])
                    break

        # Get IP address
        ip_address = ""
        if container.attrs['NetworkSettings']['Networks']:
            network_name = list(container.attrs['NetworkSettings']['Networks'].keys())[0]
            ip_address = container.attrs['NetworkSettings']['Networks'][network_name]['IPAddress']

        return ContainerInfo(
            id=container.id,
            name=container.name,
            db_type=db_type,
            image=container.image.tags[0] if container.image.tags else container.image.id,
            status=ContainerStatus(container.status),
            port=port,
            created=container.attrs['Created'],
            started=container.attrs['State'].get('StartedAt', ''),
            ip_address=ip_address
        )

    def _calculate_uptime(self, container) -> str:
        """Calculate container uptime"""
        try:
            from datetime import datetime
            import dateutil.parser
            
            started_at = container.attrs['State']['StartedAt']
            if started_at:
                start_time = dateutil.parser.parse(started_at)
                uptime = datetime.now(start_time.tzinfo) - start_time
                
                days = uptime.days
                hours, remainder = divmod(uptime.seconds, 3600)
                minutes, seconds = divmod(remainder, 60)
                
                if days > 0:
                    return f"{days}d {hours}h {minutes}m"
                elif hours > 0:
                    return f"{hours}h {minutes}m"
                else:
                    return f"{minutes}m {seconds}s"
            
            return "Unknown"
            
        except Exception:
            return "Unknown"

    def export_container_config(self, container_id: str, output_path: str) -> bool:
        """Export container configuration to JSON file"""
        if not self.is_docker_available():
            return False

        try:
            container = self.client.containers.get(container_id)
            config = {
                'name': container.name,
                'image': container.image.tags[0] if container.image.tags else container.image.id,
                'environment': container.attrs['Config']['Env'],
                'ports': container.attrs['Config']['ExposedPorts'],
                'volumes': container.attrs['Config']['Volumes'],
                'labels': container.attrs['Config']['Labels'],
                'restart_policy': container.attrs['HostConfig']['RestartPolicy'],
                'memory_limit': container.attrs['HostConfig']['Memory'],
                'cpu_limit': container.attrs['HostConfig']['NanoCpus']
            }
            
            with open(output_path, 'w') as f:
                json.dump(config, f, indent=2)
            
            self.logger.info(f"Container configuration exported: {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export container config: {e}")
            return False

    def backup_container_data(self, container_id: str, backup_path: str) -> bool:
        """Create backup of container data volumes"""
        if not self.is_docker_available():
            return False

        try:
            container = self.client.containers.get(container_id)
            
            # Create backup using docker exec tar command
            backup_cmd = f"tar -czf /tmp/backup.tar.gz -C / {' '.join(container.attrs['Config']['Volumes'].keys())}"
            
            # Execute backup command in container
            exec_result = container.exec_run(backup_cmd)
            if exec_result.exit_code != 0:
                self.logger.error(f"Backup command failed: {exec_result.output}")
                return False
            
            # Copy backup file from container to host
            with open(backup_path, 'wb') as f:
                bits, _ = container.get_archive('/tmp/backup.tar.gz')
                for chunk in bits:
                    f.write(chunk)
            
            # Clean up temporary backup file in container
            container.exec_run("rm /tmp/backup.tar.gz")
            
            self.logger.info(f"Container data backed up: {backup_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to backup container data: {e}")
            return False


# Example usage and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Initialize Docker manager
    docker_manager = DockerManager()
    
    if docker_manager.is_docker_available():
        print("Docker is available!")
        
        # List existing containers
        containers = docker_manager.list_containers()
        print(f"Found {len(containers)} database containers")
        
        for container in containers:
            print(f"- {container.name} ({container.db_type.value}): {container.status.value}")
        
        # Get default configurations
        configs = docker_manager.get_default_configs()
        print(f"Available database configurations: {list(configs.keys())}")
        
    else:
        print("Docker is not available")
