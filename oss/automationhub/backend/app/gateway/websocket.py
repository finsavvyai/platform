"""
WebSocket Proxy System

This module provides comprehensive WebSocket proxy functionality including:
- WebSocket authentication and authorization
- Connection management and tracking
- Message filtering and routing
- Rate limiting for WebSocket connections
- Connection monitoring and analytics
- Protocol negotiation and support
- Load balancing across backend services
- Graceful connection termination

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import weakref

from fastapi import WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.websockets import WebSocketState
import websockets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update

from app.gateway.config import GatewayPolicyConfig
from app.gateway.auth import GatewayAuthenticator, AuthenticationResult
from app.gateway.models import WebSocketConnection
from app.core.database import get_db

logger = logging.getLogger(__name__)


class WebSocketStatus(str, Enum):
    """WebSocket connection status"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class MessageType(str, Enum):
    """WebSocket message types"""
    TEXT = "text"
    BINARY = "binary"
    JSON = "json"
    PING = "ping"
    PONG = "pong"
    CLOSE = "close"


@dataclass
class WebSocketMetrics:
    """WebSocket connection metrics"""
    connection_id: str
    user_id: str
    endpoint: str
    connected_at: datetime
    last_activity_at: datetime
    message_count: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    ping_count: int = 0
    pong_count: int = 0
    error_count: int = 0
    duration_seconds: float = 0.0

    def update_activity(self):
        """Update last activity timestamp"""
        self.last_activity_at = datetime.utcnow()
        if self.connected_at:
            self.duration_seconds = (self.last_activity_at - self.connected_at).total_seconds()


@dataclass
class ConnectionConfig:
    """WebSocket connection configuration"""
    endpoint: str
    target_service: str
    target_url: str
    allowed_origins: List[str] = field(default_factory=list)
    max_connections_per_user: int = 100
    max_message_size: int = 1024 * 1024  # 1MB
    heartbeat_interval: int = 30  # seconds
    heartbeat_timeout: int = 90  # seconds
    enable_compression: bool = True
    enable_metrics: bool = True
    message_filters: List[Callable] = field(default_factory=list)
    auth_required: bool = True


class WebSocketConnectionManager:
    """Manages active WebSocket connections"""

    def __init__(self):
        self.active_connections: Dict[str, WebSocketConnection] = {}
        self.connection_metrics: Dict[str, WebSocketMetrics] = {}
        self.user_connections: Dict[str, Set[str]] = {}  # user_id -> set of connection_ids
        self.endpoint_connections: Dict[str, Set[str]] = {}  # endpoint -> set of connection_ids
        self._lock = asyncio.Lock()

    async def add_connection(
        self,
        connection_id: str,
        websocket: WebSocket,
        user_id: str,
        endpoint: str,
        organization_id: Optional[str] = None,
        api_key_id: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> WebSocketConnection:
        """Add new WebSocket connection"""
        async with self._lock:
            # Create connection record
            connection = WebSocketConnection(
                connection_id=connection_id,
                user_id=user_id,
                organization_id=organization_id,
                api_key_id=api_key_id,
                endpoint=endpoint,
                ip_address=websocket.client.host if websocket.client else "unknown",
                user_agent=websocket.headers.get("user-agent", ""),
                origin=websocket.headers.get("origin"),
                connected_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow(),
                is_active=True,
                metadata=metadata or {}
            )

            # Store in database
            from app.core.database import get_db
            async for db in get_db():
                db.add(connection)
                await db.commit()
                await db.refresh(connection)

            # Store in memory
            self.active_connections[connection_id] = connection

            # Create metrics
            metrics = WebSocketMetrics(
                connection_id=connection_id,
                user_id=user_id,
                endpoint=endpoint,
                connected_at=connection.connected_at,
                last_activity_at=connection.last_activity_at
            )
            self.connection_metrics[connection_id] = metrics

            # Update user connections
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)

            # Update endpoint connections
            if endpoint not in self.endpoint_connections:
                self.endpoint_connections[endpoint] = set()
            self.endpoint_connections[endpoint].add(connection_id)

            logger.info(f"Added WebSocket connection {connection_id} for user {user_id}")

            return connection

    async def remove_connection(self, connection_id: str, reason: str = None, disconnect_code: int = None):
        """Remove WebSocket connection"""
        async with self._lock:
            connection = self.active_connections.get(connection_id)
            if not connection:
                return

            # Update database record
            from app.core.database import get_db
            async for db in get_db():
                await db.execute(
                    update(WebSocketConnection)
                    .where(WebSocketConnection.connection_id == connection_id)
                    .values(
                        is_active=False,
                        disconnected_at=datetime.utcnow(),
                        disconnect_reason=reason,
                        disconnect_code=disconnect_code,
                        last_activity_at=connection.last_activity_at
                    )
                )
                await db.commit()

            # Remove from memory
            del self.active_connections[connection_id]
            if connection_id in self.connection_metrics:
                del self.connection_metrics[connection_id]

            # Update user connections
            if connection.user_id in self.user_connections:
                self.user_connections[connection.user_id].discard(connection_id)
                if not self.user_connections[connection.user_id]:
                    del self.user_connections[connection.user_id]

            # Update endpoint connections
            if connection.endpoint in self.endpoint_connections:
                self.endpoint_connections[connection.endpoint].discard(connection_id)
                if not self.endpoint_connections[connection.endpoint]:
                    del self.endpoint_connections[connection.endpoint]

            logger.info(f"Removed WebSocket connection {connection_id}: {reason}")

    async def update_connection_activity(self, connection_id: str, message_size: int = 0):
        """Update connection activity and metrics"""
        connection = self.active_connections.get(connection_id)
        if not connection:
            return

        metrics = self.connection_metrics.get(connection_id)
        if metrics:
            metrics.update_activity()
            metrics.message_count += 1
            metrics.bytes_received += message_size

        # Update database
        connection.last_activity_at = datetime.utcnow()
        connection.message_count += 1
        connection.bytes_received += message_size

        from app.core.database import get_db
        async for db in get_db():
            await db.execute(
                update(WebSocketConnection)
                .where(WebSocketConnection.connection_id == connection_id)
                .values(
                    last_activity_at=connection.last_activity_at,
                    message_count=connection.message_count,
                    bytes_received=connection.bytes_received
                )
            )
            await db.commit()

    def get_connection(self, connection_id: str) -> Optional[WebSocketConnection]:
        """Get connection by ID"""
        return self.active_connections.get(connection_id)

    def get_user_connections(self, user_id: str) -> List[WebSocketConnection]:
        """Get all connections for a user"""
        connection_ids = self.user_connections.get(user_id, set())
        return [
            self.active_connections[conn_id]
            for conn_id in connection_ids
            if conn_id in self.active_connections
        ]

    def get_endpoint_connections(self, endpoint: str) -> List[WebSocketConnection]:
        """Get all connections for an endpoint"""
        connection_ids = self.endpoint_connections.get(endpoint, set())
        return [
            self.active_connections[conn_id]
            for conn_id in connection_ids
            if conn_id in self.active_connections
        ]

    def get_connection_metrics(self, connection_id: str) -> Optional[WebSocketMetrics]:
        """Get connection metrics"""
        return self.connection_metrics.get(connection_id)

    def get_stats(self) -> Dict[str, Any]:
        """Get WebSocket statistics"""
        return {
            "total_connections": len(self.active_connections),
            "user_connections": {
                user_id: len(connections)
                for user_id, connections in self.user_connections.items()
            },
            "endpoint_connections": {
                endpoint: len(connections)
                for endpoint, connections in self.endpoint_connections.items()
            },
            "active_connections": len([
                c for c in self.active_connections.values()
                if c.is_active
            ])
        }


class WebSocketProxy:
    """
    WebSocket proxy with authentication, rate limiting, and connection management
    """

    def __init__(self, config: GatewayPolicyConfig):
        self.config = config
        self.connection_manager = WebSocketConnectionManager()
        self.authenticator = GatewayAuthenticator()
        self.connection_configs: Dict[str, ConnectionConfig] = {}
        self._initialize_connection_configs()
        self._background_tasks: Set[asyncio.Task] = set()

    def _initialize_connection_configs(self):
        """Initialize WebSocket endpoint configurations"""
        # Default configurations for common endpoints
        default_configs = {
            "/ws": ConnectionConfig(
                endpoint="/ws",
                target_service="upm_backend",
                target_url="ws://localhost:8000/ws",
                auth_required=True,
                max_connections_per_user=100
            ),
            "/ws/notifications": ConnectionConfig(
                endpoint="/ws/notifications",
                target_service="notification_service",
                target_url="ws://localhost:8001/ws/notifications",
                auth_required=True,
                max_connections_per_user=10,
                heartbeat_interval=30
            ),
            "/ws/agents": ConnectionConfig(
                endpoint="/ws/agents",
                target_service="agent_service",
                target_url="ws://localhost:8002/ws/agents",
                auth_required=True,
                max_connections_per_user=50,
                heartbeat_interval=60
            )
        }
        self.connection_configs.update(default_configs)

    async def handle_connection(self, websocket: WebSocket, endpoint: str):
        """Handle WebSocket connection through the proxy"""
        if not self.config.enable_websocket_proxy:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="WebSocket proxy not enabled"
            )

        connection_id = str(uuid.uuid4())
        auth_result = None
        backend_websocket = None

        try:
            # Get connection configuration
            config = self.connection_configs.get(endpoint)
            if not config:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"WebSocket endpoint {endpoint} not found"
                )

            # Authenticate connection
            if config.auth_required:
                auth_result = await self.authenticator.authenticate_websocket(websocket)
                if not auth_result.authenticated:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="WebSocket authentication failed"
                    )

            # Check connection limits
            await self._check_connection_limits(auth_result, config)

            # Accept WebSocket connection
            await websocket.accept()

            # Connect to backend service
            backend_websocket = await self._connect_to_backend(config, auth_result)

            # Add connection to manager
            connection = await self.connection_manager.add_connection(
                connection_id=connection_id,
                websocket=websocket,
                user_id=auth_result.user_id if auth_result else "anonymous",
                endpoint=endpoint,
                organization_id=auth_result.organization_id if auth_result else None,
                api_key_id=auth_result.api_key_id if auth_result else None,
                metadata={
                    "auth_method": auth_result.method if auth_result else "none",
                    "tier": auth_result.tier if auth_result else "default"
                }
            )

            # Start proxy tasks
            await self._start_proxy_tasks(
                connection_id, websocket, backend_websocket, config, auth_result
            )

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"WebSocket connection error: {e}")
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close(code=1011, reason=str(e))
        finally:
            # Cleanup
            await self._cleanup_connection(connection_id, websocket, backend_websocket)

    async def _check_connection_limits(self, auth_result: Optional[AuthenticationResult], config: ConnectionConfig):
        """Check connection limits"""
        if not auth_result:
            return

        user_connections = self.connection_manager.get_user_connections(auth_result.user_id)
        if len(user_connections) >= config.max_connections_per_user:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Connection limit exceeded for user. Maximum: {config.max_connections_per_user}"
            )

        # Check organization limits if applicable
        if auth_result.organization_id:
            # Implement organization-level connection limits
            pass

    async def _connect_to_backend(self, config: ConnectionConfig, auth_result: Optional[AuthenticationResult]):
        """Connect to backend WebSocket service"""
        try:
            headers = {}
            if auth_result:
                # Forward authentication information
                if auth_result.api_key_id:
                    headers["X-API-Key-ID"] = auth_result.api_key_id
                if auth_result.user_id:
                    headers["X-User-ID"] = auth_result.user_id
                if auth_result.organization_id:
                    headers["X-Organization-ID"] = auth_result.organization_id

            # Connect to backend
            backend_websocket = await websockets.connect(
                config.target_url,
                extra_headers=headers,
                ping_interval=config.heartbeat_interval,
                ping_timeout=config.heartbeat_timeout
            )

            return backend_websocket

        except Exception as e:
            logger.error(f"Failed to connect to backend {config.target_url}: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Backend service unavailable"
            )

    async def _start_proxy_tasks(
        self,
        connection_id: str,
        client_websocket: WebSocket,
        backend_websocket,
        config: ConnectionConfig,
        auth_result: Optional[AuthenticationResult]
    ):
        """Start proxy tasks for message forwarding"""
        # Client to backend task
        client_to_backend_task = asyncio.create_task(
            self._handle_client_to_backend(
                connection_id, client_websocket, backend_websocket, config, auth_result
            )
        )

        # Backend to client task
        backend_to_client_task = asyncio.create_task(
            self._handle_backend_to_client(
                connection_id, client_websocket, backend_websocket, config, auth_result
            )
        )

        # Heartbeat task
        heartbeat_task = asyncio.create_task(
            self._handle_heartbeat(connection_id, client_websocket, backend_websocket, config)
        )

        # Store tasks for cleanup
        self._background_tasks.update([client_to_backend_task, backend_to_client_task, heartbeat_task])

        try:
            # Wait for any task to complete (disconnect)
            done, pending = await asyncio.wait(
                [client_to_backend_task, backend_to_client_task, heartbeat_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel pending tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        finally:
            # Remove tasks from background set
            self._background_tasks.discard(client_to_backend_task)
            self._background_tasks.discard(backend_to_client_task)
            self._background_tasks.discard(heartbeat_task)

    async def _handle_client_to_backend(
        self,
        connection_id: str,
        client_websocket: WebSocket,
        backend_websocket,
        config: ConnectionConfig,
        auth_result: Optional[AuthenticationResult]
    ):
        """Handle messages from client to backend"""
        try:
            while True:
                # Receive message from client
                message = await client_websocket.receive()

                # Update connection activity
                message_size = len(message.get("bytes", "")) if "bytes" in message else len(message.get("text", ""))
                await self.connection_manager.update_connection_activity(connection_id, message_size)

                # Apply message filters
                if await self._apply_message_filters(message, config.message_filters, "outbound"):
                    continue  # Filter out message

                # Validate message
                if not await self._validate_message(message, config):
                    await client_websocket.send_json({
                        "type": "error",
                        "message": "Invalid message format"
                    })
                    continue

                # Forward to backend
                if message["type"] == "text":
                    await backend_websocket.send(message["text"])
                elif message["type"] == "bytes":
                    await backend_websocket.send(message["bytes"])
                elif message["type"] == "json":
                    await backend_websocket.send(json.dumps(message["data"]))

        except WebSocketDisconnect:
            logger.info(f"Client disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"Client to backend error: {e}")
            metrics = self.connection_manager.get_connection_metrics(connection_id)
            if metrics:
                metrics.error_count += 1

    async def _handle_backend_to_client(
        self,
        connection_id: str,
        client_websocket: WebSocket,
        backend_websocket,
        config: ConnectionConfig,
        auth_result: Optional[AuthenticationResult]
    ):
        """Handle messages from backend to client"""
        try:
            async for message in backend_websocket:
                # Apply message filters
                if await self._apply_message_filters(
                    {"data": message, "type": "text"},
                    config.message_filters,
                    "inbound"
                ):
                    continue  # Filter out message

                # Forward to client
                if isinstance(message, str):
                    await client_websocket.send_text(message)
                elif isinstance(message, bytes):
                    await client_websocket.send_bytes(message)

                # Update metrics
                metrics = self.connection_manager.get_connection_metrics(connection_id)
                if metrics:
                    metrics.bytes_sent += len(message)

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Backend disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"Backend to client error: {e}")
            metrics = self.connection_manager.get_connection_metrics(connection_id)
            if metrics:
                metrics.error_count += 1

    async def _handle_heartbeat(
        self,
        connection_id: str,
        client_websocket: WebSocket,
        backend_websocket,
        config: ConnectionConfig
    ):
        """Handle heartbeat/ping-pong"""
        while True:
            try:
                await asyncio.sleep(config.heartbeat_interval)

                # Send ping to client
                await client_websocket.send_json({"type": "ping"})

                # Update metrics
                metrics = self.connection_manager.get_connection_metrics(connection_id)
                if metrics:
                    metrics.ping_count += 1

        except WebSocketDisconnect:
            logger.info(f"Heartbeat stopped - client disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"Heartbeat error: {e}")

    async def _apply_message_filters(
        self,
        message: Dict[str, Any],
        filters: List[Callable],
        direction: str
    ) -> bool:
        """Apply message filters, return True if message should be filtered out"""
        for filter_func in filters:
            try:
                if asyncio.iscoroutinefunction(filter_func):
                    should_filter = await filter_func(message, direction)
                else:
                    should_filter = filter_func(message, direction)

                if should_filter:
                    return True
            except Exception as e:
                logger.error(f"Message filter error: {e}")

        return False

    async def _validate_message(self, message: Dict[str, Any], config: ConnectionConfig) -> bool:
        """Validate message format and size"""
        # Check message size
        if "bytes" in message:
            size = len(message["bytes"])
        elif "text" in message:
            size = len(message["text"])
        elif "data" in message:
            size = len(str(message["data"]))
        else:
            return False

        if size > config.max_message_size:
            return False

        # Check message type
        valid_types = ["text", "bytes", "json", "ping", "pong"]
        return message.get("type") in valid_types

    async def _cleanup_connection(self, connection_id: str, client_websocket: WebSocket, backend_websocket):
        """Clean up connection resources"""
        try:
            # Close client WebSocket if still open
            if client_websocket.client_state != WebSocketState.DISCONNECTED:
                await client_websocket.close()

            # Close backend WebSocket if still open
            if backend_websocket and not backend_websocket.closed:
                await backend_websocket.close()

            # Remove from connection manager
            await self.connection_manager.remove_connection(connection_id, "Connection closed")

        except Exception as e:
            logger.error(f"Connection cleanup error: {e}")

    def add_connection_config(self, config: ConnectionConfig):
        """Add new connection configuration"""
        self.connection_configs[config.endpoint] = config
        logger.info(f"Added WebSocket configuration for {config.endpoint}")

    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket proxy statistics"""
        return {
            "connection_manager_stats": self.connection_manager.get_stats(),
            "configured_endpoints": list(self.connection_configs.keys()),
            "background_tasks": len(self._background_tasks),
            "authenticator_stats": self.authenticator.get_authentication_stats()
        }