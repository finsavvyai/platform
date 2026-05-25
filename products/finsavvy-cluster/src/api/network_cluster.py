#!/usr/bin/env python3
"""
Network-enabled FinSavvyAI Cluster
Accessible from other computers on the same network
"""

import asyncio
import json
import platform
import socket
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


class NetworkClusterManager:
    """Manages distributed LLM cluster with network access"""

    def __init__(self, master_host="0.0.0.0", master_port=8000):
        self.master_host = master_host  # 0.0.0.0 allows external connections
        self.master_port = master_port
        self.nodes: Dict[str, ClusterNode] = {}
        self.session = None
        self.load_balancer = LoadBalancer()
        self.local_ip = self.get_local_ip()

    def get_local_ip(self):
        """Get local IP address for network access"""
        try:
            # Create a socket to determine the local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            local_ip = s.getsockname()[0]
            s.close()
            return local_ip
        except:
            return "localhost"

    async def start(self):
        """Initialize and start the cluster manager"""
        self.session = aiohttp.ClientSession()
        await self.start_master()

    async def start_master(self):
        """Start the master cluster server with CORS support"""
        from aiohttp import web

        app = web.Application()

        # Add CORS middleware
        async def cors_middleware(request, handler):
            response = await handler(request)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization"
            )
            return response

        app.middlewares.append(cors_middleware)

        # Add routes
        app.router.add_options("/{path:.*}", self.handle_options)
        app.router.add_get("/cluster/status", self.cluster_status)
        app.router.add_get("/cluster/nodes", self.list_nodes)
        app.router.add_post("/cluster/join", self.register_node)
        app.router.add_post("/cluster/heartbeat", self.heartbeat)
        app.router.add_post("/cluster/completions", self.distribute_request)

        # Convenience routes
        app.router.add_get("/", self.root_handler)
        app.router.add_get("/health", self.health_check)
        app.router.add_get("/info", self.info_handler)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.master_host, self.master_port)
        await site.start()

        print(f"🚀 Network Cluster Master started!")
        print(f"   Local access: http://localhost:{self.master_port}")
        print(f"   Network access: http://{self.local_ip}:{self.master_port}")
        print(f"   🌐 Ready for connections from other devices!")

    async def handle_options(self, request):
        """Handle CORS preflight requests"""
        return web.Response(status=200)

    async def root_handler(self, request):
        """Root endpoint with cluster info"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>FinSavvyAI Cluster</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
                .status {{ background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .endpoint {{ background: #f0f0f0; padding: 10px; margin: 5px 0; border-radius: 3px; }}
                .api-key {{ background: #ffeaa7; padding: 10px; border-radius: 5px; font-family: monospace; }}
            </style>
        </head>
        <body>
            <h1>🤖 FinSavvyAI Cluster</h1>
            <div class="status">
                <h2>✅ Cluster Status: Online</h2>
                <p><strong>Master:</strong> {self.local_ip}:{self.master_port}</p>
                <p><strong>Nodes:</strong> {len(self.nodes)} registered</p>
                <p><strong>Time:</strong> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</p>
            </div>

            <h2>🔑 API Information</h2>
            <div class="api-key">
                API Key: finsavvy-5d19b8e7c71d4679
            </div>

            <h2>🔗 Endpoints</h2>
            <div class="endpoint">
                <strong>Cluster Status:</strong> GET /cluster/status
            </div>
            <div class="endpoint">
                <strong>List Nodes:</strong> GET /cluster/nodes
            </div>
            <div class="endpoint">
                <strong>Chat Completion:</strong> POST /cluster/completions
            </div>
            <div class="endpoint">
                <strong>Health Check:</strong> GET /health
            </div>

            <h2>📱 Mobile Access</h2>
            <p>Use these settings in any OpenAI-compatible app:</p>
            <ul>
                <li><strong>Base URL:</strong> http://{self.local_ip}:{self.master_port}</li>
                <li><strong>API Key:</strong> finsavvy-5d19b8e7c71d4679</li>
                <li><strong>Models:</strong> Available from registered workers</li>
            </ul>

            <h2>🧪 Test Examples</h2>
            <details>
                <summary>Click to see curl examples</summary>
                <pre>
# Check cluster status
curl http://{self.local_ip}:{self.master_port}/cluster/status

# Send chat request
curl -X POST http://{self.local_ip}:{self.master_port}/cluster/completions \\
  -H "Content-Type: application/json" \\
  -d '{{"model": "gpt-3.5-turbo-sim", "messages": [{{"role": "user", "content": "Hello!"}}]}}'
                </pre>
            </details>
        </body>
        </html>
        """
        return web.Response(text=html, content_type="text/html")

    async def info_handler(self, request):
        """Information endpoint for API discovery"""
        return web.json_response(
            {
                "cluster_name": "FinSavvyAI",
                "version": "1.0.0",
                "status": "online",
                "master": {
                    "host": self.local_ip,
                    "port": self.master_port,
                    "protocol": "http",
                },
                "api_key": "finsavvy-5d19b8e7c71d4679",
                "endpoints": {
                    "cluster_status": f"/cluster/status",
                    "list_nodes": "/cluster/nodes",
                    "chat_completions": "/cluster/completions",
                    "health_check": "/health",
                },
                "network_info": {
                    "local_ip": self.local_ip,
                    "accessible_from_other_devices": True,
                    "cors_enabled": True,
                },
                "timestamp": datetime.now().isoformat(),
            }
        )

    async def health_check(self, request):
        """Simple health check endpoint"""
        return web.json_response(
            {
                "status": "healthy",
                "cluster_id": "finsavvy-home-cluster",
                "master": f"{self.local_ip}:{self.master_port}",
                "total_nodes": len(self.nodes),
                "timestamp": datetime.now().isoformat(),
            }
        )

    async def cluster_status(self, request):
        """Get overall cluster status"""
        online_nodes = len([n for n in self.nodes.values() if n.status == "online"])
        total_models = sum(len(n.models) for n in self.nodes.values())

        return web.json_response(
            {
                "cluster_id": "finsavvy-home-cluster",
                "master": f"{self.local_ip}:{self.master_port}",
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


class NetworkWorkerNode:
    """Worker node that can be accessed from other computers"""

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

        print(f"🤖 Network Worker node started: {self.name}")
        print(f"   Local access: http://localhost:{self.port}")
        print(
            f"   Network access: http://socket.gethostbyname(socket.gethostname()):{self.port}"
        )

    async def register_with_master(self):
        """Register this node with the cluster master"""
        data = {
            "id": self.node_id,
            "name": self.name,
            "host": socket.gethostbyname(
                socket.gethostname()
            ),  # Report actual IP to master
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
                    print(f"✅ {self.name} registered with cluster master")
                else:
                    print(f"❌ Failed to register: {result}")
        except Exception as e:
            print(f"❌ {self.name} cannot connect to cluster master: {e}")

    async def heartbeat_loop(self):
        """Send periodic heartbeat to master"""
        while True:
            try:
                data = {"id": self.node_id, "status": "online", "load": 25}

                async with self.session.post(
                    f"{self.master_url}/heartbeat", json=data
                ) as response:
                    if response.status == 200:
                        pass

            except Exception as e:
                print(f"❌ {self.name} heartbeat error: {e}")

            await asyncio.sleep(30)

    async def start_llm_server(self):
        """Start local LLM server with OpenAI-compatible endpoints"""
        from aiohttp import web

        app = web.Application()

        # Add CORS middleware
        async def cors_middleware(request, handler):
            response = await handler(request)
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization"
            )
            return response

        app.middlewares.append(cors_middleware)
        app.router.add_options("/{path:.*}", self.handle_options)

        app.router.add_post("/v1/chat/completions", self.handle_completion)
        app.router.add_get("/v1/models", self.handle_models)
        app.router.add_get("/health", self.handle_health)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        print(f"🔥 Network LLM server running on port {self.port}")

    async def handle_options(self, request):
        """Handle CORS preflight requests"""
        return web.Response(status=200)

    async def handle_completion(self, request):
        """Handle chat completion requests"""
        data = await request.json()

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
                        "content": f"Hello from {self.name}! I'm accessible from any device on your network and processed your request locally.",
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            "worker_info": {
                "node_id": self.node_id,
                "node_name": self.name,
                "accessible_from": "network",
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
                "accessible_from": "network",
                "models": self.models,
            }
        )


async def start_network_cluster():
    """Start network-accessible cluster"""
    print("🌐 Starting FinSavvyAI Network Cluster...")
    print("=" * 60)

    # Start cluster master
    master = NetworkClusterManager(master_host="0.0.0.0", master_port=8000)
    master_task = asyncio.create_task(master.start())

    # Wait for master to start
    await asyncio.sleep(2)

    # Start network worker
    worker = NetworkWorkerNode(
        node_id="network-worker-01",
        name="Network AI Worker",
        host="0.0.0.0",
        port=8001,
        models=["gpt-3.5-turbo-sim", "phi-2"],
        master_host="localhost",
        master_port=8000,
    )

    worker_task = asyncio.create_task(worker.start())

    # Wait for everything to start
    await asyncio.sleep(3)

    print("\n🎉 Network Cluster is ready!")
    print("=" * 60)
    print(f"📱 Access from ANY device on your network:")
    print(f"   🔗 Cluster Dashboard: http://{master.local_ip}:8000")
    print(f"   💬 AI Chat API: http://{master.local_ip}:8001/v1/chat/completions")
    print(f"   📊 Cluster Status: http://{master.local_ip}:8000/cluster/status")
    print(f"   🔑 API Key: finsavvy-5d19b8e7c71d4679")
    print()
    print("📱 Mobile App Setup:")
    print(f"   • Base URL: http://{master.local_ip}:8001")
    print(f"   • API Key: finsavvy-5d19b8e7c71d4679")
    print(f"   • Model: gpt-3.5-turbo-sim")
    print()
    print("💡 Test from other devices:")
    print(f"   curl http://{master.local_ip}:8000/cluster/status")

    try:
        await asyncio.gather(master_task, worker_task)
    except KeyboardInterrupt:
        print("\n🛑 Network Cluster stopped")


if __name__ == "__main__":
    asyncio.run(start_network_cluster())
