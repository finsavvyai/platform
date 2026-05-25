"""MarkItDown-based fast processor.

Used for the cheapest ingestion tier: simple text formats (Markdown, TXT,
plain HTML) and optionally Office docs when the tenant is cost-capped.
MarkItDown is imported lazily so the ingestion package can be imported in
environments where the optional dependency isn't installed (tests, CI).
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path
from typing import List, Optional

from app.ingestion.types import (
    DocumentFormat,
    IngestedChunk,
    IngestedDocument,
    ProcessorResult,
)

logger = logging.getLogger(__name__)


class MarkItDownProcessor:
    """Thin wrapper around ``markitdown.MarkItDown()``."""

    name = "markitdown"

    def __init__(self) -> None:
        self._client = None

    def _client_or_raise(self):
        if self._client is None:
            try:
                from markitdown import MarkItDown  # type: ignore

                self._client = MarkItDown()
            except ImportError as exc:
                raise RuntimeError(
                    "markitdown is not installed. Add `markitdown>=0.1.0` to "
                    "services/rag/requirements.txt."
                ) from exc
        return self._client

    def process(
        self,
        file_path: str,
        format: Optional[DocumentFormat] = None,
    ) -> ProcessorResult:
        start = time.perf_counter()
        try:
            client = self._client_or_raise()
            result = client.convert(file_path)
            markdown = getattr(result, "text_content", "") or ""
            title = getattr(result, "title", None) or Path(file_path).stem
            doc_format = format or DocumentFormat.from_extension(
                Path(file_path).suffix
            ) or DocumentFormat.TXT

            chunks = self._chunk_by_heading(markdown)
            document = IngestedDocument(
                id=str(uuid.uuid4()),
                format=doc_format,
                title=title,
                content_markdown=markdown,
                chunks=chunks,
                metadata={
                    "processor": self.name,
                    "source_path": file_path,
                    "length_chars": len(markdown),
                },
            )
            return ProcessorResult(
                success=True,
                document=document,
                strategy_used=self.name,
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("markitdown processing failed for %s", file_path)
            return ProcessorResult(
                success=False,
                error=str(exc),
                strategy_used=self.name,
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )

    @staticmethod
    def _chunk_by_heading(markdown: str) -> List[IngestedChunk]:
        """Split markdown into chunks on ``#``/``##`` headings.

        Falls back to a single chunk for documents without headings. This is
        a deliberately simple strategy — downstream semantic chunking can
        re-chunk if needed.
        """
        if not markdown.strip():
            return []

        chunks: List[IngestedChunk] = []
        current_heading: Optional[str] = None
        buffer: List[str] = []

        def flush() -> None:
            text = "\n".join(buffer).strip()
            if text:
                chunks.append(
                    IngestedChunk(
                        id=str(uuid.uuid4()),
                        text=text,
                        section=current_heading,
                        metadata={"strategy": "heading"},
                    )
                )

        for line in markdown.splitlines():
            if line.startswith("#"):
                flush()
                buffer = [line]
                current_heading = line.lstrip("#").strip()
            else:
                buffer.append(line)
        flush()

        if not chunks:
            chunks.append(
                IngestedChunk(
                    id=str(uuid.uuid4()),
                    text=markdown.strip(),
                    metadata={"strategy": "single"},
                )
            )
        return chunks
