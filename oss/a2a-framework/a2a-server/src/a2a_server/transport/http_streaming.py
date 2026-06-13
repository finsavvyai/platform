# File: a2a_server/transport/http_streaming.py
"""
a2a_server.transport.http_streaming
===================================
Task creation and SSE streaming helpers for the HTTP JSON-RPC transport.
"""
from __future__ import annotations

import inspect
import logging
from typing import Optional, Tuple

from fastapi.responses import StreamingResponse

from a2a_json_rpc.spec import JSONRPCRequest
from a2a_json_rpc.spec import (
    TaskArtifactUpdateEvent,
    TaskSendParams,
    TaskStatusUpdateEvent,
    TaskState,
)
from a2a_server.pubsub import EventBus
from a2a_server.tasks.task_manager import TaskManager, Task

logger = logging.getLogger(__name__)


def _is_terminal(state: TaskState) -> bool:
    return state in (TaskState.completed, TaskState.canceled, TaskState.failed)


async def _create_task(
    tm: TaskManager,
    params: TaskSendParams,
    handler: Optional[str],
) -> Tuple[Task, str, str]:
    client_id = params.id
    original = inspect.unwrap(tm.create_task)
    bound = original.__get__(tm, tm.__class__)
    sig = inspect.signature(original)

    # If TM supports explicit task_id injection:
    if "task_id" in sig.parameters:
        task = await bound(
            params.message,
            session_id=params.session_id,
            handler_name=handler,
            task_id=client_id,
        )
        return task, task.id, task.id

    # Legacy: server generates its own ID, then alias
    task = await bound(
        params.message,
        session_id=params.session_id,
        handler_name=handler,
    )
    server_id = task.id
    if client_id and client_id != server_id:
        async with tm._lock:
            tm._aliases[client_id] = server_id
    else:
        client_id = server_id
    return task, server_id, client_id


async def streaming_send_subscribe(
    payload: JSONRPCRequest,
    tm: TaskManager,
    bus: EventBus,
    handler_name: Optional[str],
) -> StreamingResponse:
    raw = dict(payload.params)
    if handler_name:
        raw["handler"] = handler_name
    params = TaskSendParams.model_validate(raw)

    try:
        task, server_id, client_id = await _create_task(tm, params, handler_name)
    except ValueError as e:
        msg = str(e).lower()
        if "already exists" in msg:
            server_id = params.id
            client_id = params.id
        else:
            raise

    logger.info(
        "[transport.http] created task server_id=%s client_id=%s handler=%s",
        server_id, client_id, handler_name or "<default>"
    )

    queue = bus.subscribe()

    async def event_generator():
        try:
            while True:
                event = await queue.get()
                if getattr(event, "id", None) != server_id:
                    continue

                # Serialize via Pydantic model_dump
                if isinstance(event, TaskStatusUpdateEvent):
                    params_dict = event.model_dump(exclude_none=True)
                    params_dict["id"] = client_id
                    params_dict["type"] = "status"
                elif isinstance(event, TaskArtifactUpdateEvent):
                    params_dict = event.model_dump(exclude_none=True)
                    params_dict["id"] = client_id
                    params_dict["type"] = "artifact"
                else:
                    params_dict = event.model_dump(exclude_none=True)
                    params_dict["id"] = client_id

                # Wrap in JSONRPCRequest spec
                notification = JSONRPCRequest(
                    jsonrpc="2.0",
                    id=payload.id,
                    method="tasks/event",
                    params=params_dict,
                )

                # chunk
                chunk = notification.model_dump_json()
                yield f"data: {chunk}\n\n"

                # stop on terminal
                if getattr(event, "final", False) or (
                    isinstance(event, TaskStatusUpdateEvent) and _is_terminal(
                        event.status.state
                    )
                ):
                    break
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
