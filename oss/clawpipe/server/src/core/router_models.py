#!/usr/bin/env python3
"""
Data models and model registry for the multi-layer router.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List


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


def build_model_registry() -> Dict[str, ModelCapability]:
    """Initialize the default model capability registry."""
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
