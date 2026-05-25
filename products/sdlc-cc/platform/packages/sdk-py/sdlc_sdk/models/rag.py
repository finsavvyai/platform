"""
RAG (Retrieval Augmented Generation) models for SDLC.ai SDK

Provides models for RAG queries, responses, and configurations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class RAGConfig(BaseModel):
    """RAG configuration model."""

    # Retrieval configuration
    retrieval_top_k: int = Field(5, description="Number of documents to retrieve")
    retrieval_score_threshold: float = Field(
        0.5, description="Minimum similarity score"
    )
    retrieval_mode: Literal["vector", "keyword", "hybrid"] = Field(
        "hybrid", description="Retrieval mode"
    )

    # Hybrid search weights
    semantic_weight: float = Field(0.7, description="Semantic search weight")
    keyword_weight: float = Field(0.3, description="Keyword search weight")

    # Reranking
    enable_reranking: bool = Field(True, description="Enable result reranking")
    reranker_model: Optional[str] = Field(None, description="Reranker model")
    rerank_top_k: int = Field(10, description="Number of results to rerank")

    # Context window
    max_context_length: int = Field(4000, description="Maximum context length")
    context_overlap: int = Field(100, description="Context overlap between chunks")

    # Generation
    model: str = Field("gpt-3.5-turbo", description="LLM model")
    temperature: float = Field(0.7, description="Generation temperature")
    max_tokens: int = Field(1000, description="Maximum generation tokens")

    # System prompt
    system_prompt: Optional[str] = Field(None, description="Custom system prompt")

    # Citations
    include_citations: bool = Field(True, description="Include source citations")
    citation_format: Literal["apa", "mla", "chicago", "ieee", "numeric"] = Field(
        "apa", description="Citation format"
    )

    @validator("semantic_weight", "keyword_weight")
    def validate_weights(cls, v, values):
        """Validate hybrid search weights."""
        if "semantic_weight" in values and "keyword_weight" in values:
            total = values["semantic_weight"] + values["keyword_weight"]
            if abs(total - 1.0) > 0.01:
                raise ValueError("Semantic and keyword weights must sum to 1.0")
        return v


class RAGQuery(BaseModel):
    """RAG query request model."""

    query: str = Field(..., description="User query")
    tenant_id: str = Field(..., description="Tenant ID")

    # Query context
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    user_id: Optional[str] = Field(None, description="User ID")

    # Retrieval options
    document_ids: Optional[List[str]] = Field(
        None, description="Specific documents to search"
    )
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")

    # RAG configuration
    config: Optional[RAGConfig] = Field(None, description="RAG configuration")

    # Query history
    history: List[Dict[str, Any]] = Field(
        default_factory=list, description="Query history"
    )

    # Streaming
    stream: bool = Field(False, description="Stream response")

    @validator("query")
    def validate_query(cls, v):
        """Validate query text."""
        if not v or not v.strip():
            raise ValueError("Query cannot be empty")
        return v.strip()


class RAGSource(BaseModel):
    """RAG source/citation model."""

    document_id: str = Field(..., description="Source document ID")
    document_name: str = Field(..., description="Document name")
    document_url: Optional[str] = Field(None, description="Document URL")

    # Content
    chunk_id: Optional[str] = Field(None, description="Chunk ID")
    content: str = Field(..., description="Relevant content")

    # Relevance
    score: float = Field(..., description="Relevance score")
    rank: int = Field(..., description="Source rank")

    # Location
    page_number: Optional[int] = Field(None, description="Page number")
    start_position: Optional[int] = Field(None, description="Start position")
    end_position: Optional[int] = Field(None, description="End position")

    # Citation
    citation_text: Optional[str] = Field(None, description="Formatted citation")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class RAGResponse(BaseModel):
    """RAG query response model."""

    query_id: str = Field(..., description="Query ID")
    answer: str = Field(..., description="Generated answer")

    # Sources
    sources: List[RAGSource] = Field(..., description="Source documents")

    # Quality metrics
    confidence: float = Field(1.0, description="Answer confidence")
    relevance_score: float = Field(1.0, description="Query relevance score")

    # Generation info
    model: str = Field(..., description="Model used")
    tokens_used: int = Field(..., description="Tokens generated")
    generation_time_ms: float = Field(..., description="Generation time")

    # Retrieval info
    retrieval_time_ms: float = Field(..., description="Retrieval time")
    documents_retrieved: int = Field(..., description="Documents retrieved")

    # Feedback
    helpful: Optional[bool] = Field(None, description="User feedback")
    feedback_comment: Optional[str] = Field(None, description="Feedback comment")

    # Timestamp
    created_at: datetime = Field(..., description="Response timestamp")

    @property
    def source_count(self) -> int:
        """Get number of sources."""
        return len(self.sources)

    @property
    def has_citations(self) -> bool:
        """Check if response has citations."""
        return len(self.sources) > 0


class RAGConversation(BaseModel):
    """RAG conversation model."""

    id: str = Field(..., description="Conversation ID")
    tenant_id: str = Field(..., description="Tenant ID")
    user_id: Optional[str] = Field(None, description="User ID")

    # Conversation info
    title: Optional[str] = Field(None, description="Conversation title")
    description: Optional[str] = Field(None, description="Conversation description")

    # Messages
    messages: List[Dict[str, Any]] = Field(
        default_factory=list, description="Conversation messages"
    )

    # Context
    document_ids: List[str] = Field(
        default_factory=list, description="Relevant documents"
    )
    context: Dict[str, Any] = Field(
        default_factory=dict, description="Conversation context"
    )

    # Settings
    config: Optional[RAGConfig] = Field(None, description="RAG configuration")

    # Statistics
    query_count: int = Field(0, description="Number of queries")
    total_tokens: int = Field(0, description="Total tokens used")

    # Timestamps
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")
    last_activity: Optional[datetime] = Field(None, description="Last activity")

    @property
    def is_active(self) -> bool:
        """Check if conversation is active."""
        if not self.last_activity:
            return True
        return (datetime.utcnow() - self.last_activity).days < 30


class QueryRequest(BaseModel):
    """Query request model."""

    query: str = Field(..., description="Query text")
    tenant_id: str = Field(..., description="Tenant ID")

    # Query options
    top_k: int = Field(10, description="Number of results")
    include_content: bool = Field(False, description="Include content")

    # Filters
    filters: Dict[str, Any] = Field(default_factory=dict, description="Query filters")

    # Search type
    search_type: Literal["semantic", "keyword", "hybrid"] = Field(
        "hybrid", description="Search type"
    )

    # Weights
    semantic_weight: float = Field(0.7, description="Semantic weight")
    keyword_weight: float = Field(0.3, description="Keyword weight")


class HybridSearchRequest(BaseModel):
    """Hybrid search request model."""

    query: str = Field(..., description="Search query")
    tenant_id: str = Field(..., description="Tenant ID")

    # Vector search
    vector: Optional[List[float]] = Field(None, description="Query vector")
    vector_weight: float = Field(0.7, description="Vector search weight")

    # Keyword search
    keyword_query: Optional[str] = Field(None, description="Keyword query")
    keyword_weight: float = Field(0.3, description="Keyword search weight")

    # Results
    top_k: int = Field(10, description="Number of results")
    min_score: float = Field(0.0, description="Minimum score")

    # Filters
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")

    @validator("vector_weight", "keyword_weight")
    def validate_weights(cls, v, values):
        """Validate search weights."""
        if "vector_weight" in values and "keyword_weight" in values:
            total = values["vector_weight"] + values["keyword_weight"]
            if abs(total - 1.0) > 0.01:
                raise ValueError("Vector and keyword weights must sum to 1.0")
        return v


class RAGAnalytics(BaseModel):
    """RAG analytics model."""

    tenant_id: str = Field(..., description="Tenant ID")
    period: str = Field(..., description="Analytics period")

    # Query metrics
    total_queries: int = Field(0, description="Total queries")
    unique_users: int = Field(0, description="Unique users")
    average_queries_per_user: float = Field(0.0, description="Average queries per user")

    # Performance metrics
    average_response_time_ms: float = Field(0.0, description="Average response time")
    p95_response_time_ms: float = Field(
        0.0, description="95th percentile response time"
    )

    # Quality metrics
    average_confidence: float = Field(0.0, description="Average confidence score")
    average_relevance: float = Field(0.0, description="Average relevance score")

    # Usage metrics
    tokens_generated: int = Field(0, description="Tokens generated")
    documents_retrieved: int = Field(0, description="Documents retrieved")

    # Feedback
    helpful_rating: float = Field(0.0, description="Helpful rating percentage")

    # Top queries
    top_queries: List[Dict[str, Any]] = Field(
        default_factory=list, description="Top queries"
    )

    # Timestamp
    generated_at: datetime = Field(..., description="Generation timestamp")


class RAGFeedback(BaseModel):
    """RAG feedback model."""

    query_id: str = Field(..., description="Query ID")
    user_id: Optional[str] = Field(None, description="User ID")

    # Feedback
    rating: Literal["helpful", "somewhat_helpful", "not_helpful"] = Field(
        ..., description="Feedback rating"
    )
    comment: Optional[str] = Field(None, description="Feedback comment")

    # Additional feedback
    issues: List[str] = Field(default_factory=list, description="Identified issues")
    suggestions: List[str] = Field(default_factory=list, description="Suggestions")

    # Context
    context: Dict[str, Any] = Field(
        default_factory=dict, description="Feedback context"
    )

    # Timestamp
    created_at: datetime = Field(..., description="Feedback timestamp")
