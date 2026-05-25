"""
Comprehensive tests for Advanced Analytics Service
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from sqlalchemy.orm import Session

from app.services.advanced_analytics_service import AdvancedAnalyticsService
from app.models.advanced_analytics import (
    AnalyticsMetric, AnomalyDetection, PredictiveModel,
    PerformanceForecast, IntelligenceReport
)
from app.schemas.advanced_analytics import (
    MetricsCollectionRequest, AnomalyDetectionRequest,
    PredictionRequest, IntelligenceReportRequest
)
from app.core.database import get_db


class TestAdvancedAnalyticsService:
    """Test suite for Advanced Analytics Service"""

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def analytics_service(self, mock_db):
        """Create AdvancedAnalyticsService instance with mocked dependencies"""
        with patch('app.services.advanced_analytics_service.get_db', return_value=mock_db):
            service = AdvancedAnalyticsService()
            return service

    @pytest.fixture
    def sample_metrics_data(self):
        """Sample metrics data for testing"""
        return [
            {
                "metric_name": "cpu_utilization",
                "metric_type": "performance",
                "value": 75.5,
                "unit": "percentage",
                "resource_type": "virtual_machine",
                "resource_id": "vm-001",
                "timestamp": datetime.utcnow(),
                "tags": {"provider": "aws", "region": "us-east-1"}
            },
            {
                "metric_name": "memory_usage",
                "metric_type": "resource",
                "value": 8192,
                "unit": "bytes",
                "resource_type": "virtual_machine",
                "resource_id": "vm-001",
                "timestamp": datetime.utcnow(),
                "tags": {"provider": "aws", "region": "us-east-1"}
            }
        ]

    @pytest.fixture
    def sample_anomaly_data(self):
        """Sample anomaly data for testing"""
        return {
            "metric_id": 1,
            "provider_id": 1,
            "resource_id": "vm-001",
            "anomaly_type": "cpu_spike",
            "severity": "medium",
            "score": 0.85,
            "threshold": 0.7,
            "metric_value": 95.0,
            "expected_value": 45.0,
            "deviation": 50.0,
            "confidence": 0.92,
            "description": "Unusual CPU spike detected"
        }

    class TestMetricsCollection:
        """Test metrics collection functionality"""

        @pytest.mark.asyncio
        async def test_collect_metrics_success(self, analytics_service, mock_db, sample_metrics_data):
            """Test successful metrics collection"""
            # Mock database operations
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            # Mock multi-cloud service
            with patch.object(analytics_service, '_collect_aws_metrics', return_value=sample_metrics_data[:1]), \
                 patch.object(analytics_service, '_collect_azure_metrics', return_value=[]), \
                 patch.object(analytics_service, '_collect_gcp_metrics', return_value=[]), \
                 patch.object(analytics_service, '_collect_cloudflare_metrics', return_value=[]):

                request = MetricsCollectionRequest(
                    providers=["aws"],
                    metrics=["cpu_utilization", "memory_usage"],
                    time_range="1h"
                )

                result = await analytics_service.collect_metrics(request, tenant_id=1)

                assert result["success"] is True
                assert result["metrics_collected"] == 1
                assert "collection_id" in result
                assert len(result["provider_results"]) > 0

        @pytest.mark.asyncio
        async def test_collect_metrics_multiple_providers(self, analytics_service, mock_db):
            """Test metrics collection from multiple providers"""
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            aws_metrics = [{"metric_name": "cpu_utilization", "value": 80.0, "timestamp": datetime.utcnow()}]
            azure_metrics = [{"metric_name": "memory_usage", "value": 4096, "timestamp": datetime.utcnow()}]

            with patch.object(analytics_service, '_collect_aws_metrics', return_value=aws_metrics), \
                 patch.object(analytics_service, '_collect_azure_metrics', return_value=azure_metrics), \
                 patch.object(analytics_service, '_collect_gcp_metrics', return_value=[]), \
                 patch.object(analytics_service, '_collect_cloudflare_metrics', return_value=[]):

                request = MetricsCollectionRequest(
                    providers=["aws", "azure"],
                    metrics=["cpu_utilization", "memory_usage"],
                    time_range="1h"
                )

                result = await analytics_service.collect_metrics(request, tenant_id=1)

                assert result["success"] is True
                assert result["metrics_collected"] == 2
                assert len(result["provider_results"]) == 2

        @pytest.mark.asyncio
        async def test_collect_metrics_with_error(self, analytics_service, mock_db):
            """Test metrics collection with provider errors"""
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            with patch.object(analytics_service, '_collect_aws_metrics', side_effect=Exception("AWS API Error")):
                request = MetricsCollectionRequest(
                    providers=["aws"],
                    metrics=["cpu_utilization"],
                    time_range="1h"
                )

                result = await analytics_service.collect_metrics(request, tenant_id=1)

                assert result["success"] is True  # Overall success despite partial failures
                assert result["metrics_collected"] == 0
                assert "errors" in result
                assert len(result["errors"]) > 0

        def test_collect_aws_metrics(self, analytics_service):
            """Test AWS metrics collection"""
            with patch('boto3.client') as mock_boto:
                mock_cloudwatch = Mock()
                mock_boto.return_value = mock_cloudwatch

                # Mock CloudWatch response
                mock_cloudwatch.get_metric_statistics.return_value = {
                    'Datapoints': [
                        {
                            'Timestamp': datetime.utcnow(),
                            'Average': 75.5,
                            'Unit': 'Percent'
                        }
                    ]
                }

                result = analytics_service._collect_aws_metrics(
                    metrics=["cpu_utilization"],
                    time_range="1h",
                    tenant_id=1
                )

                assert len(result) > 0
                assert result[0]["metric_name"] == "cpu_utilization"
                assert result[0]["value"] == 75.5

        def test_collect_cloudflare_metrics(self, analytics_service):
            """Test Cloudflare metrics collection"""
            with patch('aiohttp.ClientSession.get') as mock_get:
                mock_response = Mock()
                mock_response.json = AsyncMock(return_value={
                    "result": {
                        "zones": [
                            {
                                "requests": 1000000,
                                "bandwidth": 5000000000,
                                "threats": 5000
                            }
                        ]
                    }
                })
                mock_get.return_value.__aenter__.return_value = mock_response

                result = analytics_service._collect_cloudflare_metrics(
                    metrics=["requests", "bandwidth"],
                    time_range="1h",
                    tenant_id=1
                )

                assert len(result) > 0
                assert any(m["metric_name"] == "requests" for m in result)

    class TestAnomalyDetection:
        """Test anomaly detection functionality"""

        @pytest.mark.asyncio
        async def test_detect_anomalies_statistical(self, analytics_service, mock_db, sample_metrics_data):
            """Test statistical anomaly detection"""
            # Mock existing metrics
            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = sample_metrics_data
            mock_db.query.return_value = mock_query

            # Mock database save operations
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            request = AnomalyDetectionRequest(
                analysis_type="statistical",
                sensitivity="medium",
                metrics=["cpu_utilization"]
            )

            result = await analytics_service.detect_anomalies(request, tenant_id=1)

            assert result["success"] is True
            assert result["analysis_type"] == "statistical"
            assert "anomalies_detected" in result
            assert "analysis_id" in result

        @pytest.mark.asyncio
        async def test_detect_anomalies_ml_isolation_forest(self, analytics_service, mock_db):
            """Test ML-based anomaly detection using Isolation Forest"""
            # Generate sample data for ML testing
            sample_data = []
            for i in range(100):
                sample_data.append({
                    "metric_name": "cpu_utilization",
                    "value": 50.0 + (i % 20),  # Normal range 50-70
                    "timestamp": datetime.utcnow() - timedelta(hours=i)
                })

            # Add some anomalous data points
            sample_data.extend([
                {"metric_name": "cpu_utilization", "value": 95.0, "timestamp": datetime.utcnow()},
                {"metric_name": "cpu_utilization", "value": 5.0, "timestamp": datetime.utcnow()}
            ])

            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = sample_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            request = AnomalyDetectionRequest(
                analysis_type="ml_isolation_forest",
                sensitivity="medium",
                metrics=["cpu_utilization"]
            )

            result = await analytics_service.detect_anomalies(request, tenant_id=1)

            assert result["success"] is True
            assert result["analysis_type"] == "ml_isolation_forest"
            assert result["anomalies_detected"] >= 0

        @pytest.mark.asyncio
        async def test_detect_anomalies_comprehensive(self, analytics_service, mock_db, sample_metrics_data):
            """Test comprehensive anomaly detection"""
            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = sample_metrics_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            request = AnomalyDetectionRequest(
                analysis_type="comprehensive",
                sensitivity="high",
                metrics=["cpu_utilization", "memory_usage"]
            )

            result = await analytics_service.detect_anomalies(request, tenant_id=1)

            assert result["success"] is True
            assert result["analysis_type"] == "comprehensive"
            assert "anomalies_detected" in result
            assert "performance_impact" in result

        def test_calculate_statistical_anomaly(self, analytics_service):
            """Test statistical anomaly calculation"""
            # Normal data around mean 50
            normal_values = [48, 49, 50, 51, 52, 49, 50, 51]

            # Test with normal value
            score = analytics_service._calculate_statistical_anomaly(50.0, normal_values)
            assert score < 0.5  # Should not be anomalous

            # Test with anomalous value
            score = analytics_service._calculate_statistical_anomaly(95.0, normal_values)
            assert score > 0.5  # Should be anomalous

    class TestPredictiveModeling:
        """Test predictive modeling functionality"""

        @pytest.mark.asyncio
        async def test_generate_predictions(self, analytics_service, mock_db, sample_metrics_data):
            """Test prediction generation"""
            # Mock historical metrics data
            historical_data = []
            for i in range(30):  # 30 days of data
                historical_data.append({
                    "metric_name": "cpu_utilization",
                    "value": 50.0 + (i % 10) + (i * 0.5),  # Slight upward trend
                    "timestamp": datetime.utcnow() - timedelta(days=30-i)
                })

            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = historical_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            request = PredictionRequest(
                model_type="time_series",
                target_metrics=["cpu_utilization"],
                forecast_horizon=24  # 24 hours
            )

            result = await analytics_service.generate_predictions(request, tenant_id=1)

            assert result["success"] is True
            assert result["model_type"] == "time_series"
            assert "predictions" in result
            assert len(result["predictions"]) > 0
            assert "model_accuracy" in result

        @pytest.mark.asyncio
        async def test_train_predictive_model(self, analytics_service, mock_db):
            """Test predictive model training"""
            # Generate training data
            training_data = []
            for i in range(100):
                training_data.append({
                    "metric_name": "cpu_utilization",
                    "value": 50.0 + (i % 20) + (i * 0.1),
                    "timestamp": datetime.utcnow() - timedelta(hours=100-i)
                })

            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = training_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            model = await analytics_service._train_predictive_model(
                model_type="random_forest",
                target_metric="cpu_utilization",
                tenant_id=1
            )

            assert model is not None
            assert model.model_type == "random_forest"
            assert model.target_metric == "cpu_utilization"
            assert model.status in ["training", "trained", "ready"]

        def test_prepare_time_series_data(self, analytics_service):
            """Test time series data preparation"""
            # Create sample time series data
            time_series_data = []
            base_time = datetime.utcnow() - timedelta(days=10)

            for i in range(240):  # 10 days of hourly data
                time_series_data.append({
                    "metric_name": "cpu_utilization",
                    "value": 50.0 + (i % 10) + (i * 0.01),
                    "timestamp": base_time + timedelta(hours=i)
                })

            X, y = analytics_service._prepare_time_series_data(
                time_series_data,
                window_size=24,
                forecast_horizon=6
            )

            assert X is not None
            assert y is not None
            assert len(X) > 0
            assert len(y) > 0
            assert X.shape[1] == 24  # window_size

    class TestIntelligenceReporting:
        """Test intelligence report generation"""

        @pytest.mark.asyncio
        async def test_generate_intelligence_report(self, analytics_service, mock_db, sample_metrics_data):
            """Test intelligence report generation"""
            # Mock metrics data
            mock_metrics_query = Mock()
            mock_metrics_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = sample_metrics_data
            mock_db.query.return_value = mock_metrics_query

            # Mock anomalies data
            anomalies_data = [
                AnomalyDetection(
                    id=1,
                    anomaly_type="cpu_spike",
                    severity="medium",
                    score=0.8,
                    metric_name="cpu_utilization",
                    resource_type="virtual_machine",
                    description="CPU utilization spike detected"
                )
            ]
            mock_anomalies_query = Mock()
            mock_anomalies_query.filter.return_value.all.return_value = anomalies_data
            mock_db.query.return_value = mock_anomalies_query

            # Mock predictions data
            predictions_data = [
                PerformanceForecast(
                    id=1,
                    metric_name="cpu_utilization",
                    forecast_type="time_series",
                    forecast_horizon=24,
                    forecast_values={"next_24h": [65.0, 68.0, 70.0, 72.0]},
                    accuracy=0.85
                )
            ]
            mock_predictions_query = Mock()
            mock_predictions_query.filter.return_value.all.return_value = predictions_data
            mock_db.query.return_value = mock_predictions_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            request = IntelligenceReportRequest(
                report_type="performance",
                analysis_period="7d",
                include_charts=True,
                include_recommendations=True
            )

            result = await analytics_service.generate_intelligence_report(request, tenant_id=1)

            assert result["success"] is True
            assert result["report_type"] == "performance"
            assert "report_id" in result
            assert "summary" in result
            assert "key_insights" in result
            assert "recommendations" in result

        @pytest.mark.asyncio
        async def test_generate_performance_report(self, analytics_service, mock_db, sample_metrics_data):
            """Test performance-specific report generation"""
            # Mock performance metrics
            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = sample_metrics_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            report = await analytics_service._generate_performance_report(
                tenant_id=1,
                analysis_period="7d",
                include_charts=True
            )

            assert report is not None
            assert report.report_type == "performance"
            assert len(report.key_insights) > 0
            assert len(report.recommendations) > 0
            assert report.total_metrics_analyzed > 0

        @pytest.mark.asyncio
        async def test_generate_security_report(self, analytics_service, mock_db):
            """Test security-specific report generation"""
            # Mock security anomalies
            security_anomalies = [
                AnomalyDetection(
                    id=1,
                    anomaly_type="failed_login",
                    severity="high",
                    score=0.9,
                    metric_name="login_failures",
                    resource_type="authentication",
                    description="Unusual number of failed login attempts"
                )
            ]
            mock_query = Mock()
            mock_query.filter.return_value.all.return_value = security_anomalies
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            report = await analytics_service._generate_security_report(
                tenant_id=1,
                analysis_period="7d",
                include_charts=True
            )

            assert report is not None
            assert report.report_type == "security"
            assert report.anomalies_detected > 0
            assert len(report.key_insights) > 0

        def test_generate_performance_insights(self, analytics_service, sample_metrics_data):
            """Test performance insights generation"""
            insights = analytics_service._generate_performance_insights(sample_metrics_data, [])

            assert len(insights) > 0
            assert all("title" in insight for insight in insights)
            assert all("description" in insight for insight in insights)
            assert all("significance" in insight for insight in insights)

        def test_generate_recommendations(self, analytics_service, sample_metrics_data):
            """Test recommendations generation"""
            # Create anomalies data
            anomalies = [
                {
                    "anomaly_type": "cpu_spike",
                    "severity": "high",
                    "metric_name": "cpu_utilization",
                    "resource_type": "virtual_machine"
                }
            ]

            recommendations = analytics_service._generate_recommendations(sample_metrics_data, anomalies)

            assert len(recommendations) > 0
            assert all("action" in rec for rec in recommendations)
            assert all("priority" in rec for rec in recommendations)
            assert all("impact" in rec for rec in recommendations)

    class TestIntegration:
        """Integration tests for the complete analytics pipeline"""

        @pytest.mark.asyncio
        async def test_complete_analytics_pipeline(self, analytics_service, mock_db):
            """Test the complete analytics pipeline from metrics collection to reporting"""
            # Mock all database operations
            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            # Mock metrics collection
            with patch.object(analytics_service, '_collect_aws_metrics', return_value=[
                {
                    "metric_name": "cpu_utilization",
                    "value": 85.0,
                    "metric_type": "performance",
                    "unit": "percentage",
                    "resource_type": "virtual_machine",
                    "resource_id": "vm-001",
                    "timestamp": datetime.utcnow(),
                    "tags": {"provider": "aws"}
                }
            ]):
                # Step 1: Collect metrics
                collection_request = MetricsCollectionRequest(
                    providers=["aws"],
                    metrics=["cpu_utilization"],
                    time_range="1h"
                )
                collection_result = await analytics_service.collect_metrics(collection_request, tenant_id=1)
                assert collection_result["success"] is True

            # Mock metrics query for anomaly detection
            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
                {
                    "metric_name": "cpu_utilization",
                    "value": 85.0,
                    "timestamp": datetime.utcnow()
                }
            ]
            mock_db.query.return_value = mock_query

            # Step 2: Detect anomalies
            anomaly_request = AnomalyDetectionRequest(
                analysis_type="statistical",
                sensitivity="medium",
                metrics=["cpu_utilization"]
            )
            anomaly_result = await analytics_service.detect_anomalies(anomaly_request, tenant_id=1)
            assert anomaly_result["success"] is True

            # Mock data for prediction
            historical_data = []
            for i in range(50):
                historical_data.append({
                    "metric_name": "cpu_utilization",
                    "value": 50.0 + (i % 15),
                    "timestamp": datetime.utcnow() - timedelta(hours=50-i)
                })
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = historical_data

            # Step 3: Generate predictions
            prediction_request = PredictionRequest(
                model_type="time_series",
                target_metrics=["cpu_utilization"],
                forecast_horizon=12
            )
            prediction_result = await analytics_service.generate_predictions(prediction_request, tenant_id=1)
            assert prediction_result["success"] is True

            # Mock data for report generation
            mock_db.query.return_value.filter.return_value.all.return_value = []

            # Step 4: Generate intelligence report
            report_request = IntelligenceReportRequest(
                report_type="performance",
                analysis_period="24h",
                include_charts=True,
                include_recommendations=True
            )
            report_result = await analytics_service.generate_intelligence_report(report_request, tenant_id=1)
            assert report_result["success"] is True

            # Verify the complete pipeline worked
            assert all([
                collection_result["success"],
                anomaly_result["success"],
                prediction_result["success"],
                report_result["success"]
            ])

        @pytest.mark.asyncio
        async def test_error_handling_and_recovery(self, analytics_service, mock_db):
            """Test error handling and recovery mechanisms"""
            # Test with database errors
            mock_db.commit.side_effect = Exception("Database connection lost")

            with patch.object(analytics_service, '_collect_aws_metrics', return_value=[]):
                collection_request = MetricsCollectionRequest(
                    providers=["aws"],
                    metrics=["cpu_utilization"],
                    time_range="1h"
                )

                # Should handle database errors gracefully
                result = await analytics_service.collect_metrics(collection_request, tenant_id=1)
                assert "error" in result or result.get("success") is False

        @pytest.mark.asyncio
        async def test_performance_with_large_datasets(self, analytics_service, mock_db):
            """Test performance with large datasets"""
            # Generate large dataset
            large_dataset = []
            for i in range(1000):  # 1000 metrics
                large_dataset.append({
                    "metric_name": "cpu_utilization",
                    "metric_type": "performance",
                    "value": 50.0 + (i % 40),
                    "unit": "percentage",
                    "resource_type": "virtual_machine",
                    "resource_id": f"vm-{i % 10}",
                    "timestamp": datetime.utcnow() - timedelta(minutes=i),
                    "tags": {"provider": "aws"}
                })

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            with patch.object(analytics_service, '_collect_aws_metrics', return_value=large_dataset):
                collection_request = MetricsCollectionRequest(
                    providers=["aws"],
                    metrics=["cpu_utilization"],
                    time_range="24h"
                )

                import time
                start_time = time.time()

                result = await analytics_service.collect_metrics(collection_request, tenant_id=1)

                end_time = time.time()
                processing_time = end_time - start_time

                assert result["success"] is True
                assert result["metrics_collected"] == 1000
                # Should complete within reasonable time (adjust threshold as needed)
                assert processing_time < 30.0  # 30 seconds max for 1000 metrics

    class TestModelAccuracyAndValidation:
        """Test machine learning model accuracy and validation"""

        @pytest.mark.asyncio
        async def test_model_accuracy_validation(self, analytics_service, mock_db):
            """Test machine learning model accuracy validation"""
            # Create realistic training data with known patterns
            training_data = []
            for i in range(200):
                # Simulate daily CPU pattern with weekly trend
                hour_of_day = i % 24
                day_of_week = (i // 24) % 7

                # Base CPU with daily pattern
                base_cpu = 40.0 + 20.0 * (hour_of_day / 24.0)

                # Add weekly variation
                weekly_variation = 10.0 * math.sin(2 * math.pi * day_of_week / 7)

                # Add noise
                noise = random.gauss(0, 5)

                value = base_cpu + weekly_variation + noise
                value = max(0, min(100, value))  # Clamp between 0-100

                training_data.append({
                    "metric_name": "cpu_utilization",
                    "value": value,
                    "timestamp": datetime.utcnow() - timedelta(hours=200-i)
                })

            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.all.return_value = training_data
            mock_db.query.return_value = mock_query

            mock_db.add = Mock()
            mock_db.commit = Mock()
            mock_db.refresh = Mock()

            # Train model
            model = await analytics_service._train_predictive_model(
                model_type="random_forest",
                target_metric="cpu_utilization",
                tenant_id=1
            )

            # Validate model was created with reasonable accuracy
            assert model is not None
            assert model.accuracy is not None
            assert model.accuracy > 0.3  # Should perform better than random
            assert model.mae is not None
            assert model.mse is not None

        def test_cross_validation(self, analytics_service):
            """Test model cross-validation"""
            # Generate synthetic data with known pattern
            X = []
            y = []

            for i in range(100):
                # Create features: hour of day, day of week, lag values
                hour_of_day = i % 24
                day_of_week = (i // 24) % 7

                # Create time series with trend and seasonality
                trend = i * 0.1
                seasonal = 10 * math.sin(2 * math.pi * i / 24)
                noise = random.gauss(0, 2)

                target = 50 + trend + seasonal + noise

                features = [hour_of_day, day_of_week, trend, seasonal]

                X.append(features)
                y.append(target)

            X = np.array(X)
            y = np.array(y)

            # Test cross-validation function
            cv_scores = analytics_service._cross_validate_model(X, y, cv_folds=5)

            assert len(cv_scores) == 5
            assert all(0 <= score <= 1 for score in cv_scores)
            assert np.mean(cv_scores) > 0.3  # Should perform better than random

        def test_feature_importance_analysis(self, analytics_service):
            """Test feature importance analysis"""
            # Generate data with clear feature importance
            X = []
            y = []

            for i in range(100):
                # Feature 1 is most important (strong correlation with target)
                feature1 = i

                # Feature 2 is moderately important
                feature2 = math.sin(i / 10) * 10

                # Feature 3 is least important (random noise)
                feature3 = random.gauss(0, 1)

                target = 2 * feature1 + 0.5 * feature2 + random.gauss(0, 5)

                X.append([feature1, feature2, feature3])
                y.append(target)

            X = np.array(X)
            y = np.array(y)

            feature_importance = analytics_service._analyze_feature_importance(X, y)

            assert len(feature_importance) == 3
            assert feature_importance[0] > feature_importance[1]  # feature1 > feature2
            assert feature_importance[1] > feature_importance[2]  # feature2 > feature3


# Import required modules for the test
import math
import random
import numpy as np