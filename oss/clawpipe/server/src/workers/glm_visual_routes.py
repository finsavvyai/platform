"""Route handlers for GLM-4V Visual Worker."""

import base64
import time
from typing import Dict, List

from aiohttp import web

from src.workers.glm_visual_service import GLMVisualService, VISION_AVAILABLE, GLM_AVAILABLE


def _estimate_tokens(text: str) -> int:
    return len(text) // 4


def _build_usage(messages: List[Dict], response_text: str) -> Dict:
    prompt_tokens = sum(_estimate_tokens(str(m.get("content", ""))) for m in messages)
    completion_tokens = _estimate_tokens(response_text)
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


def _build_completion_response(
    model: str, response_text: str, messages: List[Dict],
    node_id: str, node_name: str, host: str, device: str,
    generation_time: float, extra_info: Dict | None = None,
) -> Dict:
    response = {
        "id": f"chatcmpl-{int(time.time())}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": response_text},
            "finish_reason": "stop",
        }],
        "usage": _build_usage(messages, response_text),
        "worker_info": {
            "node_id": node_id,
            "node_name": node_name,
            "host": host,
            "device": device,
            "generation_time": f"{generation_time:.2f}s",
            "capabilities": ["text", "vision"],
        },
    }
    if extra_info:
        response["worker_info"].update(extra_info)
    return response


async def handle_completion(request: web.Request, worker: "GLMVisualWorkerNode") -> web.Response:
    """Handle standard text chat completion requests."""
    data = await request.json()
    messages = data.get("messages", [])
    model = data.get("model", "glm-4v-9b")

    start_time = time.time()
    response_text = await worker.glm_service.generate_response(messages, model)
    generation_time = time.time() - start_time

    return web.json_response(_build_completion_response(
        model, response_text, messages,
        worker.node_id, worker.name, worker.host,
        worker.glm_service.device, generation_time,
    ))


async def handle_vision_completion(request: web.Request, worker: "GLMVisualWorkerNode") -> web.Response:
    """Handle vision-enabled chat completion requests."""
    data = await request.json()
    messages = data.get("messages", [])
    model = data.get("model", "glm-4v-9b")

    image_data = None
    if "image" in data and isinstance(data["image"], str):
        image_data = base64.b64decode(data["image"])

    start_time = time.time()
    response_text = await worker.glm_service.generate_response(messages, model, image_data)
    generation_time = time.time() - start_time

    return web.json_response(_build_completion_response(
        model, response_text, messages,
        worker.node_id, worker.name, worker.host,
        worker.glm_service.device, generation_time,
        extra_info={"processed_image": image_data is not None},
    ))


async def handle_analyze_image(request: web.Request, worker: "GLMVisualWorkerNode") -> web.Response:
    """Handle direct image analysis requests."""
    data = await request.json()
    prompt = data.get("prompt", "What do you see in this image?")

    image_data = None
    if "image" in data and isinstance(data["image"], str):
        image_data = base64.b64decode(data["image"])
    elif request.content_type.startswith("image/"):
        image_data = await request.read()

    if not image_data:
        return web.json_response({"error": "No image provided"}, status=400)

    messages = [{"role": "user", "content": prompt}]
    start_time = time.time()
    response_text = await worker.glm_service.generate_response(messages, "glm-4v-9b", image_data)
    generation_time = time.time() - start_time

    return web.json_response({
        "analysis": response_text,
        "prompt": prompt,
        "image_size": len(image_data),
        "processing_time": f"{generation_time:.2f}s",
        "model": "glm-4v-9b",
        "worker_info": {
            "node_id": worker.node_id,
            "node_name": worker.name,
            "device": worker.glm_service.device,
        },
    })


async def handle_upload_image(request: web.Request) -> web.Response:
    """Handle image upload and return base64 encoded result."""
    if not request.content_type.startswith("image/"):
        return web.json_response({"error": "Invalid content type"}, status=400)

    image_data = await request.read()
    encoded = base64.b64encode(image_data).decode("utf-8")
    return web.json_response({
        "success": True,
        "image_data": encoded,
        "size": len(image_data),
        "content_type": request.content_type,
    })


async def handle_models(request: web.Request, worker: "GLMVisualWorkerNode") -> web.Response:
    """Return available models with capabilities."""
    models = [{
        "id": model,
        "object": "model",
        "created": int(time.time()),
        "owned_by": f"worker-{worker.node_id}",
        "capabilities": ["text", "vision"] if "glm-4v" in model else ["text"],
    } for model in worker.models]
    return web.json_response({"object": "list", "data": models})


async def handle_health(request: web.Request, worker: "GLMVisualWorkerNode") -> web.Response:
    """Health check endpoint with multimodal info."""
    return web.json_response({
        "status": "healthy",
        "node_id": worker.node_id,
        "node_name": worker.name,
        "host": worker.host,
        "models": worker.models,
        "device": worker.glm_service.device,
        "model_loaded": worker.glm_service.loaded,
        "capabilities": {
            "text": True, "vision": True,
            "images": VISION_AVAILABLE, "glm_model": GLM_AVAILABLE,
        },
    })
