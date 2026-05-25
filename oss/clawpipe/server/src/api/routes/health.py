"""Health check route with provider and cluster status aggregation."""

from datetime import datetime

import aiohttp
from aiohttp import web

from src.core.context_packing import get_context_packer
from src.core.logger import get_logger
from src.core.reasoning_bank import get_reasoning_bank
from src.core.smart_router import get_smart_router

logger = get_logger()


def _setup_completion(cloud_providers: dict, master_healthy: bool, workers_summary: dict) -> dict:
    """Return setup completion checks and overall percentage."""
    checks = {
        "gateway_running": True,
        "master_reachable": master_healthy,
        "at_least_one_worker": workers_summary.get("online", 0) > 0,
        "cloud_provider_configured": bool(cloud_providers),
        "cloud_provider_healthy": any(cloud_providers.values()) if cloud_providers else False,
    }
    passed = sum(1 for v in checks.values() if v)
    result: dict = {"checks": checks, "percent": round(passed / len(checks) * 100)}
    if not cloud_providers:
        result["hints"] = [
            "Set OPENAI_API_KEY to enable OpenAI models",
            "Set ANTHROPIC_API_KEY to enable Anthropic models",
            "Ollama and LM Studio work without keys on localhost",
        ]
    return result


async def handle_health(request):
    """GET /health - aggregated health of providers and cluster.

    Add ?verbose=true to include setup completion percentage.
    """
    gateway = request.app["gateway"]
    verbose = request.rel_url.query.get("verbose", "").lower() == "true"
    try:
        cloud_providers = {}
        if gateway.provider_registry:
            cloud_providers = await gateway.provider_registry.health_check_all()

        master_healthy = False
        workers_summary = {"total": 0, "online": 0, "offline": 0}
        try:
            timeout = aiohttp.ClientTimeout(total=3, connect=1)
            async with gateway.session.get(
                f"{gateway.master_url}/health", timeout=timeout
            ) as resp:
                master_healthy = resp.status == 200
            async with gateway.session.get(
                f"{gateway.master_url}/cluster/nodes", timeout=timeout
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    nodes = data.get("nodes", [])
                    workers_summary["total"] = len(nodes)
                    for node in nodes:
                        if node.get("status") == "online":
                            workers_summary["online"] += 1
                        else:
                            workers_summary["offline"] += 1
        except Exception:
            pass

        any_cloud_up = any(cloud_providers.values())
        any_cluster_up = workers_summary["online"] > 0

        if any_cloud_up or any_cluster_up:
            status = "healthy"
        elif master_healthy:
            status = "degraded"
        elif cloud_providers:
            status = "degraded"
        else:
            # Zero-config: no providers configured yet, gateway is ready
            status = "starting"

        response_data = {
            "status": status,
            "gateway": "online",
            "cloud_providers": cloud_providers,
            "cluster": {
                "master": "online" if master_healthy else "offline",
                "workers": workers_summary,
            },
            "router": "enabled" if gateway.router else "disabled",
            "timestamp": datetime.now().isoformat(),
        }
        if verbose:
            response_data["setup"] = _setup_completion(cloud_providers, master_healthy, workers_summary)
            response_data["intelligence"] = {
                "reasoning_bank": get_reasoning_bank().stats,
                "context_packing": get_context_packer().stats,
                "smart_router": get_smart_router().stats,
            }

        status_code = 200 if status in ("healthy", "starting") else 503
        return web.json_response(response_data, status=status_code)
    except Exception as e:
        logger.error("Error in health check", error=str(e), error_type=type(e).__name__)
        return web.json_response(
            {"status": "unhealthy", "gateway": "error", "master": "unknown", "error": str(e)},
            status=503,
        )
