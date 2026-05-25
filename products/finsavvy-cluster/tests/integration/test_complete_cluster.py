#!/usr/bin/env python3
"""
Complete cluster test - starts both master and worker nodes
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


class ClusterManager:
    """Manages distributed LLM cluster"""

    def __init__(self, master_host="localhost", master_port=8000):
        self.master_host = master_host
        self.master_port = master_port
        self.nodes: Dict[str, ClusterNode] = {}
        self.session = None
        self.load_balancer = LoadBalancer()

    async def start(self):
        """Initialize and start the cluster manager"""
        self.session = aiohttp.ClientSession()
        await self.start_master()

    async def start_master(self):
        """Start the master cluster server"""
        from aiohttp import web

        app = web.Application()
        app.router.add_get("/cluster/status", self.cluster_status)
        app.router.add_get("/cluster/nodes", self.list_nodes)
        app.router.add_post("/cluster/join", self.register_node)
        app.router.add_post("/cluster/heartbeat", self.heartbeat)
        app.router.add_post("/cluster/completions", self.distribute_request)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.master_host, self.master_port)
        await site.start()

        print(
            f"🚀 Cluster Master started on http://{self.master_host}:{self.master_port}"
        )

    async def cluster_status(self, request):
        """Get overall cluster status"""
        online_nodes = len([n for n in self.nodes.values() if n.status == "online"])
        total_models = sum(len(n.models) for n in self.nodes.values())

        return web.json_response(
            {
                "cluster_id": "finsavvy-home-cluster",
                "master": f"{self.master_host}:{self.master_port}",
                "total_nodes": len(self.nodes),
                "online_nodes": online_nodes,
                "total_models": total_models,
                "timestamp": datetime.now().isoformat(),
            }
        )

    async def list_nodes(self, request):
        """List all cluster nodes"""
        nodes_data = []
        for node in self.nodes.values():
            nodes_data.append(
                {
                    "id": node.id,
                    "name": node.name,
                    "host": node.host,
                    "port": node.port,
                    "models": node.models,
                    "status": node.status,
                    "load": node.current_load,
                    "max_load": node.max_load,
                    "last_heartbeat": node.last_heartbeat.isoformat(),
                }
            )

        return web.json_response({"nodes": nodes_data})

    async def register_node(self, request):
        """Register a new worker node"""
        data = await request.json()

        node = ClusterNode(
            id=data["id"],
            name=data["name"],
            host=data["host"],
            port=data["port"],
            models=data["models"],
            status="online",
            last_heartbeat=datetime.now(),
            capabilities=data.get("capabilities", {}),
            max_load=data.get("max_load", 100),
        )

        self.nodes[node.id] = node
        print(f"✅ Node joined cluster: {node.name} ({node.host}:{node.port})")

        return web.json_response({"status": "registered", "node_id": node.id})

    async def heartbeat(self, request):
        """Receive heartbeat from worker node"""
        data = await request.json()
        node_id = data["id"]

        if node_id in self.nodes:
            self.nodes[node_id].last_heartbeat = datetime.now()
            self.nodes[node_id].status = data.get("status", "online")
            self.nodes[node_id].current_load = data.get("load", 0)

        return web.json_response({"status": "received"})

    async def distribute_request(self, request):
        """Distribute completion request to best available node"""
        data = await request.json()
        requested_model = data.get("model", "gpt-3.5-turbo")

        # Find best node for this model
        best_node = self.load_balancer.select_node(self.nodes, requested_model)

        if not best_node:
            return web.json_response(
                {
                    "error": "No available nodes for this model",
                    "model": requested_model,
                },
                status=503,
            )

        # Forward request to selected node
        node_url = f"http://{best_node.host}:{best_node.port}/v1/chat/completions"

        try:
            async with self.session.post(node_url, json=data) as response:
                result = await response.json()
                result["cluster_info"] = {
                    "node_id": best_node.id,
                    "node_name": best_node.name,
                    "distributed_at": datetime.now().isoformat(),
                }
                return web.json_response(result)
        except Exception as e:
            return web.json_response(
                {"error": f"Node request failed: {str(e)}", "node_id": best_node.id},
                status=502,
            )


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

        # Wait a moment for master to be ready
        await asyncio.sleep(1)

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
                    print(f"✅ {self.name} registered with cluster master")
                else:
                    print(f"❌ Failed to register: {result}")
        except Exception as e:
            print(f"❌ {self.name} cannot connect to cluster master: {e}")

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
                        pass  # Heartbeat successful
                    else:
                        print(f"❌ {self.name} heartbeat failed: {response.status}")

            except Exception as e:
                print(f"❌ {self.name} heartbeat error: {e}")

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
        return False

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


async def test_cluster():
    """Test complete cluster setup"""
    print("🏠 Starting FinSavvyAI Home Cluster Test...")

    # Start cluster master
    master = ClusterManager()
    master_task = asyncio.create_task(master.start())

    # Wait for master to start
    await asyncio.sleep(2)

    # Start worker nodes with different ports
    workers = [
        WorkerNode(
            node_id="desktop-01",
            name="Main Desktop",
            host="localhost",
            port=8001,
            models=["gpt-3.5-turbo", "gpt-4"],
        ),
        WorkerNode(
            node_id="laptop-01",
            name="Development Laptop",
            host="localhost",
            port=8002,
            models=["gpt-3.5-turbo"],
        ),
    ]

    # Start all workers
    worker_tasks = []
    for worker in workers:
        task = asyncio.create_task(worker.start())
        worker_tasks.append(task)

    print("🏠 FinSavvyAI Home Cluster Started!")
    print("   Master: http://localhost:8000")
    print("   Workers: 2 nodes")
    print("   Testing cluster functionality...")

    # Wait for workers to register
    await asyncio.sleep(3)

    # Test cluster status
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get("http://localhost:8000/cluster/status") as resp:
                status = await resp.json()
                print(f"📊 Cluster Status: {json.dumps(status, indent=2)}")

            async with session.get("http://localhost:8000/cluster/nodes") as resp:
                nodes = await resp.json()
                print(f"🖥️  Cluster Nodes: {json.dumps(nodes, indent=2)}")

        except Exception as e:
            print(f"❌ Error testing cluster: {e}")

    # Keep cluster running for testing
    print("✅ Cluster is running! Test complete.")
    print("🔗 Try these URLs:")
    print("   Cluster Status: http://localhost:8000/cluster/status")
    print("   Worker 1 Health: http://localhost:8001/health")
    print("   Worker 2 Health: http://localhost:8002/health")

    # Run for a bit longer to see heartbeats
    await asyncio.sleep(10)


if __name__ == "__main__":
    try:
        asyncio.run(test_cluster())
    except KeyboardInterrupt:
        print("\n🛑 Cluster test stopped")
