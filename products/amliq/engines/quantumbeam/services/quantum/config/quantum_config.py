from pydantic import BaseSettings
from typing import List, Optional, Dict
import os


class QuantumConfig(BaseSettings):
    """Configuration for quantum processing service"""

    # Service Configuration
    service_name: str = "quantum-fraud-detector"
    service_version: str = "1.0.0"
    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "INFO"

    # Quantum Backend Configuration
    default_backend: str = "simulator"  # simulator, ibm_quantum, amazon_braket, google_quantum
    max_qubits: int = 32
    max_shots: int = 8192
    optimization_level: int = 3

    # IBM Quantum Configuration
    ibm_quantum_token: Optional[str] = None
    ibm_quantum_hub: Optional[str] = None
    ibm_quantum_group: Optional[str] = None
    ibm_quantum_project: Optional[str] = None

    # AWS Braket Configuration
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: str = "us-east-1"
    braket_s3_bucket: Optional[str] = None

    # Google Quantum AI Configuration
    google_cloud_project_id: Optional[str] = None
    google_quantum_credentials_path: Optional[str] = None
    google_quantum_endpoint: str = "quantumai.googleapis.com"

    # Circuit Configuration
    vqc_qubits: int = 8  # Variational Quantum Classifier qubits
    vqc_layers: int = 3  # Number of variational layers
    vqc_rotations: List[str] = ["rx", "ry", "rz"]
    vqc_entanglement: str = "full"  # full, linear, circular
    qaoa_layers: int = 2  # QAOA layers for fraud ring detection

    # Performance Configuration
    circuit_timeout: int = 30  # seconds
    max_concurrent_circuits: int = 10
    cache_results: bool = True
    cache_ttl: int = 3600  # seconds

    # Feature Engineering
    feature_dim: int = 10  # Transaction feature dimension
    encoding_method: str = "angle"  # angle, amplitude, basis
    scaling_method: str = "minmax"  # minmax, standard, robust

    # Monitoring Configuration
    metrics_enabled: bool = True
    prometheus_port: int = 8002
    health_check_interval: int = 30  # seconds

    # Security Configuration
    api_key_required: bool = True
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds

    # Redis Configuration for caching
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None

    # Fraud Detection Thresholds
    fraud_threshold: float = 0.5
    confidence_threshold: float = 0.7
    quantum_advantage_threshold: float = 0.6

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Backend-specific configurations
QUANTUM_BACKENDS = {
    "simulator": {
        "name": "Qiskit Aer Simulator",
        "description": "Local quantum simulator for development and testing",
        "max_qubits": 32,
        "supports_noise": True,
        "supports_optimization": True,
        "availability": "always"
    },
    "ibm_quantum": {
        "name": "IBM Quantum",
        "description": "IBM Quantum cloud services with various quantum hardware",
        "max_qubits": 127,
        "supports_noise": True,
        "supports_optimization": True,
        "availability": "queue_based"
    },
    "amazon_braket": {
        "name": "Amazon Braket",
        "description": "AWS quantum computing service with multiple hardware providers",
        "max_qubits": 32,
        "supports_noise": True,
        "supports_optimization": True,
        "availability": "queue_based"
    },
    "google_quantum": {
        "name": "Google Quantum AI",
        "description": "Google's quantum computing platform",
        "max_qubits": 54,
        "supports_noise": True,
        "supports_optimization": True,
        "availability": "queue_based"
    }
}

# Quantum circuit templates
CIRCUIT_TEMPLATES = {
    "vqc_fraud": {
        "name": "Variational Quantum Classifier for Fraud Detection",
        "qubits": 8,
        "layers": 3,
        "encoding": "angle",
        "measurements": ["z0", "z1", "z2", "z3"]
    },
    "qaoa_fraud_ring": {
        "name": "QAOA for Fraud Ring Detection",
        "qubits": 16,
        "layers": 2,
        "encoding": "binary",
        "measurements": ["z0", "z1", "z2", "z3", "z4", "z5", "z6", "z7"]
    },
    "qnn_pattern": {
        "name": "Quantum Neural Network for Pattern Recognition",
        "qubits": 12,
        "layers": 4,
        "encoding": "amplitude",
        "measurements": ["z0", "z1", "z2", "z3", "z4", "z5"]
    }
}

# Performance benchmarks
PERFORMANCE_BENCHMARKS = {
    "simulator": {
        "avg_execution_time_ms": 50,
        "quantum_volume": 128,
        "fidelity": 1.0,
        "success_rate": 1.0
    },
    "ibm_quantum": {
        "avg_execution_time_ms": 5000,
        "quantum_volume": 64,
        "fidelity": 0.95,
        "success_rate": 0.85
    },
    "amazon_braket": {
        "avg_execution_time_ms": 3000,
        "quantum_volume": 32,
        "fidelity": 0.93,
        "success_rate": 0.88
    },
    "google_quantum": {
        "avg_execution_time_ms": 4000,
        "quantum_volume": 64,
        "fidelity": 0.96,
        "success_rate": 0.90
    }
}