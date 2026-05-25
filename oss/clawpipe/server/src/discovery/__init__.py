"""Service discovery for LM Studio instances."""

from .models import DiscoveredInstance
from .mdns_discovery import LMStudioDiscovery

__all__ = ["LMStudioDiscovery", "DiscoveredInstance"]
