"""
WebSocket endpoints for real-time collaboration
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.responses import HTMLResponse

from app.websockets.collaboration import (
    handle_collaboration_websocket,
    get_websocket_manager,
    notify_session_created,
    notify_session_updated,
    notify_session_ended,
    notify_task_delegated,
    notify_consensus_initiated,
    notify_consensus_reached
)
from app.services.collaboration import get_collaboration_service
from app.core.auth import get_current_user_websocket


router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/collaboration")
async def collaboration_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None, description="Collaboration session ID"),
    agent_id: Optional[str] = Query(None, description="Agent ID for agent connections"),
    collaboration_service=Depends(get_collaboration_service)
):
    """
    WebSocket endpoint for real-time collaboration.

    Connect to this endpoint to receive real-time updates about:
    - Session state changes
    - Agent messages
    - Task status updates
    - Consensus voting
    - Presence information

    Query Parameters:
    - session_id: Optional collaboration session ID to join
    - agent_id: Optional agent ID for agent-specific connections
    """
    try:
        # Parse optional parameters
        session_uuid = UUID(session_id) if session_id else None
        agent_uuid = UUID(agent_id) if agent_id else None

        # Authenticate user (for user connections, not agent connections)
        current_user = None
        if not agent_uuid:  # Only authenticate user connections, not agent connections
            try:
                current_user = await get_current_user_websocket(websocket)
            except Exception as e:
                await websocket.close(code=4001, reason="Authentication failed")
                return

        # Handle the WebSocket connection
        await handle_collaboration_websocket(
            websocket=websocket,
            session_id=session_uuid,
            agent_id=agent_uuid,
            current_user=current_user,
            collaboration_service=collaboration_service
        )

    except ValueError as e:
        await websocket.close(code=4002, reason=f"Invalid parameter format: {str(e)}")
    except WebSocketDisconnect:
        pass  # Normal disconnection
    except Exception as e:
        await websocket.close(code=4000, reason=f"WebSocket error: {str(e)}")


@router.websocket("/session/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str,
    agent_id: Optional[str] = Query(None, description="Agent ID for agent connections")
):
    """
    WebSocket endpoint for a specific collaboration session.

    This is a convenience endpoint that automatically joins the specified session.
    """
    try:
        session_uuid = UUID(session_id)
        agent_uuid = UUID(agent_id) if agent_id else None

        # Authenticate user if not an agent connection
        current_user = None
        if not agent_uuid:
            try:
                current_user = await get_current_user_websocket(websocket)
            except Exception:
                await websocket.close(code=4001, reason="Authentication failed")
                return

        collaboration_service = get_collaboration_service()
        await handle_collaboration_websocket(
            websocket=websocket,
            session_id=session_uuid,
            agent_id=agent_uuid,
            current_user=current_user,
            collaboration_service=collaboration_service
        )

    except ValueError:
        await websocket.close(code=4002, reason="Invalid session ID format")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=4000, reason=f"WebSocket error: {str(e)}")


@router.websocket("/agent/{agent_id}")
async def agent_websocket(
    websocket: WebSocket,
    agent_id: str,
    session_id: Optional[str] = Query(None, description="Optional session to join")
):
    """
    WebSocket endpoint for agent connections.

    This endpoint is specifically for agent-to-system communication.
    Agents can connect here to receive tasks and send updates.
    """
    try:
        agent_uuid = UUID(agent_id)
        session_uuid = UUID(session_id) if session_id else None

        collaboration_service = get_collaboration_service()
        await handle_collaboration_websocket(
            websocket=websocket,
            session_id=session_uuid,
            agent_id=agent_uuid,
            current_user=None,  # Agents don't use user authentication
            collaboration_service=collaboration_service
        )

    except ValueError:
        await websocket.close(code=4002, reason="Invalid agent ID format")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.close(code=4000, reason=f"WebSocket error: {str(e)}")


@router.get("/stats")
async def get_websocket_stats():
    """
    Get WebSocket connection statistics.

    Returns information about active connections, sessions, and agents.
    """
    try:
        manager = get_websocket_manager()
        stats = manager.get_connection_stats()

        return {
            "success": True,
            "data": stats
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/session/{session_id}/participants")
async def get_session_participants(session_id: str):
    """
    Get list of participants in a collaboration session.

    Returns information about currently connected participants.
    """
    try:
        session_uuid = UUID(session_id)
        manager = get_websocket_manager()
        participants = manager.get_session_participants(session_uuid)

        return {
            "success": True,
            "data": {
                "session_id": session_id,
                "participants": participants,
                "count": len(participants)
            }
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/agent/{agent_id}/status")
async def get_agent_connection_status(agent_id: str):
    """
    Get connection status of a specific agent.

    Returns information about whether the agent is currently connected.
    """
    try:
        agent_uuid = UUID(agent_id)
        manager = get_websocket_manager()
        status = manager.get_agent_status(agent_uuid)

        if status:
            return {
                "success": True,
                "data": status
            }
        else:
            return {
                "success": True,
                "data": {
                    "agent_id": agent_id,
                    "connected": False,
                    "message": "Agent is not currently connected"
                }
            }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid agent ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/created")
async def notify_session_created_websocket(session_id: str, session_info: dict):
    """
    Notify all connected clients about a newly created session.

    This is typically called by the collaboration API when a session is created.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_session_created(session_uuid, session_info)

        return {
            "success": True,
            "message": "Session creation notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/updated")
async def notify_session_updated_websocket(session_id: str, update_data: dict):
    """
    Notify session participants about session updates.

    This is typically called by the collaboration API when a session is updated.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_session_updated(session_uuid, update_data)

        return {
            "success": True,
            "message": "Session update notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/ended")
async def notify_session_ended_websocket(
    session_id: str,
    reason: str,
    final_result: dict = None
):
    """
    Notify session participants that the session has ended.

    This is typically called by the collaboration API when a session ends.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_session_ended(session_uuid, reason, final_result)

        return {
            "success": True,
            "message": "Session end notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/task-delegated")
async def notify_task_delegated_websocket(session_id: str, task_info: dict):
    """
    Notify session participants about task delegation.

    This is typically called by the collaboration API when a task is delegated.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_task_delegated(session_uuid, task_info)

        return {
            "success": True,
            "message": "Task delegation notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/consensus-initiated")
async def notify_consensus_initiated_websocket(session_id: str, proposal_info: dict):
    """
    Notify session participants about consensus initiation.

    This is typically called by the collaboration API when consensus is initiated.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_consensus_initiated(session_uuid, proposal_info)

        return {
            "success": True,
            "message": "Consensus initiation notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.post("/notify/session/{session_id}/consensus-reached")
async def notify_consensus_reached_websocket(session_id: str, consensus_result: dict):
    """
    Notify session participants about consensus result.

    This is typically called by the collaboration API when consensus is reached.
    """
    try:
        session_uuid = UUID(session_id)
        await notify_consensus_reached(session_uuid, consensus_result)

        return {
            "success": True,
            "message": "Consensus result notification sent"
        }

    except ValueError:
        return {
            "success": False,
            "error": "Invalid session ID format"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/test", response_class=HTMLResponse)
async def websocket_test_page():
    """
    Simple test page for WebSocket functionality.

    This provides a basic HTML page for testing WebSocket connections.
    """
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Collaboration WebSocket Test</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .messages { border: 1px solid #ccc; height: 300px; overflow-y: auto; padding: 10px; margin: 10px 0; }
            .input-group { margin: 10px 0; }
            input, select, button { margin: 5px; padding: 5px; }
            .message { margin: 5px 0; padding: 5px; border-radius: 3px; }
            .message.system { background-color: #e3f2fd; }
            .message.user { background-color: #f3e5f5; }
            .message.agent { background-color: #e8f5e8; }
            .error { color: red; }
            .success { color: green; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Collaboration WebSocket Test</h1>

            <div class="input-group">
                <label>WebSocket URL:</label>
                <input type="text" id="wsUrl" value="ws://localhost:8000/api/v1/ws/collaboration" size="50">
                <button onclick="connect()">Connect</button>
                <button onclick="disconnect()">Disconnect</button>
            </div>

            <div class="input-group">
                <label>Session ID (optional):</label>
                <input type="text" id="sessionId" placeholder="Leave empty for general connection">
                <label>Agent ID (optional):</label>
                <input type="text" id="agentId" placeholder="Leave empty for user connection">
            </div>

            <div class="input-group">
                <label>Message Type:</label>
                <select id="messageType">
                    <option value="session_message">Session Message</option>
                    <option value="agent_message">Agent Message</option>
                    <option value="task_update">Task Update</option>
                    <option value="consensus_vote">Consensus Vote</option>
                    <option value="presence_update">Presence Update</option>
                    <option value="ping">Ping</option>
                </select>
            </div>

            <div class="input-group">
                <label>Content:</label>
                <input type="text" id="messageContent" placeholder="Enter message content" size="50">
                <button onclick="sendMessage()">Send Message</button>
            </div>

            <div class="input-group">
                <label>Connection Status:</label>
                <span id="status">Disconnected</span>
            </div>

            <div class="messages" id="messages"></div>

            <button onclick="clearMessages()">Clear Messages</button>
        </div>

        <script>
            let ws = null;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;

            function addMessage(message, type = 'system') {
                const messagesDiv = document.getElementById('messages');
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${type}`;
                messageDiv.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> - ${message}`;
                messagesDiv.appendChild(messageDiv);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }

            function updateStatus(status, isError = false) {
                const statusElement = document.getElementById('status');
                statusElement.textContent = status;
                statusElement.className = isError ? 'error' : 'success';
            }

            function buildWebSocketUrl() {
                let baseUrl = document.getElementById('wsUrl').value;
                const sessionId = document.getElementById('sessionId').value;
                const agentId = document.getElementById('agentId').value;

                const params = new URLSearchParams();
                if (sessionId) params.append('session_id', sessionId);
                if (agentId) params.append('agent_id', agentId);

                const paramString = params.toString();
                return paramString ? `${baseUrl}?${paramString}` : baseUrl;
            }

            function connect() {
                if (ws) {
                    ws.close();
                }

                const url = buildWebSocketUrl();
                addMessage(`Connecting to: ${url}`);
                updateStatus('Connecting...');

                try {
                    ws = new WebSocket(url);

                    ws.onopen = function(event) {
                        updateStatus('Connected');
                        addMessage('WebSocket connection established', 'success');
                        reconnectAttempts = 0;
                    };

                    ws.onmessage = function(event) {
                        try {
                            const data = JSON.parse(event.data);
                            addMessage(`Received: ${JSON.stringify(data, null, 2)}`, 'user');
                        } catch (e) {
                            addMessage(`Received (raw): ${event.data}`, 'user');
                        }
                    };

                    ws.onclose = function(event) {
                        updateStatus('Disconnected', true);
                        addMessage(`WebSocket closed: ${event.code} - ${event.reason || 'Unknown reason'}`);

                        if (reconnectAttempts < maxReconnectAttempts) {
                            reconnectAttempts++;
                            addMessage(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                            setTimeout(connect, 2000);
                        }
                    };

                    ws.onerror = function(error) {
                        updateStatus('Error', true);
                        addMessage(`WebSocket error: ${error}`, 'error');
                    };

                } catch (e) {
                    updateStatus('Error', true);
                    addMessage(`Failed to connect: ${e.message}`, 'error');
                }
            }

            function disconnect() {
                if (ws) {
                    ws.close();
                    ws = null;
                }
                updateStatus('Disconnected');
                addMessage('Manually disconnected');
            }

            function sendMessage() {
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    addMessage('Cannot send message - not connected', 'error');
                    return;
                }

                const messageType = document.getElementById('messageType').value;
                const content = document.getElementById('messageContent').value;

                if (!content && messageType !== 'ping') {
                    addMessage('Please enter message content', 'error');
                    return;
                }

                let message = {
                    type: messageType,
                    timestamp: new Date().toISOString()
                };

                switch (messageType) {
                    case 'session_message':
                        message.content = content;
                        message.subject = 'Test Session Message';
                        break;
                    case 'agent_message':
                        message.content = content;
                        message.recipient_id = '00000000-0000-0000-0000-000000000000'; // Example recipient
                        break;
                    case 'task_update':
                        message.task_id = 'test-task-id';
                        message.status = content;
                        break;
                    case 'consensus_vote':
                        message.proposal_id = 'test-proposal';
                        message.vote_value = content;
                        break;
                    case 'presence_update':
                        message.presence_type = 'typing';
                        message.data = { status: content };
                        break;
                    case 'ping':
                        // Ping message needs no additional content
                        break;
                }

                try {
                    ws.send(JSON.stringify(message));
                    addMessage(`Sent: ${JSON.stringify(message, null, 2)}`, 'agent');

                    // Clear content for non-ping messages
                    if (messageType !== 'ping') {
                        document.getElementById('messageContent').value = '';
                    }
                } catch (e) {
                    addMessage(`Failed to send message: ${e.message}`, 'error');
                }
            }

            function clearMessages() {
                document.getElementById('messages').innerHTML = '';
            }

            // Auto-connect on page load (optional)
            // window.onload = function() {
            //     connect();
            // };

            // Handle Enter key in content input
            document.getElementById('messageContent').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    """