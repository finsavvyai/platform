"""Worker HTTP route handlers: model management, metrics, and models listing."""

import json
import time
from datetime import datetime
from pathlib import Path

import aiohttp.web
import psutil

from src.core.inference_engine import ModelConfig
from src.core.logger import get_logger

logger = get_logger()


async def handle_load_model(request):
    """POST /models/load - Load a GGUF model into the inference engine."""
    worker = request.app["worker"]
    try:
        data = await request.json()
    except json.JSONDecodeError:
        return aiohttp.web.json_response({"error": "Invalid JSON"}, status=400)

    model_id = data.get("model_id")
    model_path = data.get("model_path")
    if not model_id or not model_path:
        return aiohttp.web.json_response({"error": "model_id and model_path are required"}, status=400)
    if not Path(model_path).exists():
        return aiohttp.web.json_response({"error": f"Model file not found: {model_path}"}, status=404)

    config = ModelConfig(
        model_id=model_id, model_path=model_path,
        n_ctx=data.get("n_ctx", 4096), n_gpu_layers=data.get("n_gpu_layers", -1),
        n_batch=data.get("n_batch", 512), n_threads=data.get("n_threads", 0),
        chat_format=data.get("chat_format", "chatml"),
    )
    logger.info("Loading model", model_id=model_id, path=model_path)
    success = await worker.engine.load_model_async(config)
    if success:
        if model_id not in worker.config.models:
            worker.config.models.append(model_id)
        return aiohttp.web.json_response({"status": "loaded", "model_id": model_id})
    health = worker.engine.get_model_health(model_id)
    return aiohttp.web.json_response(
        {"status": "error", "model_id": model_id, "error": health.get("error", "Unknown error")},
        status=500,
    )


async def handle_unload_model(request):
    """POST /models/unload - Unload a model from the inference engine."""
    worker = request.app["worker"]
    try:
        data = await request.json()
    except json.JSONDecodeError:
        return aiohttp.web.json_response({"error": "Invalid JSON"}, status=400)
    model_id = data.get("model_id")
    if not model_id:
        return aiohttp.web.json_response({"error": "model_id is required"}, status=400)
    success = worker.engine.unload_model(model_id)
    if success and model_id in worker.config.models:
        worker.config.models.remove(model_id)
    return aiohttp.web.json_response({"status": "unloaded" if success else "not_found", "model_id": model_id})


async def handle_list_local_models(request):
    """GET /models/local - List GGUF model files on disk."""
    return aiohttp.web.json_response({"models": request.app["worker"].engine.list_local_models()})


async def handle_model_health(request):
    """GET /models/health/{model_id} - Get health of a loaded model."""
    model_id = request.match_info["model_id"]
    return aiohttp.web.json_response(request.app["worker"].engine.get_model_health(model_id))


async def handle_engine_status(request):
    """GET /engine/status - Get inference engine status."""
    return aiohttp.web.json_response(request.app["worker"].engine.get_engine_status())


async def handle_metrics(request):
    """GET /metrics - Prometheus metrics endpoint."""
    worker = request.app["worker"]
    worker.metrics.set_gauge(
        "uptime_seconds", (datetime.now() - worker.start_time).total_seconds(),
        {"service": "worker", "worker_id": worker.config.worker_id},
    )
    worker.metrics.set_gauge("worker_load", worker._get_current_load(), {"worker_id": worker.config.worker_id})
    engine_status = worker.engine.get_engine_status()
    worker.metrics.set_gauge(
        "models_loaded", engine_status.get("total_models_loaded", 0), {"worker_id": worker.config.worker_id},
    )
    try:
        worker.metrics.set_gauge(
            "memory_usage_bytes", psutil.Process().memory_info().rss,
            {"service": "worker", "worker_id": worker.config.worker_id},
        )
    except Exception:
        pass
    fmt = request.query.get("format", "")
    accept = request.headers.get("Accept", "")
    if fmt == "json" or "application/json" in accept:
        return aiohttp.web.json_response(worker.metrics.get_all_metrics())
    return aiohttp.web.Response(
        text=worker.metrics.export_prometheus_format(),
        content_type="text/plain",
        charset="utf-8",
    )


async def handle_models(request):
    """GET /v1/models - OpenAI-compatible models list."""
    worker = request.app["worker"]
    models = []
    loaded = worker.engine.get_loaded_models()
    for model_id, info in loaded.items():
        models.append({
            "id": model_id, "object": "model",
            "created": int(info.get("loaded_at", time.time())),
            "owned_by": f"worker-{worker.config.worker_id}",
            "status": info["status"], "device": info.get("device", "unknown"),
        })
    loaded_ids = set(loaded.keys())
    for model in worker.config.models:
        if model not in loaded_ids:
            models.append({
                "id": model, "object": "model", "created": int(time.time()),
                "owned_by": f"worker-{worker.config.worker_id}", "status": "not_loaded",
            })
    return aiohttp.web.json_response({"object": "list", "data": models})
