"""
FinSavvyAI Image Preprocessor Helpers

URL fetching, size validation, base64 decoding, and image hashing.
"""

import base64
import hashlib
import logging
import re
from typing import Any, Dict
from urllib.parse import urlparse

import aiohttp

logger = logging.getLogger("finsavvyai.image_preprocessor")

MAX_SIZE = 10 * 1024 * 1024  # 10MB
_BLOCKED_HOSTS = re.compile(
    r"^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|0\.0\.0\.0|::1|\[::1\])"
)


async def fetch_image_url(url: str, fetch_timeout: int = 10) -> bytes:
    """Fetch image from URL with timeout and size limits."""
    parsed = urlparse(url)
    if not parsed.scheme or parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid URL scheme: {parsed.scheme}")
    if _BLOCKED_HOSTS.match(parsed.hostname or ""):
        raise ValueError(f"Blocked host: {parsed.hostname}")

    timeout = aiohttp.ClientTimeout(total=fetch_timeout)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(url) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Failed to fetch image: HTTP {resp.status}")
            content_length = resp.content_length or 0
            if content_length > MAX_SIZE:
                raise ValueError(f"Image too large: {content_length} bytes")
            data = await resp.read()
            if len(data) > MAX_SIZE:
                raise ValueError(f"Image too large: {len(data)} bytes")
            return data


def validate_size(data: bytes) -> bool:
    """Check if image data is within the size limit."""
    return len(data) <= MAX_SIZE


def decode_base64(data_url: str) -> bytes:
    """Decode base64 data from a data URL or raw base64 string."""
    if data_url.startswith("data:"):
        _, b64 = data_url.split(",", 1)
    else:
        b64 = data_url
    return base64.b64decode(b64)


def hash_image(image_data: str) -> str:
    """Compute SHA256 hash of raw image bytes (for cache keys)."""
    if image_data.startswith("data:"):
        _, b64 = image_data.split(",", 1)
    else:
        b64 = image_data
    raw = base64.b64decode(b64)
    return hashlib.sha256(raw).hexdigest()


async def process_content_item(
    item: Dict[str, Any], preprocess_fn, fetch_fn
) -> Dict[str, Any]:
    """Process a single content item from OpenAI message format.

    Handles both base64 data URLs and http/https URLs.
    """
    item_type = item.get("type", "")

    if item_type == "image_url":
        url = item.get("image_url", {}).get("url", "")
        if url.startswith("data:image"):
            result = await preprocess_fn(url)
            return {"type": "image_url", "image_url": {"url": result["data"]}}
        elif url.startswith(("http://", "https://")):
            image_bytes = await fetch_fn(url)
            b64 = base64.b64encode(image_bytes).decode()
            data_url = f"data:image/jpeg;base64,{b64}"
            result = await preprocess_fn(data_url)
            return {"type": "image_url", "image_url": {"url": result["data"]}}

    if item_type == "image":
        source = item.get("source", {})
        if source.get("type") == "url":
            image_bytes = await fetch_fn(source["url"])
            b64 = base64.b64encode(image_bytes).decode()
            data_url = f"data:image/jpeg;base64,{b64}"
            result = await preprocess_fn(data_url)
            return {
                "type": "image",
                "source": {
                    "type": "base64", "media_type": "image/jpeg",
                    "data": result["data"].split(",", 1)[-1],
                },
            }

    return item
