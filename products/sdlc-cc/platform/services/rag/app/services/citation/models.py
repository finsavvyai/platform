"""
Citation Models

Data models, enums, and request/response types for citation tracking.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional


class CitationStyle(str, Enum):
    """Supported citation styles"""

    APA = "apa"
    MLA = "mla"
    CHICAGO = "chicago"
    IEEE = "ieee"
    HARVARD = "harvard"
    VANCOUVER = "vancouver"
    AMA = "ama"
    APS = "aps"
    NATURE = "nature"
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


class ValidationStatus(str, Enum):
    """Citation validation status"""

    VALID = "valid"
    INVALID_FORMAT = "invalid_format"
    MISSING_REQUIRED_FIELDS = "missing_required_fields"
    INVALID_DATE = "invalid_date"
    INVALID_DOI = "invalid_doi"
    INVALID_URL = "invalid_url"
    DUPLICATE = "duplicate"
    VERIFICATION_FAILED = "verification_failed"
    UNKNOWN_SOURCE = "unknown_source"


@dataclass
class CitationMetadata:
    """Citation metadata information"""

    title: str = ""
    authors: List[str] = field(default_factory=list)
    publication_year: Optional[int] = None
    publication_date: Optional[str] = None
    source: str = ""
    publisher: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    edition: Optional[str] = None
    doi: Optional[str] = None
    isbn: Optional[str] = None
    issn: Optional[str] = None
    url: Optional[str] = None
    arxiv_id: Optional[str] = None
    pmid: Optional[str] = None
    citation_type: CitationType = CitationType.JOURNAL_ARTICLE
    language: str = "en"
    abstract: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    peer_reviewed: bool = False
    open_access: bool = False
    impact_factor: Optional[float] = None
    citation_count: Optional[int] = None
    internal_id: str = field(
        default_factory=lambda: str(uuid.uuid4())
    )
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    verified: bool = False
    verification_date: Optional[datetime] = None


@dataclass
class Citation:
    """Complete citation with formatting and validation"""

    metadata: CitationMetadata
    formatted_citations: Dict[CitationStyle, str] = field(
        default_factory=dict
    )
    validation_status: ValidationStatus = ValidationStatus.UNKNOWN_SOURCE
    validation_errors: List[str] = field(default_factory=list)
    confidence_score: float = 0.0
    source_chunks: List[str] = field(default_factory=list)
    citation_count: int = 0
    relevance_score: float = 0.0
    authority_score: float = 0.0
    recency_score: float = 0.0
    quality_metrics: Dict[str, Any] = field(default_factory=dict)
    plagiarism_risk: float = 0.0
    similar_citations: List[str] = field(default_factory=list)


@dataclass
class CitationRequest:
    """Citation generation request"""

    chunk: Any = None  # DocumentChunk
    extract_citations: bool = True
    validate_citations: bool = True
    format_citations: bool = True
    citation_styles: List[CitationStyle] = field(
        default_factory=lambda: [CitationStyle.APA]
    )
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    context: Optional[str] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None


@dataclass
class CitationAnalysis:
    """Citation analysis results"""

    total_citations: int
    unique_sources: int
    citation_distribution: Dict[CitationType, int]
    authority_distribution: Dict[str, int]
    recency_distribution: Dict[str, int]
    quality_metrics: Dict[str, float]
    missing_citations: List[str]
    potential_duplicates: List[List[str]]
    citation_density: float
    bibliographic_diversity: float
    temporal_coverage: Dict[str, int]
    geographical_coverage: Dict[str, int]


@dataclass
class CitationValidationResult:
    """Citation validation result"""

    citation_id: str
    status: ValidationStatus
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]
    corrected_metadata: Optional[CitationMetadata] = None
    verification_sources: List[str] = field(default_factory=list)
    confidence: float = 0.0
