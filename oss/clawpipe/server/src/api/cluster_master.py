#!/usr/bin/env python3
"""
FinSavvyAI Cluster Manager — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - cluster_master_models: ClusterNode, LoadBalancer
  - cluster_master_manager: ClusterManager
  - cluster_master_worker: WorkerNode
"""

import asyncio
import logging

from src.api.cluster_master_manager import ClusterManager
from src.api.cluster_master_models import ClusterNode, LoadBalancer
from src.api.cluster_master_worker import WorkerNode

logger = logging.getLogger("finsavvyai.api.cluster_master")

__all__ = [
    "ClusterNode",
    "ClusterManager",
    "LoadBalancer",
    "WorkerNode",
    "main",
]


async def main() -> None:
    """Example cluster setup."""
    master = ClusterManager()
    master_task = asyncio.create_task(master.start())
    await asyncio.sleep(2)

    workers = [
        WorkerNode(
            node_id="desktop-01",
            name="Main Desktop",
            host="localhost",
            port=8001,
            models=["gpt-3.5-turbo", "gpt-4"],
            master_host="localhost",
        ),
        WorkerNode(
            node_id="laptop-01",
            name="Development Laptop",
            host="localhost",
            port=8002,
            models=["gpt-3.5-turbo"],
            master_host="localhost",
        ),
        WorkerNode(
            node_id="server-01",
            name="Home Server",
            host="localhost",
            port=8003,
            models=["gpt-4", "claude-3-sonnet"],
            master_host="localhost",
        ),
    ]

    worker_tasks = [asyncio.create_task(w.start()) for w in workers]

    logger.info("FinSavvyAI Home Cluster Started!")
    logger.info("  Master: http://localhost:8000")
    logger.info("  Workers: %d nodes", len(workers))

    try:
        await asyncio.gather(master_task, *worker_tasks)
    except KeyboardInterrupt:
        logger.info("Shutting down cluster...")


if __name__ == "__main__":
    asyncio.run(main())
