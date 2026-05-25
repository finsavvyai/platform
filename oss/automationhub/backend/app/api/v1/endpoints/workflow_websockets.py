"""
WebSocket API endpoints for real-time workflow monitoring.

Provides WebSocket connections for live workflow execution monitoring,
system events, and real-time status updates.
"""

import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.responses import HTMLResponse

from app.core.auth import get_current_user_websocket
from app.schemas.auth import User
from app.websockets.workflow_monitoring import get_workflow_monitoring_service
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/workflows/{execution_id}")
async def workflow_execution_websocket(
    websocket: WebSocket,
    execution_id: str,
    user: User = Depends(get_current_user_websocket)
):
    """WebSocket endpoint for monitoring specific workflow execution."""
    monitoring_service = await get_workflow_monitoring_service()

    try:
        # Handle the WebSocket connection
        await monitoring_service.handle_websocket_connection(
            websocket=websocket,
            user_id=str(user.id),
            execution_id=execution_id,
            subscribe_system=False
        )

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for execution {execution_id}")
    except Exception as e:
        logger.error(f"WebSocket error for execution {execution_id}: {e}")
        await websocket.close(code=1000, reason="Internal server error")


@router.websocket("/ws/workflows")
async def workflows_websocket(
    websocket: WebSocket,
    user: User = Depends(get_current_user_websocket),
    system_events: bool = Query(False, description="Subscribe to system-wide events")
):
    """WebSocket endpoint for general workflow monitoring."""
    monitoring_service = await get_workflow_monitoring_service()

    try:
        # Handle the WebSocket connection
        await monitoring_service.handle_websocket_connection(
            websocket=websocket,
            user_id=str(user.id),
            execution_id=None,
            subscribe_system=system_events
        )

    except WebSocketDisconnect:
        logger.info(f"General workflows WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"General workflows WebSocket error for user {user.id}: {e}")
        await websocket.close(code=1000, reason="Internal server error")


@router.websocket("/ws/system")
async def system_websocket(
    websocket: WebSocket,
    user: User = Depends(get_current_user_websocket)
):
    """WebSocket endpoint for system-wide workflow events."""
    monitoring_service = await get_workflow_monitoring_service()

    try:
        # Handle the WebSocket connection with system events subscription
        await monitoring_service.handle_websocket_connection(
            websocket=websocket,
            user_id=str(user.id),
            execution_id=None,
            subscribe_system=True
        )

    except WebSocketDisconnect:
        logger.info(f"System WebSocket disconnected for user {user.id}")
    except Exception as e:
        logger.error(f"System WebSocket error for user {user.id}: {e}")
        await websocket.close(code=1000, reason="Internal server error")


@router.get("/ws/stats")
async def get_websocket_stats(user: User = Depends(get_current_user)):
    """Get WebSocket connection statistics."""
    try:
        monitoring_service = await get_workflow_monitoring_service()
        stats = monitoring_service.get_monitoring_stats()

        return {
            "websocket_stats": stats,
            "timestamp": "2024-01-01T00:00:00Z"  # Would use actual timestamp
        }

    except Exception as e:
        logger.error(f"Failed to get WebSocket stats: {e}")
        return {
            "error": "Failed to retrieve statistics",
            "websocket_stats": None
        }


@router.get("/ws/test", response_class=HTMLResponse)
async def websocket_test_page():
    """Simple HTML page for testing WebSocket connections."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Workflow WebSocket Test</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            .container {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .log {
                background-color: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 10px;
                height: 300px;
                overflow-y: auto;
                font-family: monospace;
                font-size: 12px;
            }
            .controls {
                margin: 10px 0;
            }
            button {
                margin: 5px;
                padding: 10px 15px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            .connect { background-color: #4CAF50; color: white; }
            .disconnect { background-color: #f44336; color: white; }
            .subscribe { background-color: #2196F3; color: white; }
            .ping { background-color: #FF9800; color: white; }
            input[type="text"] {
                padding: 8px;
                margin: 5px;
                border: 1px solid #ddd;
                border-radius: 4px;
                width: 200px;
            }
            .status {
                font-weight: bold;
                margin: 10px 0;
            }
            .connected { color: #4CAF50; }
            .disconnected { color: #f44336; }
        </style>
    </head>
    <body>
        <h1>Workflow WebSocket Test Client</h1>

        <div class="container">
            <h2>Connection Settings</h2>
            <div class="controls">
                <input type="text" id="websocketUrl" placeholder="WebSocket URL" value="ws://localhost:8000/api/v1/ws/workflows">
                <input type="text" id="executionId" placeholder="Execution ID (optional)">
                <br>
                <button class="connect" onclick="connectWebSocket()">Connect</button>
                <button class="disconnect" onclick="disconnectWebSocket()">Disconnect</button>
                <label>
                    <input type="checkbox" id="subscribeSystem"> Subscribe to system events
                </label>
            </div>
            <div id="status" class="status disconnected">Status: Disconnected</div>
        </div>

        <div class="container">
            <h2>Actions</h2>
            <div class="controls">
                <button class="subscribe" onclick="subscribeToExecution()">Subscribe to Execution</button>
                <button class="ping" onclick="sendPing()">Ping Server</button>
                <button onclick="clearLog()">Clear Log</button>
            </div>
        </div>

        <div class="container">
            <h2>Message Log</h2>
            <div id="log" class="log"></div>
        </div>

        <script>
            let websocket = null;
            let reconnectAttempts = 0;
            const maxReconnectAttempts = 5;

            function log(message) {
                const logElement = document.getElementById('log');
                const timestamp = new Date().toISOString();
                logElement.innerHTML += `[${timestamp}] ${message}\\n`;
                logElement.scrollTop = logElement.scrollHeight;
            }

            function updateStatus(status, connected) {
                const statusElement = document.getElementById('status');
                statusElement.textContent = `Status: ${status}`;
                statusElement.className = `status ${connected ? 'connected' : 'disconnected'}`;
            }

            function connectWebSocket() {
                const url = document.getElementById('websocketUrl').value;
                const executionId = document.getElementById('executionId').value;
                const subscribeSystem = document.getElementById('subscribeSystem').checked;

                if (!url) {
                    log('Error: WebSocket URL is required');
                    return;
                }

                // Build WebSocket URL
                let wsUrl = url;
                if (executionId) {
                    wsUrl = url.replace('/ws/workflows', `/ws/workflows/${executionId}`);
                }
                if (subscribeSystem) {
                    wsUrl = url.replace('/ws/workflows', '/ws/system');
                }

                log(`Connecting to: ${wsUrl}`);

                try {
                    websocket = new WebSocket(wsUrl);

                    websocket.onopen = function(event) {
                        log('WebSocket connection opened');
                        updateStatus('Connected', true);
                        reconnectAttempts = 0;
                    };

                    websocket.onmessage = function(event) {
                        try {
                            const message = JSON.parse(event.data);
                            log(`Received: ${JSON.stringify(message, null, 2)}`);
                        } catch (e) {
                            log(`Received (raw): ${event.data}`);
                        }
                    };

                    websocket.onerror = function(error) {
                        log(`WebSocket error: ${error}`);
                        updateStatus('Error', false);
                    };

                    websocket.onclose = function(event) {
                        log(`WebSocket closed: ${event.code} - ${event.reason}`);
                        updateStatus('Disconnected', false);

                        // Attempt to reconnect
                        if (reconnectAttempts < maxReconnectAttempts) {
                            reconnectAttempts++;
                            log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})...`);
                            setTimeout(connectWebSocket, 2000);
                        }
                    };

                } catch (error) {
                    log(`Error creating WebSocket: ${error}`);
                }
            }

            function disconnectWebSocket() {
                if (websocket) {
                    websocket.close();
                    websocket = null;
                    log('WebSocket disconnected manually');
                    updateStatus('Disconnected', false);
                }
            }

            function subscribeToExecution() {
                const executionId = document.getElementById('executionId').value;
                if (!executionId) {
                    log('Error: Execution ID is required');
                    return;
                }

                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    const message = {
                        type: 'subscribe_execution',
                        execution_id: executionId
                    };
                    websocket.send(JSON.stringify(message));
                    log(`Subscribed to execution: ${executionId}`);
                } else {
                    log('Error: WebSocket is not connected');
                }
            }

            function sendPing() {
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                    const message = {
                        type: 'ping',
                        timestamp: new Date().toISOString()
                    };
                    websocket.send(JSON.stringify(message));
                    log('Sent ping message');
                } else {
                    log('Error: WebSocket is not connected');
                }
            }

            function clearLog() {
                document.getElementById('log').innerHTML = '';
            }

            // Auto-connect on page load
            window.onload = function() {
                log('WebSocket test client loaded');

                // Try to connect with default settings after 1 second
                setTimeout(function() {
                    // Uncomment to auto-connect
                    // connectWebSocket();
                }, 1000);
            };
        </script>
    </body>
    </html>
    """


@router.post("/ws/broadcast/test")
async def test_broadcast(user: User = Depends(get_current_user)):
    """Test endpoint to broadcast a test WebSocket message."""
    try:
        monitoring_service = await get_workflow_monitoring_service()

        test_message = {
            "type": "test_broadcast",
            "message": "This is a test broadcast message",
            "timestamp": "2024-01-01T00:00:00Z",
            "user_id": str(user.id)
        }

        # Broadcast to system subscribers
        await monitoring_service.emit_system_event("test_event", test_message)

        return {
            "success": True,
            "message": "Test broadcast sent successfully",
            "test_message": test_message
        }

    except Exception as e:
        logger.error(f"Failed to send test broadcast: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/ws/health")
async def websocket_health_check(user: User = Depends(get_current_user)):
    """Health check for WebSocket monitoring service."""
    try:
        monitoring_service = await get_workflow_monitoring_service()
        stats = monitoring_service.get_monitoring_stats()

        # Test Redis connection
        try:
            await redis_client.ping()
            redis_status = "healthy"
        except Exception:
            redis_status = "unhealthy"

        return {
            "status": "healthy",
            "websocket_service": {
                "running": monitoring_service.event_broadcaster.running,
                "connection_stats": stats
            },
            "redis_status": redis_status,
            "timestamp": "2024-01-01T00:00:00Z"
        }

    except Exception as e:
        logger.error(f"WebSocket health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": "2024-01-01T00:00:00Z"
        }