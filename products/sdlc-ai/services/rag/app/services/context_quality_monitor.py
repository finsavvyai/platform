"""
Context Quality Monitor

Comprehensive quality monitoring system with metrics calculation,
trend analysis, automated alerts, and quality improvement recommendations.
"""

import asyncio
import logging
import statistics
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
import json
import numpy as np
from collections import defaultdict, deque
import uuid

from app.core.config import get_settings
from app.models.document import DocumentChunk
from app.services.query_understanding_service import QueryAnalysis
from app.services.context_assembly_service import AssemblyResult
from app.services.context_retrieval_service import RetrievalResult
from app.services.citation_service import Citation, CitationAnalysis

logger = logging.getLogger(__name__)
settings = get_settings()


class QualityMetric(str, Enum):
    """Types of quality metrics"""

    RELEVANCE = "relevance"
    ACCURACY = "accuracy"
    COMPLETENESS = "completeness"
    COHERENCE = "coherence"
    CITATION_QUALITY = "citation_quality"
    SOURCE_AUTHORITY = "source_authority"
    RECENCY = "recency"
    DIVERSITY = "diversity"
    COVERAGE = "coverage"
    READABILITY = "readability"
    FACTUAL_CORRECTNESS = "factual_correctness"
    BIAS_DETECTION = "bias_detection"
    CONSISTENCY = "consistency"
    CLARITY = "clarity"
    CONCISENESS = "conciseness"


class AlertSeverity(str, Enum):
    """Alert severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TrendDirection(str, Enum):
    """Quality trend directions"""

    IMPROVING = "improving"
    DECLINING = "declining"
    STABLE = "stable"
    VOLATILE = "volatile"


@dataclass
class QualityScore:
    """Individual quality score with metadata"""

    metric: QualityMetric
    score: float  # 0-1
    confidence: float  # 0-1
    measurement_date: datetime
    context_id: Optional[str] = None
    query_id: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    components: Dict[str, float] = field(default_factory=dict)
    explanation: str = ""
    benchmark_score: Optional[float] = None
    percentile_rank: Optional[float] = None


@dataclass
class QualityAssessment:
    """Complete quality assessment for context"""

    assessment_id: str
    context_id: str
    overall_score: float
    metric_scores: List[QualityScore]
    assessment_date: datetime
    assessment_duration_ms: float
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    risk_factors: List[str] = field(default_factory=list)
    compliance_score: float = 0.0
    user_satisfaction_prediction: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QualityTrend:
    """Quality trend analysis over time"""

    metric: QualityMetric
    direction: TrendDirection
    trend_strength: float  # 0-1
    time_period_days: int
    data_points: int
    start_score: float
    end_score: float
    change_percentage: float
    volatility_score: float
    forecast_score: Optional[float] = None
    confidence_interval: Optional[Tuple[float, float]] = None


@dataclass
class QualityAlert:
    """Quality alert notification"""

    alert_id: str
    severity: AlertSeverity
    metric: QualityMetric
    current_score: float
    threshold_score: float
    message: str
    recommendation: str
    created_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    context_id: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    acknowledged: bool = False
    assigned_to: Optional[str] = None


@dataclass
class QualityBenchmark:
    """Quality benchmark for comparison"""

    benchmark_id: str
    name: str
    description: str
    metric: QualityMetric
    benchmark_scores: List[float]
    mean_score: float
    std_deviation: float
    percentile_25: float
    percentile_50: float
    percentile_75: float
    percentile_90: float
    sample_size: int
    created_at: datetime
    last_updated: datetime
    category: str = "general"
    is_active: bool = True


@dataclass
class QualityMonitorConfig:
    """Configuration for quality monitoring"""

    enable_real_time_monitoring: bool = True
    assessment_frequency_minutes: int = 60
    trend_analysis_window_days: int = 30
    alert_thresholds: Dict[QualityMetric, float] = field(default_factory=dict)
    benchmark_comparison_enabled: bool = True
    auto_improvement_suggestions: bool = True
    user_feedback_integration: bool = True
    compliance_monitoring: bool = True
    bias_detection_enabled: bool = True
    factual_verification_enabled: bool = False
    performance_impact_limit: float = 0.1  # Max 10% performance impact


class ContextQualityMonitor:
    """Comprehensive context quality monitoring system"""

    def __init__(self, config: Optional[QualityMonitorConfig] = None):
        self.config = config or QualityMonitorConfig()

        # Initialize storage
        self._quality_scores: deque = deque(maxlen=10000)  # Recent scores
        self._assessments: Dict[str, QualityAssessment] = {}
        self._alerts: Dict[str, QualityAlert] = {}
        self._benchmarks: Dict[QualityMetric, List[QualityBenchmark]] = defaultdict(
            list
        )
        self._trends: Dict[QualityMetric, List[QualityTrend]] = defaultdict(list)

        # Initialize monitoring state
        self._monitoring_active = False
        self._last_assessment_time = None
        self._background_tasks: Set[asyncio.Task] = set()

        # Initialize quality calculators
        self._quality_calculators = {}
        self._initialize_quality_calculators()

        # Initialize default thresholds
        self._initialize_default_thresholds()

        # Load historical benchmarks
        self._load_historical_benchmarks()

        logger.info("Context Quality Monitor initialized")

    def _initialize_quality_calculators(self) -> None:
        """Initialize quality calculation methods"""
        self._quality_calculators = {
            QualityMetric.RELEVANCE: self._calculate_relevance_score,
            QualityMetric.ACCURACY: self._calculate_accuracy_score,
            QualityMetric.COMPLETENESS: self._calculate_completeness_score,
            QualityMetric.COHERENCE: self._calculate_coherence_score,
            QualityMetric.CITATION_QUALITY: self._calculate_citation_quality_score,
            QualityMetric.SOURCE_AUTHORITY: self._calculate_authority_score,
            QualityMetric.RECENCY: self._calculate_recency_score,
            QualityMetric.DIVERSITY: self._calculate_diversity_score,
            QualityMetric.COVERAGE: self._calculate_coverage_score,
            QualityMetric.READABILITY: self._calculate_readability_score,
            QualityMetric.FACTUAL_CORRECTNESS: self._calculate_factual_correctness_score,
            QualityMetric.BIAS_DETECTION: self._calculate_bias_score,
            QualityMetric.CONSISTENCY: self._calculate_consistency_score,
            QualityMetric.CLARITY: self._calculate_clarity_score,
            QualityMetric.CONCISENESS: self._calculate_conciseness_score,
        }

        logger.info("Quality calculators initialized")

    def _initialize_default_thresholds(self) -> None:
        """Initialize default alert thresholds"""
        self.config.alert_thresholds = {
            QualityMetric.RELEVANCE: 0.6,
            QualityMetric.ACCURACY: 0.7,
            QualityMetric.COMPLETENESS: 0.5,
            QualityMetric.COHERENCE: 0.6,
            QualityMetric.CITATION_QUALITY: 0.5,
            QualityMetric.SOURCE_AUTHORITY: 0.5,
            QualityMetric.RECENCY: 0.4,
            QualityMetric.DIVERSITY: 0.4,
            QualityMetric.COVERAGE: 0.6,
            QualityMetric.READABILITY: 0.5,
            QualityMetric.BIAS_DETECTION: 0.3,  # Lower is better for bias
            QualityMetric.CONSISTENCY: 0.6,
            QualityMetric.CLARITY: 0.6,
            QualityMetric.CONCISENESS: 0.5,
        }

        logger.info("Default thresholds initialized")

    def _load_historical_benchmarks(self) -> None:
        """Load historical quality benchmarks"""
        # In a real implementation, would load from database
        # For now, create some example benchmarks

        for metric in QualityMetric:
            # Create benchmark with simulated data
            benchmark_scores = np.random.normal(0.7, 0.15, 100)  # Normal distribution
            benchmark_scores = np.clip(benchmark_scores, 0, 1)  # Clip to 0-1

            benchmark = QualityBenchmark(
                benchmark_id=str(uuid.uuid4()),
                name=f"{metric.value.title()} Benchmark",
                description=f"Historical benchmark for {metric.value} quality metric",
                metric=metric,
                benchmark_scores=benchmark_scores.tolist(),
                mean_score=float(np.mean(benchmark_scores)),
                std_deviation=float(np.std(benchmark_scores)),
                percentile_25=float(np.percentile(benchmark_scores, 25)),
                percentile_50=float(np.percentile(benchmark_scores, 50)),
                percentile_75=float(np.percentile(benchmark_scores, 75)),
                percentile_90=float(np.percentile(benchmark_scores, 90)),
                sample_size=len(benchmark_scores),
                created_at=datetime.now() - timedelta(days=30),
                last_updated=datetime.now(),
            )

            self._benchmarks[metric].append(benchmark)

        logger.info("Historical benchmarks loaded")

    async def assess_quality(
        self,
        context_id: str,
        query_analysis: Optional[QueryAnalysis] = None,
        retrieval_result: Optional[RetrievalResult] = None,
        assembly_result: Optional[AssemblyResult] = None,
        citations: Optional[List[Citation]] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> QualityAssessment:
        """
        Perform comprehensive quality assessment

        Args:
            context_id: Unique context identifier
            query_analysis: Query analysis results
            retrieval_result: Retrieval results
            assembly_result: Assembly results
            citations: Citation information
            user_id: User ID
            tenant_id: Tenant ID

        Returns:
            Complete quality assessment
        """
        start_time = datetime.now()

        try:
            assessment_id = str(uuid.uuid4())
            metric_scores = []

            # Calculate all quality metrics
            for metric in QualityMetric:
                if metric in self._quality_calculators:
                    score_data = await self._quality_calculators[metric](
                        metric,
                        query_analysis,
                        retrieval_result,
                        assembly_result,
                        citations,
                    )
                    metric_scores.append(score_data)

            # Calculate overall score
            overall_score = self._calculate_overall_score(metric_scores)

            # Generate insights
            strengths, weaknesses = self._analyze_strengths_weaknesses(metric_scores)
            recommendations = self._generate_recommendations(metric_scores, weaknesses)
            risk_factors = self._identify_risk_factors(metric_scores)

            # Calculate compliance score
            compliance_score = self._calculate_compliance_score(metric_scores)

            # Predict user satisfaction
            satisfaction_prediction = self._predict_user_satisfaction(
                overall_score, metric_scores
            )

            # Compare with benchmarks
            self._compare_with_benchmarks(metric_scores)

            # Create assessment
            assessment = QualityAssessment(
                assessment_id=assessment_id,
                context_id=context_id,
                overall_score=overall_score,
                metric_scores=metric_scores,
                assessment_date=datetime.now(),
                assessment_duration_ms=(datetime.now() - start_time).total_seconds()
                * 1000,
                strengths=strengths,
                weaknesses=weaknesses,
                recommendations=recommendations,
                risk_factors=risk_factors,
                compliance_score=compliance_score,
                user_satisfaction_prediction=satisfaction_prediction,
                metadata={
                    "user_id": user_id,
                    "tenant_id": tenant_id,
                    "query_type": query_analysis.intent.value
                    if query_analysis
                    else None,
                    "retrieval_strategy": retrieval_result.retrieval_strategy.value
                    if retrieval_result
                    else None,
                    "assembly_strategy": assembly_result.assembly_strategy.value
                    if assembly_result
                    else None,
                    "citation_count": len(citations) if citations else 0,
                },
            )

            # Store assessment
            self._assessments[assessment_id] = assessment

            # Store individual scores for trend analysis
            for score in metric_scores:
                self._quality_scores.append(score)

            # Check for alerts
            await self._check_quality_alerts(assessment, user_id, tenant_id)

            logger.info(
                f"Quality assessment completed: context={context_id}, "
                f"overall={overall_score:.3f}, duration={assessment.assessment_duration_ms:.2f}ms"
            )

            return assessment

        except Exception as e:
            logger.error(f"Quality assessment failed: {e}")
            # Return minimal assessment on error
            return QualityAssessment(
                assessment_id=str(uuid.uuid4()),
                context_id=context_id,
                overall_score=0.0,
                metric_scores=[],
                assessment_date=datetime.now(),
                assessment_duration_ms=(datetime.now() - start_time).total_seconds()
                * 1000,
                weaknesses=[f"Assessment failed: {str(e)}"],
            )

    async def _calculate_relevance_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate relevance quality score"""
        try:
            if not query_analysis or not retrieval_result:
                return QualityScore(
                    metric=metric,
                    score=0.5,
                    confidence=0.3,
                    measurement_date=datetime.now(),
                    explanation="Insufficient data for relevance assessment",
                )

            # Calculate query-document relevance
            query_keywords = set(query_analysis.keywords or [])
            query_entities = set(entity.text for entity in query_analysis.entities)

            relevance_scores = []
            for candidate in retrieval_result.candidates:
                content_words = set(candidate.chunk.content.lower().split())

                # Keyword relevance
                keyword_relevance = len(
                    query_keywords.intersection(content_words)
                ) / max(len(query_keywords), 1)

                # Entity relevance
                entity_relevance = len(
                    query_entities.intersection(content_words)
                ) / max(len(query_entities), 1)

                # Combined relevance
                combined_relevance = 0.7 * keyword_relevance + 0.3 * entity_relevance
                relevance_scores.append(combined_relevance)

            # Average relevance across all retrieved chunks
            avg_relevance = (
                sum(relevance_scores) / len(relevance_scores)
                if relevance_scores
                else 0.5
            )

            # Boost for high-ranked chunks
            if relevance_scores:
                top_3_avg = sum(relevance_scores[:3]) / min(3, len(relevance_scores))
                final_score = 0.7 * avg_relevance + 0.3 * top_3_avg
            else:
                final_score = 0.5

            confidence = min(
                len(relevance_scores) / 10, 1.0
            )  # Confidence based on sample size

            return QualityScore(
                metric=metric,
                score=min(max(final_score, 0.0), 1.0),
                confidence=confidence,
                measurement_date=datetime.now(),
                components={
                    "keyword_relevance": avg_relevance,
                    "entity_relevance": sum(
                        [
                            len(
                                query_entities.intersection(
                                    set(chunk.content.lower().split())
                                )
                            )
                            / max(len(query_entities), 1)
                            for chunk in [c.chunk for c in retrieval_result.candidates]
                        ]
                    )
                    / max(len(retrieval_result.candidates), 1)
                    if retrieval_result.candidates
                    else 0.5,
                    "top_chunk_relevance": top_3_avg if relevance_scores else 0.5,
                },
                explanation=f"Relevance based on keyword and entity matching with {len(relevance_scores)} chunks analyzed",
            )

        except Exception as e:
            logger.warning(f"Relevance score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_accuracy_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate factual accuracy score"""
        try:
            # Base accuracy on source authority and verification
            accuracy_score = 0.7  # Default

            # Authority-based accuracy
            if retrieval_result and retrieval_result.candidates:
                authority_scores = []
                for candidate in retrieval_result.candidates:
                    metadata = candidate.chunk.metadata or {}
                    authority = 0.5  # Base authority

                    # Boost for authoritative sources
                    if metadata.get("source_type") == "peer_reviewed":
                        authority += 0.3
                    elif metadata.get("source_type") == "academic":
                        authority += 0.2
                    elif metadata.get("source_type") == "official":
                        authority += 0.15

                    authority_scores.append(min(authority, 1.0))

                if authority_scores:
                    accuracy_score = sum(authority_scores) / len(authority_scores)

            # Citation quality boost
            if citations:
                citation_quality = sum(c.authority_score for c in citations) / len(
                    citations
                )
                accuracy_score = 0.7 * accuracy_score + 0.3 * citation_quality

            # Factual verification (simplified - would use fact-checking service)
            factual_boost = 0.0
            if query_analysis and query_analysis.intent.value in [
                "factual",
                "definition",
            ]:
                factual_boost = 0.1  # Assume factual queries get slight boost

            final_score = min(accuracy_score + factual_boost, 1.0)

            return QualityScore(
                metric=metric,
                score=final_score,
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "source_authority": accuracy_score,
                    "citation_quality": sum(c.authority_score for c in citations)
                    / len(citations)
                    if citations
                    else 0.5,
                    "factual_boost": factual_boost,
                },
                explanation=f"Accuracy based on source authority and citation quality",
            )

        except Exception as e:
            logger.warning(f"Accuracy score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_completeness_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate completeness score"""
        try:
            completeness_score = 0.5  # Default

            # Query coverage analysis
            if query_analysis and retrieval_result:
                query_keywords = set(query_analysis.keywords or [])
                covered_keywords = set()

                for candidate in retrieval_result.candidates:
                    content_words = set(candidate.chunk.content.lower().split())
                    covered_keywords.update(query_keywords.intersection(content_words))

                if query_keywords:
                    keyword_coverage = len(covered_keywords) / len(query_keywords)
                    completeness_score = (
                        0.6 * completeness_score + 0.4 * keyword_coverage
                    )

            # Entity coverage
            if query_analysis and retrieval_result:
                query_entities = set(entity.text for entity in query_analysis.entities)
                covered_entities = set()

                for candidate in retrieval_result.candidates:
                    content_words = set(candidate.chunk.content.lower().split())
                    covered_entities.update(query_entities.intersection(content_words))

                if query_entities:
                    entity_coverage = len(covered_entities) / len(query_entities)
                    completeness_score = (
                        0.7 * completeness_score + 0.3 * entity_coverage
                    )

            # Content length completeness
            if assembly_result:
                content_ratio = assembly_result.total_tokens / max(
                    assembly_result.metadata.get("target_tokens", 4000), 1
                )
                length_completeness = min(content_ratio, 1.0)
                completeness_score = (
                    0.8 * completeness_score + 0.2 * length_completeness
                )

            return QualityScore(
                metric=metric,
                score=min(completeness_score, 1.0),
                confidence=0.7,
                measurement_date=datetime.now(),
                components={
                    "keyword_coverage": len(covered_keywords) / len(query_keywords)
                    if query_analysis and query_keywords
                    else 0.5,
                    "entity_coverage": len(covered_entities) / len(query_entities)
                    if query_analysis and query_entities
                    else 0.5,
                    "length_completeness": length_completeness
                    if assembly_result
                    else 0.5,
                },
                explanation=f"Completeness based on query coverage and content length",
            )

        except Exception as e:
            logger.warning(f"Completeness score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_coherence_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate coherence score"""
        try:
            coherence_score = 0.6  # Default

            # Assembly coherence metrics
            if assembly_result and assembly_result.quality_metrics:
                coherence_score = assembly_result.quality_metrics.get(
                    "avg_coherence", 0.6
                )

            # Content flow analysis
            if retrieval_result and retrieval_result.candidates:
                # Check if chunks are logically ordered
                ordered_score = self._assess_content_ordering(
                    retrieval_result.candidates
                )
                coherence_score = 0.7 * coherence_score + 0.3 * ordered_score

            # Transition analysis
            if assembly_result:
                transition_score = self._analyze_transitions(
                    assembly_result.assembled_context
                )
                coherence_score = 0.8 * coherence_score + 0.2 * transition_score

            return QualityScore(
                metric=metric,
                score=min(coherence_score, 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "assembly_coherence": assembly_result.quality_metrics.get(
                        "avg_coherence", 0.6
                    )
                    if assembly_result
                    else 0.6,
                    "content_ordering": ordered_score if retrieval_result else 0.6,
                    "transition_quality": transition_score if assembly_result else 0.6,
                },
                explanation=f"Coherence based on content flow and logical ordering",
            )

        except Exception as e:
            logger.warning(f"Coherence score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_citation_quality_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate citation quality score"""
        try:
            if not citations:
                return QualityScore(
                    metric=metric,
                    score=0.3,  # Low score for no citations
                    confidence=0.8,
                    measurement_date=datetime.now(),
                    explanation="No citations found",
                )

            # Citation completeness
            valid_citations = sum(
                1 for c in citations if c.validation_status == "valid"
            )
            completeness = valid_citations / len(citations)

            # Authority score
            authority_score = sum(c.authority_score for c in citations) / len(citations)

            # Citation diversity
            unique_sources = len(
                set(c.metadata.source for c in citations if c.metadata.source)
            )
            diversity_score = min(unique_sources / len(citations), 1.0)

            # Format quality
            formatted_citations = sum(1 for c in citations if c.formatted_citations)
            format_score = formatted_citations / len(citations)

            # Combined score
            final_score = (
                0.3 * completeness
                + 0.3 * authority_score
                + 0.2 * diversity_score
                + 0.2 * format_score
            )

            return QualityScore(
                metric=metric,
                score=min(final_score, 1.0),
                confidence=0.8,
                measurement_date=datetime.now(),
                components={
                    "citation_completeness": completeness,
                    "authority_score": authority_score,
                    "diversity_score": diversity_score,
                    "format_score": format_score,
                },
                explanation=f"Citation quality based on {len(citations)} citations with {valid_citations} valid",
            )

        except Exception as e:
            logger.warning(f"Citation quality score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_authority_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate source authority score"""
        try:
            authority_scores = []

            # Source authority from retrieval results
            if retrieval_result and retrieval_result.candidates:
                for candidate in retrieval_result.candidates:
                    metadata = candidate.chunk.metadata or {}
                    authority = 0.5  # Base authority

                    # Boost for different source types
                    source_type = metadata.get("source_type", "").lower()
                    if source_type == "peer_reviewed":
                        authority += 0.4
                    elif source_type == "academic":
                        authority += 0.3
                    elif source_type == "official":
                        authority += 0.2
                    elif source_type == "book":
                        authority += 0.15

                    # Publisher reputation
                    publisher = metadata.get("publisher", "").lower()
                    reputable_publishers = [
                        "elsevier",
                        "springer",
                        "nature",
                        "science",
                        "ieee",
                        "acm",
                        "oxford",
                        "cambridge",
                        "wiley",
                        "taylor",
                    ]
                    if any(pub in publisher for pub in reputable_publishers):
                        authority += 0.1

                    authority_scores.append(min(authority, 1.0))

            # Citation authority
            if citations:
                citation_authority = sum(c.authority_score for c in citations) / len(
                    citations
                )
                authority_scores.append(citation_authority)

            # Average authority
            final_score = (
                sum(authority_scores) / len(authority_scores)
                if authority_scores
                else 0.5
            )

            return QualityScore(
                metric=metric,
                score=final_score,
                confidence=0.7,
                measurement_date=datetime.now(),
                components={
                    "source_authority": authority_scores[0]
                    if authority_scores
                    else 0.5,
                    "citation_authority": citation_authority if citations else 0.5,
                    "sources_evaluated": len(authority_scores),
                },
                explanation=f"Authority based on {len(authority_scores)} source evaluations",
            )

        except Exception as e:
            logger.warning(f"Authority score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_recency_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate recency score"""
        try:
            recency_scores = []
            current_year = datetime.now().year

            # Recency from retrieval results
            if retrieval_result and retrieval_result.candidates:
                for candidate in retrieval_result.candidates:
                    metadata = candidate.chunk.metadata or {}

                    # Check publication year
                    pub_year = metadata.get("publication_year")
                    if pub_year:
                        age = current_year - pub_year
                        if age <= 1:
                            recency = 1.0
                        elif age <= 3:
                            recency = 0.8
                        elif age <= 5:
                            recency = 0.6
                        elif age <= 10:
                            recency = 0.4
                        elif age <= 20:
                            recency = 0.2
                        else:
                            recency = 0.1
                    else:
                        recency = 0.5  # Default for unknown dates

                    recency_scores.append(recency)

            # Recency from citations
            if citations:
                for citation in citations:
                    if citation.metadata.publication_year:
                        age = current_year - citation.metadata.publication_year
                        if age <= 1:
                            recency = 1.0
                        elif age <= 3:
                            recency = 0.8
                        elif age <= 5:
                            recency = 0.6
                        elif age <= 10:
                            recency = 0.4
                        else:
                            recency = 0.2
                    else:
                        recency = 0.5

                    recency_scores.append(recency)

            # Average recency
            final_score = (
                sum(recency_scores) / len(recency_scores) if recency_scores else 0.5
            )

            # Boost for recent queries
            if query_analysis and query_analysis.urgency == "high":
                final_score = min(final_score * 1.2, 1.0)

            return QualityScore(
                metric=metric,
                score=final_score,
                confidence=0.8,
                measurement_date=datetime.now(),
                components={
                    "avg_recency": final_score,
                    "sources_evaluated": len(recency_scores),
                    "recent_sources": sum(1 for r in recency_scores if r > 0.7),
                },
                explanation=f"Recency based on {len(recency_scores)} source dates",
            )

        except Exception as e:
            logger.warning(f"Recency score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_diversity_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate diversity score"""
        try:
            diversity_score = 0.5  # Default

            # Source diversity
            if retrieval_result and retrieval_result.candidates:
                sources = set()
                source_types = set()

                for candidate in retrieval_result.candidates:
                    metadata = candidate.chunk.metadata or {}
                    if metadata.get("source"):
                        sources.add(metadata["source"])
                    if metadata.get("source_type"):
                        source_types.add(metadata["source_type"])

                source_diversity = min(
                    len(sources) / max(len(retrieval_result.candidates), 1), 1.0
                )
                type_diversity = min(
                    len(source_types) / 5, 1.0
                )  # Normalize by max 5 types

                diversity_score = (
                    0.4 * diversity_score
                    + 0.4 * source_diversity
                    + 0.2 * type_diversity
                )

            # Citation diversity
            if citations:
                citation_sources = set(
                    c.metadata.source for c in citations if c.metadata.source
                )
                citation_types = set(c.metadata.citation_type for c in citations)

                citation_diversity = min(
                    len(citation_sources) / max(len(citations), 1), 1.0
                )
                type_diversity = min(len(citation_types) / len(CitationType), 1.0)

                diversity_score = (
                    0.6 * diversity_score
                    + 0.3 * citation_diversity
                    + 0.1 * type_diversity
                )

            # Content diversity (from assembly result)
            if (
                assembly_result
                and "content_diversity" in assembly_result.quality_metrics
            ):
                content_diversity = assembly_result.quality_metrics["content_diversity"]
                diversity_score = 0.7 * diversity_score + 0.3 * content_diversity

            return QualityScore(
                metric=metric,
                score=min(diversity_score, 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "source_diversity": source_diversity if retrieval_result else 0.5,
                    "citation_diversity": citation_diversity if citations else 0.5,
                    "content_diversity": assembly_result.quality_metrics.get(
                        "content_diversity", 0.5
                    )
                    if assembly_result
                    else 0.5,
                },
                explanation=f"Diversity based on sources, citations, and content variety",
            )

        except Exception as e:
            logger.warning(f"Diversity score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_coverage_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate coverage score"""
        try:
            coverage_score = 0.5  # Default

            # Query intent coverage
            if query_analysis:
                intent_coverage = self._assess_intent_coverage(
                    query_analysis, retrieval_result, assembly_result
                )
                coverage_score = 0.6 * coverage_score + 0.4 * intent_coverage

            # Topic coverage
            if retrieval_result and retrieval_result.candidates:
                topic_coverage = self._assess_topic_coverage(
                    query_analysis, retrieval_result.candidates
                )
                coverage_score = 0.7 * coverage_score + 0.3 * topic_coverage

            # Coverage from assembly analysis
            if assembly_result and assembly_result.coverage_analysis:
                keyword_coverage = assembly_result.coverage_analysis.get(
                    "keyword_coverage", 0.5
                )
                coverage_score = 0.8 * coverage_score + 0.2 * keyword_coverage

            return QualityScore(
                metric=metric,
                score=min(coverage_score, 1.0),
                confidence=0.7,
                measurement_date=datetime.now(),
                components={
                    "intent_coverage": intent_coverage if query_analysis else 0.5,
                    "topic_coverage": topic_coverage if retrieval_result else 0.5,
                    "keyword_coverage": assembly_result.coverage_analysis.get(
                        "keyword_coverage", 0.5
                    )
                    if assembly_result
                    else 0.5,
                },
                explanation=f"Coverage based on query intent, topics, and keywords",
            )

        except Exception as e:
            logger.warning(f"Coverage score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_readability_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate readability score"""
        try:
            readability_score = 0.7  # Default

            # Analyze readability of assembled context
            if assembly_result:
                text = assembly_result.assembled_context

                # Simple readability metrics
                sentences = text.split(".")
                avg_sentence_length = sum(len(s.split()) for s in sentences) / max(
                    len(sentences), 1
                )

                # Ideal sentence length is 15-20 words
                if 15 <= avg_sentence_length <= 20:
                    sentence_score = 1.0
                elif 10 <= avg_sentence_length <= 25:
                    sentence_score = 0.8
                elif 5 <= avg_sentence_length <= 30:
                    sentence_score = 0.6
                else:
                    sentence_score = 0.4

                readability_score = 0.6 * readability_score + 0.4 * sentence_score

            # User-level appropriateness
            if query_analysis and query_analysis.complexity.value:
                complexity = query_analysis.complexity.value
                if complexity == "simple":
                    target_readability = 0.9
                elif complexity == "moderate":
                    target_readability = 0.7
                elif complexity == "complex":
                    target_readability = 0.5
                else:  # expert
                    target_readability = 0.3

                readability_score = 0.7 * readability_score + 0.3 * (
                    1.0 - abs(readability_score - target_readability)
                )

            return QualityScore(
                metric=metric,
                score=min(readability_score, 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "sentence_length_score": sentence_score if assembly_result else 0.7,
                    "complexity_appropriateness": 1.0
                    - abs(readability_score - target_readability)
                    if query_analysis
                    else 0.7,
                },
                explanation=f"Readability based on sentence complexity and user level",
            )

        except Exception as e:
            logger.warning(f"Readability score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_factual_correctness_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate factual correctness score"""
        try:
            # Base score on source authority and verification
            correctness_score = 0.7  # Default

            # Authority-based correctness
            if retrieval_result and retrieval_result.candidates:
                peer_reviewed_count = sum(
                    1
                    for candidate in retrieval_result.candidates
                    if candidate.chunk.metadata.get("source_type") == "peer_reviewed"
                )

                if retrieval_result.candidates:
                    peer_reviewed_ratio = peer_reviewed_count / len(
                        retrieval_result.candidates
                    )
                    correctness_score = (
                        0.6 * correctness_score + 0.4 * peer_reviewed_ratio
                    )

            # Citation-based correctness
            if citations:
                verified_citations = sum(
                    1
                    for citation in citations
                    if citation.validation_status == "valid"
                    and citation.authority_score > 0.7
                )

                citation_correctness = verified_citations / len(citations)
                correctness_score = 0.7 * correctness_score + 0.3 * citation_correctness

            # Note: In a real implementation, would integrate with fact-checking APIs

            return QualityScore(
                metric=metric,
                score=min(correctness_score, 1.0),
                confidence=0.5,  # Lower confidence without fact-checking
                measurement_date=datetime.now(),
                components={
                    "peer_reviewed_ratio": peer_reviewed_ratio
                    if retrieval_result
                    else 0.5,
                    "citation_correctness": citation_correctness if citations else 0.5,
                },
                explanation="Factual correctness based on source authority and verification",
            )

        except Exception as e:
            logger.warning(f"Factual correctness score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_bias_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate bias score (lower is better)"""
        try:
            # Start with neutral bias (low score is good for bias)
            bias_score = 0.3  # Default (low bias)

            # Source diversity reduces bias
            if retrieval_result and retrieval_result.candidates:
                sources = set(
                    candidate.chunk.metadata.get("source", "")
                    for candidate in retrieval_result.candidates
                )
                source_diversity = len(sources) / max(
                    len(retrieval_result.candidates), 1
                )

                # More diverse sources = less bias
                bias_reduction = source_diversity * 0.3
                bias_score = max(bias_score - bias_reduction, 0.0)

            # Citation diversity reduces bias
            if citations:
                citation_sources = set(
                    c.metadata.source for c in citations if c.metadata.source
                )
                citation_diversity = len(citation_sources) / max(len(citations), 1)

                bias_reduction = citation_diversity * 0.2
                bias_score = max(bias_score - bias_reduction, 0.0)

            # Check for biased language (simplified)
            if assembly_result:
                biased_terms = [
                    "always",
                    "never",
                    "obviously",
                    "clearly",
                    "everyone knows",
                    "of course",
                    "naturally",
                    "undoubtedly",
                    "without a doubt",
                ]

                text_lower = assembly_result.assembled_context.lower()
                biased_count = sum(1 for term in biased_terms if term in text_lower)
                word_count = len(text_lower.split())

                if word_count > 0:
                    biased_density = biased_count / word_count
                    bias_score += (
                        biased_density * 2.0
                    )  # Increase score for biased language

            # Ensure score is in 0-1 range
            bias_score = min(max(bias_score, 0.0), 1.0)

            return QualityScore(
                metric=metric,
                score=bias_score,
                confidence=0.4,  # Lower confidence for bias detection
                measurement_date=datetime.now(),
                components={
                    "source_diversity_bias_reduction": source_diversity * 0.3
                    if retrieval_result
                    else 0.0,
                    "citation_diversity_bias_reduction": citation_diversity * 0.2
                    if citations
                    else 0.0,
                    "biased_language_density": biased_density
                    if assembly_result
                    else 0.0,
                },
                explanation="Bias detection based on source diversity and language analysis",
            )

        except Exception as e:
            logger.warning(f"Bias score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_consistency_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate consistency score"""
        try:
            consistency_score = 0.7  # Default

            # Internal consistency of retrieved content
            if retrieval_result and retrieval_result.candidates:
                # Check for contradictory information
                contradictions = self._detect_contradictions(
                    retrieval_result.candidates
                )
                contradiction_penalty = min(contradictions * 0.1, 0.3)
                consistency_score -= contradiction_penalty

            # Citation consistency
            if citations:
                # Check if citations support each other
                citation_consistency = self._assess_citation_consistency(citations)
                consistency_score = 0.8 * consistency_score + 0.2 * citation_consistency

            # Temporal consistency
            if retrieval_result and retrieval_result.candidates:
                temporal_consistency = self._assess_temporal_consistency(
                    retrieval_result.candidates
                )
                consistency_score = 0.9 * consistency_score + 0.1 * temporal_consistency

            return QualityScore(
                metric=metric,
                score=min(max(consistency_score, 0.0), 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "contradiction_penalty": contradiction_penalty
                    if retrieval_result
                    else 0.0,
                    "citation_consistency": citation_consistency if citations else 0.7,
                    "temporal_consistency": temporal_consistency
                    if retrieval_result
                    else 0.7,
                },
                explanation="Consistency based on internal coherence and citation alignment",
            )

        except Exception as e:
            logger.warning(f"Consistency score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_clarity_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate clarity score"""
        try:
            clarity_score = 0.7  # Default

            # Text clarity analysis
            if assembly_result:
                text = assembly_result.assembled_context

                # Check sentence structure
                sentences = [s.strip() for s in text.split(".") if s.strip()]
                if sentences:
                    # Varying sentence lengths improve clarity
                    sentence_lengths = [len(s.split()) for s in sentences]
                    if sentence_lengths:
                        length_variance = statistics.variance(sentence_lengths)
                        # Moderate variance is good
                        if 10 <= length_variance <= 50:
                            variance_score = 1.0
                        elif 5 <= length_variance <= 100:
                            variance_score = 0.8
                        else:
                            variance_score = 0.6

                        clarity_score = 0.8 * clarity_score + 0.2 * variance_score

            # Query-answer alignment
            if query_analysis and assembly_result:
                alignment_score = self._assess_query_answer_alignment(
                    query_analysis, assembly_result.assembled_context
                )
                clarity_score = 0.7 * clarity_score + 0.3 * alignment_score

            return QualityScore(
                metric=metric,
                score=min(clarity_score, 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "sentence_structure_clarity": variance_score
                    if assembly_result
                    else 0.7,
                    "query_answer_alignment": alignment_score
                    if query_analysis and assembly_result
                    else 0.7,
                },
                explanation="Clarity based on sentence structure and query alignment",
            )

        except Exception as e:
            logger.warning(f"Clarity score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    async def _calculate_conciseness_score(
        self,
        metric: QualityMetric,
        query_analysis: Optional[QueryAnalysis],
        retrieval_result: Optional[RetrievalResult],
        assembly_result: Optional[AssemblyResult],
        citations: Optional[List[Citation]],
    ) -> QualityScore:
        """Calculate conciseness score"""
        try:
            conciseness_score = 0.6  # Default

            # Content density analysis
            if assembly_result:
                text = assembly_result.assembled_context
                word_count = len(text.split())

                # Information density (simplified)
                # Look for key information indicators
                info_indicators = [
                    "because",
                    "therefore",
                    "thus",
                    "however",
                    "although",
                    "specifically",
                    "particularly",
                    "especially",
                    "importantly",
                    "significantly",
                    "notably",
                    "crucially",
                ]

                info_count = sum(
                    1 for indicator in info_indicators if indicator in text.lower()
                )
                density_score = min(info_count / max(word_count / 100, 1), 1.0)

                conciseness_score = 0.7 * conciseness_score + 0.3 * density_score

            # Redundancy check
            if retrieval_result and retrieval_result.candidates:
                redundancy_penalty = self._calculate_content_redundancy(
                    retrieval_result.candidates
                )
                conciseness_score -= redundancy_penalty

            # Length appropriateness
            if assembly_result:
                target_length = 4000  # Typical context window
                actual_length = assembly_result.total_tokens
                length_ratio = min(actual_length / target_length, 1.0)

                # Penalize very short contexts
                if actual_length < 1000:
                    length_penalty = 0.3
                elif actual_length < 2000:
                    length_penalty = 0.1
                else:
                    length_penalty = 0.0

                conciseness_score = 0.8 * conciseness_score + 0.2 * (
                    1.0 - length_penalty
                )

            return QualityScore(
                metric=metric,
                score=min(max(conciseness_score, 0.0), 1.0),
                confidence=0.6,
                measurement_date=datetime.now(),
                components={
                    "information_density": density_score if assembly_result else 0.6,
                    "redundancy_penalty": redundancy_penalty
                    if retrieval_result
                    else 0.0,
                    "length_appropriateness": 1.0 - length_penalty
                    if assembly_result
                    else 0.7,
                },
                explanation="Conciseness based on information density and lack of redundancy",
            )

        except Exception as e:
            logger.warning(f"Conciseness score calculation failed: {e}")
            return QualityScore(
                metric=metric,
                score=0.5,
                confidence=0.0,
                measurement_date=datetime.now(),
                explanation=f"Calculation failed: {str(e)}",
            )

    def _calculate_overall_score(self, metric_scores: List[QualityScore]) -> float:
        """Calculate overall quality score from individual metrics"""
        if not metric_scores:
            return 0.5

        # Weight different metrics differently
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
            weight = weights.get(score.metric, 0.05)
            weighted_sum += score.score * weight
            total_weight += weight

        return weighted_sum / total_weight if total_weight > 0 else 0.5

    def _analyze_strengths_weaknesses(
        self, metric_scores: List[QualityScore]
    ) -> Tuple[List[str], List[str]]:
        """Analyze strengths and weaknesses from metric scores"""
        strengths = []
        weaknesses = []

        for score in metric_scores:
            if score.score >= 0.8:
                strengths.append(
                    f"Excellent {score.metric.value.replace('_', ' ')} ({score.score:.2f})"
                )
            elif score.score >= 0.6:
                strengths.append(
                    f"Good {score.metric.value.replace('_', ' ')} ({score.score:.2f})"
                )
            elif score.score < 0.4:
                weaknesses.append(
                    f"Poor {score.metric.value.replace('_', ' ')} ({score.score:.2f})"
                )
            elif score.score < 0.6:
                weaknesses.append(
                    f"Needs improvement in {score.metric.value.replace('_', ' ')} ({score.score:.2f})"
                )

        return strengths, weaknesses

    def _generate_recommendations(
        self, metric_scores: List[QualityScore], weaknesses: List[str]
    ) -> List[str]:
        """Generate improvement recommendations"""
        recommendations = []

        for score in metric_scores:
            if score.metric == QualityMetric.RELEVANCE and score.score < 0.6:
                recommendations.append(
                    "Improve query understanding and keyword extraction for better relevance"
                )
            elif score.metric == QualityMetric.ACCURACY and score.score < 0.6:
                recommendations.append(
                    "Include more authoritative and peer-reviewed sources"
                )
            elif score.metric == QualityMetric.COMPLETENESS and score.score < 0.6:
                recommendations.append(
                    "Expand coverage to include more aspects of the query"
                )
            elif score.metric == QualityMetric.CITATION_QUALITY and score.score < 0.6:
                recommendations.append(
                    "Add proper citations and verify citation formats"
                )
            elif score.metric == QualityMetric.DIVERSITY and score.score < 0.6:
                recommendations.append(
                    "Include sources from diverse perspectives and publication types"
                )
            elif score.metric == QualityMetric.READABILITY and score.score < 0.6:
                recommendations.append("Improve text structure and sentence complexity")
            elif score.metric == QualityMetric.CLARITY and score.score < 0.6:
                recommendations.append(
                    "Enhance content clarity and query-answer alignment"
                )

        return recommendations

    def _identify_risk_factors(self, metric_scores: List[QualityScore]) -> List[str]:
        """Identify potential risk factors"""
        risks = []

        # Check for critical issues
        critical_metrics = [QualityMetric.ACCURACY, QualityMetric.RELEVANCE]
        for score in metric_scores:
            if score.metric in critical_metrics and score.score < 0.3:
                risks.append(
                    f"Critical issue with {score.metric.value.replace('_', ' ')}"
                )

        # Check for bias
        bias_score = next(
            (s for s in metric_scores if s.metric == QualityMetric.BIAS_DETECTION), None
        )
        if bias_score and bias_score.score > 0.7:
            risks.append("High bias detected in content")

        # Check for very low overall quality
        overall_score = self._calculate_overall_score(metric_scores)
        if overall_score < 0.4:
            risks.append("Overall quality below acceptable threshold")

        return risks

    def _calculate_compliance_score(self, metric_scores: List[QualityScore]) -> float:
        """Calculate compliance score based on quality metrics"""
        # Define compliance requirements
        required_metrics = [
            QualityMetric.RELEVANCE,
            QualityMetric.ACCURACY,
            QualityMetric.CITATION_QUALITY,
        ]

        required_scores = [
            s.score for s in metric_scores if s.metric in required_metrics
        ]

        if not required_scores:
            return 0.5

        # Compliance requires minimum scores on required metrics
        min_score = min(required_scores)
        avg_score = sum(required_scores) / len(required_scores)

        return 0.7 * min_score + 0.3 * avg_score

    def _predict_user_satisfaction(
        self, overall_score: float, metric_scores: List[QualityScore]
    ) -> float:
        """Predict user satisfaction based on quality scores"""
        # Base prediction on overall score
        satisfaction = overall_score

        # Boost for high relevance and clarity
        relevance_score = next(
            (s.score for s in metric_scores if s.metric == QualityMetric.RELEVANCE), 0.5
        )
        clarity_score = next(
            (s.score for s in metric_scores if s.metric == QualityMetric.CLARITY), 0.5
        )

        satisfaction = (
            0.6 * satisfaction + 0.25 * relevance_score + 0.15 * clarity_score
        )

        return min(satisfaction, 1.0)

    def _compare_with_benchmarks(self, metric_scores: List[QualityScore]) -> None:
        """Compare scores with benchmarks and update percentile ranks"""
        for score in metric_scores:
            if score.metric in self._benchmarks and self._benchmarks[score.metric]:
                # Use the most recent benchmark
                benchmark = self._benchmarks[score.metric][-1]

                # Calculate percentile rank
                better_count = sum(
                    1 for b in benchmark.benchmark_scores if b < score.score
                )
                percentile = better_count / len(benchmark.benchmark_scores)

                score.percentile_rank = percentile
                score.benchmark_score = benchmark.mean_score

    async def _check_quality_alerts(
        self,
        assessment: QualityAssessment,
        user_id: Optional[str],
        tenant_id: Optional[str],
    ) -> None:
        """Check for quality alerts and create them if needed"""
        for score in assessment.metric_scores:
            threshold = self.config.alert_thresholds.get(score.metric, 0.5)

            # Different logic for bias (lower is better)
            if score.metric == QualityMetric.BIAS_DETECTION:
                if score.score > threshold:
                    await self._create_quality_alert(
                        score.metric,
                        score.score,
                        threshold,
                        assessment,
                        user_id,
                        tenant_id,
                    )
            else:
                if score.score < threshold:
                    await self._create_quality_alert(
                        score.metric,
                        score.score,
                        threshold,
                        assessment,
                        user_id,
                        tenant_id,
                    )

    async def _create_quality_alert(
        self,
        metric: QualityMetric,
        current_score: float,
        threshold: float,
        assessment: QualityAssessment,
        user_id: Optional[str],
        tenant_id: Optional[str],
    ) -> None:
        """Create a quality alert"""
        # Determine severity
        if metric == QualityMetric.BIAS_DETECTION:
            # For bias, higher score = more severe
            if current_score > 0.8:
                severity = AlertSeverity.CRITICAL
            elif current_score > 0.6:
                severity = AlertSeverity.HIGH
            elif current_score > threshold:
                severity = AlertSeverity.MEDIUM
            else:
                severity = AlertSeverity.LOW
        else:
            # For other metrics, lower score = more severe
            if current_score < 0.3:
                severity = AlertSeverity.CRITICAL
            elif current_score < 0.5:
                severity = AlertSeverity.HIGH
            elif current_score < threshold:
                severity = AlertSeverity.MEDIUM
            else:
                severity = AlertSeverity.LOW

        # Generate message and recommendation
        if metric == QualityMetric.BIAS_DETECTION:
            message = f"High bias detected ({current_score:.2f} > {threshold:.2f})"
            recommendation = (
                "Review content for biased language and include diverse perspectives"
            )
        else:
            message = f"Low {metric.value.replace('_', ' ')} ({current_score:.2f} < {threshold:.2f})"
            recommendation = f"Improve {metric.value.replace('_', ' ')} through better sources and content selection"

        alert = QualityAlert(
            alert_id=str(uuid.uuid4()),
            severity=severity,
            metric=metric,
            current_score=current_score,
            threshold_score=threshold,
            message=message,
            recommendation=recommendation,
            created_at=datetime.now(),
            context_id=assessment.context_id,
            user_id=user_id,
            tenant_id=tenant_id,
        )

        self._alerts[alert.alert_id] = alert
        logger.warning(f"Quality alert created: {message}")

    # Helper methods for quality calculations
    def _assess_content_ordering(self, candidates: List[Any]) -> float:
        """Assess logical ordering of content chunks"""
        # Simplified implementation
        return 0.7

    def _analyze_transitions(self, content: str) -> float:
        """Analyze transition quality in content"""
        transition_words = [
            "however",
            "therefore",
            "thus",
            "consequently",
            "moreover",
            "furthermore",
            "nevertheless",
            "nonetheless",
            "meanwhile",
        ]

        transition_count = sum(
            1 for word in transition_words if word in content.lower()
        )
        sentences = len(content.split("."))

        return min(transition_count / max(sentences, 1), 1.0)

    def _assess_intent_coverage(
        self, query_analysis, retrieval_result, assembly_result
    ) -> float:
        """Assess how well the content covers query intent"""
        # Simplified implementation
        return 0.7

    def _assess_topic_coverage(self, query_analysis, candidates) -> float:
        """Assess topic coverage"""
        # Simplified implementation
        return 0.6

    def _detect_contradictions(self, candidates) -> int:
        """Detect contradictory information"""
        # Simplified implementation
        return 0

    def _assess_citation_consistency(self, citations) -> float:
        """Assess consistency between citations"""
        # Simplified implementation
        return 0.8

    def _assess_temporal_consistency(self, candidates) -> float:
        """Assess temporal consistency"""
        # Simplified implementation
        return 0.7

    def _assess_query_answer_alignment(self, query_analysis, content) -> float:
        """Assess alignment between query and answer"""
        # Simplified implementation
        return 0.6

    def _calculate_content_redundancy(self, candidates) -> float:
        """Calculate content redundancy"""
        # Simplified implementation
        return 0.1

    def get_service_metrics(self) -> Dict[str, Any]:
        """Get service performance metrics"""
        return {
            "assessments_count": len(self._assessments),
            "quality_scores_count": len(self._quality_scores),
            "active_alerts_count": sum(
                1 for alert in self._alerts.values() if not alert.resolved
            ),
            "benchmarks_available": {
                metric.value: len(benchmarks)
                for metric, benchmarks in self._benchmarks.items()
            },
            "monitoring_active": self._monitoring_active,
            "supported_metrics": [metric.value for metric in QualityMetric],
            "background_tasks_count": len(self._background_tasks),
        }
