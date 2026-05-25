"""
Quality Analysis and Insights

Overall score calculation, strengths/weaknesses analysis, and recommendations.
"""

import logging
from typing import List, Tuple

from .models import QualityMetric, QualityScore

logger = logging.getLogger(__name__)


def calculate_overall_score(metric_scores: List[QualityScore]) -> float:
    """Calculate overall quality score from individual metrics."""
    if not metric_scores:
        return 0.5

    weights = {
        QualityMetric.RELEVANCE: 0.2,
        QualityMetric.ACCURACY: 0.15,
        QualityMetric.COMPLETENESS: 0.1,
        QualityMetric.COHERENCE: 0.1,
        QualityMetric.CITATION_QUALITY: 0.1,
        QualityMetric.SOURCE_AUTHORITY: 0.1,
        QualityMetric.DIVERSITY: 0.05,
        QualityMetric.COVERAGE: 0.1,
        QualityMetric.READABILITY: 0.05,
        QualityMetric.CLARITY: 0.05,
    }

    weighted_sum = 0.0
    total_weight = 0.0
    for score in metric_scores:
        w = weights.get(score.metric, 0.05)
        weighted_sum += score.score * w
        total_weight += w
    return weighted_sum / total_weight if total_weight > 0 else 0.5


def analyze_strengths_weaknesses(
    metric_scores: List[QualityScore],
) -> Tuple[List[str], List[str]]:
    """Analyze strengths and weaknesses from metric scores."""
    strengths = []
    weaknesses = []
    for score in metric_scores:
        label = score.metric.value.replace("_", " ")
        if score.score >= 0.8:
            strengths.append(f"Excellent {label} ({score.score:.2f})")
        elif score.score >= 0.6:
            strengths.append(f"Good {label} ({score.score:.2f})")
        elif score.score < 0.4:
            weaknesses.append(f"Poor {label} ({score.score:.2f})")
        elif score.score < 0.6:
            weaknesses.append(
                f"Needs improvement in {label} ({score.score:.2f})"
            )
    return strengths, weaknesses


def generate_recommendations(
    metric_scores: List[QualityScore], weaknesses: List[str]
) -> List[str]:
    """Generate improvement recommendations."""
    recs = []
    for score in metric_scores:
        if score.score >= 0.6:
            continue
        m = score.metric
        if m == QualityMetric.RELEVANCE:
            recs.append("Improve query understanding and keyword extraction for better relevance")
        elif m == QualityMetric.ACCURACY:
            recs.append("Include more authoritative and peer-reviewed sources")
        elif m == QualityMetric.COMPLETENESS:
            recs.append("Expand coverage to include more aspects of the query")
        elif m == QualityMetric.CITATION_QUALITY:
            recs.append("Add proper citations and verify citation formats")
        elif m == QualityMetric.DIVERSITY:
            recs.append("Include sources from diverse perspectives and publication types")
        elif m == QualityMetric.READABILITY:
            recs.append("Improve text structure and sentence complexity")
        elif m == QualityMetric.CLARITY:
            recs.append("Enhance content clarity and query-answer alignment")
    return recs


def identify_risk_factors(
    metric_scores: List[QualityScore],
) -> List[str]:
    """Identify potential risk factors."""
    risks = []
    critical_metrics = [QualityMetric.ACCURACY, QualityMetric.RELEVANCE]
    for score in metric_scores:
        if score.metric in critical_metrics and score.score < 0.3:
            risks.append(
                f"Critical issue with {score.metric.value.replace('_', ' ')}"
            )
    bias = next(
        (s for s in metric_scores if s.metric == QualityMetric.BIAS_DETECTION),
        None,
    )
    if bias and bias.score > 0.7:
        risks.append("High bias detected in content")
    overall = calculate_overall_score(metric_scores)
    if overall < 0.4:
        risks.append("Overall quality below acceptable threshold")
    return risks


def calculate_compliance_score(
    metric_scores: List[QualityScore],
) -> float:
    """Calculate compliance score based on quality metrics."""
    required = [
        QualityMetric.RELEVANCE,
        QualityMetric.ACCURACY,
        QualityMetric.CITATION_QUALITY,
    ]
    req_scores = [s.score for s in metric_scores if s.metric in required]
    if not req_scores:
        return 0.5
    return 0.7 * min(req_scores) + 0.3 * (sum(req_scores) / len(req_scores))


def predict_user_satisfaction(
    overall_score: float, metric_scores: List[QualityScore]
) -> float:
    """Predict user satisfaction based on quality scores."""
    rel = next(
        (s.score for s in metric_scores if s.metric == QualityMetric.RELEVANCE),
        0.5,
    )
    clar = next(
        (s.score for s in metric_scores if s.metric == QualityMetric.CLARITY),
        0.5,
    )
    return min(0.6 * overall_score + 0.25 * rel + 0.15 * clar, 1.0)
