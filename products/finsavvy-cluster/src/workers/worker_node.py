#!/usr/bin/env python3
"""
FinSavvyAI Worker Node - Runs on any computer in the network
Connects to the cluster master and provides AI processing capabilities
"""

import argparse
import asyncio
import json
import os
import platform
import socket
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp
import aiohttp.web
import psutil


@dataclass
class WorkerConfig:
    """Configuration for worker node"""

    master_host: str = "localhost"
    master_port: int = 8000
    worker_id: str = None
    worker_name: str = None
    host: str = "0.0.0.0"
    port: int = None
    models: List[str] = None

    def __post_init__(self):
        if self.worker_id is None:
            self.worker_id = f"worker-{socket.gethostname().lower()}-{int(time.time())}"
        if self.worker_name is None:
            self.worker_name = f"{platform.node()} Worker"
        if self.port is None:
            # Find available port
            self.port = self._find_available_port()
        if self.models is None:
            self.models = ["gpt-3.5-turbo-sim"]

    def _find_available_port(self) -> int:
        """Find an available port starting from 8001"""
        for port in range(8001, 8010):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(("", port))
                    return port
            except OSError:
                continue
        return 8001


class WorkerNode:
    """Worker node that runs AI processing"""

    def __init__(self, config: WorkerConfig):
        self.config = config
        self.session = None
        self.heartbeat_task = None
        self.request_count = 0
        self.start_time = datetime.now()
        self.status = "starting"
        self.system_info = self._get_system_info()

    def _get_system_info(self):
        """Get system information for reporting"""
        try:
            return {
                "hostname": socket.gethostname(),
                "platform": platform.system(),
                "cpu_count": psutil.cpu_count(),
                "memory_total": psutil.virtual_memory().total,
                "memory_available": psutil.virtual_memory().available,
                "disk_total": psutil.disk_usage("/").total,
                "disk_free": psutil.disk_usage("/").free,
                "python_version": sys.version,
                "arch": platform.architecture()[0],
            }
        except Exception:
            return {"error": "Could not get system info"}

    async def start(self):
        """Start the worker node"""
        print(f"🚀 Starting FinSavvyAI Worker...")
        print(f"   Worker ID: {self.config.worker_id}")
        print(f"   Name: {self.config.worker_name}")
        print(f"   Models: {', '.join(self.config.models)}")
        print(f"   Port: {self.config.port}")

        self.session = aiohttp.ClientSession()
        self.status = "online"

        # Register with master
        await self._register_with_master()

        # Start heartbeat
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        # Start HTTP server
        await self._start_server()

        print(f"✅ Worker {self.config.worker_name} is online!")

    async def _register_with_master(self):
        """Register this worker with the cluster master"""
        data = {
            "id": self.config.worker_id,
            "name": self.config.worker_name,
            "host": socket.gethostbyname(socket.gethostname()),
            "port": self.config.port,
            "models": self.config.models,
            "capabilities": {
                "system": self.system_info,
                "gpu": self._check_gpu(),
                "status": self.status,
            },
            "max_load": min(10, max(1, self.system_info.get("cpu_count", 1) // 2)),
        }

        try:
            async with self.session.post(
                f"http://{self.config.master_host}:{self.config.master_port}/cluster/join",
                json=data,
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("status") == "registered":
                        print(f"✅ Registered with cluster master")
                        return True
                    else:
                        print(f"❌ Failed to register: {result}")
                        return False
                else:
                    print(f"❌ Registration failed: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Cannot connect to cluster master: {e}")
            print(
                f"💡 Make sure master is running on {self.config.master_host}:{self.config.master_port}"
            )
            return False

    def _check_gpu(self):
        """Check if GPU is available"""
        try:
            import torch

            return {
                "available": torch.cuda.is_available(),
                "count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
            }
        except ImportError:
            return {"available": False, "count": 0, "error": "PyTorch not installed"}

    async def _heartbeat_loop(self):
        """Send periodic heartbeat to master"""
        while True:
            try:
                data = {
                    "id": self.config.worker_id,
                    "status": self.status,
                    "load": self._get_current_load(),
                    "request_count": self.request_count,
                    "uptime": (datetime.now() - self.start_time).total_seconds(),
                }

                async with self.session.post(
                    f"http://{self.config.master_host}:{self.config.master_port}/cluster/heartbeat",
                    json=data,
                ) as response:
                    if response.status != 200:
                        print(f"⚠️ Heartbeat failed: {response.status}")

            except Exception as e:
                print(f"⚠️ Heartbeat error: {e}")

            await asyncio.sleep(30)

    def _get_current_load(self) -> int:
        """Get current system load"""
        try:
            return int(psutil.cpu_percent(interval=1) / 10)
        except:
            return 0

    async def _start_server(self):
        """Start the HTTP server for processing requests"""
        app = aiohttp.web.Application()

        # CORS middleware
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

        # Routes
        app.router.add_options("/{path:.*}", self._handle_options)
        app.router.add_post("/v1/chat/completions", self._handle_completion)
        app.router.add_get("/v1/models", self._handle_models)
        app.router.add_get("/health", self._handle_health)
        app.router.add_get("/status", self._handle_status)
        app.router.add_get("/", self._handle_root)

        runner = aiohttp.web.AppRunner(app)
        await runner.setup()
        site = aiohttp.web.TCPSite(runner, self.config.host, self.config.port)
        await site.start()

        print(f"🔥 Worker server running on port {self.config.port}")
        print(f"   Local: http://localhost:{self.config.port}")
        print(
            f"   Network: http://{socket.gethostbyname(socket.gethostname())}:{self.config.port}"
        )

    async def _handle_options(self, request):
        """Handle CORS preflight"""
        return aiohttp.web.Response(status=200)

    async def _handle_completion(self, request):
        """Handle chat completion requests"""
        try:
            data = await request.json()
            self.request_count += 1

            print(f"🧠 Processing request #{self.request_count}")

            # Simulate processing time
            await asyncio.sleep(0.1 + (len(str(data)) / 10000))

            response = {
                "id": f"chatcmpl-{int(time.time())}-{self.config.worker_id[:8]}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": data.get("model", self.config.models[0]),
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": f"Response from {self.config.worker_name} on {socket.gethostname()}. This is request #{self.request_count} processed by this worker.",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": len(str(data.get("messages", []))) // 4,
                    "completion_tokens": 30,
                    "total_tokens": 50,
                },
                "worker_info": {
                    "node_id": self.config.worker_id,
                    "node_name": self.config.worker_name,
                    "hostname": socket.gethostname(),
                    "platform": platform.system(),
                    "request_count": self.request_count,
                    "uptime": (datetime.now() - self.start_time).total_seconds(),
                    "load": self._get_current_load(),
                },
            }

            return aiohttp.web.json_response(response)

        except Exception as e:
            print(f"❌ Completion error: {e}")
            return aiohttp.web.json_response(
                {"error": f"Processing failed: {str(e)}"}, status=500
            )

    async def _handle_models(self, request):
        """Return available models"""
        models = []
        for model in self.config.models:
            models.append(
                {
                    "id": model,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": f"worker-{self.config.worker_id}",
                }
            )

        return aiohttp.web.json_response({"object": "list", "data": models})

    async def _handle_health(self, request):
        """Health check endpoint"""
        return aiohttp.web.json_response(
            {
                "status": "healthy",
                "node_id": self.config.worker_id,
                "node_name": self.config.worker_name,
                "host": socket.gethostbyname(socket.gethostname()),
                "port": self.config.port,
                "models": self.config.models,
                "uptime": (datetime.now() - self.start_time).total_seconds(),
                "request_count": self.request_count,
                "load": self._get_current_load(),
                "system": self.system_info,
            }
        )

    async def _handle_status(self, request):
        """Detailed status endpoint"""
        return aiohttp.web.json_response(
            {
                "worker": {
                    "id": self.config.worker_id,
                    "name": self.config.worker_name,
                    "status": self.status,
                    "host": socket.gethostbyname(socket.gethostname()),
                    "port": self.config.port,
                },
                "cluster": {
                    "master": f"{self.config.master_host}:{self.config.master_port}",
                    "registered": True,
                    "last_heartbeat": datetime.now().isoformat(),
                },
                "performance": {
                    "requests_processed": self.request_count,
                    "uptime": (datetime.now() - self.start_time).total_seconds(),
                    "current_load": self._get_current_load(),
                    "system_info": self.system_info,
                },
                "models": self.config.models,
            }
        )

    async def _handle_root(self, request):
        """Root endpoint with worker info"""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>{self.config.worker_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }}
                .status {{ background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .metric {{ background: #f0f0f0; padding: 10px; margin: 5px 0; border-radius: 3px; display: flex; justify-content: space-between; }}
            </style>
        </head>
        <body>
            <h1>🤖 {self.config.worker_name}</h1>
            <div class="status">
                <h2>✅ Worker Status: {self.status}</h2>
                <p><strong>Worker ID:</strong> {self.config.worker_id}</p>
                <p><strong>Host:</strong> {socket.gethostname()}</p>
                <p><strong>Port:</strong> {self.config.port}</p>
                <p><strong>Uptime:</strong> {(datetime.now() - self.start_time).total_seconds():.0f}s</p>
            </div>

            <h2>📊 Performance</h2>
            <div class="metric">
                <span>Requests Processed:</span>
                <span>{self.request_count}</span>
            </div>
            <div class="metric">
                <span>Current Load:</span>
                <span>{self._get_current_load()}/10</span>
            </div>
            <div class="metric">
                <span>Models:</span>
                <span>{", ".join(self.config.models)}</span>
            </div>

            <h2>🔗 Endpoints</h2>
            <ul>
                <li><strong>Health:</strong> GET /health</li>
                <li><strong>Models:</strong> GET /v1/models</li>
                <li><strong>Chat:</strong> POST /v1/chat/completions</li>
                <li><strong>Status:</strong> GET /status</li>
            </ul>
        </body>
        </html>
        """
        return aiohttp.web.Response(text=html, content_type="text/html")


async def main():
    """Main worker function"""
    parser = argparse.ArgumentParser(description="FinSavvyAI Worker Node")
    parser.add_argument("--master", default="localhost", help="Master host address")
    parser.add_argument("--port", type=int, help="Worker port")
    parser.add_argument("--name", help="Worker name")
    parser.add_argument("--id", help="Worker ID")
    parser.add_argument(
        "--models", nargs="+", default=["gpt-3.5-turbo-sim"], help="Available models"
    )

    args = parser.parse_args()

    config = WorkerConfig(
        master_host=args.master,
        port=args.port,
        worker_name=args.name,
        worker_id=args.id,
        models=args.models,
    )

    worker = WorkerNode(config)

    try:
        await worker.start()
        print(f"�� Worker {config.worker_name} is running! Press Ctrl+C to stop.")
        await asyncio.gather(*asyncio.all_tasks())
    except KeyboardInterrupt:
        print(f"\n🛑 Stopping worker {config.worker_name}...")
        if worker.heartbeat_task:
            worker.heartbeat_task.cancel()
        worker.status = "offline"
        print("✅ Worker stopped.")


if __name__ == "__main__":
    asyncio.run(main())
