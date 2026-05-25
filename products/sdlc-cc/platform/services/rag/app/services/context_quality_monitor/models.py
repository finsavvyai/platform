"""
Context Quality Monitor Models

Data models, enums, and configuration for quality monitoring.
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple


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
    score: float
    confidence: float
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
    trend_strength: float
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
    alert_thresholds: Dict[QualityMetric, float] = field(
        default_factory=dict
    )
    benchmark_comparison_enabled: bool = True
    auto_improvement_suggestions: bool = True
    user_feedback_integration: bool = True
    compliance_monitoring: bool = True
    bias_detection_enabled: bool = True
    factual_verification_enabled: bool = False
    performance_impact_limit: float = 0.1
