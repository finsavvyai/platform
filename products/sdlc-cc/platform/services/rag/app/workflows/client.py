"""Thin async client used by FastAPI endpoints to drive workflows.

FastAPI handlers should never construct a Temporal ``Client`` directly —
go through these helpers so connection config, task queue, and workflow
identity policy live in one place.
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import asdict
from typing import Any, Dict, Optional

from temporalio.client import (
    Client,
    WorkflowExecutionStatus,
    WorkflowFailureError,
)

from app.workflows import TASK_QUEUE
from app.workflows.ingestion_workflow import (
    DocumentIngestionRequest,
    DocumentIngestionWorkflow,
)

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


async def _get_client() -> Client:
    """Cache a single Temporal client per process."""
    global _client
    if _client is None:
        address = os.getenv("TEMPORAL_ADDRESS", "localhost:7233")
        namespace = os.getenv("TEMPORAL_NAMESPACE", "default")
        _client = await Client.connect(address, namespace=namespace)
    return _client


def _workflow_id(request: DocumentIngestionRequest) -> str:
    """Deterministic ID so retries of the same doc dedupe at the server."""
    return f"ingest-{request.tenant_id}-{request.document_id}"


async def start_ingestion_workflow(
    request: DocumentIngestionRequest,
) -> str:
    """Kick off a :class:`DocumentIngestionWorkflow` and return its ID."""
    client = await _get_client()
    workflow_id = _workflow_id(request)
    run_id = uuid.uuid4().hex[:8]
    logger.info(
        "starting ingestion workflow wf_id=%s run_tag=%s tenant=%s",
        workflow_id,
        run_id,
        request.tenant_id,
    )
    handle = await client.start_workflow(
        DocumentIngestionWorkflow.run,
        request,
        id=workflow_id,
        task_queue=TASK_QUEUE,
    )
    return handle.id


async def get_workflow_status(workflow_id: str) -> Dict[str, Any]:
    """Return lifecycle state + stage progress for a workflow execution."""
    client = await _get_client()
    handle = client.get_workflow_handle(workflow_id)
    description = await handle.describe()
    payload: Dict[str, Any] = {
        "workflow_id": workflow_id,
        "status": _status_name(description.status),
        "run_id": description.run_id,
        "start_time": _iso(description.start_time),
        "close_time": _iso(description.close_time),
    }
    try:
        payload["progress"] = await handle.query(
            DocumentIngestionWorkflow.status
        )
    except WorkflowFailureError as exc:  # pragma: no cover - query on closed wf
        payload["progress_error"] = str(exc)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("status query failed: %s", exc)
    return payload


async def cancel_workflow(workflow_id: str) -> None:
    """Request cancellation of a running workflow."""
    client = await _get_client()
    handle = client.get_workflow_handle(workflow_id)
    await handle.cancel()
    logger.info("cancelled workflow %s", workflow_id)


def _status_name(status: Optional[WorkflowExecutionStatus]) -> str:
    if status is None:
        return "UNKNOWN"
    return status.name


def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        return value.isoformat()
    except AttributeError:
        return str(value)


def request_to_dict(request: DocumentIngestionRequest) -> Dict[str, Any]:
    """Serialise a request for logging / audit."""
    return asdict(request)
