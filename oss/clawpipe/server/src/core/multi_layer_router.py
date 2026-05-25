#!/usr/bin/env python3
"""
Multi-Layer Model Router for FinSavvyAI
Thin orchestrator composing task classification, route selection, and load balancing.
"""

import asyncio
from typing import List, Optional, Tuple

from src.core.load_balancer import LoadBalancer
from src.core.route_selector import RouteSelector
from src.core.router_models import ModelCapability, TaskType, build_model_registry
from src.core.task_classifier import TaskClassifier

# Re-export public API so existing imports keep working
__all__ = [
    "TaskType",
    "ModelCapability",
    "IntelligentRouter",
    "LoadBalancer",
]


class IntelligentRouter:
    """Intelligent model routing system"""

    def __init__(self) -> None:
        self.models = build_model_registry()
        self.task_classifier = TaskClassifier()
        self.route_selector = RouteSelector(self.models)
        self.load_balancer = LoadBalancer()
        # Expose patterns for backward compat
        self.task_patterns = self.task_classifier.task_patterns

    def detect_task_type(self, message: str, has_images: bool = False) -> TaskType:
        """Detect task type from message content."""
        return self.task_classifier.detect_task_type(message, has_images)

    def select_best_model(
        self,
        task_type: TaskType,
        message: str = "",
        has_images: bool = False,
        preferred_language: str = None,
        speed_preference: str = "balanced",
    ) -> Optional[ModelCapability]:
        """Select the best model for the given task."""
        return self.route_selector.select_best_model(
            task_type, message, has_images, preferred_language, speed_preference
        )

    async def route_request(
        self,
        message: str,
        has_images: bool = False,
        preferred_language: str = None,
        speed_preference: str = "balanced",
    ) -> Tuple[str, ModelCapability]:
        """Route request to the best available model with fallback."""
        task_type = self.detect_task_type(message, has_images)
        candidates = self.get_model_recommendations(task_type, limit=5)

        if not candidates:
            candidates = [self.models.get("phi-2") or list(self.models.values())[0]]

        for candidate in candidates:
            worker_url = await self.load_balancer.get_worker_for_model(candidate.name)
            if worker_url:
                return worker_url, candidate

        fallback_model = candidates[0]
        worker_url = await self.load_balancer.get_any_worker()
        return worker_url, fallback_model

    def get_model_recommendations(
        self, task_type: TaskType, limit: int = 3
    ) -> List[ModelCapability]:
        """Get recommended models for a task type."""
        return self.route_selector.get_model_recommendations(task_type, limit)

    def print_model_inventory(self) -> None:
        """Print organized model inventory."""
        self.route_selector.print_model_inventory()


async def main() -> None:
    """Demo the intelligent router"""
    router = IntelligentRouter()
    router.print_model_inventory()

    test_messages = [
        ("Write a Python function to sort a list", False),
        ("Debug this error: TypeError in my React app", False),
        ("Explain microservices architecture", False),
        ("Analyze this screenshot of my app", True),
        ("Create a SQL query for user data", False),
        ("Hello, how are you?", False),
    ]

    print("\n🔄 Intelligent Routing Demo")
    print("=" * 40)

    for message, has_images in test_messages:
        task_type = router.detect_task_type(message, has_images)
        model = router.select_best_model(task_type, message, has_images)

        print(f"\nMessage: {message}")
        print(f"Task Type: {task_type.value}")
        print(f"Selected Model: {model.name} (Layer {model.layer})")
        print(f"Reason: {', '.join(model.specializations)}")


if __name__ == "__main__":
    asyncio.run(main())
