"""
Document management models for SDLC.ai SDK

Provides models for document upload, processing, and management.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class DocumentMetadata(BaseModel):
    """Document metadata model."""

    # Basic metadata
    title: Optional[str] = Field(None, description="Document title")
    author: Optional[str] = Field(None, description="Document author")
    subject: Optional[str] = Field(None, description="Document subject")
    keywords: List[str] = Field(default_factory=list, description="Keywords")

    # Content metadata
    language: Optional[str] = Field(None, description="Document language")
    page_count: Optional[int] = Field(None, description="Page count")
    word_count: Optional[int] = Field(None, description="Word count")
    character_count: Optional[int] = Field(None, description="Character count")

    # Technical metadata
    file_type: str = Field(..., description="File type/extension")
    mime_type: str = Field(..., description="MIME type")
    size_bytes: int = Field(..., description="File size in bytes")

    # Custom metadata
    custom_fields: Dict[str, Any] = Field(
        default_factory=dict, description="Custom metadata fields"
    )

    # Security
    sensitivity: Literal["public", "internal", "confidential", "secret"] = Field(
        "internal", description="Document sensitivity level"
    )

    # Classification
    category: Optional[str] = Field(None, description="Document category")
    tags: List[str] = Field(default_factory=list, description="Document tags")

    # Versioning
    version: str = Field("1.0", description="Document version")
    parent_document_id: Optional[str] = Field(None, description="Parent document ID")


class Document(BaseModel, TimestampModel):
    """Document model."""

    id: str = Field(..., description="Document ID")
    tenant_id: str = Field(..., description="Tenant ID")

    # Document info
    name: str = Field(..., description="Document name")
    description: Optional[str] = Field(None, description="Document description")

    # File info
    file_path: str = Field(..., description="File storage path")
    file_url: Optional[str] = Field(None, description="File access URL")

    # Content
    content: Optional[str] = Field(None, description="Extracted text content")
    content_hash: Optional[str] = Field(None, description="Content hash")

    # Metadata
    metadata: DocumentMetadata = Field(..., description="Document metadata")

    # Processing
    processing_status: Literal["pending", "processing", "completed", "failed"] = Field(
        "pending", description="Processing status"
    )
    processing_started_at: Optional[datetime] = Field(
        None, description="Processing start time"
    )
    processing_completed_at: Optional[datetime] = Field(
        None, description="Processing completion time"
    )
    processing_error: Optional[str] = Field(None, description="Processing error")

    # Indexing
    is_indexed: bool = Field(False, description="Indexed for search")
    indexed_at: Optional[datetime] = Field(None, description="Indexing timestamp")
    vector_id: Optional[str] = Field(None, description="Vector store ID")

    # Access control
    owner_id: str = Field(..., description="Document owner")
    permissions: List[str] = Field(
        default_factory=list, description="Document permissions"
    )

    # Status
    status: Literal["draft", "published", "archived", "deleted"] = Field(
        "draft", description="Document status"
    )

    # Statistics
    view_count: int = Field(0, description="View count")
    download_count: int = Field(0, description="Download count")

    @property
    def is_processed(self) -> bool:
        """Check if document is processed."""
        return self.processing_status == "completed"

    @property
    def is_searchable(self) -> bool:
        """Check if document is searchable."""
        return self.is_indexed and self.content is not None


class DocumentUpload(BaseModel):
    """Document upload request model."""

    name: str = Field(..., description="Document name")
    description: Optional[str] = Field(None, description="Document description")
    tenant_id: str = Field(..., description="Tenant ID")

    # Processing options
    extract_text: bool = Field(True, description="Extract text content")
    chunk_for_rag: bool = Field(True, description="Chunk for RAG")
    generate_embeddings: bool = Field(True, description="Generate embeddings")

    # Metadata
    metadata: Optional[DocumentMetadata] = Field(None, description="Document metadata")

    # Access control
    permissions: List[str] = Field(
        default_factory=list, description="Document permissions"
    )
    sensitivity: Literal["public", "internal", "confidential", "secret"] = Field(
        "internal", description="Document sensitivity"
    )

    # Classification
    category: Optional[str] = Field(None, description="Document category")
    tags: List[str] = Field(default_factory=list, description="Document tags")

    # Custom fields
    custom_fields: Dict[str, Any] = Field(
        default_factory=dict, description="Custom metadata fields"
    )


class DocumentProcessing(BaseModel):
    """Document processing status model."""

    document_id: str = Field(..., description="Document ID")
    status: Literal["pending", "processing", "completed", "failed"] = Field(
        ..., description="Processing status"
    )

    # Progress
    progress_percentage: float = Field(0.0, description="Progress percentage")
    current_stage: Optional[str] = Field(None, description="Current processing stage")
    stages_completed: List[str] = Field(
        default_factory=list, description="Completed stages"
    )

    # Timing
    started_at: Optional[datetime] = Field(None, description="Processing start time")
    estimated_completion: Optional[datetime] = Field(
        None, description="Estimated completion"
    )

    # Results
    extraction_result: Optional["ExtractionResult"] = Field(
        None, description="Text extraction result"
    )
    chunks: List[Dict[str, Any]] = Field(
        default_factory=list, description="Document chunks"
    )
    embeddings: List[List[float]] = Field(
        default_factory=list, description="Generated embeddings"
    )

    # Error handling
    error: Optional[str] = Field(None, description="Error message")
    retry_count: int = Field(0, description="Retry count")

    @property
    def is_complete(self) -> bool:
        """Check if processing is complete."""
        return self.status == "completed"

    @property
    def has_error(self) -> bool:
        """Check if processing has errors."""
        return self.status == "failed" or self.error is not None


class ExtractionResult(BaseModel):
    """Text extraction result model."""

    # Extraction metadata
    extracted_text: str = Field(..., description="Extracted text content")
    confidence: float = Field(1.0, description="Extraction confidence")

    # Content analysis
    language: Optional[str] = Field(None, description="Detected language")
    encoding: Optional[str] = Field(None, description="Text encoding")

    # Structure
    pages: List[Dict[str, Any]] = Field(
        default_factory=list, description="Page by page content"
    )
    sections: List[Dict[str, Any]] = Field(
        default_factory=list, description="Document sections"
    )
    tables: List[Dict[str, Any]] = Field(
        default_factory=list, description="Extracted tables"
    )
    images: List[Dict[str, Any]] = Field(
        default_factory=list, description="Extracted images"
    )

    # Entities
    entities: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=dict, description="Extracted entities (people, places, etc.)"
    )

    # Quality metrics
    ocr_confidence: Optional[float] = Field(None, description="OCR confidence score")
    readability_score: Optional[float] = Field(None, description="Readability score")

    # Processing info
    processing_time_ms: float = Field(0.0, description="Processing time")
    processor_version: Optional[str] = Field(None, description="Processor version")


class DocumentListResponse(ListResponseModel):
    """Document list response model."""

    data: List[Document] = Field(..., description="List of documents")


class DocumentChunk(BaseModel):
    """Document chunk model for RAG."""

    id: str = Field(..., description="Chunk ID")
    document_id: str = Field(..., description="Parent document ID")

    # Chunk content
    content: str = Field(..., description="Chunk text content")
    content_length: int = Field(..., description="Content length")

    # Position
    chunk_index: int = Field(..., description="Chunk index in document")
    start_position: int = Field(..., description="Start position in document")
    end_position: int = Field(..., description="End position in document")

    # Metadata
    page_number: Optional[int] = Field(None, description="Page number")
    section_title: Optional[str] = Field(None, description="Section title")

    # Embeddings
    embedding: Optional[List[float]] = Field(None, description="Vector embedding")
    embedding_model: Optional[str] = Field(None, description="Embedding model used")

    # Quality
    quality_score: float = Field(1.0, description="Chunk quality score")

    @validator("content_length")
    def calculate_content_length(cls, v, values):
        """Calculate content length."""
        if "content" in values:
            return len(values["content"])
        return v


class DocumentSearch(BaseModel):
    """Document search request model."""

    query: str = Field(..., description="Search query")
    tenant_id: str = Field(..., description="Tenant ID")

    # Search filters
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")

    # Search options
    search_type: Literal["text", "semantic", "hybrid"] = Field(
        "hybrid", description="Search type"
    )
    top_k: int = Field(10, description="Number of results")

    # Content filters
    file_types: List[str] = Field(default_factory=list, description="File type filters")
    categories: List[str] = Field(default_factory=list, description="Category filters")
    date_range: Optional[Dict[str, datetime]] = Field(
        None, description="Date range filter"
    )

    # Result options
    include_content: bool = Field(False, description="Include document content")
    include_chunks: bool = Field(False, description="Include document chunks")

    # Pagination
    page: int = Field(1, description="Page number")
    page_size: int = Field(20, description="Page size")


class DocumentSearchResult(BaseModel):
    """Document search result model."""

    document: Document = Field(..., description="Document information")
    score: float = Field(..., description="Relevance score")

    # Match information
    matched_chunks: List[DocumentChunk] = Field(
        default_factory=list, description="Matched chunks"
    )
    highlight: Dict[str, List[str]] = Field(
        default_factory=dict, description="Text highlights"
    )

    # Ranking
    rank: int = Field(..., description="Result rank")
    explanation: Optional[str] = Field(None, description="Result explanation")


class DocumentAccess(BaseModel):
    """Document access log model."""

    id: str = Field(..., description="Access log ID")
    document_id: str = Field(..., description="Document ID")

    # Access info
    user_id: str = Field(..., description="User ID")
    action: Literal["view", "download", "edit", "delete", "share"] = Field(
        ..., description="Access action"
    )

    # Context
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    session_id: Optional[str] = Field(None, description="Session ID")

    # Result
    success: bool = Field(True, description="Access successful")
    error_message: Optional[str] = Field(None, description="Error message")

    # Timestamp
    timestamp: datetime = Field(..., description="Access timestamp")

    # Additional data
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )


class DocumentVersion(BaseModel):
    """Document version model."""

    id: str = Field(..., description="Version ID")
    document_id: str = Field(..., description="Document ID")
    version: str = Field(..., description="Version number")

    # Version info
    name: str = Field(..., description="Version name")
    description: Optional[str] = Field(None, description="Version description")

    # Content
    content_hash: str = Field(..., description="Content hash")
    file_path: str = Field(..., description="File path")

    # Metadata
    metadata: DocumentMetadata = Field(..., description="Version metadata")

    # Creation
    created_by: str = Field(..., description="Version creator")
    created_at: datetime = Field(..., description="Creation timestamp")

    # Change info
    changes: List[Dict[str, Any]] = Field(
        default_factory=list, description="Change summary"
    )

    # Status
    is_current: bool = Field(False, description="Is current version")
    is_published: bool = Field(False, description="Is published version")
