import asyncio
import logging
from typing import Dict, List, Optional, Any, Union
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
import json
import aiohttp
import numpy as np

from ..core.models import (
    QuantumBackendType, QuantumBackendStatus, QuantumCircuit,
    CircuitExecutionResult, ProcessingStatus, QuantumPerformanceMetrics
)
from ..config.quantum_config import QuantumConfig, QUANTUM_BACKENDS, PERFORMANCE_BENCHMARKS

logger = logging.getLogger(__name__)


class QuantumBackendInterface(ABC):
    """Abstract interface for quantum backends"""

    def __init__(self, config: QuantumConfig):
        self.config = config
        self.backend_type = QuantumBackendType.SIMULATOR
        self.is_available = True
        self.last_health_check = datetime.utcnow()
        self.performance_metrics = []

    @abstractmethod
    async def execute_circuit(self, circuit: QuantumCircuit, shots: int = 1024) -> CircuitExecutionResult:
        """Execute a quantum circuit"""
        pass

    @abstractmethod
    async def get_backend_status(self) -> QuantumBackendStatus:
        """Get backend status and availability"""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Perform health check on the backend"""
        pass

    @abstractmethod
    def get_supported_operations(self) -> List[str]:
        """Get list of supported quantum operations"""
        pass

    @abstractmethod
    def get_max_qubits(self) -> int:
        """Get maximum number of qubits supported"""
        pass


class QiskitSimulatorBackend(QuantumBackendInterface):
    """Qiskit Aer Simulator backend"""

    def __init__(self, config: QuantumConfig):
        super().__init__(config)
        self.backend_type = QuantumBackendType.SIMULATOR

        try:
            from qiskit import Aer
            from qiskit.providers.aer import AerSimulator
            self.backend = AerSimulator()
            self._initialize_backend()
        except ImportError:
            logger.error("Qiskit not available for simulator backend")
            self.backend = None

    def _initialize_backend(self):
        """Initialize Qiskit simulator backend"""
        if self.backend:
            # Configure simulator options
            self.backend.set_options(
                method='automatic',
                device='CPU',
                seed_simulator=42,
                max_memory_mb=8192
            )

    async def execute_circuit(self, circuit: QuantumCircuit, shots: int = 1024) -> CircuitExecutionResult:
        """Execute circuit on Qiskit simulator"""
        import time
        start_time = time.time()

        if not self.backend:
            return self._create_mock_result(circuit, "Backend not available")

        try:
            from qiskit import transpile, execute

            # Transpile circuit for backend
            transpiled_circuit = transpile(circuit, self.backend, optimization_level=self.config.optimization_level)

            # Execute circuit
            job = execute(transpiled_circuit, self.backend, shots=shots, seed_transpiler=42)
            result = job.result()
            counts = result.get_counts()

            execution_time_ms = int((time.time() - start_time) * 1000)

            # Calculate metrics
            circuit_depth = transpiled_circuit.depth()
            gate_count = sum(len(instruction) for instruction, _, _ in transpiled_circuit.data)

            execution_result = CircuitExecutionResult(
                execution_id=f"sim_exec_{int(time.time() * 1000)}",
                circuit_id=circuit.circuit_id,
                status=ProcessingStatus.COMPLETED,
                counts=counts,
                measurement_results=[{'state': state, 'count': count} for state, count in counts.items()],
                execution_time_ms=execution_time_ms,
                quantum_volume=128,  # Simulator quantum volume
                fidelity=1.0,  # Perfect fidelity for simulator
                error_rate=0.0,
                backend_info={
                    'backend_name': 'aer_simulator',
                    'shots': shots,
                    'optimization_level': self.config.optimization_level,
                    'circuit_depth': circuit_depth,
                    'gate_count': gate_count
                }
            )

            # Update performance metrics
            self._update_performance_metrics(execution_result)

            return execution_result

        except Exception as e:
            logger.error(f"Error executing circuit on simulator: {e}")
            return self._create_mock_result(circuit, str(e))

    async def get_backend_status(self) -> QuantumBackendStatus:
        """Get simulator backend status"""
        return QuantumBackendStatus(
            backend=self.backend_type,
            is_available=self.backend is not None,
            qubits_available=self.config.max_qubits,
            queue_length=0,
            estimated_wait_time_seconds=0,
            current_load_percentage=0.0,
            supported_operations=self.get_supported_operations(),
            quantum_volume=128,
            last_health_check=datetime.utcnow()
        )

    async def health_check(self) -> bool:
        """Perform health check on simulator"""
        try:
            if not self.backend:
                return False

            # Execute a simple test circuit
            from qiskit import QuantumCircuit
            test_circuit = QuantumCircuit(1, 1)
            test_circuit.h(0)
            test_circuit.measure(0, 0)

            from qiskit import execute
            job = execute(test_circuit, self.backend, shots=10)
            result = job.result()

            self.last_health_check = datetime.utcnow()
            return True

        except Exception as e:
            logger.error(f"Simulator health check failed: {e}")
            return False

    def get_supported_operations(self) -> List[str]:
        """Get supported quantum operations"""
        return [
            'x', 'y', 'z', 'h', 's', 'sdg', 't', 'tdg',
            'rx', 'ry', 'rz', 'cx', 'cz', 'ch', 'swap',
            'ccx', 'cswap', 'u1', 'u2', 'u3', 'measure',
            'reset', 'barrier'
        ]

    def get_max_qubits(self) -> int:
        """Get maximum qubits supported"""
        return self.config.max_qubits

    def _create_mock_result(self, circuit: QuantumCircuit, error_message: str) -> CircuitExecutionResult:
        """Create mock result when backend unavailable"""
        return CircuitExecutionResult(
            execution_id=f"mock_{int(datetime.utcnow().timestamp())}",
            circuit_id=circuit.circuit_id,
            status=ProcessingStatus.FAILED,
            counts={'0': 512, '1': 512},
            measurement_results=[{'state': '0', 'count': 512}, {'state': '1', 'count': 512}],
            execution_time_ms=10,
            backend_info={'error': error_message},
            error_message=error_message
        )

    def _update_performance_metrics(self, result: CircuitExecutionResult):
        """Update performance metrics history"""
        metric = QuantumPerformanceMetrics(
            backend=self.backend_type,
            circuit_type=circuit.circuit_type if 'circuit' in locals() else None,
            avg_execution_time_ms=result.execution_time_ms,
            success_rate=1.0 if result.status == ProcessingStatus.COMPLETED else 0.0,
            quantum_volume=result.quantum_volume or 128,
            fidelity=result.fidelity or 1.0,
            qubit_utilization=1.0,
            gate_errors_per_1000=0.0
        )
        self.performance_metrics.append(metric)

        # Keep only last 100 metrics
        self.performance_metrics = self.performance_metrics[-100:]


class IBMQuantumBackend(QuantumBackendInterface):
    """IBM Quantum backend implementation"""

    def __init__(self, config: QuantumConfig):
        super().__init__(config)
        self.backend_type = QuantumBackendType.IBM_QUANTUM
        self.token = config.ibm_quantum_token
        self.hub = config.ibm_quantum_hub
        self.group = config.ibm_quantum_group
        self.project = config.ibm_quantum_project

        # Try to initialize IBM Quantum connection
        self._initialize_ibm_quantum()

    def _initialize_ibm_quantum(self):
        """Initialize IBM Quantum connection"""
        try:
            from qiskit_ibm_runtime import QiskitRuntimeService
            from qiskit_ibm_provider import IBMProvider

            if self.token:
                self.service = QiskitRuntimeService(
                    channel='ibm_quantum',
                    token=self.token,
                    instance=f"{self.hub}/{self.group}/{self.project}" if all([self.hub, self.group, self.project]) else None
                )
                self.provider = IBMProvider(token=self.token)
                logger.info("IBM Quantum connection established")
            else:
                logger.warning("IBM Quantum token not provided")
                self.service = None
                self.provider = None

        except ImportError:
            logger.error("Qiskit IBM Runtime not available")
            self.service = None
            self.provider = None
        except Exception as e:
            logger.error(f"Failed to initialize IBM Quantum: {e}")
            self.service = None
            self.provider = None

    async def execute_circuit(self, circuit: QuantumCircuit, shots: int = 1024) -> CircuitExecutionResult:
        """Execute circuit on IBM Quantum hardware"""
        import time
        start_time = time.time()

        if not self.service:
            return self._create_mock_result(circuit, "IBM Quantum not connected")

        try:
            from qiskit import transpile
            from qiskit_ibm_runtime import Session, Sampler

            # Get available backend
            backend = await self._get_best_available_backend(circuit.num_qubits)
            if not backend:
                return self._create_mock_result(circuit, "No suitable backend available")

            # Transpile circuit
            transpiled_circuit = transpile(
                circuit,
                backend=backend,
                optimization_level=self.config.optimization_level,
                seed_transpiler=42
            )

            # Execute using Runtime
            with Session(backend=backend) as session:
                sampler = Sampler(session=session)
                job = sampler.run(transpiled_circuit, shots=shots)
                result = job.result()

            # Process results
            counts = result.quasi_dists[0].binary_probabilities()
            counts_int = {f"{k:0{circuit.num_qubits}b}": int(v * shots) for k, v in counts.items()}

            execution_time_ms = int((time.time() - start_time) * 1000)

            # Get backend properties for metrics
            backend_properties = backend.properties()
            quantum_volume = backend.configuration().quantum_volume if hasattr(backend.configuration(), 'quantum_volume') else 0

            return CircuitExecutionResult(
                execution_id=f"ibm_exec_{int(time.time() * 1000)}",
                circuit_id=circuit.circuit_id,
                status=ProcessingStatus.COMPLETED,
                counts=counts_int,
                measurement_results=[{'state': state, 'count': count} for state, count in counts_int.items()],
                execution_time_ms=execution_time_ms,
                quantum_volume=quantum_volume,
                fidelity=0.95,  # Estimated based on hardware
                error_rate=0.05,
                backend_info={
                    'backend_name': backend.name,
                    'shots': shots,
                    'job_id': job.job_id(),
                    'queue_info': getattr(job, 'queue_info', None)
                }
            )

        except Exception as e:
            logger.error(f"Error executing circuit on IBM Quantum: {e}")
            return self._create_mock_result(circuit, str(e))

    async def get_backend_status(self) -> QuantumBackendStatus:
        """Get IBM Quantum backend status"""
        try:
            if not self.service:
                return QuantumBackendStatus(
                    backend=self.backend_type,
                    is_available=False,
                    qubits_available=0,
                    queue_length=0,
                    estimated_wait_time_seconds=0,
                    current_load_percentage=100.0,
                    supported_operations=[],
                    quantum_volume=0,
                    last_health_check=datetime.utcnow()
                )

            # Get backend information
            backends = self.service.backends()
            if not backends:
                return QuantumBackendStatus(
                    backend=self.backend_type,
                    is_available=False,
                    qubits_available=0,
                    queue_length=0,
                    estimated_wait_time_seconds=0,
                    current_load_percentage=100.0,
                    supported_operations=[],
                    quantum_volume=0,
                    last_health_check=datetime.utcnow()
                )

            # Use the best available backend
            best_backend = await self._get_best_available_backend(5)
            if best_backend:
                status = best_backend.status()
                properties = best_backend.properties()
                config = best_backend.configuration()

                return QuantumBackendStatus(
                    backend=self.backend_type,
                    is_available=status.operational and status.status_msg == "active",
                    qubits_available=config.n_qubits,
                    queue_length=status.pending_jobs,
                    estimated_wait_time_seconds=status.pending_jobs * 300,  # Rough estimate
                    current_load_percentage=min(100.0, (status.pending_jobs / 10) * 100),
                    supported_operations=self.get_supported_operations(),
                    quantum_volume=getattr(config, 'quantum_volume', 0),
                    last_health_check=datetime.utcnow()
                )

        except Exception as e:
            logger.error(f"Error getting IBM Quantum status: {e}")

        return QuantumBackendStatus(
            backend=self.backend_type,
            is_available=False,
            qubits_available=0,
            queue_length=0,
            estimated_wait_time_seconds=0,
            current_load_percentage=100.0,
            supported_operations=[],
            quantum_volume=0,
            last_health_check=datetime.utcnow()
        )

    async def health_check(self) -> bool:
        """Perform health check on IBM Quantum"""
        try:
            if not self.service:
                return False

            # Try to list backends
            backends = self.service.backends()
            if backends:
                self.last_health_check = datetime.utcnow()
                return True

            return False

        except Exception as e:
            logger.error(f"IBM Quantum health check failed: {e}")
            return False

    def get_supported_operations(self) -> List[str]:
        """Get supported quantum operations for IBM Quantum"""
        return [
            'x', 'y', 'z', 'h', 's', 'sdg', 't', 'tdg',
            'rx', 'ry', 'rz', 'cx', 'cy', 'cz', 'ch', 'swap',
            'ccx', 'rxx', 'ryy', 'rzz', 'rzx', 'u1', 'u2', 'u3',
            'id', 'u', 'p', 'sx', 'measure', 'reset', 'barrier'
        ]

    def get_max_qubits(self) -> int:
        """Get maximum qubits supported"""
        return min(self.config.max_qubits, 127)  # IBM Quantum max qubits

    async def _get_best_available_backend(self, min_qubits: int) -> Optional[Any]:
        """Get the best available IBM Quantum backend"""
        try:
            backends = self.service.backends()

            # Filter backends by qubit count and availability
            suitable_backends = []
            for backend in backends:
                config = backend.configuration()
                status = backend.status()

                if (config.n_qubits >= min_qubits and
                    status.operational and
                    status.status_msg == "active"):
                    suitable_backends.append((backend, status.pending_jobs))

            # Sort by queue length (fewest jobs first)
            suitable_backends.sort(key=lambda x: x[1])

            return suitable_backends[0][0] if suitable_backends else None

        except Exception as e:
            logger.error(f"Error getting best IBM Quantum backend: {e}")
            return None

    def _create_mock_result(self, circuit: QuantumCircuit, error_message: str) -> CircuitExecutionResult:
        """Create mock result when backend unavailable"""
        return CircuitExecutionResult(
            execution_id=f"mock_ibm_{int(datetime.utcnow().timestamp())}",
            circuit_id=circuit.circuit_id,
            status=ProcessingStatus.FAILED,
            counts={'0': 500, '1': 524},
            measurement_results=[{'state': '0', 'count': 500}, {'state': '1', 'count': 524}],
            execution_time_ms=1000,
            backend_info={'error': error_message},
            error_message=error_message
        )


class QuantumBackendManager:
    """Manager for multiple quantum backends with load balancing and failover"""

    def __init__(self, config: QuantumConfig):
        self.config = config
        self.backends = {}
        self.backend_priorities = {}
        self.health_check_interval = 60  # seconds
        self._health_check_task = None

        # Initialize backends
        self._initialize_backends()

    def _initialize_backends(self):
        """Initialize all available quantum backends"""
        # Always include simulator
        self.backends[QuantumBackendType.SIMULATOR] = QiskitSimulatorBackend(self.config)
        self.backend_priorities[QuantumBackendType.SIMULATOR] = 1

        # Initialize IBM Quantum if configured
        if self.config.ibm_quantum_token:
            try:
                self.backends[QuantumBackendType.IBM_QUANTUM] = IBMQuantumBackend(self.config)
                self.backend_priorities[QuantumBackendType.IBM_QUANTUM] = 3  # Higher priority for real hardware
            except Exception as e:
                logger.error(f"Failed to initialize IBM Quantum backend: {e}")

        # TODO: Add other backends (Amazon Braket, Google Quantum) as needed

    async def start_health_checks(self):
        """Start periodic health checks for all backends"""
        if self._health_check_task:
            return

        self._health_check_task = asyncio.create_task(self._periodic_health_checks())

    async def stop_health_checks(self):
        """Stop periodic health checks"""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None

    async def _periodic_health_checks(self):
        """Perform periodic health checks"""
        while True:
            try:
                await self._check_all_backends_health()
                await asyncio.sleep(self.health_check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic health check: {e}")
                await asyncio.sleep(10)  # Short retry interval on error

    async def _check_all_backends_health(self):
        """Check health of all backends"""
        for backend_type, backend in self.backends.items():
            try:
                is_healthy = await backend.health_check()
                backend.is_available = is_healthy
                if not is_healthy:
                    logger.warning(f"Backend {backend_type} health check failed")
            except Exception as e:
                logger.error(f"Health check error for {backend_type}: {e}")
                backend.is_available = False

    async def execute_circuit(
        self,
        circuit: QuantumCircuit,
        preferred_backend: Optional[QuantumBackendType] = None,
        shots: int = 1024,
        timeout: Optional[float] = None
    ) -> CircuitExecutionResult:
        """
        Execute circuit on the best available backend

        Args:
            circuit: Quantum circuit to execute
            preferred_backend: Preferred backend type
            shots: Number of measurement shots
            timeout: Execution timeout in seconds

        Returns:
            Circuit execution result
        """
        # Determine execution order
        backend_order = self._get_backend_execution_order(preferred_backend)

        for backend_type in backend_order:
            backend = self.backends.get(backend_type)

            if not backend or not backend.is_available:
                continue

            # Check if backend supports required qubits
            if backend.get_max_qubits() < circuit.num_qubits:
                continue

            try:
                logger.info(f"Executing circuit on {backend_type}")
                result = await asyncio.wait_for(
                    backend.execute_circuit(circuit, shots),
                    timeout=timeout or self.config.circuit_timeout
                )
                return result

            except asyncio.TimeoutError:
                logger.warning(f"Circuit execution timeout on {backend_type}")
                continue
            except Exception as e:
                logger.error(f"Error executing circuit on {backend_type}: {e}")
                continue

        # All backends failed, return error result
        return CircuitExecutionResult(
            execution_id=f"failed_{int(datetime.utcnow().timestamp())}",
            circuit_id=circuit.circuit_id,
            status=ProcessingStatus.FAILED,
            counts={},
            measurement_results=[],
            execution_time_ms=0,
            backend_info={'error': 'No available backends'},
            error_message='All backends unavailable or failed'
        )

    def _get_backend_execution_order(
        self, preferred_backend: Optional[QuantumBackendType] = None
    ) -> List[QuantumBackendType]:
        """Get ordered list of backends for circuit execution"""
        available_backends = [
            backend_type for backend_type, backend in self.backends.items()
            if backend.is_available
        ]

        if not available_backends:
            return []

        # Sort by priority (higher priority first)
        available_backends.sort(
            key=lambda x: self.backend_priorities.get(x, 0),
            reverse=True
        )

        # Put preferred backend first if specified and available
        if preferred_backend and preferred_backend in available_backends:
            available_backends.remove(preferred_backend)
            available_backends.insert(0, preferred_backend)

        return available_backends

    async def get_backend_status(self, backend_type: Optional[QuantumBackendType] = None) -> Union[QuantumBackendStatus, Dict[QuantumBackendType, QuantumBackendStatus]]:
        """Get status of backend(s)"""
        if backend_type:
            backend = self.backends.get(backend_type)
            if backend:
                return await backend.get_backend_status()
            else:
                raise ValueError(f"Backend {backend_type} not found")
        else:
            statuses = {}
            for backend_type, backend in self.backends.items():
                statuses[backend_type] = await backend.get_backend_status()
            return statuses

    async def get_best_backend(self, min_qubits: int = 1) -> Optional[QuantumBackendType]:
        """Get the best available backend for given requirements"""
        backend_order = self._get_backend_execution_order()

        for backend_type in backend_order:
            backend = self.backends.get(backend_type)
            if backend and backend.is_available and backend.get_max_qubits() >= min_qubits:
                return backend_type

        return None

    def get_backend_metrics(self) -> Dict[str, Any]:
        """Get performance metrics for all backends"""
        metrics = {}

        for backend_type, backend in self.backends.items():
            if hasattr(backend, 'performance_metrics') and backend.performance_metrics:
                recent_metrics = backend.performance_metrics[-10:]  # Last 10 executions

                if recent_metrics:
                    avg_time = np.mean([m.avg_execution_time_ms for m in recent_metrics])
                    avg_fidelity = np.mean([m.fidelity for m in recent_metrics])
                    success_rate = np.mean([m.success_rate for m in recent_metrics])

                    metrics[str(backend_type)] = {
                        'avg_execution_time_ms': avg_time,
                        'avg_fidelity': avg_fidelity,
                        'success_rate': success_rate,
                        'total_executions': len(backend.performance_metrics),
                        'is_available': backend.is_available,
                        'max_qubits': backend.get_max_qubits(),
                        'supported_operations': backend.get_supported_operations()
                    }

        return metrics

    async def shutdown(self):
        """Shutdown backend manager and cleanup resources"""
        await self.stop_health_checks()
        logger.info("Quantum backend manager shutdown complete")