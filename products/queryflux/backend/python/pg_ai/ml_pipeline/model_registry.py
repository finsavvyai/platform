"""
Model Registry for managing trained ML models
Provides versioning, deployment, and rollback capabilities
"""

import os
import json
import time
import hashlib
import pickle
import joblib
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime, timedelta
import shutil
import threading

from .ml_config import MLConfig, ModelType

@dataclass
class ModelMetadata:
    """Metadata for a registered model"""
    model_id: str
    model_type: ModelType
    version: str
    created_at: float
    updated_at: float
    training_data_hash: str
    performance_metrics: Dict[str, float]
    hyperparameters: Dict[str, Any]
    training_duration: float
    model_size_bytes: int
    status: str  # 'training', 'ready', 'deployed', 'archived', 'failed'
    deployment_info: Optional[Dict[str, Any]] = None
    tags: List[str] = None
    description: str = ""

    def __post_init__(self):
        if self.tags is None:
            self.tags = []

class ModelRegistry:
    """Registry for managing ML models with versioning and deployment"""

    def __init__(self, config: Optional[MLConfig] = None):
        self.config = config or MLConfig.create_default()
        self.registry_path = Path(os.path.expanduser(self.config.model_registry_path))
        self.registry_path.mkdir(parents=True, exist_ok=True)

        # Registry metadata file
        self.metadata_file = self.registry_path / "registry.json"
        self.models_metadata: Dict[str, ModelMetadata] = {}
        self.load_registry()

        # Thread lock for concurrent access
        self._lock = threading.Lock()

    def load_registry(self):
        """Load model registry from disk"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    data = json.load(f)

                for model_id, metadata_dict in data.items():
                    # Convert back to enum
                    metadata_dict['model_type'] = ModelType(metadata_dict['model_type'])
                    self.models_metadata[model_id] = ModelMetadata(**metadata_dict)

            except Exception as e:
                print(f"Error loading model registry: {e}")
                self.models_metadata = {}

    def save_registry(self):
        """Save model registry to disk"""
        try:
            with self._lock:
                registry_data = {}
                for model_id, metadata in self.models_metadata.items():
                    metadata_dict = asdict(metadata)
                    metadata_dict['model_type'] = metadata.model_type.value
                    registry_data[model_id] = metadata_dict

                with open(self.metadata_file, 'w') as f:
                    json.dump(registry_data, f, indent=2)

        except Exception as e:
            print(f"Error saving model registry: {e}")

    def register_model(self,
                      model: Any,
                      model_type: ModelType,
                      performance_metrics: Dict[str, float],
                      hyperparameters: Dict[str, Any],
                      training_duration: float,
                      training_data_hash: str,
                      version: Optional[str] = None,
                      tags: Optional[List[str]] = None,
                      description: str = "") -> str:
        """Register a new model"""

        if version is None:
            version = self._generate_version(model_type)

        model_id = f"{model_type.value}_{version}"

        # Create model directory
        model_dir = self.registry_path / model_type.value / version
        model_dir.mkdir(parents=True, exist_ok=True)

        # Save model
        model_path = model_dir / "model.pkl"
        try:
            if hasattr(model, 'save'):
                # For models with custom save method (e.g., TensorFlow, PyTorch)
                model.save(str(model_dir / "model"))
            else:
                # Use joblib for sklearn models
                joblib.dump(model, model_path)

        except Exception as e:
            print(f"Error saving model: {e}")
            # Fallback to pickle
            with open(model_path, 'wb') as f:
                pickle.dump(model, f)

        # Calculate model size
        model_size = self._calculate_directory_size(model_dir)

        # Create metadata
        metadata = ModelMetadata(
            model_id=model_id,
            model_type=model_type,
            version=version,
            created_at=time.time(),
            updated_at=time.time(),
            training_data_hash=training_data_hash,
            performance_metrics=performance_metrics,
            hyperparameters=hyperparameters,
            training_duration=training_duration,
            model_size_bytes=model_size,
            status='ready',
            tags=tags or [],
            description=description
        )

        # Save metadata
        with self._lock:
            self.models_metadata[model_id] = metadata

        # Save hyperparameters and metrics separately
        with open(model_dir / "hyperparameters.json", 'w') as f:
            json.dump(hyperparameters, f, indent=2)

        with open(model_dir / "metrics.json", 'w') as f:
            json.dump(performance_metrics, f, indent=2)

        self.save_registry()
        print(f"Model registered: {model_id}")
        return model_id

    def load_model(self, model_id: str) -> Optional[Any]:
        """Load a model by ID"""
        if model_id not in self.models_metadata:
            print(f"Model {model_id} not found in registry")
            return None

        metadata = self.models_metadata[model_id]
        model_dir = self.registry_path / metadata.model_type.value / metadata.version

        # Try different loading methods
        model_path = model_dir / "model.pkl"
        custom_model_path = model_dir / "model"

        try:
            if custom_model_path.exists():
                # Try to load with custom method (TensorFlow, PyTorch)
                # This would need to be extended based on model types
                return self._load_custom_model(custom_model_path, metadata.model_type)
            elif model_path.exists():
                # Try joblib first
                try:
                    return joblib.load(model_path)
                except:
                    # Fallback to pickle
                    with open(model_path, 'rb') as f:
                        return pickle.load(f)
        except Exception as e:
            print(f"Error loading model {model_id}: {e}")
            return None

        return None

    def _load_custom_model(self, model_path: Path, model_type: ModelType) -> Any:
        """Load custom model formats"""
        # This would be extended based on model types used
        # For now, return None as placeholder
        print(f"Custom model loading not implemented for {model_type}")
        return None

    def get_latest_model(self, model_type: ModelType) -> Optional[Tuple[str, Any]]:
        """Get the latest version of a model type"""
        latest_metadata = None
        latest_id = None

        for model_id, metadata in self.models_metadata.items():
            if metadata.model_type == model_type and metadata.status == 'ready':
                if latest_metadata is None or metadata.created_at > latest_metadata.created_at:
                    latest_metadata = metadata
                    latest_id = model_id

        if latest_id:
            model = self.load_model(latest_id)
            if model:
                return latest_id, model

        return None

    def list_models(self,
                   model_type: Optional[ModelType] = None,
                   status: Optional[str] = None,
                   tags: Optional[List[str]] = None) -> List[ModelMetadata]:
        """List models with optional filtering"""
        filtered_models = []

        for metadata in self.models_metadata.values():
            # Filter by model type
            if model_type and metadata.model_type != model_type:
                continue

            # Filter by status
            if status and metadata.status != status:
                continue

            # Filter by tags
            if tags:
                if not any(tag in metadata.tags for tag in tags):
                    continue

            filtered_models.append(metadata)

        # Sort by creation time (newest first)
        return sorted(filtered_models, key=lambda x: x.created_at, reverse=True)

    def deploy_model(self, model_id: str, deployment_config: Dict[str, Any]) -> bool:
        """Deploy a model"""
        if model_id not in self.models_metadata:
            return False

        with self._lock:
            metadata = self.models_metadata[model_id]
            metadata.status = 'deployed'
            metadata.deployment_info = {
                'deployed_at': time.time(),
                'config': deployment_config
            }
            metadata.updated_at = time.time()

        self.save_registry()
        return True

    def undeploy_model(self, model_id: str) -> bool:
        """Undeploy a model"""
        if model_id not in self.models_metadata:
            return False

        with self._lock:
            metadata = self.models_metadata[model_id]
            metadata.status = 'ready'
            if metadata.deployment_info:
                metadata.deployment_info['undeployed_at'] = time.time()
            metadata.updated_at = time.time()

        self.save_registry()
        return True

    def archive_model(self, model_id: str) -> bool:
        """Archive a model"""
        if model_id not in self.models_metadata:
            return False

        with self._lock:
            metadata = self.models_metadata[model_id]
            metadata.status = 'archived'
            metadata.updated_at = time.time()

        self.save_registry()
        return True

    def delete_model(self, model_id: str) -> bool:
        """Delete a model and its files"""
        if model_id not in self.models_metadata:
            return False

        metadata = self.models_metadata[model_id]
        model_dir = self.registry_path / metadata.model_type.value / metadata.version

        try:
            # Remove model directory
            if model_dir.exists():
                shutil.rmtree(model_dir)

            # Remove from metadata
            with self._lock:
                del self.models_metadata[model_id]

            self.save_registry()
            return True

        except Exception as e:
            print(f"Error deleting model {model_id}: {e}")
            return False

    def update_model_metrics(self, model_id: str, new_metrics: Dict[str, float]):
        """Update performance metrics for a model"""
        if model_id not in self.models_metadata:
            return False

        with self._lock:
            metadata = self.models_metadata[model_id]
            metadata.performance_metrics.update(new_metrics)
            metadata.updated_at = time.time()

        # Also update the metrics file
        metadata = self.models_metadata[model_id]
        model_dir = self.registry_path / metadata.model_type.value / metadata.version
        with open(model_dir / "metrics.json", 'w') as f:
            json.dump(metadata.performance_metrics, f, indent=2)

        self.save_registry()
        return True

    def add_model_tags(self, model_id: str, tags: List[str]):
        """Add tags to a model"""
        if model_id not in self.models_metadata:
            return False

        with self._lock:
            metadata = self.models_metadata[model_id]
            metadata.tags.extend(tags)
            metadata.tags = list(set(metadata.tags))  # Remove duplicates
            metadata.updated_at = time.time()

        self.save_registry()
        return True

    def get_model_info(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata"""
        return self.models_metadata.get(model_id)

    def compare_models(self, model_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple models"""
        comparison = {
            'models': {},
            'metrics_comparison': {},
            'best_model': None
        }

        valid_models = []
        all_metrics = set()

        # Collect model info
        for model_id in model_ids:
            if model_id in self.models_metadata:
                metadata = self.models_metadata[model_id]
                comparison['models'][model_id] = {
                    'version': metadata.version,
                    'created_at': metadata.created_at,
                    'model_size_bytes': metadata.model_size_bytes,
                    'training_duration': metadata.training_duration,
                    'performance_metrics': metadata.performance_metrics,
                    'status': metadata.status
                }
                valid_models.append(model_id)
                all_metrics.update(metadata.performance_metrics.keys())

        # Compare metrics
        for metric in all_metrics:
            metric_values = {}
            for model_id in valid_models:
                metadata = self.models_metadata[model_id]
                if metric in metadata.performance_metrics:
                    metric_values[model_id] = metadata.performance_metrics[metric]

            if metric_values:
                comparison['metrics_comparison'][metric] = {
                    'values': metric_values,
                    'best_model': max(metric_values, key=metric_values.get),
                    'worst_model': min(metric_values, key=metric_values.get),
                    'range': max(metric_values.values()) - min(metric_values.values())
                }

        # Determine overall best model (based on primary metric or composite score)
        if valid_models and comparison['metrics_comparison']:
            # Simple heuristic: model with best average performance across metrics
            model_scores = {}
            for model_id in valid_models:
                metadata = self.models_metadata[model_id]
                metrics = metadata.performance_metrics
                if metrics:
                    model_scores[model_id] = sum(metrics.values()) / len(metrics)

            if model_scores:
                comparison['best_model'] = max(model_scores, key=model_scores.get)

        return comparison

    def cleanup_old_models(self, keep_versions: int = 5):
        """Clean up old model versions"""
        models_by_type = {}

        # Group models by type
        for model_id, metadata in self.models_metadata.items():
            model_type = metadata.model_type
            if model_type not in models_by_type:
                models_by_type[model_type] = []
            models_by_type[model_type].append((model_id, metadata))

        # Keep only the N most recent versions for each type
        for model_type, models in models_by_type.items():
            # Sort by creation time (newest first)
            models.sort(key=lambda x: x[1].created_at, reverse=True)

            # Skip deployed models and keep the most recent versions
            to_keep = []
            to_archive = []

            for model_id, metadata in models:
                if metadata.status == 'deployed' or len(to_keep) < keep_versions:
                    to_keep.append(model_id)
                else:
                    to_archive.append(model_id)

            # Archive old models
            for model_id in to_archive:
                self.archive_model(model_id)
                print(f"Archived old model: {model_id}")

    def get_model_performance_history(self, model_type: ModelType) -> List[Dict[str, Any]]:
        """Get performance history for a model type"""
        history = []

        for model_id, metadata in self.models_metadata.items():
            if metadata.model_type == model_type:
                history.append({
                    'model_id': model_id,
                    'version': metadata.version,
                    'created_at': metadata.created_at,
                    'performance_metrics': metadata.performance_metrics,
                    'training_duration': metadata.training_duration
                })

        # Sort by creation time
        return sorted(history, key=lambda x: x['created_at'])

    def _generate_version(self, model_type: ModelType) -> str:
        """Generate a new version number"""
        existing_versions = []
        for metadata in self.models_metadata.values():
            if metadata.model_type == model_type:
                try:
                    version_num = int(metadata.version.replace('v', ''))
                    existing_versions.append(version_num)
                except:
                    pass

        if existing_versions:
            next_version = max(existing_versions) + 1
        else:
            next_version = 1

        return f"v{next_version}"

    def _calculate_directory_size(self, path: Path) -> int:
        """Calculate total size of directory"""
        total_size = 0
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                file_path = os.path.join(dirpath, filename)
                if os.path.exists(file_path):
                    total_size += os.path.getsize(file_path)
        return total_size

    def get_registry_stats(self) -> Dict[str, Any]:
        """Get registry statistics"""
        stats = {
            'total_models': len(self.models_metadata),
            'models_by_type': {},
            'models_by_status': {},
            'total_size_bytes': 0,
            'registry_age_days': 0
        }

        if self.models_metadata:
            oldest_model = min(self.models_metadata.values(), key=lambda x: x.created_at)
            stats['registry_age_days'] = (time.time() - oldest_model.created_at) / (24 * 3600)

        for metadata in self.models_metadata.values():
            # Count by type
            model_type = metadata.model_type.value
            stats['models_by_type'][model_type] = stats['models_by_type'].get(model_type, 0) + 1

            # Count by status
            status = metadata.status
            stats['models_by_status'][status] = stats['models_by_status'].get(status, 0) + 1

            # Sum sizes
            stats['total_size_bytes'] += metadata.model_size_bytes

        return stats