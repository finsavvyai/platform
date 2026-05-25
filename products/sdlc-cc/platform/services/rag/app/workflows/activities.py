"""Temporal activities wrapping the existing ``IngestionService``.

Activities are the *only* place side effects live. They call into the
already-built tiered ingestion pipeline (``app.ingestion.service``) rather
than reimplementing processing logic. Each activity heartbeats so Temporal
can detect a stuck worker and reassign the work to a healthy one.
"""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from temporalio import activity

from app.ingestion.service import IngestionService
from app.ingestion.types import ProcessingStrategy

logger = logging.getLogger(__name__)

_service: Optional[IngestionService] = None


def _get_service() -> IngestionService:
    """Lazy singleton — activities are sync-registered but reused across runs."""
    global _service
    if _service is None:
        _service = IngestionService()
    return _service


@activity.defn
async def download_document(url: str) -> str:
    """Stream ``url`` to a temp file and return its path.

    Heartbeats every chunk so a stalled download is retried by Temporal.
    """
    parsed = urlparse(url)
    suffix = os.path.splitext(parsed.path)[1] or ".bin"
    fd, path = tempfile.mkstemp(prefix="sdlc-ingest-", suffix=suffix)
    os.close(fd)

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            with open(path, "wb") as sink:
                async for chunk in response.aiter_bytes(chunk_size=64 * 1024):
                    sink.write(chunk)
                    activity.heartbeat(len(chunk))
    logger.info("downloaded %s -> %s", url, path)
    return path


@activity.defn
async def extract_content(
    path: str, strategy: str, tenant_id: str
) -> Dict[str, Any]:
    """Run the tiered ingestion pipeline on ``path``.

    Wraps :class:`IngestionService` so the workflow stays agnostic of the
    processor tier actually used (MarkItDown / Unstructured / Docling).
    """
    activity.heartbeat("extract:start")
    svc = _get_service()
    result = await asyncio.to_thread(
        svc.ingest,
        file_path=path,
        strategy=ProcessingStrategy(strategy),
        tenant_id=tenant_id,
    )
    if not result.success or result.document is None:
        raise RuntimeError(f"ingestion failed: {result.error}")

    doc = result.document
    activity.heartbeat("extract:done")
    return {
        "id": doc.id,
        "title": doc.title,
        "format": doc.format.value,
        "content_markdown": doc.content_markdown,
        "raw_chunks": [
            {"id": c.id, "text": c.text, "page": c.page, "section": c.section}
            for c in doc.chunks
        ],
        "strategy_used": result.strategy_used,
    }


@activity.defn
async def chunk_document(content: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Produce indexing chunks from extracted content.

    Processors already emit ``raw_chunks``; if absent we fall back to fixed
    window slicing over ``content_markdown``. Keeping this as its own activity
    isolates chunking changes from extraction retries.
    """
    raw = content.get("raw_chunks") or []
    if raw:
        activity.heartbeat(f"chunks:{len(raw)}")
        return raw

    text = content.get("content_markdown", "")
    window = 1200
    stride = 1000
    chunks: List[Dict[str, Any]] = []
    for idx, start in enumerate(range(0, len(text), stride)):
        chunks.append(
            {
                "id": f"{content.get('id', 'doc')}-{idx}",
                "text": text[start : start + window],
                "page": None,
                "section": None,
            }
        )
        if idx % 16 == 0:
            activity.heartbeat(f"chunks:{idx}")
    return chunks


@activity.defn
async def embed_chunks(
    chunks: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Generate embeddings for each chunk.

    Calls the embedding service over HTTP so this activity works in any
    worker, not just the one holding a GPU. Heartbeats per batch.
    """
    endpoint = os.getenv("EMBEDDING_ENDPOINT", "http://embedding:8000/embed")
    batch_size = int(os.getenv("EMBEDDING_BATCH", "16"))
    out: List[Dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        for start in range(0, len(chunks), batch_size):
            batch = chunks[start : start + batch_size]
            response = await client.post(
                endpoint, json={"texts": [c["text"] for c in batch]}
            )
            response.raise_for_status()
            vectors = response.json().get("embeddings", [])
            for chunk, vector in zip(batch, vectors):
                out.append({**chunk, "embedding": vector})
            activity.heartbeat(f"embed:{start + len(batch)}/{len(chunks)}")
    return out


@activity.defn
async def index_document(
    chunks: List[Dict[str, Any]], tenant_id: str, document_id: str
) -> str:
    """Persist embedded chunks into pgvector via the RAG index API.

    Returns a storage locator (table + document id) that the workflow records
    in its result for observability and downstream audit.
    """
    endpoint = os.getenv("INDEX_ENDPOINT", "http://rag:8000/internal/index")
    activity.heartbeat("index:start")
    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
        response = await client.post(
            endpoint,
            json={
                "tenant_id": tenant_id,
                "document_id": document_id,
                "chunks": chunks,
            },
            headers={"x-tenant-id": tenant_id},
        )
        response.raise_for_status()
    activity.heartbeat("index:done")
    return f"embeddings/{tenant_id}/{document_id}"
