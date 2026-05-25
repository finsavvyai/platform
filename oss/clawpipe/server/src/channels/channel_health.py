"""Channel health monitoring — tracks connection state per channel."""

import logging
import time
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.channels.health")


class ChannelState(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


class ChannelHealthEntry:
    """Health state for a single channel."""

    def __init__(self, channel_id: str, channel_type: str):
        self.channel_id = channel_id
        self.channel_type = channel_type  # "whatsapp", "telegram", "slack"
        self.state = ChannelState.UNKNOWN
        self.last_heartbeat: float = 0.0
        self.last_message_at: float = 0.0
        self.message_count: int = 0
        self.error_count: int = 0
        self.last_error: Optional[str] = None
        self.connected_at: float = 0.0

    def record_message(self) -> None:
        """Record a successful message processed."""
        self.message_count += 1
        self.last_message_at = time.time()
        self.last_heartbeat = time.time()
        if self.state != ChannelState.CONNECTED:
            self.state = ChannelState.CONNECTED
            self.connected_at = time.time()

    def record_error(self, error: str) -> None:
        """Record a channel error."""
        self.error_count += 1
        self.last_error = error
        self.last_heartbeat = time.time()
        # After 3 consecutive errors without success, mark degraded
        if self.error_count > 0 and self.error_count % 3 == 0:
            self.state = ChannelState.DEGRADED

    def record_heartbeat(self) -> None:
        """Record a heartbeat (channel is alive)."""
        self.last_heartbeat = time.time()
        if self.state == ChannelState.UNKNOWN:
            self.state = ChannelState.CONNECTED
            self.connected_at = time.time()

    def mark_disconnected(self, reason: str = "") -> None:
        """Mark channel as disconnected."""
        self.state = ChannelState.DISCONNECTED
        self.last_error = reason or "Disconnected"

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to JSON-safe dict."""
        return {
            "channel_id": self.channel_id,
            "channel_type": self.channel_type,
            "state": self.state.value,
            "last_heartbeat": self.last_heartbeat,
            "last_message_at": self.last_message_at,
            "message_count": self.message_count,
            "error_count": self.error_count,
            "last_error": self.last_error,
            "connected_at": self.connected_at,
            "uptime_seconds": (
                time.time() - self.connected_at
                if self.state == ChannelState.CONNECTED and self.connected_at > 0
                else 0.0
            ),
        }


class ChannelHealthMonitor:
    """Aggregates health state for all configured channels."""

    def __init__(self, stale_threshold: float = 300.0):
        self._channels: Dict[str, ChannelHealthEntry] = {}
        self.stale_threshold = stale_threshold  # seconds before marking stale

    def register_channel(
        self, channel_id: str, channel_type: str
    ) -> ChannelHealthEntry:
        """Register a channel for health tracking."""
        if channel_id not in self._channels:
            self._channels[channel_id] = ChannelHealthEntry(
                channel_id, channel_type
            )
            logger.info(
                "Registered channel for health tracking: %s (%s)",
                channel_id,
                channel_type,
            )
        return self._channels[channel_id]

    def get_channel(self, channel_id: str) -> Optional[ChannelHealthEntry]:
        return self._channels.get(channel_id)

    def record_message(self, channel_id: str) -> None:
        entry = self._channels.get(channel_id)
        if entry:
            entry.record_message()

    def record_error(self, channel_id: str, error: str) -> None:
        entry = self._channels.get(channel_id)
        if entry:
            entry.record_error(error)

    def check_stale_channels(self) -> List[str]:
        """Check for channels that haven't sent a heartbeat recently."""
        now = time.time()
        stale: List[str] = []
        for channel_id, entry in self._channels.items():
            if entry.state == ChannelState.CONNECTED:
                if (
                    entry.last_heartbeat > 0
                    and (now - entry.last_heartbeat) > self.stale_threshold
                ):
                    entry.state = ChannelState.DEGRADED
                    entry.last_error = "No heartbeat received"
                    stale.append(channel_id)
        return stale

    def get_aggregate_health(self) -> Dict[str, Any]:
        """Get aggregate health status across all channels."""
        self.check_stale_channels()
        total = len(self._channels)
        connected = sum(
            1 for c in self._channels.values()
            if c.state == ChannelState.CONNECTED
        )
        degraded = sum(
            1 for c in self._channels.values()
            if c.state == ChannelState.DEGRADED
        )
        disconnected = sum(
            1 for c in self._channels.values()
            if c.state == ChannelState.DISCONNECTED
        )

        if total == 0:
            overall = "no_channels"
        elif connected == total:
            overall = "healthy"
        elif disconnected == total:
            overall = "unhealthy"
        elif degraded > 0 or disconnected > 0:
            overall = "degraded"
        else:
            overall = "unknown"

        return {
            "status": overall,
            "total_channels": total,
            "connected": connected,
            "degraded": degraded,
            "disconnected": disconnected,
            "channels": {
                cid: entry.to_dict()
                for cid, entry in self._channels.items()
            },
        }

    def remove_channel(self, channel_id: str) -> bool:
        return self._channels.pop(channel_id, None) is not None
