#!/usr/bin/env python3
"""
FinSavvyAI Memory & Context Sharing System — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - memory_entry: MemoryEntry, WorkspaceMemory
  - memory_services: DailyMemoryFlusher, SemanticSearch, MemoryCompactor
  - memory_preferences: UserPreferences, ContextOptimizer, MemoryExporter
"""

from src.memory.memory_entry import MemoryEntry, WorkspaceMemory
from src.memory.memory_preferences import (
    ContextOptimizer,
    MemoryExporter,
    UserPreferences,
)
from src.memory.memory_services import (
    DailyMemoryFlusher,
    MemoryCompactor,
    SemanticSearch,
)

__all__ = [
    "MemoryEntry",
    "WorkspaceMemory",
    "DailyMemoryFlusher",
    "SemanticSearch",
    "MemoryCompactor",
    "UserPreferences",
    "ContextOptimizer",
    "MemoryExporter",
]
