"""
Citation Tracking Service

Comprehensive citation management with automatic generation, validation,
formatting, analytics, and plagiarism detection integration.
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
import json
import hashlib
from collections import defaultdict, Counter
import uuid

import biblib.bib
from pybtex.database import parse_file, parse_string
from pybtex.database.input import bibtex

from app.core.config import get_settings
from app.models.document import DocumentChunk

logger = logging.getLogger(__name__)
settings = get_settings()


class CitationStyle(str, Enum):
    """Supported citation styles"""

    APA = "apa"  # American Psychological Association
    MLA = "mla"  # Modern Language Association
    CHICAGO = "chicago"  # Chicago Manual of Style
    IEEE = "ieee"  # Institute of Electrical and Electronics Engineers
    HARVARD = "harvard"  # Harvard referencing style
    VANCOUVER = "vancouver"  # Vancouver style
    AMA = "ama"  # American Medical Association
    APS = "aps"  # American Physical Society
    NATURE = "nature"  # Nature journal style
    NUMERIC = "numeric"  # Simple numeric style
    INLINE = "inline"  # Inline citation style
    FOOTNOTE = "footnote"  # Footnote style


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

    # Core bibliographic information
    title: str
    authors: List[str] = field(default_factory=list)
    publication_year: Optional[int] = None
    publication_date: Optional[str] = None

    # Source information
    source: str  # Journal, book title, website name, etc.
    publisher: Optional[str] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    edition: Optional[str] = None

    # Identifiers
    doi: Optional[str] = None
    isbn: Optional[str] = None
    issn: Optional[str] = None
    url: Optional[str] = None
    arxiv_id: Optional[str] = None
    pmid: Optional[str] = None

    # Additional metadata
    citation_type: CitationType = CitationType.JOURNAL_ARTICLE
    language: str = "en"
    abstract: Optional[str] = None
    keywords: List[str] = field(default_factory=list)

    # Quality indicators
    peer_reviewed: bool = False
    open_access: bool = False
    impact_factor: Optional[float] = None
    citation_count: Optional[int] = None

    # Internal tracking
    internal_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    verified: bool = False
    verification_date: Optional[datetime] = None


@dataclass
class Citation:
    """Complete citation with formatting and validation"""

    metadata: CitationMetadata
    formatted_citations: Dict[CitationStyle, str] = field(default_factory=dict)
    validation_status: ValidationStatus = ValidationStatus.UNKNOWN_SOURCE
    validation_errors: List[str] = field(default_factory=list)
    confidence_score: float = 0.0
    source_chunks: List[str] = field(default_factory=list)  # Chunk IDs that cite this
    citation_count: int = 0
    relevance_score: float = 0.0
    authority_score: float = 0.0
    recency_score: float = 0.0
    quality_metrics: Dict[str, Any] = field(default_factory=dict)
    plagiarism_risk: float = 0.0
    similar_citations: List[str] = field(
        default_factory=list
    )  # IDs of similar citations


@dataclass
class CitationRequest:
    """Citation generation request"""

    chunk: DocumentChunk
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


class CitationService:
    """Comprehensive citation tracking service"""

    def __init__(self):
        # Initialize citation database/cache
        self._citation_cache: Dict[str, Citation] = {}
        self._metadata_cache: Dict[str, CitationMetadata] = {}
        self._validation_cache: Dict[str, CitationValidationResult] = {}

        # Initialize citation formatters
        self._formatters = {}
        self._initialize_formatters()

        # Initialize validation rules
        self._validation_rules = {}
        self._initialize_validation_rules()

        # Initialize external service clients
        self._doi_resolver = None
        self._crossref_client = None
        self._initialize_external_clients()

        # Initialize patterns for citation extraction
        self._citation_patterns = []
        self._initialize_citation_patterns()

        logger.info("Citation Service initialized")

    def _initialize_formatters(self) -> None:
        """Initialize citation formatters for different styles"""
        # Define formatting templates for each style
        self._formatters = {
            CitationStyle.APA: self._format_apa,
            CitationStyle.MLA: self._format_mla,
            CitationStyle.CHICAGO: self._format_chicago,
            CitationStyle.IEEE: self._format_ieee,
            CitationStyle.HARVARD: self._format_harvard,
            CitationStyle.VANCOUVER: self._format_vancouver,
            CitationStyle.NUMERIC: self._format_numeric,
            CitationStyle.INLINE: self._format_inline,
        }

        logger.info("Citation formatters initialized")

    def _initialize_validation_rules(self) -> None:
        """Initialize validation rules for citations"""
        self._validation_rules = {
            "required_fields": {
                CitationType.BOOK: [
                    "title",
                    "authors",
                    "publication_year",
                    "publisher",
                ],
                CitationType.JOURNAL_ARTICLE: [
                    "title",
                    "authors",
                    "source",
                    "publication_year",
                    "volume",
                    "pages",
                ],
                CitationType.CONFERENCE_PAPER: [
                    "title",
                    "authors",
                    "source",
                    "publication_year",
                ],
                CitationType.THESIS: [
                    "title",
                    "authors",
                    "publication_year",
                    "publisher",
                ],
                CitationType.WEBSITE: ["title", "url", "publication_date"],
                CitationType.REPORT: [
                    "title",
                    "authors",
                    "publisher",
                    "publication_year",
                ],
            },
            "format_patterns": {
                "doi": r"^10\.\d+/.+$",
                "isbn": r"^(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]$",
                "url": r"^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$",
                "year": r"^(19|20)\d{2}$",
                "arxiv": r"^\d{4}\.\d{4,5}(v\d+)?$",
                "pmid": r"^\d+$",
            },
        }

        logger.info("Validation rules initialized")

    def _initialize_external_clients(self) -> None:
        """Initialize external service clients"""
        try:
            # Initialize DOI resolver (CrossRef, etc.)
            # In a real implementation, would use actual APIs
            self._doi_resolver = True  # Placeholder
            self._crossref_client = True  # Placeholder

            logger.info("External clients initialized")

        except Exception as e:
            logger.error(f"Failed to initialize external clients: {e}")

    def _initialize_citation_patterns(self) -> None:
        """Initialize regex patterns for citation extraction"""
        # Common citation patterns in text
        self._citation_patterns = [
            # DOI patterns
            r"(?:doi:|DOI:)?\s*(10\.\d+/.+?)(?:\s|$|\.)",
            # ArXiv patterns
            r"(?:arxiv:|arXiv:)?\s*(\d{4}\.\d{4,5}(?:v\d+)?)",
            # PubMed patterns
            r"(?:pmid:|PMID:)?\s*(\d+)",
            # URL patterns
            r"(?:https?:\/\/|www\.)[^\s\)]+(?:\s|$|\.)",
            # Author-year patterns (APA style)
            r"\(([A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+)*,\s*\d{4})\)",
            # Numeric patterns
            r"\[(\d+)\]",
            # Title patterns (in quotes)
            r'["""]([^"""]+)["""]',
        ]

        logger.info("Citation patterns initialized")

    async def process_citations(self, request: CitationRequest) -> List[Citation]:
        """
        Process citations from a document chunk

        Args:
            request: Citation processing request

        Returns:
            List of processed citations
        """
        try:
            citations = []

            # Extract citations from chunk content
            if request.extract_citations:
                extracted_citations = await self._extract_citations(
                    request.chunk, request.context
                )
                citations.extend(extracted_citations)

            # Validate citations
            if request.validate_citations:
                validated_citations = await self._validate_citations(citations, request)
                citations = validated_citations

            # Format citations
            if request.format_citations:
                formatted_citations = await self._format_citations(
                    citations, request.citation_styles
                )
                citations = formatted_citations

            # Calculate quality metrics
            for citation in citations:
                citation.quality_metrics = self._calculate_citation_quality(citation)
                citation.authority_score = self._calculate_authority_score(citation)
                citation.recency_score = self._calculate_recency_score(citation)

            # Check for duplicates
            citations = self._remove_duplicate_citations(citations)

            # Cache citations
            for citation in citations:
                self._citation_cache[citation.metadata.internal_id] = citation

            logger.info(
                f"Processed {len(citations)} citations from chunk {request.chunk.id}"
            )
            return citations

        except Exception as e:
            logger.error(f"Citation processing failed: {e}")
            return []

    async def _extract_citations(
        self, chunk: DocumentChunk, context: Optional[str] = None
    ) -> List[Citation]:
        """
        Extract citations from chunk content

        Args:
            chunk: Document chunk
            context: Additional context for extraction

        Returns:
            List of extracted citations
        """
        citations = []
        content = chunk.content + (f"\n{context}" if context else "")

        # Apply citation patterns
        for pattern in self._citation_patterns:
            matches = re.finditer(pattern, content, re.IGNORECASE)

            for match in matches:
                citation_text = match.group(1) if match.groups() else match.group(0)

                # Try to parse citation metadata
                metadata = await self._parse_citation_text(citation_text, content)

                if metadata:
                    citation = Citation(
                        metadata=metadata, source_chunks=[chunk.id], citation_count=0
                    )
                    citations.append(citation)

        # Extract from chunk metadata if available
        if chunk.metadata:
            metadata_citation = self._extract_from_metadata(chunk.metadata)
            if metadata_citation:
                citations.append(metadata_citation)

        return citations

    async def _parse_citation_text(
        self, citation_text: str, full_text: str
    ) -> Optional[CitationMetadata]:
        """
        Parse citation text to extract metadata

        Args:
            citation_text: Extracted citation text
            full_text: Full text for context

        Returns:
            Parsed citation metadata or None
        """
        try:
            # Check cache first
            cache_key = hashlib.md5(citation_text.encode()).hexdigest()
            if cache_key in self._metadata_cache:
                return self._metadata_cache[cache_key]

            metadata = CitationMetadata(title=citation_text)

            # DOI parsing
            doi_match = re.search(r"10\.\d+/.+", citation_text)
            if doi_match:
                doi = doi_match.group(0)
                metadata.doi = doi
                # Try to resolve DOI
                doi_metadata = await self._resolve_doi(doi)
                if doi_metadata:
                    metadata = self._merge_metadata(metadata, doi_metadata)

            # ArXiv parsing
            arxiv_match = re.search(r"\d{4}\.\d{4,5}(?:v\d+)?", citation_text)
            if arxiv_match:
                metadata.arxiv_id = arxiv_match.group(0)
                metadata.citation_type = CitationType.PREPRINT

            # PubMed parsing
            pmid_match = re.search(r"\b\d+\b", citation_text)
            if (
                pmid_match and len(pmid_match.group(0)) >= 5
            ):  # PMIDs are typically 5+ digits
                metadata.pmid = pmid_match.group(0)

            # URL parsing
            url_match = re.search(r"https?://[^\s]+", citation_text)
            if url_match:
                metadata.url = url_match.group(0)
                metadata.citation_type = CitationType.WEBSITE

            # Try to extract title (if not just a URL/DOI)
            if not metadata.doi and not metadata.url:
                # Look for title patterns
                title_candidates = self._extract_title_candidates(
                    citation_text, full_text
                )
                if title_candidates:
                    metadata.title = title_candidates[0]

            # Try to extract authors
            authors = self._extract_authors(citation_text, full_text)
            if authors:
                metadata.authors = authors

            # Try to extract year
            year_match = re.search(r"\b(19|20)\d{2}\b", citation_text)
            if year_match:
                metadata.publication_year = int(year_match.group(0))

            # Cache the metadata
            self._metadata_cache[cache_key] = metadata

            return metadata

        except Exception as e:
            logger.warning(f"Failed to parse citation text '{citation_text}': {e}")
            return None

    async def _resolve_doi(self, doi: str) -> Optional[CitationMetadata]:
        """
        Resolve DOI to get metadata

        Args:
            doi: DOI string

        Returns:
            Citation metadata from DOI resolution or None
        """
        try:
            # In a real implementation, would use CrossRef API or similar
            # For now, return mock data
            if "10.1000" in doi:  # Example DOI prefix
                return CitationMetadata(
                    title="Example Article Title",
                    authors=["Author One", "Author Two"],
                    source="Example Journal",
                    publication_year=2023,
                    doi=doi,
                    citation_type=CitationType.JOURNAL_ARTICLE,
                    peer_reviewed=True,
                )
            return None

        except Exception as e:
            logger.warning(f"DOI resolution failed for {doi}: {e}")
            return None

    def _merge_metadata(
        self, base: CitationMetadata, additional: CitationMetadata
    ) -> CitationMetadata:
        """
        Merge two metadata objects

        Args:
            base: Base metadata
            additional: Additional metadata to merge

        Returns:
            Merged metadata
        """
        # Create new metadata object
        merged = CitationMetadata(
            title=additional.title or base.title,
            authors=additional.authors or base.authors,
            publication_year=additional.publication_year or base.publication_year,
            publication_date=additional.publication_date or base.publication_date,
            source=additional.source or base.source,
            publisher=additional.publisher or base.publisher,
            volume=additional.volume or base.volume,
            issue=additional.issue or base.issue,
            pages=additional.pages or base.pages,
            edition=additional.edition or base.edition,
            doi=additional.doi or base.doi,
            isbn=additional.isbn or base.isbn,
            issn=additional.issn or base.issn,
            url=additional.url or base.url,
            arxiv_id=additional.arxiv_id or base.arxiv_id,
            pmid=additional.pmid or base.pmid,
            citation_type=additional.citation_type or base.citation_type,
            language=additional.language or base.language,
            abstract=additional.abstract or base.abstract,
            keywords=list(set(base.keywords + additional.keywords)),
            peer_reviewed=additional.peer_reviewed or base.peer_reviewed,
            open_access=additional.open_access or base.open_access,
            impact_factor=additional.impact_factor or base.impact_factor,
            citation_count=additional.citation_count or base.citation_count,
        )

        return merged

    def _extract_title_candidates(
        self, citation_text: str, full_text: str
    ) -> List[str]:
        """
        Extract possible title candidates from citation text

        Args:
            citation_text: Citation text
            full_text: Full text for context

        Returns:
            List of title candidates
        """
        titles = []

        # Look for quoted titles
        quoted_patterns = [r'["""]([^"""]+)["""]', r'"([^"]+)"', r"'([^']+)'"]

        for pattern in quoted_patterns:
            matches = re.findall(pattern, citation_text)
            titles.extend(matches)

        # Look for title-like phrases (capitalized, not too short)
        title_pattern = r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,5})\b"
        matches = re.findall(title_pattern, citation_text)

        for match in matches:
            if len(match) > 10 and len(match) < 100:  # Reasonable title length
                titles.append(match)

        return titles[:3]  # Return top 3 candidates

    def _extract_authors(self, citation_text: str, full_text: str) -> List[str]:
        """
        Extract author names from citation text

        Args:
            citation_text: Citation text
            full_text: Full text for context

        Returns:
            List of author names
        """
        authors = []

        # Common author patterns
        author_patterns = [
            r"([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)",  # Name formats
            r"([A-Z]\.\s*[A-Z][a-z]+)",  # Initial + last name
            r"([A-Z]\.\s*[A-Z]\.\s*[A-Z][a-z]+)",  # Two initials + last name
        ]

        for pattern in author_patterns:
            matches = re.findall(pattern, citation_text)
            for match in matches:
                if len(match) > 3 and match not in authors:
                    authors.append(match)

        # Look for "and" separators
        cleaned_authors = []
        for author in authors:
            if " and " in author:
                parts = author.split(" and ")
                cleaned_authors.extend(parts)
            else:
                cleaned_authors.append(author)

        return cleaned_authors[:5]  # Return up to 5 authors

    def _extract_from_metadata(self, metadata: Dict[str, Any]) -> Optional[Citation]:
        """
        Extract citation from chunk metadata

        Args:
            metadata: Chunk metadata

        Returns:
            Citation object or None
        """
        # Check for citation information in metadata
        if not metadata:
            return None

        citation_metadata = CitationMetadata()

        # Map metadata fields
        field_mapping = {
            "title": "title",
            "authors": "authors",
            "source": "source",
            "publication_year": "publication_year",
            "doi": "doi",
            "url": "url",
            "isbn": "isbn",
            "publisher": "publisher",
        }

        for metadata_field, citation_field in field_mapping.items():
            if metadata_field in metadata:
                setattr(citation_metadata, citation_field, metadata[metadata_field])

        # Determine citation type
        if "citation_type" in metadata:
            citation_metadata.citation_type = CitationType(metadata["citation_type"])
        elif metadata.get("source_type") == "journal":
            citation_metadata.citation_type = CitationType.JOURNAL_ARTICLE
        elif metadata.get("source_type") == "book":
            citation_metadata.citation_type = CitationType.BOOK

        # Only create citation if we have minimal information
        if citation_metadata.title or citation_metadata.doi or citation_metadata.url:
            return Citation(
                metadata=citation_metadata, source_chunks=[], citation_count=0
            )

        return None

    async def _validate_citations(
        self, citations: List[Citation], request: CitationRequest
    ) -> List[Citation]:
        """
        Validate citations

        Args:
            citations: List of citations to validate
            request: Citation request

        Returns:
            Validated citations
        """
        validated_citations = []

        for citation in citations:
            validation_result = await self._validate_citation(citation.metadata)

            citation.validation_status = validation_result.status
            citation.validation_errors = validation_result.errors
            citation.confidence_score = validation_result.confidence

            # Apply corrections if available
            if validation_result.corrected_metadata:
                citation.metadata = validation_result.corrected_metadata

            validated_citations.append(citation)

        return validated_citations

    async def _validate_citation(
        self, metadata: CitationMetadata
    ) -> CitationValidationResult:
        """
        Validate individual citation metadata

        Args:
            metadata: Citation metadata to validate

        Returns:
            Validation result
        """
        try:
            # Check cache first
            cache_key = hashlib.md5(str(metadata.__dict__).encode()).hexdigest()
            if cache_key in self._validation_cache:
                return self._validation_cache[cache_key]

            errors = []
            warnings = []
            suggestions = []
            confidence = 1.0

            # Check required fields for citation type
            required_fields = self._validation_rules["required_fields"].get(
                metadata.citation_type, []
            )

            for field in required_fields:
                value = getattr(metadata, field, None)
                if not value:
                    errors.append(f"Missing required field: {field}")
                    confidence -= 0.2

            # Validate DOI format
            if metadata.doi:
                doi_pattern = self._validation_rules["format_patterns"]["doi"]
                if not re.match(doi_pattern, metadata.doi):
                    errors.append("Invalid DOI format")
                    confidence -= 0.3

            # Validate ISBN format
            if metadata.isbn:
                isbn_pattern = self._validation_rules["format_patterns"]["isbn"]
                if not re.match(isbn_pattern, metadata.isbn):
                    warnings.append("ISBN format may be invalid")
                    confidence -= 0.1

            # Validate URL format
            if metadata.url:
                url_pattern = self._validation_rules["format_patterns"]["url"]
                if not re.match(url_pattern, metadata.url):
                    errors.append("Invalid URL format")
                    confidence -= 0.2

            # Validate publication year
            if metadata.publication_year:
                current_year = datetime.now().year
                if metadata.publication_year > current_year:
                    errors.append("Publication year is in the future")
                    confidence -= 0.3
                elif metadata.publication_year < 1900:
                    warnings.append("Publication year is very old")
                    confidence -= 0.1

            # Validate ArXiv ID
            if metadata.arxiv_id:
                arxiv_pattern = self._validation_rules["format_patterns"]["arxiv"]
                if not re.match(arxiv_pattern, metadata.arxiv_id):
                    warnings.append("ArXiv ID format may be invalid")
                    confidence -= 0.1

            # Generate suggestions
            if not metadata.authors and metadata.title:
                suggestions.append(
                    "Consider adding authors for better citation quality"
                )

            if not metadata.publication_year and metadata.publication_date:
                suggestions.append("Extract publication year from publication date")

            # Determine overall status
            if errors:
                status = ValidationStatus.INVALID_FORMAT
            elif warnings:
                status = ValidationStatus.VALID  # Valid but with warnings
            else:
                status = ValidationStatus.VALID

            # Create validation result
            result = CitationValidationResult(
                citation_id=metadata.internal_id,
                status=status,
                errors=errors,
                warnings=warnings,
                suggestions=suggestions,
                confidence=max(confidence, 0.0),
            )

            # Cache result
            self._validation_cache[cache_key] = result

            return result

        except Exception as e:
            logger.error(f"Citation validation failed: {e}")
            return CitationValidationResult(
                citation_id=metadata.internal_id,
                status=ValidationStatus.VERIFICATION_FAILED,
                errors=[f"Validation error: {str(e)}"],
                warnings=[],
                suggestions=[],
                confidence=0.0,
            )

    async def _format_citations(
        self, citations: List[Citation], styles: List[CitationStyle]
    ) -> List[Citation]:
        """
        Format citations in specified styles

        Args:
            citations: List of citations to format
            styles: Citation styles to format in

        Returns:
            Citations with formatted strings
        """
        for citation in citations:
            for style in styles:
                if style in self._formatters:
                    try:
                        formatted = self._formatters[style](citation.metadata)
                        citation.formatted_citations[style] = formatted
                    except Exception as e:
                        logger.warning(f"Failed to format citation in {style}: {e}")
                        citation.formatted_citations[style] = self._fallback_format(
                            citation.metadata
                        )

        return citations

    def _format_apa(self, metadata: CitationMetadata) -> str:
        """Format citation in APA style"""
        authors = self._format_authors(metadata.authors, "apa")

        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f"{authors} ({metadata.publication_year}). {metadata.title}. *{metadata.source}*, "
            if metadata.volume:
                citation += f"*{metadata.volume}*"
            if metadata.issue:
                citation += f"({metadata.issue}), "
            if metadata.pages:
                citation += f"{metadata.pages}."
            else:
                citation += "."

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{authors} ({metadata.publication_year}). *{metadata.title}* ({metadata.edition} ed.). {metadata.publisher}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f"{authors} ({metadata.publication_date or metadata.publication_year}). *{metadata.title}*. {metadata.source}. {metadata.url}"

        else:
            # Generic format
            citation = f"{authors} ({metadata.publication_year}). {metadata.title}. {metadata.source}."

        if metadata.doi:
            citation += f" https://doi.org/{metadata.doi}"

        return citation

    def _format_mla(self, metadata: CitationMetadata) -> str:
        """Format citation in MLA style"""
        authors = self._format_authors(metadata.authors, "mla")

        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f'{authors}. "{metadata.title}." *{metadata.source}*, vol. {metadata.volume}, no. {metadata.issue}, {metadata.publication_year}, pp. {metadata.pages}.'

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{authors}. *{metadata.title}*. {metadata.publisher}, {metadata.publication_year}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f'{authors}. "{metadata.title}." *{metadata.source}*, {metadata.publication_date or metadata.publication_year}, {metadata.url}.'

        else:
            # Generic format
            citation = f'{authors}. "{metadata.title}." *{metadata.source}*, {metadata.publication_year}.'

        return citation

    def _format_chicago(self, metadata: CitationMetadata) -> str:
        """Format citation in Chicago style"""
        authors = self._format_authors(metadata.authors, "chicago")

        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f'{authors}. "{metadata_title}." {metadata.source} {metadata.volume}, no. {metadata.issue} ({metadata.publication_year}): {metadata_pages}.'

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{authors}. {metadata.title}. {metadata.edition} ed. {metadata.publisher}: {metadata.publication_year}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f'{authors}. "{metadata_title}." {metadata.source}. Last modified {metadata.publication_date or metadata.publication_year}. {metadata.url}.'

        else:
            # Generic format
            citation = f'{authors}. "{metadata_title}." {metadata_source} ({metadata_publication_year}).'

        return citation

    def _format_ieee(self, metadata: CitationMetadata) -> str:
        """Format citation in IEEE style"""
        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f'{self._format_ieee_authors(metadata.authors)}, "{metadata_title}," {metadata_source}, vol. {metadata_volume}, no. {metadata_issue}, pp. {metadata_pages}, {metadata_publication_year}.'

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{self._format_ieee_authors(metadata.authors)}, *{metadata_title}*, {metadata.edition} ed., {metadata.publisher}, {metadata_publication_year}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f'{self._format_ieee_authors(metadata.authors)}, "{metadata_title}," {metadata_source}, {metadata_publication_date or metadata_publication_year}. [Online]. Available: {metadata.url}'

        else:
            # Generic format
            citation = f'{self._format_ieee_authors(metadata.authors)}, "{metadata_title}," {metadata_source}, {metadata_publication_year}.'

        return citation

    def _format_harvard(self, metadata: CitationMetadata) -> str:
        """Format citation in Harvard style"""
        authors = self._format_authors(metadata.authors, "harvard")

        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f'{authors} ({metadata.publication_year}) "{metadata_title}." {metadata_source} {metadata_volume}({metadata_issue}), pp. {metadata_pages}.'

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{authors} ({metadata_publication_year}) *{metadata_title}*. {metadata.edition} edn. {metadata.publisher}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f'{authors} ({metadata_publication_date or metadata_publication_year}) "{metadata_title}." [online] {metadata_source}. Available at: {metadata.url} [Accessed {datetime.now().strftime("%d %B %Y")}].'

        else:
            # Generic format
            citation = f'{authors} ({metadata_publication_year}) "{metadata_title}." {metadata_source}.'

        return citation

    def _format_vancouver(self, metadata: CitationMetadata) -> str:
        """Format citation in Vancouver style"""
        authors = self._format_vancouver_authors(metadata.authors)

        if metadata.citation_type == CitationType.JOURNAL_ARTICLE:
            citation = f"{authors}. {metadata_title}. {metadata_source}. {metadata_publication_year};{metadata_volume}({metadata_issue}):{metadata_pages}."

        elif metadata.citation_type == CitationType.BOOK:
            citation = f"{authors}. {metadata_title}. {metadata.edition} ed. {metadata.publisher}; {metadata_publication_year}."

        elif metadata.citation_type == CitationType.WEBSITE:
            citation = f"{authors}. {metadata_title} [Internet]. {metadata_publisher}; {metadata_publication_date or metadata_publication_year} [cited {datetime.now().strftime('%Y %b %d')}]. Available from: {metadata_url}."

        else:
            # Generic format
            citation = f"{authors}. {metadata_title}. {metadata_source}. {metadata_publication_year}."

        return citation

    def _format_numeric(self, metadata: CitationMetadata) -> str:
        """Format citation in simple numeric style"""
        return self._format_apa(metadata)  # Use APA as base

    def _format_inline(self, metadata: CitationMetadata) -> str:
        """Format citation for inline use"""
        authors = metadata.authors[:2]  # First two authors
        if len(metadata.authors) > 2:
            authors.append("et al.")

        author_str = ", ".join(authors)
        return f"({author_str}, {metadata.publication_year})"

    def _format_authors(self, authors: List[str], style: str) -> str:
        """Format author names according to citation style"""
        if not authors:
            return "Anonymous"

        if style == "apa":
            if len(authors) == 1:
                return authors[0]
            elif len(authors) == 2:
                return f"{authors[0]} & {authors[1]}"
            else:
                return f"{authors[0]}, {authors[1]}, ..., {authors[-1]}"

        elif style == "mla":
            if len(authors) == 1:
                return authors[0]
            elif len(authors) == 2:
                return f"{authors[0]} and {authors[1]}"
            else:
                return f"{authors[0]}, et al."

        elif style == "chicago":
            if len(authors) == 1:
                return authors[0]
            elif len(authors) == 2:
                return f"{authors[0]} and {authors[1]}"
            else:
                return f"{authors[0]} et al."

        elif style == "harvard":
            if len(authors) == 1:
                return authors[0]
            elif len(authors) <= 3:
                return ", ".join(authors)
            else:
                return f"{authors[0]} et al."

        else:
            return ", ".join(authors)

    def _format_ieee_authors(self, authors: List[str]) -> str:
        """Format authors for IEEE style"""
        if not authors:
            return "Anon."

        formatted_authors = []
        for author in authors[:7]:  # IEEE limits to 7 authors
            # Convert to "First Initial. Last Name" format
            parts = author.split()
            if len(parts) >= 2:
                first_initial = parts[0][0] + "."
                last_name = " ".join(parts[1:])
                formatted_authors.append(f"{first_initial} {last_name}")
            else:
                formatted_authors.append(author)

        if len(authors) > 7:
            formatted_authors.append("et al.")

        return ", ".join(formatted_authors)

    def _format_vancouver_authors(self, authors: List[str]) -> str:
        """Format authors for Vancouver style"""
        if not authors:
            return "Anonymous."

        # Vancouver style uses numbered references, so just format names
        if len(authors) <= 6:
            return ", ".join(authors)
        else:
            # First 6 authors followed by et al.
            return ", ".join(authors[:6]) + ", et al."

    def _fallback_format(self, metadata: CitationMetadata) -> str:
        """Fallback formatting when style-specific formatter fails"""
        authors = ", ".join(metadata.authors) if metadata.authors else "Unknown"
        return f"{authors}. {metadata.title}. {metadata.source}, {metadata.publication_year}."

    def _remove_duplicate_citations(self, citations: List[Citation]) -> List[Citation]:
        """
        Remove duplicate citations based on DOI, ISBN, or title+authors

        Args:
            citations: List of citations

        Returns:
            Deduplicated citations
        """
        seen = set()
        unique_citations = []

        for citation in citations:
            # Create a key for duplicate detection
            if citation.metadata.doi:
                key = f"doi:{citation.metadata.doi}"
            elif citation.metadata.isbn:
                key = f"isbn:{citation.metadata.isbn}"
            else:
                # Use title + first author
                first_author = (
                    citation.metadata.authors[0] if citation.metadata.authors else ""
                )
                key = f"title:{citation.metadata.title.lower()},author:{first_author.lower()}"

            if key not in seen:
                seen.add(key)
                unique_citations.append(citation)
            else:
                # Update existing citation with additional source chunks
                for existing_citation in unique_citations:
                    existing_key = self._get_citation_key(existing_citation)
                    if existing_key == key:
                        existing_citation.source_chunks.extend(citation.source_chunks)
                        break

        return unique_citations

    def _get_citation_key(self, citation: Citation) -> str:
        """Get deduplication key for citation"""
        if citation.metadata.doi:
            return f"doi:{citation.metadata.doi}"
        elif citation.metadata.isbn:
            return f"isbn:{citation.metadata.isbn}"
        else:
            first_author = (
                citation.metadata.authors[0] if citation.metadata.authors else ""
            )
            return (
                f"title:{citation.metadata.title.lower()},author:{first_author.lower()}"
            )

    def _calculate_citation_quality(self, citation: Citation) -> Dict[str, float]:
        """
        Calculate quality metrics for a citation

        Args:
            citation: Citation to evaluate

        Returns:
            Quality metrics dictionary
        """
        metrics = {}
        metadata = citation.metadata

        # Completeness score
        required_fields = ["title", "authors", "source", "publication_year"]
        complete_fields = sum(
            1 for field in required_fields if getattr(metadata, field, None)
        )
        metrics["completeness"] = complete_fields / len(required_fields)

        # Identifier score (having DOI, ISBN, etc.)
        identifiers = sum(
            1
            for identifier in [metadata.doi, metadata.isbn, metadata.url]
            if identifier
        )
        metrics["identifier_score"] = min(identifiers / 2.0, 1.0)

        # Authority score
        if metadata.peer_reviewed:
            metrics["authority_boost"] = 0.3
        else:
            metrics["authority_boost"] = 0.0

        # Recency score
        if metadata.publication_year:
            current_year = datetime.now().year
            age = current_year - metadata.publication_year
            if age <= 2:
                metrics["recency_boost"] = 0.2
            elif age <= 5:
                metrics["recency_boost"] = 0.1
            else:
                metrics["recency_boost"] = 0.0
        else:
            metrics["recency_boost"] = 0.0

        # Overall quality score
        metrics["overall"] = (
            metrics["completeness"] * 0.4
            + metrics["identifier_score"] * 0.3
            + metrics["authority_boost"] * 0.2
            + metrics["recency_boost"] * 0.1
        )

        return metrics

    def _calculate_authority_score(self, citation: Citation) -> float:
        """
        Calculate authority score for a citation

        Args:
            citation: Citation to evaluate

        Returns:
            Authority score (0-1)
        """
        score = 0.5  # Base score

        metadata = citation.metadata

        # Peer-reviewed boost
        if metadata.peer_reviewed:
            score += 0.3

        # Impact factor boost
        if metadata.impact_factor:
            if metadata.impact_factor > 5:
                score += 0.2
            elif metadata.impact_factor > 2:
                score += 0.1

        # Citation count boost
        if metadata.citation_count:
            if metadata.citation_count > 1000:
                score += 0.2
            elif metadata.citation_count > 100:
                score += 0.1

        # Publisher reputation (simplified)
        reputable_publishers = [
            "elsevier",
            "springer",
            "nature",
            "science",
            "ieee",
            "acm",
            "oxford university",
            "cambridge university",
        ]
        if metadata.publisher and any(
            pub in metadata.publisher.lower() for pub in reputable_publishers
        ):
            score += 0.1

        return min(score, 1.0)

    def _calculate_recency_score(self, citation: Citation) -> float:
        """
        Calculate recency score for a citation

        Args:
            citation: Citation to evaluate

        Returns:
            Recency score (0-1)
        """
        if not citation.metadata.publication_year:
            return 0.5  # Default for unknown dates

        current_year = datetime.now().year
        age = current_year - citation.metadata.publication_year

        if age <= 1:
            return 1.0
        elif age <= 2:
            return 0.9
        elif age <= 3:
            return 0.8
        elif age <= 5:
            return 0.6
        elif age <= 10:
            return 0.4
        elif age <= 20:
            return 0.2
        else:
            return 0.1

    async def analyze_citations(self, citations: List[Citation]) -> CitationAnalysis:
        """
        Analyze citations and generate comprehensive statistics

        Args:
            citations: List of citations to analyze

        Returns:
            Citation analysis results
        """
        if not citations:
            return CitationAnalysis(
                total_citations=0,
                unique_sources=0,
                citation_distribution={},
                authority_distribution={},
                recency_distribution={},
                quality_metrics={},
                missing_citations=[],
                potential_duplicates=[],
                citation_density=0.0,
                bibliographic_diversity=0.0,
                temporal_coverage={},
                geographical_coverage={},
            )

        # Basic counts
        total_citations = len(citations)
        unique_sources = len(
            set(c.metadata.source for c in citations if c.metadata.source)
        )

        # Citation type distribution
        type_counts = Counter(c.metadata.citation_type for c in citations)
        citation_distribution = {
            CitationType(t): count for t, count in type_counts.items()
        }

        # Authority distribution
        authority_ranges = {"high": 0, "medium": 0, "low": 0}
        for citation in citations:
            if citation.authority_score > 0.7:
                authority_ranges["high"] += 1
            elif citation.authority_score > 0.4:
                authority_ranges["medium"] += 1
            else:
                authority_ranges["low"] += 1
        authority_distribution = authority_ranges

        # Recency distribution
        recency_ranges = {"recent": 0, "moderate": 0, "old": 0}
        for citation in citations:
            if citation.recency_score > 0.7:
                recency_ranges["recent"] += 1
            elif citation.recency_score > 0.4:
                recency_ranges["moderate"] += 1
            else:
                recency_ranges["old"] += 1
        recency_distribution = recency_ranges

        # Quality metrics
        quality_scores = [c.quality_metrics.get("overall", 0) for c in citations]
        quality_metrics = {
            "average_quality": sum(quality_scores) / len(quality_scores)
            if quality_scores
            else 0,
            "quality_std": self._calculate_std(quality_scores) if quality_scores else 0,
            "high_quality_count": sum(1 for s in quality_scores if s > 0.8),
            "low_quality_count": sum(1 for s in quality_scores if s < 0.5),
        }

        # Missing citations (would be identified during text analysis)
        missing_citations = []  # Placeholder

        # Potential duplicates
        duplicates = self._find_potential_duplicates(citations)

        # Citation density (citations per chunk or word)
        citation_density = total_citations / max(
            len(set(c.source_chunks for c in citations)), 1
        )

        # Bibliographic diversity
        source_types = set(c.metadata.citation_type for c in citations)
        bibliographic_diversity = len(source_types) / max(len(CitationType), 1)

        # Temporal coverage
        years = [
            c.metadata.publication_year
            for c in citations
            if c.metadata.publication_year
        ]
        temporal_coverage = {}
        if years:
            temporal_ranges = {
                "2020s": sum(1 for y in years if y >= 2020),
                "2010s": sum(1 for y in years if 2010 <= y < 2020),
                "2000s": sum(1 for y in years if 2000 <= y < 2010),
                "1990s": sum(1 for y in years if 1990 <= y < 2000),
                "pre-1990": sum(1 for y in years if y < 1990),
            }
            temporal_coverage = {k: v for k, v in temporal_ranges.items() if v > 0}

        # Geographical coverage (simplified - would use publisher location)
        geographical_coverage = {}  # Placeholder

        return CitationAnalysis(
            total_citations=total_citations,
            unique_sources=unique_sources,
            citation_distribution=citation_distribution,
            authority_distribution=authority_distribution,
            recency_distribution=recency_distribution,
            quality_metrics=quality_metrics,
            missing_citations=missing_citations,
            potential_duplicates=duplicates,
            citation_density=citation_density,
            bibliographic_diversity=bibliographic_diversity,
            temporal_coverage=temporal_coverage,
            geographical_coverage=geographical_coverage,
        )

    def _find_potential_duplicates(self, citations: List[Citation]) -> List[List[str]]:
        """
        Find potentially duplicate citations

        Args:
            citations: List of citations

        Returns:
            List of duplicate groups (lists of citation IDs)
        """
        duplicates = []
        processed = set()

        for i, citation1 in enumerate(citations):
            if citation1.metadata.internal_id in processed:
                continue

            duplicate_group = [citation1.metadata.internal_id]

            for j, citation2 in enumerate(citations[i + 1 :], i + 1):
                if citation2.metadata.internal_id in processed:
                    continue

                # Check for duplicates
                if self._are_duplicates(citation1, citation2):
                    duplicate_group.append(citation2.metadata.internal_id)
                    processed.add(citation2.metadata.internal_id)

            if len(duplicate_group) > 1:
                duplicates.append(duplicate_group)
                processed.add(citation1.metadata.internal_id)

        return duplicates

    def _are_duplicates(self, citation1: Citation, citation2: Citation) -> bool:
        """
        Check if two citations are duplicates

        Args:
            citation1: First citation
            citation2: Second citation

        Returns:
            True if citations are duplicates
        """
        # Exact DOI match
        if citation1.metadata.doi and citation2.metadata.doi:
            if citation1.metadata.doi.lower() == citation2.metadata.doi.lower():
                return True

        # Exact ISBN match
        if citation1.metadata.isbn and citation2.metadata.isbn:
            if citation1.metadata.isbn.replace("-", "").replace(
                " ", ""
            ) == citation2.metadata.isbn.replace("-", "").replace(" ", ""):
                return True

        # Title + first author similarity
        if citation1.metadata.title and citation2.metadata.title:
            title_similarity = self._calculate_string_similarity(
                citation1.metadata.title.lower(), citation2.metadata.title.lower()
            )

            if title_similarity > 0.8:
                # Check first author
                if citation1.metadata.authors and citation2.metadata.authors:
                    author1 = citation1.metadata.authors[0].lower()
                    author2 = citation2.metadata.authors[0].lower()
                    author_similarity = self._calculate_string_similarity(
                        author1, author2
                    )

                    if author_similarity > 0.8:
                        return True

        return False

    def _calculate_string_similarity(self, str1: str, str2: str) -> float:
        """
        Calculate similarity between two strings

        Args:
            str1: First string
            str2: Second string

        Returns:
            Similarity score (0-1)
        """
        # Simple Jaccard similarity
        words1 = set(str1.split())
        words2 = set(str2.split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))

        return intersection / union if union > 0 else 0.0

    def _calculate_std(self, values: List[float]) -> float:
        """Calculate standard deviation"""
        if len(values) < 2:
            return 0.0

        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return variance**0.5

    async def check_plagiarism_risk(
        self, citations: List[Citation], content: str
    ) -> Dict[str, Any]:
        """
        Check plagiarism risk based on citation coverage

        Args:
            citations: List of citations
            content: Content to check

        Returns:
            Plagiarism risk assessment
        """
        if not citations:
            return {
                "risk_level": "high",
                "risk_score": 0.9,
                "uncited_content_ratio": 1.0,
                "suggestions": [
                    "Add citations to support your claims",
                    "Ensure all sources are properly credited",
                ],
            }

        # Calculate citation coverage
        total_words = len(content.split())
        cited_sections = 0

        # Simple heuristic: count words that appear near citations
        for citation in citations:
            for chunk_id in citation.source_chunks:
                # This is simplified - would need actual chunk content
                cited_sections += 100  # Estimate words per citation

        citation_coverage = (
            min(cited_sections / total_words, 1.0) if total_words > 0 else 0
        )

        # Calculate risk score
        risk_score = 1.0 - citation_coverage

        # Determine risk level
        if risk_score > 0.7:
            risk_level = "high"
        elif risk_score > 0.4:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Generate suggestions
        suggestions = []
        if risk_score > 0.5:
            suggestions.append("Add more citations to support your arguments")
        if risk_score > 0.3:
            suggestions.append("Review content for uncited claims")
        if citation_coverage < 0.3:
            suggestions.append("Consider adding background citations")

        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "citation_coverage": citation_coverage,
            "uncited_content_ratio": 1.0 - citation_coverage,
            "total_citations": len(citations),
            "content_length": total_words,
            "suggestions": suggestions,
        }

    def get_service_metrics(self) -> Dict[str, Any]:
        """
        Get service performance metrics

        Returns:
            Service metrics dictionary
        """
        return {
            "citation_cache_size": len(self._citation_cache),
            "metadata_cache_size": len(self._metadata_cache),
            "validation_cache_size": len(self._validation_cache),
            "supported_styles": [style.value for style in CitationStyle],
            "supported_types": [type.value for type in CitationType],
            "formatters_loaded": list(self._formatters.keys()),
            "validation_rules_loaded": len(self._validation_rules) > 0,
            "external_clients_available": {
                "doi_resolver": self._doi_resolver is not None,
                "crossref_client": self._crossref_client is not None,
            },
        }
