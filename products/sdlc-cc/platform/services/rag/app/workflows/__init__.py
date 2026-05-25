"""Temporal durable workflows for the RAG service.

This package replaces fragile Bull-queue retries with Temporal workflows.
Activities wrap the existing ``IngestionService`` instead of replacing it —
the ingestion logic stays where it lives, Temporal only owns orchestration,
retries, visibility, and durable state across worker restarts.

Public surface:

- :class:`DocumentIngestionWorkflow` — durable pipeline workflow.
- :class:`DocumentIngestionRequest` — workflow input payload.
- :func:`start_ingestion_workflow` — kick off a workflow from FastAPI.
- :func:`get_workflow_status` — read current status / progress.
- :func:`cancel_workflow` — cancel an in-flight workflow.
"""

from __future__ import annotations

from app.workflows.ingestion_workflow import (
    DocumentIngestionRequest,
    DocumentIngestionResult,
    DocumentIngestionWorkflow,
)
from app.workflows.client import (
    cancel_workflow,
    get_workflow_status,
    start_ingestion_workflow,
)

TASK_QUEUE = "sdlc-rag-ingestion"

__all__ = [
    "TASK_QUEUE",
    "DocumentIngestionRequest",
    "DocumentIngestionResult",
    "DocumentIngestionWorkflow",
    "cancel_workflow",
    "get_workflow_status",
    "start_ingestion_workflow",
]
