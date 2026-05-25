#!/usr/bin/env python3
"""
Memory services: daily flusher, semantic search, and compaction.

Sprint 18 — Tasks 18.2, 18.5, 18.6
Extracted from memory_system.py.
"""

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.memory.memory_entry import MemoryEntry, WorkspaceMemory

logger = logging.getLogger("finsavvyai.memory")


class DailyMemoryFlusher:
    """Flush session summaries to dated files (Task 18.2)."""

    def __init__(self, memory_dir: str):
        self.memory_dir = memory_dir
        Path(memory_dir).mkdir(parents=True, exist_ok=True)

    def flush(self, summaries: List[str], date: Optional[str] = None) -> str:
        """Write summaries to memory/YYYY-MM-DD.md."""
        if date is None:
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        filename = f"{date}.md"
        filepath = os.path.join(self.memory_dir, filename)

        content = f"# Memory -- {date}\n\n"
        for i, summary in enumerate(summaries, 1):
            content += f"## Entry {i}\n{summary}\n\n"

        with open(filepath, "w") as f:
            f.write(content)

        logger.info("Flushed %d memories to %s", len(summaries), filepath)
        return filepath

    def load(self, date: str) -> Optional[str]:
        """Load memories for a specific date."""
        filepath = os.path.join(self.memory_dir, f"{date}.md")
        if os.path.exists(filepath):
            with open(filepath) as f:
                return f.read()
        return None

    def list_dates(self) -> List[str]:
        """List all available memory dates."""
        dates = []
        if os.path.exists(self.memory_dir):
            for f in os.listdir(self.memory_dir):
                if f.endswith(".md"):
                    dates.append(f.replace(".md", ""))
        return sorted(dates)


class SemanticSearch:
    """
    Keyword-based search over memory entries (Task 18.5).
    Uses simple TF scoring for relevance ranking.
    """

    def __init__(self, workspace: WorkspaceMemory):
        self.workspace = workspace

    def search(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search memories by keyword relevance."""
        query_tokens = set(query.lower().split())
        results = []

        for entry in self.workspace.list_all():
            content_lower = entry.content.lower()
            score = sum(1 for t in query_tokens if t in content_lower)
            if score > 0:
                results.append({
                    "entry": entry.to_dict(),
                    "score": score,
                    "relevance": (
                        score / len(query_tokens) if query_tokens else 0
                    ),
                })

        results.sort(key=lambda r: r["score"], reverse=True)
        return results[:limit]


class MemoryCompactor:
    """Summarize and compact old memories (Task 18.6)."""

    def __init__(
        self, workspace: WorkspaceMemory, max_age_seconds: float = 86400
    ):
        self.workspace = workspace
        self.max_age_seconds = max_age_seconds

    def get_old_entries(self) -> List[MemoryEntry]:
        """Get entries older than max_age_seconds."""
        cutoff = time.time() - self.max_age_seconds
        return [
            e for e in self.workspace.list_all() if e.created_at < cutoff
        ]

    def compact(self) -> Dict[str, Any]:
        """Compact old memories by grouping and summarizing."""
        old = self.get_old_entries()
        if not old:
            return {"compacted": 0, "remaining": self.workspace.count()}

        groups: Dict[str, List[str]] = {}
        for entry in old:
            groups.setdefault(entry.source, []).append(entry.content)

        compacted_count = 0
        for source, contents in groups.items():
            summary = (
                f"[Compacted {len(contents)} entries] "
                + " | ".join(c[:100] for c in contents)
            )
            compacted_entry = MemoryEntry(
                content=summary[:2000],
                source=f"compacted_{source}",
                tags=["compacted"],
            )
            self.workspace.store(compacted_entry)
            compacted_count += 1

        for entry in old:
            self.workspace.delete(entry.id)

        return {
            "compacted": len(old),
            "new_entries": compacted_count,
            "remaining": self.workspace.count(),
        }
