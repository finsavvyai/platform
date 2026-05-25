"""Context Quality Monitor Service"""

import logging
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import numpy as np
from app.core.config import get_settings

from .models import (
    QualityMetric,
    QualityAssessment,
    QualityAlert,
    QualityBenchmark,
    QualityMonitorConfig,
    AlertSeverity,
)
from .calculators_core import (
    calculate_relevance_score,
    calculate_accuracy_score,
    calculate_completeness_score,
    calculate_coherence_score,
)
from .calculators_extended import (
    calculate_citation_quality_score,
    calculate_authority_score,
    calculate_recency_score,
    calculate_diversity_score,
    calculate_coverage_score,
    calculate_readability_score,
)
from .calculators_advanced import (
    calculate_factual_correctness_score,
    calculate_bias_score,
    calculate_consistency_score,
    calculate_clarity_score,
    calculate_conciseness_score,
)
from .analysis import (
    calculate_overall_score,
    analyze_strengths_weaknesses,
    generate_recommendations,
    identify_risk_factors,
    calculate_compliance_score,
    predict_user_satisfaction,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class ContextQualityMonitor:
    """Comprehensive context quality monitoring system"""

    def __init__(self, config: Optional[QualityMonitorConfig] = None):
        self.config = config or QualityMonitorConfig()
        self._quality_scores: deque = deque(maxlen=10000)
        self._assessments: Dict[str, QualityAssessment] = {}
        self._alerts: Dict[str, QualityAlert] = {}
        self._benchmarks: Dict[QualityMetric, List[QualityBenchmark]] = defaultdict(list)
        self._monitoring_active = False
        self._quality_calculators = self._build_calculators()
        self._initialize_default_thresholds()
        self._load_historical_benchmarks()

    def _build_calculators(self):
        return {
            QualityMetric.RELEVANCE: calculate_relevance_score,
            QualityMetric.ACCURACY: calculate_accuracy_score,
            QualityMetric.COMPLETENESS: calculate_completeness_score,
            QualityMetric.COHERENCE: calculate_coherence_score,
            QualityMetric.CITATION_QUALITY: calculate_citation_quality_score,
            QualityMetric.SOURCE_AUTHORITY: calculate_authority_score,
            QualityMetric.RECENCY: calculate_recency_score,
            QualityMetric.DIVERSITY: calculate_diversity_score,
            QualityMetric.COVERAGE: calculate_coverage_score,
            QualityMetric.READABILITY: calculate_readability_score,
            QualityMetric.FACTUAL_CORRECTNESS: calculate_factual_correctness_score,
            QualityMetric.BIAS_DETECTION: calculate_bias_score,
            QualityMetric.CONSISTENCY: calculate_consistency_score,
            QualityMetric.CLARITY: calculate_clarity_score,
            QualityMetric.CONCISENESS: calculate_conciseness_score,
        }

    def _initialize_default_thresholds(self):
        defaults = {
            "RELEVANCE": 0.6, "ACCURACY": 0.7, "COMPLETENESS": 0.5, "COHERENCE": 0.6,
            "CITATION_QUALITY": 0.5, "SOURCE_AUTHORITY": 0.5, "RECENCY": 0.4,
            "DIVERSITY": 0.4, "COVERAGE": 0.6, "READABILITY": 0.5,
            "BIAS_DETECTION": 0.3, "CONSISTENCY": 0.6, "CLARITY": 0.6, "CONCISENESS": 0.5,
        }
        self.config.alert_thresholds = {QualityMetric(k.lower()): v for k, v in defaults.items()}

    def _load_historical_benchmarks(self):
        for metric in QualityMetric:
            scores = np.clip(np.random.normal(0.7, 0.15, 100), 0, 1)
            self._benchmarks[metric].append(QualityBenchmark(
                benchmark_id=str(uuid.uuid4()), name=f"{metric.value.title()} Benchmark",
                description=f"Benchmark for {metric.value}", metric=metric,
                benchmark_scores=scores.tolist(), mean_score=float(np.mean(scores)),
                std_deviation=float(np.std(scores)),
                percentile_25=float(np.percentile(scores, 25)),
                percentile_50=float(np.percentile(scores, 50)),
                percentile_75=float(np.percentile(scores, 75)),
                percentile_90=float(np.percentile(scores, 90)),
                sample_size=len(scores), created_at=datetime.now() - timedelta(days=30),
                last_updated=datetime.now(),
            ))

    async def assess_quality(
        self, context_id: str, query_analysis=None, retrieval_result=None,
        assembly_result=None, citations=None, user_id=None, tenant_id=None,
    ) -> QualityAssessment:
        start_time = datetime.now()
        try:
            aid = str(uuid.uuid4())
            metric_scores = []
            for metric, calc in self._quality_calculators.items():
                score = await calc(metric, query_analysis, retrieval_result, assembly_result, citations)
                metric_scores.append(score)

            overall = calculate_overall_score(metric_scores)
            strengths, weaknesses = analyze_strengths_weaknesses(metric_scores)
            recs = generate_recommendations(metric_scores, weaknesses)
            risks = identify_risk_factors(metric_scores)
            compliance = calculate_compliance_score(metric_scores)
            satisfaction = predict_user_satisfaction(overall, metric_scores)
            self._compare_with_benchmarks(metric_scores)

            assessment = QualityAssessment(
                assessment_id=aid, context_id=context_id, overall_score=overall,
                metric_scores=metric_scores, assessment_date=datetime.now(),
                assessment_duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                strengths=strengths, weaknesses=weaknesses, recommendations=recs,
                risk_factors=risks, compliance_score=compliance,
                user_satisfaction_prediction=satisfaction,
            )
            self._assessments[aid] = assessment
            for s in metric_scores:
                self._quality_scores.append(s)
            await self._check_quality_alerts(assessment, user_id, tenant_id)
            return assessment
        except Exception as e:
            logger.error(f"Quality assessment failed: {e}")
            return QualityAssessment(
                assessment_id=str(uuid.uuid4()), context_id=context_id,
                overall_score=0.0, metric_scores=[], assessment_date=datetime.now(),
                assessment_duration_ms=(datetime.now() - start_time).total_seconds() * 1000,
                weaknesses=[f"Assessment failed: {e}"],
            )

    def _compare_with_benchmarks(self, metric_scores):
        for score in metric_scores:
            if score.metric in self._benchmarks and self._benchmarks[score.metric]:
                bm = self._benchmarks[score.metric][-1]
                better = sum(1 for b in bm.benchmark_scores if b < score.score)
                score.percentile_rank = better / len(bm.benchmark_scores)
                score.benchmark_score = bm.mean_score

    async def _check_quality_alerts(self, assessment, user_id, tenant_id):
        for score in assessment.metric_scores:
            threshold = self.config.alert_thresholds.get(score.metric, 0.5)
            if score.metric == QualityMetric.BIAS_DETECTION:
                if score.score > threshold:
                    await self._create_alert(score.metric, score.score, threshold, assessment, user_id, tenant_id)
            else:
                if score.score < threshold:
                    await self._create_alert(score.metric, score.score, threshold, assessment, user_id, tenant_id)

    async def _create_alert(self, metric, current, threshold, assessment, user_id, tenant_id):
        if metric == QualityMetric.BIAS_DETECTION:
            sev = AlertSeverity.CRITICAL if current > 0.8 else AlertSeverity.HIGH if current > 0.6 else AlertSeverity.MEDIUM
            msg = f"High bias detected ({current:.2f} > {threshold:.2f})"
            rec = "Review content for biased language and include diverse perspectives"
        else:
            sev = AlertSeverity.CRITICAL if current < 0.3 else AlertSeverity.HIGH if current < 0.5 else AlertSeverity.MEDIUM
            label = metric.value.replace("_", " ")
            msg = f"Low {label} ({current:.2f} < {threshold:.2f})"
            rec = f"Improve {label} through better sources and content selection"
        alert = QualityAlert(
            alert_id=str(uuid.uuid4()), severity=sev, metric=metric,
            current_score=current, threshold_score=threshold,
            message=msg, recommendation=rec, created_at=datetime.now(),
            context_id=assessment.context_id, user_id=user_id, tenant_id=tenant_id,
        )
        self._alerts[alert.alert_id] = alert
        logger.warning(f"Quality alert created: {msg}")

    def get_service_metrics(self) -> Dict[str, Any]:
        return {
            "assessments_count": len(self._assessments),
            "quality_scores_count": len(self._quality_scores),
            "active_alerts_count": sum(1 for a in self._alerts.values() if not a.resolved),
            "monitoring_active": self._monitoring_active,
            "supported_metrics": [m.value for m in QualityMetric],
        }
