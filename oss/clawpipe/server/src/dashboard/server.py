#!/usr/bin/env python3
"""
FinSavvyAI Dashboard Server

Serves the web dashboard and proxies API requests to the cluster.
Can run standalone or be mounted into the API gateway.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from aiohttp import web

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")


def setup_dashboard_routes(app: web.Application, api_base: str = ""):
    """Mount dashboard routes onto an existing aiohttp app."""
    app.router.add_get("/dashboard", _serve_index)
    app.router.add_get("/dashboard/", _serve_index)
    app.router.add_static("/dashboard/static", STATIC_DIR, name="dashboard_static")


async def _serve_index(request: web.Request) -> web.Response:
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        return web.Response(text="Dashboard not found", status=404)
    return web.FileResponse(index_path)


async def create_standalone_app(
    gateway_url: str = "http://localhost:8080",
    master_url: str = "http://localhost:8000",
) -> web.Application:
    """Create a standalone dashboard app for development."""
    app = web.Application()
    setup_dashboard_routes(app)

    # Store config for template rendering
    app["gateway_url"] = gateway_url
    app["master_url"] = master_url

    return app


def main():
    import argparse

    parser = argparse.ArgumentParser(description="FinSavvyAI Dashboard")
    parser.add_argument("--port", type=int, default=3000)
    parser.add_argument("--gateway", default="http://localhost:8080")
    parser.add_argument("--master", default="http://localhost:8000")
    args = parser.parse_args()

    import asyncio

    async def start():
        app = await create_standalone_app(args.gateway, args.master)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", args.port)
        await site.start()
        print(f"Dashboard running at http://localhost:{args.port}/dashboard")
        await asyncio.Event().wait()

    asyncio.run(start())


if __name__ == "__main__":
    main()
