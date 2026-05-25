#!/usr/bin/env python3
"""
Worker node for the cluster master system.

Runs LLM models locally and reports to the cluster master
via heartbeats.

Extracted from cluster_master.py.
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional

import aiohttp
from aiohttp import web

logger = logging.getLogger("finsavvyai.api.cluster_master")


class WorkerNode:
    """Worker node that runs LLM models."""

    def __init__(
        self,
        node_id: str,
        name: str,
        host: str,
        port: int,
        models: List[str],
        master_host: str = "localhost",
        master_port: int = 8000,
    ):
        self.node_id = node_id
        self.name = name
        self.host = host
        self.port = port
        self.models = models
        self.master_url = f"http://{master_host}:{master_port}"
        self.session: Optional[aiohttp.ClientSession] = None
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the worker node."""
        self.session = aiohttp.ClientSession()
        await self.register_with_master()
        self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        await self.start_llm_server()
        logger.info("Worker node started: %s on %s:%d", self.name, self.host, self.port)

    async def register_with_master(self) -> None:
        """Register this node with the cluster master."""
        data = {
            "id": self.node_id,
            "name": self.name,
            "host": self.host,
            "port": self.port,
            "models": self.models,
            "capabilities": {
                "gpu": self.check_gpu_availability(),
                "memory": self.get_memory_info(),
            },
            "max_load": 50,
        }
        try:
            async with self.session.post(
                f"{self.master_url}/cluster/join", json=data
            ) as response:
                result = await response.json()
                if result.get("status") == "registered":
                    logger.info("Registered with cluster master")
                else:
                    logger.error("Failed to register: %s", result)
        except Exception as e:
            logger.error("Cannot connect to cluster master: %s", e)

    async def heartbeat_loop(self) -> None:
        """Send periodic heartbeat to master."""
        while True:
            try:
                data = {"id": self.node_id, "status": "online", "load": 25}
                async with self.session.post(
                    f"{self.master_url}/cluster/heartbeat", json=data
                ) as response:
                    if response.status != 200:
                        logger.warning("Heartbeat failed: %d", response.status)
            except Exception as e:
                logger.error("Heartbeat error: %s", e)
            await asyncio.sleep(30)

    async def start_llm_server(self) -> None:
        """Start local LLM server with OpenAI-compatible endpoints."""
        app = web.Application()
        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info("LLM server running on http://%s:%d", self.host, self.port)

    async def handle_completion(self, request: web.Request) -> web.Response:
        """Handle chat completion requests."""
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
                        f"Hello from {self.name}! "
                        f"Running on {self.host}, processed locally."
                    ),
                },
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 20,
                "total_tokens": 30,
            },
            "worker_info": {
                "node_id": self.node_id,
                "node_name": self.name,
                "host": self.host,
            },
        }
        return web.json_response(response)

    async def handle_models(self, request: web.Request) -> web.Response:
        """Return available models."""
        models = [
            {
                "id": model,
                "object": "model",
                "created": int(time.time()),
                "owned_by": f"worker-{self.node_id}",
            }
            for model in self.models
        ]
        return web.json_response({"object": "list", "data": models})

    async def handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint."""
        return web.json_response({
            "status": "healthy",
            "node_id": self.node_id,
            "node_name": self.name,
            "host": self.host,
            "models": self.models,
        })

    def check_gpu_availability(self) -> bool:
        """Check if GPU is available."""
        return False

    def get_memory_info(self) -> Dict:
        """Get memory information."""
        try:
            import psutil
            return {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
            }
        except Exception:
            return {"total": 0, "available": 0}
