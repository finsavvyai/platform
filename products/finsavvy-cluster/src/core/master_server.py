#!/usr/bin/env python3
"""
Simple FinSavvyAI Master Server
Dedicated master server for cluster management
"""

import asyncio
import json
from datetime import datetime

from aiohttp import web


class MasterServer:
    """Simplified master server for cluster management"""

    def __init__(self, host=None, port=8000):
        # Auto-detect IP if not specified
        if host is None:
            import socket

            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                s.connect(("8.8.8.8", 80))
                host = s.getsockname()[0]
            except:
                host = "localhost"
            finally:
                s.close()

        self.host = host
        self.port = port
        self.nodes = {}

    async def start(self):
        """Start the master server"""
        app = web.Application()

        # Add routes
        app.router.add_get("/", self.root_handler)
        app.router.add_get("/health", self.health_handler)
        app.router.add_get("/cluster/status", self.cluster_status_handler)
        app.router.add_get("/cluster/nodes", self.list_nodes_handler)
        app.router.add_post("/cluster/join", self.register_node_handler)
        app.router.add_post("/cluster/heartbeat", self.heartbeat_handler)

        # Create runner and site
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()

        print(f"🌐 Starting FinSavvyAI Network Cluster...")
        print("=" * 70)
        print(f"🚀 Network Cluster Master started!")
        print(f"   Local access: http://localhost:{self.port}")
        print(f"   Network access: http://{self.host}:{self.port}")
        print(f"   🌐 Ready for connections from other devices!")

        # Keep running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            print(f"\n🛑 Master server shutting down...")

    async def root_handler(self, request):
        """Root endpoint"""
        return web.json_response(
            {
                "service": "FinSavvyAI Cluster Master",
                "status": "running",
                "endpoints": ["/health", "/cluster/status", "/cluster/nodes"],
            }
        )

    async def health_handler(self, request):
        """Health check endpoint"""
        return web.json_response(
            {
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "service": "cluster-master",
            }
        )

    async def cluster_status_handler(self, request):
        """Cluster status endpoint"""
        online_nodes = len(
            [n for n in self.nodes.values() if n.get("status") == "online"]
        )

        return web.json_response(
            {
                "cluster_id": "finsavvy-home-cluster",
                "master": f"{self.host}:{self.port}",
                "total_nodes": len(self.nodes),
                "online_nodes": online_nodes,
                "timestamp": datetime.now().isoformat(),
            }
        )

    async def list_nodes_handler(self, request):
        """List all nodes"""
        return web.json_response({"nodes": list(self.nodes.values())})

    async def register_node_handler(self, request):
        """Register a new node"""
        try:
            data = await request.json()
            node_id = data.get("id", "unknown")

            self.nodes[node_id] = {
                **data,
                "status": "online",
                "registered_at": datetime.now().isoformat(),
            }

            return web.json_response(
                {
                    "status": "registered",
                    "node_id": node_id,
                    "message": f"Node {node_id} registered successfully",
                }
            )
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=400)

    async def heartbeat_handler(self, request):
        """Handle node heartbeat"""
        try:
            data = await request.json()
            node_id = data.get("id")

            if node_id in self.nodes:
                self.nodes[node_id]["last_heartbeat"] = datetime.now().isoformat()
                self.nodes[node_id]["status"] = data.get("status", "online")
                return web.json_response({"status": "ok"})
            else:
                return web.json_response(
                    {"status": "error", "message": "Node not found"}, status=404
                )
        except Exception as e:
            return web.json_response({"status": "error", "message": str(e)}, status=400)


async def main():
    """Main function"""
    server = MasterServer()
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
