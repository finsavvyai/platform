"""Worker health, status, and info route handlers."""

import socket
from datetime import datetime

import aiohttp.web


async def handle_health(request):
    """GET /health - Health check with full status."""
    worker = request.app["worker"]
    engine_status = worker.engine.get_engine_status()
    health_data = {
        "status": "healthy", "node_id": worker.config.worker_id,
        "node_name": worker.config.worker_name,
        "host": socket.gethostbyname(socket.gethostname()),
        "port": worker.config.port, "models": worker.config.models,
        "uptime": (datetime.now() - worker.start_time).total_seconds(),
        "request_count": worker.request_count,
        "capabilities": {
            "vision": bool(worker.openclaw_client), "streaming": True,
            "multimodal": bool(worker.openclaw_client),
        },
        "load": worker._get_current_load(),
        "inference_engine": {
            "available": engine_status["available"], "device": engine_status["device"],
            "models_loaded": engine_status["total_models_loaded"],
            "total_requests": engine_status["total_requests"],
            "total_tokens": engine_status["total_tokens_generated"],
        },
        "system": worker.system_info,
    }
    if worker.openclaw_client:
        openclaw_available = await worker.openclaw_client.is_available()
        health_data["openclaw"] = {
            "enabled": True, "available": openclaw_available,
            "url": worker.config.openclaw_url, "supports_vision": True,
        }
    return aiohttp.web.json_response(health_data)


async def handle_status(request):
    """GET /status - Detailed status endpoint."""
    worker = request.app["worker"]
    status_data = {
        "worker": {
            "id": worker.config.worker_id, "name": worker.config.worker_name,
            "status": worker.status,
            "host": socket.gethostbyname(socket.gethostname()),
            "port": worker.config.port,
        },
        "cluster": {
            "master": f"{worker.config.master_host}:{worker.config.master_port}",
            "registered": True, "last_heartbeat": datetime.now().isoformat(),
        },
        "performance": {
            "requests_processed": worker.request_count,
            "uptime": (datetime.now() - worker.start_time).total_seconds(),
            "current_load": worker._get_current_load(),
            "system_info": worker.system_info,
        },
        "models": worker.config.models,
        "inference_engine": worker.engine.get_engine_status(),
        "loaded_models": worker.engine.get_loaded_models(),
    }
    if worker.openclaw_client:
        openclaw_available = await worker.openclaw_client.is_available()
        status_data["openclaw"] = {
            "enabled": True, "available": openclaw_available,
            "url": worker.config.openclaw_url, "supports_vision": True,
        }
        status_data["capabilities"] = {"vision": True, "streaming": True, "multimodal": True}
    return aiohttp.web.json_response(status_data)


async def handle_root(request):
    """GET / - Root endpoint with API info."""
    worker = request.app["worker"]
    return aiohttp.web.json_response({
        "service": "FinSavvyAI Worker Node",
        "worker_id": worker.config.worker_id,
        "worker_name": worker.config.worker_name,
        "status": worker.status, "port": worker.config.port,
        "uptime_seconds": (datetime.now() - worker.start_time).total_seconds(),
        "endpoints": {
            "chat": "POST /v1/chat/completions", "models": "GET /v1/models",
            "health": "GET /health", "status": "GET /status",
            "load_model": "POST /models/load", "unload_model": "POST /models/unload",
            "local_models": "GET /models/local",
            "model_health": "GET /models/health/{model_id}",
            "engine_status": "GET /engine/status",
        },
    })
