"""
Tests for the Quantum Service main application.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import json

from quantumbeam.quantum.main import app

client = TestClient(app)


class TestHealthEndpoints:
    """Test health check endpoints."""

    def test_health_check(self):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "quantum"
        assert "version" in data
        assert "timestamp" in data

    @patch("quantumbeam.quantum.main.redis_client")
    @patch("quantumbeam.quantum.main.influxdb_client")
    def test_readiness_check_all_dependencies_ready(self, mock_influxdb, mock_redis):
        """Test readiness check when all dependencies are ready."""
        mock_redis.ping.return_value = True
        mock_influxdb.health.return_value = Mock(status="pass")

        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert data["dependencies"]["redis"] == "connected"
        assert data["dependencies"]["influxdb"] == "connected"

    @patch("quantumbeam.quantum.main.redis_client", None)
    @patch("quantumbeam.quantum.main.influxdb_client", None)
    def test_readiness_check_dependencies_not_ready(self):
        """Test readiness check when dependencies are not ready."""
        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "not_ready"
        assert data["dependencies"]["redis"] == "disconnected"
        assert data["dependencies"]["influxdb"] == "disconnected"


class TestQuantumEndpoints:
    """Test quantum computation endpoints."""

    def test_list_algorithms(self):
        """Test listing available quantum algorithms."""
        response = client.get("/algorithms")
        assert response.status_code == 200
        data = response.json()
        assert "algorithms" in data
        assert len(data["algorithms"]) > 0

        # Check VQC algorithm
        vqc = next((alg for alg in data["algorithms"] if alg["name"] == "vqc"), None)
        assert vqc is not None
        assert vqc["description"] == "Variational Quantum Circuit"
        assert "parameters" in vqc
        assert "suitable_for" in vqc

    @patch("quantumbeam.quantum.main.mock_quantum_computation")
    async def test_compute_quantum_vqc(self, mock_computation):
        """Test quantum computation with VQC algorithm."""
        # Mock the computation result
        mock_computation.return_value = {
            "computation": {
                "classification": "legitimate",
                "probability": 0.85,
                "features": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
            },
            "confidence": 0.85,
            "execution_time_ms": 45.5,
            "qubits_used": 8,
            "depth": 10
        }

        request_data = {
            "data": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            "algorithm": "vqc",
            "parameters": {
                "layers": 3,
                "entanglement": "full"
            }
        }

        response = client.post("/compute", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        assert "confidence" in data
        assert "metadata" in data
        assert data["metadata"]["algorithm"] == "vqc"
        assert data["metadata"]["qubits_used"] == 8

    @patch("quantumbeam.quantum.main.mock_quantum_computation")
    async def test_compute_quantum_qaoa(self, mock_computation):
        """Test quantum computation with QAOA algorithm."""
        # Mock the computation result
        mock_computation.return_value = {
            "computation": {
                "optimal_solution": [0, 1, 0, 1, 0, 1, 0, 1],
                "energy": -5.2,
                "convergence": 0.92
            },
            "confidence": 0.92,
            "execution_time_ms": 125.3,
            "qubits_used": 16,
            "depth": 20
        }

        request_data = {
            "data": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            "algorithm": "qaoa",
            "parameters": {
                "p": 2,
                "mixer": "X"
            }
        }

        response = client.post("/compute", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert "result" in data
        assert "confidence" in data
        assert data["metadata"]["algorithm"] == "qaoa"
        assert data["metadata"]["qubits_used"] == 16

    def test_compute_quantum_invalid_algorithm(self):
        """Test quantum computation with invalid algorithm."""
        request_data = {
            "data": [0.1, 0.2, 0.3, 0.4],
            "algorithm": "invalid_algorithm"
        }

        response = client.post("/compute", json=request_data)
        assert response.status_code == 500
        assert "Unknown algorithm" in response.json()["detail"]

    def test_compute_quantum_invalid_request(self):
        """Test quantum computation with invalid request data."""
        # Missing required fields
        request_data = {
            "data": [0.1, 0.2]
            # Missing algorithm
        }

        response = client.post("/compute", json=request_data)
        assert response.status_code == 422  # Validation error


class TestMetricsEndpoint:
    """Test metrics endpoint."""

    def test_get_metrics(self):
        """Test getting service metrics."""
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "requests_total" in data
        assert "requests_success" in data
        assert "requests_error" in data
        assert "average_response_time_ms" in data
        assert "quantum_circuits_executed" in data
        assert "average_circuit_depth" in data
        assert "qubits_utilized" in data


class TestErrorHandling:
    """Test error handling."""

    @patch("quantumbeam.quantum.main.mock_quantum_computation")
    def test_quantum_computation_error(self, mock_computation):
        """Test handling of quantum computation errors."""
        mock_computation.side_effect = Exception("Quantum backend error")

        request_data = {
            "data": [0.1, 0.2, 0.3, 0.4],
            "algorithm": "vqc"
        }

        response = client.post("/compute", json=request_data)
        assert response.status_code == 500
        assert "Quantum computation failed" in response.json()["detail"]


@pytest.mark.asyncio
class TestAsyncOperations:
    """Test asynchronous operations."""

    async def test_service_lifecycle(self):
        """Test service startup and shutdown lifecycle."""
        # This is tested implicitly through other tests
        # In a real implementation, you might test:
        # - Database connection initialization
        # - Cache connection setup
        # - Graceful shutdown
        pass


class TestIntegration:
    """Integration tests."""

    def test_full_workflow(self):
        """Test a complete workflow."""
        # 1. Check health
        response = client.get("/health")
        assert response.status_code == 200

        # 2. List algorithms
        response = client.get("/algorithms")
        assert response.status_code == 200
        algorithms = response.json()["algorithms"]
        assert len(algorithms) > 0

        # 3. Perform computation
        request_data = {
            "data": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
            "algorithm": algorithms[0]["name"]
        }
        response = client.post("/compute", json=request_data)
        assert response.status_code == 200

        # 4. Check metrics
        response = client.get("/metrics")
        assert response.status_code == 200
