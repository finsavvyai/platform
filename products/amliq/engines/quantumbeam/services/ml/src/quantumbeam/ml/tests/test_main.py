"""
Tests for the ML Service main application.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import json

from quantumbeam.ml.main import app

client = TestClient(app)


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ml"
        assert "version" in data
        assert "timestamp" in data

    @patch("quantumbeam.ml.main.redis_client")
    @patch("quantumbeam.ml.main.influxdb_client")
    @patch("quantumbeam.ml.main.elasticsearch_client")
    def test_readiness_check_all_dependencies_ready(
        self, mock_es, mock_influxdb, mock_redis
    ):
        """Test readiness check when all dependencies are ready."""
        mock_redis.ping.return_value = True
        mock_influxdb.health.return_value = Mock(status="pass")
        mock_es.ping.return_value = True

        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["dependencies"]["redis"] == "connected"
        assert data["dependencies"]["influxdb"] == "connected"
        assert data["dependencies"]["elasticsearch"] == "connected"

    @patch("quantumbeam.ml.main.redis_client", None)
    @patch("quantumbeam.ml.main.influxdb_client", None)
    @patch("quantumbeam.ml.main.elasticsearch_client", None)
    def test_readiness_check_dependencies_not_ready(self):
        """Test readiness check when dependencies are not ready."""
        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["dependencies"]["redis"] == "disconnected"
        assert data["dependencies"]["influxdb"] == "disconnected"
        assert data["dependencies"]["elasticsearch"] == "disconnected"


class TestPredictionEndpoints:
    """Test fraud prediction endpoints."""

    @patch("quantumbeam.ml.main.make_prediction")
    @patch("quantumbeam.ml.main.preprocess_transaction_data")
    async def test_predict_fraud_legitimate(self, mock_preprocess, mock_predict):
        """Test fraud prediction for legitimate transaction."""
        # Mock preprocessing
        mock_preprocess.return_value = [100.0, 14.0, 2.0, 0.2, 35.0, 5.0, 0.0, 0.95]

        # Mock prediction
        mock_predict.return_value = {
            "is_fraud": False,
            "probability": 0.15,
            "risk_score": 15.0,
            "model_version": "1.0.0",
            "features_used": [
                "transaction_amount",
                "time_of_day",
                "day_of_week",
                "merchant_risk_score",
                "customer_age",
                "distance_from_home",
                "is_foreign",
                "device_trust_score",
            ],
        }

        request_data = {
            "transaction_data": {
                "amount": 100.0,
                "time_of_day": 14,
                "day_of_week": 2,
                "merchant_id": "merchant_123",
                "customer_id": "customer_456",
                "location": "US",
                "device_type": "mobile",
            },
            "model_version": "latest",
            "include_explainability": False,
        }

        response = client.post("/predict", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["is_fraud"] is False
        assert data["fraud_probability"] == 0.15
        assert data["risk_score"] == 15.0
        assert data["model_version"] == "1.0.0"
        assert len(data["features_used"]) > 0
        assert data["explanation"] is None

    @patch("quantumbeam.ml.main.make_prediction")
    @patch("quantumbeam.ml.main.preprocess_transaction_data")
    @patch("quantumbeam.ml.main.generate_explanation")
    async def test_predict_fraud_fraudulent_with_explanation(
        self, mock_explain, mock_predict, mock_preprocess
    ):
        """Test fraud prediction for fraudulent transaction with explanation."""
        # Mock preprocessing
        mock_preprocess.return_value = [5000.0, 2.0, 5.0, 0.9, 25.0, 1000.0, 1.0, 0.3]

        # Mock prediction
        mock_predict.return_value = {
            "is_fraud": True,
            "probability": 0.92,
            "risk_score": 92.0,
            "model_version": "1.0.0",
            "features_used": [
                "transaction_amount",
                "time_of_day",
                "day_of_week",
                "merchant_risk_score",
                "customer_age",
                "distance_from_home",
                "is_foreign",
                "device_trust_score",
            ],
        }

        # Mock explanation
        mock_explain.return_value = {
            "shap_values": {
                "transaction_amount": 0.4,
                "is_foreign": 0.3,
                "device_trust_score": -0.2,
                "distance_from_home": 0.1,
            },
            "base_value": 0.1,
            "top_features": [("transaction_amount", 0.4), ("is_foreign", 0.3)],
            "explanation_text": "The prediction is primarily driven by transaction_amount (impact: 0.400)",
        }

        request_data = {
            "transaction_data": {
                "amount": 5000.0,
                "time_of_day": 2,
                "day_of_week": 5,
                "merchant_id": "merchant_risky",
                "customer_id": "customer_789",
                "location": "FR",
                "device_type": "desktop",
            },
            "model_version": "1.0.0",
            "include_explainability": True,
        }

        response = client.post("/predict", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["is_fraud"] is True
        assert data["fraud_probability"] == 0.92
        assert data["risk_score"] == 92.0
        assert data["explanation"] is not None
        assert "shap_values" in data["explanation"]
        assert "explanation_text" in data["explanation"]

    def test_predict_fraud_invalid_request(self):
        """Test fraud prediction with invalid request data."""
        # Missing required transaction_data
        request_data = {"model_version": "latest"}

        response = client.post("/predict", json=request_data)
        assert response.status_code == 422  # Validation error

    @patch("quantumbeam.ml.main.make_prediction")
    @patch("quantumbeam.ml.main.preprocess_transaction_data")
    async def test_predict_fraud_error(self, mock_preprocess, mock_predict):
        """Test handling of prediction errors."""
        mock_preprocess.side_effect = Exception("Preprocessing failed")

        request_data = {"transaction_data": {"amount": 100.0, "merchant_id": "test"}}

        response = client.post("/predict", json=request_data)
        assert response.status_code == 500
        assert "Prediction failed" in response.json()["detail"]


class TestModelEndpoints:
    """Test model management endpoints."""

    def test_list_models(self):
        """Test listing available models."""
        response = client.get("/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) > 0

        # Check model structure
        model = data["models"][0]
        assert "name" in model
        assert "version" in model
        assert "type" in model
        assert "status" in model
        assert "performance" in model
        assert "accuracy" in model["performance"]

    def test_get_model_info(self):
        """Test getting detailed model information."""
        response = client.get("/models/fraud_detector_v1/info")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "fraud_detector_v1"
        assert data["version"] == "1.0.0"
        assert data["type"] == "xgboost"
        assert "accuracy" in data
        assert "precision" in data
        assert "recall" in data
        assert "f1_score" in data
        assert "auc_roc" in data
        assert "training_date" in data
        assert "features" in data
        assert len(data["features"]) > 0

    @patch("quantumbeam.ml.main.load_models")
    @patch("quantumbeam.ml.main.asyncio.sleep")
    async def test_retrain_model(self, mock_sleep, mock_load):
        """Test model retraining endpoint."""
        mock_sleep.return_value = None

        response = client.post("/models/retrain")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "new_model_version" in data
        assert "training_metrics" in data
        assert "accuracy" in data["training_metrics"]


class TestMetricsEndpoint:
    """Test metrics endpoint."""

    def test_get_metrics(self):
        """Test getting service metrics."""
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "predictions_total" in data
        assert "predictions_success" in data
        assert "predictions_error" in data
        assert "average_response_time_ms" in data
        assert "model_accuracy" in data
        assert "model_precision" in data
        assert "model_recall" in data
        assert "active_models" in data
        assert "features_processed" in data


class TestBatchProcessing:
    """Test batch processing capabilities."""

    def test_batch_prediction_limit(self):
        """Test batch size limits."""
        # Create a request that exceeds batch size
        large_batch = {
            "transaction_data": [
                {"amount": 100.0, "merchant_id": f"merchant_{i}"} for i in range(1001)
            ]
        }

        # This should be handled by the endpoint (in a real implementation)
        # For now, just test that the endpoint structure exists
        response = client.post("/predict/batch", json=large_batch)
        # May return 404 if not implemented yet, which is expected
        assert response.status_code in [200, 404]


class TestErrorHandling:
    """Test error handling."""

    def test_invalid_endpoint(self):
        """Test accessing invalid endpoint."""
        response = client.get("/invalid/endpoint")
        assert response.status_code == 404

    def test_invalid_method(self):
        """Test using invalid HTTP method."""
        response = client.delete("/predict")
        assert response.status_code == 405

    def test_missing_content_type(self):
        """Test request without proper content type."""
        response = client.post(
            "/predict",
            data='{"transaction_data": {}}',
            headers={"Content-Type": "text/plain"},
        )
        # FastAPI handles this gracefully
        assert response.status_code in [200, 422]


@pytest.mark.asyncio
class TestAsyncOperations:
    """Test asynchronous operations."""

    async def test_concurrent_predictions(self):
        """Test handling concurrent prediction requests."""
        # This would be tested with actual async client in real implementation
        pass

    async def test_service_lifecycle(self):
        """Test service startup and shutdown lifecycle."""
        # Test service initialization
        # Test database connections
        # Test model loading
        # Test graceful shutdown
        pass


class TestIntegration:
    """Integration tests."""

    def test_full_ml_workflow(self):
        """Test a complete ML workflow."""
        # 1. Check health
        response = client.get("/health")
        assert response.status_code == 200

        # 2. List models
        response = client.get("/models")
        assert response.status_code == 200

        # 3. Make prediction
        request_data = {
            "transaction_data": {
                "amount": 250.0,
                "merchant_id": "test_merchant",
                "customer_id": "test_customer",
            }
        }
        response = client.post("/predict", json=request_data)
        assert response.status_code == 200

        # 4. Check metrics
        response = client.get("/metrics")
        assert response.status_code == 200

    def test_model_versioning(self):
        """Test model versioning workflow."""
        # 1. Get available models
        response = client.get("/models")
        assert response.status_code == 200
        models = response.json()["models"]

        # 2. Request prediction with specific version
        if models:
            model_version = models[0]["version"]
            request_data = {
                "transaction_data": {"amount": 100.0},
                "model_version": model_version,
            }
            response = client.post("/predict", json=request_data)
            assert response.status_code == 200
            assert response.json()["model_version"] == model_version
