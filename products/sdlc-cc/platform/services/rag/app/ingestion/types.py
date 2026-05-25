"""Shared types for the tiered document ingestion pipeline.

Keeps all processors aligned on a single contract: inputs are file paths,
outputs are :class:`ProcessorResult` wrapping an :class:`IngestedDocument`.
Downstream RAG chunking, embedding, and indexing consume these structures.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class DocumentFormat(str, Enum):
    """Supported document formats for tiered ingestion."""

    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    XLSX = "xlsx"
    HTML = "html"
    EML = "eml"
    TXT = "txt"
    MD = "md"
    IMAGE = "image"

    @classmethod
    def from_extension(cls, ext: str) -> Optional["DocumentFormat"]:
        """Map a file extension (with or without leading dot) to a format."""
        ext = ext.lower().lstrip(".")
        mapping: Dict[str, DocumentFormat] = {
            "pdf": cls.PDF,
            "docx": cls.DOCX,
            "doc": cls.DOCX,
            "pptx": cls.PPTX,
            "ppt": cls.PPTX,
            "xlsx": cls.XLSX,
            "xls": cls.XLSX,
            "html": cls.HTML,
            "htm": cls.HTML,
            "eml": cls.EML,
            "txt": cls.TXT,
            "md": cls.MD,
            "markdown": cls.MD,
            "png": cls.IMAGE,
            "jpg": cls.IMAGE,
            "jpeg": cls.IMAGE,
            "tiff": cls.IMAGE,
            "bmp": cls.IMAGE,
        }
        return mapping.get(ext)


class ProcessingStrategy(str, Enum):
    """How aggressively to process the document.

    - FAST: cheapest path, prefer MarkItDown / native parsers.
    - HI_RES: highest fidelity, prefer Docling layout models.
    - AUTO: let the router decide based on format + heuristics.
    """

    FAST = "fast"
    HI_RES = "hi_res"
    AUTO = "auto"


@dataclass
class IngestedChunk:
    """A single retrievable chunk of an ingested document."""

    id: str
    text: str
    page: Optional[int] = None
    section: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class IngestedDocument:
    """Normalized representation of an ingested document.

    All processors emit this structure so RAG indexing remains format-agnostic.
    """

    id: str
    format: DocumentFormat
    title: str
    content_markdown: str
    chunks: List[IngestedChunk] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    images: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ProcessorResult:
    """Result wrapper returned by every processor.

    ``success`` indicates whether the processor produced a usable document.
    ``strategy_used`` records which tier actually handled the file (useful
    when the service fell back from hi-res to fast).
    """

    success: bool
    document: Optional[IngestedDocument] = None
    error: Optional[str] = None
    strategy_used: Optional[str] = None
    processing_time_ms: float = 0.0
