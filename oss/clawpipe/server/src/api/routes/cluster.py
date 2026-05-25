"""Cluster management API routes."""

import logging
from aiohttp import web
from src.cluster.manager import ClusterManager

logger = logging.getLogger("finsavvyai.cluster.routes")

# Global cluster manager instance
_cluster_manager: ClusterManager = None


def get_cluster_manager() -> ClusterManager:
    """Get or create the global cluster manager."""
    global _cluster_manager
    if _cluster_manager is None:
        _cluster_manager = ClusterManager()
    return _cluster_manager


async def handle_cluster_status(request: web.Request) -> web.Response:
    """Get cluster status and statistics."""
    manager = get_cluster_manager()
    status = manager.get_status()
    return web.json_response(status)


async def handle_cluster_nodes(request: web.Request) -> web.Response:
    """List all nodes in the cluster."""
    manager = get_cluster_manager()
    nodes = [n.__dict__ for n in manager.get_all_nodes()]
    return web.json_response({"nodes": nodes})


async def handle_cluster_models(request: web.Request) -> web.Response:
    """List all models available across the cluster."""
    manager = get_cluster_manager()
    models = manager.get_all_models()
    return web.json_response({"models": models})


async def handle_cluster_discover(request: web.Request) -> web.Response:
    """Trigger discovery of new nodes."""
    manager = get_cluster_manager()
    await manager._discover_and_register()
    return web.json_response({
        "status": "discovery_complete",
        "nodes_found": len(manager.get_all_nodes())
    })


async def handle_cluster_remove_node(request: web.Request) -> web.Response:
    """Remove a node from the cluster."""
    node_id = request.match_info.get('node_id')
    if not node_id:
        return web.json_response(
            {"error": "node_id required"},
            status=400
        )

    manager = get_cluster_manager()
    await manager.remove_node(node_id)

    return web.json_response({
        "status": "removed",
        "node_id": node_id
    })


def setup_cluster_routes(app: web.Application):
    """Register cluster management routes."""
    app.router.add_get("/api/cluster/status", handle_cluster_status)
    app.router.add_get("/api/cluster/nodes", handle_cluster_nodes)
    app.router.add_get("/api/cluster/models", handle_cluster_models)
    app.router.add_post("/api/cluster/discover", handle_cluster_discover)
    app.router.add_delete("/api/cluster/nodes/{node_id}", handle_cluster_remove_node)
