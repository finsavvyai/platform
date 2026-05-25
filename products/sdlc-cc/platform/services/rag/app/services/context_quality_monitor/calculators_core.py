"""
Core Quality Calculators

Relevance, accuracy, completeness, and coherence score calculators.
"""

import logging
from datetime import datetime
from typing import List, Optional

from app.services.query_understanding_service import QueryAnalysis
from app.services.context_assembly_service import AssemblyResult
from app.services.context_retrieval_service import RetrievalResult
from app.services.citation_service import Citation

from .models import QualityMetric, QualityScore

logger = logging.getLogger(__name__)


async def calculate_relevance_score(
    metric: QualityMetric,
    query_analysis: Optional[QueryAnalysis],
    retrieval_result: Optional[RetrievalResult],
    assembly_result: Optional[AssemblyResult],
    citations: Optional[List[Citation]],
) -> QualityScore:
    """Calculate relevance quality score."""
    try:
        if not query_analysis or not retrieval_result:
            return QualityScore(
                metric=metric, score=0.5, confidence=0.3,
                measurement_date=datetime.now(),
                explanation="Insufficient data for relevance assessment",
            )

        query_keywords = set(query_analysis.keywords or [])
        query_entities = set(e.text for e in query_analysis.entities)
        relevance_scores = []

        for candidate in retrieval_result.candidates:
            content_words = set(candidate.chunk.content.lower().split())
            kw_rel = len(query_keywords.intersection(content_words)) / max(len(query_keywords), 1)
            ent_rel = len(query_entities.intersection(content_words)) / max(len(query_entities), 1)
            relevance_scores.append(0.7 * kw_rel + 0.3 * ent_rel)

        avg_rel = sum(relevance_scores) / len(relevance_scores) if relevance_scores else 0.5
        top_3_avg = sum(relevance_scores[:3]) / min(3, len(relevance_scores)) if relevance_scores else 0.5
        final_score = 0.7 * avg_rel + 0.3 * top_3_avg if relevance_scores else 0.5
        confidence = min(len(relevance_scores) / 10, 1.0)

        return QualityScore(
            metric=metric,
            score=min(max(final_score, 0.0), 1.0),
            confidence=confidence,
            measurement_date=datetime.now(),
            components={
                "keyword_relevance": avg_rel,
                "top_chunk_relevance": top_3_avg,
            },
            explanation=f"Relevance based on keyword and entity matching with {len(relevance_scores)} chunks analyzed",
        )
    except Exception as e:
        logger.warning(f"Relevance score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_accuracy_score(
    metric: QualityMetric,
    query_analysis: Optional[QueryAnalysis],
    retrieval_result: Optional[RetrievalResult],
    assembly_result: Optional[AssemblyResult],
    citations: Optional[List[Citation]],
) -> QualityScore:
    """Calculate factual accuracy score."""
    try:
        accuracy_score = 0.7
        if retrieval_result and retrieval_result.candidates:
            authority_scores = []
            for c in retrieval_result.candidates:
                meta = c.chunk.metadata or {}
                auth = 0.5
                st = meta.get("source_type", "").lower()
                if st == "peer_reviewed": auth += 0.3
                elif st == "academic": auth += 0.2
                elif st == "official": auth += 0.15
                authority_scores.append(min(auth, 1.0))
            if authority_scores:
                accuracy_score = sum(authority_scores) / len(authority_scores)

        if citations:
            cq = sum(c.authority_score for c in citations) / len(citations)
            accuracy_score = 0.7 * accuracy_score + 0.3 * cq

        factual_boost = 0.0
        if query_analysis and query_analysis.intent.value in ["factual", "definition"]:
            factual_boost = 0.1

        return QualityScore(
            metric=metric, score=min(accuracy_score + factual_boost, 1.0),
            confidence=0.6, measurement_date=datetime.now(),
            components={"source_authority": accuracy_score, "factual_boost": factual_boost},
            explanation="Accuracy based on source authority and citation quality",
        )
    except Exception as e:
        logger.warning(f"Accuracy score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_completeness_score(
    metric: QualityMetric,
    query_analysis: Optional[QueryAnalysis],
    retrieval_result: Optional[RetrievalResult],
    assembly_result: Optional[AssemblyResult],
    citations: Optional[List[Citation]],
) -> QualityScore:
    """Calculate completeness score."""
    try:
        score = 0.5
        if query_analysis and retrieval_result:
            qk = set(query_analysis.keywords or [])
            covered = set()
            for c in retrieval_result.candidates:
                cw = set(c.chunk.content.lower().split())
                covered.update(qk.intersection(cw))
            if qk:
                score = 0.6 * score + 0.4 * (len(covered) / len(qk))

            qe = set(e.text for e in query_analysis.entities)
            covered_e = set()
            for c in retrieval_result.candidates:
                cw = set(c.chunk.content.lower().split())
                covered_e.update(qe.intersection(cw))
            if qe:
                score = 0.7 * score + 0.3 * (len(covered_e) / len(qe))

        if assembly_result:
            ratio = assembly_result.total_tokens / max(
                assembly_result.assembly_metadata.get("target_tokens", 4000), 1
            )
            score = 0.8 * score + 0.2 * min(ratio, 1.0)

        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.7,
            measurement_date=datetime.now(),
            explanation="Completeness based on query coverage and content length",
        )
    except Exception as e:
        logger.warning(f"Completeness score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_coherence_score(
    metric: QualityMetric,
    query_analysis: Optional[QueryAnalysis],
    retrieval_result: Optional[RetrievalResult],
    assembly_result: Optional[AssemblyResult],
    citations: Optional[List[Citation]],
) -> QualityScore:
    """Calculate coherence score."""
    try:
        score = 0.6
        ordered_score = 0.7
        transition_score = 0.6

        if assembly_result and assembly_result.quality_metrics:
            score = assembly_result.quality_metrics.get("avg_coherence", 0.6)

        if retrieval_result and retrieval_result.candidates:
            score = 0.7 * score + 0.3 * ordered_score

        if assembly_result:
            tw = ["however", "therefore", "thus", "consequently", "moreover",
                  "furthermore", "nevertheless", "nonetheless", "meanwhile"]
            text = assembly_result.assembled_context.lower()
            tc = sum(1 for w in tw if w in text)
            sents = len(text.split("."))
            transition_score = min(tc / max(sents, 1), 1.0)
            score = 0.8 * score + 0.2 * transition_score

        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.6,
            measurement_date=datetime.now(),
            explanation="Coherence based on content flow and logical ordering",
        )
    except Exception as e:
        logger.warning(f"Coherence score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")
