#!/usr/bin/env python3
"""
Network-enabled FinSavvyAI Cluster — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - network_cluster_models: ClusterNode, LoadBalancer, get_local_ip
  - network_cluster_master: NetworkClusterManager
  - network_cluster_worker: NetworkWorkerNode
"""

import asyncio
import logging

from src.api.network_cluster_master import NetworkClusterManager
from src.api.network_cluster_models import ClusterNode, LoadBalancer, get_local_ip
from src.api.network_cluster_worker import NetworkWorkerNode

logger = logging.getLogger("finsavvyai.api.network_cluster")

__all__ = [
    "ClusterNode",
    "LoadBalancer",
    "NetworkClusterManager",
    "NetworkWorkerNode",
    "get_local_ip",
    "start_network_cluster",
]


async def start_network_cluster() -> None:
    """Start network-accessible cluster."""
    logger.info("Starting FinSavvyAI Network Cluster...")

    master = NetworkClusterManager(master_host="0.0.0.0", master_port=8000)
    master_task = asyncio.create_task(master.start())
    await asyncio.sleep(2)

    worker = NetworkWorkerNode(
        node_id="network-worker-01",
        name="Network AI Worker",
        host="0.0.0.0",
        port=8001,
        models=["gpt-3.5-turbo-sim", "phi-2"],
        master_host="localhost",
        master_port=8000,
    )
    worker_task = asyncio.create_task(worker.start())
    await asyncio.sleep(3)

    logger.info("Network Cluster is ready!")
    logger.info("Cluster Dashboard: http://%s:8000", master.local_ip)
    logger.info("AI Chat API: http://%s:8001/v1/chat/completions", master.local_ip)

    try:
        await asyncio.gather(master_task, worker_task)
    except KeyboardInterrupt:
        logger.info("Network Cluster stopped")


if __name__ == "__main__":
    asyncio.run(start_network_cluster())
