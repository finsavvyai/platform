"""
Extended Quality Calculators

Citation quality, authority, recency, diversity, coverage, and readability.
"""

import logging
from datetime import datetime

from app.services.citation_service import CitationType

from .models import QualityScore

logger = logging.getLogger(__name__)


async def calculate_citation_quality_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate citation quality score."""
    try:
        if not citations:
            return QualityScore(metric=metric, score=0.3, confidence=0.8, measurement_date=datetime.now(), explanation="No citations found")
        valid = sum(1 for c in citations if c.validation_status == "valid")
        completeness = valid / len(citations)
        auth = sum(c.authority_score for c in citations) / len(citations)
        us = len(set(c.metadata.source for c in citations if c.metadata.source))
        diversity = min(us / len(citations), 1.0)
        fmt = sum(1 for c in citations if c.formatted_citations)
        fmt_score = fmt / len(citations)
        final = 0.3 * completeness + 0.3 * auth + 0.2 * diversity + 0.2 * fmt_score
        return QualityScore(
            metric=metric, score=min(final, 1.0), confidence=0.8, measurement_date=datetime.now(),
            components={"citation_completeness": completeness, "authority_score": auth, "diversity_score": diversity, "format_score": fmt_score},
            explanation=f"Citation quality based on {len(citations)} citations with {valid} valid",
        )
    except Exception as e:
        logger.warning(f"Citation quality score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_authority_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate source authority score."""
    try:
        scores = []
        if retrieval_result and retrieval_result.candidates:
            for c in retrieval_result.candidates:
                meta = c.chunk.metadata or {}
                auth = 0.5
                st = meta.get("source_type", "").lower()
                if st == "peer_reviewed": auth += 0.4
                elif st == "academic": auth += 0.3
                elif st == "official": auth += 0.2
                elif st == "book": auth += 0.15
                pub = meta.get("publisher", "").lower()
                reps = ["elsevier", "springer", "nature", "science", "ieee", "acm", "oxford", "cambridge", "wiley", "taylor"]
                if any(p in pub for p in reps): auth += 0.1
                scores.append(min(auth, 1.0))
        cit_auth = 0.5
        if citations:
            cit_auth = sum(c.authority_score for c in citations) / len(citations)
            scores.append(cit_auth)
        final = sum(scores) / len(scores) if scores else 0.5
        return QualityScore(
            metric=metric, score=final, confidence=0.7, measurement_date=datetime.now(),
            explanation=f"Authority based on {len(scores)} source evaluations",
        )
    except Exception as e:
        logger.warning(f"Authority score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_recency_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate recency score."""
    try:
        scores = []
        cy = datetime.now().year
        if retrieval_result and retrieval_result.candidates:
            for c in retrieval_result.candidates:
                py = (c.chunk.metadata or {}).get("publication_year")
                if py:
                    age = cy - py
                    r = 1.0 if age <= 1 else 0.8 if age <= 3 else 0.6 if age <= 5 else 0.4 if age <= 10 else 0.2 if age <= 20 else 0.1
                else:
                    r = 0.5
                scores.append(r)
        if citations:
            for c in citations:
                if c.metadata.publication_year:
                    age = cy - c.metadata.publication_year
                    r = 1.0 if age <= 1 else 0.8 if age <= 3 else 0.6 if age <= 5 else 0.4 if age <= 10 else 0.2
                else:
                    r = 0.5
                scores.append(r)
        final = sum(scores) / len(scores) if scores else 0.5
        if query_analysis and query_analysis.urgency == "high":
            final = min(final * 1.2, 1.0)
        return QualityScore(
            metric=metric, score=final, confidence=0.8, measurement_date=datetime.now(),
            explanation=f"Recency based on {len(scores)} source dates",
        )
    except Exception as e:
        logger.warning(f"Recency score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_diversity_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate diversity score."""
    try:
        score = 0.5
        src_div = 0.5
        cit_div = 0.5
        if retrieval_result and retrieval_result.candidates:
            sources = set()
            source_types = set()
            for c in retrieval_result.candidates:
                m = c.chunk.metadata or {}
                if m.get("source"): sources.add(m["source"])
                if m.get("source_type"): source_types.add(m["source_type"])
            src_div = min(len(sources) / max(len(retrieval_result.candidates), 1), 1.0)
            type_div = min(len(source_types) / 5, 1.0)
            score = 0.4 * score + 0.4 * src_div + 0.2 * type_div
        if citations:
            cs = set(c.metadata.source for c in citations if c.metadata.source)
            ct = set(c.metadata.citation_type for c in citations)
            cit_div = min(len(cs) / max(len(citations), 1), 1.0)
            score = 0.6 * score + 0.3 * cit_div + 0.1 * min(len(ct) / len(CitationType), 1.0)
        if assembly_result and "content_diversity" in assembly_result.quality_metrics:
            score = 0.7 * score + 0.3 * assembly_result.quality_metrics["content_diversity"]
        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.6, measurement_date=datetime.now(),
            explanation="Diversity based on sources, citations, and content variety",
        )
    except Exception as e:
        logger.warning(f"Diversity score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_coverage_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate coverage score."""
    try:
        score = 0.5
        if query_analysis:
            score = 0.6 * score + 0.4 * 0.7  # simplified intent coverage
        if retrieval_result and retrieval_result.candidates:
            score = 0.7 * score + 0.3 * 0.6  # simplified topic coverage
        if assembly_result and assembly_result.coverage_analysis:
            kc = assembly_result.coverage_analysis.get("keyword_coverage", 0.5)
            score = 0.8 * score + 0.2 * kc
        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.7, measurement_date=datetime.now(),
            explanation="Coverage based on query intent, topics, and keywords",
        )
    except Exception as e:
        logger.warning(f"Coverage score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_readability_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate readability score."""
    try:
        score = 0.7
        sentence_score = 0.7
        if assembly_result:
            sents = assembly_result.assembled_context.split(".")
            avg_len = sum(len(s.split()) for s in sents) / max(len(sents), 1)
            if 15 <= avg_len <= 20: sentence_score = 1.0
            elif 10 <= avg_len <= 25: sentence_score = 0.8
            elif 5 <= avg_len <= 30: sentence_score = 0.6
            else: sentence_score = 0.4
            score = 0.6 * score + 0.4 * sentence_score
        if query_analysis and query_analysis.complexity.value:
            targets = {"simple": 0.9, "moderate": 0.7, "complex": 0.5, "expert": 0.3}
            tr = targets.get(query_analysis.complexity.value, 0.7)
            score = 0.7 * score + 0.3 * (1.0 - abs(score - tr))
        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.6, measurement_date=datetime.now(),
            explanation="Readability based on sentence complexity and user level",
        )
    except Exception as e:
        logger.warning(f"Readability score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")
