#!/usr/bin/env python3
"""
Network cluster worker node.

Worker that accepts connections from other computers on the
local network and reports to the master via heartbeats.

Extracted from network_cluster.py.
"""

import asyncio
import logging
import platform
import socket
import time
from typing import Dict, List, Optional

import aiohttp
from aiohttp import web

from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory

logger = logging.getLogger("finsavvyai.api.network_cluster")


class NetworkWorkerNode:
    """Worker node that can be accessed from other computers."""

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
        self.host = "0.0.0.0"  # Accept connections from any IP
        self.port = port
        self.models = models
        self.master_url = f"http://{master_host}:{master_port}"
        self.session: Optional[aiohttp.ClientSession] = None
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the worker node."""
        self.session = aiohttp.ClientSession()
        await asyncio.sleep(1)
        await self.register_with_master()
        self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())
        await self.start_llm_server()
        logger.info("Network Worker node started: %s", self.name)

    async def register_with_master(self) -> None:
        """Register this node with the cluster master."""
        data = {
            "id": self.node_id,
            "name": self.name,
            "host": socket.gethostbyname(socket.gethostname()),
            "port": self.port,
            "models": self.models,
            "capabilities": {
                "gpu": False,
                "memory": {"total": "8GB", "available": "4GB"},
                "platform": platform.system(),
            },
            "max_load": 50,
        }

        try:
            async with self.session.post(
                f"{self.master_url}/cluster/join", json=data
            ) as response:
                result = await response.json()
                if result.get("status") == "registered":
                    logger.info("%s registered with cluster master", self.name)
                else:
                    logger.error("Failed to register: %s", result)
        except Exception as e:
            logger.error("%s cannot connect to cluster master: %s", self.name, e)

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
                logger.error("%s heartbeat error: %s", self.name, e)
            await asyncio.sleep(30)

    async def start_llm_server(self) -> None:
        """Start local LLM server with OpenAI-compatible endpoints."""
        app = web.Application()

        app.middlewares.append(cors_middleware_factory())
        app.middlewares.append(security_headers_middleware_factory())
        app.router.add_options("/{path:.*}", self.handle_options)
        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info("Network LLM server running on port %d", self.port)

    async def handle_options(self, request: web.Request) -> web.Response:
        """Handle CORS preflight requests."""
        return web.Response(status=200)

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
                        "Processed your request locally."
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
                "accessible_from": "network",
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
            "accessible_from": "network",
            "models": self.models,
        })
