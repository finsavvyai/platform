#!/usr/bin/env python3
"""
Cluster master data models and load balancer.

Shared types for the cluster master/worker system.
Extracted from cluster_master.py.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class ClusterNode:
    """Represents a worker node in the cluster."""

    id: str
    name: str
    host: str
    port: int
    models: List[str]
    status: str  # 'online', 'offline', 'busy'
    last_heartbeat: datetime
    capabilities: Dict
    current_load: int = 0
    max_load: int = 100


class LoadBalancer:
    """Load balancing strategies."""

    def select_node(
        self, nodes: Dict[str, ClusterNode], model: str
    ) -> Optional[ClusterNode]:
        """Select best node using round-robin with load awareness."""
        available_nodes = [
            node
            for node in nodes.values()
            if node.status == "online"
            and model in node.models
            and node.current_load < node.max_load
        ]

        if not available_nodes:
            return None

        return min(available_nodes, key=lambda n: n.current_load / n.max_load)
