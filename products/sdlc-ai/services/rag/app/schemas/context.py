"""
Enhanced Pydantic schemas for context-related operations.

Comprehensive data models with validation, serialization, and type safety
for all RAG pipeline operations including query understanding, context retrieval,
assembly, citations, and quality assessment.
"""

import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Union, Tuple, Set, Literal
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
from pydantic.types import constr, conlist
import re


# Base schemas
class BaseSchema(BaseModel):
    """Base schema with common fields"""

    class Config:
        use_enum_values = True
        validate_assignment = True
        extra = "forbid"
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None,
            uuid.UUID: lambda v: str(v) if v else None,
        }


class TimestampedSchema(BaseSchema):
    """Schema with timestamp fields"""

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class TenantScopedSchema(BaseSchema):
    """Schema with tenant scoping"""

    tenant_id: str = Field(
        ..., min_length=1, max_length=100, description="Tenant identifier"
    )
    user_id: Optional[str] = Field(
        None, min_length=1, max_length=100, description="User identifier"
    )


# Enum definitions
class QueryIntent(str, Enum):
    """Query intent classification"""

    QUESTION = "question"
    COMMAND = "command"
    SEARCH = "search"
    COMPARISON = "comparison"
    DEFINITION = "definition"
    PROCEDURAL = "procedural"
    ANALYSIS = "analysis"
    SUMMARIZATION = "summarization"
    RECOMMENDATION = "recommendation"
    EXPLANATION = "explanation"


class QueryComplexity(str, Enum):
    """Query complexity levels"""

    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    EXPERT = "expert"


class QueryType(str, Enum):
    """Query type classification"""

    FACTUAL = "factual"
    OPINION = "opinion"
    PROCEDURAL = "procedural"
    CONCEPTUAL = "conceptual"
    TEMPORAL = "temporal"
    SPATIAL = "spatial"
    CAUSAL = "causal"
    COMPARATIVE = "comparative"


class RetrievalStrategy(str, Enum):
    """Context retrieval strategies"""

    DENSE_ONLY = "dense_only"
    SPARSE_ONLY = "sparse_only"
    HYBRID_FUSION = "hybrid_fusion"
    MULTI_STAGE = "multi_stage"
    CROSS_ENCODER_RERANK = "cross_encoder_rerank"
    DIVERSITY_AWARE = "diversity_aware"
    PERSONALIZED = "personalized"
    TEMPORAL_WEIGHTED = "temporal_weighted"
    AUTHORITY_WEIGHTED = "authority_weighted"


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


class CitationStyle(str, Enum):
    """Supported citation styles"""

    APA = "apa"
    MLA = "mla"
    CHICAGO = "chicago"
    IEEE = "ieee"
    HARVARD = "harvard"
    VANCOUVER = "vancouver"
    AMA = "ama"
    NUMERIC = "numeric"
    INLINE = "inline"
    FOOTNOTE = "footnote"


class CitationType(str, Enum):
    """Types of citations"""

    BOOK = "book"
    JOURNAL_ARTICLE = "journal_article"
    CONFERENCE_PAPER = "conference_paper"
    THESIS = "thesis"
    REPORT = "report"
    WEBSITE = "website"
    PATENT = "patent"
    SOFTWARE = "software"
    DATASET = "dataset"
    PREPRINT = "preprint"
    CHAPTER = "chapter"
    ENCYCLOPEDIA = "encyclopedia"
    MAGAZINE = "magazine"
    NEWSPAPER = "newspaper"
    BLOG_POST = "blog_post"
    VIDEO = "video"
    PODCAST = "podcast"


class CompressionLevel(str, Enum):
    """Context compression levels"""

    NONE = "none"
    LIGHT = "light"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"
    EXTREME = "extreme"


class QualityMetric(str, Enum):
    """Types of quality metrics"""

    RELEVANCE = "relevance"
    ACCURACY = "accuracy"
    COMPLETENESS = "completeness"
    COHERENCE = "coherence"
    CITATION_QUALITY = "citation_quality"
    SOURCE_AUTHORITY = "source_authority"
    RECENCY = "recency"
    DIVERSITY = "diversity"
    COVERAGE = "coverage"
    READABILITY = "readability"
    FACTUAL_CORRECTNESS = "factual_correctness"
    BIAS_DETECTION = "bias_detection"
    CONSISTENCY = "consistency"
    CLARITY = "clarity"
    CONCISENESS = "conciseness"


class PipelineStatus(str, Enum):
    """Pipeline execution status"""

    INITIATED = "initiated"
    QUERY_UNDERSTANDING = "query_understanding"
    CONTEXT_RETRIEVAL = "context_retrieval"
    CONTEXT_ASSEMBLY = "context_assembly"
    CITATION_PROCESSING = "citation_processing"
    QUALITY_ASSESSMENT = "quality_assessment"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AlertSeverity(str, Enum):
    """Alert severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Query Understanding Schemas
class QueryEntity(BaseSchema):
    """Extracted entity from query"""

    text: str = Field(..., min_length=1, max_length=200, description="Entity text")
    label: str = Field(
        ..., min_length=1, max_length=50, description="Entity label (PERSON, ORG, etc.)"
    )
    start: int = Field(..., ge=0, description="Start position in query")
    end: int = Field(..., ge=0, description="End position in query")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Extraction confidence")
    canonical_form: Optional[str] = Field(
        None, min_length=1, max_length=200, description="Canonical form"
    )
    synonyms: List[str] = Field(default_factory=list, description="Synonyms")
    context: str = Field(default="", description="Surrounding context")

    @validator("end")
    def end_must_be_greater_than_start(cls, v, values):
        if "start" in values and v <= values["start"]:
            raise ValueError("end position must be greater than start position")
        return v


class QueryTerm(BaseSchema):
    """Processed query term with weighting"""

    term: str = Field(..., min_length=1, max_length=100, description="Query term")
    weight: float = Field(..., ge=0.0, le=2.0, description="Term weight")
    term_type: str = Field(..., min_length=1, max_length=50, description="Term type")
    importance: float = Field(..., ge=0.0, le=1.0, description="Term importance")
    synonyms: List[str] = Field(default_factory=list, description="Synonyms")
    related_terms: List[str] = Field(default_factory=list, description="Related terms")


class ExpandedQuery(BaseSchema):
    """Expanded query with additional terms and concepts"""

    original_query: str = Field(
        ..., min_length=1, max_length=2000, description="Original query"
    )
    expanded_terms: List[QueryTerm] = Field(
        default_factory=list, description="Expanded terms"
    )
    related_concepts: List[str] = Field(
        default_factory=list, description="Related concepts"
    )
    synonyms: List[str] = Field(default_factory=list, description="Synonyms")
    boolean_query: str = Field(
        ..., min_length=1, max_length=2000, description="Boolean query"
    )
    weighted_terms: List[Tuple[str, float]] = Field(
        default_factory=list, description="Weighted terms"
    )
    expansion_method: str = Field(
        ..., min_length=1, max_length=50, description="Expansion method"
    )
    expansion_confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Expansion confidence"
    )


class QueryAnalysis(BaseSchema, TimestampedSchema):
    """Complete query analysis results"""

    original_query: str = Field(
        ..., min_length=1, max_length=2000, description="Original query"
    )
    cleaned_query: str = Field(
        ..., min_length=1, max_length=2000, description="Cleaned query"
    )
    intent: QueryIntent = Field(..., description="Query intent")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Intent confidence")
    complexity: QueryComplexity = Field(..., description="Query complexity")
    query_type: QueryType = Field(..., description="Query type")
    entities: List[QueryEntity] = Field(
        default_factory=list, description="Extracted entities"
    )
    keywords: List[str] = Field(default_factory=list, description="Extracted keywords")
    key_phrases: List[str] = Field(default_factory=list, description="Key phrases")
    temporal_expressions: List[str] = Field(
        default_factory=list, description="Temporal expressions"
    )
    numerical_values: List[Dict[str, Any]] = Field(
        default_factory=list, description="Numerical values"
    )
    sentiment: str = Field(
        ..., regex="^(positive|negative|neutral)$", description="Sentiment analysis"
    )
    urgency: str = Field(
        ..., regex="^(high|medium|normal)$", description="Query urgency"
    )
    domain: Optional[str] = Field(
        None, min_length=1, max_length=50, description="Detected domain"
    )
    language: str = Field(
        default="en", min_length=2, max_length=5, description="Query language"
    )
    expanded_query: Optional[ExpandedQuery] = Field(None, description="Expanded query")
    search_hints: Dict[str, Any] = Field(
        default_factory=dict, description="Search hints"
    )
    processing_time_ms: float = Field(
        ..., ge=0.0, description="Processing time in milliseconds"
    )


class QueryContext(BaseSchema):
    """Context from previous queries for personalization"""

    user_id: str = Field(..., min_length=1, max_length=100, description="User ID")
    session_id: str = Field(..., min_length=1, max_length=100, description="Session ID")
    previous_queries: List[str] = Field(
        default_factory=list, description="Previous queries"
    )
    successful_results: List[Dict[str, Any]] = Field(
        default_factory=list, description="Successful results"
    )
    user_preferences: Dict[str, Any] = Field(
        default_factory=dict, description="User preferences"
    )
    domain_expertise: Dict[str, float] = Field(
        default_factory=dict, description="Domain expertise"
    )
    recent_topics: List[str] = Field(default_factory=list, description="Recent topics")
    conversation_history: List[Dict[str, Any]] = Field(
        default_factory=list, description="Conversation history"
    )


# Context Retrieval Schemas
class RetrievalRequest(BaseSchema, TenantScopedSchema):
    """Context retrieval request"""

    query_text: str = Field(
        ..., min_length=1, max_length=2000, description="Query text"
    )
    query_analysis: Optional[QueryAnalysis] = Field(
        None, description="Pre-analyzed query"
    )
    user_context: Optional[QueryContext] = Field(
        None, description="User context for personalization"
    )
    max_context_length: int = Field(
        default=4000, ge=1000, le=8000, description="Maximum context length"
    )
    max_chunks: int = Field(
        default=10, ge=1, le=50, description="Maximum chunks to retrieve"
    )
    retrieval_strategy: RetrievalStrategy = Field(
        default=RetrievalStrategy.MULTI_STAGE, description="Retrieval strategy"
    )
    min_relevance_score: float = Field(
        default=0.3, ge=0.0, le=1.0, description="Minimum relevance score"
    )
    diversity_threshold: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Diversity threshold"
    )
    include_metadata: bool = Field(
        default=True, description="Include document metadata"
    )
    boost_recent: bool = Field(default=True, description="Boost recent documents")
    boost_authoritative: bool = Field(
        default=True, description="Boost authoritative documents"
    )
    personalization_enabled: bool = Field(
        default=True, description="Enable personalization"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    temporal_filter: Optional[Dict[str, Any]] = Field(
        None, description="Temporal filter"
    )
    source_filters: Optional[List[str]] = Field(None, description="Source filters")
    content_type_filters: Optional[List[str]] = Field(
        None, description="Content type filters"
    )
    language_filters: Optional[List[str]] = Field(None, description="Language filters")


class RetrievalCandidate(BaseSchema):
    """Retrieved document candidate with scoring"""

    chunk_id: str = Field(..., min_length=1, max_length=100, description="Chunk ID")
    document_id: str = Field(
        ..., min_length=1, max_length=100, description="Document ID"
    )
    content: str = Field(
        ..., min_length=1, max_length=10000, description="Chunk content"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    raw_score: float = Field(..., ge=0.0, description="Raw relevance score")
    relevance_score: float = Field(..., ge=0.0, le=1.0, description="Relevance score")
    authority_score: float = Field(..., ge=0.0, le=1.0, description="Authority score")
    recency_score: float = Field(..., ge=0.0, le=1.0, description="Recency score")
    diversity_score: float = Field(..., ge=0.0, le=1.0, description="Diversity score")
    personalized_score: float = Field(
        ..., ge=0.0, le=1.0, description="Personalized score"
    )
    final_score: float = Field(..., ge=0.0, description="Final combined score")
    retrieval_method: str = Field(
        ..., min_length=1, max_length=100, description="Retrieval method"
    )
    stage_obtained: str = Field(
        ..., min_length=1, max_length=100, description="Stage obtained"
    )
    explanation: Dict[str, Any] = Field(
        default_factory=dict, description="Score explanation"
    )
    highlights: List[str] = Field(default_factory=list, description="Search highlights")


class RetrievalResult(BaseSchema, TimestampedSchema):
    """Complete retrieval result"""

    candidates: List[RetrievalCandidate] = Field(
        ..., description="Retrieval candidates"
    )
    query_understanding: Optional[QueryAnalysis] = Field(
        None, description="Query understanding results"
    )
    retrieval_strategy: RetrievalStrategy = Field(
        ..., description="Retrieval strategy used"
    )
    total_candidates_evaluated: int = Field(
        ..., ge=0, description="Total candidates evaluated"
    )
    retrieval_time_ms: float = Field(
        ..., ge=0.0, description="Retrieval time in milliseconds"
    )
    reranking_time_ms: float = Field(
        ..., ge=0.0, description="Reranking time in milliseconds"
    )
    diversity_time_ms: float = Field(
        ..., ge=0.0, description="Diversity processing time"
    )
    total_time_ms: float = Field(..., ge=0.0, description="Total processing time")
    coverage_estimate: float = Field(
        ..., ge=0.0, le=1.0, description="Coverage estimate"
    )
    quality_metrics: Dict[str, float] = Field(
        default_factory=dict, description="Quality metrics"
    )
    strategy_performance: Dict[str, Any] = Field(
        default_factory=dict, description="Strategy performance"
    )
    selected_chunks: List[str] = Field(
        default_factory=list, description="Selected chunk IDs"
    )


# Context Assembly Schemas
class AssemblyRequest(BaseSchema, TenantScopedSchema):
    """Context assembly request"""

    chunks: List[Dict[str, Any]] = Field(
        ..., min_items=1, description="Document chunks to assemble"
    )
    query_analysis: Optional[QueryAnalysis] = Field(None, description="Query analysis")
    user_context: Optional[QueryContext] = Field(None, description="User context")
    max_tokens: int = Field(default=4000, ge=100, le=8000, description="Maximum tokens")
    max_chunks: int = Field(default=10, ge=1, le=50, description="Maximum chunks")
    assembly_strategy: AssemblyStrategy = Field(
        default=AssemblyStrategy.ADAPTIVE, description="Assembly strategy"
    )
    compression_level: CompressionLevel = Field(
        default=CompressionLevel.NONE, description="Compression level"
    )
    redundancy_strategy: str = Field(
        default="semantic_similarity", description="Redundancy removal strategy"
    )
    include_citations: bool = Field(default=True, description="Include citations")
    preserve_metadata: bool = Field(default=True, description="Preserve metadata")
    citation_style: str = Field(default="academic", description="Citation style")
    context_window_type: str = Field(default="llm", description="Context window type")
    user_language: str = Field(
        default="en", min_length=2, max_length=5, description="User language"
    )
    prioritize_recent: bool = Field(
        default=True, description="Prioritize recent content"
    )
    prioritize_authoritative: bool = Field(
        default=True, description="Prioritize authoritative content"
    )
    maintain_coherence: bool = Field(default=True, description="Maintain coherence")
    allow_truncation: bool = Field(default=True, description="Allow content truncation")
    chunk_separator: str = Field(default="\n\n---\n\n", description="Chunk separator")


class ContextChunk(BaseSchema):
    """Processed chunk with assembly metadata"""

    original_chunk_id: str = Field(
        ..., min_length=1, max_length=100, description="Original chunk ID"
    )
    processed_content: str = Field(
        ..., min_length=1, max_length=10000, description="Processed content"
    )
    token_count: int = Field(..., ge=0, description="Token count")
    importance_score: float = Field(..., ge=0.0, le=1.0, description="Importance score")
    coherence_score: float = Field(..., ge=0.0, le=1.0, description="Coherence score")
    redundancy_score: float = Field(..., ge=0.0, le=1.0, description="Redundancy score")
    citation_info: Dict[str, Any] = Field(
        default_factory=dict, description="Citation information"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    compression_applied: bool = Field(default=False, description="Compression applied")
    truncation_applied: bool = Field(default=False, description="Truncation applied")


class AssemblyResult(BaseSchema, TimestampedSchema):
    """Complete context assembly result"""

    assembled_context: str = Field(
        ..., min_length=0, max_length=50000, description="Assembled context"
    )
    context_chunks: List[ContextChunk] = Field(..., description="Context chunks")
    total_tokens: int = Field(..., ge=0, description="Total token count")
    assembly_strategy: AssemblyStrategy = Field(
        ..., description="Assembly strategy used"
    )
    compression_level: CompressionLevel = Field(
        ..., description="Compression level applied"
    )
    assembly_time_ms: float = Field(
        ..., ge=0.0, description="Assembly time in milliseconds"
    )
    compression_time_ms: float = Field(
        ..., ge=0.0, description="Compression time in milliseconds"
    )
    redundancy_removal_time_ms: float = Field(
        ..., ge=0.0, description="Redundancy removal time"
    )
    quality_metrics: Dict[str, float] = Field(
        default_factory=dict, description="Quality metrics"
    )
    citations: List[Dict[str, Any]] = Field(
        default_factory=list, description="Citations"
    )
    truncated_chunks: List[str] = Field(
        default_factory=list, description="Truncated chunk IDs"
    )
    compression_stats: Dict[str, Any] = Field(
        default_factory=dict, description="Compression statistics"
    )
    coverage_analysis: Dict[str, Any] = Field(
        default_factory=dict, description="Coverage analysis"
    )
    assembly_metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Assembly metadata"
    )


# Citation Schemas
class CitationMetadata(BaseSchema):
    """Citation metadata information"""

    title: str = Field(..., min_length=1, max_length=500, description="Document title")
    authors: List[str] = Field(default_factory=list, description="Author names")
    publication_year: Optional[int] = Field(
        None, ge=1900, le=2100, description="Publication year"
    )
    publication_date: Optional[str] = Field(None, description="Publication date")
    source: str = Field(..., min_length=1, max_length=200, description="Source name")
    publisher: Optional[str] = Field(None, max_length=200, description="Publisher")
    volume: Optional[str] = Field(None, max_length=50, description="Volume")
    issue: Optional[str] = Field(None, max_length=50, description="Issue")
    pages: Optional[str] = Field(None, max_length=50, description="Pages")
    edition: Optional[str] = Field(None, max_length=50, description="Edition")
    doi: Optional[str] = Field(None, description="DOI")
    isbn: Optional[str] = Field(None, description="ISBN")
    issn: Optional[str] = Field(None, description="ISSN")
    url: Optional[str] = Field(None, description="URL")
    arxiv_id: Optional[str] = Field(None, description="ArXiv ID")
    pmid: Optional[str] = Field(None, description="PubMed ID")
    citation_type: CitationType = Field(
        default=CitationType.JOURNAL_ARTICLE, description="Citation type"
    )
    language: str = Field(
        default="en", min_length=2, max_length=5, description="Language"
    )
    abstract: Optional[str] = Field(None, max_length=2000, description="Abstract")
    keywords: List[str] = Field(default_factory=list, description="Keywords")
    peer_reviewed: bool = Field(default=False, description="Peer reviewed")
    open_access: bool = Field(default=False, description="Open access")
    impact_factor: Optional[float] = Field(None, ge=0.0, description="Impact factor")
    citation_count: Optional[int] = Field(None, ge=0, description="Citation count")
    internal_id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Internal ID"
    )
    verified: bool = Field(default=False, description="Verification status")
    verification_date: Optional[datetime] = Field(None, description="Verification date")


class Citation(BaseSchema, TimestampedSchema):
    """Complete citation with formatting and validation"""

    metadata: CitationMetadata = Field(..., description="Citation metadata")
    formatted_citations: Dict[CitationStyle, str] = Field(
        default_factory=dict, description="Formatted citations"
    )
    validation_status: str = Field(
        default="unknown_source", description="Validation status"
    )
    validation_errors: List[str] = Field(
        default_factory=list, description="Validation errors"
    )
    confidence_score: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Confidence score"
    )
    source_chunks: List[str] = Field(
        default_factory=list, description="Source chunk IDs"
    )
    citation_count: int = Field(default=0, ge=0, description="Citation count")
    relevance_score: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Relevance score"
    )
    authority_score: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Authority score"
    )
    recency_score: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Recency score"
    )
    quality_metrics: Dict[str, float] = Field(
        default_factory=dict, description="Quality metrics"
    )
    plagiarism_risk: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Plagiarism risk score"
    )
    similar_citations: List[str] = Field(
        default_factory=list, description="Similar citations"
    )


class CitationRequest(BaseSchema, TenantScopedSchema):
    """Citation generation request"""

    chunk: Dict[str, Any] = Field(..., description="Document chunk")
    extract_citations: bool = Field(default=True, description="Extract citations")
    validate_citations: bool = Field(default=True, description="Validate citations")
    format_citations: bool = Field(default=True, description="Format citations")
    citation_styles: List[CitationStyle] = Field(
        default=[CitationStyle.APA], description="Citation styles"
    )
    user_preferences: Dict[str, Any] = Field(
        default_factory=dict, description="User preferences"
    )
    context: Optional[str] = Field(None, description="Additional context")


class CitationAnalysis(BaseSchema):
    """Citation analysis results"""

    total_citations: int = Field(..., ge=0, description="Total citations")
    unique_sources: int = Field(..., ge=0, description="Unique sources")
    citation_distribution: Dict[CitationType, int] = Field(
        default_factory=dict, description="Citation distribution"
    )
    authority_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Authority distribution"
    )
    recency_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Recency distribution"
    )
    quality_metrics: Dict[str, float] = Field(
        default_factory=dict, description="Quality metrics"
    )
    missing_citations: List[str] = Field(
        default_factory=list, description="Missing citations"
    )
    potential_duplicates: List[List[str]] = Field(
        default_factory=list, description="Potential duplicates"
    )
    citation_density: float = Field(..., ge=0.0, description="Citation density")
    bibliographic_diversity: float = Field(
        ..., ge=0.0, le=1.0, description="Bibliographic diversity"
    )
    temporal_coverage: Dict[str, int] = Field(
        default_factory=dict, description="Temporal coverage"
    )
    geographical_coverage: Dict[str, int] = Field(
        default_factory=dict, description="Geographical coverage"
    )


# Quality Assessment Schemas
class QualityScore(BaseSchema):
    """Individual quality score with metadata"""

    metric: QualityMetric = Field(..., description="Quality metric type")
    score: float = Field(..., ge=0.0, le=1.0, description="Quality score (0-1)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    measurement_date: datetime = Field(
        default_factory=datetime.now, description="Measurement date"
    )
    context_id: Optional[str] = Field(None, description="Context ID")
    query_id: Optional[str] = Field(None, description="Query ID")
    user_id: Optional[str] = Field(None, description="User ID")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    components: Dict[str, float] = Field(
        default_factory=dict, description="Score components"
    )
    explanation: str = Field(default="", description="Score explanation")
    benchmark_score: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Benchmark score"
    )
    percentile_rank: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Percentile rank"
    )


class QualityAssessment(BaseSchema, TimestampedSchema):
    """Complete quality assessment for context"""

    assessment_id: str = Field(
        ..., min_length=1, max_length=100, description="Assessment ID"
    )
    context_id: str = Field(..., min_length=1, max_length=100, description="Context ID")
    overall_score: float = Field(
        ..., ge=0.0, le=1.0, description="Overall quality score"
    )
    metric_scores: List[QualityScore] = Field(
        ..., description="Individual metric scores"
    )
    assessment_duration_ms: float = Field(
        ..., ge=0.0, description="Assessment duration"
    )
    strengths: List[str] = Field(default_factory=list, description="Strengths")
    weaknesses: List[str] = Field(default_factory=list, description="Weaknesses")
    recommendations: List[str] = Field(
        default_factory=list, description="Recommendations"
    )
    risk_factors: List[str] = Field(default_factory=list, description="Risk factors")
    compliance_score: float = Field(..., ge=0.0, le=1.0, description="Compliance score")
    user_satisfaction_prediction: float = Field(
        ..., ge=0.0, le=1.0, description="User satisfaction prediction"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class QualityMonitorConfig(BaseSchema):
    """Configuration for quality monitoring"""

    enable_real_time_monitoring: bool = Field(
        default=True, description="Enable real-time monitoring"
    )
    assessment_frequency_minutes: int = Field(
        default=60, ge=1, le=1440, description="Assessment frequency"
    )
    trend_analysis_window_days: int = Field(
        default=30, ge=1, le=365, description="Trend analysis window"
    )
    alert_thresholds: Dict[QualityMetric, float] = Field(
        default_factory=dict, description="Alert thresholds"
    )
    benchmark_comparison_enabled: bool = Field(
        default=True, description="Enable benchmark comparison"
    )
    auto_improvement_suggestions: bool = Field(
        default=True, description="Auto improvement suggestions"
    )
    user_feedback_integration: bool = Field(
        default=True, description="User feedback integration"
    )
    compliance_monitoring: bool = Field(
        default=True, description="Compliance monitoring"
    )
    bias_detection_enabled: bool = Field(default=True, description="Bias detection")
    factual_verification_enabled: bool = Field(
        default=False, description="Factual verification"
    )
    performance_impact_limit: float = Field(
        default=0.1, ge=0.0, le=1.0, description="Performance impact limit"
    )


# Pipeline Schemas
class PipelineConfig(BaseSchema):
    """Configuration for RAG pipeline execution"""

    enable_query_understanding: bool = Field(
        default=True, description="Enable query understanding"
    )
    enable_citation_processing: bool = Field(
        default=True, description="Enable citation processing"
    )
    enable_quality_assessment: bool = Field(
        default=True, description="Enable quality assessment"
    )
    enable_streaming: bool = Field(default=False, description="Enable streaming")
    streaming_mode: str = Field(default="none", description="Streaming mode")
    max_execution_time_ms: int = Field(
        default=10000, ge=1000, le=60000, description="Max execution time"
    )
    max_parallel_tasks: int = Field(
        default=4, ge=1, le=10, description="Max parallel tasks"
    )
    enable_caching: bool = Field(default=True, description="Enable caching")
    enable_monitoring: bool = Field(default=True, description="Enable monitoring")
    min_quality_threshold: float = Field(
        default=0.5, ge=0.0, le=1.0, description="Min quality threshold"
    )
    enable_auto_retry: bool = Field(default=True, description="Enable auto retry")
    max_retry_attempts: int = Field(
        default=2, ge=0, le=5, description="Max retry attempts"
    )
    include_debug_info: bool = Field(default=False, description="Include debug info")
    include_performance_metrics: bool = Field(
        default=True, description="Include performance metrics"
    )
    include_quality_metrics: bool = Field(
        default=True, description="Include quality metrics"
    )
    include_intermediate_results: bool = Field(
        default=False, description="Include intermediate results"
    )
    enable_personalization: bool = Field(
        default=True, description="Enable personalization"
    )
    enable_compression: bool = Field(default=False, description="Enable compression")
    compression_level: CompressionLevel = Field(
        default=CompressionLevel.NONE, description="Compression level"
    )
    max_context_tokens: int = Field(
        default=4000, ge=100, le=8000, description="Max context tokens"
    )


class PipelineRequest(BaseSchema, TenantScopedSchema):
    """Request for RAG pipeline execution"""

    query: str = Field(..., min_length=1, max_length=2000, description="Pipeline query")
    config: Optional[PipelineConfig] = Field(None, description="Pipeline configuration")
    session_id: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Session ID"
    )
    conversation_id: Optional[str] = Field(
        None, min_length=1, max_length=100, description="Conversation ID"
    )
    context_window_type: str = Field(default="llm", description="Context window type")
    retrieval_strategy: RetrievalStrategy = Field(
        default=RetrievalStrategy.MULTI_STAGE, description="Retrieval strategy"
    )
    assembly_strategy: AssemblyStrategy = Field(
        default=AssemblyStrategy.ADAPTIVE, description="Assembly strategy"
    )
    citation_styles: List[CitationStyle] = Field(
        default=[CitationStyle.APA], description="Citation styles"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class PipelineStep(BaseSchema):
    """Individual pipeline step information"""

    step_name: str = Field(..., min_length=1, max_length=100, description="Step name")
    status: PipelineStatus = Field(..., description="Step status")
    start_time: datetime = Field(default_factory=datetime.now, description="Start time")
    end_time: Optional[datetime] = Field(None, description="End time")
    duration_ms: Optional[float] = Field(
        None, ge=0.0, description="Duration in milliseconds"
    )
    input_data: Optional[Dict[str, Any]] = Field(None, description="Input data")
    output_data: Optional[Dict[str, Any]] = Field(None, description="Output data")
    error: Optional[str] = Field(None, description="Error message")
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Step metrics")


class PipelineResult(BaseSchema, TimestampedSchema):
    """Complete pipeline execution result"""

    pipeline_id: str = Field(
        ..., min_length=1, max_length=100, description="Pipeline ID"
    )
    request: PipelineRequest = Field(..., description="Pipeline request")
    status: PipelineStatus = Field(..., description="Pipeline status")
    end_time: Optional[datetime] = Field(None, description="End time")
    total_duration_ms: Optional[float] = Field(
        None, ge=0.0, description="Total duration"
    )
    query_analysis: Optional[QueryAnalysis] = Field(None, description="Query analysis")
    retrieval_result: Optional[RetrievalResult] = Field(
        None, description="Retrieval result"
    )
    assembly_result: Optional[AssemblyResult] = Field(
        None, description="Assembly result"
    )
    citations: List[Citation] = Field(default_factory=list, description="Citations")
    quality_assessment: Optional[QualityAssessment] = Field(
        None, description="Quality assessment"
    )
    steps: List[PipelineStep] = Field(
        default_factory=list, description="Pipeline steps"
    )
    performance_metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Performance metrics"
    )
    quality_metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Quality metrics"
    )
    error: Optional[str] = Field(None, description="Error message")
    error_traceback: Optional[str] = Field(None, description="Error traceback")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


# API Request/Response Schemas
class ContextGenerationRequest(BaseSchema, TenantScopedSchema):
    """Complete context generation request"""

    query: str = Field(..., min_length=1, max_length=2000, description="Search query")
    config: Optional[PipelineConfig] = Field(None, description="Pipeline configuration")
    streaming: bool = Field(default=False, description="Enable streaming")
    include_metadata: bool = Field(
        default=True, description="Include detailed metadata"
    )


class ContextGenerationResponse(BaseSchema):
    """Complete context generation response"""

    pipeline_id: str = Field(
        ..., min_length=1, max_length=100, description="Pipeline ID"
    )
    status: PipelineStatus = Field(..., description="Pipeline status")
    assembled_context: Optional[str] = Field(None, description="Assembled context")
    query_analysis: Optional[Dict[str, Any]] = Field(None, description="Query analysis")
    retrieval_result: Optional[Dict[str, Any]] = Field(
        None, description="Retrieval result"
    )
    assembly_result: Optional[Dict[str, Any]] = Field(
        None, description="Assembly result"
    )
    citations: List[Dict[str, Any]] = Field(
        default_factory=list, description="Citations"
    )
    quality_assessment: Optional[Dict[str, Any]] = Field(
        None, description="Quality assessment"
    )
    performance_metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Performance metrics"
    )
    quality_metrics: Optional[Dict[str, Any]] = Field(
        None, description="Quality metrics"
    )
    steps: List[Dict[str, Any]] = Field(
        default_factory=list, description="Pipeline steps"
    )
    error: Optional[str] = Field(None, description="Error message")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class MetricsResponse(BaseSchema):
    """Generic metrics response"""

    overall_metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Overall metrics"
    )
    detailed_metrics: Dict[str, Any] = Field(
        default_factory=dict, description="Detailed metrics"
    )
    trends: Dict[str, Any] = Field(default_factory=dict, description="Trends")
    benchmarks: Dict[str, Any] = Field(default_factory=dict, description="Benchmarks")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Response timestamp"
    )


class HealthCheckResponse(BaseSchema):
    """Health check response"""

    status: str = Field(
        ..., regex="^(healthy|degraded|unhealthy)$", description="Health status"
    )
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Health check timestamp"
    )
    components: Dict[str, str] = Field(
        default_factory=dict, description="Component status"
    )
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Health metrics")
    version: str = Field(default="1.0.0", description="API version")
    uptime: Optional[float] = Field(None, ge=0.0, description="Uptime in seconds")
    error: Optional[str] = Field(None, description="Error message")


# Utility schemas
class ErrorDetail(BaseSchema):
    """Error detail response"""

    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Error detail")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Error timestamp"
    )
    request_id: Optional[str] = Field(None, description="Request ID")
    component: Optional[str] = Field(None, description="Component that failed")


class SuccessResponse(BaseSchema):
    """Generic success response"""

    success: bool = Field(default=True, description="Success status")
    message: str = Field(..., description="Success message")
    data: Optional[Dict[str, Any]] = Field(None, description="Response data")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Response timestamp"
    )


# Validation utilities
class ValidationHelper:
    """Helper class for custom validation logic"""

    @staticmethod
    def validate_doi(doi: str) -> str:
        """Validate DOI format"""
        if not doi:
            return doi

        # Basic DOI pattern
        doi_pattern = r"^10\.\d+/.+"
        if not re.match(doi_pattern, doi):
            raise ValueError(f"Invalid DOI format: {doi}")

        return doi

    @staticmethod
    def validate_url(url: str) -> str:
        """Validate URL format"""
        if not url:
            return url

        url_pattern = r"^https?://[^\s/$.?#].[^\s]*$"
        if not re.match(url_pattern, url):
            raise ValueError(f"Invalid URL format: {url}")

        return url

    @staticmethod
    def validate_isbn(isbn: str) -> str:
        """Validate ISBN format"""
        if not isbn:
            return isbn

        # Remove hyphens and spaces
        isbn_clean = isbn.replace("-", "").replace(" ", "")

        # ISBN-10 or ISBN-13 pattern
        if len(isbn_clean) == 10 or len(isbn_clean) == 13:
            return isbn

        raise ValueError(f"Invalid ISBN format: {isbn}")

    @staticmethod
    def validate_arxiv_id(arxiv_id: str) -> str:
        """Validate ArXiv ID format"""
        if not arxiv_id:
            return arxiv_id

        # ArXiv pattern
        arxiv_pattern = r"^\d{4}\.\d{4,5}(v\d+)?$"
        if not re.match(arxiv_pattern, arxiv_id):
            raise ValueError(f"Invalid ArXiv ID format: {arxiv_id}")

        return arxiv_id


# Export all schemas
__all__ = [
    # Base schemas
    "BaseSchema",
    "TimestampedSchema",
    "TenantScopedSchema",
    # Enums
    "QueryIntent",
    "QueryComplexity",
    "QueryType",
    "RetrievalStrategy",
    "AssemblyStrategy",
    "CitationStyle",
    "CitationType",
    "CompressionLevel",
    "QualityMetric",
    "PipelineStatus",
    "AlertSeverity",
    # Query understanding
    "QueryEntity",
    "QueryTerm",
    "ExpandedQuery",
    "QueryAnalysis",
    "QueryContext",
    # Context retrieval
    "RetrievalRequest",
    "RetrievalCandidate",
    "RetrievalResult",
    # Context assembly
    "AssemblyRequest",
    "ContextChunk",
    "AssemblyResult",
    # Citations
    "CitationMetadata",
    "Citation",
    "CitationRequest",
    "CitationAnalysis",
    # Quality assessment
    "QualityScore",
    "QualityAssessment",
    "QualityMonitorConfig",
    # Pipeline
    "PipelineConfig",
    "PipelineRequest",
    "PipelineStep",
    "PipelineResult",
    # API responses
    "ContextGenerationRequest",
    "ContextGenerationResponse",
    "MetricsResponse",
    "HealthCheckResponse",
    "ErrorDetail",
    "SuccessResponse",
    # Utilities
    "ValidationHelper",
]
