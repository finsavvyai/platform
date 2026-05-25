"""
FinSavvyAI Document Processor

PDF-to-image conversion and OCR text extraction via OpenClaw vision.

PDF conversion and batch processing live in document_pdf.py.
"""

import logging
import time
from typing import Any, Dict, List, Optional

from src.core.document_pdf import (
    PYMUPDF_AVAILABLE,
    batch_process_pages,
    pdf_to_images,
)

logger = logging.getLogger("finsavvyai.document_processor")


class DocumentProcessor:
    """Process documents (PDF, images) for OCR text extraction.

    Uses PyMuPDF for PDF-to-image conversion and OpenClaw vision for OCR.
    """

    OCR_PROMPT = (
        "Extract all text from this image exactly as it appears. "
        "Return only the extracted text, preserving the original "
        "layout and formatting as much as possible."
    )

    def __init__(self, openclaw_client, preprocessor=None, cache=None,
                 rate_limiter=None, dpi: int = 200, max_pages: int = 50):
        self.openclaw = openclaw_client
        self.preprocessor = preprocessor
        self.cache = cache
        self.rate_limiter = rate_limiter
        self.dpi = dpi
        self.max_pages = max_pages

    async def process_document(self, document_bytes: bytes, model: str = "default",
                               pages: Optional[List[int]] = None, fmt: str = "text") -> Dict[str, Any]:
        """Process a PDF document and extract text from all pages."""
        start = time.monotonic()
        if not PYMUPDF_AVAILABLE:
            return {"error": "PyMuPDF not installed", "pages": [],
                    "total_pages": 0, "combined_text": "", "duration": 0}

        images = await self.pdf_to_images(document_bytes, pages=pages)
        results = await self.batch_process_pages(images, model=model, fmt=fmt)
        combined = "\n\n".join(r["text"] for r in results if r.get("text"))
        return {"pages": results, "total_pages": len(results),
                "combined_text": combined, "duration": round(time.monotonic() - start, 2)}

    async def pdf_to_images(self, pdf_bytes: bytes,
                            pages: Optional[List[int]] = None) -> List[Dict[str, Any]]:
        """Convert PDF pages to base64-encoded JPEG images."""
        return await pdf_to_images(pdf_bytes, self.preprocessor, self.dpi, self.max_pages, pages)

    async def extract_text_from_image(self, image_data: str, model: str = "default",
                                      prompt: Optional[str] = None) -> Dict[str, Any]:
        """Extract text from a single image via OpenClaw vision."""
        start = time.monotonic()
        ocr_prompt = prompt or self.OCR_PROMPT
        messages = [{"role": "user", "content": [
            {"type": "text", "text": ocr_prompt},
            {"type": "image_url", "image_url": {"url": image_data}},
        ]}]
        if self.cache:
            cached = await self.cache.get(image_data, model, messages)
            if cached:
                cached["duration"] = round(time.monotonic() - start, 3)
                return cached
        if self.rate_limiter:
            async with self.rate_limiter.throttle():
                result = await self._call_vision(ocr_prompt, image_data)
        else:
            result = await self._call_vision(ocr_prompt, image_data)
        text = self._extract_text_from_response(result)
        duration = round(time.monotonic() - start, 3)
        if self.cache:
            await self.cache.set(image_data, model, messages, text)
        return {"text": text, "duration": duration, "cached": False}

    async def batch_process_pages(self, page_images: List[Dict[str, Any]], model: str = "default",
                                  max_concurrent: int = 3, fmt: str = "text") -> List[Dict[str, Any]]:
        """Process multiple page images concurrently."""
        return await batch_process_pages(
            page_images, self.extract_text_from_image, self.OCR_PROMPT, model, max_concurrent, fmt)

    async def _call_vision(self, prompt: str, image_data: str) -> Dict[str, Any]:
        """Call OpenClaw vision API."""
        return await self.openclaw.complete_vision(messages=[{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image_data}},
        ]}])

    @staticmethod
    def _extract_text_from_response(response: Dict[str, Any]) -> str:
        """Extract text content from OpenClaw API response."""
        if isinstance(response, dict):
            choices = response.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            if "text" in response:
                return response["text"]
        return str(response)
