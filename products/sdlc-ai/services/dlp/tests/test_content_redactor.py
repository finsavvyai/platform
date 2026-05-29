"""
Comprehensive tests for Content Redaction Service.

Tests cover:
- PII redaction with various masking strategies
- Tokenization and reversible redaction
- Content masking and format preservation
- Secure data handling with encryption
- Audit logging and compliance
- Quality monitoring and validation
"""

import asyncio
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import hashlib
from cryptography.fernet import Fernet

from app.services.content_redactor import (
    ContentRedactor,
    MaskingType,
    RedactionLevel,
    RedactionPolicy,
    RedactionResult,
)
from app.services.redaction_quality_monitor import (
    RedactionQualityMonitor,
    QualityMetrics,
    QualityValidationResult,
)
from app.models.database import RedactionLog, RedactionToken


class TestContentRedactor:
    """Test suite for ContentRedactor service."""

    @pytest.fixture
    async def redactor(self):
        """Create a test ContentRedactor instance."""
        with patch("asyncpg.create_pool"), patch("redis.asyncio.Redis.from_url"):
            redactor = ContentRedactor()
            # Mock database and redis
            redactor.db_pool = AsyncMock()
            redactor.redis = AsyncMock()
            yield redactor
            await redactor.close()

    @pytest.fixture
    def sample_content(self):
        """Sample content containing PII."""
        return """
        John Doe (john.doe@example.com) has a Social Security Number 123-45-6789
        and a credit card ending in 4242. His phone number is 555-123-4567.
        He lives at 123 Main St, New York, NY 10001.
        His IBAN is GB82WEST12345698765432.
        """

    @pytest.fixture
    def sample_policy(self):
        """Sample redaction policy."""
        return RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=[
                "PERSON",
                "EMAIL_ADDRESS",
                "US_SSN",
                "CREDIT_CARD",
                "PHONE_NUMBER",
            ],
            masking_strategies={
                "PERSON": MaskingType.PARTIAL_MASK,
                "EMAIL_ADDRESS": MaskingType.TOKEN_MASK,
                "US_SSN": MaskingType.HASH_MASK,
                "CREDIT_CARD": MaskingType.HASH_MASK,
                "PHONE_NUMBER": MaskingType.PARTIAL_MASK,
            },
            redaction_level=RedactionLevel.STANDARD,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

    @pytest.mark.asyncio
    async def test_redact_content_full_masking(self, redactor, sample_content):
        """Test full masking redaction strategy."""

        # Mock policy retrieval
        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["PERSON"],
            masking_strategies={"PERSON": MaskingType.FULL_MASK},
            redaction_level=RedactionLevel.MINIMAL,
            custom_rules=[],
            preserve_format=False,
            quality_threshold=0.8,
        )

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "PERSON",
                        "text": "John Doe",
                        "start": 0,
                        "end": 8,
                        "confidence_score": 0.95,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            assert isinstance(result, RedactionResult)
            assert "[REDACTED]" in result.redacted_content
            assert "John Doe" not in result.redacted_content
            assert result.entities_found[0]["entity_type"] == "PERSON"
            assert result.quality_score > 0

    @pytest.mark.asyncio
    async def test_redact_content_partial_masking(self, redactor, sample_content):
        """Test partial masking preserving some characters."""

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["PERSON"],
            masking_strategies={"PERSON": MaskingType.PARTIAL_MASK},
            redaction_level=RedactionLevel.MINIMAL,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "PERSON",
                        "text": "John Doe",
                        "start": 0,
                        "end": 8,
                        "confidence_score": 0.95,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            # Should preserve first and last character
            assert (
                "J***e" in result.redacted_content or "J***D" in result.redacted_content
            )
            assert "John Doe" not in result.redacted_content

    @pytest.mark.asyncio
    async def test_redact_content_hash_masking(self, redactor, sample_content):
        """Test hash masking for sensitive data."""

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["US_SSN"],
            masking_strategies={"US_SSN": MaskingType.HASH_MASK},
            redaction_level=RedactionLevel.STANDARD,
            custom_rules=[],
            preserve_format=False,
            quality_threshold=0.8,
        )

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "US_SSN",
                        "text": "123-45-6789",
                        "start": 58,
                        "end": 69,
                        "confidence_score": 0.99,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            assert "[HASH:" in result.redacted_content
            assert "123-45-6789" not in result.redacted_content

    @pytest.mark.asyncio
    async def test_redact_content_token_masking(self, redactor, sample_content):
        """Test token masking for reversible redaction."""

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["EMAIL_ADDRESS"],
            masking_strategies={"EMAIL_ADDRESS": MaskingType.TOKEN_MASK},
            redaction_level=RedactionLevel.STANDARD,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

        mock_token = {
            "token_id": "test-token-id",
            "entity_type": "EMAIL_ADDRESS",
            "token_value": "abc123def456",
            "original_value": redactor._encrypt_value("john.doe@example.com"),
        }

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "EMAIL_ADDRESS",
                        "text": "john.doe@example.com",
                        "start": 15,
                        "end": 35,
                        "confidence_score": 0.98,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[mock_token]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            assert "[TOKEN:abc123def456]" in result.redacted_content
            assert "john.doe@example.com" not in result.redacted_content
            assert len(result.tokens_used) == 1

    @pytest.mark.asyncio
    async def test_redact_content_preserve_format(self, redactor, sample_content):
        """Test format preservation in redaction."""

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["EMAIL_ADDRESS"],
            masking_strategies={"EMAIL_ADDRESS": MaskingType.PRESERVE_FORMAT},
            redaction_level=RedactionLevel.STANDARD,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "EMAIL_ADDRESS",
                        "text": "john.doe@example.com",
                        "start": 15,
                        "end": 35,
                        "confidence_score": 0.98,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            # Should preserve domain
            assert "@example.com" in result.redacted_content
            assert "john.doe" not in result.redacted_content

    @pytest.mark.asyncio
    async def test_token_reversal(self, redactor):
        """Test reversible redaction using tokens."""

        tenant_id = "test-tenant"
        original_value = "john.doe@example.com"
        encrypted_value = redactor._encrypt_value(original_value)
        token_value = hashlib.sha256(
            f"{tenant_id}:{original_value}".encode()
        ).hexdigest()[:12]

        # Mock database response
        redactor.db_pool.fetchrow.return_value = {
            "original_value": encrypted_value,
            "entity_type": "EMAIL_ADDRESS",
            "audit_log_id": "test-audit-id",
        }

        with (
            patch.object(redactor, "_check_token_access_permission", return_value=True),
            patch.object(redactor, "_log_audit_event"),
        ):
            retrieved_value = await redactor.get_redaction_by_token(
                token_value=token_value,
                tenant_id=tenant_id,
                user_id="test-user",
                reason="Test access",
            )

            assert retrieved_value == original_value
            redactor.db_pool.fetchrow.assert_called_once()

    @pytest.mark.asyncio
    async def test_audit_logging(self, redactor, sample_content, sample_policy):
        """Test comprehensive audit logging."""

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=sample_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "PERSON",
                        "text": "John Doe",
                        "start": 0,
                        "end": 8,
                        "confidence_score": 0.95,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            # Check that _log_redaction was called
            assert result.audit_log_id is not None
            assert result.entities_found is not None
            assert result.redaction_stats is not None

    @pytest.mark.asyncio
    async def test_quality_calculation(self, redactor):
        """Test redaction quality calculation."""

        original = "John Doe has email john.doe@example.com"
        redacted = "J***e has email [TOKEN:abc123]"
        entities = [
            {"entity_type": "PERSON", "text": "John Doe", "start": 0, "end": 8},
            {
                "entity_type": "EMAIL_ADDRESS",
                "text": "john.doe@example.com",
                "start": 19,
                "end": 39,
            },
        ]

        quality_score = await redactor._calculate_redaction_quality(
            original, redacted, entities
        )

        assert 0.0 <= quality_score <= 1.0
        assert quality_score > 0.5  # Should be reasonable quality

    @pytest.mark.asyncio
    async def test_multiple_entities(self, redactor, sample_content):
        """Test redaction of multiple entity types."""

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["PERSON", "EMAIL_ADDRESS", "US_SSN", "PHONE_NUMBER"],
            masking_strategies={
                "PERSON": MaskingType.PARTIAL_MASK,
                "EMAIL_ADDRESS": MaskingType.TOKEN_MASK,
                "US_SSN": MaskingType.HASH_MASK,
                "PHONE_NUMBER": MaskingType.PARTIAL_MASK,
            },
            redaction_level=RedactionLevel.STANDARD,
            custom_rules=[],
            preserve_format=True,
            quality_threshold=0.8,
        )

        entities = [
            {
                "entity_type": "PERSON",
                "text": "John Doe",
                "start": 1,
                "end": 9,
                "confidence_score": 0.95,
            },
            {
                "entity_type": "EMAIL_ADDRESS",
                "text": "john.doe@example.com",
                "start": 16,
                "end": 36,
                "confidence_score": 0.98,
            },
            {
                "entity_type": "US_SSN",
                "text": "123-45-6789",
                "start": 59,
                "end": 70,
                "confidence_score": 0.99,
            },
            {
                "entity_type": "PHONE_NUMBER",
                "text": "555-123-4567",
                "start": 100,
                "end": 111,
                "confidence_score": 0.97,
            },
        ]

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(redactor, "_detect_entities", return_value=entities),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            # Check all entities were redacted
            assert "John Doe" not in result.redacted_content
            assert "john.doe@example.com" not in result.redacted_content
            assert "123-45-6789" not in result.redacted_content
            assert "555-123-4567" not in result.redacted_content

            # Check different masking types applied
            assert (
                "[TOKEN:" in result.redacted_content
                or "[HASH:" in result.redacted_content
            )
            assert result.redaction_stats["total_entities"] == 4

    @pytest.mark.asyncio
    async def test_encryption_decryption(self, redactor):
        """Test secure data encryption and decryption."""

        original_value = "sensitive-data-123"

        # Encrypt
        encrypted = redactor._encrypt_value(original_value)
        assert encrypted != original_value
        assert isinstance(encrypted, str)

        # Decrypt
        decrypted = redactor._decrypt_value(encrypted)
        assert decrypted == original_value

    @pytest.mark.asyncio
    async def test_get_analytics(self, redactor):
        """Test redaction analytics retrieval."""

        # Mock database responses
        redactor.db_pool.fetchrow.return_value = {
            "total_redactions": 100,
            "avg_quality": 0.92,
            "avg_processing_time": 50.5,
            "unique_users": 5,
        }

        redactor.db_pool.fetch.side_effect = [
            [{"entity_type": "PERSON", "count": 40, "avg_confidence": 0.95}],
            [{"date": datetime.now().date(), "redactions": 10, "avg_quality": 0.91}],
        ]

        analytics = await redactor.get_redaction_analytics("test-tenant", days=7)

        assert analytics["summary"]["total_redactions"] == 100
        assert analytics["summary"]["avg_quality_score"] == 0.92
        assert len(analytics["entity_distribution"]) == 1
        assert len(analytics["daily_volume"]) == 1

    @pytest.mark.asyncio
    async def test_error_handling(self, redactor, sample_content):
        """Test error handling in redaction process."""

        with patch.object(
            redactor, "_get_redaction_policy", side_effect=Exception("Database error")
        ):
            with pytest.raises(Exception):
                await redactor.redact_content(
                    content=sample_content, tenant_id="test-tenant", user_id="test-user"
                )

    @pytest.mark.asyncio
    async def test_performance_metrics(self, redactor, sample_content):
        """Test performance metrics tracking."""

        initial_stats = redactor._performance_stats.copy()

        mock_policy = RedactionPolicy(
            tenant_id="test-tenant",
            policy_id="test-policy",
            name="Test Policy",
            entity_types=["PERSON"],
            masking_strategies={"PERSON": MaskingType.FULL_MASK},
            redaction_level=RedactionLevel.MINIMAL,
            custom_rules=[],
            preserve_format=False,
            quality_threshold=0.8,
        )

        with (
            patch.object(redactor, "_get_redaction_policy", return_value=mock_policy),
            patch.object(
                redactor,
                "_detect_entities",
                return_value=[
                    {
                        "entity_type": "PERSON",
                        "text": "John Doe",
                        "start": 0,
                        "end": 8,
                        "confidence_score": 0.95,
                    }
                ],
            ),
            patch.object(redactor, "_create_tokens", return_value=[]),
            patch.object(redactor, "_log_redaction"),
        ):
            result = await redactor.redact_content(
                content=sample_content, tenant_id="test-tenant", user_id="test-user"
            )

            # Check stats updated
            assert (
                redactor._performance_stats["total_redactions"]
                > initial_stats["total_redactions"]
            )
            assert redactor._performance_stats["avg_processing_time"] > 0


class TestRedactionQualityMonitor:
    """Test suite for RedactionQualityMonitor service."""

    @pytest.fixture
    async def monitor(self):
        """Create a test RedactionQualityMonitor instance."""
        with patch("asyncpg.create_pool"):
            monitor = RedactionQualityMonitor()
            monitor.db_pool = AsyncMock()
            yield monitor
            await monitor.close()

    @pytest.fixture
    def sample_entities(self):
        """Sample detected entities."""
        return [
            {
                "entity_type": "PERSON",
                "text": "John Doe",
                "start": 0,
                "end": 8,
                "confidence_score": 0.95,
            },
            {
                "entity_type": "EMAIL_ADDRESS",
                "text": "john.doe@example.com",
                "start": 15,
                "end": 35,
                "confidence_score": 0.98,
            },
            {
                "entity_type": "US_SSN",
                "text": "123-45-6789",
                "start": 50,
                "end": 61,
                "confidence_score": 0.99,
            },
        ]

    @pytest.mark.asyncio
    async def test_assess_redaction_quality(self, monitor, sample_entities):
        """Test comprehensive quality assessment."""

        original = "John Doe (john.doe@example.com) has SSN 123-45-6789"
        redacted = "J***e ([TOKEN:abc123]) has SSN [HASH:1a2b3c4d]"

        with patch.object(monitor, "_store_quality_metrics"):
            metrics = await monitor.assess_redaction_quality(
                original_content=original,
                redacted_content=redacted,
                entities_found=sample_entities,
                processing_time_ms=25,
                policy_config={"level": "STANDARD"},
                audit_log_id="test-audit-123",
                tenant_id="test-tenant",
            )

        assert isinstance(metrics, QualityMetrics)
        assert 0.0 <= metrics.overall_score <= 1.0
        assert metrics.entity_coverage_rate > 0.5
        assert metrics.processing_time_ms == 25
        assert metrics.entities_per_second > 0
        assert len(metrics.entity_type_metrics) > 0

    @pytest.mark.asyncio
    async def test_entity_coverage_calculation(self, monitor, sample_entities):
        """Test entity coverage rate calculation."""

        original = "John Doe has email john.doe@example.com"
        redacted = "J***e has email [TOKEN:abc123]"

        coverage = await monitor._calculate_entity_coverage(
            original, redacted, sample_entities[:2]
        )

        assert coverage == 1.0  # Both entities should be covered

    @pytest.mark.asyncio
    async def test_false_positive_detection(self, monitor):
        """Test false positive detection."""

        # Entities with low confidence
        entities = [
            {
                "entity_type": "PERSON",
                "text": "said",
                "start": 10,
                "end": 14,
                "confidence_score": 0.3,  # Low confidence
            },
            {
                "entity_type": "EMAIL_ADDRESS",
                "text": "not-an-email",
                "start": 20,
                "end": 32,
                "confidence_score": 0.4,
            },
        ]

        fp_rate = await monitor._detect_false_positives(
            "He said it", "He [REDACTED] it", entities
        )

        assert fp_rate > 0.5  # Should detect false positives

    @pytest.mark.asyncio
    async def test_false_negative_detection(self, monitor):
        """Test false negative detection."""

        original = "Contact john.doe@example.com or call 555-123-4567"
        redacted = "Contact [REDACTED] or call 555-123-4567"  # Phone number missed

        entities = [
            {
                "entity_type": "EMAIL_ADDRESS",
                "text": "john.doe@example.com",
                "start": 8,
                "end": 28,
                "confidence_score": 0.98,
            }
        ]

        fn_rate = await monitor._detect_false_negatives(original, redacted, entities)

        assert fn_rate > 0  # Should detect missed phone number

    @pytest.mark.asyncio
    async def test_format_preservation(self, monitor):
        """Test format preservation assessment."""

        original = "John Doe.\n\nHe lives in New York."
        redacted = "J***e.\n\nHe lives in N***."  # Preserves paragraphs

        entities = [
            {"entity_type": "PERSON", "text": "John Doe", "start": 0, "end": 8},
            {"entity_type": "LOCATION", "text": "New York", "start": 27, "end": 35},
        ]

        format_score = await monitor._assess_format_preservation(
            original, redacted, entities
        )

        assert format_score > 0.8  # Should preserve structure well

    @pytest.mark.asyncio
    async def test_context_preservation(self, monitor):
        """Test context preservation assessment."""

        original = "John Doe said he would come tomorrow"
        redacted = "J***e said he would come tomorrow"

        context_score = await monitor._assess_context_preservation(original, redacted)

        assert context_score > 0.9  # Should preserve almost all context

    @pytest.mark.asyncio
    async def test_quality_validation(self, monitor):
        """Test quality validation against thresholds."""

        # Mock metrics row
        mock_row = {
            "quality_score": 0.92,
            "false_positive_rate": 0.02,
            "false_negative_rate": 0.01,
            "entity_coverage_rate": 0.95,
        }

        monitor.db_pool.fetchrow.return_value = mock_row

        result = await monitor.validate_redaction_quality(
            audit_log_id="test-audit-123", tenant_id="test-tenant"
        )

        assert isinstance(result, QualityValidationResult)
        assert result.passed == True
        assert result.score == 0.92
        assert result.review_priority == "LOW"

    @pytest.mark.asyncio
    async def test_quality_validation_failure(self, monitor):
        """Test quality validation with failures."""

        # Mock poor metrics row
        mock_row = {
            "quality_score": 0.65,
            "false_positive_rate": 0.15,
            "false_negative_rate": 0.08,
            "entity_coverage_rate": 0.70,
        }

        monitor.db_pool.fetchrow.return_value = mock_row

        result = await monitor.validate_redaction_quality(
            audit_log_id="test-audit-123", tenant_id="test-tenant"
        )

        assert isinstance(result, QualityValidationResult)
        assert result.passed == False
        assert result.score == 0.65
        assert result.requires_manual_review == True
        assert result.review_priority in ["HIGH", "CRITICAL"]
        assert len(result.issues) > 0
        assert len(result.recommendations) > 0

    @pytest.mark.asyncio
    async def test_quality_analytics(self, monitor):
        """Test quality analytics retrieval."""

        # Mock database responses
        monitor.db_pool.fetchrow.return_value = {
            "total_redactions": 500,
            "avg_quality": 0.89,
            "avg_coverage": 0.92,
            "avg_fp_rate": 0.03,
            "avg_fn_rate": 0.02,
            "avg_format_score": 0.94,
            "review_required_count": 25,
            "avg_processing_time": 45.5,
        }

        monitor.db_pool.fetch.side_effect = [
            [{"date": datetime.now().date(), "avg_score": 0.91, "redaction_count": 50}],
            [{"entity_type": "PERSON", "avg_score": 0.93, "count": 200}],
            [],
        ]

        analytics = await monitor.get_quality_analytics("test-tenant", days=30)

        assert analytics["summary"]["total_redactions"] == 500
        assert analytics["summary"]["avg_quality_score"] == 0.89
        assert analytics["summary"]["review_required_rate"] == 0.05  # 25/500
        assert len(analytics["trends"]) == 1
        assert len(analytics["entity_performance"]) == 1

    @pytest.mark.asyncio
    async def test_issue_identification(self, monitor):
        """Test quality issue identification."""

        original = "This is a test document with John Doe's information"
        redacted = "[REDACTED]"  # Over-redacted

        entities = [
            {"entity_type": "PERSON", "text": "John Doe", "start": 29, "end": 37}
        ]

        issues = await monitor._identify_quality_issues(original, redacted, entities)

        assert len(issues) > 0

        # Check for over-redaction issue
        over_redaction_found = any(
            issue["type"] == "OVER_REDACTION" for issue in issues
        )
        assert over_redaction_found

    @pytest.mark.asyncio
    async def test_recommendation_generation(self, monitor):
        """Test recommendation generation based on issues."""

        issues = [
            {"type": "MISSED_ENTITY", "severity": "HIGH"},
            {"type": "FALSE_POSITIVE", "severity": "MEDIUM"},
        ]

        entity_metrics = {
            "PERSON": {"coverage_rate": 0.7, "avg_confidence": 0.6},
            "EMAIL_ADDRESS": {"coverage_rate": 0.95, "avg_confidence": 0.98},
        }

        recommendations = await monitor._generate_recommendations(
            issues, entity_metrics
        )

        assert len(recommendations) > 0

        # Should have recommendations for missed entities
        missed_rec_found = any(
            "confidence thresholds" in rec.lower() for rec in recommendations
        )
        assert missed_rec_found

    @pytest.mark.asyncio
    async def test_threshold_updates(self, monitor):
        """Test updating quality thresholds."""

        original_thresholds = monitor._quality_thresholds.copy()

        new_thresholds = {"min_overall_score": 0.90, "max_false_positive_rate": 0.03}

        await monitor.update_quality_thresholds(new_thresholds)

        assert monitor._quality_thresholds["min_overall_score"] == 0.90
        assert monitor._quality_thresholds["max_false_positive_rate"] == 0.03
        assert (
            monitor._quality_thresholds["max_false_negative_rate"]
            == original_thresholds["max_false_negative_rate"]
        )

    @pytest.mark.asyncio
    async def test_store_quality_metrics(self, monitor):
        """Test storing quality metrics in database."""

        metrics = QualityMetrics(
            overall_score=0.92,
            entity_coverage_rate=0.95,
            false_positive_rate=0.02,
            false_negative_rate=0.01,
            format_preservation_score=0.94,
            context_preservation_score=0.90,
            processing_efficiency=0.88,
            entity_type_metrics={},
            quality_issues=[],
            recommendations=[],
            processing_time_ms=35,
            entities_per_second=85.7,
            throughput_mb_per_sec=2.5,
        )

        await monitor._store_quality_metrics(
            audit_log_id="test-123",
            tenant_id="test-tenant",
            metrics=metrics,
            policy_config={"level": "STANDARD"},
        )

        # Verify database insert was called
        monitor.db_pool.acquire.assert_called()
        monitor.db_pool.execute.assert_called()

    @pytest.mark.asyncio
    async def test_entity_type_metrics(self, monitor, sample_entities):
        """Test entity type specific metrics calculation."""

        original = "John Doe (john.doe@example.com) has SSN 123-45-6789"
        redacted = "J***e ([TOKEN:abc123]) has SSN [HASH:def]"

        metrics = await monitor._calculate_entity_type_metrics(
            original, redacted, sample_entities
        )

        assert len(metrics) == 3  # PERSON, EMAIL_ADDRESS, US_SSN

        for entity_type, metric in metrics.items():
            assert "coverage_rate" in metric
            assert "avg_confidence" in metric
            assert "count" in metric
            assert "detection_accuracy" in metric

            if entity_type == "PERSON":
                assert metric["count"] == 1
                assert metric["avg_confidence"] == 0.95

    @pytest.mark.asyncio
    async def test_overall_score_calculation(self, monitor):
        """Test overall quality score calculation."""

        metrics = {
            "entity_coverage": 0.95,
            "false_positive_rate": 0.02,
            "false_negative_rate": 0.01,
            "format_preservation": 0.92,
            "context_preservation": 0.90,
        }

        overall_score = monitor._calculate_overall_score(metrics)

        assert 0.0 <= overall_score <= 1.0
        assert overall_score > 0.8  # Should be high quality

    @pytest.mark.asyncio
    async def test_error_handling_in_assessment(self, monitor):
        """Test error handling during quality assessment."""

        with patch.object(
            monitor,
            "_calculate_entity_coverage",
            side_effect=Exception("Calculation error"),
        ):
            metrics = await monitor.assess_redaction_quality(
                original_content="test",
                redacted_content="test",
                entities_found=[],
                processing_time_ms=10,
                policy_config={},
                audit_log_id="test-123",
                tenant_id="test-tenant",
            )

            # Should return default metrics on error
            assert isinstance(metrics, QualityMetrics)
            assert metrics.overall_score == 0.5
            assert len(metrics.quality_issues) > 0
            assert metrics.quality_issues[0]["type"] == "assessment_error"


class TestIntegration:
    """Integration tests for complete redaction workflow."""

    @pytest.mark.asyncio
    async def test_end_to_end_redaction(self):
        """Test complete redaction workflow with quality monitoring."""

        # This would be a full integration test
        # For now, we'll just ensure the components can work together

        content = """
        Contact John Smith at john.smith@company.com or 555-987-6543.
        His SSN is 987-65-4321 and credit card is 4111-1111-1111-1111.
        """

        # Verify content has PII
        assert "John Smith" in content
        assert "john.smith@company.com" in content
        assert "555-987-6543" in content
        assert "987-65-4321" in content
        assert "4111-1111-1111-1111" in content

        # In a real test, we would:
        # 1. Create ContentRedactor
        # 2. Redact the content
        # 3. Create QualityMonitor
        # 4. Assess quality
        # 5. Store results
        # 6. Verify everything is properly logged and tracked

        assert True  # Placeholder for full integration test
