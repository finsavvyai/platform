"""
Connection Profile Management System
Handles database connection profiles with serialization and validation
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

from ..adapters.base_adapter import DatabaseType, ConnectionParams
from .security import SecurityError, InputValidator


class ProfileStatus(Enum):
    """Connection profile status"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


@dataclass
class ConnectionProfile:
    """Database connection profile with metadata"""
    id: str
    name: str
    db_type: DatabaseType
    connection_params: ConnectionParams
    created_at: datetime
    last_used: Optional[datetime] = None
    last_modified: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)
    is_favorite: bool = False
    status: ProfileStatus = ProfileStatus.ACTIVE
    description: Optional[str] = None
    color: Optional[str] = None  # For UI theming
    auto_connect: bool = False
    connection_timeout: int = 30
    retry_attempts: int = 3
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate profile after initialization"""
        # Only validate required fields for basic construction
        # Full validation is done via validate() method
        if not isinstance(self.db_type, DatabaseType):
            raise ValueError(f"Invalid database type: {self.db_type}")
        
        if not isinstance(self.connection_params, ConnectionParams):
            raise ValueError("Invalid connection parameters")

    def to_dict(self) -> Dict[str, Any]:
        """Convert profile to dictionary for serialization"""
        data = asdict(self)
        
        # Convert datetime objects to ISO format
        data['created_at'] = self.created_at.isoformat()
        data['last_used'] = self.last_used.isoformat() if self.last_used else None
        data['last_modified'] = self.last_modified.isoformat() if self.last_modified else None
        
        # Convert enums to string values
        data['db_type'] = self.db_type.value
        data['status'] = self.status.value
        
        # Convert connection_params to dict
        data['connection_params'] = self.connection_params.to_dict()
        
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConnectionProfile':
        """Create profile from dictionary"""
        # Parse datetime fields
        created_at = datetime.fromisoformat(data['created_at'])
        last_used = datetime.fromisoformat(data['last_used']) if data.get('last_used') else None
        last_modified = datetime.fromisoformat(data['last_modified']) if data.get('last_modified') else None
        
        # Parse enums
        db_type = DatabaseType(data['db_type'])
        status = ProfileStatus(data.get('status', ProfileStatus.ACTIVE.value))
        
        # Parse connection params
        connection_params = ConnectionParams.from_dict(data['connection_params'])
        
        return cls(
            id=data['id'],
            name=data['name'],
            db_type=db_type,
            connection_params=connection_params,
            created_at=created_at,
            last_used=last_used,
            last_modified=last_modified,
            tags=data.get('tags', []),
            is_favorite=data.get('is_favorite', False),
            status=status,
            description=data.get('description'),
            color=data.get('color'),
            auto_connect=data.get('auto_connect', False),
            connection_timeout=data.get('connection_timeout', 30),
            retry_attempts=data.get('retry_attempts', 3),
            metadata=data.get('metadata', {})
        )

    def update_last_used(self) -> None:
        """Update last used timestamp"""
        self.last_used = datetime.now()
        self.last_modified = datetime.now()

    def update_metadata(self, key: str, value: Any) -> None:
        """Update metadata field"""
        self.metadata[key] = value
        self.last_modified = datetime.now()

    def add_tag(self, tag: str) -> None:
        """Add tag to profile"""
        tag = tag.strip().lower()
        if tag and tag not in self.tags:
            self.tags.append(tag)
            self.last_modified = datetime.now()

    def remove_tag(self, tag: str) -> None:
        """Remove tag from profile"""
        tag = tag.strip().lower()
        if tag in self.tags:
            self.tags.remove(tag)
            self.last_modified = datetime.now()

    def clone(self, new_name: str) -> 'ConnectionProfile':
        """Create a copy of this profile with a new name and ID"""
        return ConnectionProfile(
            id=str(uuid.uuid4()),
            name=new_name,
            db_type=self.db_type,
            connection_params=self.connection_params,
            created_at=datetime.now(),
            tags=self.tags.copy(),
            is_favorite=False,
            status=ProfileStatus.ACTIVE,
            description=self.description,
            color=self.color,
            auto_connect=False,
            connection_timeout=self.connection_timeout,
            retry_attempts=self.retry_attempts,
            metadata=self.metadata.copy()
        )

    def validate(self) -> List[str]:
        """Validate profile configuration and return list of issues"""
        issues = []
        
        # Validate name
        if not self.name.strip():
            issues.append("Profile name is required")
        
        # Validate connection parameters
        try:
            if not self.connection_params.host.strip():
                issues.append("Host is required")
            
            if not (1 <= self.connection_params.port <= 65535):
                issues.append("Port must be between 1 and 65535")
            
            if not self.connection_params.username:
                issues.append("Username is required")
                
        except Exception as e:
            issues.append(f"Invalid connection parameters: {str(e)}")
        
        # Validate timeout values
        if self.connection_timeout <= 0:
            issues.append("Connection timeout must be positive")
        
        if self.retry_attempts < 0:
            issues.append("Retry attempts cannot be negative")
        
        return issues

    def is_valid(self) -> bool:
        """Check if profile is valid"""
        return len(self.validate()) == 0

    def __str__(self) -> str:
        return f"ConnectionProfile(name='{self.name}', type={self.db_type.value}, host={self.connection_params.host})"

    def __repr__(self) -> str:
        return self.__str__()


class ConnectionProfileManager:
    """Manages connection profiles with storage and retrieval"""
    
    def __init__(self, storage_dir: Optional[Path] = None):
        """Initialize profile manager with storage directory"""
        if storage_dir is None:
            storage_dir = Path.home() / ".ultimate_db_manager" / "profiles"
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        
        # In-memory cache of profiles
        self._profiles: Dict[str, ConnectionProfile] = {}
        self._loaded = False

    def _get_profile_file(self, profile_id: str) -> Path:
        """Get file path for profile"""
        return self.storage_dir / f"{profile_id}.json"

    def _load_profiles(self) -> None:
        """Load all profiles from storage"""
        if self._loaded:
            return
        
        self._profiles.clear()
        
        for profile_file in self.storage_dir.glob("*.json"):
            try:
                with open(profile_file, 'r') as f:
                    data = json.load(f)
                    profile = ConnectionProfile.from_dict(data)
                    self._profiles[profile.id] = profile
            except Exception as e:
                # Log error but continue loading other profiles
                print(f"Warning: Failed to load profile {profile_file}: {e}")
        
        self._loaded = True

    def create_profile(self, name: str, db_type: DatabaseType, 
                      connection_params: ConnectionParams, **kwargs) -> ConnectionProfile:
        """Create a new connection profile"""
        # Validate inputs
        if not name.strip():
            raise ValueError("Profile name cannot be empty")
        
        # Check for duplicate names
        if self.get_profile_by_name(name):
            raise ValueError(f"Profile with name '{name}' already exists")
        
        # Create profile
        profile = ConnectionProfile(
            id=str(uuid.uuid4()),
            name=name.strip(),
            db_type=db_type,
            connection_params=connection_params,
            created_at=datetime.now(),
            **kwargs
        )
        
        # Validate profile
        issues = profile.validate()
        if issues:
            raise ValueError(f"Invalid profile: {'; '.join(issues)}")
        
        # Store profile
        self._profiles[profile.id] = profile
        self._save_profile(profile)
        
        return profile

    def get_profile(self, profile_id: str) -> Optional[ConnectionProfile]:
        """Get profile by ID"""
        self._load_profiles()
        return self._profiles.get(profile_id)

    def get_profile_by_name(self, name: str) -> Optional[ConnectionProfile]:
        """Get profile by name"""
        self._load_profiles()
        for profile in self._profiles.values():
            if profile.name == name:
                return profile
        return None

    def list_profiles(self, status: Optional[ProfileStatus] = None,
                     tags: Optional[List[str]] = None,
                     db_type: Optional[DatabaseType] = None) -> List[ConnectionProfile]:
        """List profiles with optional filtering"""
        self._load_profiles()
        
        profiles = list(self._profiles.values())
        
        # Filter by status
        if status:
            profiles = [p for p in profiles if p.status == status]
        
        # Filter by tags
        if tags:
            profiles = [p for p in profiles if any(tag in p.tags for tag in tags)]
        
        # Filter by database type
        if db_type:
            profiles = [p for p in profiles if p.db_type == db_type]
        
        # Sort by last used (most recent first), then by name
        profiles.sort(key=lambda p: (p.last_used or datetime.min, p.name), reverse=True)
        
        return profiles

    def update_profile(self, profile: ConnectionProfile) -> None:
        """Update an existing profile"""
        if profile.id not in self._profiles:
            raise ValueError(f"Profile with ID {profile.id} not found")
        
        # Validate profile
        issues = profile.validate()
        if issues:
            raise ValueError(f"Invalid profile: {'; '.join(issues)}")
        
        # Update modification time
        profile.last_modified = datetime.now()
        
        # Store profile
        self._profiles[profile.id] = profile
        self._save_profile(profile)

    def delete_profile(self, profile_id: str) -> bool:
        """Delete a profile"""
        self._load_profiles()
        
        if profile_id not in self._profiles:
            return False
        
        # Remove from memory
        del self._profiles[profile_id]
        
        # Remove from storage
        profile_file = self._get_profile_file(profile_id)
        if profile_file.exists():
            profile_file.unlink()
        
        return True

    def archive_profile(self, profile_id: str) -> bool:
        """Archive a profile (soft delete)"""
        profile = self.get_profile(profile_id)
        if not profile:
            return False
        
        profile.status = ProfileStatus.ARCHIVED
        profile.last_modified = datetime.now()
        self.update_profile(profile)
        return True

    def get_favorites(self) -> List[ConnectionProfile]:
        """Get favorite profiles"""
        return [p for p in self.list_profiles() if p.is_favorite]

    def get_recent_profiles(self, limit: int = 10) -> List[ConnectionProfile]:
        """Get recently used profiles"""
        profiles = [p for p in self.list_profiles() if p.last_used]
        profiles.sort(key=lambda p: p.last_used, reverse=True)
        return profiles[:limit]

    def search_profiles(self, query: str) -> List[ConnectionProfile]:
        """Search profiles by name, description, or tags"""
        self._load_profiles()
        query = query.lower().strip()
        
        if not query:
            return self.list_profiles()
        
        results = []
        for profile in self._profiles.values():
            # Search in name
            if query in profile.name.lower():
                results.append(profile)
                continue
            
            # Search in description
            if profile.description and query in profile.description.lower():
                results.append(profile)
                continue
            
            # Search in tags
            if any(query in tag.lower() for tag in profile.tags):
                results.append(profile)
                continue
            
            # Search in host
            if query in profile.connection_params.host.lower():
                results.append(profile)
                continue
        
        return results

    def export_profiles(self, file_path: Path, profile_ids: Optional[List[str]] = None) -> None:
        """Export profiles to JSON file"""
        self._load_profiles()
        
        if profile_ids:
            profiles = [self._profiles[pid] for pid in profile_ids if pid in self._profiles]
        else:
            profiles = list(self._profiles.values())
        
        export_data = {
            'version': '1.0',
            'exported_at': datetime.now().isoformat(),
            'profiles': [profile.to_dict() for profile in profiles]
        }
        
        with open(file_path, 'w') as f:
            json.dump(export_data, f, indent=2)

    def import_profiles(self, file_path: Path, overwrite: bool = False) -> List[str]:
        """Import profiles from JSON file, returns list of imported profile IDs"""
        with open(file_path, 'r') as f:
            import_data = json.load(f)
        
        if 'profiles' not in import_data:
            raise ValueError("Invalid import file format")
        
        imported_ids = []
        
        for profile_data in import_data['profiles']:
            try:
                profile = ConnectionProfile.from_dict(profile_data)
                
                # Check if profile already exists
                existing = self.get_profile(profile.id)
                if existing and not overwrite:
                    # Generate new ID to avoid conflicts
                    profile.id = str(uuid.uuid4())
                
                # Validate profile
                issues = profile.validate()
                if issues:
                    print(f"Warning: Skipping invalid profile '{profile.name}': {'; '.join(issues)}")
                    continue
                
                # Store profile
                self._profiles[profile.id] = profile
                self._save_profile(profile)
                imported_ids.append(profile.id)
                
            except Exception as e:
                print(f"Warning: Failed to import profile: {e}")
        
        return imported_ids

    def get_statistics(self) -> Dict[str, Any]:
        """Get profile statistics"""
        self._load_profiles()
        
        profiles = list(self._profiles.values())
        
        # Count by database type
        db_type_counts = {}
        for profile in profiles:
            db_type = profile.db_type.value
            db_type_counts[db_type] = db_type_counts.get(db_type, 0) + 1
        
        # Count by status
        status_counts = {}
        for profile in profiles:
            status = profile.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'total_profiles': len(profiles),
            'favorites': len([p for p in profiles if p.is_favorite]),
            'recently_used': len([p for p in profiles if p.last_used]),
            'auto_connect': len([p for p in profiles if p.auto_connect]),
            'by_database_type': db_type_counts,
            'by_status': status_counts,
            'total_tags': len(set(tag for profile in profiles for tag in profile.tags))
        }

    def _save_profile(self, profile: ConnectionProfile) -> None:
        """Save profile to storage"""
        profile_file = self._get_profile_file(profile.id)
        
        with open(profile_file, 'w', opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
            json.dump(profile.to_dict(), f, indent=2)

    def cleanup_archived_profiles(self, days_old: int = 30) -> int:
        """Remove archived profiles older than specified days"""
        self._load_profiles()
        
        cutoff_date = datetime.now() - timedelta(days=days_old)
        removed_count = 0
        
        profiles_to_remove = []
        for profile in self._profiles.values():
            if (profile.status == ProfileStatus.ARCHIVED and 
                profile.last_modified and 
                profile.last_modified < cutoff_date):
                profiles_to_remove.append(profile.id)
        
        for profile_id in profiles_to_remove:
            if self.delete_profile(profile_id):
                removed_count += 1
        
        return removed_count


# Import os for file permissions
import os
from datetime import timedelta

# Global instance
profile_manager = ConnectionProfileManager()

__all__ = [
    'ProfileStatus',
    'ConnectionProfile', 
    'ConnectionProfileManager',
    'profile_manager'
]