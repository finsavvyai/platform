"""Data models for service discovery."""

from dataclasses import dataclass
from typing import List


@dataclass
class DiscoveredInstance:
    """A discovered LM Studio instance."""
    name: str
    host: str
    port: int
    url: str
    models: List[str]
