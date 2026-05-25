#!/usr/bin/env python3
"""
Multi-Layer Model Router for FinSavvyAI
Intelligently routes requests to specialized models based on task requirements
"""

import asyncio
import json
import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

import aiohttp


class TaskType(Enum):
    """Task types for intelligent routing"""

    GENERAL_CHAT = "general"
    QUICK_TASK = "quick-task"
    CODING = "coding"
    DEBUGGING = "debugging"
    CODE_REVIEW = "code-review"
    ARCHITECTURE = "architecture"
    COMPLEX_REASONING = "complex-reasoning"
    ANALYSIS = "analysis"
    VISION = "vision"
    UI_ANALYSIS = "ui-analysis"
    SQL = "sql"
    MATHEMATICS = "mathematics"
    DOCUMENTATION = "documentation"


@dataclass
class ModelCapability:
    """Model capability definition"""

    name: str
    layer: int
    specializations: List[str]
    speed: str
    supported_languages: List[str] = None
    supports_images: bool = False
    max_tokens: int = 4096
    cost_per_token: float = 1.0


class IntelligentRouter:
    """Intelligent model routing system"""

    def __init__(self):
        self.models = self._initialize_models()
        self.task_patterns = self._initialize_task_patterns()
        self.load_balancer = LoadBalancer()

    def _initialize_models(self) -> Dict[str, ModelCapability]:
        """Initialize model capabilities"""
        return {
            # Layer 1 - Fast Models
            "phi-2": ModelCapability(
                name="phi-2",
                layer=1,
                specializations=["quick-tasks", "code-assist", "general"],
                speed="very-fast",
                supported_languages=["python", "javascript"],
                max_tokens=2048,
                cost_per_token=0.1,
            ),
            "mistral-7b-instruct": ModelCapability(
                name="mistral-7b-instruct",
                layer=1,
                specializations=["general", "instructions", "reasoning"],
                speed="fast",
                supported_languages=["python", "javascript", "java", "cpp", "go"],
                max_tokens=4096,
                cost_per_token=0.3,
            ),
            # Layer 2 - Development Models
            "codellama-7b-instruct": ModelCapability(
                name="codellama-7b-instruct",
                layer=2,
                specializations=["coding", "debugging", "code-review", "documentation"],
                speed="medium",
                supported_languages=[
                    "python",
                    "javascript",
                    "java",
                    "cpp",
                    "go",
                    "rust",
                    "sql",
                ],
                max_tokens=4096,
                cost_per_token=0.5,
            ),
            "deepseek-coder-6.7b": ModelCapability(
                name="deepseek-coder-6.7b",
                layer=2,
                specializations=[
                    "coding",
                    "algorithms",
                    "optimization",
                    "architecture",
                ],
                speed="medium",
                supported_languages=[
                    "python",
                    "javascript",
                    "java",
                    "cpp",
                    "go",
                    "rust",
                    "typescript",
                    "php",
                ],
                max_tokens=8192,
                cost_per_token=0.6,
            ),
            "starcoder2-7b": ModelCapability(
                name="starcoder2-7b",
                layer=2,
                specializations=["code-generation", "refactoring", "testing"],
                speed="medium",
                supported_languages=[
                    "python",
                    "javascript",
                    "typescript",
                    "java",
                    "cpp",
                    "go",
                    "rust",
                    "php",
                    "ruby",
                ],
                max_tokens=8192,
                cost_per_token=0.6,
            ),
            # Layer 3 - Complex Reasoning
            "llama-2-7b-chat": ModelCapability(
                name="llama-2-7b-chat",
                layer=3,
                specializations=["reasoning", "analysis", "planning"],
                speed="medium",
                max_tokens=4096,
                cost_per_token=0.7,
            ),
            "llama-3-8b-instruct": ModelCapability(
                name="llama-3-8b-instruct",
                layer=3,
                specializations=["complex-reasoning", "analysis", "strategy"],
                speed="medium-slow",
                max_tokens=8192,
                cost_per_token=0.8,
            ),
            # Layer 4 - Multimodal
            "glm-4v-9b": ModelCapability(
                name="glm-4v-9b",
                layer=4,
                specializations=["vision", "ui-analysis", "multimodal", "diagrams"],
                speed="slow",
                supports_images=True,
                max_tokens=4096,
                cost_per_token=1.2,
            ),
            "llava-1.5-7b": ModelCapability(
                name="llava-1.5-7b",
                layer=4,
                specializations=["image-analysis", "visual-reasoning", "ui-design"],
                speed="medium-slow",
                supports_images=True,
                max_tokens=4096,
                cost_per_token=1.0,
            ),
            # Layer 5 - Specialized
            "sqlcoder-7b": ModelCapability(
                name="sqlcoder-7b",
                layer=5,
                specializations=["sql", "database", "query-optimization"],
                speed="medium",
                max_tokens=4096,
                cost_per_token=0.8,
            ),
            "mathcoder-7b": ModelCapability(
                name="mathcoder-7b",
                layer=5,
                specializations=["mathematics", "algorithms", "logic"],
                speed="medium",
                max_tokens=4096,
                cost_per_token=0.8,
            ),
        }

    def _initialize_task_patterns(self) -> Dict[TaskType, List[str]]:
        """Initialize regex patterns for task detection"""
        return {
            TaskType.GENERAL_CHAT: [
                r"^(hi|hello|hey|how are you|what's up)",
                r"(tell me|explain|describe).*(about|what is)",
                r"(weather|news|story|joke)",
            ],
            TaskType.QUICK_TASK: [
                r"^(summarize|translate|define|spell)",
                r"(quick|simple|brief).*(answer|explain)",
                r"(short|concise)",
            ],
            TaskType.CODING: [
                r"(write|create|generate).*(code|function|class|script)",
                r"(implement|build|develop).*",
                r"(help me code|can you code)",
                r"(python|javascript|java|cpp|go|rust|php|ruby).*code",
            ],
            TaskType.DEBUGGING: [
                r"(debug|fix|error|issue|problem|broken)",
                r"(not working|wrong|incorrect)",
                r"(bug|exception|fail)",
                r"(why isn't|why not working)",
            ],
            TaskType.CODE_REVIEW: [
                r"(review|analyze|improve|optimize).*(code|performance)",
                r"(best practice|clean code|refactor)",
                r"(suggest|recommend).*improvement",
            ],
            TaskType.ARCHITECTURE: [
                r"(architecture|design|pattern|structure)",
                r"(system design|scalable|microservices)",
                r"(database design|api design)",
            ],
            TaskType.COMPLEX_REASONING: [
                r"(analyze|evaluate|compare|contrast)",
                r"(strategy|plan|approach)",
                r"(complex|difficult|challenging)",
            ],
            TaskType.VISION: [
                r"(image|picture|photo|visual|see)",
                r"(analyze image|describe picture)",
                r"(screenshot|diagram|chart)",
            ],
            TaskType.UI_ANALYSIS: [
                r"(ui|ux|interface|design|layout)",
                r"(webpage|app|screen)",
                r"(usability|accessibility)",
            ],
            TaskType.SQL: [
                r"(sql|query|database|table)",
                r"(select|insert|update|delete)",
                r"(join|where|group by)",
            ],
            TaskType.MATHEMATICS: [
                r"(math|calculate|compute|equation)",
                r"(formula|algorithm|statistics)",
                r"(probability|calculus|algebra)",
            ],
        }

    def detect_task_type(self, message: str, has_images: bool = False) -> TaskType:
        """Detect task type from message content"""
        message_lower = message.lower()

        # Check for vision tasks first
        if has_images:
            return TaskType.VISION

        # Check UI analysis
        if any(
            re.search(pattern, message_lower)
            for pattern in self.task_patterns.get(TaskType.UI_ANALYSIS, [])
        ):
            return TaskType.UI_ANALYSIS

        # Check other task types
        for task_type, patterns in self.task_patterns.items():
            if task_type in [TaskType.VISION, TaskType.UI_ANALYSIS]:
                continue  # Already checked

            for pattern in patterns:
                if re.search(pattern, message_lower):
                    return task_type

        # Default to general chat
        return TaskType.GENERAL_CHAT

    def select_best_model(
        self,
        task_type: TaskType,
        message: str = "",
        has_images: bool = False,
        preferred_language: str = None,
        speed_preference: str = "balanced",
    ) -> Optional[ModelCapability]:
        """Select the best model for the given task"""

        # Filter models by task requirements
        suitable_models = []

        for model in self.models.values():
            # Check if model supports required specializations
            task_specialization = task_type.value.replace("-", "_")
            if (
                task_specialization in model.specializations
                or task_type.value in model.specializations
            ):
                suitable_models.append(model)

        # If no specialized models found, use general models
        if not suitable_models:
            for model in self.models.values():
                if "general" in model.specializations:
                    suitable_models.append(model)

        # Filter by image support if needed
        if has_images:
            suitable_models = [m for m in suitable_models if m.supports_images]

        # Filter by language preference
        if preferred_language:
            suitable_models = [
                m
                for m in suitable_models
                if not m.supported_languages
                or preferred_language in m.supported_languages
            ]

        if not suitable_models:
            return None

        # Sort by preference
        if speed_preference == "fastest":
            suitable_models.sort(key=lambda m: (m.layer, -len(m.specializations)))
        elif speed_preference == "best":
            suitable_models.sort(key=lambda m: (-m.layer, m.cost_per_token))
        else:  # balanced
            suitable_models.sort(key=lambda m: (m.layer, m.cost_per_token))

        return suitable_models[0]

    async def route_request(
        self,
        message: str,
        has_images: bool = False,
        preferred_language: str = None,
        speed_preference: str = "balanced",
    ) -> Tuple[str, ModelCapability]:
        """Route request to the best available model"""

        # Detect task type
        task_type = self.detect_task_type(message, has_images)

        # Select best model
        selected_model = self.select_best_model(
            task_type, message, has_images, preferred_language, speed_preference
        )

        if not selected_model:
            # Fallback to phi-2 (should always be available)
            selected_model = self.models["phi-2"]

        # Get available worker with this model
        worker_info = await self.load_balancer.get_worker_for_model(selected_model.name)

        return worker_info, selected_model

    def get_model_recommendations(
        self, task_type: TaskType, limit: int = 3
    ) -> List[ModelCapability]:
        """Get recommended models for a task type"""
        recommendations = []

        for model in self.models.values():
            if (
                task_type.value in model.specializations
                or task_type.value.replace("-", "_") in model.specializations
            ):
                recommendations.append(model)

        # Sort by layer (higher is better) then by cost
        recommendations.sort(key=lambda m: (-m.layer, m.cost_per_token))

        return recommendations[:limit]

    def print_model_inventory(self):
        """Print organized model inventory"""
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
                status = "✅" if model.name in ["phi-2", "glm-4v-9b"] else "⬇️"
                print(f"  {status} {model.name}")
                print(f"     Specializations: {', '.join(model.specializations)}")
                print(
                    f"     Speed: {model.speed} | Size: {model.name.split('-')[-1] if '-' in model.name else 'Unknown'}"
                )
                if model.supports_images:
                    print(f"     🖼️  Supports images")
                if model.supported_languages:
                    print(
                        f"     Languages: {', '.join(model.supported_languages[:5])}{'...' if len(model.supported_languages) > 5 else ''}"
                    )
                print()


class LoadBalancer:
    """Load balancing for model routing"""

    def __init__(self):
        self.master_url = "http://10.0.0.10:8000"

    async def get_worker_for_model(self, model_name: str) -> str:
        """Get worker information for a specific model"""
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(f"{self.master_url}/cluster/nodes") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for node in data.get("nodes", []):
                            if model_name in node.get("models", []):
                                return f"http://{node['host']}:{node['port']}"
            except:
                pass

        # Fallback to localhost
        return "http://localhost:8001"


async def main():
    """Demo the intelligent router"""
    router = IntelligentRouter()

    # Print model inventory
    router.print_model_inventory()

    # Test routing examples
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
