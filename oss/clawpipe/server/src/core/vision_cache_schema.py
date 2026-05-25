"""
FinSavvyAI Vision Cache Schema and Hashing

SQL schema definitions and hashing helpers for the vision cache.
"""

import base64
import hashlib
from typing import Any, Dict, List


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS vision_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at REAL NOT NULL,
    accessed_at REAL NOT NULL,
    access_count INTEGER DEFAULT 1
);
"""

CREATE_INDEX_SQL = """
CREATE INDEX IF NOT EXISTS idx_cache_lookup
    ON vision_cache (image_hash, model, prompt_hash);
"""


def hash_image(image_data: str) -> str:
    """SHA-256 hash of raw image bytes."""
    if image_data.startswith("data:"):
        _, raw_b64 = image_data.split(",", 1)
    else:
        raw_b64 = image_data
    try:
        raw_bytes = base64.b64decode(raw_b64)
    except Exception:
        raw_bytes = image_data.encode()
    return hashlib.sha256(raw_bytes).hexdigest()


def hash_prompt(messages: List[Dict[str, Any]]) -> str:
    """SHA-256 hash of the text parts of messages."""
    text_parts: List[str] = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            text_parts.append(content)
        elif isinstance(content, list):
            for item in content:
                if item.get("type") == "text":
                    text_parts.append(item.get("text", ""))
    combined = "|".join(text_parts)
    return hashlib.sha256(combined.encode()).hexdigest()
