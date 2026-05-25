"""
WebSocket handlers for real-time workflow execution monitoring.

Provides live updates on workflow execution status, node progress,
resource usage, and system events through WebSocket connections.
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Set, Any
from uuid import UUID

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.workflow import WorkflowExecution, NodeExecution, ExecutionStatus, NodeStatus
from app.services.workflow_executor import get_workflow_executor
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for workflow monitoring."""

    def __init__(self):
        # Active connections by user and execution
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        # Subscriptions by execution ID
        self.execution_subscriptions: Dict[str, Set[str]] = {}
        # System-wide subscribers
        self.system_subscribers: Set[str] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        connection_id: str
    ):
        """Accept WebSocket connection and register user."""
        await websocket.accept()

        # Store connection
        if user_id not in self.active_connections:
            self.active_connections[user_id] = {}
        self.active_connections[user_id][connection_id] = websocket

        logger.info(f"WebSocket connected: user={user_id}, connection={connection_id}")

        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat()
        }, user_id, connection_id)

    def disconnect(self, user_id: str, connection_id: str):
        """Remove WebSocket connection and clean up subscriptions."""
        # Remove connection
        if user_id in self.active_connections:
            self.active_connections[user_id].pop(connection_id, None)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Remove from all subscriptions
        for execution_id, subscribers in self.execution_subscriptions.items():
            subscribers.discard(connection_id)

        self.system_subscribers.discard(connection_id)

        logger.info(f"WebSocket disconnected: user={user_id}, connection={connection_id}")

    async def send_personal_message(
        self,
        message: dict,
        user_id: str,
        connection_id: Optional[str] = None
    ):
        """Send message to specific user connection."""
        if user_id not in self.active_connections:
            return

        connections = self.active_connections[user_id]

        if connection_id:
            # Send to specific connection
            if connection_id in connections:
                try:
                    await connections[connection_id].send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send message to {connection_id}: {e}")
                    # Clean up broken connection
                    self.disconnect(user_id, connection_id)
        else:
            # Send to all connections for user
            broken_connections = []
            for conn_id, websocket in connections.items():
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send message to {conn_id}: {e}")
                    broken_connections.append(conn_id)

            # Clean up broken connections
            for conn_id in broken_connections:
                self.disconnect(user_id, conn_id)

    async def subscribe_to_execution(
        self,
        execution_id: str,
        user_id: str,
        connection_id: str
    ):
        """Subscribe to updates for specific execution."""
        if execution_id not in self.execution_subscriptions:
            self.execution_subscriptions[execution_id] = set()

        self.execution_subscriptions[execution_id].add(connection_id)

        # Send confirmation
        await self.send_personal_message({
            "type": "subscription_confirmed",
            "execution_id": execution_id,
            "timestamp": datetime.utcnow().isoformat()
        }, user_id, connection_id)

        logger.info(f"User {user_id} subscribed to execution {execution_id}")

    async def unsubscribe_from_execution(
        self,
        execution_id: str,
        connection_id: str
    ):
        """Unsubscribe from execution updates."""
        if execution_id in self.execution_subscriptions:
            self.execution_subscriptions[execution_id].discard(connection_id)
            if not self.execution_subscriptions[execution_id]:
                del self.execution_subscriptions[execution_id]

        logger.info(f"Connection {connection_id} unsubscribed from execution {execution_id}")

    async def subscribe_to_system_events(self, user_id: str, connection_id: str):
        """Subscribe to system-wide workflow events."""
        self.system_subscribers.add(connection_id)

        await self.send_personal_message({
            "type": "system_subscription_confirmed",
            "timestamp": datetime.utcnow().isoformat()
        }, user_id, connection_id)

        logger.info(f"User {user_id} subscribed to system events")

    async def broadcast_to_execution(
        self,
        execution_id: str,
        message: dict
    ):
        """Broadcast message to all subscribers of execution."""
        if execution_id not in self.execution_subscriptions:
            return

        # Find user connections for subscribers
        broken_connections = []
        for connection_id in self.execution_subscriptions[execution_id]:
            user_id = self._find_user_by_connection(connection_id)
            if user_id:
                try:
                    await self.send_personal_message(message, user_id, connection_id)
                except Exception as e:
                    logger.error(f"Failed to broadcast to {connection_id}: {e}")
                    broken_connections.append(connection_id)

        # Clean up broken connections
        for conn_id in broken_connections:
            self.execution_subscriptions[execution_id].discard(conn_id)

    async def broadcast_to_system(self, message: dict):
        """Broadcast message to all system subscribers."""
        broken_connections = []
        for connection_id in self.system_subscribers:
            user_id = self._find_user_by_connection(connection_id)
            if user_id:
                try:
                    await self.send_personal_message(message, user_id, connection_id)
                except Exception as e:
                    logger.error(f"Failed to broadcast system message to {connection_id}: {e}")
                    broken_connections.append(connection_id)

        # Clean up broken connections
        for conn_id in broken_connections:
            self.system_subscribers.discard(conn_id)

    def _find_user_by_connection(self, connection_id: str) -> Optional[str]:
        """Find user ID by connection ID."""
        for user_id, connections in self.active_connections.items():
            if connection_id in connections:
                return user_id
        return None

    def get_connection_stats(self) -> dict:
        """Get connection statistics."""
        total_connections = sum(len(conns) for conns in self.active_connections.values())
        total_executions = len(self.execution_subscriptions)
        total_system = len(self.system_subscribers)

        return {
            "total_connections": total_connections,
            "connected_users": len(self.active_connections),
            "execution_subscriptions": total_executions,
            "system_subscribers": total_system
        }


# Global connection manager
connection_manager = ConnectionManager()


class WorkflowEventBroadcaster:
    """Broadcasts workflow events to WebSocket subscribers."""

    def __init__(self):
        self.running = False
        self.broadcast_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the event broadcaster."""
        if self.running:
            return

        self.running = True
        self.broadcast_task = asyncio.create_task(self._broadcast_loop())

    async def stop(self):
        """Stop the event broadcaster."""
        self.running = False
        if self.broadcast_task:
            self.broadcast_task.cancel()
            try:
                await self.broadcast_task
            except asyncio.CancelledError:
                pass

    async def _broadcast_loop(self):
        """Main broadcast loop for processing events."""
        while self.running:
            try:
                # Process Redis queue for workflow events
                events = await redis_client.lpop("workflow_events", count=10)

                for event_data in events:
                    try:
                        event = json.loads(event_data)
                        await self._process_event(event)
                    except Exception as e:
                        logger.error(f"Failed to process event: {e}")

                await asyncio.sleep(0.1)  # Small delay to prevent busy loop

            except Exception as e:
                logger.error(f"Broadcast loop error: {e}")
                await asyncio.sleep(1)  # Delay on error

    async def _process_event(self, event: dict):
        """Process individual workflow event."""
        event_type = event.get("type")
        execution_id = event.get("execution_id")

        if execution_id and event_type in [
            "execution_started",
            "execution_completed",
            "execution_failed",
            "execution_cancelled",
            "node_started",
            "node_completed",
            "node_failed",
            "execution_progress",
            "resource_alert"
        ]:
            # Broadcast to execution subscribers
            await connection_manager.broadcast_to_execution(
                execution_id,
                {
                    **event,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )

        # Also broadcast system events
        if event_type in [
            "workflow_created",
            "workflow_updated",
            "workflow_deleted",
            "system_alert",
            "resource_limit_exceeded"
        ]:
            await connection_manager.broadcast_to_system({
                **event,
                "timestamp": datetime.utcnow().isoformat()
            })

    async def emit_event(self, event: dict):
        """Emit a workflow event."""
        try:
            # Add timestamp
            event["timestamp"] = datetime.utcnow().isoformat()

            # Add to Redis queue for broadcasting
            await redis_client.rpush("workflow_events", json.dumps(event))
        except Exception as e:
            logger.error(f"Failed to emit event: {e}")


# Global event broadcaster
event_broadcaster = WorkflowEventBroadcaster()


class WorkflowMonitoringService:
    """Service for real-time workflow monitoring and WebSocket management."""

    def __init__(self):
        self.connection_manager = connection_manager
        self.event_broadcaster = event_broadcaster

    async def start(self):
        """Start the monitoring service."""
        await self.event_broadcaster.start()
        logger.info("Workflow monitoring service started")

    async def stop(self):
        """Stop the monitoring service."""
        await self.event_broadcaster.stop()
        logger.info("Workflow monitoring service stopped")

    async def handle_websocket_connection(
        self,
        websocket: WebSocket,
        user_id: str,
        execution_id: Optional[str] = None,
        subscribe_system: bool = False
    ):
        """Handle new WebSocket connection."""
        connection_id = f"conn_{str(uuid4())[:8]}"

        # Connect WebSocket
        await self.connection_manager.connect(websocket, user_id, connection_id)

        try:
            # Subscribe to execution if specified
            if execution_id:
                await self.connection_manager.subscribe_to_execution(
                    execution_id, user_id, connection_id
                )

            # Subscribe to system events if requested
            if subscribe_system:
                await self.connection_manager.subscribe_to_system_events(
                    user_id, connection_id
                )

            # Handle messages from client
            while True:
                try:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    await self._handle_client_message(
                        message, user_id, connection_id
                    )
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"Error handling WebSocket message: {e}")
                    break

        finally:
            # Clean up connection
            self.connection_manager.disconnect(user_id, connection_id)

    async def _handle_client_message(
        self,
        message: dict,
        user_id: str,
        connection_id: str
    ):
        """Handle incoming message from WebSocket client."""
        message_type = message.get("type")

        if message_type == "subscribe_execution":
            execution_id = message.get("execution_id")
            if execution_id:
                await self.connection_manager.subscribe_to_execution(
                    execution_id, user_id, connection_id
                )

        elif message_type == "unsubscribe_execution":
            execution_id = message.get("execution_id")
            if execution_id:
                await self.connection_manager.unsubscribe_from_execution(
                    execution_id, connection_id
                )

        elif message_type == "subscribe_system":
            await self.connection_manager.subscribe_to_system_events(
                user_id, connection_id
            )

        elif message_type == "unsubscribe_system":
            self.connection_manager.system_subscribers.discard(connection_id)

        elif message_type == "get_execution_status":
            execution_id = message.get("execution_id")
            if execution_id:
                await self._send_execution_status(execution_id, user_id, connection_id)

        elif message_type == "ping":
            await self.connection_manager.send_personal_message({
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            }, user_id, connection_id)

    async def _send_execution_status(
        self,
        execution_id: str,
        user_id: str,
        connection_id: str
    ):
        """Send current execution status to client."""
        try:
            from app.core.database import get_db_session
            async with get_db_session() as db:
                # Get execution
                result = await db.execute(
                    select(WorkflowExecution).where(
                        WorkflowExecution.id == UUID(execution_id)
                    )
                )
                execution = result.scalar_one_or_none()

                if execution:
                    await self.connection_manager.send_personal_message({
                        "type": "execution_status",
                        "execution_id": execution_id,
                        "status": execution.status.value,
                        "progress_percentage": execution.progress_percentage,
                        "current_nodes": execution.current_nodes,
                        "completed_nodes": execution.completed_nodes,
                        "failed_nodes": execution.failed_nodes,
                        "started_at": execution.started_at.isoformat() if execution.started_at else None,
                        "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                        "error_message": execution.error_message
                    }, user_id, connection_id)
                else:
                    await self.connection_manager.send_personal_message({
                        "type": "error",
                        "message": "Execution not found",
                        "execution_id": execution_id
                    }, user_id, connection_id)

        except Exception as e:
            logger.error(f"Failed to send execution status: {e}")
            await self.connection_manager.send_personal_message({
                "type": "error",
                "message": "Failed to retrieve execution status"
            }, user_id, connection_id)

    async def emit_execution_event(
        self,
        execution_id: str,
        event_type: str,
        data: dict
    ):
        """Emit execution-related event."""
        event = {
            "type": event_type,
            "execution_id": execution_id,
            "data": data
        }
        await self.event_broadcaster.emit_event(event)

    async def emit_system_event(
        self,
        event_type: str,
        data: dict
    ):
        """Emit system-wide event."""
        event = {
            "type": event_type,
            "data": data
        }
        await self.event_broadcaster.emit_event(event)

    def get_monitoring_stats(self) -> dict:
        """Get current monitoring statistics."""
        return {
            **self.connection_manager.get_connection_stats(),
            "broadcaster_running": self.event_broadcaster.running
        }


# Global monitoring service instance
monitoring_service: Optional[WorkflowMonitoringService] = None


async def get_workflow_monitoring_service() -> WorkflowMonitoringService:
    """Get or create the global workflow monitoring service."""
    global monitoring_service

    if monitoring_service is None:
        monitoring_service = WorkflowMonitoringService()
        await monitoring_service.start()

    return monitoring_service


async def shutdown_workflow_monitoring():
    """Shutdown the workflow monitoring service."""
    global monitoring_service

    if monitoring_service:
        await monitoring_service.stop()
        monitoring_service = None