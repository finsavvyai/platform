"""Network cluster master server with CORS and HTML dashboard."""

import logging
from datetime import datetime
from typing import Dict

import aiohttp
from aiohttp import web

from src.api.network_cluster_models import (
    ClusterNode,
    LoadBalancer,
    get_local_ip,
)
from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory

logger = logging.getLogger("finsavvyai.api.network_cluster")


class NetworkClusterManager:
    """Manages distributed LLM cluster with network access."""

    def __init__(self, master_host: str = "0.0.0.0", master_port: int = 8000):
        self.master_host = master_host
        self.master_port = master_port
        self.nodes: Dict[str, ClusterNode] = {}
        self.session = None
        self.load_balancer = LoadBalancer()
        self.local_ip = get_local_ip()

    async def start(self) -> None:
        """Initialize and start the cluster manager."""
        self.session = aiohttp.ClientSession()
        await self.start_master()

    async def start_master(self) -> None:
        """Start the master cluster server with CORS support."""
        app = web.Application()

        app.middlewares.append(cors_middleware_factory())
        app.middlewares.append(security_headers_middleware_factory())

        app.router.add_options("/{path:.*}", self.handle_options)
        app.router.add_get("/cluster/status", self.cluster_status)
        app.router.add_get("/cluster/nodes", self.list_nodes)
        app.router.add_post("/cluster/join", self.register_node)
        app.router.add_post("/cluster/heartbeat", self.heartbeat)
        app.router.add_post("/cluster/completions", self.distribute_request)
        app.router.add_get("/", self.root_handler)
        app.router.add_get("/health", self.health_check)
        app.router.add_get("/info", self.info_handler)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.master_host, self.master_port)
        await site.start()

        logger.info(
            "Network Cluster Master started on http://%s:%d",
            self.local_ip, self.master_port,
        )

    async def handle_options(self, request: web.Request) -> web.Response:
        """Handle CORS preflight requests."""
        return web.Response(status=200)

    async def root_handler(self, request: web.Request) -> web.Response:
        """Root endpoint with cluster info."""
        html = (f"<!DOCTYPE html><html><head><title>FinSavvyAI Cluster</title></head><body>"
                f"<h1>FinSavvyAI Cluster</h1><p>Master: {self.local_ip}:{self.master_port}</p>"
                f"<p>Nodes: {len(self.nodes)}</p></body></html>")
        return web.Response(text=html, content_type="text/html")

    async def info_handler(self, request: web.Request) -> web.Response:
        """API discovery endpoint."""
        return web.json_response({
            "cluster_name": "FinSavvyAI", "version": "1.0.0", "status": "online",
            "master": {"host": self.local_ip, "port": self.master_port},
            "endpoints": {
                "cluster_status": "/cluster/status", "list_nodes": "/cluster/nodes",
                "chat_completions": "/cluster/completions", "health_check": "/health",
            },
            "timestamp": datetime.now().isoformat(),
        })

    async def health_check(self, request: web.Request) -> web.Response:
        """Simple health check endpoint."""
        return web.json_response({
            "status": "healthy",
            "cluster_id": "finsavvy-home-cluster",
            "master": f"{self.local_ip}:{self.master_port}",
            "total_nodes": len(self.nodes),
            "timestamp": datetime.now().isoformat(),
        })

    async def cluster_status(self, request: web.Request) -> web.Response:
        """Get overall cluster status."""
        online_nodes = len(
            [n for n in self.nodes.values() if n.status == "online"]
        )
        total_models = sum(len(n.models) for n in self.nodes.values())
        return web.json_response({
            "cluster_id": "finsavvy-home-cluster",
            "master": f"{self.local_ip}:{self.master_port}",
            "total_nodes": len(self.nodes),
            "online_nodes": online_nodes,
            "total_models": total_models,
            "timestamp": datetime.now().isoformat(),
        })

    async def list_nodes(self, request: web.Request) -> web.Response:
        """List all cluster nodes."""
        nodes_data = [
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
            for node in self.nodes.values()
        ]
        return web.json_response({"nodes": nodes_data})

    async def register_node(self, request: web.Request) -> web.Response:
        """Register a new worker node."""
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
        logger.info("Node joined: %s (%s:%d)", node.name, node.host, node.port)
        return web.json_response({"status": "registered", "node_id": node.id})

    async def heartbeat(self, request: web.Request) -> web.Response:
        """Receive heartbeat from worker node."""
        data = await request.json()
        node_id = data["id"]
        if node_id in self.nodes:
            self.nodes[node_id].last_heartbeat = datetime.now()
            self.nodes[node_id].status = data.get("status", "online")
            self.nodes[node_id].current_load = data.get("load", 0)
        return web.json_response({"status": "received"})

    async def distribute_request(self, request: web.Request) -> web.Response:
        """Distribute completion request to best available node."""
        data = await request.json()
        requested_model = data.get("model", "gpt-3.5-turbo")
        best_node = self.load_balancer.select_node(self.nodes, requested_model)

        if not best_node:
            return web.json_response(
                {"error": "No available nodes", "model": requested_model},
                status=503,
            )

        node_url = (
            f"http://{best_node.host}:{best_node.port}/v1/chat/completions"
        )
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
                {"error": f"Node request failed: {e}", "node_id": best_node.id},
                status=502,
            )
