"""
Citation Service Package

Re-exports all public types for backward compatibility.
"""

from .models import (
    CitationStyle,
    CitationType,
    ValidationStatus,
    CitationMetadata,
    Citation,
    CitationRequest,
    CitationAnalysis,
    CitationValidationResult,
)
from .service import CitationService

__all__ = [
    "CitationStyle",
    "CitationType",
    "ValidationStatus",
    "CitationMetadata",
    "Citation",
    "CitationRequest",
    "CitationAnalysis",
    "CitationValidationResult",
    "CitationService",
]
