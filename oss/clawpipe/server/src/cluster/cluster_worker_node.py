"""Cluster worker node — connects to master, serves completions, heartbeats."""

import asyncio
import logging
import sys
import time
from typing import Optional

import aiohttp
from aiohttp import web

from src.cluster.cluster_worker_config import (
    WorkerConfig,
    check_gpu_availability,
    get_cpu_info,
    get_memory_info,
)
from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory

logger = logging.getLogger("finsavvyai.cluster.worker")


class ClusterWorker:
    """Worker node that connects to the cluster master."""

    def __init__(self, config: WorkerConfig):
        self.config = config
        self.master_url = f"http://{config.master_host}:{config.master_port}"
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the worker node."""
        logger.info("Starting worker: %s", self.config.name)
        await self.register_with_master()
        self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        await self.start_llm_server()
        logger.info("Worker node ready and connected to cluster")

    async def start_llm_server(self) -> None:
        """Start local LLM server with OpenAI-compatible endpoints."""
        app = web.Application()

        app.middlewares.append(cors_middleware_factory())
        app.middlewares.append(security_headers_middleware_factory())
        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)
        app.router.add_options("/{path:.*}", self.handle_options)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.config.host, self.config.port)
        await site.start()
        logger.info(
            "LLM server running on http://%s:%d",
            self.config.host, self.config.port,
        )

    async def handle_options(self, request: web.Request) -> web.Response:
        """Handle CORS preflight requests."""
        return web.Response(status=200)

    async def register_with_master(self) -> bool:
        """Register this node with the cluster master."""
        logger.info("Registering with cluster master at %s", self.master_url)
        data = {
            "id": self.config.node_id,
            "name": self.config.name,
            "host": self.config.host,
            "port": self.config.port,
            "models": self.config.models,
            "capabilities": {
                "gpu": check_gpu_availability(),
                "memory": get_memory_info(),
                "cpu_cores": get_cpu_info(),
                "platform": sys.platform,
            },
            "max_load": 10,
        }
        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.master_url}/cluster/join", json=data
                ) as response:
                    result = await response.json()
                    if result.get("status") == "registered":
                        logger.info("Registered with cluster master")
                        return True
                    logger.error("Failed to register: %s", result)
                    return False
        except Exception as e:
            logger.error("Cannot connect to cluster master: %s", e)
            return False

    async def heartbeat_loop(self) -> None:
        """Send periodic heartbeat to master."""
        while True:
            try:
                data = {
                    "id": self.config.node_id,
                    "status": "online",
                    "load": self.get_current_load(),
                }
                timeout = aiohttp.ClientTimeout(total=5)
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.post(
                        f"{self.master_url}/cluster/heartbeat", json=data
                    ) as response:
                        if response.status != 200:
                            logger.warning(
                                "Heartbeat failed: %d", response.status
                            )
            except Exception as e:
                logger.error("Heartbeat error: %s", e)
            await asyncio.sleep(30)

    async def handle_completion(self, request: web.Request) -> web.Response:
        """Handle chat completion requests."""
        try:
            data = await request.json()
            logger.info(
                "Processing completion for model: %s",
                data.get("model", "unknown"),
            )
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
                            f"Hello from {self.config.name}! "
                            f"Running on {self.config.host}, "
                            "processed locally."
                        ),
                    },
                    "finish_reason": "stop",
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 25,
                    "total_tokens": 35,
                },
                "worker_info": {
                    "node_id": self.config.node_id,
                    "node_name": self.config.name,
                    "host": self.config.host,
                    "platform": sys.platform,
                },
            }
            return web.json_response(response)
        except Exception as e:
            logger.error("Error processing completion: %s", e)
            return web.json_response({"error": str(e)}, status=500)

    async def handle_models(self, request: web.Request) -> web.Response:
        """Return available models."""
        models = [
            {
                "id": model,
                "object": "model",
                "created": int(time.time()),
                "owned_by": f"worker-{self.config.node_id}",
            }
            for model in self.config.models
        ]
        return web.json_response({"object": "list", "data": models})

    async def handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint."""
        return web.json_response({
            "status": "healthy",
            "node_id": self.config.node_id,
            "node_name": self.config.name,
            "host": self.config.host,
            "models": self.config.models,
            "capabilities": {
                "gpu": check_gpu_availability(),
                "memory": get_memory_info(),
                "cpu_cores": get_cpu_info(),
            },
        })

    def get_current_load(self) -> int:
        return 2
