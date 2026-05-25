"""
WebSocket Server for Real-Time Communication

Provides WebSocket connections for real-time updates to IDE plugins
and other clients. Supports:
- Analysis progress streaming
- Vulnerability alerts
- Dependency updates
- Project status changes
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from udp.monitoring.workflow_logger import get_workflow_logger
from udp.security.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ws", tags=["websocket"])


# Connection management
class ConnectionManager:
    """Manages active WebSocket connections."""

    def __init__(self):
        # active_connections: Dict[connection_id, WebSocket]
        self.active_connections: dict[str, WebSocket] = {}

        # user_connections: Dict[user_id, Set[connection_id]]
        self.user_connections: dict[str, set[str]] = {}

        # project_connections: Dict[project_id, Set[connection_id]]
        self.project_connections: dict[str, set[str]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        connection_id: str,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> None:
        """Register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[connection_id] = websocket

        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(connection_id)

        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = set()
            self.project_connections[project_id].add(connection_id)

        logger.info(
            f"WebSocket connected: {connection_id} (user: {user_id}, project: {project_id})"
        )

        workflow_logger = get_workflow_logger()
        await workflow_logger.log_event(
            "websocket_connected",
            {
                "connection_id": connection_id,
                "user_id": user_id,
                "project_id": project_id,
            },
        )

    async def disconnect(self, connection_id: str) -> None:
        """Unregister a WebSocket connection."""
        if connection_id not in self.active_connections:
            return

        # Remove from user connections
        for user_id, conn_ids in self.user_connections.items():
            if connection_id in conn_ids:
                conn_ids.remove(connection_id)

        # Remove from project connections
        for project_id, conn_ids in self.project_connections.items():
            if connection_id in conn_ids:
                conn_ids.remove(connection_id)

        # Remove from active connections
        del self.active_connections[connection_id]

        logger.info(f"WebSocket disconnected: {connection_id}")

        workflow_logger = get_workflow_logger()
        await workflow_logger.log_event(
            "websocket_disconnected", {"connection_id": connection_id}
        )

    async def send_message(self, connection_id: str, message: dict[str, Any]) -> bool:
        """Send a message to a specific connection."""
        if connection_id not in self.active_connections:
            return False

        websocket = self.active_connections[connection_id]

        try:
            await websocket.send_json(message)
            return True
        except Exception as e:
            logger.warning(f"Failed to send message to {connection_id}: {e}")
            await self.disconnect(connection_id)
            return False

    async def broadcast_to_user(
        self, user_id: str, message: dict[str, Any], exclude: Optional[str] = None
    ) -> int:
        """Broadcast a message to all connections for a user."""
        if user_id not in self.user_connections:
            return 0

        count = 0
        connection_ids = list(self.user_connections[user_id])

        for conn_id in connection_ids:
            if exclude and conn_id == exclude:
                continue

            success = await self.send_message(conn_id, message)
            if success:
                count += 1

        return count

    async def broadcast_to_project(
        self, project_id: str, message: dict[str, Any], exclude: Optional[str] = None
    ) -> int:
        """Broadcast a message to all connections for a project."""
        if project_id not in self.project_connections:
            return 0

        count = 0
        connection_ids = list(self.project_connections[project_id])

        for conn_id in connection_ids:
            if exclude and conn_id == exclude:
                continue

            success = await self.send_message(conn_id, message)
            if success:
                count += 1

        return count

    async def broadcast_to_all(
        self, message: dict[str, Any], exclude: Optional[str] = None
    ) -> int:
        """Broadcast a message to all active connections."""
        count = 0

        for conn_id in list(self.active_connections.keys()):
            if exclude and conn_id == exclude:
                continue

            success = await self.send_message(conn_id, message)
            if success:
                count += 1

        return count

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.active_connections)

    def get_user_connections(self, user_id: str) -> int:
        """Get number of connections for a user."""
        return len(self.user_connections.get(user_id, set()))

    def get_project_connections(self, project_id: str) -> int:
        """Get number of connections for a project."""
        return len(self.project_connections.get(project_id, set()))


# Singleton instance
manager = ConnectionManager()


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    client_type: Optional[str] = Query("ide"),  # ide, cli, web
):
    """
    Main WebSocket endpoint for real-time updates.

    Query Parameters:
    - token: Authentication token (required for authenticated connections)
    - project_id: Project to receive updates for
    - client_type: Type of client (ide, cli, web)

    Message Types (Client -> Server):
    - authenticate: Authenticate with token
    - subscribe: Subscribe to project updates
    - unsubscribe: Unsubscribe from project
    - ping: Keep-alive ping

    Message Types (Server -> Client):
    - analysis_progress: Analysis progress updates
    - vulnerability_found: New vulnerability discovered
    - dependency_updated: Dependency updated
    - policy_violation: Policy violation detected
    - build_blocked: Build blocked due to violations
    - pong: Keep-alive response
    """
    connection_id = str(uuid.uuid4())
    user_id = None

    try:
        # Authenticate if token provided
        if token:
            # Verify token and get user_id
            # For now, skip actual verification
            user_id = f"user_{token[:8]}"  # Placeholder

        # Connect
        await manager.connect(
            websocket, connection_id, user_id=user_id, project_id=project_id
        )

        # Send welcome message
        await websocket.send_json(
            {
                "type": "connected",
                "connection_id": connection_id,
                "server_time": datetime.utcnow().isoformat(),
                "client_type": client_type,
            }
        )

        # Message loop
        while True:
            try:
                # Receive message from client
                data = await websocket.receive_text()
                message = json.loads(data)

                await handle_message(connection_id, message, user_id, project_id)

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            except Exception as e:
                logger.error(f"Error in websocket loop: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})

    except Exception as e:
        logger.error(f"WebSocket error: {e}")

    finally:
        await manager.disconnect(connection_id)


async def handle_message(
    connection_id: str,
    message: dict[str, Any],
    user_id: Optional[str],
    project_id: Optional[str],
) -> None:
    """Handle incoming message from client."""
    msg_type = message.get("type")

    if msg_type == "ping":
        await manager.send_message(
            connection_id, {"type": "pong", "timestamp": datetime.utcnow().isoformat()}
        )

    elif msg_type == "subscribe":
        # Subscribe to a project
        new_project_id = message.get("project_id")
        if new_project_id:
            if new_project_id not in manager.project_connections:
                manager.project_connections[new_project_id] = set()
            manager.project_connections[new_project_id].add(connection_id)

            await manager.send_message(
                connection_id, {"type": "subscribed", "project_id": new_project_id}
            )

    elif msg_type == "unsubscribe":
        # Unsubscribe from a project
        target_project = message.get("project_id")
        if target_project and target_project in manager.project_connections:
            manager.project_connections[target_project].discard(connection_id)

            await manager.send_message(
                connection_id, {"type": "unsubscribed", "project_id": target_project}
            )

    elif msg_type == "authenticate":
        # Authenticate with token
        token = message.get("token")
        if token:
            # Verify token and get user_id
            # For now, just store it
            user_id = f"user_{token[:8]}"

            if user_id not in manager.user_connections:
                manager.user_connections[user_id] = set()
            manager.user_connections[user_id].add(connection_id)

            await manager.send_message(
                connection_id, {"type": "authenticated", "user_id": user_id}
            )

    else:
        await manager.send_message(
            connection_id,
            {"type": "error", "message": f"Unknown message type: {msg_type}"},
        )


@router.websocket("/analysis/{analysis_id}")
async def analysis_websocket(
    websocket: WebSocket, analysis_id: str, token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for streaming analysis progress.

    Clients connect to this endpoint to receive real-time updates
    during long-running analysis operations.
    """
    connection_id = str(uuid.uuid4())
    user_id = None

    try:
        await manager.connect(websocket, connection_id, user_id, analysis_id)

        # Send initial status
        await websocket.send_json(
            {
                "type": "analysis_started",
                "analysis_id": analysis_id,
                "connection_id": connection_id,
            }
        )

        # Message loop
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle analysis-specific messages
                if message.get("type") == "cancel":
                    # Cancel the analysis
                    await websocket.send_json(
                        {"type": "analysis_cancelled", "analysis_id": analysis_id}
                    )
                    break

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})

    except Exception as e:
        logger.error(f"Analysis websocket error: {e}")

    finally:
        await manager.disconnect(connection_id)


# Helper functions for sending updates


async def send_analysis_progress(
    analysis_id: str,
    progress: float,
    message: str,
    stage: Optional[str] = None,
    data: Optional[dict[str, Any]] = None,
) -> None:
    """Send analysis progress update to all subscribers."""
    await manager.broadcast_to_project(
        analysis_id,
        {
            "type": "analysis_progress",
            "analysis_id": analysis_id,
            "progress": progress,
            "message": message,
            "stage": stage,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def send_vulnerability_alert(
    project_id: str, vulnerability: dict[str, Any]
) -> None:
    """Send vulnerability alert to all project subscribers."""
    await manager.broadcast_to_project(
        project_id,
        {
            "type": "vulnerability_found",
            "project_id": project_id,
            "vulnerability": vulnerability,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def send_dependency_update(
    project_id: str, dependency: dict[str, Any], update_type: str = "updated"
) -> None:
    """Send dependency update notification."""
    await manager.broadcast_to_project(
        project_id,
        {
            "type": "dependency_updated",
            "project_id": project_id,
            "dependency": dependency,
            "update_type": update_type,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def send_policy_violation(project_id: str, violation: dict[str, Any]) -> None:
    """Send policy violation alert."""
    await manager.broadcast_to_project(
        project_id,
        {
            "type": "policy_violation",
            "project_id": project_id,
            "violation": violation,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def send_build_blocked(
    project_id: str, reason: str, violations: list[dict[str, Any]]
) -> None:
    """Send build blocked notification."""
    await manager.broadcast_to_project(
        project_id,
        {
            "type": "build_blocked",
            "project_id": project_id,
            "reason": reason,
            "violations": violations,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


async def send_security_alert(user_id: str, alert: dict[str, Any]) -> None:
    """Send security alert to specific user."""
    await manager.broadcast_to_user(
        user_id,
        {
            "type": "security_alert",
            "alert": alert,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


@router.get("/connections")
async def get_connections(current_user=Depends(get_current_user)):
    """Get information about active WebSocket connections."""
    return {
        "total_connections": manager.get_connection_count(),
        "user_connections": manager.user_connections,
        "project_connections": {
            proj_id: len(conns)
            for proj_id, conns in manager.project_connections.items()
        },
    }


@router.post("/broadcast")
async def broadcast_message(
    message: dict[str, Any],
    target_type: str = "all",  # all, user, project
    target_id: Optional[str] = None,
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Broadcast a message to connected clients."""
    count = 0

    if target_type == "all":
        count = await manager.broadcast_to_all(message)
    elif target_type == "user" and target_id:
        count = await manager.broadcast_to_user(target_id, message)
    elif target_type == "project" and target_id:
        count = await manager.broadcast_to_project(target_id, message)

    return {
        "sent": True,
        "recipients": count,
        "target_type": target_type,
        "target_id": target_id,
    }


@router.post("/notify/vulnerability")
async def notify_vulnerability(
    project_id: str,
    vulnerability: dict[str, Any],
    current_user=Depends(get_current_user),
) -> dict[str, Any]:
    """Send vulnerability notification to project subscribers."""
    await send_vulnerability_alert(project_id, vulnerability)

    return {
        "sent": True,
        "project_id": project_id,
        "vulnerability_id": vulnerability.get("id"),
    }
