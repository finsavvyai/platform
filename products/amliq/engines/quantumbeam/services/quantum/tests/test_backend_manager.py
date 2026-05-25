import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime, timedelta
import time

from backends.backend_manager import (
    QuantumBackendManager, QiskitSimulatorBackend, IBMQuantumBackend
)
from core.models import (
    QuantumCircuit, CircuitExecutionResult, QuantumBackendType,
    ProcessingStatus, CircuitType
)
from config.quantum_config import QuantumConfig


class TestQuantumBackendManager:
    """Test suite for Quantum Backend Manager"""

    @pytest.fixture
    def config(self):
        """Create test configuration"""
        return QuantumConfig(
            service_name="test_service",
            default_backend="simulator",
            max_qubits=16,
            max_shots=1024,
            optimization_level=3,
            ibm_quantum_token="test_token",
            circuit_timeout=30
        )

    @pytest.fixture
    def backend_manager(self, config):
        """Create backend manager instance"""
        return QuantumBackendManager(config)

    @pytest.fixture
    def sample_circuit(self):
        """Create sample quantum circuit"""
        return QuantumCircuit(
            circuit_id="test_circuit_001",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=10,
            gate_count=25,
            parameters={"param_1": 0.5, "param_2": 1.2},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.SIMULATOR
        )

    def test_backend_manager_initialization(self, backend_manager):
        """Test backend manager initialization"""
        assert QuantumBackendType.SIMULATOR in backend_manager.backends
        assert backend_manager.backend_priorities[QuantumBackendType.SIMULATOR] == 1

        # Should initialize IBM Quantum backend if token provided
        if backend_manager.config.ibm_quantum_token:
            assert QuantumBackendType.IBM_QUANTUM in backend_manager.backends
            assert backend_manager.backend_priorities[QuantumBackendType.IBM_QUANTUM] == 3

    def test_backend_manager_initialization_no_token(self):
        """Test backend manager initialization without IBM token"""
        config = QuantumConfig(ibm_quantum_token=None)
        manager = QuantumBackendManager(config)

        assert QuantumBackendType.SIMULATOR in manager.backends
        # Should not initialize IBM Quantum without token
        if not config.ibm_quantum_token:
            assert QuantumBackendType.IBM_QUANTUM not in manager.backends

    @pytest.mark.asyncio
    async def test_start_health_checks(self, backend_manager):
        """Test starting health checks"""
        await backend_manager.start_health_checks()
        assert backend_manager._health_check_task is not None

        # Clean up
        await backend_manager.stop_health_checks()

    @pytest.mark.asyncio
    async def test_stop_health_checks(self, backend_manager):
        """Test stopping health checks"""
        await backend_manager.start_health_checks()
        await backend_manager.stop_health_checks()
        assert backend_manager._health_check_task is None

    @pytest.mark.asyncio
    async def test_execute_circuit_success(self, backend_manager, sample_circuit):
        """Test successful circuit execution"""
        result = await backend_manager.execute_circuit(
            sample_circuit,
            shots=512,
            timeout=10
        )

        assert isinstance(result, CircuitExecutionResult)
        assert result.circuit_id == sample_circuit.circuit_id
        assert result.status in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]
        assert result.execution_id is not None
        assert result.execution_time_ms >= 0

    @pytest.mark.asyncio
    async def test_execute_circuit_with_preferred_backend(self, backend_manager, sample_circuit):
        """Test circuit execution with preferred backend"""
        result = await backend_manager.execute_circuit(
            sample_circuit,
            preferred_backend=QuantumBackendType.SIMULATOR,
            shots=256
        )

        assert isinstance(result, CircuitExecutionResult)
        assert result.circuit_id == sample_circuit.circuit_id

    @pytest.mark.asyncio
    async def test_execute_circuit_timeout(self, backend_manager, sample_circuit):
        """Test circuit execution with timeout"""
        result = await backend_manager.execute_circuit(
            sample_circuit,
            timeout=0.001  # Very short timeout
        )

        # Should return error result due to timeout
        assert isinstance(result, CircuitExecutionResult)
        assert result.status == ProcessingStatus.FAILED
        assert "timeout" in result.error_message.lower() or "no available" in result.error_message.lower()

    @pytest.mark.asyncio
    async def test_get_backend_status_single(self, backend_manager):
        """Test getting status of single backend"""
        status = await backend_manager.get_backend_status(QuantumBackendType.SIMULATOR)

        assert isinstance(status, dict)
        assert 'backend' in status
        assert 'is_available' in status
        assert 'qubits_available' in status
        assert 'queue_length' in status
        assert 'estimated_wait_time_seconds' in status
        assert 'current_load_percentage' in status
        assert 'supported_operations' in status
        assert 'quantum_volume' in status

    @pytest.mark.asyncio
    async def test_get_backend_status_all(self, backend_manager):
        """Test getting status of all backends"""
        statuses = await backend_manager.get_backend_status()

        assert isinstance(statuses, dict)
        assert len(statuses) > 0

        for backend_type, status in statuses.items():
            assert isinstance(status, dict)
            assert 'is_available' in status
            assert 'qubits_available' in status

    @pytest.mark.asyncio
    async def test_get_best_backend(self, backend_manager):
        """Test getting best available backend"""
        best_backend = await backend_manager.get_best_backend(min_qubits=4)

        assert best_backend is not None
        assert isinstance(best_backend, QuantumBackendType)

        # Should be available and support required qubits
        backend = backend_manager.backends[best_backend]
        assert backend.is_available
        assert backend.get_max_qubits() >= 4

    @pytest.mark.asyncio
    async def test_get_best_backend_insufficient_qubits(self, backend_manager):
        """Test getting best backend when insufficient qubits available"""
        # Request more qubits than any backend supports
        best_backend = await backend_manager.get_best_backend(min_qubits=1000)

        assert best_backend is None

    def test_get_backend_metrics(self, backend_manager):
        """Test getting backend performance metrics"""
        metrics = backend_manager.get_backend_metrics()

        assert isinstance(metrics, dict)

        # Should include metrics for available backends
        for backend_type in backend_manager.backends.keys():
            if str(backend_type) in metrics:
                backend_metrics = metrics[str(backend_type)]
                assert 'avg_execution_time_ms' in backend_metrics
                assert 'avg_fidelity' in backend_metrics
                assert 'success_rate' in backend_metrics
                assert 'total_executions' in backend_metrics
                assert 'is_available' in backend_metrics
                assert 'max_qubits' in backend_metrics
                assert 'supported_operations' in backend_metrics

    @pytest.mark.asyncio
    async def test_shutdown(self, backend_manager):
        """Test backend manager shutdown"""
        # Start health checks first
        await backend_manager.start_health_checks()

        # Shutdown
        await backend_manager.shutdown()

        # Health check task should be stopped
        assert backend_manager._health_check_task is None

    def test_get_backend_execution_order(self, backend_manager):
        """Test backend execution order selection"""
        # Test with no preferred backend
        order = backend_manager._get_backend_execution_order()
        assert isinstance(order, list)
        assert len(order) > 0

        # Test with preferred backend
        order = backend_manager._get_backend_execution_order(QuantumBackendType.SIMULATOR)
        assert isinstance(order, list)
        assert len(order) > 0
        assert order[0] == QuantumBackendType.SIMULATOR

        # Test with unavailable backends
        for backend in backend_manager.backends.values():
            backend.is_available = False

        order = backend_manager._get_backend_execution_order()
        assert len(order) == 0

    @pytest.mark.asyncio
    async def test_periodic_health_checks(self, backend_manager):
        """Test periodic health check execution"""
        # Mock the health check method
        original_health_check = backend_manager._check_all_backends_health
        backend_manager._check_all_backends_health = AsyncMock()

        try:
            # Start health checks
            await backend_manager.start_health_checks()

            # Wait a bit for health checks to run
            await asyncio.sleep(0.1)

            # Verify health checks were called
            backend_manager._check_all_backends_health.assert_called()

        finally:
            # Restore original method and cleanup
            backend_manager._check_all_backends_health = original_health_check
            await backend_manager.stop_health_checks()


class TestQiskitSimulatorBackend:
    """Test suite for Qiskit Simulator Backend"""

    @pytest.fixture
    def config(self):
        """Create test configuration"""
        return QuantumConfig(
            default_backend="simulator",
            max_qubits=16,
            max_shots=1024,
            optimization_level=3
        )

    @pytest.fixture
    def simulator_backend(self, config):
        """Create simulator backend instance"""
        return QiskitSimulatorBackend(config)

    @pytest.fixture
    def sample_circuit(self):
        """Create sample quantum circuit"""
        return QuantumCircuit(
            circuit_id="test_sim_circuit",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=5,
            gate_count=12,
            parameters={"param_1": 0.5},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.SIMULATOR
        )

    def test_simulator_backend_initialization(self, simulator_backend):
        """Test simulator backend initialization"""
        assert simulator_backend.backend_type == QuantumBackendType.SIMULATOR
        assert simulator_backend.is_available is True
        assert hasattr(simulator_backend, 'backend')

    @pytest.mark.asyncio
    async def test_execute_circuit_success(self, simulator_backend, sample_circuit):
        """Test successful circuit execution on simulator"""
        result = await simulator_backend.execute_circuit(sample_circuit, shots=512)

        assert isinstance(result, CircuitExecutionResult)
        assert result.circuit_id == sample_circuit.circuit_id
        assert result.status == ProcessingStatus.COMPLETED
        assert result.counts is not None
        assert len(result.counts) > 0
        assert result.execution_time_ms > 0
        assert result.quantum_volume == 128
        assert result.fidelity == 1.0
        assert result.error_rate == 0.0

    @pytest.mark.asyncio
    async def test_execute_circuit_different_shots(self, simulator_backend, sample_circuit):
        """Test circuit execution with different shot counts"""
        shots_list = [100, 512, 1024, 2048]

        for shots in shots_list:
            result = await simulator_backend.execute_circuit(sample_circuit, shots=shots)

            assert result.status == ProcessingStatus.COMPLETED
            assert sum(result.counts.values()) == shots

    @pytest.mark.asyncio
    async def test_get_backend_status(self, simulator_backend):
        """Test getting simulator backend status"""
        status = await simulator_backend.get_backend_status()

        assert isinstance(status, dict)
        assert status['backend'] == QuantumBackendType.SIMULATOR
        assert status['is_available'] is True
        assert status['qubits_available'] > 0
        assert status['queue_length'] == 0
        assert status['estimated_wait_time_seconds'] == 0
        assert status['current_load_percentage'] == 0.0
        assert isinstance(status['supported_operations'], list)
        assert len(status['supported_operations']) > 0

    @pytest.mark.asyncio
    async def test_health_check(self, simulator_backend):
        """Test simulator health check"""
        is_healthy = await simulator_backend.health_check()
        assert is_healthy is True
        assert simulator_backend.last_health_check > datetime.utcnow() - timedelta(seconds=10)

    def test_get_supported_operations(self, simulator_backend):
        """Test getting supported operations"""
        operations = simulator_backend.get_supported_operations()

        assert isinstance(operations, list)
        assert len(operations) > 0
        assert 'x' in operations
        assert 'h' in operations
        assert 'cx' in operations
        assert 'measure' in operations

    def test_get_max_qubits(self, simulator_backend):
        """Test getting maximum qubits"""
        max_qubits = simulator_backend.get_max_qubits()
        assert isinstance(max_qubits, int)
        assert max_qubits > 0
        assert max_qubits <= simulator_backend.config.max_qubits

    @patch('core.vqc_classifier.QISKIT_AVAILABLE', False)
    def test_simulator_without_qiskit(self, config):
        """Test simulator backend when Qiskit is not available"""
        with patch('backends.backend_manager.QISKIT_AVAILABLE', False):
            backend = QiskitSimulatorBackend(config)
            assert backend.backend is None

            # Execution should return mock result
            circuit = QuantumCircuit(
                circuit_id="test",
                circuit_type=CircuitType.VQC_FRAUD,
                num_qubits=2,
                num_clbits=2,
                depth=1,
                gate_count=2,
                parameters={},
                measurements=["z0", "z1"],
                backend=QuantumBackendType.SIMULATOR
            )

            result = asyncio.run(backend.execute_circuit(circuit))
            assert result.status == ProcessingStatus.FAILED
            assert result.error_message is not None


class TestIBMQuantumBackend:
    """Test suite for IBM Quantum Backend"""

    @pytest.fixture
    def config(self):
        """Create test configuration"""
        return QuantumConfig(
            ibm_quantum_token="test_token_12345",
            ibm_quantum_hub="test_hub",
            ibm_quantum_group="test_group",
            ibm_quantum_project="test_project",
            max_qubits=27,
            max_shots=8192
        )

    @pytest.fixture
    def ibm_backend(self, config):
        """Create IBM Quantum backend instance"""
        return IBMQuantumBackend(config)

    def test_ibm_backend_initialization(self, ibm_backend):
        """Test IBM Quantum backend initialization"""
        assert ibm_backend.backend_type == QuantumBackendType.IBM_QUANTUM
        assert ibm_backend.token == "test_token_12345"
        assert ibm_backend.hub == "test_hub"
        assert ibm_backend.group == "test_group"
        assert ibm_backend.project == "test_project"

    @patch('backends.backend_manager.QISKIT_AVAILABLE', False)
    def test_ibm_backend_without_qiskit(self, config):
        """Test IBM backend when Qiskit is not available"""
        with patch('backends.backend_manager.QISKIT_AVAILABLE', False):
            backend = IBMQuantumBackend(config)
            assert backend.service is None
            assert backend.provider is None

    @pytest.mark.asyncio
    async def test_get_backend_status_without_service(self, ibm_backend):
        """Test getting backend status when IBM service is not available"""
        # Mock the service as None
        ibm_backend.service = None

        status = await ibm_backend.get_backend_status()

        assert isinstance(status, dict)
        assert status['backend'] == QuantumBackendType.IBM_QUANTUM
        assert status['is_available'] is False
        assert status['qubits_available'] == 0

    @pytest.mark.asyncio
    async def test_health_check_without_service(self, ibm_backend):
        """Test health check when IBM service is not available"""
        # Mock the service as None
        ibm_backend.service = None

        is_healthy = await ibm_backend.health_check()
        assert is_healthy is False

    def test_get_supported_operations(self, ibm_backend):
        """Test getting supported operations for IBM Quantum"""
        operations = ibm_backend.get_supported_operations()

        assert isinstance(operations, list)
        assert len(operations) > 0
        assert 'x' in operations
        assert 'h' in operations
        assert 'cx' in operations
        assert 'u3' in operations
        assert 'measure' in operations

    def test_get_max_qubits(self, ibm_backend):
        """Test getting maximum qubits for IBM Quantum"""
        max_qubits = ibm_backend.get_max_qubits()
        assert isinstance(max_qubits, int)
        assert max_qubits > 0
        assert max_qubits <= 127  # IBM Quantum maximum

    @pytest.mark.asyncio
    async def test_get_best_available_backend(self, ibm_backend):
        """Test getting best available backend"""
        # Mock the service and backends
        mock_backend = Mock()
        mock_backend.configuration.return_value.n_qubits = 27
        mock_backend.status.return_value.operational = True
        mock_backend.status.return_value.status_msg = "active"
        mock_backend.status.return_value.pending_jobs = 5

        ibm_backend.service = Mock()
        ibm_backend.service.backends.return_value = [mock_backend]

        best_backend = await ibm_backend._get_best_available_backend(10)
        assert best_backend is not None

    @pytest.mark.asyncio
    async def test_get_best_available_backend_no_suitable(self, ibm_backend):
        """Test getting best backend when none are suitable"""
        # Mock service with backends that don't meet requirements
        mock_backend = Mock()
        mock_backend.configuration.return_value.n_qubits = 5  # Too few qubits
        mock_backend.status.return_value.operational = False  # Not operational

        ibm_backend.service = Mock()
        ibm_backend.service.backends.return_value = [mock_backend]

        best_backend = await ibm_backend._get_best_available_backend(10)
        assert best_backend is None

    def test_mock_execution_result(self, ibm_backend):
        """Test mock execution result creation"""
        circuit = QuantumCircuit(
            circuit_id="test_ibm_circuit",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=10,
            gate_count=20,
            parameters={},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.IBM_QUANTUM
        )

        result = ibm_backend._create_mock_result(circuit, "Test error")

        assert isinstance(result, CircuitExecutionResult)
        assert result.circuit_id == circuit.circuit_id
        assert result.status == ProcessingStatus.FAILED
        assert result.error_message == "Test error"
        assert result.execution_time_ms == 1000


class TestBackendIntegration:
    """Integration tests for backend management"""

    @pytest.fixture
    def config(self):
        """Create test configuration"""
        return QuantumConfig(
            default_backend="simulator",
            max_qubits=16,
            max_shots=1024,
            optimization_level=2
        )

    @pytest.fixture
    def backend_manager(self, config):
        """Create backend manager instance"""
        return QuantumBackendManager(config)

    @pytest.mark.asyncio
    async def test_end_to_end_circuit_execution(self, backend_manager):
        """Test end-to-end circuit execution"""
        # Create circuit
        circuit = QuantumCircuit(
            circuit_id="e2e_test_circuit",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=8,
            gate_count=16,
            parameters={"theta1": 0.5, "theta2": 1.0},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.SIMULATOR
        )

        # Execute circuit
        result = await backend_manager.execute_circuit(circuit, shots=1024)

        # Verify result
        assert isinstance(result, CircuitExecutionResult)
        assert result.status == ProcessingStatus.COMPLETED
        assert result.counts is not None
        assert sum(result.counts.values()) == 1024
        assert result.execution_time_ms > 0

    @pytest.mark.asyncio
    async def test_concurrent_circuit_executions(self, backend_manager):
        """Test concurrent circuit executions"""
        circuits = []
        for i in range(5):
            circuit = QuantumCircuit(
                circuit_id=f"concurrent_circuit_{i}",
                circuit_type=CircuitType.VQC_FRAUD,
                num_qubits=4,
                num_clbits=4,
                depth=5,
                gate_count=10,
                parameters={},
                measurements=["z0", "z1", "z2", "z3"],
                backend=QuantumBackendType.SIMULATOR
            )
            circuits.append(circuit)

        # Execute circuits concurrently
        start_time = time.time()
        results = await asyncio.gather(*[
            backend_manager.execute_circuit(circuit, shots=512)
            for circuit in circuits
        ])
        end_time = time.time()

        # Verify results
        assert len(results) == 5
        for result in results:
            assert isinstance(result, CircuitExecutionResult)
            assert result.status == ProcessingStatus.COMPLETED
            assert sum(result.counts.values()) == 512

        # Should complete reasonably fast
        total_time = end_time - start_time
        assert total_time < 10.0

    @pytest.mark.asyncio
    async def test_backend_failover(self, backend_manager):
        """Test backend failover mechanism"""
        # Create a circuit
        circuit = QuantumCircuit(
            circuit_id="failover_test",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=3,
            gate_count=6,
            parameters={},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.SIMULATOR
        )

        # Make all backends unavailable except simulator
        for backend_type, backend in backend_manager.backends.items():
            if backend_type != QuantumBackendType.SIMULATOR:
                backend.is_available = False

        # Should still work with simulator
        result = await backend_manager.execute_circuit(circuit, shots=256)

        assert isinstance(result, CircuitExecutionResult)
        assert result.status == ProcessingStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_performance_metrics_collection(self, backend_manager):
        """Test performance metrics collection during execution"""
        circuit = QuantumCircuit(
            circuit_id="metrics_test",
            circuit_type=CircuitType.VQC_FRAUD,
            num_qubits=4,
            num_clbits=4,
            depth=5,
            gate_count=10,
            parameters={},
            measurements=["z0", "z1", "z2", "z3"],
            backend=QuantumBackendType.SIMULATOR
        )

        # Execute multiple circuits to generate metrics
        for _ in range(3):
            await backend_manager.execute_circuit(circuit, shots=512)

        # Get metrics
        metrics = backend_manager.get_backend_metrics()

        assert isinstance(metrics, dict)
        assert len(metrics) > 0

        # Should have metrics for simulator
        simulator_metrics = metrics.get(str(QuantumBackendType.SIMULATOR))
        if simulator_metrics:
            assert 'total_executions' in simulator_metrics
            assert 'avg_execution_time_ms' in simulator_metrics
            assert 'success_rate' in simulator_metrics
            assert simulator_metrics['total_executions'] >= 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])