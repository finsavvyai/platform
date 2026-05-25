"""Temporal worker entry point for the RAG ingestion task queue.

Run locally::

    python -m app.workflows.worker

Or inside Docker by setting the container entrypoint to this module. The
worker polls the ``sdlc-rag-ingestion`` task queue and executes both the
workflow and its activities in the same process — small deployments can
run one worker; large deployments should split activity workers onto GPU
nodes for embedding.
"""

from __future__ import annotations

import asyncio
import logging
import os
import signal
from typing import Optional

from temporalio.client import Client
from temporalio.worker import Worker

from app.workflows import TASK_QUEUE, activities
from app.workflows.ingestion_workflow import DocumentIngestionWorkflow

logger = logging.getLogger(__name__)


def _address() -> str:
    return os.getenv("TEMPORAL_ADDRESS", "localhost:7233")


def _namespace() -> str:
    return os.getenv("TEMPORAL_NAMESPACE", "default")


async def _connect() -> Client:
    address = _address()
    namespace = _namespace()
    logger.info("connecting to temporal at %s (ns=%s)", address, namespace)
    return await Client.connect(address, namespace=namespace)


async def main(stop_event: Optional[asyncio.Event] = None) -> None:
    """Run a single worker until ``stop_event`` is set or SIGTERM received."""
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    client = await _connect()
    worker = Worker(
        client,
        task_queue=TASK_QUEUE,
        workflows=[DocumentIngestionWorkflow],
        activities=[
            activities.download_document,
            activities.extract_content,
            activities.chunk_document,
            activities.embed_chunks,
            activities.index_document,
        ],
        max_concurrent_activities=int(
            os.getenv("TEMPORAL_MAX_ACTIVITIES", "20")
        ),
    )

    stop = stop_event or asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # pragma: no cover - windows
            pass

    logger.info("worker ready on task queue %s", TASK_QUEUE)
    async with worker:
        await stop.wait()
    logger.info("worker shutdown clean")


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main())
