import numpy as np
import logging
from typing import Dict, List, Tuple, Optional, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

try:
    from qiskit import QuantumCircuit, transpile
    from qiskit.transpiler import PassManager
    from qiskit.transpiler.passes import (
        Optimize1qGates, CXCancellation, CommutativeCancellation,
        RemoveResetInMeasurement, OptimizeSwapBeforeMeasure,
        DepthReduction, ConsolidateGates, UnrollCustomDefinitions
    )
    from qiskit.transpiler.passes.basis import UnrollCustomDefinitions
    from qiskit.transpiler.passes.synthesis import UnitarySynthesis
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False
    logging.warning("Qiskit not available for circuit optimization")

from ..core.models import (
    QuantumCircuit, QuantumOptimizationResult, CircuitType,
    QuantumBackendType
)

logger = logging.getLogger(__name__)


class OptimizationTechnique(str, Enum):
    GATE_CANCELLATION = "gate_cancellation"
    COMMUTATIVE_CANCELLATION = "commutative_cancellation"
    SINGLE_QUBIT_OPTIMIZATION = "single_qubit_optimization"
    DEPTH_REDUCTION = "depth_reduction"
    GATE_CONSOLIDATION = "gate_consolidation"
    SWAP_OPTIMIZATION = "swap_optimization"
    CUSTOM_OPTIMIZATION = "custom_optimization"


@dataclass
class OptimizationResult:
    """Result of circuit optimization"""
    original_depth: int
    optimized_depth: int
    original_gate_count: int
    optimized_gate_count: int
    optimization_time_ms: int
    techniques_used: List[OptimizationTechnique]
    fidelity_impact: float
    success: bool
    error_message: Optional[str] = None


class CircuitOptimizer(ABC):
    """Abstract base class for circuit optimizers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.optimization_history = []

    @abstractmethod
    async def optimize_circuit(
        self,
        circuit: QuantumCircuit,
        target_backend: QuantumBackendType = QuantumBackendType.SIMULATOR
    ) -> OptimizationResult:
        """Optimize a quantum circuit"""
        pass

    @abstractmethod
    def get_supported_techniques(self) -> List[OptimizationTechnique]:
        """Get list of supported optimization techniques"""
        pass


class QiskitCircuitOptimizer(CircuitOptimizer):
    """Qiskit-based circuit optimizer"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.optimization_level = config.get('optimization_level', 3)
        self.max_optimization_time = config.get('max_optimization_time', 30)  # seconds
        self.pass_managers = {}
        self._initialize_pass_managers()

    def _initialize_pass_managers(self):
        """Initialize pass managers for different optimization levels"""
        if not QISKIT_AVAILABLE:
            return

        # Create pass managers for different optimization strategies
        self.pass_managers['basic'] = PassManager([
            UnrollCustomDefinitions(['u3', 'cx']),
            Optimize1qGates(),
            CXCancellation(),
        ])

        self.pass_managers['medium'] = PassManager([
            UnrollCustomDefinitions(['u3', 'cx']),
            Optimize1qGates(),
            CXCancellation(),
            CommutativeCancellation(),
            DepthReduction(),
        ])

        self.pass_managers['aggressive'] = PassManager([
            UnrollCustomDefinitions(['u3', 'cx']),
            Optimize1qGates(),
            CXCancellation(),
            CommutativeCancellation(),
            DepthReduction(),
            ConsolidateGates(),
            UnitarySynthesis(),
        ])

        # Custom pass manager for fraud detection circuits
        self.pass_managers['fraud_optimized'] = PassManager([
            UnrollCustomDefinitions(['u3', 'cx']),
            Optimize1qGates(),
            CXCancellation(),
            RemoveResetInMeasurement(),
            OptimizeSwapBeforeMeasure(),
            DepthReduction(),
            ConsolidateGates(),
        ])

    async def optimize_circuit(
        self,
        circuit: QuantumCircuit,
        target_backend: QuantumBackendType = QuantumBackendType.SIMULATOR
    ) -> OptimizationResult:
        """Optimize quantum circuit using Qiskit transpilation"""
        import time
        start_time = time.time()

        try:
            if not QISKIT_AVAILABLE:
                return self._create_mock_result(circuit, "Qiskit not available")

            # Select optimization strategy based on circuit type
            strategy = self._select_optimization_strategy(circuit, target_backend)
            pass_manager = self.pass_managers.get(strategy)

            if not pass_manager:
                # Fallback to Qiskit transpiler
                return await self._optimize_with_transpiler(circuit, target_backend)

            # Convert to Qiskit circuit (if not already)
            qiskit_circuit = self._convert_to_qiskit_circuit(circuit)

            # Apply optimization passes
            optimized_circuit = pass_manager.run(qiskit_circuit)

            # Calculate metrics
            original_depth = circuit.depth
            optimized_depth = optimized_circuit.depth()
            original_gate_count = circuit.gate_count
            optimized_gate_count = self._count_gates(optimized_circuit)

            optimization_time_ms = int((time.time() - start_time) * 1000)

            # Estimate fidelity impact
            fidelity_impact = self._estimate_fidelity_impact(
                original_depth, optimized_depth, original_gate_count, optimized_gate_count
            )

            # Convert back to our circuit format
            result_circuit = self._convert_from_qiskit_circuit(optimized_circuit, circuit)

            # Determine techniques used
            techniques_used = self._get_techniques_for_strategy(strategy)

            result = OptimizationResult(
                original_depth=original_depth,
                optimized_depth=optimized_depth,
                original_gate_count=original_gate_count,
                optimized_gate_count=optimized_gate_count,
                optimization_time_ms=optimization_time_ms,
                techniques_used=techniques_used,
                fidelity_impact=fidelity_impact,
                success=True
            )

            # Track optimization
            self.optimization_history.append({
                'timestamp': time.time(),
                'circuit_type': circuit.circuit_type,
                'original_depth': original_depth,
                'optimized_depth': optimized_depth,
                'depth_reduction': (original_depth - optimized_depth) / original_depth,
                'gate_reduction': (original_gate_count - optimized_gate_count) / original_gate_count,
                'techniques_used': [t.value for t in techniques_used],
                'optimization_time_ms': optimization_time_ms
            })

            logger.info(f"Circuit optimization completed: depth {original_depth} → {optimized_depth}, "
                       f"gates {original_gate_count} → {optimized_gate_count}")

            return result

        except Exception as e:
            logger.error(f"Circuit optimization failed: {e}")
            return OptimizationResult(
                original_depth=circuit.depth,
                optimized_depth=circuit.depth,
                original_gate_count=circuit.gate_count,
                optimized_gate_count=circuit.gate_count,
                optimization_time_ms=int((time.time() - start_time) * 1000),
                techniques_used=[],
                fidelity_impact=0.0,
                success=False,
                error_message=str(e)
            )

    async def _optimize_with_transpiler(
        self,
        circuit: QuantumCircuit,
        target_backend: QuantumBackendType
    ) -> OptimizationResult:
        """Fallback optimization using Qiskit transpiler"""
        import time
        start_time = time.time()

        try:
            qiskit_circuit = self._convert_to_qiskit_circuit(circuit)

            # Get backend configuration
            backend_config = self._get_backend_config(target_backend)

            # Use transpiler for optimization
            optimized_circuit = transpile(
                qiskit_circuit,
                basis_gates=backend_config['basis_gates'],
                optimization_level=self.optimization_level,
                coupling_map=backend_config.get('coupling_map')
            )

            # Calculate metrics
            original_depth = circuit.depth
            optimized_depth = optimized_circuit.depth()
            original_gate_count = circuit.gate_count
            optimized_gate_count = self._count_gates(optimized_circuit)

            optimization_time_ms = int((time.time() - start_time) * 1000)
            fidelity_impact = self._estimate_fidelity_impact(
                original_depth, optimized_depth, original_gate_count, optimized_gate_count
            )

            return OptimizationResult(
                original_depth=original_depth,
                optimized_depth=optimized_depth,
                original_gate_count=original_gate_count,
                optimized_gate_count=optimized_gate_count,
                optimization_time_ms=optimization_time_ms,
                techniques_used=[OptimizationTechnique.CUSTOM_OPTIMIZATION],
                fidelity_impact=fidelity_impact,
                success=True
            )

        except Exception as e:
            logger.error(f"Transpiler optimization failed: {e}")
            return self._create_mock_result(circuit, str(e))

    def _select_optimization_strategy(
        self,
        circuit: QuantumCircuit,
        target_backend: QuantumBackendType
    ) -> str:
        """Select optimization strategy based on circuit and backend"""
        # Use fraud-optimized strategy for fraud detection circuits
        if circuit.circuit_type in [CircuitType.VQC_FRAUD, CircuitType.QAOA_FRAUD_RING]:
            return 'fraud_optimized'

        # Use aggressive optimization for real quantum hardware
        if target_backend != QuantumBackendType.SIMULATOR:
            return 'aggressive'

        # Use medium optimization for larger circuits
        if circuit.num_qubits > 10 or circuit.depth > 50:
            return 'medium'

        # Use basic optimization for small circuits
        return 'basic'

    def _convert_to_qiskit_circuit(self, circuit: QuantumCircuit) -> 'QuantumCircuit':
        """Convert our circuit format to Qiskit circuit"""
        if not QISKIT_AVAILABLE:
            return None

        qc = QuantumCircuit(circuit.num_qubits, circuit.num_clbits)

        # Reconstruct circuit from parameters and measurements
        # This is a simplified version - in practice would store full circuit structure
        qc.h(range(circuit.num_qubits))  # Add Hadamard gates as example
        qc.measure(range(circuit.num_qubits), range(circuit.num_qubits))

        return qc

    def _convert_from_qiskit_circuit(
        self,
        qiskit_circuit: 'QuantumCircuit',
        original_circuit: QuantumCircuit
    ) -> QuantumCircuit:
        """Convert Qiskit circuit back to our format"""
        return QuantumCircuit(
            circuit_id=f"{original_circuit.circuit_id}_opt",
            circuit_type=original_circuit.circuit_type,
            num_qubits=qiskit_circuit.num_qubits,
            num_clbits=qiskit_circuit.num_clbits,
            depth=qiskit_circuit.depth(),
            gate_count=self._count_gates(qiskit_circuit),
            parameters=original_circuit.parameters,
            measurements=original_circuit.measurements,
            backend=original_circuit.backend
        )

    def _count_gates(self, circuit: 'QuantumCircuit') -> int:
        """Count total number of gates in circuit"""
        if not QISKIT_AVAILABLE:
            return 0

        return len(circuit.data)

    def _estimate_fidelity_impact(
        self,
        original_depth: int,
        optimized_depth: int,
        original_gates: int,
        optimized_gates: int
    ) -> float:
        """Estimate the impact of optimization on circuit fidelity"""
        if original_depth == 0 or original_gates == 0:
            return 0.0

        depth_reduction = (original_depth - optimized_depth) / original_depth
        gate_reduction = (original_gates - optimized_gates) / original_gates

        # Fidelity typically improves with depth and gate reduction
        fidelity_impact = (depth_reduction + gate_reduction) / 2

        # Cap the improvement estimate
        return min(fidelity_impact * 0.1, 0.05)  # Max 5% fidelity improvement

    def _get_techniques_for_strategy(self, strategy: str) -> List[OptimizationTechnique]:
        """Get list of optimization techniques used for a strategy"""
        technique_map = {
            'basic': [
                OptimizationTechnique.GATE_CANCELLATION,
                OptimizationTechnique.SINGLE_QUBIT_OPTIMIZATION
            ],
            'medium': [
                OptimizationTechnique.GATE_CANCELLATION,
                OptimizationTechnique.COMMUTATIVE_CANCELLATION,
                OptimizationTechnique.SINGLE_QUBIT_OPTIMIZATION,
                OptimizationTechnique.DEPTH_REDUCTION
            ],
            'aggressive': [
                OptimizationTechnique.GATE_CANCELLATION,
                OptimizationTechnique.COMMUTATIVE_CANCELLATION,
                OptimizationTechnique.SINGLE_QUBIT_OPTIMIZATION,
                OptimizationTechnique.DEPTH_REDUCTION,
                OptimizationTechnique.GATE_CONSOLIDATION
            ],
            'fraud_optimized': [
                OptimizationTechnique.GATE_CANCELLATION,
                OptimizationTechnique.SINGLE_QUBIT_OPTIMIZATION,
                OptimizationTechnique.SWAP_OPTIMIZATION,
                OptimizationTechnique.DEPTH_REDUCTION
            ]
        }

        return technique_map.get(strategy, [OptimizationTechnique.CUSTOM_OPTIMIZATION])

    def _get_backend_config(self, backend_type: QuantumBackendType) -> Dict[str, Any]:
        """Get backend configuration for transpilation"""
        configs = {
            QuantumBackendType.SIMULATOR: {
                'basis_gates': ['u3', 'cx', 'id'],
                'coupling_map': None
            },
            QuantumBackendType.IBM_QUANTUM: {
                'basis_gates': ['u1', 'u2', 'u3', 'cx', 'id'],
                'coupling_map': None  # Would use actual device coupling map
            },
            QuantumBackendType.AMAZON_BRAKET: {
                'basis_gates': ['rx', 'ry', 'rz', 'cx', 'h', 's', 'sdg', 't', 'tdg', 'id'],
                'coupling_map': None
            },
            QuantumBackendType.GOOGLE_QUANTUM: {
                'basis_gates': ['x', 'y', 'z', 'h', 'cnot', 'rx', 'ry', 'rz', 'id'],
                'coupling_map': None
            }
        }

        return configs.get(backend_type, configs[QuantumBackendType.SIMULATOR])

    def _create_mock_result(self, circuit: QuantumCircuit, error_message: str) -> OptimizationResult:
        """Create mock optimization result when optimization fails"""
        return OptimizationResult(
            original_depth=circuit.depth,
            optimized_depth=circuit.depth,
            original_gate_count=circuit.gate_count,
            optimized_gate_count=circuit.gate_count,
            optimization_time_ms=10,
            techniques_used=[],
            fidelity_impact=0.0,
            success=False,
            error_message=error_message
        )

    def get_supported_techniques(self) -> List[OptimizationTechnique]:
        """Get list of supported optimization techniques"""
        return [
            OptimizationTechnique.GATE_CANCELLATION,
            OptimizationTechnique.COMMUTATIVE_CANCELLATION,
            OptimizationTechnique.SINGLE_QUBIT_OPTIMIZATION,
            OptimizationTechnique.DEPTH_REDUCTION,
            OptimizationTechnique.GATE_CONSOLIDATION,
            OptimizationTechnique.SWAP_OPTIMIZATION,
            OptimizationTechnique.CUSTOM_OPTIMIZATION
        ]

    def get_optimization_metrics(self) -> Dict[str, Any]:
        """Get optimization performance metrics"""
        if not self.optimization_history:
            return {}

        recent_optimizations = self.optimization_history[-20:]  # Last 20 optimizations

        depth_reductions = [opt['depth_reduction'] for opt in recent_optimizations]
        gate_reductions = [opt['gate_reduction'] for opt in recent_optimizations]
        optimization_times = [opt['optimization_time_ms'] for opt in recent_optimizations]

        return {
            'total_optimizations': len(self.optimization_history),
            'avg_depth_reduction': np.mean(depth_reductions),
            'avg_gate_reduction': np.mean(gate_reductions),
            'avg_optimization_time_ms': np.mean(optimization_times),
            'max_depth_reduction': np.max(depth_reductions),
            'max_gate_reduction': np.max(gate_reductions),
            'most_used_techniques': self._get_most_used_techniques(recent_optimizations),
            'optimization_level': self.optimization_level
        }

    def _get_most_used_techniques(self, optimizations: List[Dict]) -> List[str]:
        """Get most frequently used optimization techniques"""
        technique_counts = {}
        for opt in optimizations:
            for technique in opt['techniques_used']:
                technique_counts[technique] = technique_counts.get(technique, 0) + 1

        if not technique_counts:
            return []

        # Sort by frequency and return top 5
        sorted_techniques = sorted(technique_counts.items(), key=lambda x: x[1], reverse=True)
        return [technique for technique, count in sorted_techniques[:5]]


class CircuitOptimizerManager:
    """Manager for circuit optimization with multiple optimizers"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.optimizers = {}
        self._initialize_optimizers()

    def _initialize_optimizers(self):
        """Initialize all available optimizers"""
        if QISKIT_AVAILABLE:
            self.optimizers['qiskit'] = QiskitCircuitOptimizer(self.config)
            logger.info("Qiskit circuit optimizer initialized")
        else:
            logger.warning("Qiskit not available, no optimizers initialized")

    async def optimize_circuit(
        self,
        circuit: QuantumCircuit,
        target_backend: QuantumBackendType = QuantumBackendType.SIMULATOR,
        optimizer_name: Optional[str] = None
    ) -> QuantumOptimizationResult:
        """
        Optimize a quantum circuit using the best available optimizer

        Args:
            circuit: Circuit to optimize
            target_backend: Target quantum backend
            optimizer_name: Specific optimizer to use (optional)

        Returns:
            QuantumOptimizationResult with optimized circuit and metrics
        """
        import time
        start_time = time.time()

        if not self.optimizers:
            # No optimizers available
            return QuantumOptimizationResult(
                original_circuit=circuit,
                optimized_circuit=circuit,
                optimization_time_ms=int((time.time() - start_time) * 1000),
                depth_reduction=0.0,
                gate_reduction=0.0,
                fidelity_improvement=0.0,
                optimization_techniques=[],
                timestamp=time.time()
            )

        # Select optimizer
        if optimizer_name and optimizer_name in self.optimizers:
            optimizer = self.optimizers[optimizer_name]
        else:
            # Use the first available optimizer
            optimizer = list(self.optimizers.values())[0]

        try:
            # Perform optimization
            optimization_result = await optimizer.optimize_circuit(circuit, target_backend)

            if not optimization_result.success:
                logger.warning(f"Optimization failed: {optimization_result.error_message}")
                # Return original circuit
                return QuantumOptimizationResult(
                    original_circuit=circuit,
                    optimized_circuit=circuit,
                    optimization_time_ms=optimization_result.optimization_time_ms,
                    depth_reduction=0.0,
                    gate_reduction=0.0,
                    fidelity_improvement=0.0,
                    optimization_techniques=[],
                    timestamp=time.time()
                )

            # Create optimized circuit (simplified)
            optimized_circuit = QuantumCircuit(
                circuit_id=f"{circuit.circuit_id}_opt",
                circuit_type=circuit.circuit_type,
                num_qubits=circuit.num_qubits,
                num_clbits=circuit.num_clbits,
                depth=optimization_result.optimized_depth,
                gate_count=optimization_result.optimized_gate_count,
                parameters=circuit.parameters,
                measurements=circuit.measurements,
                backend=circuit.backend
            )

            # Calculate reductions
            depth_reduction = (optimization_result.original_depth - optimization_result.optimized_depth) / max(optimization_result.original_depth, 1)
            gate_reduction = (optimization_result.original_gate_count - optimization_result.optimized_gate_count) / max(optimization_result.original_gate_count, 1)

            return QuantumOptimizationResult(
                original_circuit=circuit,
                optimized_circuit=optimized_circuit,
                optimization_time_ms=optimization_result.optimization_time_ms,
                depth_reduction=depth_reduction,
                gate_reduction=gate_reduction,
                fidelity_improvement=optimization_result.fidelity_impact,
                optimization_techniques=[t.value for t in optimization_result.techniques_used],
                timestamp=time.time()
            )

        except Exception as e:
            logger.error(f"Circuit optimization failed: {e}")
            return QuantumOptimizationResult(
                original_circuit=circuit,
                optimized_circuit=circuit,
                optimization_time_ms=int((time.time() - start_time) * 1000),
                depth_reduction=0.0,
                gate_reduction=0.0,
                fidelity_improvement=0.0,
                optimization_techniques=[],
                timestamp=time.time()
            )

    def get_available_optimizers(self) -> List[str]:
        """Get list of available optimizers"""
        return list(self.optimizers.keys())

    def get_optimizer_metrics(self) -> Dict[str, Any]:
        """Get metrics for all optimizers"""
        metrics = {}
        for name, optimizer in self.optimizers.items():
            if hasattr(optimizer, 'get_optimization_metrics'):
                metrics[name] = optimizer.get_optimization_metrics()
        return metrics