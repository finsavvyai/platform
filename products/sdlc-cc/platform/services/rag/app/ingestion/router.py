"""Routing logic for the tiered ingestion pipeline.

The router maps ``(format, strategy, heuristics)`` to a processor name.
Processor names are stable strings consumed by :class:`IngestionService` to
look up the concrete implementation. Keeping routing declarative makes it
easy to unit test without pulling in heavy ML dependencies.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Set

from app.ingestion.types import DocumentFormat, ProcessingStrategy

logger = logging.getLogger(__name__)

# Processor name constants (kept as strings so the router has no runtime
# dependency on the processor implementations themselves).
MARKITDOWN = "markitdown"
UNSTRUCTURED = "unstructured"
DOCLING = "docling"


@dataclass
class RouterConfig:
    """Per-deployment routing configuration.

    ``tenants_hi_res``: tenants forced onto the hi-res tier for PDFs.
    ``tenants_fast_only``: tenants restricted to the fast tier (cost control).
    ``disabled_processors``: processors to skip entirely (e.g. docling not
    installed in a given environment).
    """

    tenants_hi_res: Set[str] = field(default_factory=set)
    tenants_fast_only: Set[str] = field(default_factory=set)
    disabled_processors: Set[str] = field(default_factory=set)
    default_pdf_strategy: ProcessingStrategy = ProcessingStrategy.AUTO


class IngestionRouter:
    """Picks the appropriate processor for a file."""

    def __init__(self, config: Optional[RouterConfig] = None) -> None:
        self.config = config or RouterConfig()

    def route(
        self,
        file_path: str,
        format: DocumentFormat,
        strategy: ProcessingStrategy = ProcessingStrategy.AUTO,
        tenant_id: Optional[str] = None,
    ) -> str:
        """Return the processor name that should handle this file."""
        effective_strategy = self._resolve_strategy(strategy, tenant_id)

        # Text-first formats — MarkItDown is the fastest path.
        if format in (DocumentFormat.MD, DocumentFormat.TXT):
            return self._pick(MARKITDOWN, fallback=UNSTRUCTURED)

        if format == DocumentFormat.HTML:
            if effective_strategy == ProcessingStrategy.FAST:
                return self._pick(MARKITDOWN, fallback=UNSTRUCTURED)
            return self._pick(UNSTRUCTURED, fallback=MARKITDOWN)

        # Office formats — Unstructured handles DOCX/PPTX/XLSX/EML well.
        if format in (
            DocumentFormat.DOCX,
            DocumentFormat.PPTX,
            DocumentFormat.XLSX,
            DocumentFormat.EML,
        ):
            if effective_strategy == ProcessingStrategy.FAST:
                return self._pick(MARKITDOWN, fallback=UNSTRUCTURED)
            return self._pick(UNSTRUCTURED, fallback=MARKITDOWN)

        # PDFs — the interesting case. Docling for hi-res, Unstructured otherwise.
        if format == DocumentFormat.PDF:
            if effective_strategy == ProcessingStrategy.HI_RES:
                return self._pick(DOCLING, fallback=UNSTRUCTURED)
            if effective_strategy == ProcessingStrategy.FAST:
                return self._pick(UNSTRUCTURED, fallback=MARKITDOWN)
            # AUTO: size-based heuristic — large PDFs likely have layouts/tables.
            if self._looks_complex(file_path):
                return self._pick(DOCLING, fallback=UNSTRUCTURED)
            return self._pick(UNSTRUCTURED, fallback=DOCLING)

        # Images always go through Unstructured's OCR pipeline.
        if format == DocumentFormat.IMAGE:
            return self._pick(UNSTRUCTURED, fallback=MARKITDOWN)

        return self._pick(UNSTRUCTURED, fallback=MARKITDOWN)

    def _resolve_strategy(
        self, strategy: ProcessingStrategy, tenant_id: Optional[str]
    ) -> ProcessingStrategy:
        if tenant_id and tenant_id in self.config.tenants_fast_only:
            return ProcessingStrategy.FAST
        if tenant_id and tenant_id in self.config.tenants_hi_res:
            return ProcessingStrategy.HI_RES
        if strategy == ProcessingStrategy.AUTO:
            return self.config.default_pdf_strategy
        return strategy

    def _pick(self, primary: str, fallback: str) -> str:
        if primary not in self.config.disabled_processors:
            return primary
        logger.warning("primary processor %s disabled, using %s", primary, fallback)
        return fallback

    @staticmethod
    def _looks_complex(file_path: str) -> bool:
        """Cheap heuristic: PDFs >2MB are more likely to have layouts/tables."""
        try:
            size = Path(file_path).stat().st_size
            return size > 2 * 1024 * 1024
        except OSError:
            return False
