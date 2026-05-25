"""Docling-based hi-res processor.

Docling (IBM Research) uses layout-aware models to extract complex PDFs
with high-fidelity tables, headings, and reading order. It's the most
expensive tier and is only used when the router decides the document
needs it (or the tenant opts in).
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.ingestion.types import (
    DocumentFormat,
    IngestedChunk,
    IngestedDocument,
    ProcessorResult,
)

logger = logging.getLogger(__name__)


class DoclingProcessor:
    """Wraps ``docling.document_converter.DocumentConverter``."""

    name = "docling"

    def __init__(self) -> None:
        self._converter = None

    def _converter_or_raise(self):
        if self._converter is None:
            try:
                from docling.document_converter import DocumentConverter  # type: ignore

                self._converter = DocumentConverter()
            except ImportError as exc:
                raise RuntimeError(
                    "docling is not installed. Add `docling>=1.0.0` to "
                    "services/rag/requirements.txt."
                ) from exc
        return self._converter

    def process(
        self,
        file_path: str,
        format: Optional[DocumentFormat] = None,
    ) -> ProcessorResult:
        start = time.perf_counter()
        try:
            converter = self._converter_or_raise()
            result = converter.convert(file_path)
            doc = getattr(result, "document", None)
            if doc is None:
                raise RuntimeError("docling returned no document")

            markdown = self._export_markdown(doc)
            tables = self._collect_tables(doc)
            title = self._extract_title(doc) or Path(file_path).stem
            chunks = self._chunk(doc, markdown)

            document = IngestedDocument(
                id=str(uuid.uuid4()),
                format=format or DocumentFormat.PDF,
                title=title,
                content_markdown=markdown,
                chunks=chunks,
                tables=tables,
                metadata={
                    "processor": self.name,
                    "source_path": file_path,
                    "page_count": self._page_count(doc),
                    "table_count": len(tables),
                },
            )
            return ProcessorResult(
                success=True,
                document=document,
                strategy_used=self.name,
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("docling processing failed for %s", file_path)
            return ProcessorResult(
                success=False,
                error=str(exc),
                strategy_used=self.name,
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )

    @staticmethod
    def _export_markdown(doc: Any) -> str:
        exporter = getattr(doc, "export_to_markdown", None)
        if callable(exporter):
            try:
                return exporter() or ""
            except Exception:  # pragma: no cover
                logger.exception("docling export_to_markdown failed")
        return getattr(doc, "text", "") or ""

    @staticmethod
    def _collect_tables(doc: Any) -> List[Dict[str, Any]]:
        tables: List[Dict[str, Any]] = []
        for table in getattr(doc, "tables", []) or []:
            md_fn = getattr(table, "export_to_markdown", None)
            tables.append(
                {
                    "markdown": md_fn() if callable(md_fn) else "",
                    "metadata": {
                        "page": getattr(table, "page", None),
                        "rows": getattr(table, "num_rows", None),
                        "cols": getattr(table, "num_cols", None),
                    },
                }
            )
        return tables

    @staticmethod
    def _extract_title(doc: Any) -> Optional[str]:
        meta = getattr(doc, "metadata", None)
        if meta is None:
            return None
        title = getattr(meta, "title", None)
        return title.strip() if isinstance(title, str) and title.strip() else None

    @staticmethod
    def _page_count(doc: Any) -> Optional[int]:
        pages = getattr(doc, "pages", None)
        if pages is None:
            return None
        try:
            return len(pages)
        except TypeError:
            return None

    @staticmethod
    def _chunk(doc: Any, markdown: str) -> List[IngestedChunk]:
        chunks: List[IngestedChunk] = []
        for item in getattr(doc, "texts", []) or []:
            text = getattr(item, "text", "") or ""
            if not text.strip():
                continue
            chunks.append(
                IngestedChunk(
                    id=str(uuid.uuid4()),
                    text=text,
                    page=getattr(item, "page", None),
                    section=getattr(item, "label", None),
                    metadata={"source": "docling"},
                )
            )
        if not chunks and markdown.strip():
            chunks.append(
                IngestedChunk(
                    id=str(uuid.uuid4()),
                    text=markdown.strip(),
                    metadata={"source": "docling", "strategy": "single"},
                )
            )
        return chunks
