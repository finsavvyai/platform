"""Models listing route with TTL cache."""

import time

import aiohttp
from aiohttp import web

from src.core.logger import get_logger

logger = get_logger()


async def handle_models(request):
    """GET /v1/models - aggregate models from cloud providers and cluster nodes."""
    gateway = request.app["gateway"]

    now = time.monotonic()
    if gateway._models_cache and (now - gateway._models_cache_time) < gateway._models_cache_ttl:
        return web.json_response(gateway._models_cache)

    all_models = {}

    if gateway.provider_registry:
        try:
            cloud_models = await gateway.provider_registry.list_all_models()
            for m in cloud_models:
                all_models[m.id] = {
                    "id": m.id,
                    "object": "model",
                    "owned_by": m.owned_by or m.provider,
                    "provider": m.provider,
                }
        except Exception as e:
            logger.warning(f"Error listing cloud models: {e}")

    try:
        timeout = aiohttp.ClientTimeout(total=5, connect=2)
        async with gateway.session.get(
            f"{gateway.master_url}/cluster/nodes", timeout=timeout
        ) as resp:
            if resp.status == 200:
                data = await resp.json()
                nodes = data.get("nodes", [])
                for node in nodes:
                    if node.get("status") == "online":
                        for model_name in node.get("models", []):
                            if isinstance(model_name, str) and model_name not in all_models:
                                all_models[model_name] = {
                                    "id": model_name,
                                    "object": "model",
                                    "owned_by": f"node-{node.get('id', 'unknown')}",
                                    "provider": "cluster",
                                }
    except Exception:
        pass

    models_list = list(all_models.values())
    response_data = {"object": "list", "data": models_list}

    gateway._models_cache = response_data
    gateway._models_cache_time = time.monotonic()

    logger.info(f"Listed {len(models_list)} models")
    return web.json_response(response_data)
