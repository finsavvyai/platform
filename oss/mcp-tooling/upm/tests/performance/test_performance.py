"""
Performance tests for the Universal Dependency Platform.

Tests for API performance, database performance, ML model performance,
and monitoring system performance.
"""

import pytest
import asyncio
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np

from fastapi.testclient import TestClient
from udp.api.main import create_app
from udp.ml.models import RiskPredictionModel, ModelManager
from udp.monitoring.monitor import SystemMonitor, MonitoringConfig
from udp.monitoring.metrics import MetricsCollector


class TestAPIPerformance:
    """Test API performance."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        app = create_app()
        return TestClient(app)
    
    def test_auth_performance(self, client):
        """Test authentication performance."""
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        
        # Test registration performance
        start_time = time.time()
        response = client.post("/api/v1/auth/register", json=user_data)
        registration_time = time.time() - start_time
        
        assert response.status_code == 201
        assert registration_time < 1.0  # Should complete within 1 second
        
        # Test login performance
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        
        start_time = time.time()
        response = client.post("/api/v1/auth/login", json=login_data)
        login_time = time.time() - start_time
        
        assert response.status_code == 200
        assert login_time < 0.5  # Should complete within 0.5 seconds
    
    def test_concurrent_requests(self, client):
        """Test concurrent request handling."""
        # Register and login
        user_data = {
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpassword123",
            "full_name": "Test User"
        }
        client.post("/api/v1/auth/register", json=user_data)
        
        login_data = {
            "username": "testuser",
            "password": "testpassword123"
        }
        login_response = client.post("/api/v1/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        def make_request():
            """Make a single request."""
            start_time = time.time()
            response = client.get("/api/v1/organizations", headers=headers)
            end_time = time.time()
            return {
                "status_code": response.status_code,
                "response_time": end_time - start_time
            }
        
        # Test with 10 concurrent requests
        num_requests = 10
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(num_requests)]
            results = [future.result() for future in as_completed(futures)]
        
        # All requests should succeed
        assert all(result["status_code"] == 200 for result in results)
        
        # Response times should be reasonable
        response_times = [result["response_time"] for result in results]
        avg_response_time = statistics.mean(response_times)
        max_response_time = max(response_times)
        
        assert avg_response_time < 1.0  # Average should be under 1 second
        assert max_response_time < 2.0  # Max should be under 2 seconds


class TestMLModelPerformance:
    """Test ML model performance."""
    
    def test_model_training_performance(self):
        """Test model training performance."""
        model = RiskPredictionModel()
        
        # Create training data
        X = np.random.random((1000, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 1000)
        
        # Test training performance
        start_time = time.time()
        metrics = model.train(X, y)
        training_time = time.time() - start_time
        
        assert model.is_trained is True
        assert training_time < 10.0  # Should complete within 10 seconds
        assert metrics.accuracy > 0
        assert metrics.precision > 0
        assert metrics.recall > 0
        assert metrics.f1_score > 0
    
    def test_model_prediction_performance(self):
        """Test model prediction performance."""
        model = RiskPredictionModel()
        
        # Train model first
        X_train = np.random.random((1000, 25))
        y_train = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 1000)
        model.train(X_train, y_train)
        
        # Test single prediction
        X_test = np.random.random((1, 25))
        start_time = time.time()
        result = model.predict(X_test)
        prediction_time = time.time() - start_time
        
        assert result is not None
        assert prediction_time < 0.1  # Should complete within 0.1 seconds
        assert result.confidence > 0
        assert result.model_version == "2.0.0"
        
        # Test batch predictions
        X_batch = np.random.random((100, 25))
        start_time = time.time()
        results = []
        for i in range(100):
            result = model.predict(X_batch[i:i+1])
            results.append(result)
        batch_time = time.time() - start_time
        
        assert len(results) == 100
        assert batch_time < 5.0  # Should complete within 5 seconds
        assert batch_time / 100 < 0.05  # Average should be under 0.05 seconds per prediction


class TestMonitoringPerformance:
    """Test monitoring system performance."""
    
    def test_system_monitor_performance(self):
        """Test system monitor performance."""
        config = MonitoringConfig()
        monitor = SystemMonitor(config)
        
        # Test metrics collection performance
        start_time = time.time()
        metrics = asyncio.run(monitor.collect_metrics())
        collection_time = time.time() - start_time
        
        assert len(metrics) > 0
        assert collection_time < 1.0  # Should complete within 1 second
        
        # Test health check performance
        start_time = time.time()
        health = asyncio.run(monitor.check_health())
        health_time = time.time() - start_time
        
        assert health is not None
        assert health.service == "system"
        assert health_time < 0.5  # Should complete within 0.5 seconds
    
    def test_metrics_collector_performance(self):
        """Test metrics collector performance."""
        collector = MetricsCollector()
        
        # Test counter operations
        start_time = time.time()
        for i in range(1000):
            collector.increment_counter("test.counter", 1.0)
        counter_time = time.time() - start_time
        
        assert counter_time < 0.1  # Should complete within 0.1 seconds
        assert collector.counters["test.counter"] == 1000.0
        
        # Test gauge operations
        start_time = time.time()
        for i in range(1000):
            collector.set_gauge("test.gauge", float(i))
        gauge_time = time.time() - start_time
        
        assert gauge_time < 0.1  # Should complete within 0.1 seconds
        assert collector.gauges["test.gauge"] == 999.0
        
        # Test histogram operations
        start_time = time.time()
        for i in range(1000):
            collector.record_histogram("test.histogram", float(i))
        histogram_time = time.time() - start_time
        
        assert histogram_time < 0.2  # Should complete within 0.2 seconds
        assert len(collector.histograms["test.histogram"]) == 1000


class TestConcurrentPerformance:
    """Test concurrent performance."""
    
    def test_concurrent_ml_predictions(self):
        """Test concurrent ML predictions."""
        model = RiskPredictionModel()
        
        # Train model first
        X_train = np.random.random((1000, 25))
        y_train = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 1000)
        model.train(X_train, y_train)
        
        def make_prediction():
            """Make a single prediction."""
            X_test = np.random.random((1, 25))
            start_time = time.time()
            result = model.predict(X_test)
            end_time = time.time()
            return {
                "result": result,
                "response_time": end_time - start_time
            }
        
        # Test with 20 concurrent predictions
        num_predictions = 20
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_prediction) for _ in range(num_predictions)]
            results = [future.result() for future in as_completed(futures)]
        
        # All predictions should succeed
        assert len(results) == num_predictions
        assert all(result["result"] is not None for result in results)
        
        # Response times should be reasonable
        response_times = [result["response_time"] for result in results]
        avg_response_time = statistics.mean(response_times)
        max_response_time = max(response_times)
        
        assert avg_response_time < 0.1  # Average should be under 0.1 seconds
        assert max_response_time < 0.5  # Max should be under 0.5 seconds
    
    def test_concurrent_metrics_collection(self):
        """Test concurrent metrics collection."""
        collector = MetricsCollector()
        
        def collect_metrics():
            """Collect metrics."""
            start_time = time.time()
            for i in range(100):
                collector.increment_counter("test.counter", 1.0)
                collector.set_gauge("test.gauge", float(i))
                collector.record_histogram("test.histogram", float(i))
            end_time = time.time()
            return end_time - start_time
        
        # Test with 10 concurrent metric collections
        num_collections = 10
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(collect_metrics) for _ in range(num_collections)]
            results = [future.result() for future in as_completed(futures)]
        
        # All collections should complete
        assert len(results) == num_collections
        
        # Response times should be reasonable
        avg_time = statistics.mean(results)
        max_time = max(results)
        
        assert avg_time < 0.5  # Average should be under 0.5 seconds
        assert max_time < 1.0  # Max should be under 1 second
        
        # Check that metrics were collected correctly
        assert collector.counters["test.counter"] == 1000.0  # 100 * 10
        assert len(collector.histograms["test.histogram"]) == 1000  # 100 * 10


class TestScalability:
    """Test system scalability."""
    
    def test_large_dataset_handling(self):
        """Test handling of large datasets."""
        model = RiskPredictionModel()
        
        # Test with large training dataset
        X = np.random.random((10000, 25))
        y = np.random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"], 10000)
        
        start_time = time.time()
        metrics = model.train(X, y)
        training_time = time.time() - start_time
        
        assert model.is_trained is True
        assert training_time < 60.0  # Should complete within 60 seconds
        assert metrics.accuracy > 0
        
        # Test predictions on large dataset
        X_test = np.random.random((1000, 25))
        start_time = time.time()
        results = []
        for i in range(1000):
            result = model.predict(X_test[i:i+1])
            results.append(result)
        prediction_time = time.time() - start_time
        
        assert len(results) == 1000
        assert prediction_time < 30.0  # Should complete within 30 seconds
        assert all(result is not None for result in results)
    
    def test_high_frequency_metrics(self):
        """Test high frequency metrics collection."""
        collector = MetricsCollector()
        
        # Test high frequency counter increments
        start_time = time.time()
        for i in range(100000):
            collector.increment_counter("high_freq.counter", 1.0)
        counter_time = time.time() - start_time
        
        assert counter_time < 5.0  # Should complete within 5 seconds
        assert collector.counters["high_freq.counter"] == 100000.0
        
        # Test high frequency gauge updates
        start_time = time.time()
        for i in range(100000):
            collector.set_gauge("high_freq.gauge", float(i))
        gauge_time = time.time() - start_time
        
        assert gauge_time < 5.0  # Should complete within 5 seconds
        assert collector.gauges["high_freq.gauge"] == 99999.0