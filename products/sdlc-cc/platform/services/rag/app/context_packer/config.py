"""
Context Packer Configuration.

Loads packing settings from environment variables or defaults.
"""

import os
from dataclasses import dataclass


@dataclass
class PackingConfig:
    """Configuration for context packing."""

    enabled: bool = True
    max_tokens: int = 4096
    similarity_threshold: float = 0.9
    min_chunk_tokens: int = 50
    merge_separator: str = "\n\n"

    @classmethod
    def from_env(cls) -> "PackingConfig":
        """Load configuration from environment variables."""
        return cls(
            enabled=os.getenv(
                "CONTEXT_PACKING_ENABLED", "true"
            ).lower() == "true",
            max_tokens=int(
                os.getenv("CONTEXT_PACKING_MAX_TOKENS", "4096")
            ),
            similarity_threshold=float(
                os.getenv("CONTEXT_PACKING_SIMILARITY_THRESHOLD", "0.9")
            ),
            min_chunk_tokens=int(
                os.getenv("CONTEXT_PACKING_MIN_CHUNK_TOKENS", "50")
            ),
        )
