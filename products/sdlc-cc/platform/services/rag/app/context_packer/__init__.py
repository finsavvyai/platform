"""
Context Packer - Token-efficient context trimming for RAG pipeline.

Reduces token usage by 40-60% through whitespace compression,
near-duplicate deduplication, chunk merging, and token budget enforcement.
"""

from .config import PackingConfig
from .compress import compress_chunk, estimate_tokens
from .dedup import deduplicate_chunks
from .packer import pack_context, pack_and_compress

__all__ = [
    "PackingConfig",
    "compress_chunk",
    "estimate_tokens",
    "deduplicate_chunks",
    "pack_context",
    "pack_and_compress",
]
