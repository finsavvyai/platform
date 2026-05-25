#!/usr/bin/env python3
"""
Route selection logic for the multi-layer router.
Selects the best model for a given task based on capabilities, load, and preferences.
"""

from typing import Dict, List, Optional

from src.core.router_models import ModelCapability, TaskType


class RouteSelector:
    """Selects models based on task type, capabilities, and user preferences."""

    def __init__(self, models: Dict[str, ModelCapability]) -> None:
        self.models = models

    def select_best_model(
        self,
        task_type: TaskType,
        message: str = "",
        has_images: bool = False,
        preferred_language: str = None,
        speed_preference: str = "balanced",
    ) -> Optional[ModelCapability]:
        """Select the best model for the given task."""
        suitable_models = self._find_suitable_models(task_type)

        if not suitable_models:
            suitable_models = [
                m for m in self.models.values() if "general" in m.specializations
            ]

        if has_images:
            suitable_models = [m for m in suitable_models if m.supports_images]

        if preferred_language:
            suitable_models = [
                m
                for m in suitable_models
                if not m.supported_languages
                or preferred_language in m.supported_languages
            ]

        if not suitable_models:
            return None

        return self._sort_by_preference(suitable_models, speed_preference)[0]

    def get_model_recommendations(
        self, task_type: TaskType, limit: int = 3
    ) -> List[ModelCapability]:
        """Get recommended models for a task type."""
        recommendations = self._find_suitable_models(task_type)
        recommendations.sort(key=lambda m: (-m.layer, m.cost_per_token))
        return recommendations[:limit]

    def print_model_inventory(self) -> None:
        """Print organized model inventory."""
        print("🤖 FinSavvyAI Multi-Layer Model Inventory")
        print("=" * 60)

        for layer in range(1, 6):
            layer_models = [m for m in self.models.values() if m.layer == layer]
            if not layer_models:
                continue

            layer_names = {
                1: "⚡ Fast Models (Quick Tasks)",
                2: "💻 Development Models (Code & Programming)",
                3: "🧠 Large Models (Complex Reasoning)",
                4: "👁️  Multimodal Models (Vision & Advanced)",
                5: "🎯 Specialized Models (Specific Tasks)",
            }

            print(f"\n{layer_names.get(layer, f'Layer {layer}')}")
            print("-" * 50)

            for model in layer_models:
                self._print_model_details(model)

    def _find_suitable_models(self, task_type: TaskType) -> List[ModelCapability]:
        """Find models that match the given task type."""
        suitable = []
        task_spec = task_type.value.replace("-", "_")
        for model in self.models.values():
            if task_spec in model.specializations or task_type.value in model.specializations:
                suitable.append(model)
        return suitable

    @staticmethod
    def _sort_by_preference(
        models: List[ModelCapability], speed_preference: str
    ) -> List[ModelCapability]:
        """Sort models by speed preference."""
        if speed_preference == "fastest":
            models.sort(key=lambda m: (m.layer, -len(m.specializations)))
        elif speed_preference == "best":
            models.sort(key=lambda m: (-m.layer, m.cost_per_token))
        else:  # balanced
            models.sort(key=lambda m: (m.layer, m.cost_per_token))
        return models

    @staticmethod
    def _print_model_details(model: ModelCapability) -> None:
        """Print details for a single model."""
        status = "✅" if model.name in ["phi-2", "glm-4v-9b"] else "⬇️"
        print(f"  {status} {model.name}")
        print(f"     Specializations: {', '.join(model.specializations)}")
        print(
            f"     Speed: {model.speed} | Size: "
            f"{model.name.split('-')[-1] if '-' in model.name else 'Unknown'}"
        )
        if model.supports_images:
            print(f"     🖼️  Supports images")
        if model.supported_languages:
            langs = ", ".join(model.supported_languages[:5])
            suffix = "..." if len(model.supported_languages) > 5 else ""
            print(f"     Languages: {langs}{suffix}")
        print()
