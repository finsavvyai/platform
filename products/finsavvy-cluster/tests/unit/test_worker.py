#!/usr/bin/env python3
"""
Test cluster worker functionality
"""

import asyncio
import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import aiohttp
from aiohttp import web


@dataclass
class ClusterNode:
    """Represents a worker node in the cluster"""

    id: str
    name: str
    host: str
    port: int
    models: List[str]
    status: str  # 'online', 'offline', 'busy'
    last_heartbeat: datetime
    capabilities: Dict
    current_load: int = 0
    max_load: int = 100


class LoadBalancer:
    """Load balancing strategies"""

    def select_node(
        self, nodes: Dict[str, ClusterNode], model: str
    ) -> Optional[ClusterNode]:
        """Select best node using round-robin with load awareness"""
        available_nodes = [
            node
            for node in nodes.values()
            if node.status == "online"
            and model in node.models
            and node.current_load < node.max_load
        ]

        if not available_nodes:
            return None

        # Select node with lowest load
        return min(available_nodes, key=lambda n: n.current_load / n.max_load)


class WorkerNode:
    """Worker node that runs LLM models"""

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
        self.session = None
        self.heartbeat_task = None

    async def start(self):
        """Start the worker node"""
        self.session = aiohttp.ClientSession()

        # Register with master
        await self.register_with_master()

        # Start heartbeat
        self.heartbeat_task = asyncio.create_task(self.heartbeat_loop())

        # Start local LLM server
        await self.start_llm_server()

        print(f"🤖 Worker node started: {self.name} on {self.host}:{self.port}")

    async def register_with_master(self):
        """Register this node with the cluster master"""
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
            "max_load": 50,  # Max concurrent requests
        }

        try:
            async with self.session.post(
                f"{self.master_url}/cluster/join", json=data
            ) as response:
                result = await response.json()
                if result.get("status") == "registered":
                    print(f"✅ Registered with cluster master")
                else:
                    print(f"❌ Failed to register: {result}")
        except Exception as e:
            print(f"❌ Cannot connect to cluster master: {e}")

    async def heartbeat_loop(self):
        """Send periodic heartbeat to master"""
        while True:
            try:
                data = {
                    "id": self.node_id,
                    "status": "online",
                    "load": 25,  # Mock load for now
                }

                async with self.session.post(
                    f"{self.master_url}/cluster/heartbeat", json=data
                ) as response:
                    if response.status == 200:
                        print(f"💓 Heartbeat sent")
                    else:
                        print(f"❌ Heartbeat failed: {response.status}")

            except Exception as e:
                print(f"❌ Heartbeat error: {e}")

            await asyncio.sleep(30)  # Heartbeat every 30 seconds

    async def start_llm_server(self):
        """Start local LLM server with OpenAI-compatible endpoints"""
        from aiohttp import web

        app = web.Application()
        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        print(f"🔥 LLM server running on http://{self.host}:{self.port}")

    async def handle_completion(self, request):
        """Handle chat completion requests"""
        data = await request.json()

        # Mock response - replace with actual LLM call
        response = {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": data.get("model", "gpt-3.5-turbo"),
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"Hello from {self.name}! I'm running on {self.host} and processed your request locally.",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            "worker_info": {
                "node_id": self.node_id,
                "node_name": self.name,
                "host": self.host,
            },
        }

        return web.json_response(response)

    async def handle_models(self, request):
        """Return available models"""
        models = []
        for model in self.models:
            models.append(
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": f"worker-{self.node_id}",
                }
            )

        return web.json_response({"object": "list", "data": models})

    async def handle_health(self, request):
        """Health check endpoint"""
        return web.json_response(
            {
                "status": "healthy",
                "node_id": self.node_id,
                "node_name": self.name,
                "host": self.host,
                "models": self.models,
            }
        )

    def check_gpu_availability(self):
        """Check if GPU is available"""
        # Implement GPU detection logic
        return False  # Placeholder

    def get_memory_info(self):
        """Get memory information"""
        try:
            import psutil

            return {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
            }
        except:
            return {"total": 0, "available": 0}


async def test_worker():
    """Test a single worker node"""
    print("Testing worker node...")

    worker = WorkerNode(
        node_id="test-worker-01",
        name="Test Worker",
        host="localhost",
        port=8001,
        models=["gpt-3.5-turbo"],
        master_host="localhost",
        master_port=8000,
    )

    try:
        await worker.start()
        print("Worker started successfully!")

        # Keep it running for a short test
        await asyncio.sleep(5)

    except Exception as e:
        print(f"Worker test failed: {e}")


if __name__ == "__main__":
    asyncio.run(test_worker())
