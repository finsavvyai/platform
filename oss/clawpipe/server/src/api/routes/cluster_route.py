"""Cluster worker routing: fallback path when no cloud provider matches."""

import asyncio

import aiohttp
from aiohttp import web

from src.core.circuit_breaker import CircuitBreaker, CircuitBreakerConfig
from src.core.logger import get_logger
from src.core.metrics import get_metrics_collector
from src.core.tracing import inject_trace_headers

logger = get_logger()
metrics = get_metrics_collector()


async def _find_worker_url(gateway, messages, model, preferred_worker_url):
    """Find a worker URL via router or cluster node list."""
    worker_url = preferred_worker_url
    selected_model_name = model

    message_text = " ".join(
        str(msg.get("content", "")) for msg in messages if msg.get("role") == "user"
    )
    has_images = any("image" in str(msg.get("content", "")).lower() for msg in messages)

    if gateway.router and not worker_url:
        try:
            worker_url, selected_model = await gateway.router.route_request(
                message_text, has_images=has_images
            )
            if not selected_model_name:
                selected_model_name = selected_model.name
        except Exception:
            pass

    if not worker_url:
        try:
            async with gateway.session.get(f"{gateway.master_url}/cluster/nodes") as resp:
                if resp.status == 200:
                    resp_data = await resp.json()
                    nodes = resp_data.get("nodes", [])
                    if nodes:
                        node = nodes[0]
                        worker_url = f"http://{node['host']}:{node['port']}"
                        if not selected_model_name:
                            selected_model_name = "gpt-3.5-turbo-sim"
        except Exception:
            pass

    return worker_url, selected_model_name


async def route_to_cluster(
    gateway, data, messages, model, preferred_worker_url, request_id, trace_ctx
):
    """Route request to a cluster worker node with circuit breaker protection."""
    worker_url, selected_model_name = await _find_worker_url(
        gateway, messages, model, preferred_worker_url
    )

    if not worker_url:
        return web.json_response(
            {
                "error": "No providers available",
                "message": (
                    "No cloud API keys configured and no cluster workers online. "
                    "Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env, or start a cluster worker."
                ),
                "request_id": request_id,
            },
            status=503,
        )

    logger.info(
        f"Routing request to {worker_url} using model {selected_model_name}",
        request_id=request_id,
        worker=worker_url,
        model=selected_model_name,
    )

    if worker_url not in gateway.circuit_breakers:
        gateway.circuit_breakers[worker_url] = CircuitBreaker(
            name=f"worker-{worker_url}",
            config=CircuitBreakerConfig(
                failure_threshold=5, success_threshold=2, timeout_seconds=30
            ),
        )
    circuit_breaker = gateway.circuit_breakers[worker_url]

    try:

        async def forward_request():
            timeout = aiohttp.ClientTimeout(total=gateway.config.get("api.timeout", 60), connect=10)
            fwd_headers = {}
            inject_trace_headers(fwd_headers, trace_ctx)
            async with gateway.session.post(
                f"{worker_url}/v1/chat/completions",
                json={**data, "model": selected_model_name},
                headers=fwd_headers,
                timeout=timeout,
            ) as response:
                if response.status == 200:
                    return response.status, await response.json()
                return response.status, await response.text()

        status_code, result = await circuit_breaker.call(forward_request)

        if status_code == 200:
            if isinstance(result, dict):
                result["routing_info"] = {
                    "worker": worker_url,
                    "model": selected_model_name,
                    "request_id": request_id,
                }
                result["routing"] = {
                    "worker_url": worker_url,
                    "selected_model": selected_model_name,
                }
            metrics.increment("completions_success")
            return web.json_response(result)
        else:
            gateway.error_count += 1
            logger.warning(
                "Worker returned error",
                request_id=request_id,
                worker=worker_url,
                status=status_code,
            )
            return web.json_response(
                {
                    "error": "Worker error",
                    "message": result if isinstance(result, str) else "Worker returned an error",
                    "status": status_code,
                    "request_id": request_id,
                },
                status=status_code if 400 <= status_code < 600 else 502,
            )

    except asyncio.TimeoutError:
        gateway.error_count += 1
        logger.error("Request timeout", request_id=request_id, worker=worker_url)
        return web.json_response(
            {
                "error": "Request timeout",
                "message": "Worker did not respond in time",
                "request_id": request_id,
            },
            status=504,
        )
    except aiohttp.ClientError as e:
        gateway.error_count += 1
        logger.error("Client error", request_id=request_id, worker=worker_url, error=str(e))
        return web.json_response(
            {
                "error": "Connection error",
                "message": f"Failed to connect to worker: {e}",
                "request_id": request_id,
            },
            status=502,
        )
    except Exception as e:
        gateway.error_count += 1
        logger.error(
            "Unexpected error forwarding", request_id=request_id, worker=worker_url, error=str(e)
        )
        return web.json_response(
            {
                "error": "Internal error",
                "message": "An unexpected error occurred",
                "request_id": request_id,
            },
            status=500,
        )
