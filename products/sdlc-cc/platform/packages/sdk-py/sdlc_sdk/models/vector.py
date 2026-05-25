"""
Vector search models for SDLC.ai SDK

Provides models for vector operations including search, similarity, and batch operations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class VectorSearchRequest(BaseModel):
    """Vector search request model."""

    # Query vector
    vector: List[float] = Field(..., description="Query vector")
    tenant_id: str = Field(..., description="Tenant ID")

    # Search parameters
    top_k: int = Field(10, description="Number of results")
    include_vectors: bool = Field(False, description="Include result vectors")
    include_metadata: bool = Field(True, description="Include metadata")

    # Filters
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")

    # Search options
    search_type: Literal["approximate", "exact"] = Field(
        "approximate", description="Search type"
    )
    distance_metric: Literal["cosine", "euclidean", "dotproduct"] = Field(
        "cosine", description="Distance metric"
    )

    # Namespace/namespace
    namespace: Optional[str] = Field(None, description="Vector namespace")

    @validator("vector")
    def validate_vector(cls, v):
        """Validate vector dimensions."""
        if not v:
            raise ValueError("Vector cannot be empty")
        if len(v) > 1536:  # Typical max dimension
            raise ValueError("Vector dimension too large (max 1536)")
        return v


class VectorResult(BaseModel):
    """Vector search result model."""

    id: str = Field(..., description="Vector ID")
    score: float = Field(..., description="Similarity score")
    distance: float = Field(..., description="Distance value")

    # Vector data
    vector: Optional[List[float]] = Field(None, description="Vector values")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Vector metadata"
    )

    # Source info
    document_id: Optional[str] = Field(None, description="Source document ID")
    chunk_id: Optional[str] = Field(None, description="Source chunk ID")

    # Ranking
    rank: int = Field(..., description="Result rank")

    @validator("score")
    def validate_score(cls, v):
        """Validate similarity score."""
        if not -1 <= v <= 1:
            raise ValueError("Score must be between -1 and 1")
        return v


class VectorSearchResponse(BaseModel):
    """Vector search response model."""

    query_id: str = Field(..., description="Query ID")
    results: List[VectorResult] = Field(..., description="Search results")

    # Search metadata
    total_returned: int = Field(..., description="Total results returned")
    search_time_ms: float = Field(..., description="Search time")

    # Query info
    vector_dimension: int = Field(..., description="Query vector dimension")
    distance_metric: str = Field(..., description="Distance metric used")

    @property
    def top_result(self) -> Optional[VectorResult]:
        """Get top result."""
        return self.results[0] if self.results else None


class VectorBatchRequest(BaseModel):
    """Batch vector operation request model."""

    # Vectors
    vectors: List[List[float]] = Field(..., description="Vectors to process")
    tenant_id: str = Field(..., description="Tenant ID")

    # Operation type
    operation: Literal["search", "upsert", "delete", "update"] = Field(
        "search", description="Operation type"
    )

    # Search parameters (for search operation)
    top_k: int = Field(10, description="Results per vector")
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")

    # Upsert parameters (for upsert operation)
    ids: Optional[List[str]] = Field(None, description="Vector IDs")
    metadata: Optional[List[Dict[str, Any]]] = Field(
        None, description="Vector metadata"
    )

    # Batch options
    max_concurrency: int = Field(10, description="Maximum concurrency")

    @validator("vectors")
    def validate_vectors(cls, v):
        """Validate vectors list."""
        if not v:
            raise ValueError("Vectors list cannot be empty")
        if len(v) > 1000:
            raise ValueError("Cannot process more than 1000 vectors at once")

        # Check all vectors have same dimension
        if len(v) > 1:
            dim = len(v[0])
            for vec in v[1:]:
                if len(vec) != dim:
                    raise ValueError("All vectors must have same dimension")

        return v


class VectorBatchResponse(BaseModel):
    """Batch operation response model."""

    batch_id: str = Field(..., description="Batch operation ID")
    operation: str = Field(..., description="Operation type")

    # Results
    results: List[Dict[str, Any]] = Field(..., description="Operation results")
    successful: int = Field(..., description="Successful operations")
    failed: int = Field(..., description="Failed operations")

    # Errors
    errors: List[Dict[str, Any]] = Field(
        default_factory=list, description="Errors encountered"
    )

    # Timing
    total_time_ms: float = Field(..., description="Total time")

    @property
    def total(self) -> int:
        """Get total operations."""
        return self.successful + self.failed


class VectorSimilarity(BaseModel):
    """Vector similarity calculation model."""

    # Vectors
    vector_a: List[float] = Field(..., description="First vector")
    vector_b: List[float] = Field(..., description="Second vector")

    # Similarity metrics
    cosine_similarity: float = Field(..., description="Cosine similarity")
    euclidean_distance: float = Field(..., description="Euclidean distance")
    dot_product: float = Field(..., description="Dot product")

    # Metadata
    vector_a_id: Optional[str] = Field(None, description="First vector ID")
    vector_b_id: Optional[str] = Field(None, description="Second vector ID")

    @validator("vector_a", "vector_b")
    def validate_vector_dimensions(cls, v, values):
        """Validate vector dimensions match."""
        if "vector_a" in values and "vector_b" in values:
            if len(values["vector_a"]) != len(values["vector_b"]):
                raise ValueError("Vectors must have same dimension")
        return v


class VectorIndex(BaseModel):
    """Vector index model."""

    id: str = Field(..., description="Index ID")
    tenant_id: str = Field(..., description="Tenant ID")

    # Index configuration
    name: str = Field(..., description="Index name")
    description: Optional[str] = Field(None, description="Index description")

    # Vector properties
    dimension: int = Field(..., description="Vector dimension")
    distance_metric: Literal["cosine", "euclidean", "dotproduct"] = Field(
        "cosine", description="Distance metric"
    )

    # Index properties
    index_type: Literal["hnsw", "ivf", "flat"] = Field("hnsw", description="Index type")

    # Statistics
    vector_count: int = Field(0, description="Number of vectors")
    size_mb: float = Field(0.0, description="Index size in MB")

    # Status
    status: Literal["creating", "ready", "updating", "error"] = Field(
        "creating", description="Index status"
    )

    # Configuration
    config: Dict[str, Any] = Field(
        default_factory=dict, description="Index configuration"
    )

    # Timestamps
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")

    @property
    def is_ready(self) -> bool:
        """Check if index is ready."""
        return self.status == "ready"


class VectorNamespace(BaseModel):
    """Vector namespace model."""

    name: str = Field(..., description="Namespace name")
    tenant_id: str = Field(..., description="Tenant ID")

    # Namespace properties
    description: Optional[str] = Field(None, description="Namespace description")

    # Statistics
    vector_count: int = Field(0, description="Number of vectors")
    size_mb: float = Field(0.0, description="Size in MB")

    # Access control
    is_public: bool = Field(False, description="Public namespace")
    allowed_users: List[str] = Field(default_factory=list, description="Allowed users")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Namespace metadata"
    )

    # Timestamps
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")


class VectorOperation(BaseModel):
    """Vector operation model."""

    id: str = Field(..., description="Operation ID")
    tenant_id: str = Field(..., description="Tenant ID")

    # Operation details
    operation_type: Literal["create", "update", "delete", "search"] = Field(
        ..., description="Operation type"
    )

    # Status
    status: Literal["pending", "running", "completed", "failed"] = Field(
        "pending", description="Operation status"
    )

    # Progress
    progress_percentage: float = Field(0.0, description="Progress percentage")
    processed_count: int = Field(0, description="Processed count")
    total_count: int = Field(0, description="Total count")

    # Timing
    started_at: Optional[datetime] = Field(None, description="Start time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")

    # Error handling
    error_message: Optional[str] = Field(None, description="Error message")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Operation metadata"
    )

    @property
    def is_complete(self) -> bool:
        """Check if operation is complete."""
        return self.status in ["completed", "failed"]

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get operation duration."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None
