#!/usr/bin/env python3
"""
Inference Engine Model Loader

Handles device detection, model loading/unloading, and model discovery.
"""

import logging
import os
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

from src.core.inference_models import (
    DeviceType,
    LoadedModel,
    ModelConfig,
    ModelStatus,
)

logger = logging.getLogger("finsavvyai.inference")


def detect_device() -> DeviceType:
    """Detect the best available compute device."""
    try:
        import torch

        if torch.cuda.is_available():
            logger.info("CUDA device detected")
            return DeviceType.CUDA
    except ImportError:
        pass

    import platform

    if platform.system() == "Darwin" and platform.machine() == "arm64":
        logger.info("Apple Silicon (Metal) detected")
        return DeviceType.METAL

    logger.info("Using CPU device")
    return DeviceType.CPU


def check_llama_cpp() -> bool:
    """Check if llama-cpp-python is available."""
    try:
        import llama_cpp  # noqa: F401

        return True
    except ImportError:
        logger.warning(
            "llama-cpp-python not installed. "
            "Install with: pip install llama-cpp-python"
        )
        return False


def list_local_models(models_dir: Path) -> List[Dict]:
    """List GGUF model files available in the models directory."""
    models: List[Dict] = []
    for path in models_dir.rglob("*.gguf"):
        stat = path.stat()
        models.append(
            {
                "path": str(path),
                "name": path.stem,
                "size_bytes": stat.st_size,
                "size_gb": round(stat.st_size / (1024**3), 2),
            }
        )
    return sorted(models, key=lambda m: m["name"])


def load_model(
    config: ModelConfig,
    models: Dict[str, LoadedModel],
    lock: threading.Lock,
    device: DeviceType,
    llama_cpp_available: bool,
) -> bool:
    """Load a model into memory. Blocking call."""
    if not llama_cpp_available:
        logger.error("Cannot load model: llama-cpp-python not installed")
        return False

    model_path = Path(config.model_path)
    if not model_path.exists():
        logger.error("Model file not found: %s", config.model_path)
        return False

    with lock:
        if config.model_id in models:
            existing = models[config.model_id]
            if existing.status == ModelStatus.READY:
                logger.info("Model %s already loaded", config.model_id)
                return True
            if existing.status == ModelStatus.LOADING:
                logger.info("Model %s is currently loading", config.model_id)
                return False

        loaded = LoadedModel(config=config, status=ModelStatus.LOADING)
        models[config.model_id] = loaded

    logger.info("Loading model %s from %s", config.model_id, config.model_path)

    try:
        from llama_cpp import Llama

        n_gpu_layers = config.n_gpu_layers
        if n_gpu_layers == -1:
            if device in (DeviceType.METAL, DeviceType.CUDA):
                n_gpu_layers = 99
            else:
                n_gpu_layers = 0

        n_threads = config.n_threads
        if n_threads == 0:
            import multiprocessing

            n_threads = max(1, multiprocessing.cpu_count() - 1)

        llm = Llama(
            model_path=config.model_path,
            n_ctx=config.n_ctx,
            n_gpu_layers=n_gpu_layers,
            n_batch=config.n_batch,
            n_threads=n_threads,
            chat_format=config.chat_format,
            verbose=config.verbose,
        )

        with lock:
            loaded.llm = llm
            loaded.status = ModelStatus.READY
            loaded.loaded_at = time.time()
            loaded.error_message = ""

        logger.info(
            "Model %s loaded successfully (gpu_layers=%d, threads=%d, ctx=%d)",
            config.model_id,
            n_gpu_layers,
            n_threads,
            config.n_ctx,
        )
        return True

    except Exception as e:
        logger.error("Failed to load model %s: %s", config.model_id, e)
        with lock:
            loaded.status = ModelStatus.ERROR
            loaded.error_message = str(e)
        return False


def unload_model(
    model_id: str,
    models: Dict[str, LoadedModel],
    lock: threading.Lock,
) -> bool:
    """Unload a model from memory."""
    with lock:
        if model_id not in models:
            logger.warning("Model %s not found for unloading", model_id)
            return False

        loaded = models[model_id]
        with loaded.lock:
            if loaded.llm is not None:
                del loaded.llm
                loaded.llm = None
            loaded.status = ModelStatus.UNLOADED
            del models[model_id]

    logger.info("Model %s unloaded", model_id)
    return True
