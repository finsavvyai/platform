"""Channel sandbox -- simulation mode for development and testing."""

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.channels.sandbox")


class SandboxChannel:
    """Simulated channel for testing without real credentials.

    Accepts test messages, generates mock responses, and records
    all interactions for assertion in tests.
    """

    def __init__(self, channel_type: str = "sandbox", channel_id: str = ""):
        self.channel_type = channel_type
        self.channel_id = channel_id or f"sandbox-{uuid.uuid4().hex[:8]}"
        self.inbound_messages: List[Dict[str, Any]] = []
        self.outbound_responses: List[Dict[str, Any]] = []
        self.errors: List[str] = []
        self._auto_response: Optional[str] = None

    def set_auto_response(self, text: str) -> None:
        """Set a fixed response for all messages (useful in tests)."""
        self._auto_response = text

    def simulate_inbound(self, text: str, sender: str = "test-user") -> Dict[str, Any]:
        """Simulate an inbound message from a channel user."""
        message = {
            "id": f"msg-{uuid.uuid4().hex[:8]}",
            "channel": self.channel_type,
            "channel_id": self.channel_id,
            "sender": sender,
            "text": text,
            "timestamp": time.time(),
            "session_id": f"{self.channel_type}-{sender}",
        }
        self.inbound_messages.append(message)
        logger.info("Sandbox inbound: %s from %s", text[:50], sender)
        return message

    def record_outbound(self, text: str, session_id: str = "") -> Dict[str, Any]:
        """Record an outbound response sent to the channel."""
        response = {
            "id": f"resp-{uuid.uuid4().hex[:8]}",
            "channel": self.channel_type,
            "channel_id": self.channel_id,
            "text": text,
            "session_id": session_id,
            "timestamp": time.time(),
        }
        self.outbound_responses.append(response)
        return response

    def record_error(self, error: str) -> None:
        self.errors.append(error)

    def get_conversation(self) -> List[Dict[str, Any]]:
        """Get interleaved inbound/outbound messages sorted by time."""
        all_msgs: List[Dict[str, Any]] = []
        for m in self.inbound_messages:
            all_msgs.append({"direction": "inbound", **m})
        for r in self.outbound_responses:
            all_msgs.append({"direction": "outbound", **r})
        return sorted(all_msgs, key=lambda x: x.get("timestamp", 0))

    def reset(self) -> None:
        self.inbound_messages.clear()
        self.outbound_responses.clear()
        self.errors.clear()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "channel_type": self.channel_type,
            "channel_id": self.channel_id,
            "inbound_count": len(self.inbound_messages),
            "outbound_count": len(self.outbound_responses),
            "error_count": len(self.errors),
        }


class SandboxManager:
    """Manages multiple sandbox channels for testing."""

    def __init__(self) -> None:
        self._channels: Dict[str, SandboxChannel] = {}

    def create_channel(self, channel_type: str = "sandbox") -> SandboxChannel:
        ch = SandboxChannel(channel_type=channel_type)
        self._channels[ch.channel_id] = ch
        return ch

    def get_channel(self, channel_id: str) -> Optional[SandboxChannel]:
        return self._channels.get(channel_id)

    def list_channels(self) -> List[Dict[str, Any]]:
        return [ch.to_dict() for ch in self._channels.values()]

    def remove_channel(self, channel_id: str) -> bool:
        return self._channels.pop(channel_id, None) is not None

    def reset_all(self) -> None:
        for ch in self._channels.values():
            ch.reset()
