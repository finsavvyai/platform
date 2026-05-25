#!/usr/bin/env python3
"""
FinSavvyAI Worker Node — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - cluster_worker_config: WorkerConfig, get_local_ip, system helpers
  - cluster_worker_node: ClusterWorker
  - cluster_worker_cli: interactive_setup, main
"""

from src.cluster.cluster_worker_cli import interactive_setup, main
from src.cluster.cluster_worker_config import (
    WorkerConfig,
    check_gpu_availability,
    get_cpu_info,
    get_local_ip,
    get_memory_info,
)
from src.cluster.cluster_worker_node import ClusterWorker

__all__ = [
    "WorkerConfig",
    "ClusterWorker",
    "get_local_ip",
    "check_gpu_availability",
    "get_memory_info",
    "get_cpu_info",
    "interactive_setup",
    "main",
]

if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
