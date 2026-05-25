#!/usr/bin/env python3
"""
Master Server HTTP Handlers

Route handlers for the cluster master server endpoints.
"""

from datetime import datetime
from typing import Any, Dict

from aiohttp import web

from src.core.audit import AuditAction


async def root_handler(request: web.Request) -> web.Response:
    """Root endpoint."""
    return web.json_response({
        "service": "FinSavvyAI Cluster Master", "status": "running",
        "endpoints": ["/health", "/cluster/status", "/cluster/nodes"],
    })


async def health_handler(request: web.Request, nodes: Dict, start_time: datetime, cluster_id: str) -> web.Response:
    """Health check endpoint."""
    healthy = sum(1 for n in nodes.values() if n.get("status") == "online")
    return web.json_response({
        "status": "healthy", "timestamp": datetime.now().isoformat(),
        "service": "cluster-master",
        "cluster": {"total_nodes": len(nodes), "online_nodes": healthy, "cluster_id": cluster_id},
        "uptime_seconds": (datetime.now() - start_time).total_seconds(),
    })


async def cluster_status_handler(request: web.Request, nodes: Dict, host: str,
                                  port: int, cluster_id: str, cleanup_fn: Any) -> web.Response:
    """Cluster status endpoint."""
    await cleanup_fn()
    online = len([n for n in nodes.values() if n.get("status") == "online"])
    models: set = set()
    for node in nodes.values():
        models.update(node.get("models", []))
    return web.json_response({
        "cluster_id": cluster_id, "master": f"{host}:{port}",
        "total_nodes": len(nodes), "online_nodes": online,
        "total_models": len(models), "timestamp": datetime.now().isoformat(),
    })


async def list_nodes_handler(request: web.Request, nodes: Dict) -> web.Response:
    """List all nodes."""
    return web.json_response({"nodes": list(nodes.values())})


async def register_node_handler(request: web.Request, nodes: Dict,
                                 metrics: Any, audit: Any, node_logger: Any) -> web.Response:
    """Register a new node."""
    try:
        try:
            data = await request.json()
        except Exception as e:
            node_logger.warning("Invalid JSON in node registration", error=str(e))
            return web.json_response({"status": "error", "message": "Invalid JSON in request body"}, status=400)
        if not isinstance(data, dict):
            return web.json_response({"status": "error", "message": "Request body must be a JSON object"}, status=400)
        node_id = data.get("id")
        if not node_id:
            return web.json_response({"status": "error", "message": "Missing required field: 'id'"}, status=400)
        host = data.get("host")
        port = data.get("port")
        if not host or not port:
            return web.json_response(
                {"status": "error", "message": "Missing required fields: 'host' and 'port'"}, status=400)
        nodes[node_id] = {
            **data, "status": "online",
            "registered_at": datetime.now().isoformat(),
            "last_heartbeat": datetime.now().isoformat(),
        }
        metrics.increment("node_registrations_total")
        audit.log(AuditAction.NODE_REGISTERED, resource=node_id,
                  detail={"host": host, "port": port, "models": data.get("models", [])}, client_ip=request.remote)
        node_logger.info("Node registered", node_id=node_id, host=host, port=port)
        return web.json_response({"status": "registered", "node_id": node_id,
                                   "message": f"Node {node_id} registered successfully"})
    except Exception as e:
        node_logger.error("Error registering node", error=str(e), error_type=type(e).__name__)
        return web.json_response({"status": "error", "message": f"Registration failed: {str(e)}"}, status=500)


async def heartbeat_handler(request: web.Request, nodes: Dict, metrics: Any, hb_logger: Any) -> web.Response:
    """Handle node heartbeat."""
    try:
        try:
            data = await request.json()
        except Exception as e:
            hb_logger.warning("Invalid JSON in heartbeat", error=str(e))
            return web.json_response({"status": "error", "message": "Invalid JSON in request body"}, status=400)
        if not isinstance(data, dict):
            return web.json_response({"status": "error", "message": "Request body must be a JSON object"}, status=400)
        node_id = data.get("id")
        if not node_id:
            return web.json_response({"status": "error", "message": "Missing required field: 'id'"}, status=400)
        if node_id in nodes:
            nodes[node_id]["last_heartbeat"] = datetime.now().isoformat()
            nodes[node_id]["status"] = data.get("status", "online")
            nodes[node_id]["load"] = data.get("load", 0)
            if "request_count" in data:
                nodes[node_id]["request_count"] = data["request_count"]
            if "uptime" in data:
                nodes[node_id]["uptime"] = data["uptime"]
            metrics.increment("heartbeats_total")
            return web.json_response({"status": "ok"})
        hb_logger.warning("Heartbeat from unknown node", node_id=node_id)
        return web.json_response(
            {"status": "error", "message": "Node not found. Please register first."}, status=404)
    except Exception as e:
        hb_logger.error("Error processing heartbeat", error=str(e), error_type=type(e).__name__)
        return web.json_response(
            {"status": "error", "message": f"Heartbeat processing failed: {str(e)}"}, status=500)


async def metrics_handler(request: web.Request, nodes: Dict, start_time: datetime, metrics: Any) -> web.Response:
    """Prometheus metrics endpoint for master server."""
    online = sum(1 for n in nodes.values() if n.get("status") == "online")
    metrics.set_gauge("cluster_nodes_online", online, {"service": "master"})
    metrics.set_gauge("cluster_nodes_total", len(nodes), {"service": "master"})
    metrics.set_gauge("uptime_seconds", (datetime.now() - start_time).total_seconds(), {"service": "master"})
    fmt = request.query.get("format", "")
    accept = request.headers.get("Accept", "")
    if fmt == "json" or "application/json" in accept:
        return web.json_response(metrics.get_all_metrics())
    return web.Response(text=metrics.export_prometheus_format(),
                        content_type="text/plain", charset="utf-8")
