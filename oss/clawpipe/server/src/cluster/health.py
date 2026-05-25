"""Health check functions for cluster nodes."""

import asyncio
import logging
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.cluster.manager import ClusterManager

logger = logging.getLogger("finsavvyai.cluster")


async def health_check_loop(manager: "ClusterManager") -> None:
    """Periodically check node health."""
    while manager._running:
        try:
            await manager._check_node_health()
            await asyncio.sleep(manager._health_check_interval)
        except Exception as e:
            logger.error(f"Health check error: {e}")
            await asyncio.sleep(5)


async def check_node_health(manager: "ClusterManager") -> None:
    """Check health of all registered nodes."""
    for node_id, node in list(manager.nodes.items()):
        try:
            import httpx
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{node.url}/v1/models", timeout=3.0
                )
                if resp.status_code == 200:
                    if node.status != "online":
                        logger.info(f"Node {node_id} is back online")
                        node.status = "online"
                    node.last_heartbeat = datetime.now()
                else:
                    logger.warning(
                        f"Node {node_id} health check failed: "
                        f"{resp.status_code}"
                    )
                    node.status = "error"
                    node.error_count += 1
        except Exception as e:
            logger.warning(
                f"Node {node_id} health check failed: {e}"
            )
            node.status = "offline"
            node.error_count += 1
