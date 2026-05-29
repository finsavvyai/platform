"""
Quality validator for embedding systems.

This module provides comprehensive validation of embedding quality
with configurable thresholds and detailed reporting.
"""

import asyncio
import statistics
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from .quality_metrics import QualityMetrics


class ValidationLevel(str, Enum):
    """Validation level enumeration."""

    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class ValidationIssue:
    """Represents a validation issue."""

    def __init__(
        self,
        issue_type: str,
        severity: str,
        description: str,
        metric_value: float,
        threshold: float,
        recommendation: Optional[str] = None,
    ):
        """Initialize validation issue."""
        self.issue_type = issue_type
        self.severity = severity
        self.description = description
        self.metric_value = metric_value
        self.threshold = threshold
        self.recommendation = recommendation
        self.timestamp = datetime.utcnow()


class QualityValidator:
    """Comprehensive quality validator for embeddings."""

    def __init__(
        self,
        similarity_threshold: float = 0.8,
        consistency_threshold: float = 0.9,
        outlier_threshold: float = 2.0,
        variance_threshold: float = 0.01,
        clustering_threshold: float = 0.3,
        enable_outlier_detection: bool = True,
        enable_consistency_check: bool = True,
        enable_benchmarking: bool = True,
    ):
        """
        Initialize quality validator.

        Args:
            similarity_threshold: Minimum acceptable similarity score
            consistency_threshold: Minimum consistency across providers
            outlier_threshold: Threshold for outlier detection
            variance_threshold: Minimum variance requirement
            clustering_threshold: Minimum clustering coefficient
            enable_outlier_detection: Enable outlier detection
            enable_consistency_check: Enable consistency checking
            enable_benchmarking: Enable benchmarking against references
        """
        self.similarity_threshold = similarity_threshold
        self.consistency_threshold = consistency_threshold
        self.outlier_threshold = outlier_threshold
        self.variance_threshold = variance_threshold
        self.clustering_threshold = clustering_threshold
        self.enable_outlier_detection = enable_outlier_detection
        self.enable_consistency_check = enable_consistency_check
        self.enable_benchmarking = enable_benchmarking

        # Validation history
        self._validation_history: List[Dict[str, Any]] = []

    async def validate_embeddings(
        self,
        embeddings: List[List[float]],
        texts: Optional[List[str]] = None,
        provider: str = "unknown",
        model: str = "unknown",
        reference_embeddings: Optional[List[List[float]]] = None,
        validation_config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Validate embedding quality comprehensively.

        Args:
            embeddings: List of embedding vectors
            texts: Original texts (for semantic validation)
            provider: Provider name
            model: Model name
            reference_embeddings: Reference embeddings for comparison
            validation_config: Custom validation configuration

        Returns:
            Validation results
        """
        if not embeddings:
            return {
                "valid": False,
                "error": "No embeddings provided",
                "overall_score": 0.0,
                "validation_level": ValidationLevel.POOR.value,
            }

        # Apply custom configuration if provided
        config = validation_config or {}

        # Initialize validation results
        validation_result = {
            "provider": provider,
            "model": model,
            "embedding_count": len(embeddings),
            "embedding_dimensions": len(embeddings[0]) if embeddings else 0,
            "validation_timestamp": datetime.utcnow().isoformat(),
            "overall_score": 0.0,
            "validation_level": ValidationLevel.POOR.value,
            "valid": False,
            "issues": [],
            "metrics": {},
            "recommendations": [],
        }

        try:
            # Basic quality checks
            await self._validate_basic_properties(embeddings, validation_result)

            # Statistical quality checks
            await self._validate_statistical_properties(embeddings, validation_result)

            # Similarity and clustering validation
            await self._validate_similarity_and_clustering(
                embeddings, validation_result
            )

            # Outlier detection
            if self.enable_outlier_detection:
                await self._detect_outliers(embeddings, validation_result)

            # Consistency check (if reference provided)
            if reference_embeddings and self.enable_consistency_check:
                await self._validate_consistency(
                    embeddings, reference_embeddings, validation_result
                )

            # Benchmarking (if reference provided)
            if reference_embeddings and self.enable_benchmarking:
                await self._benchmark_embeddings(
                    embeddings, reference_embeddings, validation_result
                )

            # Calculate overall score and validation level
            await self._calculate_overall_score(validation_result)

            # Generate recommendations
            await self._generate_recommendations(validation_result)

            # Store validation history
            self._validation_history.append(validation_result.copy())

            return validation_result

        except Exception as e:
            validation_result["error"] = str(e)
            validation_result["valid"] = False
            validation_result["overall_score"] = 0.0
            validation_result["validation_level"] = ValidationLevel.POOR.value

            return validation_result

    async def _validate_basic_properties(
        self,
        embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Validate basic embedding properties."""
        issues = []
        metrics = {}

        # Check embedding dimensions consistency
        dimensions = [len(emb) for emb in embeddings]
        if len(set(dimensions)) > 1:
            issues.append(
                ValidationIssue(
                    issue_type="inconsistent_dimensions",
                    severity="critical",
                    description="Embeddings have inconsistent dimensions",
                    metric_value=len(set(dimensions)),
                    threshold=1,
                    recommendation="Ensure all embeddings have the same dimensions",
                )
            )

        # Check for empty or zero embeddings
        zero_count = sum(1 for emb in embeddings if all(abs(x) < 1e-6 for x in emb))
        if zero_count > 0:
            issues.append(
                ValidationIssue(
                    issue_type="zero_embeddings",
                    severity="high",
                    description=f"Found {zero_count} zero or near-zero embeddings",
                    metric_value=zero_count / len(embeddings),
                    threshold=0.0,
                    recommendation="Check input text and embedding generation process",
                )
            )

        # Check for NaN or infinite values
        invalid_count = 0
        for emb in embeddings:
            if any(not (float("-inf") < x < float("inf")) for x in emb):
                invalid_count += 1

        if invalid_count > 0:
            issues.append(
                ValidationIssue(
                    issue_type="invalid_values",
                    severity="critical",
                    description=f"Found {invalid_count} embeddings with NaN or infinite values",
                    metric_value=invalid_count / len(embeddings),
                    threshold=0.0,
                    recommendation="Check provider stability and input preprocessing",
                )
            )

        # Calculate basic metrics
        avg_norm = statistics.mean(
            [QualityMetrics.embedding_norm(emb) for emb in embeddings]
        )
        metrics["average_norm"] = avg_norm
        metrics["dimensions_consistent"] = len(set(dimensions)) == 1
        metrics["zero_embedding_rate"] = zero_count / len(embeddings)
        metrics["invalid_value_rate"] = invalid_count / len(embeddings)

        validation_result["issues"].extend([issue.__dict__ for issue in issues])
        validation_result["metrics"].update(metrics)

    async def _validate_statistical_properties(
        self,
        embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Validate statistical properties of embeddings."""
        issues = []
        metrics = {}

        # Calculate variance
        variance = QualityMetrics.embedding_variance(embeddings)
        metrics["variance"] = variance

        if variance < self.variance_threshold:
            issues.append(
                ValidationIssue(
                    issue_type="low_variance",
                    severity="medium",
                    description=f"Embedding variance ({variance:.6f}) is below threshold",
                    metric_value=variance,
                    threshold=self.variance_threshold,
                    recommendation="Check if embeddings are sufficiently diverse",
                )
            )

        # Calculate standard deviation
        std_dev = QualityMetrics.embedding_std_dev(embeddings)
        metrics["std_deviation"] = std_dev

        # Spectral analysis
        spectral_metrics = QualityMetrics.spectral_analysis(embeddings)
        metrics.update(spectral_metrics)

        # Check condition number
        condition_number = spectral_metrics.get("condition_number", 0)
        if condition_number > 1000:  # High condition number indicates poor conditioning
            issues.append(
                ValidationIssue(
                    issue_type="poor_conditioning",
                    severity="medium",
                    description=f"High condition number ({condition_number:.2f}) indicates poor numerical stability",
                    metric_value=condition_number,
                    threshold=1000,
                    recommendation="Consider dimensionality reduction or different embedding model",
                )
            )

        # Entropy analysis
        entropy_metrics = QualityMetrics.entropy_analysis(embeddings)
        metrics.update(entropy_metrics)

        validation_result["issues"].extend([issue.__dict__ for issue in issues])
        validation_result["metrics"].update(metrics)

    async def _validate_similarity_and_clustering(
        self,
        embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Validate similarity and clustering properties."""
        issues = []
        metrics = {}

        # Calculate average pairwise similarity
        avg_similarity = QualityMetrics.average_pairwise_similarity(embeddings)
        metrics["average_pairwise_similarity"] = avg_similarity

        if avg_similarity < self.similarity_threshold:
            issues.append(
                ValidationIssue(
                    issue_type="low_similarity",
                    severity="high",
                    description=f"Average pairwise similarity ({avg_similarity:.3f}) is below threshold",
                    metric_value=avg_similarity,
                    threshold=self.similarity_threshold,
                    recommendation="Check embedding quality and model suitability",
                )
            )

        # Calculate clustering coefficient
        clustering_coeff = QualityMetrics.clustering_coefficient(
            embeddings, threshold=0.7
        )
        metrics["clustering_coefficient"] = clustering_coeff

        if clustering_coeff < self.clustering_threshold:
            issues.append(
                ValidationIssue(
                    issue_type="poor_clustering",
                    severity="medium",
                    description=f"Clustering coefficient ({clustering_coeff:.3f}) is below threshold",
                    metric_value=clustering_coeff,
                    threshold=self.clustering_threshold,
                    recommendation="Check if similar texts are being grouped together",
                )
            )

        # Similarity distribution analysis
        similarity_matrix = QualityMetrics.pairwise_similarity_matrix(embeddings)
        similarities = []
        for i in range(len(embeddings)):
            for j in range(i + 1, len(embeddings)):
                similarities.append(similarity_matrix[i][j])

        if similarities:
            metrics["similarity_std"] = statistics.stdev(similarities)
            metrics["similarity_min"] = min(similarities)
            metrics["similarity_max"] = max(similarities)
            metrics["similarity_range"] = max(similarities) - min(similarities)

        validation_result["issues"].extend([issue.__dict__ for issue in issues])
        validation_result["metrics"].update(metrics)

    async def _detect_outliers(
        self,
        embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Detect outlier embeddings."""
        issues = []
        metrics = {}

        # Detect outliers using different methods
        outlier_methods = ["zscore", "iqr"]
        all_outliers = set()

        for method in outlier_methods:
            outlier_indices = QualityMetrics.detect_outliers(
                embeddings, method=method, threshold=self.outlier_threshold
            )
            all_outliers.update(outlier_indices)

            metrics[f"outliers_{method}"] = len(outlier_indices)
            metrics[f"outlier_rate_{method}"] = len(outlier_indices) / len(embeddings)

        # Consolidate outlier information
        total_outliers = len(all_outliers)
        metrics["total_outliers"] = total_outliers
        metrics["outlier_rate"] = total_outliers / len(embeddings)

        if total_outliers > 0:
            severity = "high" if total_outliers / len(embeddings) > 0.1 else "medium"

            issues.append(
                ValidationIssue(
                    issue_type="outliers_detected",
                    severity=severity,
                    description=f"Detected {total_outliers} outlier embeddings ({total_outliers / len(embeddings):.1%})",
                    metric_value=total_outliers / len(embeddings),
                    threshold=0.05,  # 5% outliers threshold
                    recommendation="Review outlier texts and consider data preprocessing",
                )
            )

        validation_result["issues"].extend([issue.__dict__ for issue in issues])
        validation_result["metrics"].update(metrics)

    async def _validate_consistency(
        self,
        embeddings: List[List[float]],
        reference_embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Validate consistency with reference embeddings."""
        issues = []
        metrics = {}

        # Calculate average similarity to reference
        ref_similarities = []
        for emb in embeddings:
            max_ref_similarity = max(
                QualityMetrics.cosine_similarity(emb, ref_emb)
                for ref_emb in reference_embeddings
            )
            ref_similarities.append(max_ref_similarity)

        avg_ref_similarity = statistics.mean(ref_similarities)
        metrics["reference_similarity"] = avg_ref_similarity

        if avg_ref_similarity < self.consistency_threshold:
            issues.append(
                ValidationIssue(
                    issue_type="low_consistency",
                    severity="high",
                    description=f"Low consistency with reference ({avg_ref_similarity:.3f})",
                    metric_value=avg_ref_similarity,
                    threshold=self.consistency_threshold,
                    recommendation="Check model parameters and training data consistency",
                )
            )

        # Consistency distribution
        metrics["reference_similarity_std"] = statistics.stdev(ref_similarities)
        metrics["reference_similarity_min"] = min(ref_similarities)
        metrics["reference_similarity_max"] = max(ref_similarities)

        validation_result["issues"].extend([issue.__dict__ for issue in issues])
        validation_result["metrics"].update(metrics)

    async def _benchmark_embeddings(
        self,
        embeddings: List[List[float]],
        reference_embeddings: List[List[float]],
        validation_result: Dict[str, Any],
    ) -> None:
        """Benchmark embeddings against reference."""
        metrics = {}

        # Perform benchmarking
        benchmark_metrics = QualityMetrics.benchmark_quality(
            embeddings, reference_embeddings
        )
        metrics.update(benchmark_metrics)

        validation_result["metrics"].update(metrics)

    async def _calculate_overall_score(self, validation_result: Dict[str, Any]) -> None:
        """Calculate overall quality score and validation level."""
        issues = validation_result["issues"]
        metrics = validation_result["metrics"]

        # Base score starts at 1.0
        score = 1.0

        # Deduct points for issues based on severity
        severity_penalties = {"critical": 0.3, "high": 0.2, "medium": 0.1, "low": 0.05}

        for issue in issues:
            penalty = severity_penalties.get(issue["severity"], 0.1)
            score -= penalty

        # Bonus points for good metrics
        if metrics.get("average_pairwise_similarity", 0) > 0.8:
            score += 0.1

        if metrics.get("clustering_coefficient", 0) > 0.5:
            score += 0.1

        if metrics.get("reference_similarity", 0) > 0.9:
            score += 0.1

        # Clamp score between 0 and 1
        overall_score = max(0.0, min(1.0, score))

        validation_result["overall_score"] = overall_score

        # Determine validation level
        if overall_score >= 0.9:
            validation_result["validation_level"] = ValidationLevel.EXCELLENT.value
            validation_result["valid"] = True
        elif overall_score >= 0.7:
            validation_result["validation_level"] = ValidationLevel.GOOD.value
            validation_result["valid"] = True
        elif overall_score >= 0.5:
            validation_result["validation_level"] = ValidationLevel.FAIR.value
            validation_result["valid"] = True
        else:
            validation_result["validation_level"] = ValidationLevel.POOR.value
            validation_result["valid"] = False

    async def _generate_recommendations(
        self, validation_result: Dict[str, Any]
    ) -> None:
        """Generate recommendations based on validation results."""
        recommendations = []
        issues = validation_result["issues"]
        metrics = validation_result["metrics"]

        # Generate recommendations based on issues
        issue_types = set(issue["issue_type"] for issue in issues)

        if "low_variance" in issue_types:
            recommendations.append(
                "Consider using a more diverse dataset or different embedding model"
            )

        if "low_similarity" in issue_types:
            recommendations.append(
                "Review embedding generation process and model parameters"
            )

        if "outliers_detected" in issue_types:
            recommendations.append("Implement data preprocessing to handle outliers")

        if "low_consistency" in issue_types:
            recommendations.append(
                "Ensure consistent preprocessing and model configuration"
            )

        if "poor_conditioning" in issue_types:
            recommendations.append(
                "Consider dimensionality reduction techniques like PCA"
            )

        # Generate performance recommendations
        avg_similarity = metrics.get("average_pairwise_similarity", 0)
        if avg_similarity > 0.95:
            recommendations.append(
                "Very high similarity detected - check for duplicate or very similar texts"
            )

        clustering_coeff = metrics.get("clustering_coefficient", 0)
        if clustering_coeff < 0.1:
            recommendations.append(
                "Low clustering suggests poor semantic grouping - review text preprocessing"
            )

        # Remove duplicates
        recommendations = list(set(recommendations))

        validation_result["recommendations"] = recommendations

    def get_validation_summary(self, hours: int = 24) -> Dict[str, Any]:
        """
        Get summary of recent validations.

        Args:
            hours: Number of hours to look back

        Returns:
            Validation summary
        """
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)

        recent_validations = [
            validation
            for validation in self._validation_history
            if datetime.fromisoformat(validation["validation_timestamp"]) >= cutoff_time
        ]

        if not recent_validations:
            return {
                "total_validations": 0,
                "average_score": 0.0,
                "validation_levels": {},
                "common_issues": [],
                "provider_performance": {},
            }

        # Calculate summary statistics
        total_validations = len(recent_validations)
        average_score = statistics.mean(
            [v["overall_score"] for v in recent_validations]
        )

        # Count validation levels
        level_counts = {}
        for validation in recent_validations:
            level = validation["validation_level"]
            level_counts[level] = level_counts.get(level, 0) + 1

        # Count common issues
        issue_counts = {}
        for validation in recent_validations:
            for issue in validation["issues"]:
                issue_type = issue["issue_type"]
                issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1

        # Provider performance
        provider_performance = {}
        for validation in recent_validations:
            provider = validation["provider"]
            model = validation["model"]
            key = f"{provider}:{model}"

            if key not in provider_performance:
                provider_performance[key] = {
                    "scores": [],
                    "validations": 0,
                    "success_rate": 0.0,
                }

            provider_performance[key]["scores"].append(validation["overall_score"])
            provider_performance[key]["validations"] += 1

        # Calculate provider statistics
        for key, data in provider_performance.items():
            scores = data["scores"]
            data["average_score"] = statistics.mean(scores)
            data["success_rate"] = sum(1 for score in scores if score >= 0.5) / len(
                scores
            )
            del data["scores"]  # Remove raw scores

        return {
            "total_validations": total_validations,
            "average_score": average_score,
            "validation_levels": level_counts,
            "common_issues": sorted(
                issue_counts.items(), key=lambda x: x[1], reverse=True
            )[:10],
            "provider_performance": provider_performance,
            "period_hours": hours,
        }

    def export_validation_data(
        self,
        format: str = "json",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> str:
        """
        Export validation data for analysis.

        Args:
            format: Export format (json, csv)
            start_date: Start date filter
            end_date: End date filter

        Returns:
            Exported data as string
        """
        # Filter validation history
        filtered_validations = self._validation_history

        if start_date:
            filtered_validations = [
                v
                for v in filtered_validations
                if datetime.fromisoformat(v["validation_timestamp"]) >= start_date
            ]

        if end_date:
            filtered_validations = [
                v
                for v in filtered_validations
                if datetime.fromisoformat(v["validation_timestamp"]) <= end_date
            ]

        if format.lower() == "json":
            import json

            return json.dumps(filtered_validations, indent=2, default=str)

        elif format.lower() == "csv":
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow(
                [
                    "timestamp",
                    "provider",
                    "model",
                    "embedding_count",
                    "overall_score",
                    "validation_level",
                    "valid",
                    "issue_count",
                ]
            )

            # Data
            for validation in filtered_validations:
                writer.writerow(
                    [
                        validation["validation_timestamp"],
                        validation["provider"],
                        validation["model"],
                        validation["embedding_count"],
                        validation["overall_score"],
                        validation["validation_level"],
                        validation["valid"],
                        len(validation["issues"]),
                    ]
                )

            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format: {format}")
