"""
Document Processing Schemas

Pydantic schemas for document processing requests and responses including:
- Document processing requests with security options
- Processing results with metadata
- Document metadata extraction
- Validation and security schemas
"""

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator


class ProcessingStatus(str, Enum):
    """Document processing status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SecurityLevel(str, Enum):
    """Security scanning levels."""
    NONE = "none"
    BASIC = "basic"
    COMPREHENSIVE = "comprehensive"


class DocumentType(str, Enum):
    """Document types."""
    PDF = "pdf"
    DOCX = "docx"
    DOC = "doc"
    XLSX = "xlsx"
    XLS = "xls"
    PPTX = "pptx"
    PPT = "ppt"
    TXT = "txt"
    CSV = "csv"
    HTML = "html"
    MARKDOWN = "markdown"
    IMAGE = "image"
    EMAIL = "email"
    UNKNOWN = "unknown"


class DocumentMetadata(BaseModel):
    """Document metadata schema."""
    title: Optional[str] = Field(None, description="Document title")
    author: Optional[str] = Field(None, description="Document author")
    subject: Optional[str] = Field(None, description="Document subject")
    keywords: Optional[str] = Field(None, description="Document keywords")
    creator: Optional[str] = Field(None, description="Document creator")
    producer: Optional[str] = Field(None, description="Document producer")
    creation_date: Optional[str] = Field(None, description="Creation date")
    modification_date: Optional[str] = Field(None, description="Modification date")
    page_count: Optional[int] = Field(0, description="Number of pages")
    file_size: Optional[int] = Field(0, description="File size in bytes")
    source_url: Optional[str] = Field(None, description="Source URL for web content")


class ExtractionOptions(BaseModel):
    """Options for document extraction."""
    use_ocr: bool = Field(True, description="Use OCR for image-based content")
    render_js: bool = Field(True, description="Render JavaScript for web content")
    extract_images: bool = Field(False, description="Extract images from documents")
    preserve_formatting: bool = Field(False, description="Preserve original formatting")
    language: Optional[str] = Field("eng", description="OCR language")
    quality: Optional[str] = Field("medium", description="OCR quality setting")
    timeout: int = Field(30, description="Processing timeout in seconds")


class DocumentProcessingRequest(BaseModel):
    """Request for document processing."""
    file_path: Optional[str] = Field(None, description="Path to local file")
    source_url: Optional[str] = Field(None, description="URL for web content")
    security_level: SecurityLevel = Field(SecurityLevel.BASIC, description="Security scanning level")
    extraction_options: Dict[str, Any] = Field(default_factory=lambda: ExtractionOptions().dict(), description="Extraction options")

    @validator('extraction_options', pre=True)
    def validate_extraction_options(cls, v):
        """Convert extraction_options to dict if it's an ExtractionOptions object."""
        if isinstance(v, ExtractionOptions):
            return v.dict()
        return v or {}

    @validator('source_url')
    def validate_url(cls, v, values):
        """Validate that either file_path or source_url is provided."""
        if not v and not values.get('file_path'):
            raise ValueError("Either file_path or source_url must be provided")
        return v


class SecurityValidationResult(BaseModel):
    """Result of security validation."""
    is_safe: bool = Field(..., description="Whether file passed security validation")
    threats_detected: List[str] = Field(default_factory=list, description="List of detected threats")
    warnings: List[str] = Field(default_factory=list, description="List of security warnings")
    file_hash: Optional[str] = Field(None, description="SHA-256 hash of file")
    scan_time: str = Field(..., description="Time of security scan")


class ProcessingStats(BaseModel):
    """Processing statistics."""
    pages_processed: int = Field(0, description="Number of pages processed")
    images_extracted: int = Field(0, description="Number of images extracted")
    ocr_processed: int = Field(0, description="Number of OCR processed images")
    characters_extracted: int = Field(0, description="Number of characters extracted")
    words_extracted: int = Field(0, description="Number of words extracted")


class DocumentProcessingResponse(BaseModel):
    """Response from document processing."""
    processing_id: str = Field(..., description="Unique processing identifier")
    success: bool = Field(..., description="Whether processing was successful")
    content: str = Field("", description="Extracted text content")
    metadata: DocumentMetadata = Field(..., description="Document metadata")
    processing_status: ProcessingStatus = Field(..., description="Processing status")
    processing_time: float = Field(..., description="Processing time in seconds")
    security_validation: Optional[SecurityValidationResult] = Field(None, description="Security validation results")
    extraction_stats: Optional[ProcessingStats] = Field(None, description="Extraction statistics")
    source_url: Optional[str] = Field(None, description="Source URL if web content")
    error: Optional[str] = Field(None, description="Error message if processing failed")


class BatchProcessingRequest(BaseModel):
    """Request for batch document processing."""
    documents: List[DocumentProcessingRequest] = Field(..., description="List of documents to process")
    security_level: SecurityLevel = Field(SecurityLevel.BASIC, description="Security scanning level")
    max_concurrent: int = Field(5, description="Maximum concurrent processes")
    fail_fast: bool = Field(False, description="Stop processing on first error")


class BatchProcessingResponse(BaseModel):
    """Response from batch document processing."""
    batch_id: str = Field(..., description="Unique batch identifier")
    results: List[DocumentProcessingResponse] = Field(..., description="Processing results")
    total_processed: int = Field(..., description="Total documents processed")
    successful: int = Field(..., description="Number of successful processes")
    failed: int = Field(..., description="Number of failed processes")
    processing_time: float = Field(..., description="Total processing time in seconds")


class DocumentSearchRequest(BaseModel):
    """Request for document search."""
    query: str = Field(..., min_length=1, description="Search query")
    document_ids: Optional[List[str]] = Field(None, description="Specific document IDs to search")
    file_types: Optional[List[str]] = Field(None, description="File types to include")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range filter")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")
    offset: int = Field(0, ge=0, description="Results offset")


class DocumentSearchResult(BaseModel):
    """Result from document search."""
    document_id: str = Field(..., description="Document ID")
    title: str = Field(..., description="Document title")
    content_snippet: str = Field(..., description="Content snippet containing match")
    score: float = Field(..., description="Relevance score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    highlights: Optional[List[str]] = Field(None, description="Highlighted search terms")


class DocumentUploadRequest(BaseModel):
    """Request for document upload."""
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="MIME type")
    content_type: str = Field(..., description="Content category")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    description: Optional[str] = Field(None, description="Document description")
    is_public: bool = Field(False, description="Whether document is public")
    security_scan: bool = Field(True, description="Whether to perform security scan")


class DocumentUploadResponse(BaseModel):
    """Response from document upload."""
    document_id: str = Field(..., description="Document ID")
    upload_url: str = Field(..., description="Presigned upload URL")
    expires_in: int = Field(..., description="Upload URL expiry time in seconds")
    max_file_size: int = Field(..., description="Maximum allowed file size")


class DocumentInfo(BaseModel):
    """Basic document information."""
    id: str = Field(..., description="Document ID")
    filename: str = Field(..., description="Filename")
    title: Optional[str] = Field(None, description="Document title")
    mime_type: str = Field(..., description="MIME type")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="Content category")
    status: ProcessingStatus = Field(..., description="Processing status")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    is_public: bool = Field(False, description="Whether document is public")
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")
    metadata: Optional[DocumentMetadata] = Field(None, description="Document metadata")


class DocumentListResponse(BaseModel):
    """Response from document listing."""
    documents: List[DocumentInfo] = Field(..., description="List of documents")
    total: int = Field(..., description="Total number of documents")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Documents per page")
    has_next: bool = Field(..., description="Whether next page exists")
    has_prev: bool = Field(..., description="Whether previous page exists")


class DocumentStats(BaseModel):
    """Document processing statistics."""
    total_documents: int = Field(0, description="Total number of documents")
    processing_documents: int = Field(0, description="Number of documents currently processing")
    processed_documents: int = Field(0, description="Number of successfully processed documents")
    failed_documents: int = Field(0, description="Number of failed documents")
    total_size: int = Field(0, description="Total size of all documents in bytes")
    average_processing_time: float = Field(0.0, description="Average processing time in seconds")
    documents_by_type: Dict[str, int] = Field(default_factory=dict, description="Documents count by type")
    documents_by_status: Dict[str, int] = Field(default_factory=dict, description="Documents count by status")


class ProcessingJob(BaseModel):
    """Background processing job information."""
    job_id: str = Field(..., description="Job identifier")
    document_id: str = Field(..., description="Document ID being processed")
    status: ProcessingStatus = Field(..., description="Job status")
    progress: float = Field(0.0, ge=0.0, le=1.0, description="Progress percentage")
    started_at: datetime = Field(..., description="Job start time")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    retry_count: int = Field(0, description="Number of retry attempts")


class JobQueueStats(BaseModel):
    """Job queue statistics."""
    pending_jobs: int = Field(0, description="Number of pending jobs")
    processing_jobs: int = Field(0, description="Number of jobs currently processing")
    completed_jobs: int = Field(0, description="Number of completed jobs")
    failed_jobs: int = Field(0, description="Number of failed jobs")
    average_wait_time: float = Field(0.0, description="Average wait time in seconds")
    average_processing_time: float = Field(0.0, description="Average processing time in seconds")


class OCRSettings(BaseModel):
    """OCR processing settings."""
    engine: str = Field("tesseract", description="OCR engine")
    language: str = Field("eng", description="OCR language")
    page_segmentation_mode: int = Field(6, description="Tesseract page segmentation mode")
    oem: int = Field(3, description="Tesseract OCR engine mode")
    confidence_threshold: float = Field(0.6, ge=0.0, le=1.0, description="Minimum confidence threshold")
    preprocess: bool = Field(True, description="Preprocess images for better OCR")
    enhance_contrast: bool = Field(True, description="Enhance image contrast")
    deskew: bool = Field(True, description="Deskew images")


class WebExtractionSettings(BaseModel):
    """Web content extraction settings."""
    timeout: int = Field(30, description="Request timeout in seconds")
    user_agent: str = Field("UPM.Plus Document Processor", description="User agent string")
    follow_redirects: bool = Field(True, description="Follow HTTP redirects")
    verify_ssl: bool = Field(True, description="Verify SSL certificates")
    render_javascript: bool = Field(True, description="Render JavaScript content")
    wait_time: int = Field(5, description="Wait time for JavaScript rendering")
    max_page_size: int = Field(50 * 1024 * 1024, description="Maximum page size in bytes")
    remove_selectors: List[str] = Field(default_factory=list, description="CSS selectors to remove")
    remove_elements: List[str] = Field(default_factory=lambda: ["script", "style", "nav", "footer", "header"], description="HTML elements to remove")


class ProcessingSettings(BaseModel):
    """Global processing settings."""
    ocr_settings: OCRSettings = Field(default_factory=OCRSettings)
    web_settings: WebExtractionSettings = Field(default_factory=WebExtractionSettings)
    max_file_size: int = Field(100 * 1024 * 1024, description="Maximum file size in bytes")
    chunk_size: int = Field(1000, description="Text chunk size")
    chunk_overlap: int = Field(200, description="Text chunk overlap")
    allowed_extensions: List[str] = Field(
        default_factory=lambda: [
            ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
            ".ppt", ".pptx", ".html", ".htm", ".md", ".csv",
            ".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"
        ],
        description="Allowed file extensions"
    )
    auto_tagging: bool = Field(True, description="Enable automatic document tagging")
    extract_metadata: bool = Field(True, description="Extract document metadata")
    generate_thumbnails: bool = Field(True, description="Generate document thumbnails")


class HealthCheckResponse(BaseModel):
    """Health check response for document processor."""
    status: str = Field(..., description="Overall health status")
    version: str = Field(..., description="Processor version")
    uptime: float = Field(..., description="Service uptime in seconds")
    dependencies: Dict[str, str] = Field(default_factory=dict, description="Dependency status")
    active_processes: int = Field(0, description="Number of active processes")
    queue_size: int = Field(0, description="Current queue size")
    last_activity: Optional[datetime] = Field(None, description="Last processing activity")
    error_rate: float = Field(0.0, description="Recent error rate")
    memory_usage: Optional[float] = Field(None, description="Memory usage percentage")