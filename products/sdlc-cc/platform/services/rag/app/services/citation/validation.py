"""
Citation Validation

Validate citation metadata against rules and format patterns.
"""

import re
import hashlib
import logging
from datetime import datetime
from typing import Dict, List

from .models import (
    CitationMetadata,
    CitationType,
    CitationValidationResult,
    ValidationStatus,
)

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {
    CitationType.BOOK: ["title", "authors", "publication_year", "publisher"],
    CitationType.JOURNAL_ARTICLE: ["title", "authors", "source", "publication_year", "volume", "pages"],
    CitationType.CONFERENCE_PAPER: ["title", "authors", "source", "publication_year"],
    CitationType.THESIS: ["title", "authors", "publication_year", "publisher"],
    CitationType.WEBSITE: ["title", "url", "publication_date"],
    CitationType.REPORT: ["title", "authors", "publisher", "publication_year"],
}

FORMAT_PATTERNS = {
    "doi": r"^10\.\d+/.+$",
    "url": r"^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$",
    "arxiv": r"^\d{4}\.\d{4,5}(v\d+)?$",
}


async def validate_citation(
    metadata: CitationMetadata,
    validation_cache: Dict[str, CitationValidationResult],
) -> CitationValidationResult:
    """Validate individual citation metadata."""
    try:
        cache_key = hashlib.md5(
            str(metadata.__dict__).encode()
        ).hexdigest()
        if cache_key in validation_cache:
            return validation_cache[cache_key]

        errors: List[str] = []
        warnings: List[str] = []
        suggestions: List[str] = []
        confidence = 1.0

        required = REQUIRED_FIELDS.get(metadata.citation_type, [])
        for f in required:
            if not getattr(metadata, f, None):
                errors.append(f"Missing required field: {f}")
                confidence -= 0.2

        if metadata.doi:
            if not re.match(FORMAT_PATTERNS["doi"], metadata.doi):
                errors.append("Invalid DOI format")
                confidence -= 0.3

        if metadata.url:
            if not re.match(FORMAT_PATTERNS["url"], metadata.url):
                errors.append("Invalid URL format")
                confidence -= 0.2

        if metadata.publication_year:
            if metadata.publication_year > datetime.now().year:
                errors.append("Publication year is in the future")
                confidence -= 0.3
            elif metadata.publication_year < 1900:
                warnings.append("Publication year is very old")
                confidence -= 0.1

        if metadata.arxiv_id:
            if not re.match(FORMAT_PATTERNS["arxiv"], metadata.arxiv_id):
                warnings.append("ArXiv ID format may be invalid")
                confidence -= 0.1

        if not metadata.authors and metadata.title:
            suggestions.append(
                "Consider adding authors for better citation quality"
            )

        if errors:
            status = ValidationStatus.INVALID_FORMAT
        elif warnings:
            status = ValidationStatus.VALID
        else:
            status = ValidationStatus.VALID

        result = CitationValidationResult(
            citation_id=metadata.internal_id,
            status=status,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions,
            confidence=max(confidence, 0.0),
        )
        validation_cache[cache_key] = result
        return result

    except Exception as e:
        logger.error(f"Citation validation failed: {e}")
        return CitationValidationResult(
            citation_id=metadata.internal_id,
            status=ValidationStatus.VERIFICATION_FAILED,
            errors=[f"Validation error: {e}"],
            warnings=[], suggestions=[], confidence=0.0,
        )
