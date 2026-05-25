"""
FinSavvyAI Image Preprocessor

Resize, compress, fetch, and validate images before sending to vision API.

URL fetching and hashing helpers live in image_preprocessor_helpers.py.
"""

import base64
import io
import logging
from typing import Any, Dict, Tuple

from src.core.image_preprocessor_helpers import (
    decode_base64,
    fetch_image_url,
    hash_image,  # noqa: F401
    process_content_item as _process_content_item,
    validate_size,  # noqa: F401
)

logger = logging.getLogger("finsavvyai.image_preprocessor")

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("Pillow not installed - image preprocessing disabled")


class ImagePreprocessor:
    """Preprocess images before sending to vision API."""

    MAX_SIZE = 10 * 1024 * 1024

    def __init__(self, max_dimension: int = 2048, jpeg_quality: int = 85, fetch_timeout: int = 10):
        self.max_dimension = max_dimension
        self.jpeg_quality = jpeg_quality
        self.fetch_timeout = fetch_timeout

    async def preprocess(self, image_data: str) -> Dict[str, Any]:
        """Preprocess image data (base64 data-URL or raw base64)."""
        raw_bytes = decode_base64(image_data)
        original_size = len(raw_bytes)
        if not PIL_AVAILABLE:
            return {"data": image_data, "format": "unknown", "size": original_size,
                    "original_size": original_size, "compressed": False}
        image = Image.open(io.BytesIO(raw_bytes))
        fmt = (image.format or "JPEG").upper()
        if fmt not in ("JPEG", "PNG", "WEBP", "GIF"):
            fmt = "JPEG"
        image, resized = self.resize_if_needed(image)
        out_bytes = self.compress_image(image, fmt="JPEG")
        if len(out_bytes) < original_size:
            b64 = base64.b64encode(out_bytes).decode()
            return {"data": f"data:image/jpeg;base64,{b64}", "format": "jpeg",
                    "size": len(out_bytes), "original_size": original_size,
                    "dimensions": {"width": image.width, "height": image.height}, "compressed": True}
        return {"data": image_data, "format": fmt.lower(), "size": original_size,
                "original_size": original_size, "compressed": False}

    async def fetch_image_url(self, url: str) -> bytes:
        """Fetch image from URL with timeout and size limits."""
        return await fetch_image_url(url, self.fetch_timeout)

    def resize_if_needed(self, image: "Image.Image") -> Tuple["Image.Image", bool]:
        """Resize image if dimensions exceed max, preserving aspect ratio."""
        if not PIL_AVAILABLE:
            return image, False
        w, h = image.size
        if w <= self.max_dimension and h <= self.max_dimension:
            return image, False
        ratio = min(self.max_dimension / w, self.max_dimension / h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        resized = image.resize((new_w, new_h), Image.LANCZOS)
        logger.info("Resized image from %dx%d to %dx%d", w, h, new_w, new_h)
        return resized, True

    def compress_image(self, image: "Image.Image", fmt: str = "JPEG") -> bytes:
        """Compress image with quality optimization."""
        buf = io.BytesIO()
        save_kwargs: Dict[str, Any] = {"format": fmt}
        if fmt == "JPEG":
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
            save_kwargs["quality"] = self.jpeg_quality
            save_kwargs["optimize"] = True
        elif fmt == "PNG":
            save_kwargs["optimize"] = True
        image.save(buf, **save_kwargs)
        return buf.getvalue()

    def validate_size(self, data: bytes) -> bool:
        """Check if image data is within the size limit."""
        return len(data) <= self.MAX_SIZE

    async def process_content_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single content item from OpenAI message format."""
        return await _process_content_item(item, self.preprocess, self.fetch_image_url)

    # Keep static method aliases for backward compatibility
    _decode_base64 = staticmethod(decode_base64)
    hash_image = staticmethod(hash_image)
