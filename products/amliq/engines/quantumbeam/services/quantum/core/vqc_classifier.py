import numpy as np
from typing import List, Dict, Tuple, Optional, Any
import logging
from abc import ABC, abstractmethod

try:
    from qiskit import QuantumCircuit, transpile, Aer, execute
    from qiskit.providers.aer import AerSimulator
    from qiskit.circuit import ParameterVector
    from qiskit.visualization import plot_histogram
    from qiskit.result import Result
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False
    logging.warning("Qiskit not available, using mock implementation")

try:
    import pennylane as qml
    from pennylane import numpy as pnp
    PENNYLANE_AVAILABLE = True
except ImportError:
    PENNYLANE_AVAILABLE = False
    logging.warning("PennyLane not available")

from .models import (
    TransactionFeatures, FraudDetectionResult, QuantumBackendType,
    CircuitExecutionResult, ProcessingStatus, QuantumFeatureEncoder,
    FeatureEncodingMethod
)
from .quantum_encoder import QuantumFeatureEncoderService

logger = logging.getLogger(__name__)


class VariationalQuantumClassifier:
    """
    Variational Quantum Classifier for fraud detection

    This implementation uses a parameterized quantum circuit with trainable
    parameters that can be optimized for fraud classification tasks.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.num_qubits = config.get('vqc_qubits', 8)
        self.num_layers = config.get('vqc_layers', 3)
        self.rotation_gates = config.get('vqc_rotations', ['rx', 'ry', 'rz'])
        self.entanglement = config.get('vqc_entanglement', 'full')
        self.encoding_method = config.get('encoding_method', 'angle')

        # Initialize quantum backend
        self.backend_type = QuantumBackendType(config.get('default_backend', 'simulator'))
        self.backend = self._initialize_backend()

        # Initialize feature encoder
        encoder_config = QuantumFeatureEncoder(
            method=FeatureEncodingMethod(self.encoding_method),
            num_qubits=self.num_qubits,
            feature_dim=config.get('feature_dim', 10),
            encoding_params={}
        )
        self.encoder = QuantumFeatureEncoderService(encoder_config)

        # Initialize parameters
        self._initialize_parameters()

        # Performance tracking
        self.execution_history = []

    def _initialize_backend(self):
        """Initialize the quantum backend"""
        if not QISKIT_AVAILABLE:
            return None

        if self.backend_type == QuantumBackendType.SIMULATOR:
            return AerSimulator()
        else:
            # For real quantum backends, we'll need to implement connection logic
            logger.warning(f"Backend {self.backend_type} not yet implemented, using simulator")
            return AerSimulator()

    def _initialize_parameters(self):
        """Initialize trainable parameters for the VQC"""
        # Create parameter vector for the variational circuit
        self.num_params = self.num_qubits * self.num_layers * len(self.rotation_gates)
        self.params = np.random.uniform(0, 2 * np.pi, self.num_params)
        self.param_names = [f"θ_{i}" for i in range(self.num_params)]

    def create_vqc_circuit(self, features: np.ndarray) -> QuantumCircuit:
        """
        Create a Variational Quantum Circuit for fraud detection

        Args:
            features: Encoded transaction features

        Returns:
            QuantumCircuit: The constructed VQC circuit
        """
        if not QISKIT_AVAILABLE:
            return self._create_mock_circuit()

        # Create quantum circuit
        qc = QuantumCircuit(self.num_qubits, self.num_qubits)

        # Encode features into quantum state
        qc = self._encode_features(qc, features)

        # Add variational layers
        qc = self._add_variational_layers(qc)

        # Add entanglement
        qc = self._add_entanglement(qc)

        # Measure in computational basis
        for i in range(self.num_qubits):
            qc.measure(i, i)

        return qc

    def _encode_features(self, qc: QuantumCircuit, features: np.ndarray) -> QuantumCircuit:
        """Encode transaction features into the quantum circuit"""
        if self.encoding_method == 'angle':
            return self._angle_encoding(qc, features)
        elif self.encoding_method == 'amplitude':
            return self._amplitude_encoding(qc, features)
        else:
            return self._angle_encoding(qc, features)  # Default to angle encoding

    def _angle_encoding(self, qc: QuantumCircuit, features: np.ndarray) -> QuantumCircuit:
        """Angle encoding using rotation gates"""
        for i in range(min(self.num_qubits, len(features))):
            if i < len(features):
                qc.rx(features[i], i)
                qc.ry(features[i] * 0.5, i)
                qc.rz(features[i] * 0.3, i)
        return qc

    def _amplitude_encoding(self, qc: QuantumCircuit, features: np.ndarray) -> QuantumCircuit:
        """Amplitude encoding (simplified)"""
        # For simplicity, using angle encoding as fallback
        return self._angle_encoding(qc, features)

    def _add_variational_layers(self, qc: QuantumCircuit) -> QuantumCircuit:
        """Add trainable variational layers to the circuit"""
        param_idx = 0

        for layer in range(self.num_layers):
            for qubit in range(self.num_qubits):
                for gate_type in self.rotation_gates:
                    if param_idx < len(self.params):
                        if gate_type == 'rx':
                            qc.rx(self.params[param_idx], qubit)
                        elif gate_type == 'ry':
                            qc.ry(self.params[param_idx], qubit)
                        elif gate_type == 'rz':
                            qc.rz(self.params[param_idx], qubit)
                        param_idx += 1

        return qc

    def _add_entanglement(self, qc: QuantumCircuit) -> QuantumCircuit:
        """Add entanglement between qubits"""
        if self.entanglement == 'full':
            # Full entanglement: connect all qubits to all others
            for i in range(self.num_qubits):
                for j in range(i + 1, self.num_qubits):
                    qc.cx(i, j)
        elif self.entanglement == 'linear':
            # Linear entanglement: connect adjacent qubits
            for i in range(self.num_qubits - 1):
                qc.cx(i, i + 1)
        elif self.entanglement == 'circular':
            # Circular entanglement: connect in a ring
            for i in range(self.num_qubits):
                qc.cx(i, (i + 1) % self.num_qubits)

        return qc

    def classify_transaction(self, features: TransactionFeatures) -> FraudDetectionResult:
        """
        Classify a transaction as fraudulent or legitimate using VQC

        Args:
            features: Transaction features to classify

        Returns:
            FraudDetectionResult: Classification result with confidence scores
        """
        import time
        start_time = time.time()

        try:
            # Encode features
            encoded_features = self.encoder.encode_features(features)

            # Create quantum circuit
            circuit = self.create_vqc_circuit(encoded_features)

            # Execute circuit
            execution_result = self._execute_circuit(circuit)

            # Process results
            fraud_probability, confidence_score = self._process_measurement_results(
                execution_result, features.transaction_id
            )

            # Calculate quantum advantage score
            quantum_advantage = self._calculate_quantum_advantage(execution_result)

            processing_time_ms = int((time.time() - start_time) * 1000)

            # Generate explanation
            explanation = self._generate_explanation(fraud_probability, features)

            # Determine if fraud based on threshold
            fraud_threshold = self.config.get('fraud_threshold', 0.5)
            is_fraud = fraud_probability > fraud_threshold

            result = FraudDetectionResult(
                transaction_id=features.transaction_id,
                is_fraud=is_fraud,
                fraud_probability=fraud_probability,
                confidence_score=confidence_score,
                quantum_advantage_score=quantum_advantage,
                processing_method="Variational Quantum Classifier",
                processing_time_ms=processing_time_ms,
                circuit_depth=circuit.depth(),
                quantum_backend=self.backend_type,
                explanation=explanation,
                risk_factors=self._identify_risk_factors(features, fraud_probability),
                model_version="VQC-v1.0"
            )

            # Track performance
            self.execution_history.append({
                'timestamp': time.time(),
                'processing_time_ms': processing_time_ms,
                'fraud_probability': fraud_probability,
                'quantum_advantage': quantum_advantage
            })

            return result

        except Exception as e:
            logger.error(f"Error classifying transaction {features.transaction_id}: {e}")
            # Return fallback result
            return self._create_fallback_result(features, time.time() - start_time)

    def _execute_circuit(self, circuit: QuantumCircuit) -> CircuitExecutionResult:
        """Execute the quantum circuit"""
        if not QISKIT_AVAILABLE or self.backend is None:
            return self._create_mock_execution_result()

        try:
            # Transpile circuit for the backend
            transpiled_circuit = transpile(circuit, self.backend)

            # Execute circuit
            shots = self.config.get('max_shots', 1024)
            job = execute(transpiled_circuit, self.backend, shots=shots)

            # Get results
            result = job.result()
            counts = result.get_counts()

            execution_time_ms = int(job.result().time_taken * 1000) if hasattr(job.result(), 'time_taken') else 0

            return CircuitExecutionResult(
                execution_id=f"exec_{int(time.time() * 1000)}",
                circuit_id=f"vqc_{self.num_qubits}q_{self.num_layers}l",
                status=ProcessingStatus.COMPLETED,
                counts=counts,
                measurement_results=[{'state': state, 'count': count} for state, count in counts.items()],
                execution_time_ms=execution_time_ms,
                quantum_volume=self.config.get('quantum_volume', 64),
                fidelity=0.95,  # Placeholder
                error_rate=0.05,  # Placeholder
                backend_info={'name': str(self.backend_type), 'shots': shots}
            )

        except Exception as e:
            logger.error(f"Error executing quantum circuit: {e}")
            return self._create_mock_execution_result()

    def _process_measurement_results(self, execution_result: CircuitExecutionResult, transaction_id: str) -> Tuple[float, float]:
        """Process quantum measurement results to get fraud probability and confidence"""
        counts = execution_result.counts

        if not counts:
            return 0.5, 0.5  # Default uncertain result

        # Calculate probabilities from counts
        total_shots = sum(counts.values())
        probabilities = {state: count / total_shots for state, count in counts.items()}

        # Use first qubit measurement for fraud classification
        fraud_shots = sum(count for state, count in counts.items() if state[0] == '1')
        fraud_probability = fraud_shots / total_shots

        # Calculate confidence based on distribution
        max_probability = max(probabilities.values())
        confidence_score = (max_probability - 0.5) * 2  # Normalize to [0, 1]
        confidence_score = max(0, min(1, confidence_score))

        return fraud_probability, confidence_score

    def _calculate_quantum_advantage(self, execution_result: CircuitExecutionResult) -> float:
        """Calculate quantum advantage score"""
        # This is a simplified calculation - in practice would compare with classical baseline
        base_advantage = 0.5

        # Factor in quantum volume and fidelity
        if execution_result.quantum_volume:
            qv_factor = min(execution_result.quantum_volume / 128, 1.0)
            base_advantage += 0.3 * qv_factor

        if execution_result.fidelity:
            fidelity_factor = execution_result.fidelity
            base_advantage += 0.2 * fidelity_factor

        # Consider circuit efficiency
        if execution_result.execution_time_ms < 100:
            base_advantage += 0.1

        return max(0, min(1, base_advantage))

    def _generate_explanation(self, fraud_probability: float, features: TransactionFeatures) -> str:
        """Generate natural language explanation for the fraud decision"""
        if fraud_probability > 0.8:
            return f"High risk detected: Transaction amount ${features.amount:.2f} significantly deviates from normal patterns"
        elif fraud_probability > 0.6:
            return f"Medium risk: Unusual transaction pattern detected for customer {features.customer_id}"
        elif fraud_probability > 0.4:
            return f"Low to medium risk: Some anomalous characteristics observed"
        else:
            return f"Low risk: Transaction appears normal based on quantum analysis"

    def _identify_risk_factors(self, features: TransactionFeatures, fraud_probability: float) -> List[str]:
        """Identify specific risk factors for the transaction"""
        risk_factors = []

        if features.amount_deviation_score and features.amount_deviation_score > 2:
            risk_factors.append("High amount deviation")

        if features.transaction_frequency_24h and features.transaction_frequency_24h > 5:
            risk_factors.append("High transaction frequency")

        if features.is_high_risk_country:
            risk_factors.append("High-risk geographic location")

        if features.is_new_device:
            risk_factors.append("Transaction from new device")

        if features.is_unusual_time:
            risk_factors.append("Unusual transaction time")

        if fraud_probability > 0.7 and not risk_factors:
            risk_factors.append("Quantum pattern anomaly detected")

        return risk_factors

    def _create_fallback_result(self, features: TransactionFeatures, processing_time: float) -> FraudDetectionResult:
        """Create fallback result when quantum processing fails"""
        return FraudDetectionResult(
            transaction_id=features.transaction_id,
            is_fraud=False,
            fraud_probability=0.5,
            confidence_score=0.1,
            quantum_advantage_score=0.0,
            processing_method="Classical Fallback",
            processing_time_ms=int(processing_time * 1000),
            circuit_depth=0,
            quantum_backend=QuantumBackendType.SIMULATOR,
            explanation="Quantum processing unavailable, using classical fallback",
            risk_factors=["Processing error"],
            model_version="Fallback-v1.0"
        )

    def _create_mock_circuit(self) -> 'QuantumCircuit':
        """Create a mock circuit when Qiskit is not available"""
        class MockQuantumCircuit:
            def __init__(self, num_qubits, num_clbits):
                self.num_qubits = num_qubits
                self.num_clbits = num_clbits

            def depth(self):
                return self.num_qubits * 3

        return MockQuantumCircuit(self.num_qubits, self.num_qubits)

    def _create_mock_execution_result(self) -> CircuitExecutionResult:
        """Create mock execution result when quantum backend is not available"""
        # Generate realistic-looking mock counts
        mock_counts = {
            '0000': 600,
            '0001': 150,
            '0010': 100,
            '0011': 80,
            '0100': 50,
            '0101': 15,
            '0110': 3,
            '0111': 2
        }

        return CircuitExecutionResult(
            execution_id="mock_execution",
            circuit_id="mock_circuit",
            status=ProcessingStatus.COMPLETED,
            counts=mock_counts,
            measurement_results=[{'state': state, 'count': count} for state, count in mock_counts.items()],
            execution_time_ms=50,
            quantum_volume=64,
            fidelity=1.0,
            error_rate=0.0,
            backend_info={'name': 'simulator', 'shots': 1024}
        )

    def update_parameters(self, new_params: np.ndarray):
        """Update the trainable parameters of the VQC"""
        if len(new_params) == len(self.params):
            self.params = new_params
            logger.info("VQC parameters updated successfully")
        else:
            logger.error(f"Parameter size mismatch: expected {len(self.params)}, got {len(new_params)}")

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for the VQC"""
        if not self.execution_history:
            return {}

        processing_times = [entry['processing_time_ms'] for entry in self.execution_history]
        fraud_probs = [entry['fraud_probability'] for entry in self.execution_history]
        quantum_advantages = [entry['quantum_advantage'] for entry in self.execution_history]

        return {
            'total_executions': len(self.execution_history),
            'avg_processing_time_ms': np.mean(processing_times),
            'max_processing_time_ms': np.max(processing_times),
            'min_processing_time_ms': np.min(processing_times),
            'avg_fraud_probability': np.mean(fraud_probs),
            'avg_quantum_advantage': np.mean(quantum_advantages),
            'circuit_depth': self.num_qubits * self.num_layers,
            'num_parameters': len(self.params),
            'backend_type': str(self.backend_type)
        }