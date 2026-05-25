"""Unstructured.io-based standard processor.

Handles the bulk of enterprise formats: DOCX, PPTX, XLSX, EML, HTML, simple
PDFs, and OCR for images. Preserves tables as Markdown where possible so
RAG chunking retains structural signal.
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


class UnstructuredProcessor:
    """Wraps ``unstructured.partition.auto.partition``."""

    name = "unstructured"

    def process(
        self,
        file_path: str,
        strategy: str = "auto",
        format: Optional[DocumentFormat] = None,
    ) -> ProcessorResult:
        start = time.perf_counter()
        try:
            partition = self._load_partition()
            elements = partition(filename=file_path, strategy=strategy)
            title = self._extract_title(elements) or Path(file_path).stem

            tables: List[Dict[str, Any]] = []
            images: List[Dict[str, Any]] = []
            chunks: List[IngestedChunk] = []
            markdown_parts: List[str] = []

            for element in elements:
                el_type = type(element).__name__
                text = getattr(element, "text", "") or ""
                metadata = self._element_metadata(element)

                if el_type == "Table":
                    table_md = self._table_to_markdown(element)
                    tables.append({"markdown": table_md, "metadata": metadata})
                    markdown_parts.append(table_md)
                    chunks.append(
                        IngestedChunk(
                            id=str(uuid.uuid4()),
                            text=table_md,
                            page=metadata.get("page_number"),
                            section="table",
                            metadata={"element_type": "Table", **metadata},
                        )
                    )
                elif el_type == "Image":
                    images.append({"metadata": metadata, "text": text})
                    if text:
                        markdown_parts.append(f"![image]({text})")
                elif text.strip():
                    markdown_parts.append(text)
                    chunks.append(
                        IngestedChunk(
                            id=str(uuid.uuid4()),
                            text=text,
                            page=metadata.get("page_number"),
                            section=el_type,
                            metadata={"element_type": el_type, **metadata},
                        )
                    )

            markdown = "\n\n".join(markdown_parts)
            doc_format = format or DocumentFormat.from_extension(
                Path(file_path).suffix
            ) or DocumentFormat.TXT

            document = IngestedDocument(
                id=str(uuid.uuid4()),
                format=doc_format,
                title=title,
                content_markdown=markdown,
                chunks=chunks,
                tables=tables,
                images=images,
                metadata={
                    "processor": self.name,
                    "strategy": strategy,
                    "source_path": file_path,
                    "element_count": len(elements),
                },
            )
            return ProcessorResult(
                success=True,
                document=document,
                strategy_used=f"{self.name}:{strategy}",
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("unstructured processing failed for %s", file_path)
            return ProcessorResult(
                success=False,
                error=str(exc),
                strategy_used=f"{self.name}:{strategy}",
                processing_time_ms=(time.perf_counter() - start) * 1000,
            )

    @staticmethod
    def _load_partition():
        try:
            from unstructured.partition.auto import partition  # type: ignore

            return partition
        except ImportError as exc:
            raise RuntimeError(
                "unstructured is not installed. Add `unstructured>=0.14.0` to "
                "services/rag/requirements.txt."
            ) from exc

    @staticmethod
    def _extract_title(elements: List[Any]) -> Optional[str]:
        for element in elements:
            if type(element).__name__ == "Title":
                text = getattr(element, "text", "")
                if text:
                    return text.strip()
        return None

    @staticmethod
    def _element_metadata(element: Any) -> Dict[str, Any]:
        meta = getattr(element, "metadata", None)
        if meta is None:
            return {}
        to_dict = getattr(meta, "to_dict", None)
        if callable(to_dict):
            try:
                return {k: v for k, v in to_dict().items() if v is not None}
            except Exception:
                return {}
        return {}

    @staticmethod
    def _table_to_markdown(element: Any) -> str:
        meta = getattr(element, "metadata", None)
        html = getattr(meta, "text_as_html", None) if meta else None
        if html:
            return f"<!-- table -->\n{html}"
        return getattr(element, "text", "") or ""
