"""
Context Assembly Service Package

Re-exports all public types for backward compatibility.
"""

from .models import (
    AssemblyStrategy,
    CompressionLevel,
    RedundancyStrategy,
    AssemblyRequest,
    ContextChunk,
    AssemblyResult,
    ContextWindow,
)
from .service import ContextAssemblyService

__all__ = [
    "AssemblyStrategy",
    "CompressionLevel",
    "RedundancyStrategy",
    "AssemblyRequest",
    "ContextChunk",
    "AssemblyResult",
    "ContextWindow",
    "ContextAssemblyService",
]
