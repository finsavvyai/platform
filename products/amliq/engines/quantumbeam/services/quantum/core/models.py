from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum
import numpy as np


class QuantumBackendType(str, Enum):
    SIMULATOR = "simulator"
    IBM_QUANTUM = "ibm_quantum"
    AMAZON_BRAKET = "amazon_braket"
    GOOGLE_QUANTUM = "google_quantum"


class CircuitType(str, Enum):
    VQC_FRAUD = "vqc_fraud"
    QAOA_FRAUD_RING = "qaoa_fraud_ring"
    QNN_PATTERN = "qnn_pattern"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TransactionFeatures(BaseModel):
    """Transaction feature data for quantum processing"""
    transaction_id: str = Field(..., description="Unique transaction identifier")
    amount: float = Field(..., ge=0, description="Transaction amount")
    timestamp: datetime = Field(..., description="Transaction timestamp")
    merchant_id: str = Field(..., description="Merchant identifier")
    customer_id: str = Field(..., description="Customer identifier")
    location: Optional[str] = Field(None, description="Transaction location")
    device_id: Optional[str] = Field(None, description="Device identifier")
    ip_address: Optional[str] = Field(None, description="IP address")
    payment_method: str = Field(..., description="Payment method type")
    currency: str = Field(default="USD", description="Transaction currency")

    # Behavioral features
    customer_age_months: Optional[int] = Field(None, ge=0, description="Customer account age in months")
    transaction_frequency_24h: Optional[int] = Field(None, ge=0, description="Transactions in last 24 hours")
    avg_transaction_amount_30d: Optional[float] = Field(None, ge=0, description="Average transaction amount last 30 days")
    amount_deviation_score: Optional[float] = Field(None, description="Deviation from normal amount")
    time_since_last_transaction: Optional[int] = Field(None, ge=0, description="Minutes since last transaction")

    # Risk indicators
    is_high_risk_country: bool = Field(default=False, description="Transaction from high-risk country")
    is_new_device: bool = Field(default=False, description="Transaction from new device")
    is_unusual_time: bool = Field(default=False, description="Transaction at unusual time")
    velocity_exceeded: bool = Field(default=False, description="Transaction velocity exceeded")

    def to_numpy_array(self) -> np.ndarray:
        """Convert features to numpy array for quantum encoding"""
        features = [
            self.amount,
            float(self.customer_age_months or 0),
            float(self.transaction_frequency_24h or 0),
            float(self.avg_transaction_amount_30d or 0),
            float(self.amount_deviation_score or 0),
            float(self.time_since_last_transaction or 0),
            float(self.is_high_risk_country),
            float(self.is_new_device),
            float(self.is_unusual_time),
            float(self.velocity_exceeded)
        ]
        return np.array(features, dtype=np.float32)


class FraudDetectionResult(BaseModel):
    """Result of quantum fraud detection"""
    transaction_id: str
    is_fraud: bool
    fraud_probability: float = Field(..., ge=0, le=1)
    confidence_score: float = Field(..., ge=0, le=1)
    quantum_advantage_score: float = Field(..., ge=0, le=1)
    processing_method: str
    processing_time_ms: int
    circuit_depth: int
    quantum_backend: QuantumBackendType
    explanation: Optional[str] = None
    risk_factors: List[str] = Field(default_factory=list)
    model_version: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class QuantumCircuit(BaseModel):
    """Quantum circuit representation"""
    circuit_id: str
    circuit_type: CircuitType
    num_qubits: int
    num_clbits: int
    depth: int
    gate_count: int
    parameters: Dict[str, float]
    measurements: List[str]
    backend: QuantumBackendType
    creation_timestamp: datetime = Field(default_factory=datetime.utcnow)


class CircuitExecutionRequest(BaseModel):
    """Request to execute a quantum circuit"""
    circuit_id: str
    features: TransactionFeatures
    backend: Optional[QuantumBackendType] = None
    shots: int = Field(default=1024, ge=1, le=8192)
    optimization_level: int = Field(default=3, ge=0, le=3)
    timeout_seconds: int = Field(default=30, ge=5, le=300)


class CircuitExecutionResult(BaseModel):
    """Result of quantum circuit execution"""
    execution_id: str
    circuit_id: str
    status: ProcessingStatus
    counts: Dict[str, int]
    measurement_results: List[Dict[str, Any]]
    execution_time_ms: int
    quantum_volume: Optional[int] = None
    fidelity: Optional[float] = None
    error_rate: Optional[float] = None
    backend_info: Dict[str, Any]
    error_message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class FraudRingDetection(BaseModel):
    """Fraud ring detection result using QAOA"""
    ring_id: str
    members: List[str]
    ring_strength: float = Field(..., ge=0, le=1)
    quantum_advantage: float = Field(..., ge=0, le=1)
    total_transactions: int
    fraud_transactions: int
    total_amount: float
    fraud_amount: float
    detection_method: str
    processing_time_ms: int
    quantum_backend: QuantumBackendType
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class QuantumPerformanceMetrics(BaseModel):
    """Quantum processing performance metrics"""
    backend: QuantumBackendType
    circuit_type: CircuitType
    avg_execution_time_ms: float
    success_rate: float
    quantum_volume: int
    fidelity: float
    qubit_utilization: float
    gate_errors_per_1000: float
    queue_time_seconds: Optional[float] = None
    cost_per_execution: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class QuantumBackendStatus(BaseModel):
    """Status of quantum backend"""
    backend: QuantumBackendType
    is_available: bool
    qubits_available: int
    queue_length: int
    estimated_wait_time_seconds: int
    current_load_percentage: float
    supported_operations: List[str]
    quantum_volume: int
    last_health_check: datetime = Field(default_factory=datetime.utcnow)


class FeatureEncodingMethod(str, Enum):
    ANGLE = "angle"
    AMPLITUDE = "amplitude"
    BASIS = "basis"
    HYBRID = "hybrid"


class QuantumFeatureEncoder(BaseModel):
    """Configuration for quantum feature encoding"""
    method: FeatureEncodingMethod
    num_qubits: int
    feature_dim: int
    encoding_params: Dict[str, Any]
    normalization_method: str = "minmax"
    rotation_gates: List[str] = ["rx", "ry", "rz"]


class QuantumOptimizationResult(BaseModel):
    """Result of quantum circuit optimization"""
    original_circuit: QuantumCircuit
    optimized_circuit: QuantumCircuit
    optimization_time_ms: int
    depth_reduction: float
    gate_reduction: float
    fidelity_improvement: float
    optimization_techniques: List[str]
    timestamp: datetime = Field(default_factory=datetime.utcnow)