"""Data models for source management."""

from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass, field


@dataclass
class Source:
    """A document source for RAG."""
    id: str
    name: str
    file_type: str
    content: str
    chunks: List[str] = field(default_factory=list)
    metadata: Dict = field(default_factory=dict)
    created_at: str = field(
        default_factory=lambda: datetime.now().isoformat()
    )
