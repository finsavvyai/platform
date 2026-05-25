"""
ML Configuration for model training and deployment
"""

import os
import json
from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional, List
from pathlib import Path
from enum import Enum

class ModelType(Enum):
    QUERY_OPTIMIZER = "query_optimizer"
    PERFORMANCE_PREDICTOR = "performance_predictor"
    PATTERN_RECOGNIZER = "pattern_recognizer"
    SCHEMA_RECOMMENDER = "schema_recommender"
    ANOMALY_DETECTOR = "anomaly_detector"
    DATA_QUALITY_SCORER = "data_quality_scorer"

class TrainingMode(Enum):
    BATCH = "batch"
    ONLINE = "online"
    INCREMENTAL = "incremental"

@dataclass
class MLConfig:
    """Configuration for ML models and training"""

    # Model directories
    model_registry_path: str = "~/.pgdesk_ai_models"
    training_data_path: str = "~/.pgdesk_ai_training_data"
    experiment_tracking_path: str = "~/.pgdesk_ai_experiments"

    # Training settings
    training_mode: TrainingMode = TrainingMode.INCREMENTAL
    auto_retrain_threshold: float = 0.05  # Retrain when performance drops by 5%
    min_training_samples: int = 1000
    max_training_samples: int = 100000
    training_batch_size: int = 32
    validation_split: float = 0.2
    test_split: float = 0.1

    # Model performance thresholds
    min_model_accuracy: float = 0.85
    early_stopping_patience: int = 10
    max_training_epochs: int = 100
    learning_rate: float = 0.001

    # Feature engineering
    enable_feature_selection: bool = True
    max_features: int = 1000
    feature_importance_threshold: float = 0.01
    enable_dimensionality_reduction: bool = False

    # Query optimizer specific
    query_embedding_dim: int = 512
    max_query_length: int = 2048
    sql_vocabulary_size: int = 10000

    # Performance predictor specific
    performance_window_hours: int = 24
    metric_aggregation_intervals: List[int] = None  # [1, 5, 15, 60] minutes
    enable_time_series_features: bool = True

    # Pattern recognizer specific
    pattern_similarity_threshold: float = 0.8
    min_pattern_frequency: int = 5
    pattern_clustering_eps: float = 0.3

    # Resource limits
    max_memory_usage_gb: float = 8.0
    max_cpu_cores: int = 4
    enable_gpu: bool = False
    gpu_memory_limit_gb: Optional[float] = None

    # Monitoring and logging
    enable_model_monitoring: bool = True
    monitoring_interval_hours: int = 1
    log_predictions: bool = True
    max_log_entries: int = 10000

    # Security and privacy
    anonymize_queries: bool = True
    encrypt_models: bool = False
    data_retention_days: int = 90

    # API and integration
    enable_api_endpoints: bool = True
    api_rate_limit: int = 1000  # requests per hour
    enable_webhook_notifications: bool = False
    webhook_url: Optional[str] = None

    # Cloud integration
    enable_cloud_training: bool = False
    cloud_provider: Optional[str] = None  # 'aws', 'gcp', 'azure'
    cloud_region: Optional[str] = None

    # Experiment tracking (MLflow)
    enable_mlflow: bool = True
    mlflow_tracking_uri: str = "sqlite:///~/.pgdesk_ai_mlflow.db"
    mlflow_experiment_name: str = "pgdesk_ai_experiments"

    def __post_init__(self):
        if self.metric_aggregation_intervals is None:
            self.metric_aggregation_intervals = [1, 5, 15, 60]

    @classmethod
    def load_from_file(cls, config_path: Optional[str] = None) -> 'MLConfig':
        """Load ML configuration from file"""
        if config_path is None:
            config_path = os.path.expanduser("~/.pgdesk_ml_config.json")

        if not os.path.exists(config_path):
            return cls.create_default()

        try:
            with open(config_path, 'r') as f:
                data = json.load(f)

            # Convert string enums back to enum objects
            if 'training_mode' in data:
                data['training_mode'] = TrainingMode(data['training_mode'])

            return cls(**data)
        except Exception as e:
            print(f"Error loading ML config: {e}, using defaults")
            return cls.create_default()

    def save_to_file(self, config_path: Optional[str] = None):
        """Save ML configuration to file"""
        if config_path is None:
            config_path = os.path.expanduser("~/.pgdesk_ml_config.json")

        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        # Convert to dict and handle enums
        data = asdict(self)
        data['training_mode'] = self.training_mode.value

        try:
            with open(config_path, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving ML config: {e}")

    @classmethod
    def create_default(cls) -> 'MLConfig':
        """Create default ML configuration"""
        return cls()

    def get_model_path(self, model_type: ModelType, version: str = "latest") -> Path:
        """Get path for a specific model"""
        base_path = Path(os.path.expanduser(self.model_registry_path))
        return base_path / model_type.value / version

    def get_training_data_path(self, model_type: ModelType) -> Path:
        """Get training data path for a specific model"""
        base_path = Path(os.path.expanduser(self.training_data_path))
        return base_path / model_type.value

    def get_experiment_path(self, model_type: ModelType, experiment_name: str) -> Path:
        """Get experiment tracking path"""
        base_path = Path(os.path.expanduser(self.experiment_tracking_path))
        return base_path / model_type.value / experiment_name

    def validate(self) -> List[str]:
        """Validate configuration and return list of issues"""
        issues = []

        # Validate ranges
        if not 0 < self.validation_split < 1:
            issues.append("Validation split must be between 0 and 1")

        if not 0 < self.test_split < 1:
            issues.append("Test split must be between 0 and 1")

        if self.validation_split + self.test_split >= 1:
            issues.append("Validation and test splits combined must be less than 1")

        if self.min_training_samples <= 0:
            issues.append("Minimum training samples must be positive")

        if self.max_training_samples < self.min_training_samples:
            issues.append("Maximum training samples must be >= minimum training samples")

        if not 0 <= self.min_model_accuracy <= 1:
            issues.append("Minimum model accuracy must be between 0 and 1")

        if self.max_memory_usage_gb <= 0:
            issues.append("Maximum memory usage must be positive")

        if self.max_cpu_cores <= 0:
            issues.append("Maximum CPU cores must be positive")

        # Validate paths exist
        paths_to_check = [
            self.model_registry_path,
            self.training_data_path,
            self.experiment_tracking_path
        ]

        for path in paths_to_check:
            expanded_path = os.path.expanduser(path)
            try:
                os.makedirs(expanded_path, exist_ok=True)
            except Exception as e:
                issues.append(f"Cannot create path {path}: {e}")

        return issues

    def get_resource_limits(self) -> Dict[str, Any]:
        """Get resource limits for training"""
        return {
            'max_memory_gb': self.max_memory_usage_gb,
            'max_cpu_cores': self.max_cpu_cores,
            'enable_gpu': self.enable_gpu,
            'gpu_memory_limit_gb': self.gpu_memory_limit_gb
        }

    def get_training_config(self, model_type: ModelType) -> Dict[str, Any]:
        """Get training configuration for a specific model type"""
        base_config = {
            'batch_size': self.training_batch_size,
            'validation_split': self.validation_split,
            'test_split': self.test_split,
            'max_epochs': self.max_training_epochs,
            'learning_rate': self.learning_rate,
            'early_stopping_patience': self.early_stopping_patience,
            'min_accuracy': self.min_model_accuracy
        }

        # Model-specific configurations
        if model_type == ModelType.QUERY_OPTIMIZER:
            base_config.update({
                'embedding_dim': self.query_embedding_dim,
                'max_query_length': self.max_query_length,
                'vocabulary_size': self.sql_vocabulary_size
            })
        elif model_type == ModelType.PERFORMANCE_PREDICTOR:
            base_config.update({
                'window_hours': self.performance_window_hours,
                'aggregation_intervals': self.metric_aggregation_intervals,
                'enable_time_features': self.enable_time_series_features
            })
        elif model_type == ModelType.PATTERN_RECOGNIZER:
            base_config.update({
                'similarity_threshold': self.pattern_similarity_threshold,
                'min_frequency': self.min_pattern_frequency,
                'clustering_eps': self.pattern_clustering_eps
            })

        return base_config

# Global configuration instance
_global_ml_config: Optional[MLConfig] = None

def get_ml_config() -> MLConfig:
    """Get global ML configuration instance"""
    global _global_ml_config
    if _global_ml_config is None:
        _global_ml_config = MLConfig.load_from_file()
    return _global_ml_config

def set_ml_config(config: MLConfig):
    """Set global ML configuration instance"""
    global _global_ml_config
    _global_ml_config = config

def reload_ml_config():
    """Reload configuration from file"""
    global _global_ml_config
    _global_ml_config = MLConfig.load_from_file()