"""AI Model Serving & Versioning.

Provides model persistence, loading, version management, and hot-swapping
for UPM ML models.
"""

from __future__ import annotations

import hashlib
import json
import logging
import pickle
import shutil
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from functools import wraps
from pathlib import Path
from typing import Any, Optional

from ..ml.models import BaseMLModel

logger = logging.getLogger(__name__)


class ModelFormat(str, Enum):
    """Model serialization format."""

    PICKLE = "pickle"
    JOBlib = "joblib"
    JSON = "json"
    SAFE_TENSORS = "safetensors"


class ModelStatus(str, Enum):
    """Model deployment status."""

    LOADED = "loaded"
    UNLOADED = "unloaded"
    ERROR = "error"
    LOADING = "loading"
    STAGING = "staging"


@dataclass
class ModelMetadata:
    """Metadata for a stored model."""

    model_name: str
    version: str
    format: ModelFormat
    file_path: str
    size_bytes: int
    created_at: datetime
    checksum: str
    framework: str = "sklearn"
    accuracy: Optional[float] = None
    metrics: dict[str, float] = field(default_factory=dict)
    hyperparameters: dict[str, Any] = field(default_factory=dict)
    feature_names: list[str] = field(default_factory=list)
    training_samples: int = 0
    is_active: bool = False


@dataclass
class ModelRegistryEntry:
    """Registry entry for a model version."""

    name: str
    version: str
    stage: str  # "development", "staging", "production"
    created_at: datetime
    metrics: dict[str, float] = field(default_factory=dict)
    metadata: ModelMetadata = None


class ModelVersionError(Exception):
    """Exception raised for model version conflicts."""

    pass


class ModelLoadError(Exception):
    """Exception raised when model fails to load."""

    pass


def model_version(model_name: str, version: str):
    """Decorator to track model version in model registry.

    Usage:
        @model_version("recommendation", "1.0.0")
        class MyModel(BaseMLModel):
            ...
    """

    def decorator(cls: type[BaseMLModel]) -> type[BaseMLModel]:
        original_init = cls.__init__

        @wraps(cls.__init__)
        def new_init(self, *args, **kwargs):
            original_init(self, *args, **kwargs)
            # Set version if not provided
            if not hasattr(self, "version") or not self.version:
                self.version = version
            if not hasattr(self, "model_name") or not self.model_name:
                self.model_name = model_name

        cls.__init__ = new_init
        return cls

    return decorator


class ModelRegistry:
    """Registry for managing multiple model versions."""

    def __init__(self, storage_path: str = "./models"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        self._registry: dict[str, dict[str, ModelRegistryEntry]] = {}
        self._loaded_models: dict[str, BaseMLModel] = {}
        self._model_locks: dict[str, Any] = {}

        # Create subdirectories
        (self.storage_path / "production").mkdir(exist_ok=True)
        (self.storage_path / "staging").mkdir(exist_ok=True)
        (self.storage_path / "development").mkdir(exist_ok=True)
        (self.storage_path / "archive").mkdir(exist_ok=True)

        # Load existing registry
        self._load_registry()

    def _load_registry(self) -> None:
        """Load model registry from disk."""
        registry_file = self.storage_path / "registry.json"

        if not registry_file.exists():
            return

        try:
            with open(registry_file) as f:
                data = json.load(f)

            for model_name, versions in data.items():
                self._registry[model_name] = {}
                for version_str, entry_data in versions.items():
                    self._registry[model_name][version_str] = ModelRegistryEntry(
                        name=entry_data["name"],
                        version=entry_data["version"],
                        stage=entry_data["stage"],
                        created_at=datetime.fromisoformat(entry_data["created_at"]),
                        metrics=entry_data.get("metrics", {}),
                    )

            logger.info(f"Loaded registry with {len(self._registry)} models")

        except Exception as e:
            logger.error(f"Failed to load registry: {e}")

    def _save_registry(self) -> None:
        """Save model registry to disk."""
        registry_file = self.storage_path / "registry.json"

        data = {}
        for model_name, versions in self._registry.items():
            data[model_name] = {}
            for version_str, entry in versions.items():
                data[model_name][version_str] = {
                    "name": entry.name,
                    "version": entry.version,
                    "stage": entry.stage,
                    "created_at": entry.created_at.isoformat(),
                    "metrics": entry.metrics,
                }

        with open(registry_file, "w") as f:
            json.dump(data, f, indent=2)

    def register_model(
        self,
        model: BaseMLModel,
        stage: str = "development",
        metrics: Optional[dict[str, float]] = None,
    ) -> ModelMetadata:
        """Register a trained model in the registry.

        Args:
            model: The trained model to register
            stage: Deployment stage (development, staging, production)
            metrics: Optional model performance metrics

        Returns:
            ModelMetadata for the registered model
        """
        model_name = model.model_name
        version = model.version

        if model_name not in self._registry:
            self._registry[model_name] = {}

        if version in self._registry[model_name]:
            logger.warning(
                f"Model {model_name}:{version} already registered, updating..."
            )

        # Save model to disk
        stage_dir = self.storage_path / stage
        model_file = stage_dir / f"{model_name}_{version}.pkl"

        # Save using pickle
        with open(model_file, "wb") as f:
            pickle.dump(model, f)

        # Calculate checksum and size
        checksum = self._calculate_checksum(model_file)
        size_bytes = model_file.stat().st_size

        # Create metadata
        metadata = ModelMetadata(
            model_name=model_name,
            version=version,
            format=ModelFormat.PICKLE,
            file_path=str(model_file),
            size_bytes=size_bytes,
            created_at=datetime.now(),
            checksum=checksum,
            metrics=metrics or {},
        )

        # Create registry entry
        entry = ModelRegistryEntry(
            name=model_name,
            version=version,
            stage=stage,
            created_at=datetime.now(),
            metrics=metrics or {},
            metadata=metadata,
        )

        self._registry[model_name][version] = entry

        # Save registry
        self._save_registry()

        logger.info(f"Registered model {model_name}:{version} in {stage}")

        return metadata

    def load_model(
        self,
        model_name: str,
        version: Optional[str] = None,
        stage: str = "production",
    ) -> BaseMLModel:
        """Load a model from the registry.

        Args:
            model_name: Name of the model
            version: Specific version (if None, loads latest in stage)
            stage: Stage to load from

        Returns:
            Loaded model instance
        """
        cache_key = f"{model_name}:{version or 'latest'}:{stage}"

        if cache_key in self._loaded_models:
            return self._loaded_models[cache_key]

        # Determine version to load
        if version is None:
            version = self._get_latest_version(model_name, stage)

        if version is None:
            raise ModelLoadError(f"No model found for {model_name} in {stage}")

        # Get registry entry
        entry = self._registry.get(model_name, {}).get(version)
        if not entry or entry.metadata is None:
            raise ModelLoadError(f"Model {model_name}:{version} not in registry")

        model_file = Path(entry.metadata.file_path)

        if not model_file.exists():
            raise ModelLoadError(f"Model file not found: {model_file}")

        # Load model
        try:
            with open(model_file, "rb") as f:
                model = pickle.load(f)

            self._loaded_models[cache_key] = model
            logger.info(f"Loaded model {model_name}:{version}")

            return model

        except Exception as e:
            raise ModelLoadError(f"Failed to load model: {e}")

    def unload_model(self, model_name: str, version: Optional[str] = None) -> bool:
        """Unload a model from memory.

        Args:
            model_name: Name of the model
            version: Version to unload (if None, unloads all versions)

        Returns:
            True if model was unloaded
        """
        unloaded = False

        if version is None:
            # Unload all versions
            keys_to_remove = [
                k for k in self._loaded_models.keys() if k.startswith(f"{model_name}:")
            ]
            for key in keys_to_remove:
                del self._loaded_models[key]
                unloaded = True
        else:
            cache_key = f"{model_name}:{version}"
            if cache_key in self._loaded_models:
                del self._loaded_models[cache_key]
                unloaded = True

        if unloaded:
            logger.info(f"Unloaded model {model_name}:{version or 'all'}")

        return unloaded

    def promote_model(
        self,
        model_name: str,
        version: str,
        to_stage: str,
    ) -> bool:
        """Promote a model to a different stage.

        Args:
            model_name: Name of the model
            version: Version to promote
            to_stage: Target stage (staging, production)

        Returns:
            True if promotion succeeded
        """
        entry = self._registry.get(model_name, {}).get(version)

        if not entry:
            logger.error(f"Model {model_name}:{version} not found in registry")
            return False

        from_stage = entry.stage

        if from_stage == to_stage:
            logger.info(f"Model already in {to_stage}")
            return True

        # Get source and destination paths
        source_file = Path(entry.metadata.file_path)
        dest_dir = self.storage_path / to_stage
        dest_file = dest_dir / source_file.name

        # Copy model file
        shutil.copy2(source_file, dest_file)

        # Update entry
        old_entry = self._registry[model_name][version]
        self._registry[model_name][version] = ModelRegistryEntry(
            name=old_entry.name,
            version=old_entry.version,
            stage=to_stage,
            created_at=old_entry.created_at,
            metrics=old_entry.metrics,
        )

        # Update metadata file path
        self._registry[model_name][version].metadata.file_path = str(dest_file)

        # Save registry
        self._save_registry()

        logger.info(f"Promoted {model_name}:{version} from {from_stage} to {to_stage}")

        return True

    def hot_swap_model(
        self,
        model_name: str,
        new_version: str,
        stage: str = "production",
    ) -> bool:
        """Hot-swap a model with a new version without downtime.

        Args:
            model_name: Name of the model
            new_version: New version to load
            stage: Stage to swap in

        Returns:
            True if hot-swap succeeded
        """
        try:
            # Load new version
            new_model = self.load_model(model_name, new_version, stage)

            # Swap in loaded models
            old_cache_key = f"{model_name}:latest:{stage}"
            new_cache_key = f"{model_name}:{new_version}:{stage}"

            if old_cache_key in self._loaded_models:
                # Keep old model temporarily in case rollback needed
                old_model = self._loaded_models[f"{old_cache_key}_old"]
                self._loaded_models[f"{old_cache_key}_old"] = self._loaded_models[
                    old_cache_key
                ]

            # Set new model as latest
            self._loaded_models[old_cache_key] = new_model

            logger.info(f"Hot-swapped {model_name} to version {new_version}")

            return True

        except Exception as e:
            logger.error(f"Hot-swap failed: {e}")
            return False

    def rollback_model(
        self,
        model_name: str,
        stage: str = "production",
    ) -> bool:
        """Rollback to previous model version.

        Args:
            model_name: Name of the model
            stage: Stage to rollback in

        Returns:
            True if rollback succeeded
        """
        old_cache_key = f"{model_name}:latest_old:{stage}"

        if old_cache_key in self._loaded_models:
            # Restore old model
            self._loaded_models[f"{model_name}:latest:{stage}"] = self._loaded_models[
                old_cache_key
            ]

            logger.info(f"Rolled back {model_name} to previous version")
            return True

        logger.warning(f"No previous version found for rollback: {model_name}")
        return False

    def list_models(
        self,
        model_name: Optional[str] = None,
        stage: Optional[str] = None,
    ) -> list[ModelRegistryEntry]:
        """List models in the registry.

        Args:
            model_name: Filter by model name
            stage: Filter by stage

        Returns:
            List of registry entries
        """
        entries = []

        for name, versions in self._registry.items():
            if model_name and name != model_name:
                continue

            for version, entry in versions.items():
                if stage and entry.stage != stage:
                    continue
                entries.append(entry)

        return sorted(entries, key=lambda e: e.created_at, reverse=True)

    def delete_model(self, model_name: str, version: str) -> bool:
        """Delete a model from the registry.

        Args:
            model_name: Name of the model
            version: Version to delete

        Returns:
            True if deletion succeeded
        """
        entry = self._registry.get(model_name, {}).get(version)

        if not entry:
            return False

        # Don't delete production models
        if entry.stage == "production":
            logger.error(f"Cannot delete production model {model_name}:{version}")
            return False

        # Delete model file
        model_file = Path(entry.metadata.file_path)
        if model_file.exists():
            model_file.unlink()

        # Remove from registry
        del self._registry[model_name][version]

        # Save registry
        self._save_registry()

        logger.info(f"Deleted model {model_name}:{version}")

        return True

    def get_model_info(self, model_name: str, version: str) -> Optional[ModelMetadata]:
        """Get information about a specific model version.

        Args:
            model_name: Name of the model
            version: Model version

        Returns:
            ModelMetadata if found
        """
        entry = self._registry.get(model_name, {}).get(version)

        if entry and entry.metadata:
            return entry.metadata

        return None

    def compare_versions(
        self, model_name: str, version1: str, version2: str
    ) -> dict[str, Any]:
        """Compare two versions of a model.

        Args:
            model_name: Name of the model
            version1: First version
            version2: Second version

        Returns:
            Comparison results
        """
        entry1 = self._registry.get(model_name, {}).get(version1)
        entry2 = self._registry.get(model_name, {}).get(version2)

        if not entry1 or not entry2:
            return {"error": "One or both versions not found"}

        return {
            "model_name": model_name,
            "version1": {
                "version": version1,
                "stage": entry1.stage,
                "created_at": entry1.created_at.isoformat(),
                "metrics": entry1.metrics,
            },
            "version2": {
                "version": version2,
                "stage": entry2.stage,
                "created_at": entry2.created_at.isoformat(),
                "metrics": entry2.metrics,
            },
            "comparison": {
                "accuracy_delta": entry2.metrics.get("accuracy", 0)
                - entry1.metrics.get("accuracy", 0),
                "f1_delta": entry2.metrics.get("f1_score", 0)
                - entry1.metrics.get("f1_score", 0),
            },
        }

    def _get_latest_version(self, model_name: str, stage: str) -> Optional[str]:
        """Get the latest version of a model in a stage."""
        versions = self._registry.get(model_name, {})

        # Filter by stage and sort by created date
        stage_versions = [(v, e) for v, e in versions.items() if e.stage == stage]
        stage_versions.sort(key=lambda x: x[1].created_at, reverse=True)

        return stage_versions[0][0] if stage_versions else None

    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256 = hashlib.sha256()

        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)

        return sha256.hexdigest()


# Global model registry instance
_global_registry: Optional[ModelRegistry] = None


def get_model_registry(storage_path: str = "./models") -> ModelRegistry:
    """Get the global model registry instance."""
    global _global_registry

    if _global_registry is None:
        _global_registry = ModelRegistry(storage_path)

    return _global_registry


class ModelServingMiddleware:
    """Middleware for serving models with automatic version management."""

    def __init__(self, registry: ModelRegistry):
        self.registry = registry
        self._predict_hooks: dict[str, Callable] = {}

    def serve_model(
        self,
        model_name: str,
        version: Optional[str] = None,
        stage: str = "production",
    ) -> Callable:
        """Decorator to serve a model endpoint.

        Usage:
            middleware = ModelServingMiddleware(registry)

            @middleware.serve_model("recommendation")
            async def recommend(input_data):
                model = yield  # Model is injected here
                return model.predict(input_data)
        """

        def decorator(func: Callable) -> Callable:
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Load model
                try:
                    model = self.registry.load_model(model_name, version, stage)
                    # Call the wrapped function with the model
                    if asyncio.iscoroutinefunction(func):
                        return await func(model, *args, **kwargs)
                    else:
                        return func(model, *args, **kwargs)
                except ModelLoadError as e:
                    logger.error(f"Failed to load model {model_name}: {e}")
                    raise

            return wrapper

        return decorator

    def add_predict_hook(self, model_name: str, hook: Callable) -> None:
        """Add a pre/post prediction hook for a model.

        Args:
            model_name: Name of the model
            hook: Hook function that takes (input, output) and returns modified output
        """
        if model_name not in self._predict_hooks:
            self._predict_hooks[model_name] = []
        self._predict_hooks[model_name].append(hook)

    async def predict_with_hooks(
        self,
        model_name: str,
        input_data: Any,
        version: Optional[str] = None,
        stage: str = "production",
    ) -> Any:
        """Make a prediction with registered hooks applied.

        Args:
            model_name: Name of the model
            input_data: Input data for prediction
            version: Model version
            stage: Deployment stage

        Returns:
            Prediction output with hooks applied
        """
        model = self.registry.load_model(model_name, version, stage)
        output = model.predict(input_data)

        # Apply hooks
        for hook in self._predict_hooks.get(model_name, []):
            output = (
                await hook(input_data, output)
                if asyncio.iscoroutinefunction(hook)
                else hook(input_data, output)
            )

        return output


import asyncio
