"""
Connection Manager with Pooling Support
Manages database connections with connection pooling, health monitoring, and auto-reconnection
"""

import asyncio
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from queue import Queue, Empty, Full
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
import logging

from ..adapters.base_adapter import DatabaseAdapter, DatabaseType, ConnectionParams
from ..adapters.adapter_factory import AdapterFactory
from .connection_profile import ConnectionProfile, ConnectionProfileManager
from .security import SecurityError


logger = logging.getLogger(__name__)


class ConnectionStatus(Enum):
    """Connection status enumeration"""
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"
    RECONNECTING = "reconnecting"
    CLOSING = "closing"


@dataclass
class ConnectionMetrics:
    """Connection performance metrics"""
    connection_id: str
    profile_name: str
    db_type: DatabaseType
    status: ConnectionStatus
    created_at: datetime
    last_used: Optional[datetime] = None
    last_health_check: Optional[datetime] = None
    total_queries: int = 0
    failed_queries: int = 0
    avg_response_time: float = 0.0
    connection_errors: int = 0
    reconnection_attempts: int = 0
    pool_size: int = 0
    active_connections: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def update_query_stats(self, execution_time: float, success: bool = True):
        """Update query execution statistics"""
        self.total_queries += 1
        self.last_used = datetime.now()
        
        if success:
            # Update average response time
            if self.avg_response_time == 0:
                self.avg_response_time = execution_time
            else:
                self.avg_response_time = (self.avg_response_time + execution_time) / 2
        else:
            self.failed_queries += 1

    def update_connection_error(self):
        """Update connection error statistics"""
        self.connection_errors += 1
        self.status = ConnectionStatus.ERROR

    def update_reconnection_attempt(self):
        """Update reconnection attempt statistics"""
        self.reconnection_attempts += 1
        self.status = ConnectionStatus.RECONNECTING


class ConnectionPool:
    """Database connection pool for performance optimization"""
    
    def __init__(self, profile: ConnectionProfile, pool_size: int = 5, 
                 max_overflow: int = 10, timeout: int = 30):
        """Initialize connection pool"""
        self.profile = profile
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self.timeout = timeout
        
        # Connection management
        self.available_connections = Queue(maxsize=pool_size + max_overflow)
        self.active_connections: Dict[str, DatabaseAdapter] = {}
        self.connection_count = 0
        self.overflow_count = 0
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Pool status
        self.is_closed = False
        self.created_at = datetime.now()
        
        # Initialize pool
        self._initialize_pool()

    def _initialize_pool(self):
        """Initialize the connection pool with minimum connections"""
        with self.lock:
            for _ in range(min(self.pool_size, 2)):  # Start with 2 connections
                try:
                    adapter = self._create_connection()
                    if adapter:
                        self.available_connections.put(adapter, block=False)
                        self.connection_count += 1
                except Exception as e:
                    logger.warning(f"Failed to initialize connection in pool: {e}")

    def _create_connection(self) -> Optional[DatabaseAdapter]:
        """Create a new database connection"""
        try:
            adapter = AdapterFactory.create_adapter(
                self.profile.db_type,
                self.profile.connection_params
            )
            
            if adapter.connect():
                return adapter
            else:
                return None
                
        except Exception as e:
            logger.error(f"Failed to create connection: {e}")
            return None

    def get_connection(self, timeout: Optional[int] = None) -> Optional[DatabaseAdapter]:
        """Get connection from pool"""
        if self.is_closed:
            raise RuntimeError("Connection pool is closed")
        
        timeout = timeout or self.timeout
        
        with self.lock:
            # Try to get available connection
            try:
                adapter = self.available_connections.get(timeout=0.1)
                if adapter and adapter.is_connected():
                    connection_id = str(uuid.uuid4())
                    self.active_connections[connection_id] = adapter
                    return adapter
                elif adapter:
                    # Connection is not healthy, discard it
                    self.connection_count -= 1
            except Empty:
                pass
            
            # Create new connection if under limits
            if self.connection_count < self.pool_size + self.overflow_count:
                adapter = self._create_connection()
                if adapter:
                    if self.connection_count < self.pool_size:
                        self.connection_count += 1
                    else:
                        self.overflow_count += 1
                    
                    connection_id = str(uuid.uuid4())
                    self.active_connections[connection_id] = adapter
                    return adapter
        
        # Wait for available connection
        try:
            adapter = self.available_connections.get(timeout=timeout)
            if adapter and adapter.is_connected():
                connection_id = str(uuid.uuid4())
                self.active_connections[connection_id] = adapter
                return adapter
            elif adapter:
                # Connection is not healthy, discard it
                with self.lock:
                    self.connection_count -= 1
        except Empty:
            pass
        
        raise TimeoutError(f"No available connections in pool after {timeout} seconds")

    def return_connection(self, adapter: DatabaseAdapter):
        """Return connection to pool"""
        if self.is_closed:
            adapter.disconnect()
            return
        
        with self.lock:
            # Remove from active connections
            connection_id = None
            for cid, conn in self.active_connections.items():
                if conn is adapter:
                    connection_id = cid
                    break
            
            if connection_id:
                del self.active_connections[connection_id]
            
            # Return to pool if healthy and under pool size
            if adapter.is_connected():
                try:
                    if self.connection_count <= self.pool_size:
                        self.available_connections.put(adapter, block=False)
                    else:
                        # Over pool size, close overflow connection
                        adapter.disconnect()
                        if self.overflow_count > 0:
                            self.overflow_count -= 1
                        else:
                            self.connection_count -= 1
                except Full:
                    # Pool is full, close connection
                    adapter.disconnect()
                    if self.overflow_count > 0:
                        self.overflow_count -= 1
                    else:
                        self.connection_count -= 1
            else:
                # Connection is not healthy, discard it
                if self.overflow_count > 0:
                    self.overflow_count -= 1
                else:
                    self.connection_count -= 1

    def close(self):
        """Close all connections in the pool"""
        with self.lock:
            self.is_closed = True
            
            # Close active connections
            for adapter in self.active_connections.values():
                try:
                    adapter.disconnect()
                except Exception as e:
                    logger.warning(f"Error closing active connection: {e}")
            
            self.active_connections.clear()
            
            # Close available connections
            while not self.available_connections.empty():
                try:
                    adapter = self.available_connections.get(block=False)
                    adapter.disconnect()
                except (Empty, Exception) as e:
                    if not isinstance(e, Empty):
                        logger.warning(f"Error closing pooled connection: {e}")
            
            self.connection_count = 0
            self.overflow_count = 0

    def get_stats(self) -> Dict[str, Any]:
        """Get pool statistics"""
        with self.lock:
            return {
                'pool_size': self.pool_size,
                'max_overflow': self.max_overflow,
                'connection_count': self.connection_count,
                'overflow_count': self.overflow_count,
                'active_connections': len(self.active_connections),
                'available_connections': self.available_connections.qsize(),
                'is_closed': self.is_closed,
                'created_at': self.created_at.isoformat()
            }

    def health_check(self) -> bool:
        """Perform health check on pool"""
        if self.is_closed:
            return False
        
        healthy_connections = 0
        with self.lock:
            # Check a sample of available connections
            temp_connections = []
            for _ in range(min(3, self.available_connections.qsize())):
                try:
                    adapter = self.available_connections.get(block=False)
                    temp_connections.append(adapter)
                    
                    if adapter.is_connected():
                        # Perform simple health check
                        try:
                            health_result = adapter.test_connection()
                            if health_result.get('connected', False):
                                healthy_connections += 1
                        except Exception:
                            pass
                except Empty:
                    break
            
            # Return connections to pool
            for adapter in temp_connections:
                try:
                    self.available_connections.put(adapter, block=False)
                except Full:
                    adapter.disconnect()
                    self.connection_count -= 1
        
        return healthy_connections > 0


class ConnectionManager:
    """Manages database connections with pooling and health monitoring"""
    
    def __init__(self, profile_manager: Optional[ConnectionProfileManager] = None,
                 default_pool_size: int = 5, health_check_interval: int = 60):
        """Initialize connection manager"""
        self.profile_manager = profile_manager or ConnectionProfileManager()
        self.default_pool_size = default_pool_size
        self.health_check_interval = health_check_interval
        
        # Connection management
        self.connections: Dict[str, DatabaseAdapter] = {}
        self.connection_pools: Dict[str, ConnectionPool] = {}
        self.connection_metrics: Dict[str, ConnectionMetrics] = {}
        
        # Thread safety
        self.lock = threading.RLock()
        
        # Health monitoring
        self.health_monitor_active = False
        self.health_monitor_thread: Optional[threading.Thread] = None
        self.executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="ConnectionManager")
        
        # Event callbacks
        self.connection_callbacks: List[Callable] = []
        self.error_callbacks: List[Callable] = []
        
        # Start health monitoring
        self.start_health_monitoring()

    def create_connection(self, profile: ConnectionProfile, 
                         use_pool: bool = True) -> str:
        """Create new database connection"""
        connection_id = str(uuid.uuid4())
        
        try:
            if use_pool:
                # Create or get connection pool
                pool_key = f"{profile.id}_pool"
                
                with self.lock:
                    if pool_key not in self.connection_pools:
                        pool = ConnectionPool(
                            profile=profile,
                            pool_size=profile.connection_params.pool_size or self.default_pool_size,
                            max_overflow=profile.connection_params.max_overflow or 10,
                            timeout=profile.connection_timeout
                        )
                        self.connection_pools[pool_key] = pool
                    else:
                        pool = self.connection_pools[pool_key]
                
                # Get connection from pool
                adapter = pool.get_connection(timeout=profile.connection_timeout)
                if not adapter:
                    raise ConnectionError(f"Failed to get connection from pool for {profile.name}")
                
            else:
                # Create direct connection
                adapter = AdapterFactory.create_adapter(
                    profile.db_type,
                    profile.connection_params
                )
                
                if not adapter.connect():
                    raise ConnectionError(f"Failed to connect to {profile.name}")
            
            # Store connection
            with self.lock:
                self.connections[connection_id] = adapter
                
                # Create metrics
                metrics = ConnectionMetrics(
                    connection_id=connection_id,
                    profile_name=profile.name,
                    db_type=profile.db_type,
                    status=ConnectionStatus.CONNECTED,
                    created_at=datetime.now(),
                    pool_size=profile.connection_params.pool_size or self.default_pool_size
                )
                self.connection_metrics[connection_id] = metrics
            
            # Update profile last used
            profile.update_last_used()
            self.profile_manager.update_profile(profile)
            
            # Notify callbacks
            self._notify_connection_callbacks('connected', connection_id, profile)
            
            logger.info(f"Created connection {connection_id} for profile {profile.name}")
            return connection_id
            
        except Exception as e:
            logger.error(f"Failed to create connection for {profile.name}: {e}")
            self._notify_error_callbacks('connection_failed', profile, str(e))
            raise ConnectionError(f"Failed to create connection: {str(e)}")

    def get_connection(self, connection_id: str) -> Optional[DatabaseAdapter]:
        """Get existing connection"""
        with self.lock:
            adapter = self.connections.get(connection_id)
            if adapter and connection_id in self.connection_metrics:
                self.connection_metrics[connection_id].last_used = datetime.now()
            return adapter

    def close_connection(self, connection_id: str) -> bool:
        """Close and remove connection"""
        with self.lock:
            if connection_id not in self.connections:
                return False
            
            adapter = self.connections[connection_id]
            
            # Update metrics
            if connection_id in self.connection_metrics:
                self.connection_metrics[connection_id].status = ConnectionStatus.CLOSING
            
            try:
                # Return to pool if it's a pooled connection
                pool_returned = False
                for pool in self.connection_pools.values():
                    if adapter in pool.active_connections.values():
                        pool.return_connection(adapter)
                        pool_returned = True
                        break
                
                # If not returned to pool, disconnect directly
                if not pool_returned:
                    adapter.disconnect()
                
                # Remove from active connections
                del self.connections[connection_id]
                
                # Update metrics
                if connection_id in self.connection_metrics:
                    self.connection_metrics[connection_id].status = ConnectionStatus.DISCONNECTED
                
                logger.info(f"Closed connection {connection_id}")
                return True
                
            except Exception as e:
                logger.error(f"Error closing connection {connection_id}: {e}")
                return False

    def list_connections(self) -> List[Dict[str, Any]]:
        """List all active connections with their status"""
        with self.lock:
            connections = []
            for connection_id, adapter in self.connections.items():
                metrics = self.connection_metrics.get(connection_id)
                
                connection_info = {
                    'connection_id': connection_id,
                    'status': 'connected' if adapter.is_connected() else 'disconnected',
                    'database_type': adapter.database_type.value,
                    'connection_info': adapter.get_connection_info()
                }
                
                if metrics:
                    connection_info.update({
                        'profile_name': metrics.profile_name,
                        'created_at': metrics.created_at.isoformat(),
                        'last_used': metrics.last_used.isoformat() if metrics.last_used else None,
                        'total_queries': metrics.total_queries,
                        'failed_queries': metrics.failed_queries,
                        'avg_response_time': metrics.avg_response_time,
                        'connection_errors': metrics.connection_errors
                    })
                
                connections.append(connection_info)
            
            return connections

    def get_connection_metrics(self, connection_id: str) -> Optional[ConnectionMetrics]:
        """Get metrics for specific connection"""
        return self.connection_metrics.get(connection_id)
    
    def get_profile_by_connection(self, connection_id: str) -> Optional[ConnectionProfile]:
        """Get connection profile by connection ID"""
        metrics = self.connection_metrics.get(connection_id)
        if metrics:
            # Find profile by name
            profiles = self.profile_manager.list_profiles()
            for profile in profiles:
                if profile.name == metrics.profile_name:
                    return profile
        return None
    
    def update_profile(self, profile: ConnectionProfile):
        """Update an existing connection profile"""
        self.profile_manager.update_profile(profile)

    def get_pool_stats(self) -> Dict[str, Any]:
        """Get statistics for all connection pools"""
        with self.lock:
            pool_stats = {}
            for pool_key, pool in self.connection_pools.items():
                pool_stats[pool_key] = pool.get_stats()
            return pool_stats

    def execute_query_with_metrics(self, connection_id: str, query: str, 
                                  params: Optional[Dict[str, Any]] = None):
        """Execute query and update metrics"""
        adapter = self.get_connection(connection_id)
        if not adapter:
            raise ValueError(f"Connection {connection_id} not found")
        
        start_time = time.time()
        success = True
        
        try:
            result = adapter.execute_query(query, params)
            execution_time = time.time() - start_time
            
            # Update metrics
            if connection_id in self.connection_metrics:
                self.connection_metrics[connection_id].update_query_stats(
                    execution_time, success=result.success
                )
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            success = False
            
            # Update metrics
            if connection_id in self.connection_metrics:
                self.connection_metrics[connection_id].update_query_stats(
                    execution_time, success=False
                )
            
            raise e

    def test_connection(self, profile: ConnectionProfile) -> Dict[str, Any]:
        """Test connection without creating persistent connection"""
        try:
            adapter = AdapterFactory.create_adapter(
                profile.db_type,
                profile.connection_params
            )
            
            start_time = time.time()
            result = adapter.test_connection()
            response_time = time.time() - start_time
            
            result['response_time'] = response_time
            result['profile_name'] = profile.name
            
            return result
            
        except Exception as e:
            return {
                'connected': False,
                'error': str(e),
                'profile_name': profile.name,
                'response_time': 0.0
            }

    def reconnect(self, connection_id: str) -> bool:
        """Attempt to reconnect a failed connection"""
        with self.lock:
            if connection_id not in self.connections:
                return False
            
            adapter = self.connections[connection_id]
            metrics = self.connection_metrics.get(connection_id)
            
            if metrics:
                metrics.update_reconnection_attempt()
            
            try:
                # Disconnect first
                adapter.disconnect()
                
                # Attempt reconnection
                if adapter.connect():
                    if metrics:
                        metrics.status = ConnectionStatus.CONNECTED
                    
                    logger.info(f"Successfully reconnected {connection_id}")
                    return True
                else:
                    if metrics:
                        metrics.status = ConnectionStatus.ERROR
                    
                    logger.error(f"Failed to reconnect {connection_id}")
                    return False
                    
            except Exception as e:
                if metrics:
                    metrics.update_connection_error()
                
                logger.error(f"Error during reconnection of {connection_id}: {e}")
                return False

    def start_health_monitoring(self):
        """Start background health monitoring"""
        if self.health_monitor_active:
            return
        
        self.health_monitor_active = True
        self.health_monitor_thread = threading.Thread(
            target=self._health_monitor_loop,
            daemon=True,
            name="ConnectionHealthMonitor"
        )
        self.health_monitor_thread.start()
        logger.info("Started connection health monitoring")

    def stop_health_monitoring(self):
        """Stop background health monitoring"""
        self.health_monitor_active = False
        if self.health_monitor_thread:
            self.health_monitor_thread.join(timeout=5)
        logger.info("Stopped connection health monitoring")

    def _health_monitor_loop(self):
        """Background health monitoring loop"""
        while self.health_monitor_active:
            try:
                self._perform_health_checks()
                time.sleep(self.health_check_interval)
            except Exception as e:
                logger.error(f"Error in health monitoring: {e}")
                time.sleep(10)  # Wait before retrying

    def _perform_health_checks(self):
        """Perform health checks on all connections and pools"""
        with self.lock:
            # Check individual connections
            failed_connections = []
            
            for connection_id, adapter in self.connections.items():
                try:
                    if not adapter.is_connected():
                        failed_connections.append(connection_id)
                        continue
                    
                    # Perform health check
                    health_result = adapter.test_connection()
                    metrics = self.connection_metrics.get(connection_id)
                    
                    if metrics:
                        metrics.last_health_check = datetime.now()
                        
                        if not health_result.get('connected', False):
                            metrics.update_connection_error()
                            failed_connections.append(connection_id)
                        else:
                            metrics.status = ConnectionStatus.CONNECTED
                
                except Exception as e:
                    logger.warning(f"Health check failed for connection {connection_id}: {e}")
                    failed_connections.append(connection_id)
            
            # Handle failed connections
            for connection_id in failed_connections:
                self._handle_failed_connection(connection_id)
            
            # Check connection pools
            for pool_key, pool in self.connection_pools.items():
                try:
                    if not pool.health_check():
                        logger.warning(f"Pool {pool_key} failed health check")
                except Exception as e:
                    logger.error(f"Error checking pool {pool_key}: {e}")

    def _handle_failed_connection(self, connection_id: str):
        """Handle a failed connection"""
        metrics = self.connection_metrics.get(connection_id)
        if not metrics:
            return
        
        # Attempt reconnection if under retry limit
        max_retries = 3
        if metrics.reconnection_attempts < max_retries:
            logger.info(f"Attempting to reconnect failed connection {connection_id}")
            
            # Schedule reconnection in background
            self.executor.submit(self._background_reconnect, connection_id)
        else:
            logger.warning(f"Connection {connection_id} exceeded retry limit, marking as failed")
            metrics.status = ConnectionStatus.ERROR

    def _background_reconnect(self, connection_id: str):
        """Perform reconnection in background thread"""
        try:
            if self.reconnect(connection_id):
                logger.info(f"Background reconnection successful for {connection_id}")
            else:
                logger.warning(f"Background reconnection failed for {connection_id}")
        except Exception as e:
            logger.error(f"Error in background reconnection for {connection_id}: {e}")

    def add_connection_callback(self, callback: Callable):
        """Add callback for connection events"""
        self.connection_callbacks.append(callback)

    def add_error_callback(self, callback: Callable):
        """Add callback for error events"""
        self.error_callbacks.append(callback)

    def _notify_connection_callbacks(self, event: str, connection_id: str, profile: ConnectionProfile):
        """Notify connection event callbacks"""
        for callback in self.connection_callbacks:
            try:
                callback(event, connection_id, profile)
            except Exception as e:
                logger.error(f"Error in connection callback: {e}")

    def _notify_error_callbacks(self, event: str, profile: ConnectionProfile, error: str):
        """Notify error event callbacks"""
        for callback in self.error_callbacks:
            try:
                callback(event, profile, error)
            except Exception as e:
                logger.error(f"Error in error callback: {e}")

    def close_all_connections(self):
        """Close all connections and pools"""
        with self.lock:
            # Close individual connections
            connection_ids = list(self.connections.keys())
            for connection_id in connection_ids:
                self.close_connection(connection_id)
            
            # Close all pools
            for pool in self.connection_pools.values():
                pool.close()
            
            self.connection_pools.clear()
            self.connection_metrics.clear()
        
        logger.info("Closed all connections and pools")

    def shutdown(self):
        """Shutdown connection manager"""
        logger.info("Shutting down connection manager")
        
        # Stop health monitoring
        self.stop_health_monitoring()
        
        # Close all connections
        self.close_all_connections()
        
        # Shutdown executor
        self.executor.shutdown(wait=True)
        
        logger.info("Connection manager shutdown complete")

    def __enter__(self):
        """Context manager entry"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.shutdown()


# Global instance
connection_manager = ConnectionManager()

__all__ = [
    'ConnectionStatus',
    'ConnectionMetrics',
    'ConnectionPool',
    'ConnectionManager',
    'connection_manager'
]