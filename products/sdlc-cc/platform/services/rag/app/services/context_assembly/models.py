"""
Context Assembly Models

Data models, enums, and request/response types for context assembly.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional

from app.models.document import DocumentChunk


class AssemblyStrategy(str, Enum):
    """Context assembly strategies"""

    SEQUENTIAL = "sequential"
    IMPORTANCE_WEIGHTED = "importance_weighted"
    DIVERSITY_OPTIMIZED = "diversity_optimized"
    COHERENCE_FOCUSED = "coherence_focused"
    CITATION_AWARE = "citation_aware"
    COMPRESSIVE = "compressive"
    HIERARCHICAL = "hierarchical"
    ADAPTIVE = "adaptive"


class CompressionLevel(str, Enum):
    """Context compression levels"""

    NONE = "none"
    LIGHT = "light"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    EXTREME = "extreme"


class RedundancyStrategy(str, Enum):
    """Redundancy removal strategies"""

    EXACT_DUPLICATE = "exact_duplicate"
    SEMANTIC_SIMILARITY = "semantic_similarity"
    OVERLAP_DETECTION = "overlap_detection"
    CONCEPTUAL_REDUNDANCY = "conceptual_redundancy"


@dataclass
class AssemblyRequest:
    """Context assembly request"""

    chunks: List[DocumentChunk]
    query_analysis: Optional[Any] = None
    max_tokens: int = 4000
    assembly_strategy: AssemblyStrategy = AssemblyStrategy.ADAPTIVE
    compression_level: CompressionLevel = CompressionLevel.NONE
    redundancy_strategy: RedundancyStrategy = (
        RedundancyStrategy.SEMANTIC_SIMILARITY
    )
    include_citations: bool = True
    preserve_metadata: bool = True
    citation_style: str = "academic"
    context_window_type: str = "llm"
    user_language: str = "en"
    prioritize_recent: bool = True
    prioritize_authoritative: bool = True
    maintain_coherence: bool = True
    allow_truncation: bool = True
    chunk_separator: str = "\n\n---\n\n"


@dataclass
class ContextChunk:
    """Processed chunk with assembly metadata"""

    original_chunk: DocumentChunk
    processed_content: str
    token_count: int
    importance_score: float
    coherence_score: float
    redundancy_score: float
    citation_info: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    compression_applied: bool = False
    truncation_applied: bool = False


@dataclass
class AssemblyResult:
    """Complete context assembly result"""

    assembled_context: str
    context_chunks: List[ContextChunk]
    total_tokens: int
    assembly_strategy: AssemblyStrategy
    compression_level: CompressionLevel
    assembly_time_ms: float
    compression_time_ms: float
    redundancy_removal_time_ms: float
    quality_metrics: Dict[str, float]
    citations: List[Dict[str, Any]]
    truncated_chunks: List[str]
    compression_stats: Dict[str, Any]
    coverage_analysis: Dict[str, Any]
    assembly_metadata: Dict[str, Any]


@dataclass
class ContextWindow:
    """Token-aware context window"""

    content: str
    token_count: int
    chunks_included: List[ContextChunk]
    window_metadata: Dict[str, Any] = field(default_factory=dict)
    overflow_handling: str = "truncate"
