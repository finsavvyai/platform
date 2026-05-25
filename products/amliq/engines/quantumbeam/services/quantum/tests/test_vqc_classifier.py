import pytest
import numpy as np
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import time

# Import the classes we're testing
from core.vqc_classifier import VariationalQuantumClassifier
from core.models import (
    TransactionFeatures, FraudDetectionResult, QuantumBackendType,
    CircuitExecutionResult, ProcessingStatus
)
from config.quantum_config import QuantumConfig


class TestVariationalQuantumClassifier:
    """Test suite for Variational Quantum Classifier"""

    @pytest.fixture
    def vqc_config(self):
        """Create test configuration for VQC"""
        return {
            'vqc_qubits': 4,
            'vqc_layers': 2,
            'vqc_rotations': ['rx', 'ry', 'rz'],
            'vqc_entanglement': 'linear',
            'encoding_method': 'angle',
            'default_backend': 'simulator',
            'max_shots': 1024,
            'fraud_threshold': 0.5,
            'confidence_threshold': 0.6,
            'quantum_volume': 64
        }

    @pytest.fixture
    def vqc(self, vqc_config):
        """Create VQC instance for testing"""
        return VariationalQuantumClassifier(vqc_config)

    @pytest.fixture
    def sample_transaction(self):
        """Create sample transaction for testing"""
        return TransactionFeatures(
            transaction_id="test_tx_001",
            amount=150.75,
            timestamp=datetime.utcnow(),
            merchant_id="merchant_001",
            customer_id="customer_001",
            location="US",
            device_id="device_001",
            ip_address="192.168.1.1",
            payment_method="credit_card",
            currency="USD",
            customer_age_months=12,
            transaction_frequency_24h=3,
            avg_transaction_amount_30d=85.50,
            amount_deviation_score=1.76,
            time_since_last_transaction=240,
            is_high_risk_country=False,
            is_new_device=False,
            is_unusual_time=False,
            velocity_exceeded=False
        )

    @pytest.fixture
    def fraud_transaction(self):
        """Create fraudulent transaction for testing"""
        return TransactionFeatures(
            transaction_id="fraud_tx_001",
            amount=2500.00,
            timestamp=datetime.utcnow(),
            merchant_id="merchant_002",
            customer_id="customer_002",
            location="RU",
            device_id="device_002",
            ip_address="10.0.0.1",
            payment_method="gift_card",
            currency="USD",
            customer_age_months=1,
            transaction_frequency_24h=15,
            avg_transaction_amount_30d=75.00,
            amount_deviation_score=32.33,
            time_since_last_transaction=5,
            is_high_risk_country=True,
            is_new_device=True,
            is_unusual_time=True,
            velocity_exceeded=True
        )

    def test_vqc_initialization(self, vqc):
        """Test VQC initialization"""
        assert vqc.num_qubits == 4
        assert vqc.num_layers == 2
        assert vqc.rotation_gates == ['rx', 'ry', 'rz']
        assert vqc.entanglement == 'linear'
        assert vqc.backend_type == QuantumBackendType.SIMULATOR
        assert len(vqc.params) == 24  # 4 qubits * 2 layers * 3 rotation gates
        assert vqc.encoder is not None

    def test_vqc_parameter_initialization(self, vqc):
        """Test parameter initialization"""
        assert len(vqc.params) == vqc.num_params
        assert all(0 <= param <= 2 * np.pi for param in vqc.params)
        assert len(vqc.param_names) == vqc.num_params

    def test_create_vqc_circuit(self, vqc, sample_transaction):
        """Test VQC circuit creation"""
        # Encode features
        encoded_features = vqc.encoder.encode_features(sample_transaction)
        assert len(encoded_features) <= vqc.num_params

        # Create circuit
        circuit = vqc.create_vqc_circuit(encoded_features)

        assert circuit is not None
        assert hasattr(circuit, 'num_qubits')
        assert hasattr(circuit, 'depth')
        assert hasattr(circuit, 'gate_count')

    def test_angle_encoding(self, vqc):
        """Test angle encoding method"""
        features = np.array([0.1, 0.5, 0.8, 1.0])
        params = vqc._angle_encoding(features)

        assert len(params) <= vqc.num_params
        assert all(0 <= param <= np.pi for param in params)

    def test_amplitude_encoding(self, vqc):
        """Test amplitude encoding method"""
        features = np.array([0.1, 0.5, 0.8, 1.0])
        params = vqc._amplitude_encoding(features)

        # Check normalization
        norm = np.linalg.norm(params)
        assert abs(norm - 1.0) < 1e-10

    def test_basis_encoding(self, vqc):
        """Test basis encoding method"""
        features = np.array([0.1, 0.5, 0.8, 1.0])
        params = vqc._basis_encoding(features)

        assert len(params) <= vqc.num_qubits
        assert all(0 <= param <= 1 for param in params)

    def test_hybrid_encoding(self, vqc):
        """Test hybrid encoding method"""
        features = np.array([0.1, 0.5, 0.8, 1.0, 0.3, 0.7, 0.2, 0.9])
        params = vqc._hybrid_encoding(features)

        assert len(params) <= vqc.num_params

    @patch('core.vqc_classifier.QISKIT_AVAILABLE', False)
    def test_mock_circuit_creation(self, vqc, sample_transaction):
        """Test circuit creation when Qiskit is not available"""
        encoded_features = vqc.encoder.encode_features(sample_transaction)
        circuit = vqc.create_vqc_circuit(encoded_features)

        assert circuit is not None
        assert hasattr(circuit, 'num_qubits')
        assert hasattr(circuit, 'depth')

    def test_classify_transaction_normal(self, vqc, sample_transaction):
        """Test classification of normal transaction"""
        result = vqc.classify_transaction(sample_transaction)

        assert isinstance(result, FraudDetectionResult)
        assert result.transaction_id == sample_transaction.transaction_id
        assert result.processing_method == "Variational Quantum Classifier"
        assert result.quantum_backend == QuantumBackendType.SIMULATOR
        assert 0 <= result.fraud_probability <= 1
        assert 0 <= result.confidence_score <= 1
        assert 0 <= result.quantum_advantage_score <= 1
        assert result.processing_time_ms > 0
        assert result.circuit_depth > 0
        assert result.model_version == "VQC-v1.0"

    def test_classify_transaction_fraudulent(self, vqc, fraud_transaction):
        """Test classification of fraudulent transaction"""
        result = vqc.classify_transaction(fraud_transaction)

        assert isinstance(result, FraudDetectionResult)
        assert result.transaction_id == fraud_transaction.transaction_id
        # High-risk transaction should have higher fraud probability
        assert result.fraud_probability > 0.5

    def test_process_measurement_results(self, vqc):
        """Test processing of quantum measurement results"""
        # Create mock execution result
        execution_result = CircuitExecutionResult(
            execution_id="test_exec",
            circuit_id="test_circuit",
            status=ProcessingStatus.COMPLETED,
            counts={
                '0000': 600,
                '0001': 200,
                '0010': 100,
                '0011': 80,
                '0100': 30,
                '0101': 10
            },
            measurement_results=[],
            execution_time_ms=50,
            backend_info={}
        )

        fraud_prob, confidence = vqc._process_measurement_results(
            execution_result, "test_tx"
        )

        assert 0 <= fraud_prob <= 1
        assert 0 <= confidence <= 1

    def test_process_measurement_results_empty_counts(self, vqc):
        """Test processing when no measurement results available"""
        execution_result = CircuitExecutionResult(
            execution_id="test_exec",
            circuit_id="test_circuit",
            status=ProcessingStatus.COMPLETED,
            counts={},
            measurement_results=[],
            execution_time_ms=50,
            backend_info={}
        )

        fraud_prob, confidence = vqc._process_measurement_results(
            execution_result, "test_tx"
        )

        assert fraud_prob == 0.5  # Default uncertain result
        assert confidence == 0.5

    def test_calculate_quantum_advantage(self, vqc):
        """Test quantum advantage calculation"""
        execution_result = CircuitExecutionResult(
            execution_id="test_exec",
            circuit_id="test_circuit",
            status=ProcessingStatus.COMPLETED,
            counts={'00': 512, '11': 512},
            measurement_results=[],
            execution_time_ms=25,  # Fast execution
            quantum_volume=128,
            fidelity=0.95,
            backend_info={}
        )

        advantage = vqc._calculate_quantum_advantage(execution_result)

        assert 0 <= advantage <= 1
        assert advantage > 0.5  # Should show some advantage

    def test_generate_explanation(self, vqc):
        """Test explanation generation"""
        explanation_high = vqc._generate_explanation(0.9, TransactionFeatures(
            transaction_id="test",
            amount=1000.0,
            timestamp=datetime.utcnow(),
            merchant_id="merch",
            customer_id="cust",
            payment_method="credit",
            currency="USD"
        ))
        assert "High risk" in explanation_high

        explanation_low = vqc._generate_explanation(0.1, TransactionFeatures(
            transaction_id="test",
            amount=50.0,
            timestamp=datetime.utcnow(),
            merchant_id="merch",
            customer_id="cust",
            payment_method="credit",
            currency="USD"
        ))
        assert "Low risk" in explanation_low

    def test_identify_risk_factors(self, vqc, fraud_transaction):
        """Test risk factor identification"""
        fraud_probability = 0.8
        risk_factors = vqc._identify_risk_factors(fraud_transaction, fraud_probability)

        assert isinstance(risk_factors, list)
        assert len(risk_factors) > 0
        assert "High amount deviation" in risk_factors
        assert "High-risk geographic location" in risk_factors
        assert "Transaction from new device" in risk_factors

    def test_identify_risk_factors_low_probability(self, vqc, sample_transaction):
        """Test risk factor identification for low probability case"""
        fraud_probability = 0.2
        risk_factors = vqc._identify_risk_factors(sample_transaction, fraud_probability)

        assert isinstance(risk_factors, list)
        # Should have minimal risk factors for low probability

    def test_update_parameters(self, vqc):
        """Test parameter updates"""
        new_params = np.random.uniform(0, 2 * np.pi, len(vqc.params))
        original_params = vqc.params.copy()

        vqc.update_parameters(new_params)

        assert not np.array_equal(vqc.params, original_params)
        assert np.array_equal(vqc.params, new_params)

    def test_update_parameters_wrong_size(self, vqc):
        """Test parameter update with wrong size array"""
        wrong_size_params = np.random.uniform(0, 2 * np.pi, 10)
        original_params = vqc.params.copy()

        vqc.update_parameters(wrong_size_params)

        # Parameters should remain unchanged
        assert np.array_equal(vqc.params, original_params)

    def test_get_performance_metrics_empty(self, vqc):
        """Test performance metrics when no executions yet"""
        metrics = vqc.get_performance_metrics()
        assert metrics == {}

    def test_get_performance_metrics_with_history(self, vqc, sample_transaction):
        """Test performance metrics after some executions"""
        # Execute a few transactions to build history
        for i in range(3):
            vqc.classify_transaction(sample_transaction)

        metrics = vqc.get_performance_metrics()

        assert 'total_executions' in metrics
        assert 'avg_processing_time_ms' in metrics
        assert 'max_processing_time_ms' in metrics
        assert 'min_processing_time_ms' in metrics
        assert 'avg_fraud_probability' in metrics
        assert 'avg_quantum_advantage' in metrics
        assert 'circuit_depth' in metrics
        assert 'num_parameters' in metrics
        assert 'backend_type' in metrics

        assert metrics['total_executions'] == 3
        assert metrics['circuit_depth'] > 0
        assert metrics['num_parameters'] == len(vqc.params)

    def test_fallback_result_creation(self, vqc, sample_transaction):
        """Test fallback result creation when quantum processing fails"""
        fallback_result = vqc._create_fallback_result(sample_transaction, 0.1)

        assert isinstance(fallback_result, FraudDetectionResult)
        assert fallback_result.transaction_id == sample_transaction.transaction_id
        assert fallback_result.is_fraud is False
        assert fallback_result.fraud_probability == 0.5
        assert fallback_result.confidence_score == 0.1
        assert fallback_result.quantum_advantage_score == 0.0
        assert fallback_result.processing_method == "Classical Fallback"
        assert fallback_result.circuit_depth == 0

    @pytest.mark.asyncio
    async def test_multiple_concurrent_classifications(self, vqc):
        """Test concurrent transaction classifications"""
        transactions = []
        for i in range(5):
            tx = TransactionFeatures(
                transaction_id=f"concurrent_tx_{i}",
                amount=100.0 + i * 50,
                timestamp=datetime.utcnow(),
                merchant_id=f"merchant_{i}",
                customer_id=f"customer_{i}",
                payment_method="credit_card",
                currency="USD"
            )
            transactions.append(tx)

        # Run classifications concurrently
        start_time = time.time()
        results = await asyncio.gather(*[
            asyncio.to_thread(vqc.classify_transaction, tx)
            for tx in transactions
        ])
        end_time = time.time()

        assert len(results) == 5
        for result in results:
            assert isinstance(result, FraudDetectionResult)
            assert result.transaction_id.startswith("concurrent_tx_")

        # Should complete reasonably fast even with concurrency
        total_time = end_time - start_time
        assert total_time < 10.0  # Should complete within 10 seconds

    def test_different_entanglement_patterns(self, vqc_config):
        """Test VQC with different entanglement patterns"""
        entanglement_patterns = ['full', 'linear', 'circular']

        for pattern in entanglement_patterns:
            config = vqc_config.copy()
            config['vqc_entanglement'] = pattern

            vqc = VariationalQuantumClassifier(config)
            assert vqc.entanglement == pattern

            # Test circuit creation works with each pattern
            sample_tx = TransactionFeatures(
                transaction_id="test",
                amount=100.0,
                timestamp=datetime.utcnow(),
                merchant_id="merch",
                customer_id="cust",
                payment_method="credit",
                currency="USD"
            )
            encoded_features = vqc.encoder.encode_features(sample_tx)
            circuit = vqc.create_vqc_circuit(encoded_features)
            assert circuit is not None

    def test_different_layer_configurations(self, vqc_config):
        """Test VQC with different numbers of layers"""
        layer_counts = [1, 2, 3, 4]

        for layers in layer_counts:
            config = vqc_config.copy()
            config['vqc_layers'] = layers

            vqc = VariationalQuantumClassifier(config)
            assert vqc.num_layers == layers
            expected_params = vqc.num_qubits * layers * len(vqc.rotation_gates)
            assert len(vqc.params) == expected_params

    def test_edge_case_transactions(self, vqc):
        """Test VQC with edge case transactions"""
        # Zero amount transaction
        zero_tx = TransactionFeatures(
            transaction_id="zero_tx",
            amount=0.0,
            timestamp=datetime.utcnow(),
            merchant_id="merch",
            customer_id="cust",
            payment_method="credit",
            currency="USD"
        )
        result = vqc.classify_transaction(zero_tx)
        assert isinstance(result, FraudDetectionResult)

        # Very large amount transaction
        large_tx = TransactionFeatures(
            transaction_id="large_tx",
            amount=1000000.0,
            timestamp=datetime.utcnow(),
            merchant_id="merch",
            customer_id="cust",
            payment_method="credit",
            currency="USD"
        )
        result = vqc.classify_transaction(large_tx)
        assert isinstance(result, FraudDetectionResult)

        # Missing optional fields
        minimal_tx = TransactionFeatures(
            transaction_id="minimal_tx",
            amount=50.0,
            timestamp=datetime.utcnow(),
            merchant_id="merch",
            customer_id="cust",
            payment_method="credit",
            currency="USD"
        )
        result = vqc.classify_transaction(minimal_tx)
        assert isinstance(result, FraudDetectionResult)

    def test_quantum_advantage_thresholds(self, vqc):
        """Test quantum advantage calculation under different conditions"""
        # High quantum volume, high fidelity
        high_advantage_result = CircuitExecutionResult(
            execution_id="test",
            circuit_id="test",
            status=ProcessingStatus.COMPLETED,
            counts={'00': 1024},
            measurement_results=[],
            execution_time_ms=10,
            quantum_volume=128,
            fidelity=0.99,
            backend_info={}
        )
        advantage = vqc._calculate_quantum_advantage(high_advantage_result)
        assert advantage > 0.8

        # Low quantum volume, low fidelity
        low_advantage_result = CircuitExecutionResult(
            execution_id="test",
            circuit_id="test",
            status=ProcessingStatus.COMPLETED,
            counts={'00': 1024},
            measurement_results=[],
            execution_time_ms=500,
            quantum_volume=16,
            fidelity=0.85,
            backend_info={}
        )
        advantage = vqc._calculate_quantum_advantage(low_advantage_result)
        assert advantage < 0.7

    @pytest.mark.parametrize("fraud_threshold", [0.3, 0.5, 0.7, 0.9])
    def test_different_fraud_thresholds(self, vqc_config, sample_transaction, fraud_threshold):
        """Test VQC with different fraud thresholds"""
        config = vqc_config.copy()
        config['fraud_threshold'] = fraud_threshold

        vqc = VariationalQuantumClassifier(config)
        result = vqc.classify_transaction(sample_transaction)

        # The classification should respect the threshold
        if result.fraud_probability > fraud_threshold:
            assert result.is_fraud is True
        else:
            assert result.is_fraud is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])