#!/usr/bin/env python3
"""
Cluster manager server component.

Manages distributed LLM cluster, handles node registration,
heartbeats, and request distribution.

Extracted from cluster_master.py.
"""

import logging
from datetime import datetime
from typing import Dict

import aiohttp
from aiohttp import web

from src.api.cluster_master_models import ClusterNode, LoadBalancer

logger = logging.getLogger("finsavvyai.api.cluster_master")


class ClusterManager:
    """Manages distributed LLM cluster."""

    def __init__(self, master_host: str = "localhost", master_port: int = 8000):
        self.master_host = master_host
        self.master_port = master_port
        self.nodes: Dict[str, ClusterNode] = {}
        self.session = None
        self.load_balancer = LoadBalancer()

    async def start(self) -> None:
        """Initialize and start the cluster manager."""
        self.session = aiohttp.ClientSession()
        await self.start_master()

    async def start_master(self) -> None:
        """Start the master cluster server."""
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

        logger.info(
            "Cluster Master started on http://%s:%d",
            self.master_host, self.master_port,
        )

    async def cluster_status(self, request: web.Request) -> web.Response:
        """Get overall cluster status."""
        online_nodes = len(
            [n for n in self.nodes.values() if n.status == "online"]
        )
        total_models = sum(len(n.models) for n in self.nodes.values())
        return web.json_response({
            "cluster_id": "finsavvy-home-cluster",
            "master": f"{self.master_host}:{self.master_port}",
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
