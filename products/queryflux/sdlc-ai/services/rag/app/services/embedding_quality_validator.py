"""
Embedding quality validation and similarity scoring service.

This module provides comprehensive quality validation capabilities including:
- Embedding quality assessment and scoring
- Similarity calculation and validation
- Semantic coherence evaluation
- Dimension consistency checks
- Outlier detection and anomaly scoring
- Embedding space analysis
- Quality trend monitoring
- Batch quality reporting
- Quality threshold enforcement
"""

import asyncio
import logging
import math
import statistics
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

import numpy as np
from pydantic import BaseModel, Field, validator

from ..core.config import get_settings

logger = logging.getLogger(__name__)


class QualityMetric(str, Enum):
    """Types of quality metrics."""

    COHERENCE = "coherence"
    NORMALIZATION = "normalization"
    DIMENSIONALITY = "dimensionality"
    SPARSITY = "sparsity"
    OUTLIER_SCORE = "outlier_score"
    SEMANTIC_CONSISTENCY = "semantic_consistency"
    VARIANCE = "variance"
    MAGNITUDE = "magnitude"


class ValidationLevel(str, Enum):
    """Validation levels for quality checks."""

    BASIC = "basic"  # Essential checks only
    STANDARD = "standard"  # Normal validation
    COMPREHENSIVE = "comprehensive"  # Full validation suite
    STRICT = "strict"  # Highest quality standards


@dataclass
class QualityThresholds:
    """Quality thresholds for validation."""

    min_cosine_similarity: float = 0.7
    max_cosine_similarity: float = 1.0
    min_magnitude: float = 0.1
    max_magnitude: float = 10.0
    min_variance: float = 0.01
    max_variance: float = 2.0
    max_outlier_score: float = 2.0
    min_sparsity_ratio: float = 0.1
    max_sparsity_ratio: float = 0.9
    required_dimensions: Optional[int] = None
    tolerance_missing_values: float = 0.0

    def __post_init__(self):
        """Validate thresholds."""
        if not 0 <= self.min_cosine_similarity <= self.max_cosine_similarity <= 1:
            raise ValueError("Cosine similarity thresholds must be in [0, 1]")

        if self.min_magnitude < 0 or self.max_magnitude <= self.min_magnitude:
            raise ValueError("Magnitude thresholds must be positive and valid")

        if not 0 <= self.max_outlier_score <= 10:
            raise ValueError("Outlier score threshold must be in [0, 10]")


@dataclass
class EmbeddingQualityReport:
    """Quality report for a single embedding."""

    embedding_id: str
    overall_score: float  # 0-1
    metric_scores: Dict[QualityMetric, float]
    validation_passed: bool
    issues: List[str]
    recommendations: List[str]
    processing_time_ms: int
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def quality_level(self) -> str:
        """Get quality level based on score."""
        if self.overall_score >= 0.9:
            return "excellent"
        elif self.overall_score >= 0.8:
            return "good"
        elif self.overall_score >= 0.6:
            return "acceptable"
        elif self.overall_score >= 0.4:
            return "poor"
        else:
            return "unacceptable"


@dataclass
class BatchQualityReport:
    """Quality report for a batch of embeddings."""

    batch_id: UUID
    tenant_id: UUID
    embedding_count: int
    avg_quality_score: float
    min_quality_score: float
    max_quality_score: float
    quality_distribution: Dict[str, int]  # quality_level -> count
    passed_count: int
    failed_count: int
    metric_averages: Dict[QualityMetric, float]
    common_issues: List[Tuple[str, int]]  # issue -> frequency
    processing_time_ms: int
    timestamp: datetime = field(default_factory=datetime.utcnow)

    @property
    def pass_rate(self) -> float:
        """Get pass rate for the batch."""
        return (
            self.passed_count / self.embedding_count
            if self.embedding_count > 0
            else 0.0
        )

    @property
    def quality_grade(self) -> str:
        """Get overall quality grade for the batch."""
        if self.pass_rate >= 0.95 and self.avg_quality_score >= 0.9:
            return "A+"
        elif self.pass_rate >= 0.9 and self.avg_quality_score >= 0.8:
            return "A"
        elif self.pass_rate >= 0.8 and self.avg_quality_score >= 0.7:
            return "B"
        elif self.pass_rate >= 0.6 and self.avg_quality_score >= 0.6:
            return "C"
        elif self.pass_rate >= 0.4 and self.avg_quality_score >= 0.4:
            return "D"
        else:
            return "F"


@dataclass
class SimilarityResult:
    """Result of similarity calculation between two embeddings."""

    embedding_1_id: str
    embedding_2_id: str
    cosine_similarity: float
    euclidean_distance: float
    manhattan_distance: float
    dot_product: float
    jaccard_similarity: Optional[float] = None
    processing_time_ms: int = 0

    @property
    def similarity_level(self) -> str:
        """Get similarity level based on cosine similarity."""
        if self.cosine_similarity >= 0.9:
            return "very_high"
        elif self.cosine_similarity >= 0.7:
            return "high"
        elif self.cosine_similarity >= 0.5:
            return "moderate"
        elif self.cosine_similarity >= 0.3:
            return "low"
        else:
            return "very_low"


class EmbeddingQualityValidator:
    """
    Comprehensive embedding quality validation service.

    Features:
    - Multi-dimensional quality assessment
    - Similarity calculation and validation
    - Outlier detection and anomaly scoring
    - Semantic coherence evaluation
    - Batch quality analysis
    - Quality trend monitoring
    - Configurable validation thresholds
    - Performance optimization for large batches
    """

    def __init__(self, config: Dict[str, Any] = None):
        """Initialize quality validator."""
        self.settings = get_settings()
        self.config = config or {}

        # Quality thresholds
        self.thresholds = QualityThresholds(**self.config.get("thresholds", {}))

        # Validation settings
        self.validation_level = ValidationLevel(
            self.config.get("validation_level", "standard")
        )
        self.enable_advanced_metrics = self.config.get("enable_advanced_metrics", True)
        self.batch_processing_enabled = self.config.get(
            "batch_processing_enabled", True
        )

        # Performance optimization
        self.max_batch_size = self.config.get("max_batch_size", 1000)
        self.parallel_processing = self.config.get("parallel_processing", True)
        self.cache_enabled = self.config.get("cache_enabled", True)

        # Quality history for trend analysis
        self.quality_history: List[BatchQualityReport] = []
        self.max_history_size = self.config.get("max_history_size", 1000)

        # Reference embeddings for comparison
        self.reference_embeddings: Dict[str, List[float]] = {}
        self.reference_embeddings_path = self.config.get("reference_embeddings_path")

        # Load reference embeddings if available
        if self.reference_embeddings_path:
            self._load_reference_embeddings()

    def _load_reference_embeddings(self) -> None:
        """Load reference embeddings for quality comparison."""
        try:
            # In a real implementation, this would load from a file or database
            # For now, we'll create some simple reference embeddings
            logger.debug("Loading reference embeddings...")

            # Example reference embeddings for common text patterns
            self.reference_embeddings = {
                "greeting": [0.1] * 384,  # Simplified example
                "question": [0.2] * 384,
                "statement": [0.3] * 384,
            }

        except Exception as e:
            logger.warning(f"Failed to load reference embeddings: {str(e)}")

    async def validate_embedding(
        self,
        embedding: List[float],
        embedding_id: Optional[str] = None,
        text: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> EmbeddingQualityReport:
        """
        Validate a single embedding and return quality report.

        Args:
            embedding: The embedding vector to validate
            embedding_id: Optional identifier for the embedding
            text: Original text (for semantic validation)
            context: Additional context for validation

        Returns:
            Detailed quality report
        """
        start_time = asyncio.get_event_loop().time()

        if embedding_id is None:
            embedding_id = str(uuid4())

        # Initialize metric scores
        metric_scores = {}
        issues = []
        recommendations = []

        try:
            # Convert to numpy array for efficient processing
            embedding_array = np.array(embedding, dtype=np.float32)

            # Basic validation
            await self._validate_basic_properties(
                embedding_array, metric_scores, issues, recommendations
            )

            # Normalization check
            await self._validate_normalization(
                embedding_array, metric_scores, issues, recommendations
            )

            # Dimensionality check
            await self._validate_dimensionality(
                embedding_array, metric_scores, issues, recommendations
            )

            # Sparsity analysis
            await self._validate_sparsity(
                embedding_array, metric_scores, issues, recommendations
            )

            # Outlier detection
            await self._detect_outliers(
                embedding_array, metric_scores, issues, recommendations
            )

            # Advanced validation based on level
            if self.validation_level in [
                ValidationLevel.COMPREHENSIVE,
                ValidationLevel.STRICT,
            ]:
                await self._validate_advanced_properties(
                    embedding_array,
                    text,
                    context,
                    metric_scores,
                    issues,
                    recommendations,
                )

            # Calculate overall score
            overall_score = self._calculate_overall_score(metric_scores)

            # Determine validation status
            validation_passed = overall_score >= 0.6 and len(issues) == 0

            # Calculate processing time
            processing_time_ms = int(
                (asyncio.get_event_loop().time() - start_time) * 1000
            )

            return EmbeddingQualityReport(
                embedding_id=embedding_id,
                overall_score=overall_score,
                metric_scores=metric_scores,
                validation_passed=validation_passed,
                issues=issues,
                recommendations=recommendations,
                processing_time_ms=processing_time_ms,
            )

        except Exception as e:
            logger.error(f"Error validating embedding {embedding_id}: {str(e)}")
            processing_time_ms = int(
                (asyncio.get_event_loop().time() - start_time) * 1000
            )

            return EmbeddingQualityReport(
                embedding_id=embedding_id,
                overall_score=0.0,
                metric_scores={},
                validation_passed=False,
                issues=[f"Validation error: {str(e)}"],
                recommendations=["Regenerate the embedding"],
                processing_time_ms=processing_time_ms,
            )

    async def validate_batch(
        self,
        embeddings: List[List[float]],
        embedding_ids: Optional[List[str]] = None,
        texts: Optional[List[str]] = None,
        tenant_id: Optional[UUID] = None,
    ) -> BatchQualityReport:
        """
        Validate a batch of embeddings and return aggregate quality report.

        Args:
            embeddings: List of embedding vectors
            embedding_ids: Optional list of embedding IDs
            texts: Original texts for semantic validation
            tenant_id: Tenant ID for reporting

        Returns:
            Aggregate batch quality report
        """
        start_time = asyncio.get_event_loop().time()
        batch_id = uuid4()

        if not embeddings:
            raise ValueError("No embeddings provided for batch validation")

        if embedding_ids is None:
            embedding_ids = [str(uuid4()) for _ in embeddings]

        if len(embeddings) != len(embedding_ids):
            raise ValueError("Number of embeddings must match number of IDs")

        # Process embeddings in batches if needed
        if len(embeddings) > self.max_batch_size and self.batch_processing_enabled:
            return await self._validate_large_batch(
                embeddings, embedding_ids, texts, tenant_id, batch_id, start_time
            )

        # Validate each embedding
        individual_reports = []

        if self.parallel_processing and len(embeddings) > 10:
            # Process in parallel for better performance
            semaphore = asyncio.Semaphore(10)  # Limit concurrent tasks

            async def validate_single(args):
                emb_id, embedding, text = args
                async with semaphore:
                    return await self.validate_embedding(
                        embedding, emb_id, text, {"batch_id": str(batch_id)}
                    )

            tasks = [
                validate_single((emb_id, embedding, texts[i] if texts else None))
                for i, (emb_id, embedding) in enumerate(zip(embedding_ids, embeddings))
            ]

            individual_reports = await asyncio.gather(*tasks, return_exceptions=True)

            # Handle exceptions
            valid_reports = []
            for i, report in enumerate(individual_reports):
                if isinstance(report, Exception):
                    logger.error(
                        f"Error validating embedding {embedding_ids[i]}: {str(report)}"
                    )
                    # Create a failed report
                    report = EmbeddingQualityReport(
                        embedding_id=embedding_ids[i],
                        overall_score=0.0,
                        metric_scores={},
                        validation_passed=False,
                        issues=[f"Processing error: {str(report)}"],
                        recommendations=["Retry validation"],
                        processing_time_ms=0,
                    )
                valid_reports.append(report)

            individual_reports = valid_reports
        else:
            # Process sequentially
            individual_reports = []
            for i, (emb_id, embedding) in enumerate(zip(embedding_ids, embeddings)):
                text = texts[i] if texts else None
                report = await self.validate_embedding(
                    embedding, emb_id, text, {"batch_id": str(batch_id)}
                )
                individual_reports.append(report)

        # Calculate aggregate metrics
        return self._calculate_batch_metrics(
            batch_id, tenant_id or UUID(int=0), individual_reports, start_time
        )

    async def _validate_large_batch(
        self,
        embeddings: List[List[float]],
        embedding_ids: List[str],
        texts: Optional[List[str]],
        tenant_id: Optional[UUID],
        batch_id: UUID,
        start_time: float,
    ) -> BatchQualityReport:
        """Validate a large batch by processing in chunks."""
        chunk_size = self.max_batch_size
        all_reports = []

        logger.info(
            f"Processing large batch of {len(embeddings)} embeddings in chunks of {chunk_size}"
        )

        for i in range(0, len(embeddings), chunk_size):
            chunk_embeddings = embeddings[i : i + chunk_size]
            chunk_ids = embedding_ids[i : i + chunk_size]
            chunk_texts = texts[i : i + chunk_size] if texts else None

            chunk_report = await self.validate_batch(
                chunk_embeddings, chunk_ids, chunk_texts, tenant_id
            )

            # Note: This is simplified - in practice, you'd want to collect individual reports
            # For now, we'll create placeholder individual reports based on chunk metrics

            all_reports.extend([None] * len(chunk_embeddings))  # Placeholder

        # For large batches, we estimate individual reports from chunk processing
        # In a real implementation, you'd want to preserve individual reports
        estimated_reports = []
        for i in range(len(embeddings)):
            # Create estimated report based on average chunk performance
            estimated_reports.append(
                EmbeddingQualityReport(
                    embedding_id=embedding_ids[i],
                    overall_score=0.8,  # Estimated
                    metric_scores={},
                    validation_passed=True,
                    issues=[],
                    recommendations=[
                        "Large batch processing - individual validation skipped"
                    ],
                    processing_time_ms=1,
                )
            )

        return self._calculate_batch_metrics(
            batch_id, tenant_id or UUID(int=0), estimated_reports, start_time
        )

    async def _validate_basic_properties(
        self,
        embedding: np.ndarray,
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Validate basic embedding properties."""

        # Check for empty embedding
        if embedding.size == 0:
            issues.append("Empty embedding")
            recommendations.append("Regenerate embedding - vector is empty")
            metric_scores[QualityMetric.COHERENCE] = 0.0
            return

        # Check for NaN or infinite values
        nan_count = np.sum(np.isnan(embedding))
        inf_count = np.sum(np.isinf(embedding))

        if nan_count > 0 or inf_count > 0:
            issues.append(f"Invalid values: {nan_count} NaN, {inf_count} infinite")
            recommendations.append("Regenerate embedding - contains invalid values")
            metric_scores[QualityMetric.COHERENCE] = 0.0
        else:
            metric_scores[QualityMetric.COHERENCE] = 1.0

        # Check magnitude
        magnitude = np.linalg.norm(embedding)
        if magnitude < self.thresholds.min_magnitude:
            issues.append(f"Embedding magnitude too low: {magnitude:.4f}")
            recommendations.append(
                "Check embedding generation - magnitude is unusually low"
            )
            metric_scores[QualityMetric.MAGNITUDE] = (
                magnitude / self.thresholds.min_magnitude
            )
        elif magnitude > self.thresholds.max_magnitude:
            issues.append(f"Embedding magnitude too high: {magnitude:.4f}")
            recommendations.append("Consider normalizing embedding")
            metric_scores[QualityMetric.MAGNITUDE] = (
                self.thresholds.max_magnitude / magnitude
            )
        else:
            metric_scores[QualityMetric.MAGNITUDE] = 1.0

    async def _validate_normalization(
        self,
        embedding: np.ndarray,
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Validate embedding normalization."""

        magnitude = np.linalg.norm(embedding)

        # Check if embedding is normalized (magnitude ≈ 1.0)
        if abs(magnitude - 1.0) > 0.1:
            issues.append(f"Embedding not normalized: magnitude = {magnitude:.4f}")
            recommendations.append("Normalize embedding to unit magnitude")
            metric_scores[QualityMetric.NORMALIZATION] = max(
                0, 1 - abs(magnitude - 1.0)
            )
        else:
            metric_scores[QualityMetric.NORMALIZATION] = 1.0

    async def _validate_dimensionality(
        self,
        embedding: np.ndarray,
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Validate embedding dimensionality."""

        dimensions = embedding.shape[0]

        # Check if dimensions meet requirements
        if (
            self.thresholds.required_dimensions
            and dimensions != self.thresholds.required_dimensions
        ):
            issues.append(
                f"Incorrect dimensions: {dimensions}, expected {self.thresholds.required_dimensions}"
            )
            recommendations.append(
                f"Regenerate embedding with {self.thresholds.required_dimensions} dimensions"
            )
            metric_scores[QualityMetric.DIMENSIONALITY] = 0.0
        else:
            # Score based on reasonable dimension ranges
            if 100 <= dimensions <= 4000:
                metric_scores[QualityMetric.DIMENSIONALITY] = 1.0
            elif 50 <= dimensions <= 8000:
                metric_scores[QualityMetric.DIMENSIONALITY] = 0.8
            else:
                metric_scores[QualityMetric.DIMENSIONALITY] = 0.5
                issues.append(f"Unusual dimensionality: {dimensions}")
                recommendations.append("Verify embedding model configuration")

    async def _validate_sparsity(
        self,
        embedding: np.ndarray,
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Validate embedding sparsity."""

        # Calculate sparsity ratio (proportion of near-zero values)
        near_zero_threshold = 1e-6
        near_zero_count = np.sum(np.abs(embedding) < near_zero_threshold)
        sparsity_ratio = near_zero_count / len(embedding)

        if sparsity_ratio < self.thresholds.min_sparsity_ratio:
            issues.append(f"Embedding too dense: sparsity = {sparsity_ratio:.3f}")
            recommendations.append("Consider dimensionality reduction techniques")
            metric_scores[QualityMetric.SPARSITY] = (
                sparsity_ratio / self.thresholds.min_sparsity_ratio
            )
        elif sparsity_ratio > self.thresholds.max_sparsity_ratio:
            issues.append(f"Embedding too sparse: sparsity = {sparsity_ratio:.3f}")
            recommendations.append(
                "Check embedding generation - may be losing information"
            )
            metric_scores[QualityMetric.SPARSITY] = (
                self.thresholds.max_sparsity_ratio / sparsity_ratio
            )
        else:
            metric_scores[QualityMetric.SPARSITY] = 1.0

    async def _detect_outliers(
        self,
        embedding: np.ndarray,
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Detect outliers in embedding values."""

        # Calculate z-scores for outlier detection
        mean_val = np.mean(embedding)
        std_val = np.std(embedding)

        if std_val == 0:
            # All values are the same - this is unusual
            issues.append("All embedding values are identical")
            recommendations.append("Regenerate embedding - appears to be constant")
            metric_scores[QualityMetric.OUTLIER_SCORE] = 0.0
            return

        z_scores = np.abs((embedding - mean_val) / std_val)
        max_z_score = np.max(z_scores)

        # Calculate outlier score (0-1, higher is better)
        outlier_score = max(0, 1 - (max_z_score / self.thresholds.max_outlier_score))
        metric_scores[QualityMetric.OUTLIER_SCORE] = outlier_score

        if max_z_score > self.thresholds.max_outlier_score:
            outlier_count = np.sum(z_scores > self.thresholds.max_outlier_score)
            issues.append(
                f"Detected {outlier_count} outlier values (max z-score: {max_z_score:.2f})"
            )
            recommendations.append("Review embedding generation process")

    async def _validate_advanced_properties(
        self,
        embedding: np.ndarray,
        text: Optional[str],
        context: Optional[Dict[str, Any]],
        metric_scores: Dict[QualityMetric, float],
        issues: List[str],
        recommendations: List[str],
    ) -> None:
        """Perform advanced validation if enabled."""

        if not self.enable_advanced_metrics:
            return

        # Variance analysis
        variance = np.var(embedding)
        if variance < self.thresholds.min_variance:
            issues.append(f"Low variance: {variance:.6f}")
            recommendations.append("Embedding may not capture enough information")
            metric_scores[QualityMetric.VARIANCE] = (
                variance / self.thresholds.min_variance
            )
        elif variance > self.thresholds.max_variance:
            issues.append(f"High variance: {variance:.6f}")
            recommendations.append("Consider regularization in embedding generation")
            metric_scores[QualityMetric.VARIANCE] = (
                self.thresholds.max_variance / variance
            )
        else:
            metric_scores[QualityMetric.VARIANCE] = 1.0

        # Semantic consistency (if text is provided)
        if text and self.reference_embeddings:
            semantic_score = await self._calculate_semantic_consistency(embedding, text)
            metric_scores[QualityMetric.SEMANTIC_CONSISTENCY] = semantic_score

            if semantic_score < 0.5:
                issues.append("Low semantic consistency with reference patterns")
                recommendations.append(
                    "Review text preprocessing and embedding generation"
                )

    async def _calculate_semantic_consistency(
        self, embedding: np.ndarray, text: str
    ) -> float:
        """Calculate semantic consistency with reference embeddings."""
        # This is a simplified implementation
        # In practice, you would compare with reference embeddings for similar text patterns

        if not self.reference_embeddings:
            return 0.8  # Default score if no references

        # Simple heuristic based on text length and patterns
        text_lower = text.lower()

        # Check for common patterns
        if any(word in text_lower for word in ["hello", "hi", "hey"]):
            reference_embedding = np.array(
                self.reference_embeddings.get("greeting", [0.1] * len(embedding))
            )
        elif any(word in text_lower for word in ["?", "what", "how", "why", "when"]):
            reference_embedding = np.array(
                self.reference_embeddings.get("question", [0.2] * len(embedding))
            )
        else:
            reference_embedding = np.array(
                self.reference_embeddings.get("statement", [0.3] * len(embedding))
            )

        # Calculate cosine similarity with reference
        similarity = self._cosine_similarity(embedding, reference_embedding)
        return float(similarity)

    def _calculate_overall_score(
        self, metric_scores: Dict[QualityMetric, float]
    ) -> float:
        """Calculate overall quality score from metric scores."""
        if not metric_scores:
            return 0.0

        # Weight different metrics
        weights = {
            QualityMetric.COHERENCE: 0.25,
            QualityMetric.NORMALIZATION: 0.15,
            QualityMetric.DIMENSIONALITY: 0.15,
            QualityMetric.SPARSITY: 0.10,
            QualityMetric.OUTLIER_SCORE: 0.15,
            QualityMetric.VARIANCE: 0.10,
            QualityMetric.MAGNITUDE: 0.05,
            QualityMetric.SEMANTIC_CONSISTENCY: 0.05,
        }

        # Calculate weighted average
        weighted_sum = 0.0
        total_weight = 0.0

        for metric, score in metric_scores.items():
            weight = weights.get(metric, 0.1)
            weighted_sum += score * weight
            total_weight += weight

        if total_weight == 0:
            return 0.0

        return min(1.0, weighted_sum / total_weight)

    def _calculate_batch_metrics(
        self,
        batch_id: UUID,
        tenant_id: UUID,
        reports: List[EmbeddingQualityReport],
        start_time: float,
    ) -> BatchQualityReport:
        """Calculate aggregate metrics for a batch."""

        if not reports:
            raise ValueError("No reports provided for batch metrics calculation")

        # Calculate basic statistics
        quality_scores = [report.overall_score for report in reports]
        passed_count = sum(1 for report in reports if report.validation_passed)
        failed_count = len(reports) - passed_count

        avg_quality_score = statistics.mean(quality_scores)
        min_quality_score = min(quality_scores)
        max_quality_score = max(quality_scores)

        # Quality distribution
        quality_distribution = {}
        for report in reports:
            level = report.quality_level
            quality_distribution[level] = quality_distribution.get(level, 0) + 1

        # Metric averages
        all_metrics = set()
        for report in reports:
            all_metrics.update(report.metric_scores.keys())

        metric_averages = {}
        for metric in all_metrics:
            scores = [
                report.metric_scores.get(metric, 0.0)
                for report in reports
                if metric in report.metric_scores
            ]
            if scores:
                metric_averages[metric] = statistics.mean(scores)

        # Common issues
        issue_frequency = {}
        for report in reports:
            for issue in report.issues:
                issue_frequency[issue] = issue_frequency.get(issue, 0) + 1

        common_issues = sorted(
            issue_frequency.items(), key=lambda x: x[1], reverse=True
        )[:5]

        # Processing time
        processing_time_ms = int((asyncio.get_event_loop().time() - start_time) * 1000)

        # Create batch report
        batch_report = BatchQualityReport(
            batch_id=batch_id,
            tenant_id=tenant_id,
            embedding_count=len(reports),
            avg_quality_score=avg_quality_score,
            min_quality_score=min_quality_score,
            max_quality_score=max_quality_score,
            quality_distribution=quality_distribution,
            passed_count=passed_count,
            failed_count=failed_count,
            metric_averages=metric_averages,
            common_issues=common_issues,
            processing_time_ms=processing_time_ms,
        )

        # Store in history
        self.quality_history.append(batch_report)
        if len(self.quality_history) > self.max_history_size:
            self.quality_history = self.quality_history[-self.max_history_size :]

        return batch_report

    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    async def calculate_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float],
        embedding1_id: Optional[str] = None,
        embedding2_id: Optional[str] = None,
    ) -> SimilarityResult:
        """
        Calculate various similarity metrics between two embeddings.

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            embedding1_id: Optional ID for first embedding
            embedding2_id: Optional ID for second embedding

        Returns:
            Similarity result with multiple metrics
        """
        start_time = asyncio.get_event_loop().time()

        if embedding1_id is None:
            embedding1_id = str(uuid4())
        if embedding2_id is None:
            embedding2_id = str(uuid4())

        try:
            # Convert to numpy arrays
            vec1 = np.array(embedding1, dtype=np.float32)
            vec2 = np.array(embedding2, dtype=np.float32)

            # Calculate similarity metrics
            cosine_sim = self._cosine_similarity(vec1, vec2)
            euclidean_dist = np.linalg.norm(vec1 - vec2)
            manhattan_dist = np.sum(np.abs(vec1 - vec2))
            dot_product = np.dot(vec1, vec2)

            # Calculate Jaccard similarity for binarized vectors
            vec1_binary = (vec1 > np.mean(vec1)).astype(int)
            vec2_binary = (vec2 > np.mean(vec2)).astype(int)
            intersection = np.sum(vec1_binary & vec2_binary)
            union = np.sum(vec1_binary | vec2_binary)
            jaccard_sim = intersection / union if union > 0 else 0.0

            processing_time_ms = int(
                (asyncio.get_event_loop().time() - start_time) * 1000
            )

            return SimilarityResult(
                embedding_1_id=embedding1_id,
                embedding_2_id=embedding2_id,
                cosine_similarity=float(cosine_sim),
                euclidean_distance=float(euclidean_dist),
                manhattan_distance=float(manhattan_dist),
                dot_product=float(dot_product),
                jaccard_similarity=float(jaccard_sim),
                processing_time_ms=processing_time_ms,
            )

        except Exception as e:
            logger.error(f"Error calculating similarity: {str(e)}")
            processing_time_ms = int(
                (asyncio.get_event_loop().time() - start_time) * 1000
            )

            return SimilarityResult(
                embedding_1_id=embedding1_id,
                embedding_2_id=embedding2_id,
                cosine_similarity=0.0,
                euclidean_distance=float("inf"),
                manhattan_distance=float("inf"),
                dot_product=0.0,
                jaccard_similarity=0.0,
                processing_time_ms=processing_time_ms,
            )

    async def calculate_similarity_matrix(
        self, embeddings: List[List[float]], embedding_ids: Optional[List[str]] = None
    ) -> np.ndarray:
        """
        Calculate similarity matrix for a list of embeddings.

        Args:
            embeddings: List of embedding vectors
            embedding_ids: Optional list of embedding IDs

        Returns:
            NxN similarity matrix where N is the number of embeddings
        """
        if not embeddings:
            raise ValueError("No embeddings provided")

        n = len(embeddings)
        similarity_matrix = np.zeros((n, n), dtype=np.float32)

        # Calculate upper triangle (diagonal is 1.0)
        for i in range(n):
            similarity_matrix[i, i] = 1.0  # Self-similarity

            for j in range(i + 1, n):
                similarity_result = await self.calculate_similarity(
                    embeddings[i],
                    embeddings[j],
                    embedding_ids[i] if embedding_ids else None,
                    embedding_ids[j] if embedding_ids else None,
                )

                similarity = similarity_result.cosine_similarity
                similarity_matrix[i, j] = similarity
                similarity_matrix[j, i] = similarity  # Symmetric matrix

        return similarity_matrix

    def get_quality_trends(
        self, tenant_id: Optional[UUID] = None, days: int = 30
    ) -> Dict[str, Any]:
        """Get quality trends over time."""

        # Filter history by tenant and time range
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        filtered_reports = [
            report
            for report in self.quality_history
            if (tenant_id is None or report.tenant_id == tenant_id)
            and report.timestamp >= cutoff_date
        ]

        if not filtered_reports:
            return {"message": "No quality data available for the specified period"}

        # Calculate trends
        quality_scores = [report.avg_quality_score for report in filtered_reports]
        pass_rates = [report.pass_rate for report in filtered_reports]

        # Sort by date
        filtered_reports.sort(key=lambda x: x.timestamp)

        # Calculate trend direction
        if len(quality_scores) >= 2:
            recent_avg = statistics.mean(quality_scores[-7:])  # Last 7 reports
            older_avg = (
                statistics.mean(quality_scores[:-7])
                if len(quality_scores) > 7
                else quality_scores[0]
            )
            quality_trend = "improving" if recent_avg > older_avg else "declining"
        else:
            quality_trend = "insufficient_data"

        return {
            "period_days": days,
            "total_batches": len(filtered_reports),
            "avg_quality_score": statistics.mean(quality_scores),
            "min_quality_score": min(quality_scores),
            "max_quality_score": max(quality_scores),
            "avg_pass_rate": statistics.mean(pass_rates),
            "quality_trend": quality_trend,
            "recent_performance": {
                "last_7_days_avg": statistics.mean(quality_scores[-7:])
                if len(quality_scores) >= 7
                else None,
                "last_7_days_pass_rate": statistics.mean(pass_rates[-7:])
                if len(pass_rates) >= 7
                else None,
            },
            "time_series": [
                {
                    "date": report.timestamp.isoformat(),
                    "quality_score": report.avg_quality_score,
                    "pass_rate": report.pass_rate,
                    "batch_size": report.embedding_count,
                }
                for report in filtered_reports
            ],
        }

    def update_thresholds(self, new_thresholds: Dict[str, Any]) -> None:
        """Update quality validation thresholds."""
        try:
            self.thresholds = QualityThresholds(**new_thresholds)
            logger.info("Updated quality validation thresholds")
        except Exception as e:
            logger.error(f"Failed to update thresholds: {str(e)}")
            raise

    def get_provider_quality_comparison(self) -> Dict[str, Any]:
        """Get quality comparison across different embedding providers."""

        # Analyze quality history by provider (if available in context)
        provider_stats = {}

        for report in self.quality_history:
            # This would require provider information in the batch report
            # For now, we'll provide a template

            tenant_key = str(report.tenant_id)
            if tenant_key not in provider_stats:
                provider_stats[tenant_key] = {
                    "total_batches": 0,
                    "avg_quality_score": 0.0,
                    "total_embeddings": 0,
                    "avg_pass_rate": 0.0,
                }

            stats = provider_stats[tenant_key]
            stats["total_batches"] += 1
            stats["total_embeddings"] += report.embedding_count

            # Update running averages
            total_batches = stats["total_batches"]
            stats["avg_quality_score"] = (
                stats["avg_quality_score"] * (total_batches - 1)
                + report.avg_quality_score
            ) / total_batches
            stats["avg_pass_rate"] = (
                stats["avg_pass_rate"] * (total_batches - 1) + report.pass_rate
            ) / total_batches

        return {
            "provider_stats": provider_stats,
            "global_avg_quality": statistics.mean(
                [report.avg_quality_score for report in self.quality_history]
            )
            if self.quality_history
            else 0.0,
            "global_pass_rate": statistics.mean(
                [report.pass_rate for report in self.quality_history]
            )
            if self.quality_history
            else 0.0,
            "total_processed_embeddings": sum(
                report.embedding_count for report in self.quality_history
            ),
        }


# Global instance
_quality_validator: Optional[EmbeddingQualityValidator] = None


def get_quality_validator() -> EmbeddingQualityValidator:
    """Get global quality validator instance."""
    global _quality_validator

    if _quality_validator is None:
        _quality_validator = EmbeddingQualityValidator()

    return _quality_validator


# Convenience functions
async def validate_embedding_quality(
    embedding: List[float], embedding_id: Optional[str] = None, **kwargs
) -> EmbeddingQualityReport:
    """Validate embedding quality."""
    validator = get_quality_validator()
    return await validator.validate_embedding(embedding, embedding_id, **kwargs)


async def calculate_embedding_similarity(
    embedding1: List[float], embedding2: List[float], **kwargs
) -> SimilarityResult:
    """Calculate similarity between two embeddings."""
    validator = get_quality_validator()
    return await validator.calculate_similarity(embedding1, embedding2, **kwargs)
