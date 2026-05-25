"""
Tests for Context Quality Monitoring Service
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.context_quality_monitor import (
    ContextQualityMonitor,
    QualityMetrics,
    QualityAssessment,
    QualityDimension,
    QualityThreshold,
    QualityAlert,
    QualityReport,
    QualityTrend,
    QualityImprovement,
)
from app.models.document import DocumentChunk


@pytest.fixture
def context_quality_monitor():
    """Context quality monitor instance"""
    return ContextQualityMonitor()


@pytest.fixture
def sample_chunks():
    """Sample document chunks for testing"""
    chunks = []

    # Create chunks with varying quality
    quality_levels = ["high", "medium", "low"]
    topics = ["machine learning", "deep learning", "neural networks", "AI ethics"]

    for i in range(20):
        quality = quality_levels[i % len(quality_levels)]
        topic = topics[i % len(topics)]

        # Content quality varies
        if quality == "high":
            content = (
                f"Comprehensive explanation of {topic} with detailed examples, citations, and structured information. "
                * 5
            )
            rating = 4.5 + (i % 2) * 0.3
            citations = i * 2
        elif quality == "medium":
            content = f"Basic information about {topic} with some details. " * 3
            rating = 3.0 + (i % 3) * 0.5
            citations = i
        else:
            content = f"Brief mention of {topic}."
            rating = 1.5 + (i % 2) * 0.5
            citations = 0

        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 5}",
            content=content,
            chunk_index=i,
            start_pos=i * 200,
            end_pos=(i + 1) * 200,
            token_count=50 + len(content.split()),
            metadata={
                "source_type": "peer_reviewed" if i % 3 == 0 else "blog",
                "topic": topic,
                "quality_level": quality,
                "rating": rating,
                "citation_count": citations,
                "date": datetime.now() - timedelta(days=i),
                "author": f"author_{i % 5}",
                "readability_score": 70 + (i % 4) * 5,
                "factual_accuracy": 0.6 + (i % 5) * 0.1,
            },
            embedding=np.random.rand(384).tolist(),
            created_at=datetime.now() - timedelta(hours=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def quality_thresholds():
    """Sample quality thresholds"""
    return {
        QualityDimension.RELEVANCE: QualityThreshold(minimum=0.7, target=0.85),
        QualityDimension.ACCURACY: QualityThreshold(minimum=0.8, target=0.95),
        QualityDimension.COMPLETENESS: QualityThreshold(minimum=0.6, target=0.8),
        QualityDimension.CLARITY: QualityThreshold(minimum=0.7, target=0.9),
        QualityDimension.CURRENCY: QualityThreshold(minimum=0.5, target=0.8),
        QualityDimension.AUTHORITY: QualityThreshold(minimum=0.6, target=0.85),
        QualityDimension.DIVERSITY: QualityThreshold(minimum=0.5, target=0.75),
        QualityDimension.COHERENCE: QualityThreshold(minimum=0.7, target=0.9),
    }


class TestContextQualityMonitor:
    """Test cases for ContextQualityMonitor"""

    @pytest.mark.asyncio
    async def test_assess_context_quality_overall(
        self, context_quality_monitor, sample_chunks
    ):
        """Test overall context quality assessment"""
        # Execute
        assessment = await context_quality_monitor.assess_context_quality(
            chunks=sample_chunks,
            query="machine learning algorithms",
            dimensions=list(QualityDimension),
        )

        # Verify
        assert isinstance(assessment, QualityAssessment)
        assert assessment.overall_score is not None
        assert 0 <= assessment.overall_score <= 1
        assert len(assessment.dimension_scores) > 0
        assert assessment.assessment_time is not None
        assert assessment.chunk_count == len(sample_chunks)

    @pytest.mark.asyncio
    async def test_assess_relevance_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test relevance quality dimension assessment"""
        # Setup
        query = "deep learning neural networks"

        # Execute
        metrics = await context_quality_monitor.assess_relevance(
            chunks=sample_chunks,
            query=query,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.RELEVANCE
        assert 0 <= metrics.score <= 1
        assert metrics.confidence is not None
        assert metrics.details is not None
        assert "query_alignment" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_accuracy_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test accuracy quality dimension assessment"""
        # Execute
        metrics = await context_quality_monitor.assess_accuracy(
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.ACCURACY
        assert 0 <= metrics.score <= 1
        assert "fact_check_score" in metrics.details
        assert "source_reliability" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_completeness_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test completeness quality dimension assessment"""
        # Setup
        expected_topics = ["machine learning", "deep learning", "neural networks"]

        # Execute
        metrics = await context_quality_monitor.assess_completeness(
            chunks=sample_chunks,
            expected_topics=expected_topics,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.COMPLETENESS
        assert 0 <= metrics.score <= 1
        assert "topic_coverage" in metrics.details
        assert "information_depth" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_clarity_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test clarity quality dimension assessment"""
        # Execute
        metrics = await context_quality_monitor.assess_clarity(
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.CLARITY
        assert 0 <= metrics.score <= 1
        assert "readability_score" in metrics.details
        assert "linguistic_complexity" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_currency_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test currency quality dimension assessment"""
        # Setup
        current_date = datetime.now()

        # Execute
        metrics = await context_quality_monitor.assess_currency(
            chunks=sample_chunks,
            reference_date=current_date,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.CURRENCY
        assert 0 <= metrics.score <= 1
        assert "recency_score" in metrics.details
        assert "temporal_relevance" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_authority_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test authority quality dimension assessment"""
        # Execute
        metrics = await context_quality_monitor.assess_authority(
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.AUTHORITY
        assert 0 <= metrics.score <= 1
        assert "source_credibility" in metrics.details
        assert "author_expertise" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_diversity_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test diversity quality dimension assessment"""
        # Execute
        metrics = await context_quality_monitor.assess_diversity(
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.DIVERSITY
        assert 0 <= metrics.score <= 1
        assert "source_variety" in metrics.details
        assert "perspective_diversity" in metrics.details

    @pytest.mark.asyncio
    async def test_assess_coherence_dimension(
        self, context_quality_monitor, sample_chunks
    ):
        """Test coherence quality dimension assessment"""
        # Execute
        metrics = await context_quality_monitor.assess_coherence(
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(metrics, QualityMetrics)
        assert metrics.dimension == QualityDimension.COHERENCE
        assert 0 <= metrics.score <= 1
        assert "narrative_flow" in metrics.details
        assert "logical_consistency" in metrics.details

    @pytest.mark.asyncio
    async def test_quality_threshold_checking(
        self, context_quality_monitor, sample_chunks, quality_thresholds
    ):
        """Test quality threshold checking and alert generation"""
        # Setup
        assessment = QualityAssessment(
            overall_score=0.65,
            dimension_scores={
                QualityDimension.RELEVANCE: 0.9,
                QualityDimension.ACCURACY: 0.75,  # Below threshold
                QualityDimension.COMPLETENESS: 0.55,  # Below threshold
            },
            assessment_time=datetime.now(),
            chunk_count=len(sample_chunks),
        )

        # Execute
        alerts = await context_quality_monitor.check_thresholds(
            assessment=assessment,
            thresholds=quality_thresholds,
        )

        # Verify
        assert isinstance(alerts, list)
        assert len(alerts) == 2  # Two dimensions below threshold

        for alert in alerts:
            assert isinstance(alert, QualityAlert)
            assert alert.severity in ["warning", "critical"]
            assert alert.dimension in [
                QualityDimension.ACCURACY,
                QualityDimension.COMPLETENESS,
            ]
            assert alert.current_score < quality_thresholds[alert.dimension].minimum

    @pytest.mark.asyncio
    async def test_generate_quality_report(
        self, context_quality_monitor, sample_chunks
    ):
        """Test comprehensive quality report generation"""
        # Setup
        assessments = []
        for i in range(5):
            assessment = await context_quality_monitor.assess_context_quality(
                chunks=sample_chunks[i * 4 : (i + 1) * 4],
                query=f"test query {i}",
            )
            assessments.append(assessment)

        # Execute
        report = await context_quality_monitor.generate_quality_report(
            assessments=assessments,
            time_period=timedelta(days=1),
        )

        # Verify
        assert isinstance(report, QualityReport)
        assert report.period_start is not None
        assert report.period_end is not None
        assert len(report.assessments) == 5
        assert report.average_quality_score is not None
        assert report.quality_trends is not None
        assert report.dimension_averages is not None

    @pytest.mark.asyncio
    async def test_quality_trend_analysis(self, context_quality_monitor, sample_chunks):
        """Test quality trend analysis over time"""
        # Setup - Create assessments over time
        assessments = []
        base_score = 0.7

        for i in range(10):
            # Simulate quality changes over time
            score = base_score + (i * 0.02) + (np.random.rand() * 0.1 - 0.05)
            score = max(0, min(1, score))  # Clamp to [0, 1]

            assessment = QualityAssessment(
                overall_score=score,
                dimension_scores={
                    QualityDimension.RELEVANCE: score + 0.1,
                    QualityDimension.ACCURACY: score - 0.05,
                },
                assessment_time=datetime.now() - timedelta(hours=10 - i),
                chunk_count=len(sample_chunks),
            )
            assessments.append(assessment)

        # Execute
        trends = await context_quality_monitor.analyze_quality_trends(
            assessments=assessments,
            dimensions=[QualityDimension.RELEVANCE, QualityDimension.ACCURACY],
        )

        # Verify
        assert isinstance(trends, dict)
        assert len(trends) >= 2

        for dimension, trend in trends.items():
            assert isinstance(trend, QualityTrend)
            assert trend.direction in ["improving", "declining", "stable"]
            assert trend.trend_strength is not None
            assert 0 <= trend.trend_strength <= 1

    @pytest.mark.asyncio
    async def test_quality_improvement_suggestions(
        self, context_quality_monitor, sample_chunks
    ):
        """Test quality improvement suggestions generation"""
        # Setup - Create low-quality assessment
        assessment = QualityAssessment(
            overall_score=0.4,
            dimension_scores={
                QualityDimension.RELEVANCE: 0.5,
                QualityDimension.ACCURACY: 0.6,
                QualityDimension.COMPLETENESS: 0.3,
                QualityDimension.CLARITY: 0.4,
            },
            assessment_time=datetime.now(),
            chunk_count=len(sample_chunks),
        )

        # Execute
        improvements = await context_quality_monitor.suggest_improvements(
            assessment=assessment,
            chunks=sample_chunks,
        )

        # Verify
        assert isinstance(improvements, list)
        assert len(improvements) > 0

        for improvement in improvements:
            assert isinstance(improvement, QualityImprovement)
            assert improvement.dimension is not None
            assert improvement.suggestion is not None
            assert improvement.priority in ["high", "medium", "low"]
            assert improvement.estimated_impact is not None

    @pytest.mark.asyncio
    async def test_batch_quality_assessment(
        self, context_quality_monitor, sample_chunks
    ):
        """Test batch quality assessment for multiple contexts"""
        # Setup
        batch_requests = [
            {
                "chunks": sample_chunks[i * 5 : (i + 1) * 5],
                "query": f"batch query {i}",
                "dimensions": [QualityDimension.RELEVANCE, QualityDimension.ACCURACY],
            }
            for i in range(4)
        ]

        # Execute
        results = await context_quality_monitor.batch_assess_quality(batch_requests)

        # Verify
        assert isinstance(results, list)
        assert len(results) == 4

        for result in results:
            assert isinstance(result, QualityAssessment)
            assert result.overall_score is not None
            assert len(result.dimension_scores) == 2  # Only requested dimensions

    @pytest.mark.asyncio
    async def test_quality_alert_integration(
        self, context_quality_monitor, sample_chunks
    ):
        """Test integration with alerting system"""
        # Setup
        alert_callback = AsyncMock()
        context_quality_monitor.set_alert_callback(alert_callback)

        # Create assessment that triggers alerts
        assessment = QualityAssessment(
            overall_score=0.3,
            dimension_scores={
                QualityDimension.ACCURACY: 0.2,  # Critical
                QualityDimension.CLARITY: 0.4,  # Warning
            },
            assessment_time=datetime.now(),
            chunk_count=len(sample_chunks),
        )

        # Execute
        await context_quality_monitor.evaluate_and_alert(assessment)

        # Verify alert was triggered
        alert_callback.assert_called()
        call_args = alert_callback.call_args[0][0]
        assert isinstance(call_args, list)
        assert len(call_args) >= 1

    @pytest.mark.asyncio
    async def test_quality_benchmarking(self, context_quality_monitor, sample_chunks):
        """Test quality benchmarking against historical data"""
        # Setup
        historical_scores = [0.7, 0.75, 0.72, 0.78, 0.74]

        # Create current assessment
        current_assessment = await context_quality_monitor.assess_context_quality(
            chunks=sample_chunks,
            query="benchmark test",
        )

        # Execute
        benchmark_result = await context_quality_monitor.benchmark_quality(
            current_assessment=current_assessment,
            historical_scores=historical_scores,
        )

        # Verify
        assert "percentile_rank" in benchmark_result
        assert "improvement_from_average" in benchmark_result
        assert "quality_grade" in benchmark_result
        assert 0 <= benchmark_result["percentile_rank"] <= 100

    @pytest.mark.asyncio
    async def test_dimension_weighting(self, context_quality_monitor, sample_chunks):
        """Test custom dimension weighting in quality assessment"""
        # Setup
        custom_weights = {
            QualityDimension.RELEVANCE: 0.4,
            QualityDimension.ACCURACY: 0.3,
            QualityDimension.COMPLETENESS: 0.2,
            QualityDimension.CLARITY: 0.1,
        }

        # Execute
        assessment = await context_quality_monitor.assess_context_quality(
            chunks=sample_chunks,
            query="weighted assessment test",
            dimensions=list(custom_weights.keys()),
            weights=custom_weights,
        )

        # Verify
        assert isinstance(assessment, QualityAssessment)
        assert assessment.overall_score is not None
        assert len(assessment.dimension_scores) == len(custom_weights)

    @pytest.mark.asyncio
    async def test_quality_decay_detection(
        self, context_quality_monitor, sample_chunks
    ):
        """Test detection of quality decay over time"""
        # Setup - Create decaying quality assessments
        assessments = []
        for i in range(10):
            score = 0.9 - (i * 0.05)  # Decaying quality
            assessment = QualityAssessment(
                overall_score=max(0, score),
                dimension_scores={QualityDimension.RELEVANCE: score},
                assessment_time=datetime.now() - timedelta(hours=10 - i),
                chunk_count=len(sample_chunks),
            )
            assessments.append(assessment)

        # Execute
        decay_detected = await context_quality_monitor.detect_quality_decay(
            assessments=assessments,
            decay_threshold=0.1,
        )

        # Verify
        assert decay_detected is True

    @pytest.mark.asyncio
    async def test_quality_monitoring_configuration(self, context_quality_monitor):
        """Test quality monitoring configuration"""
        # Setup
        config = {
            "default_thresholds": {
                QualityDimension.RELEVANCE: 0.7,
                QualityDimension.ACCURACY: 0.8,
            },
            "alert_enabled": True,
            "trend_analysis_window": timedelta(days=7),
            "batch_size": 10,
        }

        # Execute
        context_quality_monitor.configure(config)

        # Verify configuration was applied
        assert context_quality_monitor.config == config

    @pytest.mark.asyncio
    async def test_empty_chunks_handling(self, context_quality_monitor):
        """Test quality assessment with empty chunks"""
        # Execute
        assessment = await context_quality_monitor.assess_context_quality(
            chunks=[],
            query="empty test",
        )

        # Verify graceful handling
        assert isinstance(assessment, QualityAssessment)
        assert assessment.overall_score == 0
        assert assessment.chunk_count == 0

    @pytest.mark.asyncio
    async def test_quality_metrics_persistence(
        self, context_quality_monitor, sample_chunks
    ):
        """Test persistence of quality metrics"""
        # Setup
        mock_storage = AsyncMock()
        context_quality_monitor.set_storage_backend(mock_storage)

        # Create assessment
        assessment = await context_quality_monitor.assess_context_quality(
            chunks=sample_chunks,
            query="persistence test",
        )

        # Execute
        await context_quality_monitor.save_assessment(assessment)

        # Verify
        mock_storage.save.assert_called_once()
        call_args = mock_storage.save.call_args[0][0]
        assert call_args == assessment

    def test_quality_threshold_validation(self):
        """Test quality threshold validation"""
        # Valid threshold
        valid_threshold = QualityThreshold(minimum=0.5, target=0.8)
        assert valid_threshold.is_valid()

        # Invalid threshold - minimum > target
        invalid_threshold = QualityThreshold(minimum=0.9, target=0.7)
        assert not invalid_threshold.is_valid()

        # Invalid threshold - negative values
        invalid_threshold2 = QualityThreshold(minimum=-0.1, target=0.5)
        assert not invalid_threshold2.is_valid()

    @pytest.mark.asyncio
    async def test_multilingual_quality_assessment(self, context_quality_monitor):
        """Test quality assessment for multilingual content"""
        # Setup - Create multilingual chunks
        multilingual_chunks = []
        languages = ["en", "es", "fr"]

        for i, lang in enumerate(languages):
            chunk = DocumentChunk(
                id=f"chunk_{i}",
                document_id=f"doc_{i}",
                content=f"Content about AI in language {lang}",
                chunk_index=i,
                token_count=20,
                metadata={"language": lang},
            )
            multilingual_chunks.append(chunk)

        # Execute
        assessment = await context_quality_monitor.assess_context_quality(
            chunks=multilingual_chunks,
            query="multilingual test",
        )

        # Verify
        assert isinstance(assessment, QualityAssessment)
        assert "language_distribution" in assessment.metadata

    @pytest.mark.asyncio
    async def test_real_time_quality_monitoring(
        self, context_quality_monitor, sample_chunks
    ):
        """Test real-time quality monitoring"""
        # Setup
        quality_updates = []

        async def quality_callback(update):
            quality_updates.append(update)

        context_quality_monitor.subscribe_to_updates(quality_callback)

        # Execute multiple assessments
        for i in range(3):
            assessment = await context_quality_monitor.assess_context_quality(
                chunks=sample_chunks[i * 5 : (i + 1) * 5],
                query=f"real-time test {i}",
            )
            await context_quality_monitor.notify_update(assessment)

        # Verify
        assert len(quality_updates) == 3
        for update in quality_updates:
            assert isinstance(update, QualityAssessment)

    @pytest.mark.asyncio
    async def test_quality_anomaly_detection(
        self, context_quality_monitor, sample_chunks
    ):
        """Test detection of quality anomalies"""
        # Setup - Normal assessments
        normal_assessments = []
        for i in range(10):
            score = 0.75 + (np.random.rand() * 0.1 - 0.05)  # Around 0.75
            assessment = QualityAssessment(
                overall_score=score,
                dimension_scores={QualityDimension.RELEVANCE: score},
                assessment_time=datetime.now() - timedelta(hours=i),
                chunk_count=len(sample_chunks),
            )
            normal_assessments.append(assessment)

        # Add anomalous assessment
        anomalous_assessment = QualityAssessment(
            overall_score=0.1,  # Very low score - anomaly
            dimension_scores={QualityDimension.RELEVANCE: 0.05},
            assessment_time=datetime.now(),
            chunk_count=len(sample_chunks),
        )

        # Execute
        anomalies = await context_quality_monitor.detect_anomalies(
            assessments=normal_assessments + [anomalous_assessment],
            anomaly_threshold=2.0,  # 2 standard deviations
        )

        # Verify
        assert len(anomalies) >= 1
        assert anomalous_assessment in anomalies
