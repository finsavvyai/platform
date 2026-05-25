"""Device node connection — WebSocket client to OpenClaw gateway."""

import asyncio
import json
import logging
import time
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("finsavvyai.devices")


class Capability(str, Enum):
    """Available device capabilities (Task 16.2)."""

    CAMERA = "camera"
    SCREEN = "screen"
    LOCATION = "location"
    CANVAS = "canvas"
    NOTIFICATIONS = "notifications"
    SMS = "sms"
    VOICE = "voice"


class NodeRegistration:
    """Registration payload for advertising FinSavvyAI as an OpenClaw node."""

    def __init__(
        self,
        node_id: str = "finsavvy-node",
        node_name: str = "FinSavvyAI Cluster Node",
        capabilities: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.node_id = node_id
        self.node_name = node_name
        self.capabilities = capabilities or [c.value for c in Capability]
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "name": self.node_name,
            "type": "ai_cluster",
            "capabilities": self.capabilities,
            "metadata": self.metadata,
            "registered_at": time.time(),
        }


class DeviceNodeClient:
    """
    WebSocket client for OpenClaw gateway node connection (Task 16.1).

    Manages connection lifecycle, capability advertisement,
    and message routing to capability handlers.
    """

    def __init__(
        self,
        gateway_url: str = "ws://localhost:11434/ws/node",
        api_key: Optional[str] = None,
        registration: Optional[NodeRegistration] = None,
        reconnect_interval: int = 10,
    ):
        self.gateway_url = gateway_url
        self.api_key = api_key
        self.registration = registration or NodeRegistration()
        self.reconnect_interval = reconnect_interval
        self._ws = None
        self._connected = False
        self._handlers: Dict[str, Callable] = {}
        self._message_queue: List[Dict] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    def register_handler(self, capability: str, handler: Callable) -> None:
        """Register a handler for a capability (Task 16.2)."""
        self._handlers[capability] = handler
        logger.info("Handler registered for capability: %s", capability)

    async def connect(self) -> bool:
        """Connect to the OpenClaw gateway via WebSocket (Task 16.1)."""
        try:
            import aiohttp

            session = aiohttp.ClientSession()
            headers: Dict[str, str] = {}
            if self.api_key:
                headers["X-API-Key"] = self.api_key

            self._ws = await session.ws_connect(
                self.gateway_url, headers=headers
            )
            self._connected = True

            await self._ws.send_json({
                "type": "register",
                "payload": self.registration.to_dict(),
            })

            logger.info(
                "Connected to OpenClaw gateway as node %s",
                self.registration.node_id,
            )
            return True
        except Exception as e:
            logger.error("Failed to connect to gateway: %s", e)
            self._connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from the gateway."""
        self._connected = False
        self._running = False
        if self._ws and not self._ws.closed:
            await self._ws.close()
        logger.info("Disconnected from OpenClaw gateway")

    async def send_message(
        self, msg_type: str, payload: Dict[str, Any]
    ) -> bool:
        """Send a message to the gateway."""
        if not self._ws or self._ws.closed:
            self._message_queue.append({"type": msg_type, "payload": payload})
            return False
        try:
            await self._ws.send_json({"type": msg_type, "payload": payload})
            return True
        except Exception as e:
            logger.error("Send error: %s", e)
            return False

    async def _handle_message(self, message: Dict[str, Any]) -> None:
        """Route incoming messages to capability handlers."""
        msg_type = message.get("type", "")
        capability = message.get("capability", msg_type)
        payload = message.get("payload", {})

        handler = self._handlers.get(capability)
        if handler:
            try:
                result = handler(payload)
                if asyncio.iscoroutine(result):
                    result = await result
                await self.send_message(
                    "capability_response",
                    {
                        "capability": capability,
                        "request_id": message.get("request_id"),
                        "result": result,
                    },
                )
            except Exception as e:
                logger.error("Handler error for %s: %s", capability, e)
                await self.send_message(
                    "capability_error",
                    {
                        "capability": capability,
                        "request_id": message.get("request_id"),
                        "error": str(e),
                    },
                )
        else:
            logger.warning("No handler for capability: %s", capability)

    async def listen(self) -> None:
        """Listen for incoming messages (blocking)."""
        if not self._ws:
            return
        try:
            async for msg in self._ws:
                if msg.type in (1,):  # TEXT
                    try:
                        data = json.loads(msg.data)
                        await self._handle_message(data)
                    except json.JSONDecodeError:
                        pass
                elif msg.type in (8, 256):  # CLOSE, ERROR
                    break
        except Exception as e:
            logger.error("WebSocket listen error: %s", e)
        finally:
            self._connected = False

    def get_queued_messages(self) -> List[Dict]:
        return list(self._message_queue)

    def clear_queue(self) -> None:
        self._message_queue.clear()
