"""Route handlers for cluster worker node."""

import sys
import time
from typing import TYPE_CHECKING

from aiohttp import web

from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory

if TYPE_CHECKING:
    from src.workers.cluster_worker import ClusterWorker


def setup_routes(app: web.Application, worker: "ClusterWorker") -> None:
    """Register all route handlers on the app."""

    app.middlewares.append(cors_middleware_factory())
    app.middlewares.append(security_headers_middleware_factory())

    async def handle_completion(request: web.Request) -> web.Response:
        """Handle chat completion requests."""
        try:
            data = await request.json()
            response = {
                "id": f"chatcmpl-{int(time.time())}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": data.get("model", "gpt-3.5-turbo"),
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": (
                            f"Hello from {worker.config.name}! I'm running on "
                            f"{worker.config.host} and processed your request locally."
                        ),
                    },
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 10, "completion_tokens": 25, "total_tokens": 35},
                "worker_info": {
                    "node_id": worker.config.node_id,
                    "node_name": worker.config.name,
                    "host": worker.config.host,
                    "platform": sys.platform,
                },
            }
            return web.json_response(response)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_models(request: web.Request) -> web.Response:
        """Return available models."""
        models = [{
            "id": model, "object": "model",
            "created": int(time.time()),
            "owned_by": f"worker-{worker.config.node_id}",
        } for model in worker.config.models]
        return web.json_response({"object": "list", "data": models})

    async def handle_health(request: web.Request) -> web.Response:
        """Health check endpoint."""
        from src.workers.cluster_worker_system import (
            check_gpu_availability, get_memory_info, get_cpu_info,
        )
        return web.json_response({
            "status": "healthy",
            "node_id": worker.config.node_id,
            "node_name": worker.config.name,
            "host": worker.config.host,
            "models": worker.config.models,
            "capabilities": {
                "gpu": check_gpu_availability(),
                "memory": get_memory_info(),
                "cpu_cores": get_cpu_info(),
            },
        })

    async def handle_options(request: web.Request) -> web.Response:
        return web.Response(status=200)

    app.router.add_post("/v1/chat/completions", handle_completion)
    app.router.add_get("/v1/models", handle_models)
    app.router.add_get("/health", handle_health)
    app.router.add_options("/{path:.*}", handle_options)
