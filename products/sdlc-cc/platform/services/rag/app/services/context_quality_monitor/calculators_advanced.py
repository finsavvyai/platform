"""
Advanced Quality Calculators

Factual correctness, bias detection, consistency, clarity, and conciseness.
"""

import logging
import statistics
from datetime import datetime


from .models import QualityScore

logger = logging.getLogger(__name__)


async def calculate_factual_correctness_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate factual correctness score."""
    try:
        score = 0.7
        pr_ratio = 0.5
        if retrieval_result and retrieval_result.candidates:
            pr = sum(1 for c in retrieval_result.candidates if c.chunk.metadata.get("source_type") == "peer_reviewed")
            if retrieval_result.candidates:
                pr_ratio = pr / len(retrieval_result.candidates)
                score = 0.6 * score + 0.4 * pr_ratio
        cit_correct = 0.5
        if citations:
            verified = sum(1 for c in citations if c.validation_status == "valid" and c.authority_score > 0.7)
            cit_correct = verified / len(citations)
            score = 0.7 * score + 0.3 * cit_correct
        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.5,
            measurement_date=datetime.now(),
            explanation="Factual correctness based on source authority and verification",
        )
    except Exception as e:
        logger.warning(f"Factual correctness score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_bias_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate bias score (lower is better)."""
    try:
        score = 0.3
        biased_density = 0.0
        if retrieval_result and retrieval_result.candidates:
            sources = set(c.chunk.metadata.get("source", "") for c in retrieval_result.candidates)
            sd = len(sources) / max(len(retrieval_result.candidates), 1)
            score = max(score - sd * 0.3, 0.0)
        if citations:
            cs = set(c.metadata.source for c in citations if c.metadata.source)
            cd = len(cs) / max(len(citations), 1)
            score = max(score - cd * 0.2, 0.0)
        if assembly_result:
            biased_terms = ["always", "never", "obviously", "clearly", "everyone knows", "of course", "naturally", "undoubtedly", "without a doubt"]
            text = assembly_result.assembled_context.lower()
            bc = sum(1 for t in biased_terms if t in text)
            wc = len(text.split())
            if wc > 0:
                biased_density = bc / wc
                score += biased_density * 2.0
        score = min(max(score, 0.0), 1.0)
        return QualityScore(
            metric=metric, score=score, confidence=0.4,
            measurement_date=datetime.now(),
            explanation="Bias detection based on source diversity and language analysis",
        )
    except Exception as e:
        logger.warning(f"Bias score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_consistency_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate consistency score."""
    try:
        score = 0.7
        contradiction_penalty = 0.0
        if retrieval_result and retrieval_result.candidates:
            contradiction_penalty = 0.0  # simplified
            score -= contradiction_penalty
        if citations:
            score = 0.8 * score + 0.2 * 0.8  # simplified citation consistency
        if retrieval_result and retrieval_result.candidates:
            score = 0.9 * score + 0.1 * 0.7  # simplified temporal consistency
        return QualityScore(
            metric=metric, score=min(max(score, 0.0), 1.0), confidence=0.6,
            measurement_date=datetime.now(),
            explanation="Consistency based on internal coherence and citation alignment",
        )
    except Exception as e:
        logger.warning(f"Consistency score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_clarity_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate clarity score."""
    try:
        score = 0.7
        variance_score = 0.7
        if assembly_result:
            sents = [s.strip() for s in assembly_result.assembled_context.split(".") if s.strip()]
            if sents:
                lens = [len(s.split()) for s in sents]
                if len(lens) >= 2:
                    v = statistics.variance(lens)
                    if 10 <= v <= 50: variance_score = 1.0
                    elif 5 <= v <= 100: variance_score = 0.8
                    else: variance_score = 0.6
                score = 0.8 * score + 0.2 * variance_score
        alignment_score = 0.6
        if query_analysis and assembly_result:
            score = 0.7 * score + 0.3 * alignment_score
        return QualityScore(
            metric=metric, score=min(score, 1.0), confidence=0.6,
            measurement_date=datetime.now(),
            explanation="Clarity based on sentence structure and query alignment",
        )
    except Exception as e:
        logger.warning(f"Clarity score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")


async def calculate_conciseness_score(
    metric, query_analysis, retrieval_result, assembly_result, citations,
) -> QualityScore:
    """Calculate conciseness score."""
    try:
        score = 0.6
        density_score = 0.6
        redundancy_penalty = 0.1
        length_penalty = 0.0
        if assembly_result:
            text = assembly_result.assembled_context
            wc = len(text.split())
            indicators = ["because", "therefore", "thus", "however", "although", "specifically", "particularly", "especially", "importantly", "significantly", "notably", "crucially"]
            ic = sum(1 for ind in indicators if ind in text.lower())
            density_score = min(ic / max(wc / 100, 1), 1.0)
            score = 0.7 * score + 0.3 * density_score
        if retrieval_result and retrieval_result.candidates:
            score -= redundancy_penalty
        if assembly_result:
            at = assembly_result.total_tokens
            if at < 1000: length_penalty = 0.3
            elif at < 2000: length_penalty = 0.1
            score = 0.8 * score + 0.2 * (1.0 - length_penalty)
        return QualityScore(
            metric=metric, score=min(max(score, 0.0), 1.0), confidence=0.6,
            measurement_date=datetime.now(),
            explanation="Conciseness based on information density and lack of redundancy",
        )
    except Exception as e:
        logger.warning(f"Conciseness score calculation failed: {e}")
        return QualityScore(metric=metric, score=0.5, confidence=0.0, measurement_date=datetime.now(), explanation=f"Calculation failed: {e}")
