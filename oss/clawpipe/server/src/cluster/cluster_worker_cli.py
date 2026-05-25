#!/usr/bin/env python3
"""
Interactive CLI setup for FinSavvyAI cluster workers.

Extracted from cluster_worker.py.
"""

import asyncio
import logging

from src.cluster.cluster_worker_config import WorkerConfig, get_local_ip
from src.cluster.cluster_worker_node import ClusterWorker

logger = logging.getLogger("finsavvyai.cluster.worker")


def interactive_setup() -> WorkerConfig:
    """Interactive setup for worker configuration."""
    logger.info("FinSavvyAI Worker Node Setup")

    local_ip = get_local_ip()
    logger.info("Detected IP: %s", local_ip)

    node_id = (
        input("Node ID (e.g., laptop-mbp): ").strip()
        or f"laptop-{local_ip.split('.')[-1]}"
    )
    name = (
        input("Node Name (e.g., MacBook Pro): ").strip()
        or f"Worker-{node_id}"
    )

    logger.info("Available models to host:")
    logger.info("1. gpt-3.5-turbo")
    logger.info("2. gpt-4")
    logger.info("3. claude-3-sonnet")
    logger.info("4. llama-2-7b")
    logger.info("5. custom (comma-separated list)")

    model_choice = input("Choose models (e.g., 1,3,5): ").strip()

    model_map = {
        "1": ["gpt-3.5-turbo"],
        "2": ["gpt-4"],
        "3": ["claude-3-sonnet"],
        "4": ["llama-2-7b"],
        "5": [],
    }

    models = []
    for choice in model_choice.split(","):
        choice = choice.strip()
        if choice in model_map:
            models.extend(model_map[choice])
        elif choice == "5":
            custom = input("Enter custom models (comma-separated): ").strip()
            models.extend([m.strip() for m in custom.split(",")])

    if not models:
        models = ["gpt-3.5-turbo"]

    port = int(input("Port (default 8001): ").strip() or "8001")
    master_host = (
        input("Master host IP (default localhost): ").strip() or "localhost"
    )
    master_port = int(input("Master port (default 8000): ").strip() or "8000")

    return WorkerConfig(
        node_id=node_id,
        name=name,
        host=local_ip,
        port=port,
        models=models,
        master_host=master_host,
        master_port=master_port,
    )


async def main() -> None:
    """Main setup function."""
    try:
        config = interactive_setup()

        logger.info("Starting worker with configuration:")
        logger.info("  Node ID: %s", config.node_id)
        logger.info("  Name: %s", config.name)
        logger.info("  Host: %s:%d", config.host, config.port)
        logger.info("  Models: %s", ", ".join(config.models))
        logger.info("  Master: %s:%d", config.master_host, config.master_port)

        worker = ClusterWorker(config)
        await worker.start()

        logger.info("Worker node is running! Press Ctrl+C to stop.")

        try:
            while True:
                await asyncio.sleep(60)
        except KeyboardInterrupt:
            logger.info("Stopping worker node...")
            if worker.heartbeat_task:
                worker.heartbeat_task.cancel()
            logger.info("Worker stopped successfully")

    except Exception as e:
        logger.error("Setup failed: %s", e)


if __name__ == "__main__":
    asyncio.run(main())
