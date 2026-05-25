"""
Context Retrieval Models

Data models, enums, and request/response types for context retrieval.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional

from app.models.document import DocumentChunk
from app.services.query_understanding_service import QueryAnalysis, QueryContext


class RetrievalStrategy(str, Enum):
    """Context retrieval strategies"""

    DENSE_ONLY = "dense_only"
    SPARSE_ONLY = "sparse_only"
    HYBRID_FUSION = "hybrid_fusion"
    HYBRID_RRF = "hybrid_rrf"
    MULTI_STAGE = "multi_stage"
    CROSS_ENCODER_RERANK = "cross_encoder_rerank"
    DIVERSITY_AWARE = "diversity_aware"
    PERSONALIZED = "personalized"
    TEMPORAL_WEIGHTED = "temporal_weighted"
    AUTHORITY_WEIGHTED = "authority_weighted"


class RetrievalStage(str, Enum):
    """Multi-stage retrieval stages"""

    BROAD_RETRIEVAL = "broad_retrieval"
    FOCUSED_RETRIEVAL = "focused_retrieval"
    REFINEMENT = "refinement"
    DIVERSIFICATION = "diversification"
    PERSONALIZATION = "personalization"


@dataclass
class RetrievalRequest:
    """Context retrieval request"""

    query_text: str
    query_analysis: Optional[QueryAnalysis] = None
    user_context: Optional[QueryContext] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    max_context_length: int = 4000
    max_chunks: int = 10
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.MULTI_STAGE
    min_relevance_score: float = 0.3
    include_metadata: bool = True
    boost_recent: bool = True
    boost_authoritative: bool = True
    diversity_threshold: float = 0.7
    personalization_enabled: bool = True
    temporal_filter: Optional[Dict[str, Any]] = None
    source_filters: Optional[List[str]] = None
    content_type_filters: Optional[List[str]] = None
    language_filters: Optional[List[str]] = None


@dataclass
class RetrievalCandidate:
    """Retrieved document candidate with scoring"""

    chunk: DocumentChunk
    raw_score: float
    relevance_score: float
    authority_score: float
    recency_score: float
    diversity_score: float
    personalized_score: float
    final_score: float
    retrieval_method: str
    stage_obtained: RetrievalStage
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    """Complete retrieval result"""

    candidates: List[RetrievalCandidate]
    query_understanding: Optional[QueryAnalysis]
    retrieval_strategy: RetrievalStrategy
    total_candidates_evaluated: int
    retrieval_time_ms: float
    reranking_time_ms: float
    diversity_time_ms: float
    total_time_ms: float
    coverage_estimate: float
    quality_metrics: Dict[str, float]
    strategy_performance: Dict[str, Any]
    selected_chunks: List[DocumentChunk]


@dataclass
class RetrievalMetrics:
    """Retrieval performance metrics"""

    precision_at_k: Dict[int, float]
    recall_at_k: Dict[int, float]
    f1_at_k: Dict[int, float]
    mean_reciprocal_rank: float
    mean_average_precision: float
    normalized_discounted_cumulative_gain: float
    diversity_score: float
    novelty_score: float
    coverage_score: float
    authority_distribution: Dict[str, float]
    temporal_distribution: Dict[str, int]
