"""FinSavvyAI Cluster Worker Node."""

import asyncio
import logging
import sys

import aiohttp
from aiohttp import web

from src.workers.cluster_worker_system import (
    WorkerConfig,
    check_gpu_availability,
    get_memory_info,
    get_cpu_info,
    interactive_setup,
)
from src.workers.cluster_worker_routes import setup_routes

logger = logging.getLogger("finsavvyai.cluster_worker")


class ClusterWorker:
    """Worker node that connects to the cluster master."""

    def __init__(self, config: WorkerConfig) -> None:
        self.config = config
        self.master_url = f"http://{config.master_host}:{config.master_port}"
        self.heartbeat_task: asyncio.Task | None = None

    async def start(self) -> None:
        """Start the worker node."""
        logger.info(
            "Starting worker %s at %s:%d (master: %s)",
            self.config.name, self.config.host, self.config.port, self.master_url,
        )
        await self.register_with_master()
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        await self._start_server()
        logger.info("Worker node ready and connected to cluster")

    async def _start_server(self) -> None:
        """Start local LLM server with OpenAI-compatible endpoints."""
        app = web.Application()
        setup_routes(app, self)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.config.host, self.config.port)
        await site.start()
        logger.info("LLM server running on http://%s:%d", self.config.host, self.config.port)

    async def register_with_master(self, max_retries: int = 5) -> bool:
        """Register this node with the cluster master with exponential backoff."""
        data = {
            "id": self.config.node_id,
            "name": self.config.name,
            "host": self.config.host,
            "port": self.config.port,
            "models": self.config.models,
            "capabilities": {
                "gpu": check_gpu_availability(),
                "memory": get_memory_info(),
                "cpu_cores": get_cpu_info(),
                "platform": sys.platform,
            },
            "max_load": 10,
        }

        for attempt in range(max_retries):
            try:
                timeout = aiohttp.ClientTimeout(total=10)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{self.master_url}/cluster/join", json=data
                    ) as response:
                        result = await response.json()
                        if result.get("status") == "registered":
                            logger.info("Registered with cluster master")
                            return True
                        logger.error("Failed to register: %s", result)
                        return False
            except Exception as e:
                backoff = min(2 ** attempt, 30)
                remaining = max_retries - attempt - 1
                logger.warning(
                    "Cannot connect to master (attempt %d/%d): %s",
                    attempt + 1, max_retries, e,
                )
                if remaining > 0:
                    await asyncio.sleep(backoff)
                else:
                    logger.error("All retries exhausted for master at %s", self.master_url)
                    return False
        return False

    async def _heartbeat_loop(self) -> None:
        """Send periodic heartbeat to master with backoff on failure."""
        consecutive_failures = 0
        base_interval = 30

        while True:
            try:
                data = {"id": self.config.node_id, "status": "online", "load": 2}
                timeout = aiohttp.ClientTimeout(total=5)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{self.master_url}/cluster/heartbeat", json=data
                    ) as response:
                        if response.status == 200:
                            consecutive_failures = 0
                        else:
                            consecutive_failures += 1
            except Exception as e:
                consecutive_failures += 1
                logger.error("Heartbeat error (failures: %d): %s", consecutive_failures, e)

            interval = min(base_interval * (2 ** min(consecutive_failures, 4)), 300)
            await asyncio.sleep(interval)


async def main() -> None:
    """Main setup function."""
    config = interactive_setup()
    worker = ClusterWorker(config)
    await worker.start()

    try:
        while True:
            await asyncio.sleep(60)
    except KeyboardInterrupt:
        if worker.heartbeat_task:
            worker.heartbeat_task.cancel()
        logger.info("Worker stopped")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
