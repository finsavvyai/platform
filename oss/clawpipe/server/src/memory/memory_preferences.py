#!/usr/bin/env python3
"""
User preferences, context optimizer, and memory export/import.

Sprint 18 — Tasks 18.7, 18.8, 18.9
Extracted from memory_system.py.
"""

import json
import logging
from typing import Any, Dict, List, Optional

from src.memory.memory_entry import MemoryEntry, WorkspaceMemory
from src.memory.memory_services import SemanticSearch

logger = logging.getLogger("finsavvyai.memory")


class UserPreferences:
    """Track user patterns and preferences (Task 18.7)."""

    def __init__(self) -> None:
        self._preferences: Dict[str, Any] = {}
        self._patterns: Dict[str, int] = {}

    def set_preference(self, key: str, value: Any) -> None:
        self._preferences[key] = value

    def get_preference(self, key: str, default: Any = None) -> Any:
        return self._preferences.get(key, default)

    def record_pattern(self, pattern: str) -> None:
        """Record a user behaviour pattern."""
        self._patterns[pattern] = self._patterns.get(pattern, 0) + 1

    def get_top_patterns(self, limit: int = 10) -> List[Dict[str, Any]]:
        sorted_patterns = sorted(
            self._patterns.items(), key=lambda x: x[1], reverse=True
        )
        return [
            {"pattern": p, "count": c} for p, c in sorted_patterns[:limit]
        ]

    def get_all_preferences(self) -> Dict[str, Any]:
        return dict(self._preferences)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "preferences": self._preferences,
            "patterns": self._patterns,
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "UserPreferences":
        prefs = cls()
        prefs._preferences = data.get("preferences", {})
        prefs._patterns = data.get("patterns", {})
        return prefs


class ContextOptimizer:
    """
    Inject only relevant memories into the context window (Task 18.8).
    Manages token budget and selects most relevant memories.
    """

    def __init__(
        self,
        search: SemanticSearch,
        max_context_tokens: int = 2000,
        chars_per_token: float = 4.0,
    ):
        self.search = search
        self.max_context_tokens = max_context_tokens
        self.chars_per_token = chars_per_token

    def build_context(
        self,
        query: str,
        max_entries: int = 5,
    ) -> Dict[str, Any]:
        """Build an optimized context from relevant memories."""
        results = self.search.search(query, limit=max_entries * 2)

        selected: List[Dict] = []
        total_chars = 0
        max_chars = int(self.max_context_tokens * self.chars_per_token)

        for result in results:
            content = result["entry"]["content"]
            if total_chars + len(content) > max_chars:
                break
            selected.append(result)
            total_chars += len(content)

        context_text = "\n\n".join(
            r["entry"]["content"] for r in selected
        )

        return {
            "context": context_text,
            "entries_used": len(selected),
            "total_chars": total_chars,
            "estimated_tokens": int(total_chars / self.chars_per_token),
            "budget_remaining": (
                self.max_context_tokens
                - int(total_chars / self.chars_per_token)
            ),
        }


class MemoryExporter:
    """Export and import memory for backup (Task 18.9)."""

    def __init__(self, workspace: WorkspaceMemory):
        self.workspace = workspace

    def export_json(self) -> str:
        """Export all memories as JSON string."""
        entries = [e.to_dict() for e in self.workspace.list_all()]
        return json.dumps({"version": "1.0", "entries": entries}, indent=2)

    def import_json(self, data: str) -> int:
        """Import memories from JSON string. Returns count imported."""
        parsed = json.loads(data)
        entries = parsed.get("entries", [])
        count = 0
        for entry_data in entries:
            entry = MemoryEntry.from_dict(entry_data)
            self.workspace.store(entry)
            count += 1
        return count

    def export_to_file(self, filepath: str) -> None:
        """Export memories to a file."""
        with open(filepath, "w") as f:
            f.write(self.export_json())

    def import_from_file(self, filepath: str) -> int:
        """Import memories from a file."""
        with open(filepath) as f:
            return self.import_json(f.read())
