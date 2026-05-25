#!/usr/bin/env python3
"""
🚀 Ultimate Multi-Database Manager - Connection Management
Comprehensive connection management with Docker integration and secure storage
"""

import json
import uuid
import hashlib
import keyring
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime
from enum import Enum

from .database_adapters import DatabaseAdapter, DatabaseAdapterFactory, ConnectionParams, DatabaseType
from .docker_manager import DockerManager, ContainerConfig, ContainerInfo


class ConnectionStatus(Enum):
    """Connection status enumeration"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    TIMEOUT = "timeout"


@dataclass
class ConnectionProfile:
    """Database connection profile"""
    id: str
    name: str
    db_type: DatabaseType
    host: str
    port: int
    username: str
    database: str
    ssl: bool = False
    ssh_tunnel: bool = False
    ssh_host: str = ""
    ssh_port: int = 22
    ssh_username: str = ""
    docker_container_id: str = ""
    group: str = "Default"
    color: str = "#007aff"
    notes: str = ""
    created_at: str = ""
    last_used: str = ""
    use_count: int = 0
    favorite: bool = False
    additional_params: Dict[str, Any] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid.uuid4())
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if self.additional_params is None:
            self.additional_params = {}


@dataclass
class ActiveConnection:
    """Active database connection"""
    profile: ConnectionProfile
    adapter: DatabaseAdapter
    status: ConnectionStatus
    connected_at: str
    last_activity: str
    query_count: int = 0
    error_message: str = ""

    def __post_init__(self):
        if not self.connected_at:
            self.connected_at = datetime.now().isoformat()
        if not self.last_activity:
            self.last_activity = datetime.now().isoformat()


class ConnectionManager:
    """Comprehensive connection management system"""

    def __init__(self, config_dir: str = None):
        self.logger = logging.getLogger(self.__class__.__name__)
        
        # Configuration directory
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path.home() / ".ultimate_db_manager"
        
        self.config_dir.mkdir(exist_ok=True)
        self.profiles_file = self.config_dir / "connection_profiles.json"
        
        # Connection storage
        self.profiles: Dict[str, ConnectionProfile] = {}
        self.active_connections: Dict[str, ActiveConnection] = {}
        
        # Docker integration
        self.docker_manager = DockerManager()
        
        # Load existing profiles
        self.load_profiles()

    def create_profile(self, name: str, db_type: DatabaseType, host: str, port: int,
                      username: str, password: str, database: str = "", **kwargs) -> str:
        """Create a new connection profile"""
        profile = ConnectionProfile(
            id="",  # Will be auto-generated
            name=name,
            db_type=db_type,
            host=host,
            port=port,
            username=username,
            database=database,
            **kwargs
        )
        
        # Store password securely
        self._store_password(profile.id, password)
        
        # Add to profiles
        self.profiles[profile.id] = profile
        self.save_profiles()
        
        self.logger.info(f"Created connection profile: {name} ({profile.id})")
        return profile.id

    def update_profile(self, profile_id: str, **updates) -> bool:
        """Update an existing connection profile"""
        if profile_id not in self.profiles:
            self.logger.error(f"Profile not found: {profile_id}")
            return False
        
        profile = self.profiles[profile_id]
        
        # Handle password update separately
        if 'password' in updates:
            password = updates.pop('password')
            self._store_password(profile_id, password)
        
        # Update profile fields
        for key, value in updates.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        self.save_profiles()
        self.logger.info(f"Updated connection profile: {profile.name}")
        return True

    def delete_profile(self, profile_id: str) -> bool:
        """Delete a connection profile"""
        if profile_id not in self.profiles:
            self.logger.error(f"Profile not found: {profile_id}")
            return False
        
        # Disconnect if active
        if profile_id in self.active_connections:
            self.disconnect(profile_id)
        
        # Remove password from keyring
        self._remove_password(profile_id)
        
        # Remove profile
        profile_name = self.profiles[profile_id].name
        del self.profiles[profile_id]
        self.save_profiles()
        
        self.logger.info(f"Deleted connection profile: {profile_name}")
        return True

    def connect(self, profile_id: str) -> bool:
        """Connect to database using profile"""
        if profile_id not in self.profiles:
            self.logger.error(f"Profile not found: {profile_id}")
            return False
        
        profile = self.profiles[profile_id]
        
        # Check if already connected
        if profile_id in self.active_connections:
            if self.active_connections[profile_id].status == ConnectionStatus.CONNECTED:
                self.logger.info(f"Already connected to: {profile.name}")
                return True
        
        try:
            # Get password
            password = self._get_password(profile_id)
            if not password:
                self.logger.error(f"No password found for profile: {profile.name}")
                return False
            
            # Create connection parameters
            conn_params = ConnectionParams(
                db_type=profile.db_type,
                host=profile.host,
                port=profile.port,
                username=profile.username,
                password=password,
                database=profile.database,
                ssl=profile.ssl,
                additional_params=profile.additional_params
            )
            
            # Create adapter
            adapter = DatabaseAdapterFactory.create_adapter(conn_params)
            
            # Create active connection record
            active_conn = ActiveConnection(
                profile=profile,
                adapter=adapter,
                status=ConnectionStatus.CONNECTING,
                connected_at="",
                last_activity=""
            )
            
            self.active_connections[profile_id] = active_conn
            
            # Attempt connection
            if adapter.connect():
                active_conn.status = ConnectionStatus.CONNECTED
                active_conn.connected_at = datetime.now().isoformat()
                active_conn.last_activity = datetime.now().isoformat()
                
                # Update profile usage
                profile.last_used = datetime.now().isoformat()
                profile.use_count += 1
                self.save_profiles()
                
                self.logger.info(f"Connected to: {profile.name}")
                return True
            else:
                active_conn.status = ConnectionStatus.ERROR
                active_conn.error_message = "Connection failed"
                self.logger.error(f"Failed to connect to: {profile.name}")
                return False
                
        except Exception as e:
            if profile_id in self.active_connections:
                self.active_connections[profile_id].status = ConnectionStatus.ERROR
                self.active_connections[profile_id].error_message = str(e)
            
            self.logger.error(f"Connection error for {profile.name}: {e}")
            return False

    def disconnect(self, profile_id: str) -> bool:
        """Disconnect from database"""
        if profile_id not in self.active_connections:
            self.logger.warning(f"No active connection found for profile: {profile_id}")
            return True
        
        active_conn = self.active_connections[profile_id]
        
        try:
            if active_conn.adapter:
                active_conn.adapter.disconnect()
            
            del self.active_connections[profile_id]
            self.logger.info(f"Disconnected from: {active_conn.profile.name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Disconnect error: {e}")
            return False

    def disconnect_all(self) -> bool:
        """Disconnect all active connections"""
        success = True
        for profile_id in list(self.active_connections.keys()):
            if not self.disconnect(profile_id):
                success = False
        return success

    def test_connection(self, profile_id: str) -> Tuple[bool, str]:
        """Test connection without establishing persistent connection"""
        if profile_id not in self.profiles:
            return False, "Profile not found"
        
        profile = self.profiles[profile_id]
        
        try:
            # Get password
            password = self._get_password(profile_id)
            if not password:
                return False, "No password found"
            
            # Create connection parameters
            conn_params = ConnectionParams(
                db_type=profile.db_type,
                host=profile.host,
                port=profile.port,
                username=profile.username,
                password=password,
                database=profile.database,
                ssl=profile.ssl,
                additional_params=profile.additional_params
            )
            
            # Create adapter and test
            adapter = DatabaseAdapterFactory.create_adapter(conn_params)
            
            if adapter.connect():
                if adapter.test_connection():
                    adapter.disconnect()
                    return True, "Connection successful"
                else:
                    adapter.disconnect()
                    return False, "Connection test failed"
            else:
                return False, "Failed to establish connection"
                
        except Exception as e:
            return False, str(e)

    def get_active_connection(self, profile_id: str) -> Optional[ActiveConnection]:
        """Get active connection by profile ID"""
        return self.active_connections.get(profile_id)

    def get_adapter(self, profile_id: str) -> Optional[DatabaseAdapter]:
        """Get database adapter for active connection"""
        active_conn = self.active_connections.get(profile_id)
        return active_conn.adapter if active_conn else None

    def list_profiles(self, group: str = None, db_type: DatabaseType = None) -> List[ConnectionProfile]:
        """List connection profiles with optional filtering"""
        profiles = list(self.profiles.values())
        
        if group:
            profiles = [p for p in profiles if p.group == group]
        
        if db_type:
            profiles = [p for p in profiles if p.db_type == db_type]
        
        # Sort by favorites first, then by last used
        profiles.sort(key=lambda p: (not p.favorite, p.last_used), reverse=True)
        
        return profiles

    def list_active_connections(self) -> List[ActiveConnection]:
        """List all active connections"""
        return list(self.active_connections.values())

    def get_groups(self) -> List[str]:
        """Get list of all connection groups"""
        groups = set(profile.group for profile in self.profiles.values())
        return sorted(list(groups))

    def create_docker_profile(self, container_info: ContainerInfo, name: str = None) -> str:
        """Create connection profile from Docker container"""
        if not name:
            name = f"{container_info.name} (Docker)"
        
        # Determine default credentials based on database type
        default_creds = self._get_default_docker_credentials(container_info.db_type)
        
        profile_id = self.create_profile(
            name=name,
            db_type=container_info.db_type,
            host="localhost",
            port=container_info.port,
            username=default_creds['username'],
            password=default_creds['password'],
            database=default_creds['database'],
            docker_container_id=container_info.id,
            group="Docker Containers"
        )
        
        self.logger.info(f"Created Docker profile: {name}")
        return profile_id

    def sync_docker_containers(self) -> int:
        """Sync connection profiles with Docker containers"""
        if not self.docker_manager.is_docker_available():
            self.logger.warning("Docker not available for sync")
            return 0
        
        containers = self.docker_manager.list_containers()
        synced_count = 0
        
        for container in containers:
            # Check if profile already exists for this container
            existing_profile = None
            for profile in self.profiles.values():
                if profile.docker_container_id == container.id:
                    existing_profile = profile
                    break
            
            if not existing_profile:
                # Create new profile for container
                self.create_docker_profile(container)
                synced_count += 1
            else:
                # Update existing profile with current container info
                self.update_profile(
                    existing_profile.id,
                    port=container.port,
                    host="localhost"
                )
        
        # Remove profiles for containers that no longer exist
        container_ids = {c.id for c in containers}
        profiles_to_remove = []
        
        for profile_id, profile in self.profiles.items():
            if profile.docker_container_id and profile.docker_container_id not in container_ids:
                profiles_to_remove.append(profile_id)
        
        for profile_id in profiles_to_remove:
            self.delete_profile(profile_id)
        
        self.logger.info(f"Synced {synced_count} Docker containers")
        return synced_count

    def create_quick_docker_instance(self, db_type: DatabaseType, name: str = None) -> Tuple[str, str]:
        """Create Docker container and connection profile in one step"""
        if not self.docker_manager.is_docker_available():
            raise RuntimeError("Docker not available")
        
        # Get default configuration
        configs = self.docker_manager.get_default_configs()
        if db_type not in configs:
            raise ValueError(f"Unsupported database type: {db_type}")
        
        config = configs[db_type]
        if name:
            config.name = name
        
        # Create container
        container_id = self.docker_manager.create_container(config)
        if not container_id:
            raise RuntimeError("Failed to create Docker container")
        
        # Wait for container to start
        import time
        time.sleep(2)
        
        # Get container info
        containers = self.docker_manager.list_containers()
        container_info = None
        for container in containers:
            if container.id == container_id:
                container_info = container
                break
        
        if not container_info:
            raise RuntimeError("Container created but not found")
        
        # Create connection profile
        profile_id = self.create_docker_profile(container_info, config.name)
        
        return container_id, profile_id

    def export_profiles(self, output_path: str, include_passwords: bool = False) -> bool:
        """Export connection profiles to JSON file"""
        try:
            export_data = {
                'version': '1.0',
                'exported_at': datetime.now().isoformat(),
                'profiles': []
            }
            
            for profile in self.profiles.values():
                profile_data = asdict(profile)
                
                if include_passwords:
                    password = self._get_password(profile.id)
                    profile_data['password'] = password
                
                export_data['profiles'].append(profile_data)
            
            with open(output_path, 'w') as f:
                json.dump(export_data, f, indent=2)
            
            self.logger.info(f"Exported {len(self.profiles)} profiles to: {output_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Export failed: {e}")
            return False

    def import_profiles(self, input_path: str, overwrite: bool = False) -> int:
        """Import connection profiles from JSON file"""
        try:
            with open(input_path, 'r') as f:
                import_data = json.load(f)
            
            imported_count = 0
            
            for profile_data in import_data.get('profiles', []):
                # Extract password if present
                password = profile_data.pop('password', '')
                
                # Check if profile already exists
                existing_id = None
                for existing_profile in self.profiles.values():
                    if (existing_profile.name == profile_data['name'] and
                        existing_profile.host == profile_data['host'] and
                        existing_profile.port == profile_data['port']):
                        existing_id = existing_profile.id
                        break
                
                if existing_id and not overwrite:
                    self.logger.warning(f"Profile already exists, skipping: {profile_data['name']}")
                    continue
                
                # Create or update profile
                if existing_id and overwrite:
                    self.update_profile(existing_id, **profile_data)
                    if password:
                        self._store_password(existing_id, password)
                    profile_id = existing_id
                else:
                    # Create new profile
                    profile = ConnectionProfile(**profile_data)
                    self.profiles[profile.id] = profile
                    if password:
                        self._store_password(profile.id, password)
                    profile_id = profile.id
                
                imported_count += 1
            
            self.save_profiles()
            self.logger.info(f"Imported {imported_count} profiles from: {input_path}")
            return imported_count
            
        except Exception as e:
            self.logger.error(f"Import failed: {e}")
            return 0

    def load_profiles(self):
        """Load connection profiles from file"""
        if not self.profiles_file.exists():
            return
        
        try:
            with open(self.profiles_file, 'r') as f:
                data = json.load(f)
            
            self.profiles = {}
            for profile_data in data.get('profiles', []):
                profile = ConnectionProfile(**profile_data)
                self.profiles[profile.id] = profile
            
            self.logger.info(f"Loaded {len(self.profiles)} connection profiles")
            
        except Exception as e:
            self.logger.error(f"Failed to load profiles: {e}")

    def save_profiles(self):
        """Save connection profiles to file"""
        try:
            data = {
                'version': '1.0',
                'profiles': [asdict(profile) for profile in self.profiles.values()]
            }
            
            with open(self.profiles_file, 'w') as f:
                json.dump(data, f, indent=2)
            
        except Exception as e:
            self.logger.error(f"Failed to save profiles: {e}")

    def _store_password(self, profile_id: str, password: str):
        """Store password securely in keyring"""
        try:
            keyring.set_password("ultimate_db_manager", profile_id, password)
        except Exception as e:
            self.logger.error(f"Failed to store password: {e}")

    def _get_password(self, profile_id: str) -> Optional[str]:
        """Retrieve password from keyring"""
        try:
            return keyring.get_password("ultimate_db_manager", profile_id)
        except Exception as e:
            self.logger.error(f"Failed to retrieve password: {e}")
            return None

    def _remove_password(self, profile_id: str):
        """Remove password from keyring"""
        try:
            keyring.delete_password("ultimate_db_manager", profile_id)
        except Exception as e:
            self.logger.error(f"Failed to remove password: {e}")

    def _get_default_docker_credentials(self, db_type: DatabaseType) -> Dict[str, str]:
        """Get default credentials for Docker database containers"""
        defaults = {
            DatabaseType.POSTGRESQL: {
                'username': 'ultimate_user',
                'password': 'ultimate_pass',
                'database': 'ultimate_db'
            },
            DatabaseType.MYSQL: {
                'username': 'ultimate_user',
                'password': 'ultimate_pass',
                'database': 'ultimate_db'
            },
            DatabaseType.MARIADB: {
                'username': 'ultimate_user',
                'password': 'ultimate_pass',
                'database': 'ultimate_db'
            },
            DatabaseType.MONGODB: {
                'username': 'ultimate_user',
                'password': 'ultimate_pass',
                'database': 'ultimate_db'
            },
            DatabaseType.REDIS: {
                'username': '',
                'password': 'ultimate_pass',
                'database': '0'
            }
        }
        
        return defaults.get(db_type, {
            'username': 'ultimate_user',
            'password': 'ultimate_pass',
            'database': 'ultimate_db'
        })


# Example usage and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    # Initialize connection manager
    conn_manager = ConnectionManager()
    
    # Create test profile
    profile_id = conn_manager.create_profile(
        name="Test PostgreSQL",
        db_type=DatabaseType.POSTGRESQL,
        host="localhost",
        port=5432,
        username="postgres",
        password="password",
        database="postgres"
    )
    
    print(f"Created profile: {profile_id}")
    
    # List profiles
    profiles = conn_manager.list_profiles()
    print(f"Total profiles: {len(profiles)}")
    
    # Test connection
    success, message = conn_manager.test_connection(profile_id)
    print(f"Connection test: {success} - {message}")
    
    # Sync Docker containers
    synced = conn_manager.sync_docker_containers()
    print(f"Synced {synced} Docker containers")
