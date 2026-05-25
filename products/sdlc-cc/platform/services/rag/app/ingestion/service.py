"""Top-level ingestion orchestration.

``IngestionService`` wires together the router and the three processor tiers.
It handles:

- Format detection from file extension when no hint is supplied.
- Per-tenant strategy overrides via :class:`RouterConfig`.
- Automatic fallback to the next tier when the primary processor fails.
- Metrics emission (via ``@finsavvyai/monitor`` counters when available).

The service is intentionally processor-agnostic: processors are looked up
by name and instantiated lazily so environments without (for example)
docling installed can still use the fast / standard tiers.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app.ingestion.markitdown_processor import MarkItDownProcessor
from app.ingestion.docling_processor import DoclingProcessor
from app.ingestion.router import (
    DOCLING,
    MARKITDOWN,
    UNSTRUCTURED,
    IngestionRouter,
    RouterConfig,
)
from app.ingestion.types import (
    DocumentFormat,
    ProcessingStrategy,
    ProcessorResult,
)
from app.ingestion.unstructured_processor import UnstructuredProcessor

logger = logging.getLogger(__name__)

# Fallback order when a tier fails. First entry is always the router's pick;
# remaining entries are tried in order until one succeeds.
_FALLBACK_ORDER: Dict[str, List[str]] = {
    DOCLING: [DOCLING, UNSTRUCTURED, MARKITDOWN],
    UNSTRUCTURED: [UNSTRUCTURED, MARKITDOWN],
    MARKITDOWN: [MARKITDOWN, UNSTRUCTURED],
}


def _noop_counter(name: str, value: int = 1, **tags: str) -> None:
    """Default metrics sink used when @finsavvyai/monitor is unavailable."""


def _resolve_counter() -> Callable[..., None]:
    try:
        from monitor import counter  # type: ignore

        return counter  # pragma: no cover - optional dep
    except ImportError:
        return _noop_counter


class IngestionService:
    """Orchestrates routing, processing, and fallback."""

    def __init__(
        self,
        router: Optional[IngestionRouter] = None,
        config: Optional[RouterConfig] = None,
    ) -> None:
        self.router = router or IngestionRouter(config=config)
        self._processors: Dict[str, object] = {}
        self._counter = _resolve_counter()

    def ingest(
        self,
        file_path: str,
        format_hint: Optional[DocumentFormat] = None,
        strategy: ProcessingStrategy = ProcessingStrategy.AUTO,
        tenant_id: Optional[str] = None,
    ) -> ProcessorResult:
        """Process ``file_path`` through the best-available tier."""
        started = time.perf_counter()
        doc_format = format_hint or DocumentFormat.from_extension(
            Path(file_path).suffix
        )
        if doc_format is None:
            return ProcessorResult(
                success=False,
                error=f"unsupported format for path: {file_path}",
                processing_time_ms=(time.perf_counter() - started) * 1000,
            )

        primary = self.router.route(
            file_path=file_path,
            format=doc_format,
            strategy=strategy,
            tenant_id=tenant_id,
        )
        tags = {"tenant": tenant_id or "anon", "format": doc_format.value}
        self._counter("ingestion.requests", 1, **tags)

        last_error: Optional[str] = None
        for tier in _FALLBACK_ORDER.get(primary, [primary]):
            processor = self._get(tier)
            if processor is None:
                continue
            result = self._run(processor, file_path, doc_format)
            if result.success:
                self._counter(
                    "ingestion.success", 1, processor=tier, **tags
                )
                result.processing_time_ms = (
                    time.perf_counter() - started
                ) * 1000
                return result
            last_error = result.error
            logger.warning(
                "processor %s failed for %s (%s); trying next tier",
                tier,
                file_path,
                result.error,
            )
            self._counter("ingestion.fallback", 1, processor=tier, **tags)

        self._counter("ingestion.failure", 1, **tags)
        return ProcessorResult(
            success=False,
            error=last_error or "all processors failed",
            strategy_used=primary,
            processing_time_ms=(time.perf_counter() - started) * 1000,
        )

    def _get(self, name: str):
        if name in self._processors:
            return self._processors[name]
        try:
            if name == MARKITDOWN:
                self._processors[name] = MarkItDownProcessor()
            elif name == UNSTRUCTURED:
                self._processors[name] = UnstructuredProcessor()
            elif name == DOCLING:
                self._processors[name] = DoclingProcessor()
            else:
                return None
        except Exception:  # pragma: no cover - defensive
            logger.exception("failed to initialise processor %s", name)
            return None
        return self._processors.get(name)

    @staticmethod
    def _run(processor, file_path: str, doc_format: DocumentFormat) -> ProcessorResult:
        if isinstance(processor, UnstructuredProcessor):
            strategy = (
                "hi_res" if doc_format == DocumentFormat.PDF else "auto"
            )
            return processor.process(
                file_path, strategy=strategy, format=doc_format
            )
        return processor.process(file_path, format=doc_format)  # type: ignore[attr-defined]
