#!/usr/bin/env python3
"""
Inference Engine Data Models

Enums, dataclasses, and configuration types for the inference engine.
"""

import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional


class DeviceType(Enum):
    CPU = "cpu"
    CUDA = "cuda"
    METAL = "metal"


class ModelStatus(Enum):
    UNLOADED = "unloaded"
    LOADING = "loading"
    READY = "ready"
    ERROR = "error"


@dataclass
class ModelConfig:
    """Configuration for a loaded model."""

    model_path: str
    model_id: str
    n_ctx: int = 4096
    n_gpu_layers: int = -1  # -1 = auto (all layers on GPU if available)
    n_batch: int = 512
    n_threads: int = 0  # 0 = auto
    chat_format: str = "chatml"
    verbose: bool = False


@dataclass
class InferenceResult:
    """Result from an inference call."""

    text: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    finish_reason: str
    model_id: str
    duration_seconds: float


@dataclass
class LoadedModel:
    """Tracks a loaded model and its state."""

    config: ModelConfig
    status: ModelStatus = ModelStatus.UNLOADED
    llm: object = None  # llama_cpp.Llama instance
    loaded_at: float = 0.0
    request_count: int = 0
    total_tokens_generated: int = 0
    last_used: float = 0.0
    error_message: str = ""
    lock: threading.Lock = field(default_factory=threading.Lock)
