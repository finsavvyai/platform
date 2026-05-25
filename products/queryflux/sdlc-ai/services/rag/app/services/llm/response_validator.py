"""
LLM Response Validator.

This module provides comprehensive validation for LLM responses including
content safety, PII detection, quality assessment, and format validation.
"""

import asyncio
import logging
import re
import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass

from pydantic import BaseModel

from .base_provider import LLMRequest, LLMResponse

logger = logging.getLogger(__name__)


class ValidationSeverity(Enum):
    """Validation severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ValidationType(Enum):
    """Types of validations."""

    CONTENT_SAFETY = "content_safety"
    PII_DETECTION = "pii_detection"
    FORMAT_VALIDATION = "format_validation"
    QUALITY_ASSESSMENT = "quality_assessment"
    TOXICITY_DETECTION = "toxicity_detection"
    CUSTOM_RULES = "custom_rules"


@dataclass
class ValidationResult:
    """Result of a validation check."""

    validation_type: ValidationType
    severity: ValidationSeverity
    is_valid: bool
    is_critical: bool = False
    confidence: float = 0.0
    message: str = ""
    details: Dict[str, Any] = None
    detected_content: Optional[str] = None
    suggestions: List[str] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}
        if self.suggestions is None:
            self.suggestions = []


@dataclass
class ValidationReport:
    """Complete validation report for a response."""

    response_id: str
    provider: str
    model: str
    timestamp: datetime
    is_valid: bool
    overall_score: float
    results: List[ValidationResult]
    processing_time_ms: float

    @property
    def critical_issues(self) -> List[ValidationResult]:
        """Get critical validation issues."""
        return [r for r in self.results if r.severity == ValidationSeverity.CRITICAL]

    @property
    def errors(self) -> List[ValidationResult]:
        """Get error-level validation issues."""
        return [r for r in self.results if r.severity == ValidationSeverity.ERROR]

    @property
    def warnings(self) -> List[ValidationResult]:
        """Get warning-level validation issues."""
        return [r for r in self.results if r.severity == ValidationSeverity.WARNING]

    @property
    def has_critical_issues(self) -> bool:
        """Check if there are critical issues."""
        return len(self.critical_issues) > 0

    @property
    def has_errors(self) -> bool:
        """Check if there are errors."""
        return len(self.errors) > 0


class ContentSafetyValidator:
    """Validates content safety for harmful or inappropriate content."""

    def __init__(self):
        """Initialize content safety validator."""
        # Patterns for harmful content detection
        self.harmful_patterns = {
            "violence": [
                r"\b(kill|murder|violence|harm|hurt|assault|abuse)\b",
                r"\b(weapon|gun|knife|bomb|explosive)\b",
            ],
            "hate_speech": [
                r"\b(hate|discriminat|racist|sexist|homophobic)\b",
                r"\b(slur|derogatory|offensive)\b",
            ],
            "self_harm": [
                r"\b(suicide|self.harm|kill myself|end my life)\b",
                r"\b(depression|anxiety|mental health crisis)\b",
            ],
            "illegal_activities": [
                r"\b(illegal|crime|fraud|scam|theft|robbery)\b",
                r"\b(drug|substance abuse|addiction)\b",
            ],
        }

        # Compile patterns for efficiency
        self.compiled_patterns = {}
        for category, patterns in self.harmful_patterns.items():
            self.compiled_patterns[category] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]

    async def validate(self, content: str) -> ValidationResult:
        """Validate content for harmful material."""
        start_time = time.time()

        detected_issues = []
        max_confidence = 0.0
        most_severe = ValidationSeverity.INFO

        for category, patterns in self.compiled_patterns.items():
            category_matches = []
            category_confidence = 0.0

            for pattern in patterns:
                matches = pattern.findall(content)
                if matches:
                    category_matches.extend(matches)
                    # Confidence based on number of matches
                    category_confidence = min(1.0, len(matches) * 0.3)

            if category_matches:
                detected_issues.append(
                    {
                        "category": category,
                        "matches": category_matches,
                        "confidence": category_confidence,
                    }
                )

                max_confidence = max(max_confidence, category_confidence)

                # Determine severity based on category and confidence
                if category in ["self_harm", "violence"]:
                    most_severe = ValidationSeverity.CRITICAL
                elif category in ["hate_speech", "illegal_activities"]:
                    most_severe = ValidationSeverity.ERROR
                else:
                    most_severe = max(most_severe, ValidationSeverity.WARNING)

        processing_time = (time.time() - start_time) * 1000

        if detected_issues:
            return ValidationResult(
                validation_type=ValidationType.CONTENT_SAFETY,
                severity=most_severe,
                is_valid=False,
                is_critical=(most_severe == ValidationSeverity.CRITICAL),
                confidence=max_confidence,
                message=f"Content safety issues detected: {', '.join(issue['category'] for issue in detected_issues)}",
                details={
                    "detected_issues": detected_issues,
                    "processing_time_ms": processing_time,
                },
                detected_content=", ".join(
                    match
                    for issue in detected_issues
                    for match in issue["matches"][:3]  # Limit to 3 matches per category
                ),
                suggestions=[
                    "Review and revise the content to remove harmful material",
                    "Consider using alternative phrasing",
                    "Ensure content follows community guidelines",
                ],
            )
        else:
            return ValidationResult(
                validation_type=ValidationType.CONTENT_SAFETY,
                severity=ValidationSeverity.INFO,
                is_valid=True,
                confidence=1.0,
                message="No content safety issues detected",
                details={"processing_time_ms": processing_time},
            )


class PIIDetector:
    """Detects Personally Identifiable Information (PII) in responses."""

    def __init__(self):
        """Initialize PII detector."""
        # PII patterns
        self.pii_patterns = {
            "email": [
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            ],
            "phone": [
                r"\b\d{3}-\d{3}-\d{4}\b",  # 555-555-5555
                r"\b\(\d{3}\)\s*\d{3}-\d{4}\b",  # (555) 555-5555
                r"\b\d{10}\b",  # 5555555555
            ],
            "ssn": [
                r"\b\d{3}-\d{2}-\d{4}\b",  # 555-55-5555
                r"\b\d{9}\b",  # 555555555
            ],
            "credit_card": [
                r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b",  # 5555-5555-5555-5555
            ],
            "ip_address": [
                r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b",  # IPv4
            ],
            "address": [
                r"\d+\s+[\w\s]+,\s*[\w\s]+,\s*[A-Z]{2}\s*\d{5}",  # US Address pattern
            ],
        }

        # Compile patterns
        self.compiled_patterns = {}
        for pii_type, patterns in self.pii_patterns.items():
            self.compiled_patterns[pii_type] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]

    async def detect_pii(self, content: str) -> ValidationResult:
        """Detect PII in content."""
        start_time = time.time()

        detected_pii = []
        total_matches = 0

        for pii_type, patterns in self.compiled_patterns.items():
            type_matches = []

            for pattern in patterns:
                matches = pattern.findall(content)
                type_matches.extend(matches)

            if type_matches:
                detected_pii.append(
                    {
                        "type": pii_type,
                        "count": len(type_matches),
                        "samples": type_matches[:3],  # Show first 3 samples
                    }
                )
                total_matches += len(type_matches)

        processing_time = (time.time() - start_time) * 1000

        if detected_pii:
            severity = (
                ValidationSeverity.ERROR
                if total_matches > 5
                else ValidationSeverity.WARNING
            )
            confidence = min(1.0, total_matches * 0.2)

            return ValidationResult(
                validation_type=ValidationType.PII_DETECTION,
                severity=severity,
                is_valid=False,
                confidence=confidence,
                message=f"PII detected: {total_matches} instances across {len(detected_pii)} types",
                details={
                    "detected_pii": detected_pii,
                    "total_matches": total_matches,
                    "processing_time_ms": processing_time,
                },
                detected_content=", ".join(
                    f"{item['type']}: {item['samples'][0]}"
                    for item in detected_pii
                    if item["samples"]
                ),
                suggestions=[
                    "Remove or redact detected PII",
                    "Use placeholder text instead of actual sensitive information",
                    "Implement data masking techniques",
                ],
            )
        else:
            return ValidationResult(
                validation_type=ValidationType.PII_DETECTION,
                severity=ValidationSeverity.INFO,
                is_valid=True,
                confidence=0.9,
                message="No PII detected",
                details={"processing_time_ms": processing_time},
            )


class FormatValidator:
    """Validates response format based on expected structure."""

    def __init__(self):
        """Initialize format validator."""
        pass

    async def validate_format(
        self, content: str, expected_format: Optional[str] = None
    ) -> ValidationResult:
        """Validate content format."""
        start_time = time.time()

        issues = []

        # Basic format checks
        if not content.strip():
            issues.append("Empty response")

        # Check for malformed JSON if JSON is expected
        if expected_format == "json":
            try:
                import json

                json.loads(content)
            except json.JSONDecodeError:
                issues.append("Invalid JSON format")

        # Check for malformed code blocks
        code_blocks = re.findall(r"```(\w+)?\n(.*?)\n```", content, re.DOTALL)
        for lang, code in code_blocks:
            if not code.strip():
                issues.append(f"Empty code block detected ({lang or 'no language'})")

        # Check for incomplete sentences
        sentences = re.split(r"[.!?]+", content)
        incomplete = [s.strip() for s in sentences if s.strip() and len(s.strip()) < 10]
        if incomplete:
            issues.append(f"Potential incomplete sentences: {len(incomplete)}")

        processing_time = (time.time() - start_time) * 1000

        if issues:
            return ValidationResult(
                validation_type=ValidationType.FORMAT_VALIDATION,
                severity=ValidationSeverity.WARNING,
                is_valid=len(issues) == 0,
                confidence=0.8,
                message=f"Format issues detected: {'; '.join(issues)}",
                details={
                    "issues": issues,
                    "expected_format": expected_format,
                    "processing_time_ms": processing_time,
                },
                suggestions=[
                    "Review response format and structure",
                    "Ensure code blocks are properly formatted",
                    "Check for incomplete sentences or thoughts",
                ],
            )
        else:
            return ValidationResult(
                validation_type=ValidationType.FORMAT_VALIDATION,
                severity=ValidationSeverity.INFO,
                is_valid=True,
                confidence=1.0,
                message="Format validation passed",
                details={
                    "expected_format": expected_format,
                    "processing_time_ms": processing_time,
                },
            )


class QualityAssessor:
    """Assesses response quality based on various metrics."""

    def __init__(self):
        """Initialize quality assessor."""
        pass

    async def assess_quality(
        self, content: str, request: Optional[LLMRequest] = None
    ) -> ValidationResult:
        """Assess response quality."""
        start_time = time.time()

        quality_metrics = {}
        overall_score = 0.0

        # Length assessment
        content_length = len(content.strip())
        if content_length < 10:
            length_score = 0.2
            length_comment = "Very short response"
        elif content_length < 50:
            length_score = 0.5
            length_comment = "Short response"
        elif content_length < 500:
            length_score = 1.0
            length_comment = "Appropriate length"
        elif content_length < 2000:
            length_score = 0.9
            length_comment = "Good length"
        else:
            length_score = 0.7
            length_comment = "Long response (may be verbose)"

        quality_metrics["length"] = {
            "score": length_score,
            "comment": length_comment,
            "actual_length": content_length,
        }
        overall_score += length_score * 0.2

        # Coherence assessment (simplified)
        sentences = [s.strip() for s in re.split(r"[.!?]+", content) if s.strip()]
        avg_sentence_length = (
            sum(len(s.split()) for s in sentences) / len(sentences) if sentences else 0
        )

        if 10 <= avg_sentence_length <= 25:
            coherence_score = 1.0
            coherence_comment = "Good sentence length variety"
        elif 5 <= avg_sentence_length <= 35:
            coherence_score = 0.8
            coherence_comment = "Reasonable sentence structure"
        else:
            coherence_score = 0.5
            coherence_comment = "Unusual sentence structure"

        quality_metrics["coherence"] = {
            "score": coherence_score,
            "comment": coherence_comment,
            "avg_sentence_length": avg_sentence_length,
            "sentence_count": len(sentences),
        }
        overall_score += coherence_score * 0.3

        # Vocabulary diversity
        words = content.lower().split()
        unique_words = set(words)
        vocabulary_diversity = len(unique_words) / len(words) if words else 0

        if vocabulary_diversity > 0.7:
            vocab_score = 1.0
            vocab_comment = "Good vocabulary diversity"
        elif vocabulary_diversity > 0.5:
            vocab_score = 0.8
            vocab_comment = "Moderate vocabulary diversity"
        else:
            vocab_score = 0.6
            vocab_comment = "Limited vocabulary diversity"

        quality_metrics["vocabulary"] = {
            "score": vocab_score,
            "comment": vocab_comment,
            "diversity_ratio": vocabulary_diversity,
            "total_words": len(words),
            "unique_words": len(unique_words),
        }
        overall_score += vocab_score * 0.2

        # Relevance to request (if available)
        relevance_score = 0.8  # Default score
        relevance_comment = "Unable to assess relevance without request context"

        if request and request.messages:
            # Simple keyword overlap assessment
            request_text = " ".join(msg.content for msg in request.messages).lower()
            response_text = content.lower()

            request_words = set(request_text.split())
            response_words = set(response_text.split())

            if request_words and response_words:
                overlap = len(request_words & response_words) / len(request_words)
                relevance_score = min(1.0, overlap + 0.5)  # Boost baseline score
                relevance_comment = f"Keyword overlap: {overlap:.2%}"

        quality_metrics["relevance"] = {
            "score": relevance_score,
            "comment": relevance_comment,
        }
        overall_score += relevance_score * 0.3

        processing_time = (time.time() - start_time) * 1000

        # Determine overall quality
        if overall_score >= 0.8:
            severity = ValidationSeverity.INFO
            is_valid = True
            message = "High quality response"
        elif overall_score >= 0.6:
            severity = ValidationSeverity.WARNING
            is_valid = True
            message = "Acceptable quality response"
        else:
            severity = ValidationSeverity.ERROR
            is_valid = False
            message = "Low quality response"

        # Generate suggestions based on low-scoring metrics
        suggestions = []
        for metric, data in quality_metrics.items():
            if data["score"] < 0.7:
                if metric == "length":
                    suggestions.append("Consider providing more detailed responses")
                elif metric == "coherence":
                    suggestions.append("Improve sentence structure and flow")
                elif metric == "vocabulary":
                    suggestions.append("Use more diverse vocabulary")
                elif metric == "relevance":
                    suggestions.append("Ensure response directly addresses the request")

        return ValidationResult(
            validation_type=ValidationType.QUALITY_ASSESSMENT,
            severity=severity,
            is_valid=is_valid,
            confidence=overall_score,
            message=message,
            details={
                "quality_metrics": quality_metrics,
                "overall_score": overall_score,
                "processing_time_ms": processing_time,
            },
            suggestions=suggestions,
        )


class ResponseValidator:
    """Main response validator that coordinates all validation checks."""

    def __init__(
        self,
        enable_content_safety: bool = True,
        enable_pii_detection: bool = True,
        enable_format_validation: bool = True,
        enable_quality_assessment: bool = True,
        custom_validators: List[callable] = None,
    ):
        """Initialize response validator."""
        self.enable_content_safety = enable_content_safety
        self.enable_pii_detection = enable_pii_detection
        self.enable_format_validation = enable_format_validation
        self.enable_quality_assessment = enable_quality_assessment
        self.custom_validators = custom_validators or []

        # Initialize validators
        if self.enable_content_safety:
            self.content_safety_validator = ContentSafetyValidator()

        if self.enable_pii_detection:
            self.pii_detector = PIIDetector()

        if self.enable_format_validation:
            self.format_validator = FormatValidator()

        if self.enable_quality_assessment:
            self.quality_assessor = QualityAssessor()

    async def validate_response(
        self,
        response: LLMResponse,
        request: Optional[LLMRequest] = None,
        provider: str = "unknown",
    ) -> ValidationReport:
        """Perform comprehensive validation of LLM response."""
        start_time = time.time()

        results = []

        # Get response content
        content = response.content or ""

        # Run enabled validations
        if self.enable_content_safety and content:
            try:
                result = await self.content_safety_validator.validate(content)
                results.append(result)
            except Exception as e:
                logger.error(f"Content safety validation failed: {e}")
                results.append(
                    ValidationResult(
                        validation_type=ValidationType.CONTENT_SAFETY,
                        severity=ValidationSeverity.ERROR,
                        is_valid=False,
                        message=f"Content safety validation error: {e}",
                    )
                )

        if self.enable_pii_detection and content:
            try:
                result = await self.pii_detector.detect_pii(content)
                results.append(result)
            except Exception as e:
                logger.error(f"PII detection failed: {e}")
                results.append(
                    ValidationResult(
                        validation_type=ValidationType.PII_DETECTION,
                        severity=ValidationSeverity.ERROR,
                        is_valid=False,
                        message=f"PII detection error: {e}",
                    )
                )

        if self.enable_format_validation and content:
            try:
                expected_format = None
                if request and request.metadata:
                    expected_format = request.metadata.get("expected_format")

                result = await self.format_validator.validate_format(
                    content, expected_format
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Format validation failed: {e}")
                results.append(
                    ValidationResult(
                        validation_type=ValidationType.FORMAT_VALIDATION,
                        severity=ValidationSeverity.ERROR,
                        is_valid=False,
                        message=f"Format validation error: {e}",
                    )
                )

        if self.enable_quality_assessment and content:
            try:
                result = await self.quality_assessor.assess_quality(content, request)
                results.append(result)
            except Exception as e:
                logger.error(f"Quality assessment failed: {e}")
                results.append(
                    ValidationResult(
                        validation_type=ValidationType.QUALITY_ASSESSMENT,
                        severity=ValidationSeverity.ERROR,
                        is_valid=False,
                        message=f"Quality assessment error: {e}",
                    )
                )

        # Run custom validators
        for validator in self.custom_validators:
            try:
                result = await validator(content, request, response)
                if isinstance(result, ValidationResult):
                    results.append(result)
            except Exception as e:
                logger.error(f"Custom validator failed: {e}")
                results.append(
                    ValidationResult(
                        validation_type=ValidationType.CUSTOM_RULES,
                        severity=ValidationSeverity.ERROR,
                        is_valid=False,
                        message=f"Custom validation error: {e}",
                    )
                )

        # Calculate overall validity and score
        is_valid = not any(r.is_critical for r in results) and all(
            r.is_valid for r in results if r.severity != ValidationSeverity.INFO
        )
        overall_score = (
            sum(r.confidence for r in results) / len(results) if results else 1.0
        )

        processing_time = (time.time() - start_time) * 1000

        return ValidationReport(
            response_id=response.id,
            provider=provider,
            model=response.model,
            timestamp=datetime.now(),
            is_valid=is_valid,
            overall_score=overall_score,
            results=results,
            processing_time_ms=processing_time,
        )

    async def validate_content(
        self,
        content: str,
        request: Optional[LLMRequest] = None,
        expected_format: Optional[str] = None,
    ) -> ValidationReport:
        """Validate content directly without a full response object."""
        # Create a mock response for validation
        from .base_provider import LLMResponse, TokenUsage

        mock_response = LLMResponse(
            id="validation_mock",
            model="unknown",
            choices=[{"message": {"content": content}}],
            usage=TokenUsage(),
        )

        if request and expected_format:
            if not request.metadata:
                request.metadata = {}
            request.metadata["expected_format"] = expected_format

        return await self.validate_response(mock_response, request, "direct_validation")

    def add_custom_validator(self, validator: callable) -> None:
        """Add a custom validation function."""
        self.custom_validators.append(validator)

    def remove_custom_validator(self, validator: callable) -> None:
        """Remove a custom validation function."""
        if validator in self.custom_validators:
            self.custom_validators.remove(validator)
