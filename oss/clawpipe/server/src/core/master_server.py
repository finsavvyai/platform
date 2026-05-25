#!/usr/bin/env python3
"""
Simple FinSavvyAI Master Server
Dedicated master server for cluster management.

Handlers live in master_handlers.py.
"""

import asyncio
import logging
from datetime import datetime

from aiohttp import web

from src.core.audit import get_audit_logger
from src.core.auth import APIKeyManager, get_api_key_from_request
from src.core.auth_middleware import resolve_auth_mode
from src.core.config import ClusterConfig
from src.core.logger import get_logger
from src.core.master_handlers import (
    cluster_status_handler, heartbeat_handler, health_handler,
    list_nodes_handler, metrics_handler, register_node_handler, root_handler,
)
from src.core.metrics import get_metrics_collector
from src.api.middleware.cors import cors_middleware_factory
from src.api.middleware.security_headers import security_headers_middleware_factory

logger_mod = logging.getLogger("finsavvyai.master")


class MasterServer:
    """Simplified master server for cluster management."""

    def __init__(self, host: str = None, port: int = 8000, config_path: str = None):
        self.config = ClusterConfig(config_path)
        if host is None:
            host = self.config.master_host or "0.0.0.0"
        self.host = host
        self.port = port or self.config.master_port
        self.nodes: dict = {}
        self.start_time = datetime.now()
        self.logger = get_logger("master", level=self.config.log_level, log_file=self.config.log_file)
        self.heartbeat_timeout = self.config.heartbeat_interval * 3
        self.metrics = get_metrics_collector()
        self.audit = get_audit_logger("master")

    async def start(self) -> None:
        """Start the master server."""
        app = web.Application()

        @web.middleware
        async def auth_middleware(request: web.Request, handler) -> web.Response:
            public = {"/", "/health", "/cluster/status", "/cluster/nodes", "/metrics"}
            if request.path in public or request.method == "OPTIONS":
                return await handler(request)
            mode = resolve_auth_mode(self.config)
            if mode == "none":
                return await handler(request)
            api_key = get_api_key_from_request(request)
            if not api_key:
                if mode == "dev":
                    logger_mod.warning("Dev auth: missing key on %s", request.path)
                    return await handler(request)
                return web.json_response({"error": "Unauthorized", "message": "API key required"}, status=401)
            if not APIKeyManager().validate_key(api_key):
                if mode == "dev":
                    logger_mod.warning("Dev auth: invalid key on %s", request.path)
                    return await handler(request)
                return web.json_response({"error": "Unauthorized", "message": "Invalid API key"}, status=401)
            return await handler(request)

        app.middlewares.append(auth_middleware)
        app.middlewares.append(cors_middleware_factory())
        app.middlewares.append(security_headers_middleware_factory())
        srv = self  # capture for closures
        app.router.add_get("/", lambda r: root_handler(r))
        app.router.add_get("/health", lambda r: health_handler(r, srv.nodes, srv.start_time, srv.config.cluster_id))
        app.router.add_get("/cluster/status", lambda r: cluster_status_handler(
            r, srv.nodes, srv.host, srv.port, srv.config.cluster_id, srv._cleanup_stale_nodes_sync))
        app.router.add_get("/cluster/nodes", lambda r: list_nodes_handler(r, srv.nodes))
        app.router.add_post("/cluster/join", lambda r: register_node_handler(r, srv.nodes, srv.metrics, srv.audit, srv.logger))
        app.router.add_post("/cluster/heartbeat", lambda r: heartbeat_handler(r, srv.nodes, srv.metrics, srv.logger))
        app.router.add_get("/metrics", lambda r: metrics_handler(r, srv.nodes, srv.start_time, srv.metrics))

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        self.logger.info("FinSavvyAI Cluster Master started", host=self.host, port=self.port)

        asyncio.create_task(self._cleanup_stale_nodes())
        loop = asyncio.get_event_loop()
        shutdown_event = asyncio.Event()

        import signal
        for sig in (signal.SIGTERM, signal.SIGINT):
            try:
                loop.add_signal_handler(sig, shutdown_event.set)
            except NotImplementedError:
                pass
        try:
            await shutdown_event.wait()
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            self.logger.info("Master server shutting down")
            await runner.cleanup()

    async def _cleanup_stale_nodes(self) -> None:
        """Background task to clean up stale nodes."""
        while True:
            try:
                await asyncio.sleep(self.config.heartbeat_interval)
                await self._cleanup_stale_nodes_sync()
            except Exception as e:
                self.logger.error("Error cleaning up stale nodes", error=str(e))

    async def _cleanup_stale_nodes_sync(self) -> None:
        """Mark nodes offline if heartbeat timed out."""
        now = datetime.now()
        for node_id, node in self.nodes.items():
            hb = node.get("last_heartbeat")
            if hb:
                try:
                    if (now - datetime.fromisoformat(hb)).total_seconds() > self.heartbeat_timeout:
                        self.logger.warning("Removing stale node", node_id=node_id)
                        node["status"] = "offline"
                except Exception:
                    node["status"] = "offline"


async def main() -> None:
    server = MasterServer()
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
