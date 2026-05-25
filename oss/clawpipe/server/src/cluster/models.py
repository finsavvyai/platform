"""Data models for cluster management."""

from datetime import datetime
from typing import List, Optional
from dataclasses import dataclass, field


@dataclass
class ClusterNode:
    """A node in the LM Studio cluster."""
    node_id: str
    name: str
    host: str
    port: int
    url: str
    models: List[str] = field(default_factory=list)
    status: str = "online"  # online, offline, loading, error
    last_heartbeat: Optional[datetime] = None
    request_count: int = 0
    error_count: int = 0


@dataclass
class ClusterStats:
    """Cluster-wide statistics."""
    total_nodes: int = 0
    online_nodes: int = 0
    offline_nodes: int = 0
    total_models: int = 0
    total_requests: int = 0
    total_errors: int = 0
