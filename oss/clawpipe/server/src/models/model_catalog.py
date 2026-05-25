#!/usr/bin/env python3
"""
Model catalog definitions for FinSavvyAI.

Contains GGUF and Hugging Face model registries used by
ModelDownloadManager.

Sprint module extracted from download_models.py.
"""

from typing import Dict, List


def get_gguf_models() -> Dict[str, Dict]:
    """Return the GGUF model catalog (quantized, llama-cpp-python)."""
    return {
        "phi-2-q4": {
            "repo_id": "TheBloke/phi-2-GGUF",
            "filename": "phi-2.Q4_K_M.gguf",
            "model_id": "phi-2",
            "size": "1.8GB",
            "quantization": "Q4_K_M",
            "description": "Phi-2 (4-bit quantized) - Fast, small, good for quick tasks",
        },
        "mistral-7b-q4": {
            "repo_id": "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
            "filename": "mistral-7b-instruct-v0.2.Q4_K_M.gguf",
            "model_id": "mistral-7b-instruct",
            "size": "4.4GB",
            "quantization": "Q4_K_M",
            "description": "Mistral 7B Instruct (4-bit) - Balanced chat model",
        },
        "mistral-7b-q8": {
            "repo_id": "TheBloke/Mistral-7B-Instruct-v0.2-GGUF",
            "filename": "mistral-7b-instruct-v0.2.Q8_0.gguf",
            "model_id": "mistral-7b-instruct",
            "size": "7.7GB",
            "quantization": "Q8_0",
            "description": "Mistral 7B Instruct (8-bit) - Higher quality",
        },
        "codellama-7b-q4": {
            "repo_id": "TheBloke/CodeLlama-7B-Instruct-GGUF",
            "filename": "codellama-7b-instruct.Q4_K_M.gguf",
            "model_id": "codellama-7b-instruct",
            "size": "4.1GB",
            "quantization": "Q4_K_M",
            "description": "CodeLlama 7B (4-bit) - Code generation specialist",
        },
        "llama-3-8b-q4": {
            "repo_id": "QuantFactory/Meta-Llama-3-8B-Instruct-GGUF",
            "filename": "Meta-Llama-3-8B-Instruct.Q4_K_M.gguf",
            "model_id": "llama-3-8b-instruct",
            "size": "4.9GB",
            "quantization": "Q4_K_M",
            "description": "Llama 3 8B Instruct (4-bit) - Advanced reasoning",
        },
    }


def get_available_models() -> Dict[str, Dict]:
    """Return the full HF model catalog (legacy repos)."""
    return {
        "zephyr-7b-beta": {
            "repo_id": "HuggingFaceH4/zephyr-7b-beta",
            "size": "4.8GB",
            "type": "chat",
            "description": "Fast and capable chat model",
            "recommended": True,
            "layer": 1,
            "specialization": ["general", "quick-tasks"],
            "speed": "fast",
        },
        "mistral-7b-instruct": {
            "repo_id": "mistralai/Mistral-7B-Instruct-v0.2",
            "size": "4.1GB",
            "type": "chat",
            "description": "Instruction-tuned model for chat",
            "recommended": True,
            "layer": 1,
            "specialization": ["instructions", "reasoning"],
            "speed": "fast",
        },
        "phi-2": {
            "repo_id": "microsoft/phi-2",
            "size": "2.8GB",
            "type": "chat",
            "description": "Small but capable model from Microsoft",
            "recommended": True,
            "layer": 1,
            "specialization": ["quick-tasks", "code-assist"],
            "speed": "very-fast",
        },
        "codellama-7b-instruct": {
            "repo_id": "codellama/CodeLlama-7b-Instruct-hf",
            "size": "7.4GB",
            "type": "code",
            "description": "CodeLlama model specialized for programming",
            "recommended": True,
            "layer": 2,
            "specialization": ["coding", "debugging", "code-review", "documentation"],
            "speed": "medium",
            "supports_languages": [
                "python", "javascript", "java", "cpp", "go", "rust", "sql",
            ],
        },
        "deepseek-coder-6.7b": {
            "repo_id": "deepseek-ai/deepseek-coder-6.7b-instruct",
            "size": "6.5GB",
            "type": "code",
            "description": "DeepSeek Coder - Advanced programming assistant",
            "recommended": True,
            "layer": 2,
            "specialization": ["coding", "algorithms", "optimization", "architecture"],
            "speed": "medium",
            "supports_languages": [
                "python", "javascript", "java", "cpp", "go", "rust",
                "typescript", "php",
            ],
        },
        "starcoder2-7b": {
            "repo_id": "bigcode/starcoder2-7b",
            "size": "7.1GB",
            "type": "code",
            "description": "StarCoder2 - Advanced code generation model",
            "recommended": True,
            "layer": 2,
            "specialization": ["code-generation", "refactoring", "testing"],
            "speed": "medium",
            "supports_languages": [
                "python", "javascript", "typescript", "java", "cpp",
                "go", "rust", "php", "ruby",
            ],
        },
        "llama-2-7b-chat": {
            "repo_id": "meta-llama/Llama-2-7b-chat-hf",
            "size": "6.7GB",
            "type": "chat",
            "description": "Meta's Llama 2 chat model",
            "recommended": True,
            "layer": 3,
            "specialization": ["reasoning", "analysis", "planning"],
            "speed": "medium",
            "requires_auth": True,
        },
        "llama-3-8b-instruct": {
            "repo_id": "meta-llama/Meta-Llama-3-8B-Instruct",
            "size": "8.2GB",
            "type": "chat",
            "description": "Meta's Llama 3 - Advanced reasoning model",
            "recommended": True,
            "layer": 3,
            "specialization": ["complex-reasoning", "analysis", "strategy"],
            "speed": "medium-slow",
            "requires_auth": True,
        },
        "glm-4v-9b": {
            "repo_id": "THUDM/glm-4v-9b",
            "size": "18GB",
            "type": "vision",
            "description": "GLM-4V multimodal model with vision capabilities",
            "recommended": True,
            "supports_images": True,
            "layer": 4,
            "specialization": ["vision", "ui-analysis", "multimodal", "diagrams"],
            "speed": "slow",
        },
        "llava-1.5-7b": {
            "repo_id": "liuhaotian/llava-1.5-7b",
            "size": "13GB",
            "type": "vision",
            "description": "LLaVA - Large Language and Vision Assistant",
            "recommended": True,
            "supports_images": True,
            "layer": 4,
            "specialization": ["image-analysis", "visual-reasoning", "ui-design"],
            "speed": "medium-slow",
        },
        "sqlcoder-7b": {
            "repo_id": "defog/sqlcoder-7b",
            "size": "6.8GB",
            "type": "sql",
            "description": "SQLCoder - SQL query generation and optimization",
            "recommended": False,
            "layer": 5,
            "specialization": ["sql", "database", "query-optimization"],
            "speed": "medium",
        },
        "mathcoder-7b": {
            "repo_id": "microsoft/Orca-2-7b",
            "size": "6.4GB",
            "type": "math",
            "description": "Math specialist model for complex mathematical reasoning",
            "recommended": False,
            "layer": 5,
            "specialization": ["mathematics", "algorithms", "logic"],
            "speed": "medium",
        },
    }
