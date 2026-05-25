"""Cluster manager for coordinating multiple LM Studio instances."""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.cluster.models import ClusterNode, ClusterStats
from src.cluster.health import health_check_loop, check_node_health
from src.discovery.mdns_discovery import LMStudioDiscovery, DiscoveredInstance

logger = logging.getLogger("finsavvyai.cluster")


class ClusterManager:
    """
    Manages a cluster of LM Studio instances.

    Features:
    - Auto-discovery of instances
    - Health monitoring
    - Load balancing
    - Failover
    - Model catalog aggregation
    """

    def __init__(self, cluster_name: str = "default"):
        self.cluster_name = cluster_name
        self.nodes: Dict[str, ClusterNode] = {}
        self.discovery = LMStudioDiscovery()
        self._running = False
        self._health_check_interval = 30  # seconds

    async def start(self):
        """Start the cluster manager."""
        logger.info(f"Starting cluster manager: {self.cluster_name}")
        self._running = True
        await self._discover_and_register()
        asyncio.create_task(self._health_check_loop())

    async def stop(self):
        """Stop the cluster manager."""
        logger.info(f"Stopping cluster manager: {self.cluster_name}")
        self._running = False

    async def _discover_and_register(self):
        """Discover and register LM Studio instances."""
        logger.info("Discovering LM Studio instances...")
        instances = await self.discovery.discover(timeout=5)
        for instance in instances:
            await self._register_node(instance)

    async def _register_node(self, instance: DiscoveredInstance):
        """Register a discovered instance as a cluster node."""
        node_id = f"{instance.host}:{instance.port}"
        if node_id in self.nodes:
            logger.debug(f"Node {node_id} already registered, updating...")
            self.nodes[node_id].last_heartbeat = datetime.now()
        else:
            logger.info(f"Registering node: {node_id}")
            self.nodes[node_id] = ClusterNode(
                node_id=node_id, name=instance.name,
                host=instance.host, port=instance.port,
                url=instance.url, models=[],
                last_heartbeat=datetime.now(),
            )
        models = await self.discovery.query_models(instance)
        if models:
            self.nodes[node_id].models = models
            logger.info(f"Node {node_id} has {len(models)} model(s)")

    async def _health_check_loop(self):
        """Periodically check node health."""
        await health_check_loop(self)

    async def _check_node_health(self):
        """Check health of all registered nodes."""
        await check_node_health(self)

    def get_node(self, node_id: str) -> Optional[ClusterNode]:
        """Get a node by ID."""
        return self.nodes.get(node_id)

    def get_all_nodes(self) -> List[ClusterNode]:
        """Get all registered nodes."""
        return list(self.nodes.values())

    def get_online_nodes(self) -> List[ClusterNode]:
        """Get all online nodes."""
        return [n for n in self.nodes.values() if n.status == "online"]

    def get_stats(self) -> ClusterStats:
        """Get cluster statistics."""
        stats = ClusterStats()
        for node in self.nodes.values():
            stats.total_nodes += 1
            if node.status == "online":
                stats.online_nodes += 1
            else:
                stats.offline_nodes += 1
            stats.total_models += len(node.models)
            stats.total_requests += node.request_count
            stats.total_errors += node.error_count
        return stats

    def select_node_for_model(self, model: str) -> Optional[ClusterNode]:
        """Select the best node for a given model."""
        candidates = [
            n for n in self.get_online_nodes() if model in n.models
        ]
        if not candidates:
            return None
        return min(candidates, key=lambda n: n.request_count)

    def get_all_models(self) -> List[str]:
        """Get all unique models across all nodes."""
        models = set()
        for node in self.get_online_nodes():
            models.update(node.models)
        return sorted(list(models))

    async def remove_node(self, node_id: str):
        """Remove a node from the cluster."""
        if node_id in self.nodes:
            logger.info(f"Removing node: {node_id}")
            del self.nodes[node_id]
        else:
            logger.warning(f"Node {node_id} not found")

    async def shutdown_node(self, node_id: str):
        """Gracefully shutdown a node."""
        node = self.get_node(node_id)
        if node:
            logger.info(f"Shutting down node: {node_id}")
            node.status = "offline"
            await self.remove_node(node_id)

    def get_status(self) -> Dict:
        """Get cluster status for API responses."""
        stats = self.get_stats()
        return {
            "cluster_name": self.cluster_name,
            "status": "healthy" if stats.online_nodes > 0 else "degraded",
            "stats": {
                "total_nodes": stats.total_nodes,
                "online_nodes": stats.online_nodes,
                "offline_nodes": stats.offline_nodes,
                "total_models": stats.total_models,
                "total_requests": stats.total_requests,
                "total_errors": stats.total_errors,
            },
            "nodes": [
                {
                    "node_id": n.node_id, "name": n.name,
                    "host": n.host, "port": n.port,
                    "status": n.status, "models": n.models,
                    "request_count": n.request_count,
                    "error_count": n.error_count,
                    "last_heartbeat": (
                        n.last_heartbeat.isoformat()
                        if n.last_heartbeat else None
                    ),
                }
                for n in self.get_all_nodes()
            ],
        }


async def main():
    """Test cluster manager."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    manager = ClusterManager("test-cluster")
    try:
        await manager.start()
        print("\nCluster Status:")
        status = manager.get_status()
        print(f"  Cluster: {status['cluster_name']}")
        print(f"  Status: {status['status']}")
        print(f"  Nodes: {status['stats']['online_nodes']}"
              f"/{status['stats']['total_nodes']} online")
        print(f"  Models: {status['stats']['total_models']} total")
        if status['nodes']:
            print("\nNodes:")
            for node in status['nodes']:
                print(f"  - {node['node_id']}: {node['status']}")
                print(f"    Models: {', '.join(node['models'][:3])}")
                if len(node['models']) > 3:
                    print(f"    ... and {len(node['models']) - 3} more")
        print("\nRunning for 60 seconds (health checks every 30s)...")
        await asyncio.sleep(60)
    finally:
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
