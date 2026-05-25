"""
Citation Service

Main service class for comprehensive citation management.
"""

import logging
from collections import Counter
from datetime import datetime
from typing import Dict, Any, List

from app.core.config import get_settings

from .models import (
    Citation, CitationMetadata, CitationRequest, CitationAnalysis,
    CitationStyle, CitationType, CitationValidationResult,
)
from .extraction import extract_citations
from .validation import validate_citation
from .formatting import FORMATTER_MAP, fallback_format

logger = logging.getLogger(__name__)
settings = get_settings()


class CitationService:
    """Comprehensive citation tracking service"""

    def __init__(self):
        self._citation_cache: Dict[str, Citation] = {}
        self._metadata_cache: Dict[str, CitationMetadata] = {}
        self._validation_cache: Dict[str, CitationValidationResult] = {}
        logger.info("Citation Service initialized")

    async def process_citations(
        self, request: CitationRequest
    ) -> List[Citation]:
        try:
            citations: List[Citation] = []
            if request.extract_citations:
                extracted = await extract_citations(
                    request.chunk, request.context, self._metadata_cache
                )
                citations.extend(extracted)
            if request.validate_citations:
                for c in citations:
                    vr = await validate_citation(c.metadata, self._validation_cache)
                    c.validation_status = vr.status
                    c.validation_errors = vr.errors
                    c.confidence_score = vr.confidence
                    if vr.corrected_metadata:
                        c.metadata = vr.corrected_metadata
            if request.format_citations:
                for c in citations:
                    for style in request.citation_styles:
                        if style in FORMATTER_MAP:
                            try:
                                c.formatted_citations[style] = FORMATTER_MAP[style](c.metadata)
                            except Exception:
                                c.formatted_citations[style] = fallback_format(c.metadata)
            for c in citations:
                c.quality_metrics = _calc_quality(c)
                c.authority_score = _calc_authority(c)
                c.recency_score = _calc_recency(c)

            citations = _remove_duplicates(citations)
            for c in citations:
                self._citation_cache[c.metadata.internal_id] = c
            return citations
        except Exception as e:
            logger.error(f"Citation processing failed: {e}")
            return []

    async def analyze_citations(
        self, citations: List[Citation]
    ) -> CitationAnalysis:
        if not citations:
            return CitationAnalysis(
                total_citations=0, unique_sources=0,
                citation_distribution={}, authority_distribution={},
                recency_distribution={}, quality_metrics={},
                missing_citations=[], potential_duplicates=[],
                citation_density=0.0, bibliographic_diversity=0.0,
                temporal_coverage={}, geographical_coverage={},
            )
        tc = len(citations)
        us = len(set(c.metadata.source for c in citations if c.metadata.source))
        td = {CitationType(t): cnt for t, cnt in Counter(c.metadata.citation_type for c in citations).items()}
        ad = {"high": 0, "medium": 0, "low": 0}
        for c in citations:
            if c.authority_score > 0.7: ad["high"] += 1
            elif c.authority_score > 0.4: ad["medium"] += 1
            else: ad["low"] += 1
        rd = {"recent": 0, "moderate": 0, "old": 0}
        for c in citations:
            if c.recency_score > 0.7: rd["recent"] += 1
            elif c.recency_score > 0.4: rd["moderate"] += 1
            else: rd["old"] += 1
        qs = [c.quality_metrics.get("overall", 0) for c in citations]
        qm = {"average_quality": sum(qs) / len(qs) if qs else 0}
        years = [c.metadata.publication_year for c in citations if c.metadata.publication_year]
        temp = {}
        if years:
            temp = {
                "2020s": sum(1 for y in years if y >= 2020),
                "2010s": sum(1 for y in years if 2010 <= y < 2020),
                "2000s": sum(1 for y in years if 2000 <= y < 2010),
            }
            temp = {k: v for k, v in temp.items() if v > 0}
        return CitationAnalysis(
            total_citations=tc, unique_sources=us,
            citation_distribution=td, authority_distribution=ad,
            recency_distribution=rd, quality_metrics=qm,
            missing_citations=[], potential_duplicates=[],
            citation_density=tc, bibliographic_diversity=len(set(c.metadata.citation_type for c in citations)) / max(len(CitationType), 1),
            temporal_coverage=temp, geographical_coverage={},
        )

    async def check_plagiarism_risk(
        self, citations: List[Citation], content: str
    ) -> Dict[str, Any]:
        if not citations:
            return {"risk_level": "high", "risk_score": 0.9}
        total_words = len(content.split())
        cited = min(len(citations) * 100, total_words)
        coverage = cited / total_words if total_words else 0
        risk = 1.0 - coverage
        level = "high" if risk > 0.7 else "medium" if risk > 0.4 else "low"
        return {"risk_level": level, "risk_score": risk, "citation_coverage": coverage}

    def get_service_metrics(self) -> Dict[str, Any]:
        return {
            "citation_cache_size": len(self._citation_cache),
            "metadata_cache_size": len(self._metadata_cache),
            "validation_cache_size": len(self._validation_cache),
            "supported_styles": [s.value for s in CitationStyle],
            "supported_types": [t.value for t in CitationType],
        }


def _calc_quality(citation: Citation) -> Dict[str, float]:
    m = citation.metadata
    req = ["title", "authors", "source", "publication_year"]
    compl = sum(1 for f in req if getattr(m, f, None)) / len(req)
    ids = sum(1 for x in [m.doi, m.isbn, m.url] if x)
    overall = compl * 0.4 + min(ids / 2, 1.0) * 0.3
    if m.peer_reviewed: overall += 0.06
    return {"completeness": compl, "overall": overall}


def _calc_authority(citation: Citation) -> float:
    m = citation.metadata
    score = 0.5
    if m.peer_reviewed: score += 0.3
    if m.impact_factor and m.impact_factor > 5: score += 0.2
    elif m.impact_factor and m.impact_factor > 2: score += 0.1
    if m.citation_count and m.citation_count > 100: score += 0.1
    return min(score, 1.0)


def _calc_recency(citation: Citation) -> float:
    if not citation.metadata.publication_year:
        return 0.5
    age = datetime.now().year - citation.metadata.publication_year
    if age <= 1: return 1.0
    if age <= 3: return 0.8
    if age <= 5: return 0.6
    if age <= 10: return 0.4
    return 0.2


def _remove_duplicates(citations: List[Citation]) -> List[Citation]:
    seen = set()
    unique = []
    for c in citations:
        if c.metadata.doi:
            key = f"doi:{c.metadata.doi}"
        elif c.metadata.isbn:
            key = f"isbn:{c.metadata.isbn}"
        else:
            fa = c.metadata.authors[0] if c.metadata.authors else ""
            key = f"title:{c.metadata.title.lower()},author:{fa.lower()}"
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique
