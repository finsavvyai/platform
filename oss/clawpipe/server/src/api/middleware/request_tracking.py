"""Request tracking middleware: ID propagation, size limits, timing, metrics."""

from datetime import datetime

import aiohttp.web
from aiohttp import web

from src.core.logger import get_logger, set_correlation_id
from src.core.metrics import get_metrics_collector
from src.core.request_tracking import (
    generate_request_id,
    get_request_id_from_header,
    set_request_id_header,
)

logger = get_logger()
metrics = get_metrics_collector()


def request_tracking_middleware_factory(max_request_size: int):
    """Return request-tracking middleware bound to the given size limit."""

    @aiohttp.web.middleware
    async def request_tracking_middleware(request, handler):
        start_time = datetime.now()
        request_id = get_request_id_from_header(request) or generate_request_id()
        request["request_id"] = request_id
        set_correlation_id(request_id)

        content_length = request.headers.get("Content-Length")
        if content_length:
            try:
                size = int(content_length)
                if size > max_request_size:
                    logger.warning(
                        "Request too large",
                        request_id=request_id,
                        size=size,
                        max_size=max_request_size,
                        path=request.path,
                    )
                    response = web.json_response(
                        {
                            "error": "Request too large",
                            "message": f"Request size ({size} bytes) exceeds maximum ({max_request_size} bytes)",
                        },
                        status=413,
                    )
                    set_request_id_header(response, request_id)
                    return response
            except ValueError:
                pass

        logger.info(
            "Incoming request",
            request_id=request_id,
            method=request.method,
            path=request.path,
            client_ip=request.remote,
        )
        metrics.increment(
            "requests_total",
            labels={"method": request.method, "path": request.path},
        )

        try:
            response = await handler(request)
            duration = (datetime.now() - start_time).total_seconds()
            set_request_id_header(response, request_id)
            logger.info(
                "Request completed",
                request_id=request_id,
                status=response.status,
                duration=duration,
                path=request.path,
            )
            metrics.record_timing(
                "request_duration_seconds",
                duration,
                {
                    "method": request.method,
                    "path": request.path,
                    "status": str(response.status),
                },
            )
            metrics.increment(
                "responses_total",
                labels={
                    "status": str(response.status),
                    "method": request.method,
                },
            )
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            response.headers.setdefault("openai-version", "2020-10-01")
            response.headers.setdefault("openai-processing-ms", str(int(duration * 1000)))
            response.headers.setdefault("x-request-id", request_id)
            return response
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(
                "Request failed",
                request_id=request_id,
                error=str(e),
                error_type=type(e).__name__,
                duration=duration,
                path=request.path,
            )
            metrics.increment(
                "errors_total",
                labels={"error_type": type(e).__name__, "path": request.path},
            )
            raise

    return request_tracking_middleware
