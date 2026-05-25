"""Operational routes: metrics, traces, root info, API versions, CORS preflight."""

from datetime import datetime

from aiohttp import web

from src.api.versioning import LATEST_VERSION, SUPPORTED_VERSIONS
from src.core.metrics import get_metrics_collector

metrics = get_metrics_collector()


async def handle_options(request):
    """Handle CORS preflight OPTIONS request."""
    return web.Response(status=200)


async def handle_traces(request):
    """GET /traces - recent distributed trace spans."""
    from src.core.tracing import get_span_collector

    collector = get_span_collector()
    trace_id = request.query.get("trace_id")
    limit = int(request.query.get("limit", "50"))

    if trace_id:
        spans = collector.get_by_trace(trace_id)
    else:
        spans = collector.get_recent(limit)

    return web.json_response({"spans": spans, "count": len(spans)})


async def handle_metrics(request):
    """GET /metrics - Prometheus text format (default) or JSON."""
    gateway = request.app["gateway"]
    format_type = request.query.get("format", "")
    accept = request.headers.get("Accept", "")

    if format_type == "json" or "application/json" in accept:
        return web.json_response(metrics.get_all_metrics())

    import psutil

    metrics.set_gauge(
        "uptime_seconds",
        (datetime.now() - gateway.start_time).total_seconds(),
        {"service": "gateway"},
    )
    metrics.set_gauge("active_connections", gateway.request_count, {"service": "gateway"})
    try:
        metrics.set_gauge("memory_usage_bytes", psutil.Process().memory_info().rss)
        metrics.set_gauge("cpu_usage_percent", psutil.cpu_percent(interval=0))
    except Exception:
        pass

    return web.Response(
        text=metrics.export_prometheus_format(),
        content_type="text/plain",
        charset="utf-8",
    )


async def handle_root(request):
    """GET / - service info, endpoints, live metrics."""
    gateway = request.app["gateway"]
    uptime = (datetime.now() - gateway.start_time).total_seconds()

    circuit_breaker_states = {url: cb.get_state() for url, cb in gateway.circuit_breakers.items()}

    return web.json_response(
        {
            "service": "FinSavvyAI API Gateway",
            "version": "1.0.0",
            "api_versions": SUPPORTED_VERSIONS,
            "api_latest": LATEST_VERSION,
            "endpoints": {
                "chat": "/v1/chat/completions",
                "completions": "/v1/completions",
                "embeddings": "/v1/embeddings",
                "models": "/v1/models",
                "compat": "/v1/compat",
                "arena_models": "/v1/arena/models",
                "arena_battle": "/v1/arena/battle",
                "arena_vote": "/v1/arena/vote",
                "arena_leaderboard": "/v1/arena/leaderboard",
                "openclaw_wrapper": "/v1/openclaw/wrapper",
                "agent_decision": "/v1/agent/decision",
                "docs": "/docs",
                "openapi": "/openapi.json",
                "versions": "/api/versions",
                "health": "/health",
                "metrics": "/metrics",
            },
            "features": [
                "intelligent-routing",
                "load-balancing",
                "multi-model",
                "circuit-breaker",
                "request-tracking",
                "metrics",
                "api-versioning",
                "policy-governance",
                "safety-scoring",
            ],
            "metrics": {
                "requests_total": gateway.request_count,
                "errors_total": gateway.error_count,
                "uptime_seconds": uptime,
                "success_rate": (
                    (gateway.request_count - gateway.error_count) / gateway.request_count * 100
                    if gateway.request_count > 0
                    else 100
                ),
            },
            "circuit_breakers": circuit_breaker_states,
            "request_queue": gateway.request_queue.get_stats() if gateway.request_queue else None,
            "config": {
                "max_request_size": gateway.max_request_size,
                "rate_limit_enabled": gateway.config.get("api.rate_limit_enabled", True),
                "auth_enabled": gateway.config.get("api.auth_enabled", False),
                "queue_enabled": gateway.request_queue is not None,
            },
        }
    )


async def handle_api_versions(request):
    """GET /api/versions - API version information."""
    return web.json_response(
        {
            "service": "FinSavvyAI API",
            "current_version": LATEST_VERSION,
            "supported_versions": SUPPORTED_VERSIONS,
            "deprecated_versions": [],
            "versions": [
                {
                    "version": "v1",
                    "status": "stable",
                    "released": "2024-01-01",
                    "sunset": None,
                    "features": ["chat_completions", "models_list", "intelligent_routing"],
                }
            ],
            "migration_guide": "https://docs.finsavvyai.com/api/versioning",
        }
    )
