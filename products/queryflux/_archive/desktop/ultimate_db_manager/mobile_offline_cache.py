#!/usr/bin/env python3
"""
Mobile Offline Data Cache
Provides offline data caching and synchronization for mobile apps
"""

import os
import json
import sqlite3
import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import gzip
import base64

logger = logging.getLogger(__name__)

class CacheEntryType(Enum):
    """Types of cached data"""
    CONNECTION_STATUS = "connection_status"
    HEALTH_METRICS = "health_metrics"
    CONTAINER_STATUS = "container_status"
    QUERY_RESULT = "query_result"
    ALERT_DATA = "alert_data"
    SYSTEM_STATUS = "system_status"

class SyncStatus(Enum):
    """Synchronization status"""
    SYNCED = "synced"
    PENDING_SYNC = "pending_sync"
    SYNC_FAILED = "sync_failed"
    OFFLINE_ONLY = "offline_only"

@dataclass
class CacheEntry:
    """Cache entry data structure"""
    id: str
    entry_type: CacheEntryType
    key: str
    data: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    expires_at: Optional[datetime]
    sync_status: SyncStatus
    version: int
    checksum: str
    compressed: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result['entry_type'] = self.entry_type.value
        result['sync_status'] = self.sync_status.value
        result['created_at'] = self.created_at.isoformat()
        result['updated_at'] = self.updated_at.isoformat()
        if self.expires_at:
            result['expires_at'] = self.expires_at.isoformat()
        return result

class MobileOfflineCache:
    """Offline data cache for mobile applications"""
    
    def __init__(self, cache_dir: str = "mobile_cache"):
        self.cache_dir = cache_dir
        self.db_path = os.path.join(cache_dir, "mobile_cache.db")
        self.max_cache_size_mb = 50  # Maximum cache size in MB
        self.default_ttl_hours = 24  # Default time-to-live in hours
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize database
        self._init_database()
        
        # Cache statistics
        self.stats = {
            "hits": 0,
            "misses": 0,
            "writes": 0,
            "evictions": 0,
            "sync_operations": 0
        }
    
    def _init_database(self):
        """Initialize SQLite database for cache storage"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_entries (
                        id TEXT PRIMARY KEY,
                        entry_type TEXT NOT NULL,
                        key TEXT NOT NULL,
                        data TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        expires_at TEXT,
                        sync_status TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        checksum TEXT NOT NULL,
                        compressed INTEGER NOT NULL DEFAULT 0,
                        size_bytes INTEGER NOT NULL DEFAULT 0
                    )
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_cache_key 
                    ON cache_entries(entry_type, key)
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_cache_expires 
                    ON cache_entries(expires_at)
                """)
                
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_cache_sync_status 
                    ON cache_entries(sync_status)
                """)
                
                conn.commit()
                logger.info("Cache database initialized")
                
        except Exception as e:
            logger.error(f"Failed to initialize cache database: {e}")
            raise
    
    def _generate_cache_id(self, entry_type: CacheEntryType, key: str) -> str:
        """Generate unique cache entry ID"""
        content = f"{entry_type.value}:{key}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def _calculate_checksum(self, data: Dict[str, Any]) -> str:
        """Calculate checksum for data integrity"""
        data_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(data_str.encode()).hexdigest()
    
    def _compress_data(self, data: str) -> Tuple[str, bool]:
        """Compress data if it's large enough to benefit"""
        data_bytes = data.encode('utf-8')
        
        # Only compress if data is larger than 1KB
        if len(data_bytes) > 1024:
            compressed = gzip.compress(data_bytes)
            # Only use compression if it actually reduces size
            if len(compressed) < len(data_bytes):
                return base64.b64encode(compressed).decode('utf-8'), True
        
        return data, False
    
    def _decompress_data(self, data: str, compressed: bool) -> str:
        """Decompress data if it was compressed"""
        if not compressed:
            return data
        
        try:
            compressed_bytes = base64.b64decode(data.encode('utf-8'))
            decompressed_bytes = gzip.decompress(compressed_bytes)
            return decompressed_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to decompress data: {e}")
            return data
    
    def put(
        self,
        entry_type: CacheEntryType,
        key: str,
        data: Dict[str, Any],
        ttl_hours: Optional[int] = None,
        sync_status: SyncStatus = SyncStatus.SYNCED
    ) -> bool:
        """Store data in cache"""
        try:
            cache_id = self._generate_cache_id(entry_type, key)
            now = datetime.utcnow()
            if ttl_hours is None:
                ttl = self.default_ttl_hours
                expires_at = now + timedelta(hours=ttl)
            elif ttl_hours == 0:
                expires_at = None  # No expiration
            else:
                expires_at = now + timedelta(hours=ttl_hours)
            
            # Serialize and optionally compress data
            data_json = json.dumps(data)
            compressed_data, is_compressed = self._compress_data(data_json)
            
            # Calculate checksum
            checksum = self._calculate_checksum(data)
            
            # Get current version or start at 1
            current_version = self._get_entry_version(cache_id)
            new_version = current_version + 1 if current_version else 1
            
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO cache_entries 
                    (id, entry_type, key, data, created_at, updated_at, expires_at, 
                     sync_status, version, checksum, compressed, size_bytes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cache_id,
                    entry_type.value,
                    key,
                    compressed_data,
                    now.isoformat(),
                    now.isoformat(),
                    expires_at.isoformat() if expires_at else None,
                    sync_status.value,
                    new_version,
                    checksum,
                    1 if is_compressed else 0,
                    len(compressed_data.encode('utf-8'))
                ))
                conn.commit()
            
            self.stats["writes"] += 1
            logger.debug(f"Cached {entry_type.value}:{key} (version {new_version})")
            
            # Clean up if cache is getting too large
            self._cleanup_if_needed()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to cache data: {e}")
            return False
    
    def get(self, entry_type: CacheEntryType, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve data from cache"""
        try:
            cache_id = self._generate_cache_id(entry_type, key)
            now = datetime.utcnow()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    SELECT data, expires_at, compressed, checksum
                    FROM cache_entries 
                    WHERE id = ?
                """, (cache_id,))
                
                row = cursor.fetchone()
                if not row:
                    self.stats["misses"] += 1
                    return None
                
                data_str, expires_at_str, compressed, checksum = row
                
                # Check if entry has expired
                if expires_at_str:
                    expires_at = datetime.fromisoformat(expires_at_str)
                    if now > expires_at:
                        self._delete_entry(cache_id)
                        self.stats["misses"] += 1
                        return None
                
                # Decompress data if needed
                decompressed_data = self._decompress_data(data_str, bool(compressed))
                
                # Parse JSON
                data = json.loads(decompressed_data)
                
                # Verify checksum
                calculated_checksum = self._calculate_checksum(data)
                if calculated_checksum != checksum:
                    logger.warning(f"Checksum mismatch for {entry_type.value}:{key}")
                    self._delete_entry(cache_id)
                    self.stats["misses"] += 1
                    return None
                
                self.stats["hits"] += 1
                return data
                
        except Exception as e:
            logger.error(f"Failed to retrieve cached data: {e}")
            self.stats["misses"] += 1
            return None
    
    def delete(self, entry_type: CacheEntryType, key: str) -> bool:
        """Delete entry from cache"""
        try:
            cache_id = self._generate_cache_id(entry_type, key)
            return self._delete_entry(cache_id)
        except Exception as e:
            logger.error(f"Failed to delete cache entry: {e}")
            return False
    
    def _delete_entry(self, cache_id: str) -> bool:
        """Delete entry by cache ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("DELETE FROM cache_entries WHERE id = ?", (cache_id,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to delete cache entry {cache_id}: {e}")
            return False
    
    def _get_entry_version(self, cache_id: str) -> Optional[int]:
        """Get current version of cache entry"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT version FROM cache_entries WHERE id = ?", (cache_id,))
                row = cursor.fetchone()
                return row[0] if row else None
        except Exception as e:
            logger.error(f"Failed to get entry version: {e}")
            return None
    
    def list_entries(
        self, 
        entry_type: Optional[CacheEntryType] = None,
        sync_status: Optional[SyncStatus] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List cache entries with optional filtering"""
        try:
            query = "SELECT * FROM cache_entries WHERE 1=1"
            params = []
            
            if entry_type:
                query += " AND entry_type = ?"
                params.append(entry_type.value)
            
            if sync_status:
                query += " AND sync_status = ?"
                params.append(sync_status.value)
            
            query += " ORDER BY updated_at DESC LIMIT ?"
            params.append(limit)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(query, params)
                rows = cursor.fetchall()
                
                entries = []
                for row in rows:
                    entry_dict = dict(row)
                    # Convert compressed flag to boolean
                    entry_dict['compressed'] = bool(entry_dict['compressed'])
                    entries.append(entry_dict)
                
                return entries
                
        except Exception as e:
            logger.error(f"Failed to list cache entries: {e}")
            return []
    
    def mark_for_sync(self, entry_type: CacheEntryType, key: str) -> bool:
        """Mark entry as needing synchronization"""
        try:
            cache_id = self._generate_cache_id(entry_type, key)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    UPDATE cache_entries 
                    SET sync_status = ?, updated_at = ?
                    WHERE id = ?
                """, (SyncStatus.PENDING_SYNC.value, datetime.utcnow().isoformat(), cache_id))
                conn.commit()
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Failed to mark entry for sync: {e}")
            return False
    
    def mark_synced(self, entry_type: CacheEntryType, key: str) -> bool:
        """Mark entry as synchronized"""
        try:
            cache_id = self._generate_cache_id(entry_type, key)
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    UPDATE cache_entries 
                    SET sync_status = ?, updated_at = ?
                    WHERE id = ?
                """, (SyncStatus.SYNCED.value, datetime.utcnow().isoformat(), cache_id))
                conn.commit()
                self.stats["sync_operations"] += 1
                return cursor.rowcount > 0
                
        except Exception as e:
            logger.error(f"Failed to mark entry as synced: {e}")
            return False
    
    def get_pending_sync_entries(self) -> List[Dict[str, Any]]:
        """Get entries that need to be synchronized"""
        return self.list_entries(sync_status=SyncStatus.PENDING_SYNC)
    
    def cleanup_expired(self) -> int:
        """Remove expired entries from cache"""
        try:
            now = datetime.utcnow()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("""
                    DELETE FROM cache_entries 
                    WHERE expires_at IS NOT NULL AND expires_at < ?
                """, (now.isoformat(),))
                conn.commit()
                
                deleted_count = cursor.rowcount
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} expired cache entries")
                
                return deleted_count
                
        except Exception as e:
            logger.error(f"Failed to cleanup expired entries: {e}")
            return 0
    
    def _cleanup_if_needed(self):
        """Clean up cache if it's getting too large"""
        try:
            # Get current cache size
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute("SELECT SUM(size_bytes) FROM cache_entries")
                total_size = cursor.fetchone()[0] or 0
            
            # Convert to MB
            size_mb = total_size / (1024 * 1024)
            
            if size_mb > self.max_cache_size_mb:
                # Remove oldest entries until we're under the limit
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute("""
                        DELETE FROM cache_entries 
                        WHERE id IN (
                            SELECT id FROM cache_entries 
                            ORDER BY updated_at ASC 
                            LIMIT ?
                        )
                    """, (max(1, int(total_size * 0.1)),))  # Remove 10% of entries
                    
                    evicted_count = cursor.rowcount
                    conn.commit()
                    
                    self.stats["evictions"] += evicted_count
                    logger.info(f"Evicted {evicted_count} cache entries to free space")
                    
        except Exception as e:
            logger.error(f"Failed to cleanup cache: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                # Get entry counts by type
                cursor = conn.execute("""
                    SELECT entry_type, COUNT(*) as count
                    FROM cache_entries 
                    GROUP BY entry_type
                """)
                entry_counts = dict(cursor.fetchall())
                
                # Get total size
                cursor = conn.execute("SELECT SUM(size_bytes) FROM cache_entries")
                total_size = cursor.fetchone()[0] or 0
                
                # Get sync status counts
                cursor = conn.execute("""
                    SELECT sync_status, COUNT(*) as count
                    FROM cache_entries 
                    GROUP BY sync_status
                """)
                sync_counts = dict(cursor.fetchall())
                
                return {
                    "total_entries": sum(entry_counts.values()),
                    "total_size_mb": round(total_size / (1024 * 1024), 2),
                    "entry_counts": entry_counts,
                    "sync_counts": sync_counts,
                    "hit_rate": self.stats["hits"] / max(1, self.stats["hits"] + self.stats["misses"]),
                    **self.stats
                }
                
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"error": str(e)}
    
    def clear_all(self) -> bool:
        """Clear all cache entries"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("DELETE FROM cache_entries")
                conn.commit()
                logger.info("Cleared all cache entries")
                return True
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False

# Global cache instance
mobile_cache = MobileOfflineCache()

# Convenience functions for common cache operations
def cache_connection_status(connection_id: str, status_data: Dict[str, Any], ttl_hours: int = 1):
    """Cache connection status data"""
    return mobile_cache.put(
        CacheEntryType.CONNECTION_STATUS,
        connection_id,
        status_data,
        ttl_hours=ttl_hours
    )

def get_cached_connection_status(connection_id: str) -> Optional[Dict[str, Any]]:
    """Get cached connection status"""
    return mobile_cache.get(CacheEntryType.CONNECTION_STATUS, connection_id)

def cache_health_metrics(connection_id: str, metrics_data: Dict[str, Any], ttl_hours: int = 1):
    """Cache health metrics data"""
    return mobile_cache.put(
        CacheEntryType.HEALTH_METRICS,
        connection_id,
        metrics_data,
        ttl_hours=ttl_hours
    )

def get_cached_health_metrics(connection_id: str) -> Optional[Dict[str, Any]]:
    """Get cached health metrics"""
    return mobile_cache.get(CacheEntryType.HEALTH_METRICS, connection_id)

def cache_container_status(container_id: str, status_data: Dict[str, Any], ttl_hours: int = 1):
    """Cache container status data"""
    return mobile_cache.put(
        CacheEntryType.CONTAINER_STATUS,
        container_id,
        status_data,
        ttl_hours=ttl_hours
    )

def get_cached_container_status(container_id: str) -> Optional[Dict[str, Any]]:
    """Get cached container status"""
    return mobile_cache.get(CacheEntryType.CONTAINER_STATUS, container_id)

def cache_query_result(query_hash: str, result_data: Dict[str, Any], ttl_hours: int = 24):
    """Cache query result data"""
    return mobile_cache.put(
        CacheEntryType.QUERY_RESULT,
        query_hash,
        result_data,
        ttl_hours=ttl_hours
    )

def get_cached_query_result(query_hash: str) -> Optional[Dict[str, Any]]:
    """Get cached query result"""
    return mobile_cache.get(CacheEntryType.QUERY_RESULT, query_hash)