"""Data models for notebook management."""

from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass, field


@dataclass
class Message:
    """A chat message in a notebook."""
    id: str
    role: str  # 'user' or 'assistant'
    content: str
    citations: List[Dict] = field(default_factory=list)
    timestamp: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )


@dataclass
class Section:
    """A section within a notebook."""
    id: str
    title: str
    messages: List[Message] = field(default_factory=list)
    sources: List[str] = field(default_factory=list)  # source IDs
    created_at: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )


@dataclass
class Notebook:
    """A notebook containing sections with conversations."""
    id: str
    name: str
    sections: List[Section] = field(default_factory=list)
    created_at: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )
