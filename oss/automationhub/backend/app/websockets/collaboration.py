"""
WebSocket handlers for real-time collaboration features
"""

import json
import logging
from typing import Dict, List, Optional, Set
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user_websocket
from app.services.collaboration import get_collaboration_service
from app.models.collaboration import CollaborationSession, CollaborationMessage, MessageType


logger = logging.getLogger(__name__)


class CollaborationWebSocketManager:
    """
    WebSocket manager for real-time collaboration
    """

    def __init__(self):
        # Active connections by session ID
        self.session_connections: Dict[UUID, Dict[str, WebSocket]] = {}
        # Agent connections by agent ID
        self.agent_connections: Dict[UUID, WebSocket] = {}
        # User connections for authentication
        self.user_connections: Dict[WebSocket, dict] = {}
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, dict] = {}

    async def connect(
        self,
        websocket: WebSocket,
        session_id: Optional[UUID] = None,
        agent_id: Optional[UUID] = None,
        user_info: Optional[dict] = None
    ):
        """Connect a client to the collaboration WebSocket"""
        await websocket.accept()

        # Store connection
        if session_id:
            if session_id not in self.session_connections:
                self.session_connections[session_id] = {}
            self.session_connections[session_id][str(websocket.client.id)] = websocket

        if agent_id:
            self.agent_connections[agent_id] = websocket

        if user_info:
            self.user_connections[websocket] = user_info

        # Store metadata
        self.connection_metadata[websocket] = {
            "session_id": session_id,
            "agent_id": agent_id,
            "user_info": user_info,
            "connected_at": datetime.utcnow(),
            "client_id": str(websocket.client.id)
        }

        logger.info(f"WebSocket connected: {websocket.client} (session: {session_id}, agent: {agent_id})")

        # Send welcome message
        await self.send_personal_message({
            "type": "connection_established",
            "timestamp": datetime.utcnow().isoformat(),
            "session_id": str(session_id) if session_id else None,
            "agent_id": str(agent_id) if agent_id else None,
            "message": "Connected to collaboration WebSocket"
        }, websocket)

    def disconnect(self, websocket: WebSocket):
        """Disconnect a client from the collaboration WebSocket"""
        metadata = self.connection_metadata.get(websocket, {})
        session_id = metadata.get("session_id")
        agent_id = metadata.get("agent_id")
        client_id = metadata.get("client_id")

        # Remove from session connections
        if session_id and session_id in self.session_connections:
            if client_id in self.session_connections[session_id]:
                del self.session_connections[session_id][client_id]
            # Clean up empty session
            if not self.session_connections[session_id]:
                del self.session_connections[session_id]

        # Remove from agent connections
        if agent_id and agent_id in self.agent_connections:
            del self.agent_connections[agent_id]

        # Remove from user connections
        if websocket in self.user_connections:
            del self.user_connections[websocket]

        # Remove metadata
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]

        logger.info(f"WebSocket disconnected: {websocket.client} (session: {session_id}, agent: {agent_id})")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            self.disconnect(websocket)

    async def broadcast_to_session(self, session_id: UUID, message: dict, exclude_websocket: Optional[WebSocket] = None):
        """Broadcast a message to all clients in a session"""
        if session_id not in self.session_connections:
            logger.warning(f"No active connections for session {session_id}")
            return

        message["timestamp"] = datetime.utcnow().isoformat()
        message_str = json.dumps(message)

        # Send to all connected clients in session
        disconnected_clients = []
        for client_id, websocket in self.session_connections[session_id].items():
            if websocket != exclude_websocket:
                try:
                    await websocket.send_text(message_str)
                except Exception as e:
                    logger.error(f"Failed to send to client {client_id}: {e}")
                    disconnected_clients.append(websocket)

        # Clean up disconnected clients
        for websocket in disconnected_clients:
            self.disconnect(websocket)

    async def send_to_agent(self, agent_id: UUID, message: dict):
        """Send a message to a specific agent"""
        if agent_id not in self.agent_connections:
            logger.warning(f"Agent {agent_id} not connected")
            return False

        message["timestamp"] = datetime.utcnow().isoformat()
        message_str = json.dumps(message)

        try:
            await self.agent_connections[agent_id].send_text(message_str)
            return True
        except Exception as e:
            logger.error(f"Failed to send to agent {agent_id}: {e}")
            self.disconnect(self.agent_connections[agent_id])
            return False

    async def broadcast_system_message(self, message: dict):
        """Broadcast a system message to all connected clients"""
        message["timestamp"] = datetime.utcnow().isoformat()
        message_str = json.dumps(message)

        disconnected_clients = []
        for websocket in list(self.connection_metadata.keys()):
            try:
                await websocket.send_text(message_str)
            except Exception as e:
                logger.error(f"Failed to send system message: {e}")
                disconnected_clients.append(websocket)

        # Clean up disconnected clients
        for websocket in disconnected_clients:
            self.disconnect(websocket)

    def get_session_participants(self, session_id: UUID) -> List[dict]:
        """Get list of participants in a session"""
        participants = []
        if session_id in self.session_connections:
            for client_id, websocket in self.session_connections[session_id].items():
                metadata = self.connection_metadata.get(websocket, {})
                participants.append({
                    "client_id": client_id,
                    "agent_id": str(metadata.get("agent_id")) if metadata.get("agent_id") else None,
                    "user_info": metadata.get("user_info"),
                    "connected_at": metadata.get("connected_at").isoformat() if metadata.get("connected_at") else None
                })
        return participants

    def get_agent_status(self, agent_id: UUID) -> Optional[dict]:
        """Get connection status of an agent"""
        if agent_id not in self.agent_connections:
            return None

        websocket = self.agent_connections[agent_id]
        metadata = self.connection_metadata.get(websocket, {})
        return {
            "agent_id": str(agent_id),
            "connected": True,
            "connected_at": metadata.get("connected_at").isoformat() if metadata.get("connected_at") else None,
            "session_id": str(metadata.get("session_id")) if metadata.get("session_id") else None,
            "client_id": metadata.get("client_id")
        }

    def get_connection_stats(self) -> dict:
        """Get WebSocket connection statistics"""
        return {
            "total_connections": len(self.connection_metadata),
            "session_connections": len(self.session_connections),
            "agent_connections": len(self.agent_connections),
            "user_connections": len(self.user_connections),
            "active_sessions": list(self.session_connections.keys()),
            "connected_agents": list(self.agent_connections.keys())
        }


# Global WebSocket manager
websocket_manager = CollaborationWebSocketManager()


async def handle_collaboration_websocket(
    websocket: WebSocket,
    session_id: Optional[UUID] = None,
    agent_id: Optional[UUID] = None,
    current_user: Optional[dict] = None,
    collaboration_service=Depends(get_collaboration_service)
):
    """
    Handle WebSocket connection for collaboration features
    """
    try:
        # Connect the client
        await websocket_manager.connect(
            websocket=websocket,
            session_id=session_id,
            agent_id=agent_id,
            user_info=current_user
        )

        # Send initial session state if connected to a session
        if session_id:
            await send_session_state(websocket, session_id)

        # Handle messages
        while True:
            data = await websocket.receive_text()
            await handle_websocket_message(websocket, data, collaboration_service)

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected normally: {websocket.client}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        websocket_manager.disconnect(websocket)


async def send_session_state(websocket: WebSocket, session_id: UUID):
    """Send current session state to a newly connected client"""
    try:
        collaboration_service = get_collaboration_service()
        session_status = await collaboration_service.get_session_status(session_id)

        if session_status:
            participants = websocket_manager.get_session_participants(session_id)

            await websocket_manager.send_personal_message({
                "type": "session_state",
                "session_id": str(session_id),
                "status": session_status,
                "participants": participants,
                "timestamp": datetime.utcnow().isoformat()
            }, websocket)

    except Exception as e:
        logger.error(f"Failed to send session state: {e}")


async def handle_websocket_message(websocket: WebSocket, data: str, collaboration_service):
    """Handle incoming WebSocket messages"""
    try:
        message = json.loads(data)
        message_type = message.get("type")

        if message_type == "ping":
            await handle_ping_message(websocket)
        elif message_type == "session_message":
            await handle_session_message(websocket, message, collaboration_service)
        elif message_type == "agent_message":
            await handle_agent_message(websocket, message, collaboration_service)
        elif message_type == "task_update":
            await handle_task_update(websocket, message, collaboration_service)
        elif message_type == "consensus_vote":
            await handle_consensus_vote(websocket, message, collaboration_service)
        elif message_type == "presence_update":
            await handle_presence_update(websocket, message)
        else:
            logger.warning(f"Unknown message type: {message_type}")

    except json.JSONDecodeError:
        logger.error("Invalid JSON in WebSocket message")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": "Invalid JSON format"
        }, websocket)
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Error processing message: {str(e)}"
        }, websocket)


async def handle_ping_message(websocket: WebSocket):
    """Handle ping messages for connection health check"""
    await websocket_manager.send_personal_message({
        "type": "pong",
        "timestamp": datetime.utcnow().isoformat()
    }, websocket)


async def handle_session_message(websocket: WebSocket, message: dict, collaboration_service):
    """Handle session-level messages"""
    try:
        metadata = websocket_manager.connection_metadata.get(websocket, {})
        session_id = metadata.get("session_id")
        agent_id = metadata.get("agent_id")

        if not session_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Not connected to a session"
            }, websocket)
            return

        # Validate message format
        required_fields = ["content"]
        for field in required_fields:
            if field not in message:
                await websocket_manager.send_personal_message({
                    "type": "error",
                    "message": f"Missing required field: {field}"
                }, websocket)
                return

        # Create message in database
        from app.services.collaboration import MessageEnvelope, MessageType, MessagePriority

        envelope = MessageEnvelope(
            message_id=uuid4(),
            sender_id=agent_id or UUID("00000000-0000-0000-0000-000000000000"),  # System sender if no agent
            recipient_id=None,  # Broadcast to session
            message_type=MessageType.STATUS_UPDATE,
            priority=MessagePriority.NORMAL,
            subject=message.get("subject", "Session Message"),
            content=message["content"],
            payload=message.get("payload"),
            thread_id=session_id
        )

        # Store message
        success = await collaboration_service._routing_service.send_message(envelope, session_id)

        if success:
            # Broadcast to all session participants
            await websocket_manager.broadcast_to_session(session_id, {
                "type": "session_message",
                "message_id": str(envelope.message_id),
                "sender_id": str(envelope.sender_id),
                "content": envelope.content,
                "subject": envelope.subject,
                "payload": envelope.payload,
                "timestamp": envelope.sent_at.isoformat()
            }, exclude_websocket=websocket)

    except Exception as e:
        logger.error(f"Error handling session message: {e}")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Failed to process session message: {str(e)}"
        }, websocket)


async def handle_agent_message(websocket: WebSocket, message: dict, collaboration_service):
    """Handle direct agent-to-agent messages"""
    try:
        metadata = websocket_manager.connection_metadata.get(websocket, {})
        sender_id = metadata.get("agent_id")

        if not sender_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Agent ID required for agent messages"
            }, websocket)
            return

        recipient_id = message.get("recipient_id")
        if not recipient_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Recipient agent ID required"
            }, websocket)
            return

        # Validate recipient UUID
        try:
            recipient_uuid = UUID(recipient_id)
        except ValueError:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Invalid recipient agent ID format"
            }, websocket)
            return

        # Send message to recipient
        success = await websocket_manager.send_to_agent(recipient_uuid, {
            "type": "agent_message",
            "message_id": str(uuid4()),
            "sender_id": str(sender_id),
            "recipient_id": recipient_id,
            "content": message.get("content", ""),
            "subject": message.get("subject", "Agent Message"),
            "payload": message.get("payload"),
            "timestamp": datetime.utcnow().isoformat()
        })

        if not success:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": f"Agent {recipient_id} is not connected"
            }, websocket)

    except Exception as e:
        logger.error(f"Error handling agent message: {e}")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Failed to process agent message: {str(e)}"
        }, websocket)


async def handle_task_update(websocket: WebSocket, message: dict, collaboration_service):
    """Handle task status updates"""
    try:
        metadata = websocket_manager.connection_metadata.get(websocket, {})
        session_id = metadata.get("session_id")
        agent_id = metadata.get("agent_id")

        if not session_id or not agent_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Session and agent ID required for task updates"
            }, websocket)
            return

        task_id = message.get("task_id")
        if not task_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Task ID required"
            }, websocket)
            return

        task_status = message.get("status")
        if not task_status:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Task status required"
            }, websocket)
            return

        # Broadcast task update to session
        await websocket_manager.broadcast_to_session(session_id, {
            "type": "task_update",
            "task_id": task_id,
            "agent_id": str(agent_id),
            "status": task_status,
            "progress": message.get("progress"),
            "result": message.get("result"),
            "error": message.get("error"),
            "timestamp": datetime.utcnow().isoformat()
        })

        # If task is completed, notify collaboration service
        if task_status in ["completed", "failed"]:
            result = message.get("result", {})
            success = task_status == "completed"

            await collaboration_service._delegation_service.complete_task(
                task_id=UUID(task_id),
                agent_id=agent_id,
                result=result,
                success=success,
                execution_time_ms=message.get("execution_time_ms")
            )

    except Exception as e:
        logger.error(f"Error handling task update: {e}")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Failed to process task update: {str(e)}"
        }, websocket)


async def handle_consensus_vote(websocket: WebSocket, message: dict, collaboration_service):
    """Handle consensus voting"""
    try:
        metadata = websocket_manager.connection_metadata.get(websocket, {})
        session_id = metadata.get("session_id")
        agent_id = metadata.get("agent_id")

        if not session_id or not agent_id:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Session and agent ID required for consensus voting"
            }, websocket)
            return

        proposal_id = message.get("proposal_id")
        vote_value = message.get("vote_value")
        if not proposal_id or not vote_value:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Proposal ID and vote value required"
            }, websocket)
            return

        # Submit vote
        success = await collaboration_service._consensus_service.submit_vote(
            proposal_id=proposal_id,
            agent_id=agent_id,
            vote_value=vote_value,
            confidence_score=message.get("confidence_score"),
            reasoning=message.get("reasoning")
        )

        if success:
            # Broadcast vote to session
            await websocket_manager.broadcast_to_session(session_id, {
                "type": "consensus_vote",
                "proposal_id": proposal_id,
                "agent_id": str(agent_id),
                "vote_value": vote_value,
                "confidence_score": message.get("confidence_score"),
                "reasoning": message.get("reasoning"),
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            await websocket_manager.send_personal_message({
                "type": "error",
                "message": "Failed to submit consensus vote"
            }, websocket)

    except Exception as e:
        logger.error(f"Error handling consensus vote: {e}")
        await websocket_manager.send_personal_message({
            "type": "error",
            "message": f"Failed to process consensus vote: {str(e)}"
        }, websocket)


async def handle_presence_update(websocket: WebSocket, message: dict):
    """Handle presence updates (typing, status changes, etc.)"""
    try:
        metadata = websocket_manager.connection_metadata.get(websocket, {})
        session_id = metadata.get("session_id")
        agent_id = metadata.get("agent_id")

        if not session_id:
            return

        presence_type = message.get("presence_type", "status")

        # Broadcast presence update to session
        await websocket_manager.broadcast_to_session(session_id, {
            "type": "presence_update",
            "agent_id": str(agent_id) if agent_id else None,
            "presence_type": presence_type,
            "presence_data": message.get("data", {}),
            "timestamp": datetime.utcnow().isoformat()
        }, exclude_websocket=websocket)

    except Exception as e:
        logger.error(f"Error handling presence update: {e}")


# Utility functions for WebSocket management
async def notify_session_created(session_id: UUID, session_info: dict):
    """Notify clients when a new session is created"""
    await websocket_manager.broadcast_system_message({
        "type": "session_created",
        "session_id": str(session_id),
        "session_info": session_info,
        "timestamp": datetime.utcnow().isoformat()
    })


async def notify_session_updated(session_id: UUID, update_data: dict):
    """Notify clients when a session is updated"""
    await websocket_manager.broadcast_to_session(session_id, {
        "type": "session_updated",
        "session_id": str(session_id),
        "update_data": update_data,
        "timestamp": datetime.utcnow().isoformat()
    })


async def notify_session_ended(session_id: UUID, reason: str, final_result: dict = None):
    """Notify clients when a session ends"""
    await websocket_manager.broadcast_to_session(session_id, {
        "type": "session_ended",
        "session_id": str(session_id),
        "reason": reason,
        "final_result": final_result,
        "timestamp": datetime.utcnow().isoformat()
    })


async def notify_task_delegated(session_id: UUID, task_info: dict):
    """Notify clients when a task is delegated"""
    await websocket_manager.broadcast_to_session(session_id, {
        "type": "task_delegated",
        "session_id": str(session_id),
        "task_info": task_info,
        "timestamp": datetime.utcnow().isoformat()
    })


async def notify_consensus_initiated(session_id: UUID, proposal_info: dict):
    """Notify clients when consensus is initiated"""
    await websocket_manager.broadcast_to_session(session_id, {
        "type": "consensus_initiated",
        "session_id": str(session_id),
        "proposal_info": proposal_info,
        "timestamp": datetime.utcnow().isoformat()
    })


async def notify_consensus_reached(session_id: UUID, consensus_result: dict):
    """Notify clients when consensus is reached"""
    await websocket_manager.broadcast_to_session(session_id, {
        "type": "consensus_reached",
        "session_id": str(session_id),
        "consensus_result": consensus_result,
        "timestamp": datetime.utcnow().isoformat()
    })


def get_websocket_manager() -> CollaborationWebSocketManager:
    """Get the global WebSocket manager instance"""
    return websocket_manager