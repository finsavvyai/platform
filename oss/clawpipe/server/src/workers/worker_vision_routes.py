"""Worker vision pipeline HTTP route handlers."""

import base64

import aiohttp.web

from src.core.logger import get_logger

logger = get_logger()


async def handle_vision_pipeline(request):
    """POST /v1/vision/pipeline - Execute a multi-step vision pipeline."""
    worker = request.app["worker"]
    if not worker.vision_pipeline:
        return aiohttp.web.json_response({"error": "Vision pipeline not available"}, status=503)
    try:
        data = await request.json()
        image = data.get("image", "")
        pipeline_name = data.get("pipeline")
        model = data.get("model", "default")

        if isinstance(pipeline_name, str):
            from src.core.vision_pipeline import PipelineTemplates

            templates = {
                "document_analysis": PipelineTemplates.document_analysis,
                "ui_screenshot_analysis": PipelineTemplates.ui_screenshot_analysis,
                "image_classification": PipelineTemplates.image_classification,
            }
            factory = templates.get(pipeline_name)
            if not factory:
                return aiohttp.web.json_response({"error": f"Unknown pipeline: {pipeline_name}"}, status=400)
            steps = factory()
        elif isinstance(pipeline_name, list):
            steps = pipeline_name
        else:
            return aiohttp.web.json_response(
                {"error": "pipeline must be a template name or list of steps"}, status=400,
            )
        result = await worker.vision_pipeline.execute(image, steps, model=model)
        return aiohttp.web.json_response(result)
    except Exception as e:
        logger.error(f"Vision pipeline error: {e}")
        return aiohttp.web.json_response({"error": str(e)}, status=500)


async def handle_document_ocr(request):
    """POST /v1/vision/document/ocr - Process document OCR."""
    worker = request.app["worker"]
    if not worker.document_processor:
        return aiohttp.web.json_response({"error": "Document processor not available"}, status=503)
    try:
        data = await request.json()
        doc_b64 = data.get("document", "")
        if doc_b64.startswith("data:"):
            doc_b64 = doc_b64.split(",", 1)[1]
        doc_bytes = base64.b64decode(doc_b64)
        result = await worker.document_processor.process_document(
            doc_bytes, model=data.get("model", "default"),
            pages=data.get("pages"), fmt=data.get("format", "text"),
        )
        return aiohttp.web.json_response(result)
    except Exception as e:
        logger.error(f"Document OCR error: {e}")
        return aiohttp.web.json_response({"error": str(e)}, status=500)


async def handle_vision_batch(request):
    """POST /v1/vision/batch - Batch process multiple vision requests."""
    worker = request.app["worker"]
    if not worker.openclaw_client:
        return aiohttp.web.json_response({"error": "OpenClaw not available"}, status=503)
    try:
        data = await request.json()
        results = await worker.openclaw_client.batch_complete_vision(
            data.get("requests", []), max_concurrent=data.get("max_concurrent", 5),
        )
        return aiohttp.web.json_response({"results": results})
    except Exception as e:
        logger.error(f"Vision batch error: {e}")
        return aiohttp.web.json_response({"error": str(e)}, status=500)


async def handle_cache_stats(request):
    """GET /v1/vision/cache/stats - Get vision cache statistics."""
    worker = request.app["worker"]
    if not worker.vision_cache:
        return aiohttp.web.json_response({"error": "Vision cache not enabled"}, status=503)
    stats = await worker.vision_cache.get_stats()
    return aiohttp.web.json_response(stats)


async def handle_cache_clear(request):
    """POST /v1/vision/cache/clear - Clear vision cache."""
    worker = request.app["worker"]
    if not worker.vision_cache:
        return aiohttp.web.json_response({"error": "Vision cache not enabled"}, status=503)
    await worker.vision_cache.clear()
    return aiohttp.web.json_response({"status": "cleared"})


async def handle_pipeline_templates(request):
    """GET /v1/vision/pipelines/templates - List available pipeline templates."""
    from src.core.vision_pipeline import PipelineTemplates

    templates = {
        "document_analysis": PipelineTemplates.document_analysis(),
        "ui_screenshot_analysis": PipelineTemplates.ui_screenshot_analysis(),
        "image_classification": PipelineTemplates.image_classification(),
    }
    return aiohttp.web.json_response({
        "templates": {name: {"steps": [s["name"] for s in steps]} for name, steps in templates.items()}
    })
