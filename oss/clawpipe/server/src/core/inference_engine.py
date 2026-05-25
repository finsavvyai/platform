#!/usr/bin/env python3
"""
FinSavvyAI LLM Inference Engine

Manages model loading, inference, and resource allocation.
Supports llama-cpp-python for GGUF models with CPU and GPU backends.

Sub-modules:
  inference_models     - Enums, dataclasses, config types
  inference_loader     - Device detection, model load/unload
  inference_completion - Chat completion (sync, async, streaming)
"""

import asyncio
import logging
import os
import threading
import time
from pathlib import Path
from typing import AsyncIterator, Dict, List, Optional

from src.core.inference_models import (  # noqa: F401
    DeviceType,
    InferenceResult,
    LoadedModel,
    ModelConfig,
    ModelStatus,
)
from src.core.inference_loader import (
    check_llama_cpp,
    detect_device,
    list_local_models,
    load_model as _load_model_fn,
    unload_model as _unload_model_fn,
)
from src.core.inference_completion import (
    complete as _complete_fn,
    stream_complete as _stream_complete_fn,
    stream_complete_async as _stream_complete_async_fn,
)

logger = logging.getLogger("finsavvyai.inference")


class InferenceEngine:
    """Manages LLM model loading and inference."""

    def __init__(self, models_dir: str = None):
        if models_dir is None:
            models_dir = os.environ.get(
                "FINSAVVYAI_MODELS_DIR",
                str(Path.home() / "finsavvyai-models"),
            )
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._models: Dict[str, LoadedModel] = {}
        self._lock = threading.Lock()
        self._device = detect_device()
        self._llama_cpp_available = check_llama_cpp()
        logger.info(
            "InferenceEngine initialized, device=%s, llama_cpp=%s",
            self._device.value, self._llama_cpp_available,
        )

    @property
    def device(self) -> DeviceType:
        return self._device

    @property
    def available(self) -> bool:
        return self._llama_cpp_available

    def list_local_models(self) -> List[Dict]:
        return list_local_models(self.models_dir)

    def get_loaded_models(self) -> Dict[str, Dict]:
        result: Dict[str, Dict] = {}
        with self._lock:
            for mid, m in self._models.items():
                result[mid] = {
                    "model_id": mid, "status": m.status.value,
                    "loaded_at": m.loaded_at, "request_count": m.request_count,
                    "total_tokens_generated": m.total_tokens_generated,
                    "last_used": m.last_used, "error_message": m.error_message,
                    "model_path": m.config.model_path,
                    "n_ctx": m.config.n_ctx, "device": self._device.value,
                }
        return result

    def load_model(self, config: ModelConfig) -> bool:
        return _load_model_fn(
            config, self._models, self._lock,
            self._device, self._llama_cpp_available,
        )

    async def load_model_async(self, config: ModelConfig) -> bool:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.load_model, config)

    def unload_model(self, model_id: str) -> bool:
        return _unload_model_fn(model_id, self._models, self._lock)

    def is_model_ready(self, model_id: str) -> bool:
        with self._lock:
            loaded = self._models.get(model_id)
            return loaded is not None and loaded.status == ModelStatus.READY

    def complete(self, model_id: str, messages: List[Dict[str, str]],
                 max_tokens: int = 512, temperature: float = 0.7,
                 top_p: float = 0.9, stop: Optional[List[str]] = None) -> InferenceResult:
        return _complete_fn(model_id, messages, self._models, self._lock,
                            max_tokens, temperature, top_p, stop)

    async def complete_async(self, model_id: str, messages: List[Dict[str, str]],
                             max_tokens: int = 512, temperature: float = 0.7,
                             top_p: float = 0.9, stop: Optional[List[str]] = None) -> InferenceResult:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.complete, model_id, messages,
            max_tokens, temperature, top_p, stop)

    def stream_complete(self, model_id: str, messages: List[Dict[str, str]],
                        max_tokens: int = 512, temperature: float = 0.7,
                        top_p: float = 0.9, stop: Optional[List[str]] = None):
        return _stream_complete_fn(model_id, messages, self._models, self._lock,
                                   max_tokens, temperature, top_p, stop)

    async def stream_complete_async(self, model_id: str, messages: List[Dict[str, str]],
                                    max_tokens: int = 512, temperature: float = 0.7,
                                    top_p: float = 0.9, stop: Optional[List[str]] = None) -> AsyncIterator[Dict]:
        async for chunk in _stream_complete_async_fn(
            self, model_id, messages, max_tokens, temperature, top_p, stop):
            yield chunk

    def get_model_health(self, model_id: str) -> Dict:
        with self._lock:
            loaded = self._models.get(model_id)
            if loaded is None:
                return {"status": "not_loaded", "model_id": model_id}
            return {
                "status": loaded.status.value, "model_id": model_id,
                "model_path": loaded.config.model_path,
                "loaded_at": loaded.loaded_at,
                "request_count": loaded.request_count,
                "total_tokens_generated": loaded.total_tokens_generated,
                "last_used": loaded.last_used,
                "uptime_seconds": round(time.time() - loaded.loaded_at, 1) if loaded.loaded_at else 0,
                "device": self._device.value, "n_ctx": loaded.config.n_ctx,
                "error": loaded.error_message or None,
            }

    def get_engine_status(self) -> Dict:
        with self._lock:
            ms: Dict[str, str] = {}
            total_req = total_tok = 0
            for mid, m in self._models.items():
                ms[mid] = m.status.value
                total_req += m.request_count
                total_tok += m.total_tokens_generated
        return {
            "available": self._llama_cpp_available, "device": self._device.value,
            "models_dir": str(self.models_dir), "loaded_models": ms,
            "total_models_loaded": sum(1 for s in ms.values() if s == "ready"),
            "total_requests": total_req, "total_tokens_generated": total_tok,
            "local_gguf_files": len(self.list_local_models()),
        }


_engine: Optional[InferenceEngine] = None


def get_inference_engine() -> InferenceEngine:
    """Get or create the global inference engine."""
    global _engine
    if _engine is None:
        _engine = InferenceEngine()
    return _engine
