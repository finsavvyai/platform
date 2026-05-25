"""
FinSavvyAI Document PDF Processing

PDF-to-image conversion and batch page processing.
"""

import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.document_processor")

try:
    import fitz  # PyMuPDF

    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    logger.warning("PyMuPDF not installed - PDF processing disabled")


async def pdf_to_images(
    pdf_bytes: bytes,
    preprocessor: Optional[Any] = None,
    dpi: int = 200,
    max_pages: int = 50,
    pages: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Convert PDF pages to base64-encoded JPEG images.

    Args:
        pdf_bytes: Raw PDF file content.
        preprocessor: Optional image preprocessor.
        dpi: Resolution for rendering.
        max_pages: Maximum pages to process.
        pages: 1-indexed page numbers. None = all.

    Returns list of {"page_number": int, "image_data": str}.
    """
    if not PYMUPDF_AVAILABLE:
        raise RuntimeError("PyMuPDF is required for PDF processing")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    results: List[Dict[str, Any]] = []

    page_indices = list(range(total_pages))
    if pages:
        page_indices = [p - 1 for p in pages if 0 < p <= total_pages]

    for idx in page_indices[:max_pages]:
        page = doc[idx]
        zoom = dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("jpeg")

        if preprocessor:
            b64 = base64.b64encode(img_bytes).decode()
            data_url = f"data:image/jpeg;base64,{b64}"
            preprocessed = await preprocessor.preprocess(data_url)
            data_url = preprocessed["data"]
        else:
            b64 = base64.b64encode(img_bytes).decode()
            data_url = f"data:image/jpeg;base64,{b64}"

        results.append({"page_number": idx + 1, "image_data": data_url})

    doc.close()
    logger.info("Converted %d/%d PDF pages to images", len(results), total_pages)
    return results


async def batch_process_pages(
    page_images: List[Dict[str, Any]],
    extract_fn: Any,
    ocr_prompt: str,
    model: str = "default",
    max_concurrent: int = 3,
    fmt: str = "text",
) -> List[Dict[str, Any]]:
    """Process multiple page images concurrently.

    Args:
        page_images: List of dicts with page_number and image_data.
        extract_fn: Async function(image_data, model, prompt) -> Dict.
        ocr_prompt: Base OCR prompt text.
        model: Vision model to use.
        max_concurrent: Max parallel requests.
        fmt: Output format - text, markdown, or json.
    """
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _process_one(page_info: Dict) -> Dict[str, Any]:
        async with semaphore:
            prompt = ocr_prompt
            if fmt == "markdown":
                prompt += " Format the output as Markdown."
            elif fmt == "json":
                prompt += (
                    " Return the text as a JSON object with "
                    "fields: title, body, metadata."
                )
            result = await extract_fn(page_info["image_data"], model=model, prompt=prompt)
            return {
                "page_number": page_info["page_number"],
                "text": result.get("text", ""),
                "duration": result.get("duration", 0),
                "cached": result.get("cached", False),
            }

    tasks = [_process_one(p) for p in page_images]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    processed: List[Dict[str, Any]] = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.error("Page %d OCR failed: %s", page_images[i]["page_number"], r)
            processed.append({
                "page_number": page_images[i]["page_number"],
                "text": "", "duration": 0, "error": str(r),
            })
        else:
            processed.append(r)

    return sorted(processed, key=lambda x: x["page_number"])
