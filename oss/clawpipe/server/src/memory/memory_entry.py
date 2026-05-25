#!/usr/bin/env python3
"""
Memory entry and workspace memory store.

Core data model and in-memory storage with cross-channel support.

Sprint 18 — Tasks 18.1, 18.3
Extracted from memory_system.py.
"""

import hashlib
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.memory")


class MemoryEntry:
    """A single memory record."""

    def __init__(
        self,
        content: str,
        source: str = "conversation",
        channel: str = "default",
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
    ):
        self.id = hashlib.sha256(
            f"{content}{time.time()}".encode()
        ).hexdigest()[:16]
        self.content = content
        self.source = source
        self.channel = channel
        self.tags = tags or []
        self.metadata = metadata or {}
        self.created_at = time.time()
        self.accessed_at = self.created_at
        self.access_count = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "source": self.source,
            "channel": self.channel,
            "tags": self.tags,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "accessed_at": self.accessed_at,
            "access_count": self.access_count,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "MemoryEntry":
        entry = cls(
            content=data["content"],
            source=data.get("source", "conversation"),
            channel=data.get("channel", "default"),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )
        entry.id = data.get("id", entry.id)
        entry.created_at = data.get("created_at", entry.created_at)
        entry.accessed_at = data.get("accessed_at", entry.accessed_at)
        entry.access_count = data.get("access_count", 0)
        return entry


class WorkspaceMemory:
    """
    In-memory store with optional file persistence (Task 18.1).
    Supports cross-channel access (Task 18.3).
    """

    def __init__(
        self,
        memory_dir: Optional[str] = None,
        max_entries: int = 1000,
    ):
        self.memory_dir = memory_dir
        self.max_entries = max_entries
        self._entries: Dict[str, MemoryEntry] = {}

        if memory_dir:
            Path(memory_dir).mkdir(parents=True, exist_ok=True)

    def store(self, entry: MemoryEntry) -> str:
        """Store a memory entry."""
        self._entries[entry.id] = entry
        self._enforce_limit()
        return entry.id

    def get(self, memory_id: str) -> Optional[MemoryEntry]:
        entry = self._entries.get(memory_id)
        if entry:
            entry.accessed_at = time.time()
            entry.access_count += 1
        return entry

    def delete(self, memory_id: str) -> bool:
        return self._entries.pop(memory_id, None) is not None

    def list_all(self) -> List[MemoryEntry]:
        return sorted(
            self._entries.values(),
            key=lambda e: e.created_at,
            reverse=True,
        )

    def count(self) -> int:
        return len(self._entries)

    def _enforce_limit(self) -> None:
        """Remove oldest entries when limit is exceeded."""
        while len(self._entries) > self.max_entries:
            oldest = min(self._entries.values(), key=lambda e: e.accessed_at)
            del self._entries[oldest.id]

    def get_by_channel(self, channel: str) -> List[MemoryEntry]:
        """Get memories from a specific channel."""
        return [e for e in self._entries.values() if e.channel == channel]

    def get_cross_channel(
        self, channels: Optional[List[str]] = None
    ) -> List[MemoryEntry]:
        """Get memories across all or specified channels (Task 18.3)."""
        if channels is None:
            return self.list_all()
        return [e for e in self._entries.values() if e.channel in channels]
