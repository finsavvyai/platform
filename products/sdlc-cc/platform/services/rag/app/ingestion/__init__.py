"""Tiered document ingestion pipeline.

Implements a multi-tier document ingestion strategy using:

- MarkItDown: fast path for simple/text-first formats (Markdown, HTML, TXT).
- Unstructured.io: standard path for common enterprise formats (DOCX, PPTX,
  XLSX, simple PDF, EML, images with OCR).
- Docling: hi-res path for complex PDFs with tables and layout that require
  IBM Research's layout models.

This package is *additive*: the existing Node.js ``services/document-processor``
service continues to function. New tenants (or tenants opting in via config)
can route ingestion through this pipeline. Fallback to a lower tier is
automatic if the primary processor fails.
"""

from app.ingestion.types import (
    DocumentFormat,
    IngestedChunk,
    IngestedDocument,
    ProcessingStrategy,
    ProcessorResult,
)
from app.ingestion.router import IngestionRouter
from app.ingestion.service import IngestionService

__all__ = [
    "DocumentFormat",
    "ProcessingStrategy",
    "IngestedDocument",
    "IngestedChunk",
    "ProcessorResult",
    "IngestionRouter",
    "IngestionService",
]
