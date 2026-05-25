"""Durable document ingestion workflow.

Pipeline stages (each a Temporal activity with its own retry policy):

    download -> extract -> chunk -> embed -> index

Why a workflow: Bull queue retries were fragile because they lived in the
worker process memory. Temporal persists workflow state to its history store,
so a worker restart mid-embed resumes where it left off instead of losing
the job. The workflow body is deterministic — all I/O happens in activities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Dict, List, Optional

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from app.workflows import activities


@dataclass
class DocumentIngestionRequest:
    """Input payload for :class:`DocumentIngestionWorkflow`."""

    file_url: str
    tenant_id: str
    document_id: str
    format_hint: Optional[str] = None
    strategy: str = "auto"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DocumentIngestionResult:
    """Terminal output recorded in workflow history."""

    document_id: str
    tenant_id: str
    chunk_count: int
    strategy_used: Optional[str]
    index_location: str


# Retry policies per stage. Network-bound stages (download, embed) get more
# attempts than CPU-bound ones (extract, chunk) because transient 5xx and
# rate-limits are expected; non-retryable errors short-circuit immediately.
_NETWORK_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=2),
    maximum_interval=timedelta(seconds=60),
    backoff_coefficient=2.0,
    maximum_attempts=8,
    non_retryable_error_types=["ValueError", "PermissionError"],
)
_CPU_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=30),
    backoff_coefficient=2.0,
    maximum_attempts=4,
    non_retryable_error_types=["ValueError", "UnsupportedFormatError"],
)
_INDEX_RETRY = RetryPolicy(
    initial_interval=timedelta(seconds=2),
    maximum_interval=timedelta(minutes=2),
    backoff_coefficient=2.0,
    maximum_attempts=6,
    non_retryable_error_types=["IntegrityError"],
)


@workflow.defn(name="DocumentIngestionWorkflow")
class DocumentIngestionWorkflow:
    """Durable pipeline: download -> extract -> chunk -> embed -> index."""

    def __init__(self) -> None:
        self._stage: str = "pending"
        self._chunks_done: int = 0

    @workflow.query
    def status(self) -> Dict[str, Any]:
        """Query current stage + progress without resuming history."""
        return {"stage": self._stage, "chunks_done": self._chunks_done}

    @workflow.run
    async def run(
        self, request: DocumentIngestionRequest
    ) -> DocumentIngestionResult:
        self._stage = "download"
        local_path: str = await workflow.execute_activity(
            activities.download_document,
            request.file_url,
            start_to_close_timeout=timedelta(minutes=10),
            heartbeat_timeout=timedelta(seconds=30),
            retry_policy=_NETWORK_RETRY,
        )

        self._stage = "extract"
        extracted: Dict[str, Any] = await workflow.execute_activity(
            activities.extract_content,
            args=[local_path, request.strategy, request.tenant_id],
            start_to_close_timeout=timedelta(minutes=15),
            heartbeat_timeout=timedelta(minutes=2),
            retry_policy=_CPU_RETRY,
        )

        self._stage = "chunk"
        chunks: List[Dict[str, Any]] = await workflow.execute_activity(
            activities.chunk_document,
            extracted,
            start_to_close_timeout=timedelta(minutes=5),
            heartbeat_timeout=timedelta(seconds=30),
            retry_policy=_CPU_RETRY,
        )
        self._chunks_done = 0

        self._stage = "embed"
        embedded: List[Dict[str, Any]] = await workflow.execute_activity(
            activities.embed_chunks,
            chunks,
            start_to_close_timeout=timedelta(minutes=20),
            heartbeat_timeout=timedelta(minutes=1),
            retry_policy=_NETWORK_RETRY,
        )
        self._chunks_done = len(embedded)

        self._stage = "index"
        location: str = await workflow.execute_activity(
            activities.index_document,
            args=[embedded, request.tenant_id, request.document_id],
            start_to_close_timeout=timedelta(minutes=10),
            heartbeat_timeout=timedelta(seconds=30),
            retry_policy=_INDEX_RETRY,
        )

        self._stage = "completed"
        return DocumentIngestionResult(
            document_id=request.document_id,
            tenant_id=request.tenant_id,
            chunk_count=len(embedded),
            strategy_used=extracted.get("strategy_used"),
            index_location=location,
        )
