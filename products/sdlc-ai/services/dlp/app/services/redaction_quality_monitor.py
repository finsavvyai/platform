"""
Redaction Quality Monitoring Service

Advanced quality monitoring and validation system for content redaction.
Provides comprehensive metrics, validation, and continuous improvement
for redaction processes.

Key Features:
- Real-time quality scoring and validation
- False positive/negative rate tracking
- Format preservation assessment
- Manual review workflow
- Performance analytics
- Continuous improvement recommendations
"""

import asyncio
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import statistics
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc
import asyncpg

from app.models.database import RedactionLog, RedactionQualityMetrics, RedactionToken
from app.core.config import get_settings
from app.utils.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class QualityIssueType(str, Enum):
    """Types of quality issues in redaction."""

    MISSED_ENTITY = "missed_entity"  # Entity not detected/redacted
    FALSE_POSITIVE = "false_positive"  # Non-PII incorrectly redacted
    OVER_REDACTION = "over_redaction"  # Too much content redacted
    UNDER_REDACTION = "under_redaction"  # Insufficient redaction
    FORMAT_LOSS = "format_loss"  # Original format not preserved
    CONTEXT_LOSS = "context_loss"  # Too much context removed
    TOKEN_ERROR = "token_error"  # Tokenization/reversal error


class ReviewStatus(str, Enum):
    """Review status for quality checks."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


@dataclass
class QualityMetrics:
    """Comprehensive quality metrics for redaction."""

    overall_score: float  # 0.0 - 1.0
    entity_coverage_rate: float  # Percentage of entities properly redacted
    false_positive_rate: float  # Percentage of incorrect redactions
    false_negative_rate: float  # Percentage of missed entities
    format_preservation_score: float  # How well original format is preserved
    context_preservation_score: float  # How well context is maintained
    processing_efficiency: float  # Processing time relative to content size

    # Detailed metrics
    entity_type_metrics: Dict[str, Dict[str, float]]
    quality_issues: List[Dict[str, Any]]
    recommendations: List[str]

    # Performance metrics
    processing_time_ms: int
    entities_per_second: float
    throughput_mb_per_sec: float


@dataclass
class QualityValidationResult:
    """Result of quality validation."""

    passed: bool
    score: float
    issues: List[Dict[str, Any]]
    recommendations: List[str]
    requires_manual_review: bool
    review_priority: str  # LOW, MEDIUM, HIGH, CRITICAL


class RedactionQualityMonitor:
    """Advanced quality monitoring service for content redaction."""

    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self._quality_thresholds = {
            "min_overall_score": 0.85,
            "max_false_positive_rate": 0.05,
            "max_false_negative_rate": 0.02,
            "min_format_preservation": 0.90,
            "min_context_preservation": 0.80,
        }
        self._quality_patterns = self._initialize_quality_patterns()
        self._initialize_database()

    def _initialize_quality_patterns(self) -> Dict[str, Any]:
        """Initialize patterns for quality assessment."""

        return {
            # Patterns that might indicate missed entities
            "missed_entity_patterns": [
                r"\b\d{3}-\d{2}-\d{4}\b",  # SSN pattern
                r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b",  # Credit card
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Email
                r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone
            ],
            # Patterns for format preservation
            "format_patterns": {
                "email": r"^[^@]+@[^@]+\.[^@]+$",
                "phone": r"^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$",
                "ssn": r"^\d{3}-\d{2}-\d{4}$",
            },
            # Context preservation keywords
            "context_keywords": [
                "said",
                "stated",
                "according",
                "reported",
                "mentioned",
                "told",
                "announced",
                "declared",
                "confirmed",
                "denied",
            ],
        }

    async def _initialize_database(self):
        """Initialize database connection."""

        try:
            self.db_pool = await asyncpg.create_pool(
                settings.database_url, min_size=5, max_size=20, command_timeout=60
            )
            logger.info("Quality monitor database initialized")
        except Exception as e:
            logger.error(f"Failed to initialize quality monitor database: {e}")
            raise

    async def assess_redaction_quality(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
        processing_time_ms: int,
        policy_config: Dict[str, Any],
        audit_log_id: str,
        tenant_id: str,
    ) -> QualityMetrics:
        """
        Comprehensive quality assessment of redaction results.

        Args:
            original_content: Original unredacted content
            redacted_content: Redacted content
            entities_found: List of entities that were detected/redacted
            processing_time_ms: Time taken for redaction
            policy_config: Redaction policy configuration
            audit_log_id: Unique audit identifier
            tenant_id: Tenant identifier

        Returns:
            QualityMetrics with comprehensive assessment
        """

        try:
            # Calculate individual quality metrics
            entity_coverage = await self._calculate_entity_coverage(
                original_content, redacted_content, entities_found
            )

            false_positive_rate = await self._detect_false_positives(
                original_content, redacted_content, entities_found
            )

            false_negative_rate = await self._detect_false_negatives(
                original_content, redacted_content, entities_found
            )

            format_preservation = await self._assess_format_preservation(
                original_content, redacted_content, entities_found
            )

            context_preservation = await self._assess_context_preservation(
                original_content, redacted_content
            )

            # Calculate performance metrics
            content_size = len(original_content.encode("utf-8"))
            entities_per_second = (
                len(entities_found) / max(processing_time_ms, 1)
            ) * 1000
            throughput_mb_per_sec = (content_size / (1024 * 1024)) / (
                processing_time_ms / 1000
            )

            # Calculate overall score
            overall_score = self._calculate_overall_score(
                {
                    "entity_coverage": entity_coverage,
                    "false_positive_rate": false_positive_rate,
                    "false_negative_rate": false_negative_rate,
                    "format_preservation": format_preservation,
                    "context_preservation": context_preservation,
                }
            )

            # Generate entity type specific metrics
            entity_type_metrics = await self._calculate_entity_type_metrics(
                original_content, redacted_content, entities_found
            )

            # Identify quality issues
            quality_issues = await self._identify_quality_issues(
                original_content, redacted_content, entities_found
            )

            # Generate recommendations
            recommendations = await self._generate_recommendations(
                quality_issues, entity_type_metrics
            )

            metrics = QualityMetrics(
                overall_score=overall_score,
                entity_coverage_rate=entity_coverage,
                false_positive_rate=false_positive_rate,
                false_negative_rate=false_negative_rate,
                format_preservation_score=format_preservation,
                context_preservation_score=context_preservation,
                processing_efficiency=min(1.0, 1000 / processing_time_ms),
                entity_type_metrics=entity_type_metrics,
                quality_issues=quality_issues,
                recommendations=recommendations,
                processing_time_ms=processing_time_ms,
                entities_per_second=entities_per_second,
                throughput_mb_per_sec=throughput_mb_per_sec,
            )

            # Store quality metrics
            await self._store_quality_metrics(
                audit_log_id, tenant_id, metrics, policy_config
            )

            return metrics

        except Exception as e:
            logger.error(f"Quality assessment failed: {e}")
            # Return default metrics
            return QualityMetrics(
                overall_score=0.5,
                entity_coverage_rate=0.5,
                false_positive_rate=0.0,
                false_negative_rate=0.0,
                format_preservation_score=0.5,
                context_preservation_score=0.5,
                processing_efficiency=0.5,
                entity_type_metrics={},
                quality_issues=[{"type": "assessment_error", "message": str(e)}],
                recommendations=["Review redaction process"],
                processing_time_ms=processing_time_ms,
                entities_per_second=0.0,
                throughput_mb_per_sec=0.0,
            )

    async def _calculate_entity_coverage(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> float:
        """Calculate how many entities were properly redacted."""

        if not entities_found:
            return 1.0

        properly_redacted = 0

        for entity in entities_found:
            original_text = entity.get("text", "")
            start = entity.get("start", 0)
            end = entity.get("end", len(original_text))

            # Check if entity was redacted in content
            if start < len(redacted_content):
                redacted_segment = redacted_content[start:end]

                # Consider it redacted if it's different from original
                if redacted_segment != original_text:
                    # Check if it follows redaction patterns
                    if any(
                        [
                            "[REDACTED]" in redacted_segment,
                            "[TOKEN:" in redacted_segment,
                            "[HASH:" in redacted_segment,
                            "***" in redacted_segment,
                            redacted_segment != original_text,  # Any change counts
                        ]
                    ):
                        properly_redacted += 1

        return properly_redacted / len(entities_found)

    async def _detect_false_positives(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> float:
        """Detect false positives in redaction."""

        # This is a simplified implementation
        # In practice, this would use more sophisticated NLP techniques

        false_positives = 0

        for entity in entities_found:
            entity_text = entity.get("text", "")
            entity_type = entity.get("entity_type", "")
            confidence = entity.get("confidence_score", 0.0)

            # Low confidence entities might be false positives
            if confidence < 0.5:
                # Additional checks based on entity type
                if entity_type == "PERSON":
                    # Check if it's a common word that's not a name
                    common_words = ["said", "the", "and", "but", "for", "with"]
                    if entity_text.lower() in common_words:
                        false_positives += 1

                elif entity_type == "EMAIL_ADDRESS":
                    # Validate email format
                    if "@" not in entity_text or "." not in entity_text.split("@")[-1]:
                        false_positives += 1

        return false_positives / max(len(entities_found), 1)

    async def _detect_false_negatives(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> float:
        """Detect entities that were missed (false negatives)."""

        missed_entities = 0

        # Check for patterns that should have been redacted
        for pattern in self._quality_patterns["missed_entity_patterns"]:
            matches = re.finditer(pattern, original_content)

            for match in matches:
                # Check if this match was already found
                already_found = False
                for entity in entities_found:
                    entity_start = entity.get("start", 0)
                    entity_end = entity.get("end", 0)

                    if entity_start <= match.start() <= entity_end:
                        already_found = True
                        break

                if not already_found:
                    # Check if it's still visible in redacted content
                    if match.start() < len(redacted_content):
                        redacted_match = redacted_content[match.start() : match.end()]
                        if redacted_match == match.group():
                            missed_entities += 1

        # Estimate total potential entities
        content_words = original_content.split()
        estimated_entities = max(len(content_words) * 0.1, 1)  # Rough estimate

        return min(missed_entities / estimated_entities, 1.0)

    async def _assess_format_preservation(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> float:
        """Assess how well the original format was preserved."""

        format_score = 1.0

        # Check sentence structure preservation
        original_sentences = original_content.split(".")
        redacted_sentences = redacted_content.split(".")

        if len(original_sentences) > 0:
            sentence_preservation = min(
                len(redacted_sentences) / len(original_sentences), 1.0
            )
            format_score = (format_score + sentence_preservation) / 2

        # Check paragraph structure
        original_paragraphs = original_content.split("\n\n")
        redacted_paragraphs = redacted_content.split("\n\n")

        if len(original_paragraphs) > 0:
            paragraph_preservation = min(
                len(redacted_paragraphs) / len(original_paragraphs), 1.0
            )
            format_score = (format_score + paragraph_preservation) / 2

        # Check specific entity format preservation
        for entity in entities_found:
            entity_type = entity.get("entity_type", "")
            original_text = entity.get("text", "")

            if entity_type in self._quality_patterns["format_patterns"]:
                pattern = self._quality_patterns["format_patterns"][entity_type]

                # Find corresponding redacted text
                # This is simplified - in practice, we'd track positions
                if re.match(pattern, original_text):
                    # Deduct points if format was not preserved
                    format_score *= 0.95

        return format_score

    async def _assess_context_preservation(
        self, original_content: str, redacted_content: str
    ) -> float:
        """Assess how well context was preserved around redactions."""

        context_score = 1.0

        # Check if context keywords are preserved
        for keyword in self._quality_patterns["context_keywords"]:
            original_count = original_content.lower().count(keyword)
            redacted_count = redacted_content.lower().count(keyword)

            if original_count > 0:
                preservation_rate = min(redacted_count / original_count, 1.0)
                context_score = (context_score + preservation_rate) / 2

        # Check word count ratio
        original_words = len(original_content.split())
        redacted_words = len(redacted_content.split())

        if original_words > 0:
            word_ratio = min(redacted_words / original_words, 1.0)

            # Penalize excessive word loss
            if word_ratio < 0.5:
                word_ratio = 0.5
            elif word_ratio > 0.8:
                word_ratio = 1.0

            context_score = (context_score + word_ratio) / 2

        return context_score

    def _calculate_overall_score(self, metrics: Dict[str, float]) -> float:
        """Calculate overall quality score from individual metrics."""

        weights = {
            "entity_coverage": 0.3,
            "false_positive_rate": 0.2,
            "false_negative_rate": 0.2,
            "format_preservation": 0.15,
            "context_preservation": 0.15,
        }

        score = 0.0

        # Entity coverage (higher is better)
        score += metrics["entity_coverage"] * weights["entity_coverage"]

        # False positive rate (lower is better)
        score += (1.0 - metrics["false_positive_rate"]) * weights["false_positive_rate"]

        # False negative rate (lower is better)
        score += (1.0 - metrics["false_negative_rate"]) * weights["false_negative_rate"]

        # Format preservation (higher is better)
        score += metrics["format_preservation"] * weights["format_preservation"]

        # Context preservation (higher is better)
        score += metrics["context_preservation"] * weights["context_preservation"]

        return min(1.0, max(0.0, score))

    async def _calculate_entity_type_metrics(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> Dict[str, Dict[str, float]]:
        """Calculate quality metrics per entity type."""

        entity_type_metrics = {}

        # Group entities by type
        entities_by_type = {}
        for entity in entities_found:
            entity_type = entity.get("entity_type", "UNKNOWN")
            if entity_type not in entities_by_type:
                entities_by_type[entity_type] = []
            entities_by_type[entity_type].append(entity)

        # Calculate metrics for each type
        for entity_type, entities in entities_by_type.items():
            coverage_rate = await self._calculate_entity_coverage(
                original_content, redacted_content, entities
            )

            avg_confidence = (
                statistics.mean([e.get("confidence_score", 0.0) for e in entities])
                if entities
                else 0.0
            )

            entity_type_metrics[entity_type] = {
                "coverage_rate": coverage_rate,
                "avg_confidence": avg_confidence,
                "count": len(entities),
                "detection_accuracy": min(coverage_rate * avg_confidence, 1.0),
            }

        return entity_type_metrics

    async def _identify_quality_issues(
        self,
        original_content: str,
        redacted_content: str,
        entities_found: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Identify specific quality issues in redaction."""

        issues = []

        # Check for missed entities
        missed_count = await self._detect_false_negatives(
            original_content, redacted_content, entities_found
        )
        if missed_count > 0.1:
            issues.append(
                {
                    "type": QualityIssueType.MISSED_ENTITY,
                    "severity": "HIGH",
                    "description": f"High rate of missed entities detected",
                    "affected_area": "entire_document",
                }
            )

        # Check for false positives
        fp_rate = await self._detect_false_positives(
            original_content, redacted_content, entities_found
        )
        if fp_rate > 0.05:
            issues.append(
                {
                    "type": QualityIssueType.FALSE_POSITIVE,
                    "severity": "MEDIUM",
                    "description": f"High false positive rate: {fp_rate:.1%}",
                    "affected_area": "entity_detection",
                }
            )

        # Check format preservation
        original_lines = original_content.split("\n")
        redacted_lines = redacted_content.split("\n")

        if len(redacted_lines) < len(original_lines) * 0.8:
            issues.append(
                {
                    "type": QualityIssueType.FORMAT_LOSS,
                    "severity": "MEDIUM",
                    "description": "Significant line structure loss detected",
                    "affected_area": "document_structure",
                }
            )

        # Check for over-redaction
        redaction_ratio = len(redacted_content) / max(len(original_content), 1)
        if redaction_ratio < 0.3:
            issues.append(
                {
                    "type": QualityIssueType.OVER_REDACTION,
                    "severity": "HIGH",
                    "description": f"Excessive redaction: only {redaction_ratio:.1%} of content remains",
                    "affected_area": "overall_content",
                }
            )

        return issues

    async def _generate_recommendations(
        self,
        quality_issues: List[Dict[str, Any]],
        entity_type_metrics: Dict[str, Dict[str, float]],
    ) -> List[str]:
        """Generate recommendations for improving redaction quality."""

        recommendations = []

        # Analyze issues and generate recommendations
        issue_types = [issue["type"] for issue in quality_issues]

        if QualityIssueType.MISSED_ENTITY in issue_types:
            recommendations.append(
                "Consider lowering confidence thresholds for entity detection"
            )
            recommendations.append("Add custom patterns for domain-specific entities")

        if QualityIssueType.FALSE_POSITIVE in issue_types:
            recommendations.append("Review and fine-tune entity recognition patterns")
            recommendations.append("Add whitelist for common false positives")

        if QualityIssueType.FORMAT_LOSS in issue_types:
            recommendations.append("Enable format preservation in redaction policy")
            recommendations.append("Use context-aware redaction strategies")

        # Analyze entity type performance
        for entity_type, metrics in entity_type_metrics.items():
            if metrics["coverage_rate"] < 0.8:
                recommendations.append(
                    f"Improve detection patterns for {entity_type} entities"
                )

            if metrics["avg_confidence"] < 0.7:
                recommendations.append(
                    f"Review confidence scoring for {entity_type} entities"
                )

        # Remove duplicates
        recommendations = list(set(recommendations))

        return recommendations

    async def _store_quality_metrics(
        self,
        audit_log_id: str,
        tenant_id: str,
        metrics: QualityMetrics,
        policy_config: Dict[str, Any],
    ) -> None:
        """Store quality metrics in database."""

        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO redaction_quality_metrics (
                        tenant_id, audit_log_id, quality_score, entity_coverage_rate,
                        false_positive_rate, false_negative_rate, format_preservation_score,
                        validation_passed, validation_errors, manual_review_required,
                        processing_time_ms, throughput_entities_per_sec,
                        created_at, metrics_version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
                """,
                    tenant_id,
                    audit_log_id,
                    metrics.overall_score,
                    metrics.entity_coverage_rate,
                    metrics.false_positive_rate,
                    metrics.false_negative_rate,
                    metrics.format_preservation_score,
                    metrics.overall_score
                    >= self._quality_thresholds["min_overall_score"],
                    json.dumps(metrics.quality_issues),
                    metrics.overall_score
                    < self._quality_thresholds["min_overall_score"],
                    metrics.processing_time_ms,
                    metrics.entities_per_second,
                    "1.0",
                )
        except Exception as e:
            logger.error(f"Failed to store quality metrics: {e}")

    async def validate_redaction_quality(
        self, audit_log_id: str, tenant_id: str
    ) -> QualityValidationResult:
        """
        Validate redaction quality against thresholds.

        Returns validation result with recommendations.
        """

        try:
            async with self.db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT * FROM redaction_quality_metrics
                    WHERE audit_log_id = $1 AND tenant_id = $2
                """,
                    audit_log_id,
                    tenant_id,
                )

            if not row:
                return QualityValidationResult(
                    passed=False,
                    score=0.0,
                    issues=[
                        {"type": "no_metrics", "message": "No quality metrics found"}
                    ],
                    recommendations=["Run quality assessment first"],
                    requires_manual_review=True,
                    review_priority="HIGH",
                )

            # Check against thresholds
            issues = []

            if row["quality_score"] < self._quality_thresholds["min_overall_score"]:
                issues.append(
                    {
                        "type": "low_score",
                        "message": f"Quality score {row['quality_score']:.2f} below threshold",
                    }
                )

            if (
                row["false_positive_rate"]
                > self._quality_thresholds["max_false_positive_rate"]
            ):
                issues.append(
                    {
                        "type": "high_fp_rate",
                        "message": f"False positive rate {row['false_positive_rate']:.2%} above threshold",
                    }
                )

            if (
                row["false_negative_rate"]
                > self._quality_thresholds["max_false_negative_rate"]
            ):
                issues.append(
                    {
                        "type": "high_fn_rate",
                        "message": f"False negative rate {row['false_negative_rate']:.2%} above threshold",
                    }
                )

            # Determine if manual review is needed
            requires_review = (
                row["quality_score"] < 0.9
                or len(issues) > 0
                or row["false_positive_rate"] > 0.02
                or row["false_negative_rate"] > 0.01
            )

            # Determine review priority
            if row["quality_score"] < 0.7:
                priority = "CRITICAL"
            elif row["quality_score"] < 0.85:
                priority = "HIGH"
            elif requires_review:
                priority = "MEDIUM"
            else:
                priority = "LOW"

            # Generate recommendations
            recommendations = await self._generate_validation_recommendations(
                row, issues
            )

            return QualityValidationResult(
                passed=len(issues) == 0,
                score=float(row["quality_score"]),
                issues=issues,
                recommendations=recommendations,
                requires_manual_review=requires_review,
                review_priority=priority,
            )

        except Exception as e:
            logger.error(f"Quality validation failed: {e}")
            return QualityValidationResult(
                passed=False,
                score=0.0,
                issues=[{"type": "validation_error", "message": str(e)}],
                recommendations=["Review validation process"],
                requires_manual_review=True,
                review_priority="HIGH",
            )

    async def _generate_validation_recommendations(
        self, metrics_row: Any, issues: List[Dict[str, Any]]
    ) -> List[str]:
        """Generate recommendations based on validation results."""

        recommendations = []

        for issue in issues:
            if issue["type"] == "low_score":
                recommendations.append("Review entire redaction process")
                recommendations.append("Consider adjusting policy settings")

            elif issue["type"] == "high_fp_rate":
                recommendations.append("Fine-tune entity detection patterns")
                recommendations.append("Add domain-specific exceptions")

            elif issue["type"] == "high_fn_rate":
                recommendations.append("Lower confidence thresholds")
                recommendations.append("Add custom entity patterns")

        return recommendations

    async def get_quality_analytics(
        self, tenant_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive quality analytics for tenant."""

        try:
            async with self.db_pool.acquire() as conn:
                # Overall statistics
                stats = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_redactions,
                        AVG(quality_score) as avg_quality,
                        AVG(entity_coverage_rate) as avg_coverage,
                        AVG(false_positive_rate) as avg_fp_rate,
                        AVG(false_negative_rate) as avg_fn_rate,
                        AVG(format_preservation_score) as avg_format_score,
                        COUNT(CASE WHEN manual_review_required THEN 1 END) as review_required_count,
                        AVG(processing_time_ms) as avg_processing_time
                    FROM redaction_quality_metrics
                    WHERE tenant_id = $1
                        AND created_at > NOW() - INTERVAL $2 DAY
                """,
                    tenant_id,
                    days,
                )

                # Quality trends over time
                quality_trends = await conn.fetch(
                    """
                    SELECT
                        DATE_TRUNC('day', created_at) as date,
                        AVG(quality_score) as avg_score,
                        COUNT(*) as redaction_count
                    FROM redaction_quality_metrics
                    WHERE tenant_id = $1
                        AND created_at > NOW() - INTERVAL $2 DAY
                    GROUP BY DATE_TRUNC('day', created_at)
                    ORDER BY date DESC
                """,
                    tenant_id,
                    days,
                )

                # Entity type performance
                entity_performance = await conn.fetch(
                    """
                    SELECT
                        json_extract_path_text(metadata, 'entity_type') as entity_type,
                        AVG(quality_score) as avg_score,
                        COUNT(*) as count
                    FROM redaction_quality_metrics
                    WHERE tenant_id = $1
                        AND created_at > NOW() - INTERVAL $2 DAY
                        AND metadata IS NOT NULL
                    GROUP BY json_extract_path_text(metadata, 'entity_type')
                    ORDER BY count DESC
                """,
                    tenant_id,
                    days,
                )

                # Common quality issues
                common_issues = await conn.fetch(
                    """
                    SELECT
                        validation_errors,
                        COUNT(*) as frequency
                    FROM redaction_quality_metrics
                    WHERE tenant_id = $1
                        AND created_at > NOW() - INTERVAL $2 DAY
                        AND validation_errors IS NOT NULL
                    GROUP BY validation_errors
                    ORDER BY frequency DESC
                    LIMIT 10
                """,
                    tenant_id,
                    days,
                )

                return {
                    "summary": {
                        "total_redactions": stats["total_redactions"],
                        "avg_quality_score": float(stats["avg_quality"] or 0),
                        "avg_coverage_rate": float(stats["avg_coverage"] or 0),
                        "avg_false_positive_rate": float(stats["avg_fp_rate"] or 0),
                        "avg_false_negative_rate": float(stats["avg_fn_rate"] or 0),
                        "avg_format_score": float(stats["avg_format_score"] or 0),
                        "review_required_rate": (
                            float(stats["review_required_count"] or 0)
                            / max(stats["total_redactions"], 1)
                        ),
                        "avg_processing_time_ms": float(
                            stats["avg_processing_time"] or 0
                        ),
                    },
                    "trends": [
                        {
                            "date": row["date"].isoformat(),
                            "avg_score": float(row["avg_score"] or 0),
                            "redaction_count": row["redaction_count"],
                        }
                        for row in quality_trends
                    ],
                    "entity_performance": [
                        {
                            "entity_type": row["entity_type"] or "unknown",
                            "avg_score": float(row["avg_score"] or 0),
                            "count": row["count"],
                        }
                        for row in entity_performance
                    ],
                    "common_issues": [
                        {
                            "issue": json.loads(row["validation_errors"] or "[]"),
                            "frequency": row["frequency"],
                        }
                        for row in common_issues
                    ],
                }

        except Exception as e:
            logger.error(f"Failed to retrieve quality analytics: {e}")
            return {}

    async def update_quality_thresholds(self, thresholds: Dict[str, float]) -> None:
        """Update quality thresholds for validation."""

        self._quality_thresholds.update(thresholds)
        logger.info(f"Updated quality thresholds: {thresholds}")

    async def close(self):
        """Close database connections."""

        if self.db_pool:
            await self.db_pool.close()
            logger.info("Quality monitor database connections closed")
