# File: a2a_server/transport/http.py
"""
a2a_server.transport.http
================================
HTTP JSON-RPC transport layer with first-class streaming (SSE) support.

Task-creation and SSE streaming helpers live in :mod:`http_streaming` so this
module stays within the project file-size limit.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, HTTPException, Body
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response

# a2a imports
from a2a_json_rpc.spec import JSONRPCRequest
from a2a_json_rpc.protocol import JSONRPCProtocol
from a2a_server.pubsub import EventBus
from a2a_server.tasks.task_manager import TaskManager
from a2a_server.transport.http_streaming import streaming_send_subscribe

logger = logging.getLogger(__name__)


def setup_http(
    app: FastAPI,
    protocol: JSONRPCProtocol,
    task_manager: TaskManager,
    event_bus: EventBus | None = None,
) -> None:
    @app.post("/rpc")
    async def default_rpc(payload: JSONRPCRequest = Body(...)):
        # assign a fresh alias for each send
        if payload.method == "tasks/send":
            payload.params["id"] = str(uuid.uuid4())
        raw = await protocol._handle_raw_async(payload.model_dump())
        return Response(status_code=204) if raw is None else JSONResponse(
            jsonable_encoder(raw)
        )

    for handler in task_manager.get_handlers():
        @app.post(f"/{handler}/rpc")  # type: ignore
        async def handler_rpc(payload: JSONRPCRequest = Body(...), _h=handler):
            if payload.method == "tasks/send":
                payload.params["id"] = str(uuid.uuid4())
            if payload.method in ("tasks/send", "tasks/sendSubscribe"):
                payload.params.setdefault("handler", _h)
            raw = await protocol._handle_raw_async(payload.model_dump())
            return Response(status_code=204) if raw is None else JSONResponse(
                jsonable_encoder(raw)
            )

        if event_bus:
            @app.post(f"/{handler}")  # type: ignore
            async def handler_alias(payload: JSONRPCRequest = Body(...), _h=handler):
                if payload.method == "tasks/send":
                    payload.params["id"] = str(uuid.uuid4())
                if payload.method == "tasks/sendSubscribe":
                    try:
                        return await streaming_send_subscribe(
                            payload, task_manager, event_bus, _h
                        )
                    except Exception as exc:
                        logger.error("[transport.http] streaming failed", exc_info=True)
                        raise HTTPException(status_code=500, detail=str(exc)) from exc
                payload.params.setdefault("handler", _h)
                raw = await protocol._handle_raw_async(payload.model_dump())
                return Response(status_code=204) if raw is None else JSONResponse(
                    jsonable_encoder(raw)
                )

        logger.debug("[transport.http] routes registered for handler %s", handler)


__all__ = ["setup_http"]
