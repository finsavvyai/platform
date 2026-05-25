"""WebSocket endpoint for real-time dashboard updates."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


class ConnectionManager:
    """Manage WebSocket connections for real-time updates."""

    def __init__(self) -> None:
        # Map of organization_id -> set of active websockets
        self.organization_connections: dict[str, set[WebSocket]] = {}
        # Map of project_id -> set of active websockets
        self.project_connections: dict[str, set[WebSocket]] = {}
        # Map of websocket -> user info
        self.websocket_info: dict[WebSocket, dict[str, Any]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        organization_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> None:
        """Connect a websocket to the manager."""
        await websocket.accept()

        self.websocket_info[websocket] = {
            "connected_at": datetime.now().isoformat(),
            "organization_id": organization_id,
            "project_id": project_id,
        }

        if organization_id:
            if organization_id not in self.organization_connections:
                self.organization_connections[organization_id] = set()
            self.organization_connections[organization_id].add(websocket)

        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = set()
            self.project_connections[project_id].add(websocket)

        logger.info(
            f"WebSocket connected. Org: {organization_id}, Project: {project_id}, "
            f"Total connections: {len(self.websocket_info)}"
        )

    def disconnect(self, websocket: WebSocket) -> None:
        """Disconnect a websocket from the manager."""
        info = self.websocket_info.get(websocket, {})
        organization_id = info.get("organization_id")
        project_id = info.get("project_id")

        if organization_id and organization_id in self.organization_connections:
            self.organization_connections[organization_id].discard(websocket)
            if not self.organization_connections[organization_id]:
                del self.organization_connections[organization_id]

        if project_id and project_id in self.project_connections:
            self.project_connections[project_id].discard(websocket)
            if not self.project_connections[project_id]:
                del self.project_connections[project_id]

        self.websocket_info.pop(websocket, None)

        logger.info(
            f"WebSocket disconnected. Org: {organization_id}, Project: {project_id}, "
            f"Total connections: {len(self.websocket_info)}"
        )

    async def broadcast_to_organization(
        self,
        organization_id: str,
        message: dict[str, Any],
    ) -> None:
        """Broadcast a message to all connections in an organization."""
        if organization_id not in self.organization_connections:
            return

        disconnected = []
        for websocket in self.organization_connections[organization_id]:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(websocket)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_to_project(
        self,
        project_id: str,
        message: dict[str, Any],
    ) -> None:
        """Broadcast a message to all connections watching a project."""
        if project_id not in self.project_connections:
            return

        disconnected = []
        for websocket in self.project_connections[project_id]:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(websocket)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast_to_all(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected websockets."""
        disconnected = []
        for websocket in self.websocket_info:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send to websocket: {e}")
                disconnected.append(websocket)

        # Clean up disconnected websockets
        for ws in disconnected:
            self.disconnect(ws)

    def get_connection_count(self) -> int:
        """Get total number of active connections."""
        return len(self.websocket_info)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/dashboard")
async def dashboard_websocket(
    websocket: WebSocket,
    token: str,
    organization_id: Optional[str] = None,
    project_id: Optional[str] = None,
) -> None:
    """WebSocket endpoint for real-time dashboard updates.

    Query parameters:
    - token: JWT authentication token
    - organization_id: Filter updates by organization (optional)
    - project_id: Filter updates by project (optional)

    Message types sent:
    - vulnerability_detected: New vulnerability found
    - vulnerability_fixed: Vulnerability remediated
    - scan_complete: Dependency scan finished
    - compliance_change: Compliance score changed
    - dependency_added: New dependency added
    - dependency_updated: Dependency version updated
    - policy_violation: Policy violation detected

    Example client message to subscribe to specific events:
    {
        "action": "subscribe",
        "events": ["vulnerability_detected", "scan_complete"]
    }
    """
    await manager.connect(websocket, organization_id, project_id)

    # Send welcome message
    await websocket.send_text(
        json.dumps(
            {
                "type": "connected",
                "timestamp": datetime.now().isoformat(),
                "organization_id": organization_id,
                "project_id": project_id,
            }
        )
    )

    subscribed_events: set[str] = set()  # Empty means all events

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            action = message.get("action")

            if action == "subscribe":
                # Subscribe to specific event types
                events = message.get("events", [])
                subscribed_events.update(events)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "subscribed",
                            "events": list(subscribed_events),
                        }
                    )
                )

            elif action == "unsubscribe":
                # Unsubscribe from specific event types
                events = message.get("events", [])
                subscribed_events.difference_update(events)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "unsubscribed",
                            "events": list(subscribed_events),
                        }
                    )
                )

            elif action == "ping":
                # Respond to ping with pong
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "pong",
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                )

            elif action == "refresh":
                # Request full data refresh (client will fetch via REST API)
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "refresh_required",
                            "timestamp": datetime.now().isoformat(),
                        }
                    )
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@router.get("/ws/stats")
async def websocket_stats(
    # No auth required for basic stats
) -> dict[str, Any]:
    """Get WebSocket connection statistics."""
    return {
        "total_connections": manager.get_connection_count(),
        "organizations": len(manager.organization_connections),
        "projects": len(manager.project_connections),
    }


# Helper functions for broadcasting events


async def broadcast_vulnerability_detected(
    vulnerability: dict[str, Any],
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a new vulnerability is detected."""
    message = {
        "type": "vulnerability_detected",
        "timestamp": datetime.now().isoformat(),
        "data": vulnerability,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)
    await manager.broadcast_to_organization(organization_id, message)


async def broadcast_vulnerability_fixed(
    vulnerability_id: str,
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a vulnerability is fixed."""
    message = {
        "type": "vulnerability_fixed",
        "timestamp": datetime.now().isoformat(),
        "vulnerability_id": vulnerability_id,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)
    await manager.broadcast_to_organization(organization_id, message)


async def broadcast_scan_complete(
    scan_result: dict[str, Any],
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a dependency scan is complete."""
    message = {
        "type": "scan_complete",
        "timestamp": datetime.now().isoformat(),
        "data": scan_result,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)


async def broadcast_compliance_change(
    old_score: float,
    new_score: float,
    organization_id: str,
    project_id: Optional[str] = None,
) -> None:
    """Broadcast when compliance score changes."""
    message = {
        "type": "compliance_change",
        "timestamp": datetime.now().isoformat(),
        "old_score": old_score,
        "new_score": new_score,
        "change": new_score - old_score,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    if project_id:
        await manager.broadcast_to_project(project_id, message)
    await manager.broadcast_to_organization(organization_id, message)


async def broadcast_policy_violation(
    violation: dict[str, Any],
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a policy violation is detected."""
    message = {
        "type": "policy_violation",
        "timestamp": datetime.now().isoformat(),
        "data": violation,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)
    await manager.broadcast_to_organization(organization_id, message)


async def broadcast_dependency_added(
    dependency: dict[str, Any],
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a new dependency is added."""
    message = {
        "type": "dependency_added",
        "timestamp": datetime.now().isoformat(),
        "data": dependency,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)


async def broadcast_dependency_updated(
    dependency: dict[str, Any],
    organization_id: str,
    project_id: str,
) -> None:
    """Broadcast when a dependency is updated."""
    message = {
        "type": "dependency_updated",
        "timestamp": datetime.now().isoformat(),
        "data": dependency,
        "organization_id": organization_id,
        "project_id": project_id,
    }

    await manager.broadcast_to_project(project_id, message)
